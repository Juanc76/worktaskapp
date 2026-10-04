import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse, } from '@angular/common/http';
import { BehaviorSubject, Observable, of,throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Estudiantes } from '../models/estudiante.model';
import { environment } from '../../../environments/environment'

@Injectable({
  providedIn: 'root'
})

export class EstudianteService {
    // BehaviorSubject para almacenar y emitir los estudiantes.
  private baseUrl = environment.apiUrls.endpoint2;
  private apiUrl = this.baseUrl+'/getMatriculaByColegio';
  private apiUrl2 = this.baseUrl+'/getMatriculaBySede';
  private apiUrl3 = this.baseUrl+'/getMatriculaByJornada';
  

  private estudiantesSubject = new BehaviorSubject<Estudiantes[] | null>(null);
  public estudiantes$ = this.estudiantesSubject.asObservable();

  constructor(private http: HttpClient) { }

  public getEstudiantesPorColegio(daneColegio: string): Observable<Estudiantes[]> {
  
    const params = new HttpParams().set('daneColegio', daneColegio)
  
     return this.http.get<Estudiantes[]>(this.apiUrl, { params }).pipe(
      tap(estudiantes => {
        this.estudiantesSubject.next(estudiantes); 
      }),
      catchError(this.handleError)
    );
  }

  public getEstudiantesPorSede(daneColegio: string, daneSede: string): Observable<Estudiantes[]> {
  
    const params = new HttpParams()
    .set('daneColegio', daneColegio)
    .set('daneSede', daneSede);  

     return this.http.get<Estudiantes[]>(this.apiUrl2, { params }).pipe(
      tap(estudiantes => {
        this.estudiantesSubject.next(estudiantes); 
      }),
      catchError(this.handleError)
    );
  }

   public getEstudiantesPorJornada(daneSede: string, jornada: number): Observable<Estudiantes[]> {
  
    const params = new HttpParams()
    .set('daneSede', daneSede)
    .set('jornadaEducativa', jornada); 
    
     return this.http.get<Estudiantes[]>(this.apiUrl3, { params }).pipe(
      tap(estudiantes => {
        this.estudiantesSubject.next(estudiantes); 
      }),
      catchError(this.handleError)
    );
  }

  public actualizarEstudianteEnMemoria(
    perID: string,
    cambios: Partial<Estudiantes>,
  ): void {
    const estudiantes = this.estudiantesSubject.value;

    if (!estudiantes) {
      return;
    }

    const estudiantesActualizados = estudiantes.map((estudiante) =>
      estudiante.perID === perID ? { ...estudiante, ...cambios } : estudiante,
    );

    this.estudiantesSubject.next(estudiantesActualizados);
  }
  

  private handleError(error: HttpErrorResponse) {
    console.error('Ocurrió un error en la consulta de estudiantes:');

       if (error.error && typeof error.error.mensaje === 'string') {
        return throwError(() => error.error); 
      }

     return throwError(() => ({ mensaje: `Error del servidor. Por favor contacta al soporte.` }));
   }

    clearEstudiantes() {
      console.log('Limpiando estudiantes en el servicio');
      this.estudiantesSubject.next(null);
    }
}

