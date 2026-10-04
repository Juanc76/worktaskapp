import { Routes } from '@angular/router';

export const REGISTRO_ENTREGA_PAE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../registrationPae/registroEntrega/registroEntrega.component').then(m => m.RegistroEntregaComponent),
  },
  {
    path: 'photoRecordPae/:id',
    loadComponent: () => import('./photoRecord/photoRecordPAE.component').then(m => m.PhotoRecordComponent),
  },
];
