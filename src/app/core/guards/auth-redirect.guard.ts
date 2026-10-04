import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';


export const redirectIfAuthenticatedGuard = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);

    // 1. Recuperamos valor en memoria o storage
  let memoryToken = authService.getAccessTokenMemory();
  const storageToken = await authService.getAccessTokenStorage(); 

    // 2. Seguridad: Si hay conflicto en los recursos disponibles.
  if (memoryToken && storageToken && memoryToken !== storageToken) {
    console.warn('Inconsistencia de tokens detectada. Limpiando sesión...');
    authService.logout();
    return true; 
  }

  // 3. Hidratación de memoria: con el refresco de página (F5) y si el token sigue en storage
  if (!memoryToken && storageToken) {
      authService.setAccessTokenMemory(storageToken);
      memoryToken = storageToken;
      router.navigate(['/main'])
      return false;
  }

  // 4. Acceso Directo: Si ya está en memoria
    if (memoryToken) {
      router.navigate(['/main'])
      return false;
  }

  //5. Si NO hay Access Token, ejecuto RefreshToken para recuperar sesion silenciosamente.
   try {
    // La app envia el refresh token almacenado al backend.
       await authService.refreshToken(); 
    
        // Si el servidor responde 200 OK y el AuthService guardó el nuevo AccessToken:
        console.log('Sesion recuperada via refresh token. Redirigiendo...');
        router.navigate(['/main']);
        return false;
    } catch (error) {
          // Si falla (ej. el refresh token expiro o no existe), el servidor dara error.
          // En este caso, permitimos que el usuario vea el Login.
       authService.logout(); 
    }

  return true;
};
