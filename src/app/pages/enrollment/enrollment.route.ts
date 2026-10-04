import { Routes } from '@angular/router';

export const ENROLMENT_ROUTES: Routes = [
    {
    path: '',
     loadComponent: () => import('../enrollment/colegios/colegios.component').then(m => m.ColegiosComponent),
  },
  {
    path: 'estudiantes',
     loadComponent: () => import('../enrollment/estudiantes/estudiantes.component').then(m => m.EstudiantesComponent),

  },
  {
    path: 'estudiante-detalle',
    loadComponent: () => import('./enrolarEstudiante/enrolarEstudiante.component').then(m => m.EnrolarEstudianteComponent),
  },
];
