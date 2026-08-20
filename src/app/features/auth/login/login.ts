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
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, InputTextModule, PasswordModule, ButtonModule, MessageModule, CardModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async submit(): Promise<void> {
    if (!this.email() || !this.password()) {
      this.errorMessage.set('Ingresa correo y contraseña.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { error } = await this.auth.login(this.email(), this.password());

    if (error) {
      this.errorMessage.set('Credenciales inválidas o usuario inexistente.');
      this.loading.set(false);
      return;
    }

    await this.redirectByRole();
  }

  private async redirectByRole(): Promise<void> {
    let attempts = 0;
    while (!this.auth.profile() && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    this.loading.set(false);
    this.router.navigate([this.auth.isAuditor() ? '/auditor' : '/colaborador']);
  }
}
