import {SafeUrl } from '@angular/platform-browser';

export interface UploadFileBlobResponse {
    message: string;
    urlFile: string;
    nameFile : String
}

export interface ManagedFile extends File {
  status: 'pendiente' | 'cargando' | 'cargado' | 'error';
  previewUrl?: SafeUrl;

}

