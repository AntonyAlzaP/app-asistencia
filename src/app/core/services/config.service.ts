import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { WorkHoursConfig } from '../models/work-hours-config.model';

const CONFIG_ROW_ID = '00000000-0000-0000-0000-000000000001';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly supabase = inject(SupabaseClientService).client;

  async getConfig(): Promise<WorkHoursConfig> {
    const { data, error } = await this.supabase
      .from('work_hours_config')
      .select('id, daily_hours, weekly_hours, updated_at, updated_by')
      .eq('id', CONFIG_ROW_ID)
      .maybeSingle();

    if (error || !data) {
      return { id: CONFIG_ROW_ID, dailyHours: 8, weeklyHours: 40, updatedAt: new Date().toISOString(), updatedBy: null };
    }

    return {
      id: data['id'],
      dailyHours: Number(data['daily_hours']),
      weeklyHours: Number(data['weekly_hours']),
      updatedAt: data['updated_at'],
      updatedBy: data['updated_by']
    };
  }

  async updateConfig(dailyHours: number, weeklyHours: number, auditorId: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('work_hours_config').upsert({
      id: CONFIG_ROW_ID,
      daily_hours: dailyHours,
      weekly_hours: weeklyHours,
      updated_at: new Date().toISOString(),
      updated_by: auditorId
    });

    return { error: error?.message ?? null };
  }
}
