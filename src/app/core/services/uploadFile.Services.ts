import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs'; 
import { environment } from '../../../environments/environment'
import { UploadFileBlobResponse } from '../models/uploadFile.model';
import { lastValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root' 
})
export class UploadFileService {

  private baseUrl = environment.apiUrls.endpoint1;
  private apiUrl = this.baseUrl+'/storeInBlobFile'; // 

    constructor(
    private http: HttpClient) 
    {}

       async subirArchivosenBloque(archivo: File, idPath: string, idCont: string, idFileApp: string | number): Promise<boolean> {
        const formData = new FormData();
        formData.append('file', archivo);
        formData.append('idPath', idPath);
        formData.append('idCont', idCont);
        formData.append('idFileApp', idFileApp.toString());
        
        try {
            const response = await lastValueFrom(
                this.http.post<UploadFileBlobResponse>(this.apiUrl, formData, {
                    headers: {
                        'Accept': 'application/json'
                    }
                })
            );
            if (response) {
                console.log('El archivo se cargó adecuadamente:');
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('Error en subida:');
            return false;
        }
    }

    private handleError(error: HttpErrorResponse) {
      if (error.error && typeof error.error.mensaje === 'string') {
        return throwError(() => error.error); 
    }
        return throwError(() => ({ mensaje: `Error del servidor. Contacta al soporte.` }));
    }

}
