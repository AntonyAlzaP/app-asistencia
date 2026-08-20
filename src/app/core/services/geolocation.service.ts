import { Injectable } from '@angular/core';
import { Geolocation } from '../models/attendance-record.model';

const TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  /** Resolves with the current position, or null if unavailable/denied/timed out. */
  getCurrentPosition(): Promise<Geolocation | null> {
    if (!('geolocation' in navigator)) {
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: TIMEOUT_MS, maximumAge: 60_000 }
      );
    });
  }
}
