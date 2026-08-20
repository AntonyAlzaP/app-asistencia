import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ProfilesService } from '../../../core/services/profiles.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ConfigService } from '../../../core/services/config.service';
import { DevicesService } from '../../../core/services/devices.service';
import { AuthService } from '../../../core/services/auth.service';
import { Topbar } from '../../../shared/components/topbar/topbar';
import { Profile } from '../../../core/models/profile.model';
import { WorkHoursConfig } from '../../../core/models/work-hours-config.model';
import { DailyHours } from '../../../core/models/attendance-record.model';
import { Device } from '../../../core/models/device.model';
import { computeDailyHours, formatHours, getWeekRange, toLocalDateKey } from '../../../core/utils/hours.util';

const LINE_COLORS = ['#0062ae', '#ea580c', '#16a34a', '#c026d3', '#d97706', '#0891b2', '#be123c', '#4f46e5'];

interface PersonSummaryRow {
  profile: Profile;
  isCheckedIn: boolean;
  daysWithRecords: number;
  totalHours: number;
  avgHoursPerDay: number;
  daysBelowTarget: number;
}

interface IndividualDayRow extends DailyHours {
  belowTarget: boolean;
}

interface UserOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-auditor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    CardModule,
    ChartModule,
    SelectModule,
    DatePickerModule,
    Topbar
  ],
  templateUrl: './auditor-dashboard.html',
  styleUrl: './auditor-dashboard.scss'
})
export class AuditorDashboard implements OnInit {
  private readonly profilesService = inject(ProfilesService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly configService = inject(ConfigService);
  private readonly devicesService = inject(DevicesService);
  private readonly auth = inject(AuthService);

  readonly today = new Date();

  readonly loading = signal(true);
  readonly config = signal<WorkHoursConfig | null>(null);
  readonly profiles = signal<Profile[]>([]);
  readonly pendingDevices = signal<Device[]>([]);
  readonly approvingDeviceId = signal<string | null>(null);

  readonly selectedUserId = signal<string>('all');
  readonly dateRange = signal<Date[]>([getWeekRange(new Date()).start, new Date()]);

  readonly summaryRows = signal<PersonSummaryRow[]>([]);
  readonly individualRows = signal<IndividualDayRow[]>([]);
  readonly summaryChart = signal<any>(null);
  readonly individualChart = signal<any>(null);

  readonly isIndividualView = computed(() => this.selectedUserId() !== 'all');
  readonly selectedProfile = computed(() => this.profiles().find((p) => p.id === this.selectedUserId()) ?? null);

  readonly userOptions = computed<UserOption[]>(() => [
    { label: 'Todos', value: 'all' },
    ...this.profiles().map((p) => ({ label: p.fullName, value: p.id }))
  ]);

  readonly alertCount = computed(() =>
    this.isIndividualView()
      ? this.individualRows().filter((r) => r.belowTarget).length
      : this.summaryRows().filter((r) => r.daysBelowTarget > 0).length
  );

  readonly barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } },
    plugins: { legend: { position: 'bottom' } }
  };

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async onUserChange(): Promise<void> {
    await this.refresh();
  }

  async onRangeChange(value: Date[]): Promise<void> {
    this.dateRange.set(value);
    // The range picker emits an incomplete [start, null] pair while the user
    // is still picking the end date — only refetch once both ends are set.
    if (value[0] && value[1]) {
      await this.refresh();
    }
  }

  async refresh(): Promise<void> {
    this.loading.set(true);

    const [config, profiles, pendingDevices] = await Promise.all([
      this.configService.getConfig(),
      this.profilesService.getAllProfiles(),
      this.devicesService.getPendingDevices()
    ]);
    this.config.set(config);
    this.profiles.set(profiles);
    this.pendingDevices.set(pendingDevices);

    const [start, end] = this.dateRange();
    const rangeStart = new Date(start);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(end ?? start);
    rangeEnd.setHours(23, 59, 59, 999);
    const now = new Date();

    if (this.isIndividualView()) {
      const profile = this.selectedProfile();
      if (!profile) {
        this.individualRows.set([]);
        this.individualChart.set(null);
        this.loading.set(false);
        return;
      }
      const records = await this.attendanceService.getRecordsForUser(profile.id, rangeStart, rangeEnd);
      const daily = computeDailyHours(records, now);
      const rows: IndividualDayRow[] = daily
        .map((d) => ({ ...d, belowTarget: !d.isOpenSession && d.hours < config.dailyHours }))
        .sort((a, b) => b.date.localeCompare(a.date));
      this.individualRows.set(rows);
      this.buildIndividualChart(rows, config);
    } else {
      const userIds = profiles.map((p) => p.id);
      const records = await this.attendanceService.getRecordsForUsersSince(userIds, rangeStart, rangeEnd);
      const todayKey = toLocalDateKey(now.toISOString());

      const rows: PersonSummaryRow[] = profiles.map((profile) => {
        const userRecords = records.filter((r) => r.userId === profile.id);
        const daily = computeDailyHours(userRecords, now);
        const totalHours = daily.reduce((acc, d) => acc + d.hours, 0);
        const daysBelowTarget = daily.filter((d) => !d.isOpenSession && d.hours < config.dailyHours).length;
        const today = daily.find((d) => d.date === todayKey);

        return {
          profile,
          isCheckedIn: today?.isOpenSession ?? false,
          daysWithRecords: daily.length,
          totalHours,
          avgHoursPerDay: daily.length > 0 ? totalHours / daily.length : 0,
          daysBelowTarget
        };
      });

      this.summaryRows.set(rows);
      this.buildSummaryChart(rows, config);
    }

    this.loading.set(false);
  }

  private buildSummaryChart(rows: PersonSummaryRow[], config: WorkHoursConfig): void {
    this.summaryChart.set({
      labels: rows.map((r) => r.profile.fullName),
      datasets: [
        {
          label: 'Horas en el rango',
          backgroundColor: rows.map((r) => (r.daysBelowTarget > 0 ? '#e24c4c' : '#0062ae')),
          data: rows.map((r) => Number(r.totalHours.toFixed(2)))
        },
        {
          label: 'Meta esperada (días con marca × meta diaria)',
          backgroundColor: '#c8d6e5',
          data: rows.map((r) => Number((r.daysWithRecords * config.dailyHours).toFixed(2)))
        }
      ]
    });
  }

  private buildIndividualChart(rows: IndividualDayRow[], config: WorkHoursConfig): void {
    const chronological = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    this.individualChart.set({
      labels: chronological.map((r) => r.date),
      datasets: [
        {
          label: 'Horas trabajadas',
          borderColor: LINE_COLORS[0],
          backgroundColor: chronological.map((r) => (r.belowTarget ? '#e24c4c' : '#0062ae')),
          data: chronological.map((r) => Number(r.hours.toFixed(2)))
        },
        {
          label: 'Meta diaria',
          type: 'line',
          borderColor: '#94a3b8',
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          data: chronological.map(() => config.dailyHours)
        }
      ]
    });
  }

  async approveDevice(device: Device): Promise<void> {
    const auditorId = this.auth.profile()?.id;
    if (!auditorId) {
      return;
    }
    this.approvingDeviceId.set(device.id);
    await this.devicesService.approve(device.id, auditorId);
    this.pendingDevices.update((list) => list.filter((d) => d.id !== device.id));
    this.approvingDeviceId.set(null);
  }

  formatHours = formatHours;
}
