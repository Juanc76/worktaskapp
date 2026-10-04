import { Routes } from '@angular/router';

export const REGISTRO_SERVICIO_PME_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../registrationPme/registroServicio/registroServicio.component').then(m => m.RegistroServicioComponent),
  },
  {
    path: 'photoRecordPme/:id',
    loadComponent: () => import('./photoRecordPme/photoRecordPme.component').then(m => m.PhotoRecordPmeComponent),
  },
  {
    path: 'detalleRuta/:ruta',
    loadComponent: () => import('./detalleRuta/detalleRuta.component').then(m => m.DetalleRutaComponent),
  },
  {
    path: 'detalleBeneficiarios/:ruta',
    loadComponent: () => import('./detalleBeneficiarios/detalleBeneficiarios.component').then(m => m.DetalleBeneficiariosComponent),
  }
];
