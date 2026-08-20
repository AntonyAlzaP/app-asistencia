import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../../core/services/auth.service';
import { AttendanceService } from '../../../core/services/attendance.service';
import { GeolocationService } from '../../../core/services/geolocation.service';
import { DeviceService } from '../../../core/services/device.service';
import { DevicesService } from '../../../core/services/devices.service';
import { CameraCapture } from '../../../shared/components/camera-capture/camera-capture';
import { Topbar } from '../../../shared/components/topbar/topbar';
import { AttendanceRecord, AttendanceType, Geolocation } from '../../../core/models/attendance-record.model';
import { computeDailyHours, formatElapsed, formatHours, getWeekRange, sumHours } from '../../../core/utils/hours.util';

@Component({
  selector: 'app-colaborador-dashboard',
  standalone: true,
  imports: [CardModule, ButtonModule, CameraCapture, Topbar],
  templateUrl: './colaborador-dashboard.html',
  styleUrl: './colaborador-dashboard.scss'
})
export class ColaboradorDashboard implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly deviceService = inject(DeviceService);
  private readonly devicesService = inject(DevicesService);

  private deviceId: string | null = null;

  readonly lastRecord = signal<AttendanceRecord | null>(null);
  readonly weekRecords = signal<AttendanceRecord[]>([]);
  readonly cameraVisible = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly nowTick = signal(Date.now());

  private pendingType: AttendanceType | null = null;
  private pendingLocation: Promise<Geolocation | null> | null = null;
  private timerHandle: ReturnType<typeof setInterval> | null = null;

  readonly isCheckedIn = computed(() => this.lastRecord()?.type === 'in');
  readonly nextAction = computed<AttendanceType>(() => (this.isCheckedIn() ? 'out' : 'in'));

  readonly elapsedLabel = computed(() => {
    const record = this.lastRecord();
    if (!record || record.type !== 'in') {
      return '00:00:00';
    }
    return formatElapsed(this.nowTick() - new Date(record.takenAt).getTime());
  });

  readonly weekHoursLabel = computed(() => {
    const daily = computeDailyHours(this.weekRecords(), new Date(this.nowTick()));
    return formatHours(sumHours(daily));
  });

  async ngOnInit(): Promise<void> {
    await this.refresh();
    this.registerDevice();
    this.timerHandle = setInterval(() => this.nowTick.set(Date.now()), 1000);
  }

  private async registerDevice(): Promise<void> {
    const userId = this.auth.profile()?.id;
    if (!userId) {
      return;
    }
    // Best-effort: runs in the background and never blocks marking attendance.
    try {
      const { deviceId, hostname } = await this.deviceService.getIdentity();
      this.deviceId = deviceId;
      await this.devicesService.ensureRegistered(userId, deviceId, hostname);
    } catch {
      // Device recognition is a nice-to-have signal for the auditor, not a
      // requirement — attendance marking still works with deviceId left null.
    }
  }

  ngOnDestroy(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }
  }

  private async refresh(): Promise<void> {
    const userId = this.auth.profile()?.id;
    if (!userId) {
      return;
    }
    this.loading.set(true);
    const { start } = getWeekRange(new Date());
    const [last, week] = await Promise.all([
      this.attendanceService.getLastRecordForUser(userId),
      this.attendanceService.getRecordsForUser(userId, start)
    ]);
    this.lastRecord.set(last);
    this.weekRecords.set(week);
    this.loading.set(false);
  }

  openCamera(): void {
    this.errorMessage.set(null);
    this.pendingType = this.nextAction();
    // Kicked off in parallel with the camera dialog so it's usually resolved
    // by the time the user captures the photo.
    this.pendingLocation = this.geolocationService.getCurrentPosition();
    this.cameraVisible.set(true);
  }

  async onCaptured(blob: Blob): Promise<void> {
    const userId = this.auth.profile()?.id;
    if (!userId || !this.pendingType) {
      return;
    }
    this.saving.set(true);
    const location = await (this.pendingLocation ?? Promise.resolve(null));
    const { error } = await this.attendanceService.markAttendance(userId, this.pendingType, blob, location, this.deviceId);
    this.saving.set(false);
    this.pendingType = null;
    this.pendingLocation = null;

    if (error) {
      this.errorMessage.set(error);
      return;
    }
    await this.refresh();
  }
}
