import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { ProfilesService } from '../../../core/services/profiles.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { ConfigService } from '../../../core/services/config.service';
import { Topbar } from '../../../shared/components/topbar/topbar';
import { Profile } from '../../../core/models/profile.model';
import { AttendanceRecord } from '../../../core/models/attendance-record.model';
import { DailyHours } from '../../../core/models/attendance-record.model';
import { computeDailyHours, formatHours } from '../../../core/utils/hours.util';

interface DailyRow extends DailyHours {
  alert: boolean;
}

@Component({
  selector: 'app-colaborador-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, CardModule, TableModule, TagModule, ButtonModule, Topbar],
  templateUrl: './colaborador-detail.html',
  styleUrl: './colaborador-detail.scss'
})
export class ColaboradorDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profilesService = inject(ProfilesService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly configService = inject(ConfigService);

  readonly profile = signal<Profile | null>(null);
  readonly dailyRows = signal<DailyRow[]>([]);
  readonly records = signal<AttendanceRecord[]>([]);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (!userId) {
      return;
    }

    const since = new Date();
    since.setDate(since.getDate() - 27);
    since.setHours(0, 0, 0, 0);

    const [profile, config, records] = await Promise.all([
      this.profilesService.getProfile(userId),
      this.configService.getConfig(),
      this.attendanceService.getRecordsForUser(userId, since)
    ]);

    this.profile.set(profile);
    this.records.set(records);

    const daily = computeDailyHours(records);
    this.dailyRows.set(
      daily
        .map((d) => ({ ...d, alert: !d.isOpenSession && d.hours < config.dailyHours }))
        .sort((a, b) => b.date.localeCompare(a.date))
    );

    this.loading.set(false);
  }

  mapsUrl(record: AttendanceRecord): string | null {
    return this.attendanceService.mapsUrl(record);
  }

  formatHours = formatHours;
}
