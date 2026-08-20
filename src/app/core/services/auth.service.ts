import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseClientService } from './supabase-client.service';
import { Profile, UserRole } from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseClientService).client;

  readonly profile = signal<Profile | null>(null);
  readonly initializing = signal(true);

  readonly isAuthenticated = computed(() => this.profile() !== null);
  readonly role = computed<UserRole | null>(() => this.profile()?.role ?? null);
  readonly isAuditor = computed(() => this.role() === 'auditor');
  readonly isColaborador = computed(() => this.role() === 'colaborador');

  constructor() {
    this.supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        this.loadProfile(session.user.id);
      } else {
        this.profile.set(null);
        this.initializing.set(false);
      }
    });
  }

  async restoreSession(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    if (data.session?.user) {
      await this.loadProfile(data.session.user.id);
    } else {
      this.initializing.set(false);
    }
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      this.profile.set(null);
    } else {
      this.profile.set({
        id: data['id'],
        email: data['email'],
        fullName: data['full_name'],
        role: data['role'],
        createdAt: data['created_at']
      });
    }
    this.initializing.set(false);
  }

  async login(email: string, password: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async registerColaborador(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) {
      return { error: error.message };
    }
    if (data.user && !data.session) {
      return { error: 'CONFIRM_EMAIL' };
    }
    return { error: null };
  }

  async logout(): Promise<void> {
    await this.supabase.auth.signOut();
    this.profile.set(null);
  }

  /**
   * Re-verifies the current password before changing it — Supabase's
   * updateUser() trusts the active session alone, which isn't enough if
   * someone walks up to an unlocked, still-logged-in laptop.
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
    const email = this.profile()?.email;
    if (!email) {
      return { error: 'No hay sesión activa.' };
    }

    const { error: reauthError } = await this.supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      return { error: 'La contraseña actual no es correcta.' };
    }

    const { error: updateError } = await this.supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return { error: updateError.message };
    }

    return { error: null };
  }
}
