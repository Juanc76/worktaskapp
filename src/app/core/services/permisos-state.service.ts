// src/app/core/services/permisos-state.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface PermisoAsignado {
  idpermiso: {
    idPermiso: number;
    codigo: string;
    nombre: string;
    endPoint?: string;
    metodoHTTP?: string;
  };
  isState: boolean;
}

@Injectable({ providedIn: 'root' })
export class PermisosStateService {

  private readonly base = `${environment.apiUrls.endpoint4}/permisos/rol`;
  private _permisos$ = new BehaviorSubject<PermisoAsignado[]>([]);
  readonly permisos$ = this._permisos$.asObservable();

  constructor(private http: HttpClient) {}

  /** Carga permisos del rol desde el backend */
  cargarPermisosPorRol(idRol: number): Observable<PermisoAsignado[]> {
    return this.http.get<PermisoAsignado[]>(`${this.base}/${idRol}`).pipe(
      tap(permisos => this._permisos$.next(permisos.filter(p => p.isState)))
    );
  }

  /** Limpia al hacer logout */
  limpiar(): void {
    this._permisos$.next([]);
  }

  /** Verifica si tiene un permiso por código */
  tiene(codigo: string): boolean {
    return this._permisos$.getValue().some(p => p.idpermiso.codigo === codigo);
  }

  /** Verifica si tiene permiso VER/GET sobre un routerLink */
  puedeVerRuta(routerLink: string): boolean {
    return this._permisos$.getValue().some(p =>
      p.isState &&
      p.idpermiso.endPoint === routerLink &&
      (p.idpermiso.metodoHTTP === 'GET' || p.idpermiso.codigo.endsWith('_VER'))
    );
  }

  /** Retorna todos los permisos activos */
  getPermisos(): PermisoAsignado[] {
    return this._permisos$.getValue();
  }

  /** Retorna los endPoints con permiso VER activo */
  getEndPointsPermitidos(): string[] {
    return this._permisos$.getValue()
      .filter(p =>
        p.isState &&
        (p.idpermiso.metodoHTTP === 'GET' || p.idpermiso.codigo.endsWith('_VER'))
      )
      .map(p => p.idpermiso.endPoint ?? '')
      .filter(ep => ep !== '');
  }
}