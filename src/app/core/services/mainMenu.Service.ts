import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable,catchError, throwError } from 'rxjs'; // Para manejar los observables
import { environment } from '../../../environments/environment'
import { ColegioByUserDTO, GradoSitioEntregaDTO, SedeByColegioDTO, SitioEntregaPAEDTO, RutasByUserDTO } from '../models/mainMenu.model';

@Injectable({
  providedIn: 'root' 
})
export class MainMenuService {
  
 
  private baseUrl2 = environment.apiUrls.endpoint2
  private apiUrl1 = this.baseUrl2+'/getColegiosByUsuario';  
  private apiUrl2 = this.baseUrl2+'/getSedesByUsuario'; 
  private apiUrl3 = this.baseUrl2+'/getSitiosEntregaByIdSede'
  private apiUrl4 = this.baseUrl2+'/getRutasByUser'
  private apiUrl5 = this.baseUrl2+'/getGradosBySitioEntrega'

  constructor(private http: HttpClient) { }

    /**
   * Obtiene los colegios por usuario
   * @param usuario El nombre, id o identificador de usuario. Se precisa cuando se integre a gestion de usuarios
   * @returns Observable con la lista de colegios
   */
  getColegiosByUser(usuario: string): Observable<ColegioByUserDTO[]> {
    const params = new HttpParams().set('idUserAsig', usuario);
    return this.http.get<ColegioByUserDTO[]>(this.apiUrl1, { params }).pipe(
      catchError(this.handleError)
    );
  }

    /**
   * Obtiene sedes educativas por usuario
   * @param usuario El nombre, id o identificador de usuario. Se precisa cuando se integre a gestion de usuarios
   * @returns Observable con la lista de sedes educativas
   */
  getSedesByColegio(usuario: string): Observable<SedeByColegioDTO[]> {
  const params = new HttpParams().set('idUserAsig', usuario);
  return this.http.get<SedeByColegioDTO[]>(this.apiUrl2, { params }).pipe(
    catchError(this.handleError)
  );
 }
  
 /**
   * Obtiene sitios de entrega PAE por sede
   * @param idSede El identificador de la sede
   * @returns Observable con la lista de sitios de entrega
   */
  getSitiosEntregaPAEBySede(idSede: number): Observable<SitioEntregaPAEDTO[]> {
    const params = new HttpParams().set('idSede', idSede);
    return this.http.get<SitioEntregaPAEDTO[]>(this.apiUrl3, { params }).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Obtiene rutas por usuario
   * @param usuario El nombre, id o identificador de usuario. Se precisa cuando se integre a gestion de usuario
   * @returns Observable con la lista de rutas
   */
  getRutasByUsuario(usuario: string): Observable<RutasByUserDTO[]> {
    const params = new HttpParams().set('idUserAsig', usuario);
    const apiUrl = `${this.apiUrl4}`;
    return this.http.get<RutasByUserDTO[]>(apiUrl, { params }).pipe(
      catchError(this.handleError)
    );
  }

   /**
   * Obtiene sitios de entrega PAE por sede
   * @param idSede El identificador de la sede
   * @returns Observable con la lista de grados por sitios de entrega
   */
  getGradosBySitioEntrega(idSede: number): Observable<GradoSitioEntregaDTO[]> {
    const params = new HttpParams().set('idSede', idSede);
    return this.http.get<GradoSitioEntregaDTO[]>(this.apiUrl5, { params }).pipe(
      catchError(this.handleError)
    );
  }

private handleError(error: HttpErrorResponse) {
   if (error.error && typeof error.error.mensaje === 'string') {
        return throwError(() => error.error); 
    }
     return throwError(() => ({ mensaje: `Error del servidor: ${error.error?.status || 'No reporta estado' } Por favor, contacta al soporte.` }));
   }

}