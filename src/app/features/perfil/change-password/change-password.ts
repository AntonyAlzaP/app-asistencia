import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { AuthService } from '../../../core/services/auth.service';
import { Topbar } from '../../../shared/components/topbar/topbar';

const MIN_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule, CardModule, PasswordModule, ButtonModule, MessageModule, Topbar],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss'
})
export class ChangePassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (!this.currentPassword() || !this.newPassword() || !this.confirmPassword()) {
      this.errorMessage.set('Completa todos los campos.');
      return;
    }
    if (this.newPassword().length < MIN_PASSWORD_LENGTH) {
      this.errorMessage.set(`La nueva contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.errorMessage.set('La nueva contraseña y su confirmación no coinciden.');
      return;
    }
    if (this.newPassword() === this.currentPassword()) {
      this.errorMessage.set('La nueva contraseña debe ser distinta a la actual.');
      return;
    }

    this.saving.set(true);
    const { error } = await this.auth.changePassword(this.currentPassword(), this.newPassword());
    this.saving.set(false);

    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.currentPassword.set('');
    this.newPassword.set('');
    this.confirmPassword.set('');
    this.successMessage.set('Contraseña actualizada correctamente.');
  }

  back(): void {
    this.router.navigate([this.auth.isAuditor() ? '/auditor' : '/colaborador']);
  }
}
