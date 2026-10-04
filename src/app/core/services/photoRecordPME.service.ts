import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from './database.service'; 
import { PhotosPMERepository } from '../repositories/photosPME.repository';

import { Geolocation, Position } from '@capacitor/geolocation';
import { RecordsService } from '../models/registroServicioPME.model';

@Injectable({
  providedIn: 'root'
})

export class PhotoStorageServicePME {

   private capturePosition: Position | null = null;
   
   async init() {
    await this.ensurePhotosDir();
    }

    constructor(
      private db: DatabaseService, 
      private repository: PhotosPMERepository) {}

    // Asegura que la carpeta /photos exista
    async ensurePhotosDir() {
    try {
      await Filesystem.mkdir({
        path: 'photos',
        directory: Directory.Data,
        recursive: true
      });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log('Carpeta photos ya existía');
      } else {
        console.error(' Se presento error creando carpeta photos:', err);
      }
    }
  }

  async getPhotosDir(rutaEscolar: string, fechaServicio: string) {
        const sessionFolder = this.normalizeServiceDate(fechaServicio);
        const rutaFolder = this.sanitizeFileSegment(rutaEscolar);
        const sessionPath = `photos/${sessionFolder}/${rutaFolder}`;
      try {
       await Filesystem.mkdir({
        path: sessionPath,
        directory: Directory.Data,
        recursive: true
      });

      console.log('Session folder created:', sessionPath);
     } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log('Session folder already exists:', sessionPath);
      } else {
        console.error(' Se presento error creando carpeta session:', err);
      }
      }
      return sessionPath;
 }


  /** Guarda una foto (en base64), obtiene geolocalización y la almacena en la DB local */
  async savePhoto(base64Data: string, servicioActual: RecordsService | null) {
    try {
      // Obtener la posición justo antes de guardar
        const positionPromise = this.capturePosition
        ? Promise.resolve(this.capturePosition)
        : this.getPositionSafe();

    if (!servicioActual) {
      throw new Error('No se puede guardar la foto sin un servicio activo.');
    }

    const fechaServicio = this.normalizeServiceDate(servicioActual.Fecha);

    // Asegura que la carpeta de la sesión exista
    const sessionPath = await this.getPhotosDir(servicioActual.numeroRuta, fechaServicio);
    console.log('Carpeta de sesión asegurada:', sessionPath);

    const fileName = await this.buildUniquePhotoFileName(
      sessionPath,
      servicioActual.numeroRuta,
      fechaServicio
    );
 
    // Guardar archivo en la carpeta de la sesión
    await Filesystem.writeFile({
      path: `${sessionPath}/${fileName}`,
      data: base64Data,
      directory: Directory.Data
    });

    console.log('File almacenado:', `${sessionPath}/${fileName}`);

    // Guardar metadata en la persistencia local
    const url = await this.urlToFilesystem(`${sessionPath}/${fileName}`);
    const Fecha =  this.db.getCurrentDateTime();
    const position = await positionPromise;
    const lat = position?.coords?.latitude ?? undefined;
    const lng = position?.coords?.longitude ?? undefined;
    await this.repository.addPhotoPME({
      filePath: `${sessionPath}/${fileName}`,
      idRegistroServicio: servicioActual ? servicioActual.idRegistroServicio : '',
      fileName: fileName,
      url: url,
      date: Fecha,
      latitud: lat,
      longitud: lng,
      rutaEscolar: servicioActual ? servicioActual.numeroRuta : '',
      recorrido: servicioActual ? servicioActual.recorrido : '',      
      syncedPhoto: 0,
      deletedPhoto: 0,
      syncedDB: 0,
      deleteRegistro: 0
    });

    console.log('Metadata Foto guardada:', fileName, 'en sesión:', sessionPath);
  } catch (err) {
    console.error('Error al guardar la foto:', err);
  }
  }

  private async buildUniquePhotoFileName(
    sessionPath: string,
    rutaEscolar: string,
    fechaServicio: string
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const fileName = this.generatePhotoFileName(rutaEscolar, fechaServicio);
      const exists = await this.fileExists(`${sessionPath}/${fileName}`);

      if (!exists) {
        return fileName;
      }
    }

    throw new Error('No fue posible generar un nombre unico para la foto.');
  }

  private generatePhotoFileName(rutaEscolar: string, fechaServicio: string): string {
    const captureTime = this.db.getCurrentDateTime().slice(11).replace(/:/g, '');
    const timestamp = `${fechaServicio.replace(/-/g, '')}_${captureTime}`;
    const ruta = this.sanitizeFileSegment(rutaEscolar || 'sin-ruta');
    const uuid = this.createUuid();
    return `pme_${ruta}_${timestamp}_${uuid}.jpg`;
  }

  private normalizeServiceDate(fechaServicio: string): string {
    const normalizedDate = fechaServicio?.trim().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new Error(`Fecha de servicio invalida: ${fechaServicio}`);
    }

    return normalizedDate;
  }

  private createUuid(): string {
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.randomUUID) {
      return cryptoApi.randomUUID();
    }

    if (cryptoApi?.getRandomValues) {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
      return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
  }

  private sanitizeFileSegment(value: string): string {
    return (value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'sin-ruta';
  }

  private async fileExists(filePath: string): Promise<boolean> {
    const file = await Filesystem.stat({
      path: filePath,
      directory: Directory.Data
    }).catch(() => null);

    return !!file;
  }
  
  private async getPositionSafe(): Promise<Position | null> {
    try {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000
      });
    } catch (err) {
      console.warn('No se pudo obtener geolocalizacion a tiempo:', err);
      return null;
    }
  }

  async setCapturePosition() {
    this.capturePosition = await this.getPositionSafe();
  }

  clearCapturePosition() {
    this.capturePosition = null;
  }

  /** Borra archivo físico pero mantiene metadata */
  async deleteFileFromDevice(filePath: string) {
    try {
      // Verificar si el archivo existe antes de intentar eliminarlo
      const fileExists = await Filesystem.stat({
        path: filePath,
        directory: Directory.Data
      }).catch(() => null);

      if (!fileExists) {
        console.warn('El archivo no existe o ya fue eliminado:', filePath);
        return;
      }

      // Eliminar el archivo
      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Data
      });
      console.log('Archivo borrado exitosamente:', filePath);
    } catch (err) {
      console.error('Error al intentar borrar el archivo:', filePath, err);
    }
  }


  // Convierte filePath a URL utilizable en el navegador
  async  urlToFilesystem(filePath: string) { 
       try {
        const info = await Filesystem.stat({
          path: filePath,
          directory: Directory.Data
        });
        return Capacitor.convertFileSrc(info.uri);
      } catch {
        return ''; // si ya no existe el archivo
      }
      
    }


}
