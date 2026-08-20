import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule, MessageModule, CardModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly fullName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.fullName() || !this.email() || !this.password()) {
      this.errorMessage.set('Completa todos los campos.');
      return;
    }
    if (this.password().length < 8) {
      this.errorMessage.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { error } = await this.auth.registerColaborador(this.email(), this.password(), this.fullName());
    this.loading.set(false);

    if (error === 'CONFIRM_EMAIL') {
      this.successMessage.set('Cuenta creada. Revisa tu correo para confirmar antes de ingresar.');
      return;
    }
    if (error) {
      this.errorMessage.set(error);
      return;
    }

    this.router.navigate(['/colaborador']);
  }
}
