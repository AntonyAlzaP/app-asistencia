import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register)
  },
  {
    // Open to any authenticated user: auditores también marcan su propia asistencia.
    path: 'colaborador',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/colaborador/dashboard/colaborador-dashboard').then((m) => m.ColaboradorDashboard)
  },
  {
    path: 'perfil/contrasena',
    canActivate: [authGuard],
    loadComponent: () => import('./features/perfil/change-password/change-password').then((m) => m.ChangePassword)
  },
  {
    path: 'auditor',
    canActivate: [authGuard, roleGuard('auditor')],
    loadComponent: () => import('./features/auditor/dashboard/auditor-dashboard').then((m) => m.AuditorDashboard)
  },
  {
    path: 'auditor/config',
    canActivate: [authGuard, roleGuard('auditor')],
    loadComponent: () => import('./features/auditor/config/auditor-config').then((m) => m.AuditorConfig)
  },
  {
    path: 'auditor/colaborador/:userId',
    canActivate: [authGuard, roleGuard('auditor')],
    loadComponent: () =>
      import('./features/auditor/colaborador-detail/colaborador-detail').then((m) => m.ColaboradorDetail)
  },
  { path: '**', redirectTo: 'login' }
];
