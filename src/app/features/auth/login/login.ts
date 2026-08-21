import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { AuthService } from '../../../core/services/auth.service';
import { CredentialsService } from '../../../core/services/credentials.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
    CardModule,
    CheckboxModule
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly credentialsService = inject(CredentialsService);

  readonly email = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const saved = await this.credentialsService.load();
    if (saved) {
      this.email.set(saved.email);
      this.password.set(saved.password);
      this.rememberMe.set(true);
    }
  }

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

    if (this.rememberMe()) {
      await this.credentialsService.save(this.email(), this.password());
    } else {
      await this.credentialsService.clear();
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
