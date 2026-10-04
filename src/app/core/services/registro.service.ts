import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { RegistroFormDTO, RegistroResponseDTO, RegistroErrorResponseDTO } from '../models/registro.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RegistroService {

  private readonly baseUrl = environment.authUrl.endpoint3;

  constructor(private http: HttpClient) {}

  register(payload: RegistroFormDTO): Observable<RegistroResponseDTO> {
    return this.http.post<RegistroResponseDTO>(`${this.baseUrl}/register`, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const backendError = error.error as RegistroErrorResponseDTO;
        return throwError(() => backendError ?? { status: 'ERROR', message: 'Error inesperado del servidor.' });
      })
    );
  }
}