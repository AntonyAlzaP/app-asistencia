import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ConfigService } from '../../../core/services/config.service';
import { AuthService } from '../../../core/services/auth.service';
import { Topbar } from '../../../shared/components/topbar/topbar';

@Component({
  selector: 'app-auditor-config',
  standalone: true,
  imports: [FormsModule, CardModule, InputNumberModule, ButtonModule, MessageModule, Topbar],
  templateUrl: './auditor-config.html',
  styleUrl: './auditor-config.scss'
})
export class AuditorConfig implements OnInit {
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly dailyHours = signal(8);
  readonly weeklyHours = signal(40);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const config = await this.configService.getConfig();
    this.dailyHours.set(config.dailyHours);
    this.weeklyHours.set(config.weeklyHours);
    this.loading.set(false);
  }

  async save(): Promise<void> {
    const auditorId = this.auth.profile()?.id;
    if (!auditorId) {
      return;
    }
    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    const { error } = await this.configService.updateConfig(this.dailyHours(), this.weeklyHours(), auditorId);
    this.saving.set(false);

    if (error) {
      this.errorMessage.set(error);
      return;
    }
    this.successMessage.set('Configuración guardada.');
  }

  back(): void {
    this.router.navigate(['/auditor']);
  }
}
