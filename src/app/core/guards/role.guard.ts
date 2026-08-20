import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRole } from '../models/profile.model';

export function roleGuard(allowedRole: UserRole): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    if (auth.role() !== allowedRole) {
      return router.createUrlTree(auth.isAuditor() ? ['/auditor'] : ['/colaborador']);
    }
    return true;
  };
}
