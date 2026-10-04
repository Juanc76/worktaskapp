import { Routes } from '@angular/router';
import { authGuard } from '../app/core/guards/auth.guard';
import { permissionGuard } from '../app/core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth', // Redirige directamente a la página de login
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('../app/pages/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'main',
   //  canActivate: [authGuard],
    loadComponent: () => import('../app/pages/mainMenu/mainMenu.component').then((m) => m.MainMenuComponent),
  },
  {
    path: 'enrollment',
    loadChildren: () => import('../app/pages/enrollment/enrollment.route').then(m => m.ENROLMENT_ROUTES),
  },
  {
    path: 'recognition',
      loadComponent: () => import('../app/pages/recognition/recognition.component').then((m) => m.RecognitionComponent),
  },
  {
    path: 'registroEntregaPAE',
    loadChildren: () =>
      import('../app/pages/registrationPae/registrationpae.route').then(m => m.REGISTRO_ENTREGA_PAE_ROUTES),
  },
    {
    path: 'registroServicioPME',
    loadChildren: () =>
      import('../app/pages/registrationPme/registrationpme.route').then(m => m.REGISTRO_SERVICIO_PME_ROUTES),
  },
  {
    path: 'recordTrazadoRuta',
    canActivate: [permissionGuard],
    data: { permissionCode: 'TRAZADOS_RUTAS_ADD' },
    loadComponent: () => import('./pages/registroTrazadoRuta/recordTrazado/recordTrazadoRuta.component').then((m) => m.RecordTrazadoRutaComponent),
  }, 
  {
    path: 'registroTrazadoRuta',
    loadChildren: () =>
      import('../app/pages/registroTrazadoRuta/registroTrazadoRuta.route').then(m => m.REGISTRO_TRAZADO_RUTA_ROUTES),
  } 
];
