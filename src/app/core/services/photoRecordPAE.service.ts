import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

import { DatabaseService } from './database.service'; 
import { PhotosPAERepository } from '../repositories/photosPAE.repository'; 

import { Geolocation, Position } from '@capacitor/geolocation';
import { RecordsDelivery } from '../models/registroEntregaPAE.model';

@Injectable({
  providedIn: 'root'
})

export class PhotoStorageServicePAE {

  private capturePosition: Position | null = null;

    async init() {
    await this.ensurePhotosDir();
    }

    constructor(
      private db: DatabaseService, 
      private repository: PhotosPAERepository) {}

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
        console.error(' Se presento error creando carpeta photos:');
      }
    }
  }

  async getPhotosDir(idSitioEntrega: number, fechaEntrega: string) {
        const sessionFolder = this.normalizeDeliveryDate(fechaEntrega);
        const sessionPath = `photos/${sessionFolder}/${idSitioEntrega}`;
      try {
       await Filesystem.mkdir({
        path: sessionPath,
        directory: Directory.Data,
        recursive: true
      });

      console.log('Session folder created:');
     } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log('Session folder already exists:');
      } else {
        console.error(' Se presento error creando carpeta session:');
      }
      }
      return sessionPath;
 }

  /** Guarda una foto (en base64), usa una sola geolocalizacion y la almacena en la DB local */
  async savePhoto(base64Data: string, entregaActual: RecordsDelivery | null, embeddingActual?: number[]) {
    try {
      // Usar posicion capturada al abrir la camara o solicitar una nueva si no existe
      const positionPromise = this.capturePosition
        ? Promise.resolve(this.capturePosition)
        : this.getPositionSafe();

    // Asegura que la carpeta de la sesión exista
    if (!entregaActual) {
      throw new Error('No se puede guardar la foto sin una entrega activa.');
    }

    const idSitioEntrega = Number(entregaActual.idSitioEntrega);
    const fechaEntrega = this.normalizeDeliveryDate(entregaActual.Fecha);
    const sessionPath = await this.getPhotosDir(idSitioEntrega, fechaEntrega);
    console.log('Carpeta de sesión asegurada:');

    const fileName = await this.buildUniquePhotoFileName(
      sessionPath,
      idSitioEntrega,
      fechaEntrega
    );
 
    // Guardar archivo en la carpeta de la sesión
    await Filesystem.writeFile({
      path: `${sessionPath}/${fileName}`,
      data: base64Data,
      directory: Directory.Data
    });

    console.log('File almacenado:');

    // Guardar metadata en la persistencia local
    const url = await this.urlToFilesystem(`${sessionPath}/${fileName}`);
    const Fecha =  this.db.getCurrentDateTime(); 
    const position = await positionPromise;
    const lat = position?.coords?.latitude ?? undefined;
    const lng = position?.coords?.longitude ?? undefined;
    await this.repository.addPhotoPAE({
      filePath: `${sessionPath}/${fileName}`,
      idRegistroEntrega: entregaActual ? entregaActual.idRegistroEntrega : '',
      fileName: fileName,
      url: url,
      date: Fecha,
      latitud: lat,
      longitud: lng,
      daneColegio: entregaActual ? entregaActual.daneColegio : '',
      daneSede: entregaActual ? entregaActual.daneSede : '',
      IdSitioEntrega: entregaActual ? entregaActual.idSitioEntrega : 0,
      syncedPhoto: 0,
      deletedPhoto: 0,
      syncedDB: 0,  deleteRegistro:0,
      faceVector: embeddingActual ? JSON.stringify(embeddingActual) : undefined
    });

    console.log('Metadata Foto guardada:');
  } catch (err) {
    console.error('Error al guardar la foto:');
  }
  }

  private async buildUniquePhotoFileName(
    sessionPath: string,
    idSitioEntrega: number,
    fechaEntrega: string
  ): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const fileName = this.generatePhotoFileName(idSitioEntrega, fechaEntrega);
      const exists = await this.fileExists(`${sessionPath}/${fileName}`);

      if (!exists) {
        return fileName;
      }
    }

    throw new Error('No fue posible generar un nombre unico para la foto.');
  }

  private generatePhotoFileName(idSitioEntrega: number, fechaEntrega: string): string {
    const captureTime = this.db.getCurrentDateTime().slice(11).replace(/:/g, '');
    const timestamp = `${fechaEntrega.replace(/-/g, '')}_${captureTime}`;
    const uuid = this.createUuid();
    return `pae_${idSitioEntrega}_${timestamp}_${uuid}.jpg`;
  }

  private normalizeDeliveryDate(fechaEntrega: string): string {
    const normalizedDate = fechaEntrega?.trim().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      throw new Error(`Fecha de entrega invalida:`);
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

    throw new Error('No hay un generador criptografico disponible para crear el identificador de la foto.');
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
      console.warn('No se pudo obtener geolocalizacion a tiempo:');
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
        console.warn('El archivo no existe o ya fue eliminado:');
        return;
      }

      // Eliminar el archivo
      await Filesystem.deleteFile({
        path: filePath,
        directory: Directory.Data
      });
      console.log('Archivo borrado exitosamente:');
    } catch (err) {
      console.error('Error al intentar borrar el archivo:');
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
