import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

import { routes } from './app.routes';
import { AuthService } from './core/services/auth.service';

// Daewoo Perú brand blue (#0062AE) as the PrimeNG primary color scale.
const DaewooPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0f8ff',
      100: '#dbefff',
      200: '#b3deff',
      300: '#80c7ff',
      400: '#42adff',
      500: '#0062ae',
      600: '#00457b',
      700: '#002e52',
      800: '#001d33',
      900: '#00111f',
      950: '#000b14'
    }
  }
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: DaewooPreset,
        options: {
          darkModeSelector: false
        }
      }
    }),
    provideAppInitializer(() => inject(AuthService).restoreSession())
  ]
};
