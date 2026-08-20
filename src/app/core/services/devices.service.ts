import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Device } from '../models/device.model';

@Injectable({ providedIn: 'root' })
export class DevicesService {
  private readonly supabase = inject(SupabaseClientService).client;

  /**
   * Registers this (user, device) pair on first sight and reports whether an
   * auditor has approved it. "Alerta" mode: never blocks the caller — the
   * result is only used to flag unapproved devices to the auditor.
   */
  async ensureRegistered(userId: string, deviceId: string, hostname: string): Promise<{ approved: boolean }> {
    const { data: existing } = await this.supabase
      .from('devices')
      .select('approved')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (existing) {
      return { approved: existing['approved'] };
    }

    await this.supabase.from('devices').insert({
      user_id: userId,
      device_id: deviceId,
      hostname
    });

    return { approved: false };
  }

  async getPendingDevices(): Promise<Device[]> {
    const { data, error } = await this.supabase
      .from('devices')
      .select('id, user_id, device_id, hostname, first_seen_at, approved, approved_at, approved_by, profiles(full_name)')
      .eq('approved', false)
      .order('first_seen_at', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((d) => this.mapDevice(d));
  }

  async approve(deviceRowId: string, auditorId: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('devices')
      .update({ approved: true, approved_at: new Date().toISOString(), approved_by: auditorId })
      .eq('id', deviceRowId);

    return { error: error?.message ?? null };
  }

  private mapDevice(raw: Record<string, any>): Device {
    return {
      id: raw['id'],
      userId: raw['user_id'],
      deviceId: raw['device_id'],
      hostname: raw['hostname'],
      firstSeenAt: raw['first_seen_at'],
      approved: raw['approved'],
      approvedAt: raw['approved_at'],
      approvedBy: raw['approved_by'],
      userFullName: raw['profiles']?.['full_name'] ?? 'Desconocido'
    };
  }
}
