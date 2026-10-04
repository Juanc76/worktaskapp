import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { authGuard } from './auth.guard';
import { PermisosStateService } from '../services/permisos-state.service';

export const permissionGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const permisosState = inject(PermisosStateService);

  const authResult = authGuard(route, state);
  const isAuthenticated = isObservable(authResult)
    ? await firstValueFrom(authResult)
    : await authResult;

  if (isAuthenticated !== true) {
    return isAuthenticated;
  }

  const permissionCode = route.data?.['permissionCode'] as string | undefined;

  if (!permissionCode || permisosState.tiene(permissionCode)) {
    return true;
  }

   return router.createUrlTree(['/main']);
};
