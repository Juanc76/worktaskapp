import { Routes } from '@angular/router';
import { LoginComponent } from '../auth/login/login.component';
import { AuthRedirectComponent } from './redirect/redirect.component';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
  //  canActivate: [redirectIfAuthenticatedGuard]
  },
  {
    path: 'redirect',
    component: AuthRedirectComponent
  },
{
    path: 'registro',
   // canActivate: [redirectIfAuthenticated],
    children: [
    /*    {
        path: '',
        loadComponent: () => import('../registro/registro.page').then(m => m.RegistroPage)
      },
      {
        path: 'interventor',
        loadComponent: () => import('../registro/interventor/interventor.page').then(m => m.InterventorPage)
      },
      {
        path: 'privado',
        loadComponent: () => import('../registro/privado/privado.page').then(m => m.PrivadoPage)
      }*/
    ]
  }
];
