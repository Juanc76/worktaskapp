import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { PermisosStateService } from '../services/permisos-state.service';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const permisosState = inject(PermisosStateService);

  /**
   * Recarga permisos si el BehaviorSubject está vacío (ej. tras F5).
   * Lee el idRol directamente del JWT para no depender de un valor hardcodeado.
   */
  async function recargarPermisosSiNecesario(token: string): Promise<void> {
    if (permisosState.getPermisos().length > 0) return; // ya están en memoria

    try {
      authService.setAccessTokenMemory(token); // asegura que el token esté en memoria
      const roles = authService.getRolesFromToken();

      if (roles.length === 0) {
        console.warn('El token no contiene roles. No se pueden cargar permisos.');
        return;
      }

      // Si hay un rol guardado en localStorage (elegido previamente), úsalo.
      // Si no, usa el primero disponible (caso de usuario con 1 solo rol).
      const idRolGuardado = localStorage.getItem('idRolActivo');
      const idRol = idRolGuardado ? Number(idRolGuardado) : roles[0].id;

      await new Promise<void>(resolve => {
        permisosState.cargarPermisosPorRol(idRol).subscribe({
          next: () => resolve(),
          error: () => resolve() // no bloquear navegación si falla
        });
      });
    } catch (e) {
    
    }
  }

  // 1. Token en memoria vs storage
  let memoryToken = authService.getAccessTokenMemory();
  const storageToken = await authService.getAccessTokenStorage();

  // 2. Inconsistencia de tokens → limpiar sesión
  if (memoryToken && storageToken && memoryToken !== storageToken) {
    console.warn('Inconsistencia de tokens detectada. Limpiando sesión...');
    authService.logout();
    return false;
  }

  // 3. Hidratación tras F5: token en storage pero no en memoria
  if (!memoryToken && storageToken) {
    authService.setAccessTokenMemory(storageToken);
    memoryToken = storageToken;
    await recargarPermisosSiNecesario(memoryToken);
    return true;
  }

  // 4. Token ya en memoria
  if (memoryToken) {
    await recargarPermisosSiNecesario(memoryToken);
    return true;
  }

  // 5. Intentar recuperar sesion con refresh token almacenado
  try {
    await authService.refreshToken();
    const newToken = authService.getAccessTokenMemory();
    if (newToken) await recargarPermisosSiNecesario(newToken);
    console.log('Sesion recuperada via refresh token.');
    return true;
  } catch (error) {
    authService.logout();
  }

  router.navigate(['auth/login']);
  return false;
};
