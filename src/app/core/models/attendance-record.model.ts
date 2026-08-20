export type AttendanceType = 'in' | 'out';

export interface AttendanceRecord {
  id: string;
  userId: string;
  type: AttendanceType;
  takenAt: string;
  photoPath: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  deviceId: string | null;
  autoClosed: boolean;
  createdAt: string;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface DailyHours {
  date: string;
  hours: number;
  isOpenSession: boolean;
}
