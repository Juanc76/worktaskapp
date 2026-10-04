
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable,catchError, throwError } from 'rxjs'; // Para manejar los observables
import { RegistroMatriculaDTO,
  addFaceEstudianteDTO,
  DeleteFacePersonDto,
  DeletePersonDto,
  DeletePersonResponseDto,
  FacesEstudianteDTO,
  IdPersonFacesDto,
  SasResponse, PersonsDirectoryDto} from '../models/enrolarEstudiante.model'; // Importa la interfaz Estudiante
import { environment } from '../../../environments/environment'

@Injectable({
  providedIn: 'root' 
})
export class EnrolarEstudianteService {
  private readonly baseUrl1 = environment.apiUrls.endpoint1
  private readonly baseUrl2 = `${environment.apiUrls.endpoint2}/faceRecognition`;
  private readonly apiUrl1 = this.baseUrl1+'/addPerson'; 
  private readonly apiUrl3 = this.baseUrl1+'/addFacePerson'
  private readonly apiUrl6 = this.baseUrl1+'/deletePerson';
  private readonly apiUrl4 = this.baseUrl2+'/getFacesEstudiante';
  private readonly apiUrl5 = this.baseUrl2+'/getTokenSAS'; 
  private readonly apiUrl7 = this.baseUrl1+'/deleteFacePerson';
  private readonly apiUrl8 = this.baseUrl1+'/getFacesPerson';
  private readonly apiUrl9 = this.baseUrl1+'/getPersons'; 

  constructor(private http: HttpClient) { }

  /**
   * Envía una nueva persona al backend.
   * @param persona Los datos de la persona a guardar.
   * @returns Un Observable con la respuesta del backend (la persona guardada).
   */
  guardarEstudiante(matricula: RegistroMatriculaDTO): Observable<RegistroMatriculaDTO> {
      return this.http.post<RegistroMatriculaDTO>(this.apiUrl1, matricula).pipe(
      catchError(this.handleError)
    );
  }

  guardarFaceEstudiante(imageFile: File, addFaceEstudiante: addFaceEstudianteDTO): Observable<FacesEstudianteDTO[]> {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const estudianteBlob = new Blob([JSON.stringify(addFaceEstudiante)], {
        type: 'application/json'
        });

        formData.append('estudiante', estudianteBlob);
      
    return this.http.post<FacesEstudianteDTO[]>(this.apiUrl3,formData).pipe(
      catchError(this.handleError)
    );
  
  }

    getFacesEstudiante(idPersonDirectory: string): Observable<FacesEstudianteDTO[]> {
         const params = new HttpParams().set('idPerson', idPersonDirectory)
         return this.http.get<FacesEstudianteDTO[]>(this.apiUrl4,{params}).pipe(
        catchError(this.handleError)
    );
  
  }


     getFileToBlob(idPersonDirectory: string): Observable<SasResponse> {
         const params = new HttpParams().set('idPath', idPersonDirectory)
         return this.http.get<SasResponse>(this.apiUrl5,{params}).pipe(
      catchError(this.handleError)
    );
  
  }

  deletePerson(estudiante: DeletePersonDto): Observable<DeletePersonResponseDto> {
    return this.http.delete<DeletePersonResponseDto>(this.apiUrl6, {
      body: estudiante
    }).pipe(
      catchError(this.handleError)
    );
  }

  deleteFacePerson(faceEstudiante: DeleteFacePersonDto): Observable<string> {
    return this.http.delete(this.apiUrl7, {
      body: faceEstudiante,
      responseType: 'text'
    }).pipe(
      catchError(this.handleError)
    );
  }

  getFacesPerson(idPersonDirectory: string): Observable<IdPersonFacesDto> {
    const params = new HttpParams().set('idPerson', idPersonDirectory)
    return this.http.get<IdPersonFacesDto>(this.apiUrl8, {params}).pipe(
      catchError(this.handleError)
    );
  }

   getPersons(idPersonDirectory: string): Observable<PersonsDirectoryDto> {
    const params = new HttpParams().set('idPersonDirectory', idPersonDirectory);
    return this.http.get<PersonsDirectoryDto>(this.apiUrl9, { params });
  }
  
private handleError(error: HttpErrorResponse) {
   if (error.error && typeof error.error.mensaje === 'string') {
        return throwError(() => error.error); 
    }
     return throwError(() => ({ mensaje: `Error del servidor: ${error.error?.status || 'No reporta estado' } Por favor, contacta al soporte.` }));
   }

}
