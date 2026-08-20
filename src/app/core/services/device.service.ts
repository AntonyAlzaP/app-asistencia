import { Injectable } from '@angular/core';

interface DeviceIdentity {
  deviceId: string;
  hostname: string;
}

declare global {
  interface Window {
    attendanceDevice?: {
      getDeviceId(): Promise<DeviceIdentity>;
    };
  }
}

const DEV_FALLBACK_KEY = 'app-asistencia-dev-device-id';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private cached: DeviceIdentity | null = null;

  /**
   * Resolves the Electron-persisted device id (see electron/main.js). Outside
   * Electron (e.g. `ng serve` in a plain browser during development) falls
   * back to a localStorage id — dev convenience only, not the real mechanism.
   */
  async getIdentity(): Promise<DeviceIdentity> {
    if (this.cached) {
      return this.cached;
    }

    if (window.attendanceDevice) {
      this.cached = await window.attendanceDevice.getDeviceId();
      return this.cached;
    }

    let deviceId = localStorage.getItem(DEV_FALLBACK_KEY);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEV_FALLBACK_KEY, deviceId);
    }
    this.cached = { deviceId, hostname: 'navegador (dev)' };
    return this.cached;
  }
}
