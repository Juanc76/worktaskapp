import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi,HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideRouter,withPreloading, PreloadAllModules } from '@angular/router';
import { importProvidersFrom, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import Aura from '@primeng/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { GoogleMapsModule } from'@angular/google-maps' ; 
import { MSAL_INSTANCE,MSAL_GUARD_CONFIG,MsalService, MsalGuard, MsalBroadcastService} from '@azure/msal-angular';
import { MSALInstanceFactory, MSALGuardConfigFactory, initializeMsal} from './app/core/auth/msal-config';
import { AuthInterceptor } from './app/core/interceptors/interceptors';
import { AuthService } from './app/core/auth/auth.service';

// Crea la instancia principal de MSAL
  export function initializeApp(authService: AuthService) {
  return () => authService.loadTokenFromStorage();
}

(async () => {
  await initializeMsal(); 

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptorsFromDi()),
    importProvidersFrom(IonicModule.forRoot()),
    provideAnimations(),
    providePrimeNG({
      theme: { 
        preset: Aura,
        options: { darkModeSelector: '.p-dark' },
      },
    }),

    importProvidersFrom(GoogleMapsModule),
    {provide: MSAL_INSTANCE,useFactory: MSALInstanceFactory },
    {provide: MSAL_GUARD_CONFIG,useFactory: MSALGuardConfigFactory},

    MsalService,
    MsalGuard,
    MsalBroadcastService,

  
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },

    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [AuthService],
      multi: true,
    },
   
  ],
}).catch(err => console.error('No fue posible iniciar la aplicación.'));

})();