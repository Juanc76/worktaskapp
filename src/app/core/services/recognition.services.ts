import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { FaceDetectionResponse } from '../models/recognition.model';
import { FacesCandidatesDto } from '../models/recognition.model';
import { environment } from '../../../environments/environment'
@Injectable({
  providedIn: 'root'
})


export class FaceDetectionService {
  private baseUrl = environment.apiUrls.endpoint1;
  private apiUrl = this.baseUrl+'/detectFaces';
  private apiUrl2 = this.baseUrl+'/recognitionFace';

  constructor(private http: HttpClient) {}

  detectFaces(imageFile: File): Observable<FaceDetectionResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.http.post<FaceDetectionResponse>(this.apiUrl, formData).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    console.error('Error detectando rostros:');
    if (error.error && typeof error.error.mensaje === 'string') {
        return throwError(() => error.error); 
    }
      return throwError(() => ({ mensaje: `Error del servidor. Contacta al soporte.` }));
  }

   recognitionFaces(imageFile: File): Observable<FacesCandidatesDto> {
    const formData = new FormData();
    formData.append('image', imageFile);

    return this.http.post<FacesCandidatesDto>(this.apiUrl2, formData).pipe(
      catchError(this.handleError)
    );
  }

 
}
