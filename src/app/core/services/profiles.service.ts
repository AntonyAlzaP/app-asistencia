import { Injectable, inject } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Profile } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfilesService {
  private readonly supabase = inject(SupabaseClientService).client;

  /** Everyone the auditor supervises: colaboradores and auditores alike, since auditores also mark attendance. */
  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('full_name', { ascending: true });

    if (error || !data) {
      return [];
    }

    return data.map((d) => ({
      id: d['id'],
      email: d['email'],
      fullName: d['full_name'],
      role: d['role'],
      createdAt: d['created_at']
    }));
  }

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data['id'],
      email: data['email'],
      fullName: data['full_name'],
      role: data['role'],
      createdAt: data['created_at']
    };
  }
}
