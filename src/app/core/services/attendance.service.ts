import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { AttendanceRecord, AttendanceType, Geolocation } from '../models/attendance-record.model';
import { environment } from '../../../environments/environment';

const RECORD_COLUMNS =
  'id, user_id, type, taken_at, photo_path, latitude, longitude, location_accuracy, device_id, auto_closed, created_at';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly supabase = inject(SupabaseClientService).client;
  private readonly bucket = environment.attendancePhotosBucket;

  async getLastRecordForUser(userId: string): Promise<AttendanceRecord | null> {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select(RECORD_COLUMNS)
      .eq('user_id', userId)
      .order('taken_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }
    return this.mapRecord(data);
  }

  async getRecordsForUser(userId: string, since: Date, until?: Date): Promise<AttendanceRecord[]> {
    let query = this.supabase
      .from('attendance_records')
      .select(RECORD_COLUMNS)
      .eq('user_id', userId)
      .gte('taken_at', since.toISOString());

    if (until) {
      query = query.lte('taken_at', until.toISOString());
    }

    const { data, error } = await query.order('taken_at', { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map((d) => this.mapRecord(d));
  }

  async getRecordsForUsersSince(userIds: string[], since: Date, until?: Date): Promise<AttendanceRecord[]> {
    if (userIds.length === 0) {
      return [];
    }
    let query = this.supabase
      .from('attendance_records')
      .select(RECORD_COLUMNS)
      .in('user_id', userIds)
      .gte('taken_at', since.toISOString());

    if (until) {
      query = query.lte('taken_at', until.toISOString());
    }

    const { data, error } = await query.order('taken_at', { ascending: true });

    if (error || !data) {
      return [];
    }
    return data.map((d) => this.mapRecord(d));
  }

  async markAttendance(
    userId: string,
    type: AttendanceType,
    photoBlob: Blob,
    location: Geolocation | null,
    deviceId: string | null
  ): Promise<{ error: string | null }> {
    const takenAt = new Date();
    const photoPath = `${userId}/${type}-${takenAt.getTime()}.jpg`;

    const { error: uploadError } = await this.supabase.storage
      .from(this.bucket)
      .upload(photoPath, photoBlob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError) {
      return { error: `No se pudo subir la foto: ${uploadError.message}` };
    }

    const { error: insertError } = await this.supabase.from('attendance_records').insert({
      user_id: userId,
      type,
      taken_at: takenAt.toISOString(),
      photo_path: photoPath,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      location_accuracy: location?.accuracy ?? null,
      device_id: deviceId
    });

    if (insertError) {
      return { error: `No se pudo registrar la marca: ${insertError.message}` };
    }

    return { error: null };
  }

  mapsUrl(record: AttendanceRecord): string | null {
    if (record.latitude === null || record.longitude === null) {
      return null;
    }
    return `https://www.google.com/maps?q=${record.latitude},${record.longitude}`;
  }

  private mapRecord(raw: Record<string, any>): AttendanceRecord {
    return {
      id: raw['id'],
      userId: raw['user_id'],
      type: raw['type'],
      takenAt: raw['taken_at'],
      photoPath: raw['photo_path'],
      latitude: raw['latitude'] === null || raw['latitude'] === undefined ? null : Number(raw['latitude']),
      longitude: raw['longitude'] === null || raw['longitude'] === undefined ? null : Number(raw['longitude']),
      locationAccuracy:
        raw['location_accuracy'] === null || raw['location_accuracy'] === undefined
          ? null
          : Number(raw['location_accuracy']),
      deviceId: raw['device_id'] ?? null,
      autoClosed: raw['auto_closed'] ?? false,
      createdAt: raw['created_at']
    };
  }
}
