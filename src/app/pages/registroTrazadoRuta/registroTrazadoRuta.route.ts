import { Routes } from '@angular/router';

export const REGISTRO_TRAZADO_RUTA_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('../../pages/registroTrazadoRuta/registroTrazado/registroTrazado.component').then(m => m.RegistroTrazadoComponent),
  }
  ,
   {
     path: 'mapseguimiento/:id',
     loadComponent: () => import('./registroMap/registroMapsArcgis.component').then(m => m.MapaArcgisComponent),
   },
  // {
  //   path: 'detalleRuta/:ruta',
  //   loadComponent: () => import('./detalleRuta/detalleRuta.component').then(m => m.DetalleRutaComponent),
  // },
  // {
  //   path: 'detalleBeneficiarios/:ruta',
  //   loadComponent: () => import('./detalleBeneficiarios/detalleBeneficiarios.component').then(m => m.DetalleBeneficiariosComponent),
  // }
];
