import { Injectable } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { environment } from '../../../environments/environment';

import { PhotoRecordPAE, PhotoPAESyncRow } from '../models/photoRecordPAE.model';
import { RecordsDelivery, RegistroEntregaSyncRow } from '../models/registroEntregaPAE.model';
import { PhotosPAERepository } from '../repositories/photosPAE.repository';
import { RegistroEntregaPAERepository } from '../repositories/RegistroEntregaPAE.repository';

import { SyncFilesSummary } from '../models/syncFiles.model';
import { SyncSqliteOptions, SyncSqliteSummary } from '../models/syncSqliteRecords.model';

import { DatabaseService } from './database.service';
import { SyncFilesService } from './syncFiles.service';
import { DeviceService } from './device.service';
import { PhotoStorageServicePAE } from './photoRecordPAE.service';

import { UploadFileService } from './uploadFile.Services';


//Orquesta 
export interface RegistroEntregaPaeSyncAllSummary {
  registrosEntrega: SyncSqliteSummary<RegistroEntregaSyncRow>;
  archivosFotos: SyncFilesSummary;
  registrosFotos: SyncSqliteSummary<PhotoPAESyncRow>;
}

export interface RegistroEntregaPaeSyncOptions {
  idEntrega: string;
  sqliteOptions?: SyncSqliteOptions;
  onFileProgress?: (processed: number, total: number) => void;
}

export interface RegistroEntregaPaeGlobalSyncOptions {
  idEntrega?: string;
  sqliteOptions?: SyncSqliteOptions;
  onFileProgress?: (processed: number, total: number) => void;
}

@Injectable({
  providedIn: 'root'
})
export class RegistroEntregaPaeSyncService {
  constructor(
    private repositoryEntrega: RegistroEntregaPAERepository,
    private repositoryPhotos: PhotosPAERepository,
    private syncFiles: SyncFilesService,
    private uploadFileService: UploadFileService,
    private photoStorageService: PhotoStorageServicePAE,
    private db: DatabaseService,
    private deviceService: DeviceService
  ) {}

  async syncRegistrosEntrega(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroEntregaSyncRow>> {
    return this.repositoryEntrega.syncRegistroEntregaPAE(options);
  }

  async syncRegistrosFotos(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPAESyncRow>> {
    return this.repositoryPhotos.syncRegistrosPhotosPAE(options);
  }

  async syncRegistrosFotosByEntrega(
    idEntrega: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPAESyncRow>> {
    return this.repositoryPhotos.syncRegistrosPhotosByDeliveryPAE(idEntrega, options);
  }

    /**
     * Ejecuta el proceso completo de sincronización de una entrega PAE.
     *
     * Sincroniza:
     * 1. Los registros de entrega almacenados en SQLite.
     * 2. Los archivos físicos de las fotografías.
     * 3. Los registros o metadatos de las fotografías.
     *
     * @param options Opciones de configuración del proceso de sincronización.
     * @returns Resumen general con los resultados de cada etapa.
     */
  async syncAll(
    options: RegistroEntregaPaeGlobalSyncOptions = {}
  ): Promise<RegistroEntregaPaeSyncAllSummary> {
    const registrosEntrega = await this.syncRegistrosEntrega(options.sqliteOptions);
    const archivosFotos = await this.syncArchivosFotos(options);
    const registrosFotos = await this.syncRegistrosFotos(options.sqliteOptions);

    return {
      registrosEntrega,
      archivosFotos,
      registrosFotos
    };
  }

  async syncAllByEntrega(
    options: RegistroEntregaPaeSyncOptions
  ): Promise<RegistroEntregaPaeSyncAllSummary> {
    const registrosEntrega = await this.repositoryEntrega.syncRegistroEntregaPAEById(
      options.idEntrega,
      options.sqliteOptions
    );

    if (registrosEntrega.rejected > 0) {
      throw new Error(`No fue posible sincronizar el registro de entrega ${options.idEntrega}.`);
    }

    const archivosFotos = await this.syncArchivosFotos(options);
    const registrosFotos = await this.syncRegistrosFotosByEntrega(
      options.idEntrega,
      options.sqliteOptions
    );

    return {
      registrosEntrega,
      archivosFotos,
      registrosFotos
    };
  }
 

  //Este metodo es el encargado de instanciar syncFiles.service, para sincrinizar con el blob storage 
  //los archivos de imagen (fotos ) tomadas en el marco del Programa de Alimentacion Escolar 
  // en los dispositivos
  async syncArchivosFotos(
    options: RegistroEntregaPaeGlobalSyncOptions = {}
  ): Promise<SyncFilesSummary> {
    const pendingPhotos = options.idEntrega
       ? await this.repositoryPhotos.getPendingPhotosByDeliveryPAE(options.idEntrega)
      : await this.repositoryPhotos.getPendingPhotosPAE();
 
    if (pendingPhotos.length === 0) {
      options.onFileProgress?.(0, 0);
      return {
        total: 0,
        succeeded: 0,
        failed: 0,
        results: []
      };
    }

    const devicePathSegment = await this.getDevicePathSegment();
    const entregasCache = new Map<string, RecordsDelivery | null>();
    const batchSize = options.sqliteOptions?.batchSize ?? environment.sync.batchSize;
    const maxRetries = options.sqliteOptions?.maxRetries ?? 2;
    const retryDelayMs = options.sqliteOptions?.retryDelayMs ?? 1500;

    const results = await this.syncFiles.syncFiles<PhotoRecordPAE>(
      pendingPhotos,
      async (photo: PhotoRecordPAE) => {
        const file = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data
        });
        return file.data;
      },
      async (photo: PhotoRecordPAE, fileData: string | Blob) => {
        const entrega = await this.getEntregaForPhoto(photo, entregasCache);

        if (!entrega) {
          throw new Error(`No se encontro la entrega local ${photo.idRegistroEntrega}.`);
        }

        const fileToUpload = this.base64ToFile(fileData, photo.fileName, 'image/jpeg');
        const idPath = this.buildUploadPath(entrega, devicePathSegment);

        return this.uploadFileService.subirArchivosenBloque(
          fileToUpload,
          idPath, "D",
          photo.idPhoto!
        );
      },
      async (photo: PhotoRecordPAE) => {
        await this.photoStorageService.deleteFileFromDevice(photo.filePath);
        await this.repositoryPhotos.markAsSyncedPAE(photo.idPhoto!);
      },
      async (photo: PhotoRecordPAE, err: unknown) => {
        await this.db.addLog(
          photo.idPhoto ?? '',
          photo.fileName,
          'ERROR',
          this.normalizeError(err),
          'PhotoRecordPAE'
        );
      },
      batchSize,
      options.onFileProgress,
      maxRetries,
      retryDelayMs
    );

    const succeeded = results.filter(result => result.status === 'fulfilled').length;

    return {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
      results
    };
  }

  //Almacena en cache los id registro entrega asociados a las fotos que se estan sincronizando  
  private async getEntregaForPhoto(
    photo: PhotoRecordPAE,
    cache: Map<string, RecordsDelivery | null>
  ): Promise<RecordsDelivery | null> {
    if (cache.has(photo.idRegistroEntrega)) {
      return cache.get(photo.idRegistroEntrega) ?? null;
    }

    const entrega = await this.repositoryEntrega.getRecordsDeliveryPAEById(photo.idRegistroEntrega);
    cache.set(photo.idRegistroEntrega, entrega);

    return entrega;
  }

  //Configura el Path del blob storage
  private buildUploadPath(entrega: RecordsDelivery, devicePathSegment: string): string {
    return `${entrega.Fecha}/${entrega.idSitioEntrega}/${devicePathSegment}`;
  }

  //obtinen el Deviceid, para separar el almacenamiento en base de datos y en
  // en blob storage, lo sregistros y archivo blob segun el dispositivo utilizado.
  private async getDevicePathSegment(): Promise<string> {
    try {
      const deviceData = await this.deviceService.getDeviceData();
      return this.sanitizePathSegment(deviceData.deviceId);
    } catch {
      return 'unknown-device';
    }
  }

  private sanitizePathSegment(value: string): string {
    const cleaned = (value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '');

    return cleaned || 'unknown-device';
  }

  //Convierte el archivo en base64
  private base64ToFile(data: string | Blob, filename: string, contentType = 'image/jpeg'): File {
    if (typeof data !== 'string') {
      return new File([data], filename, { type: contentType });
    }

    const byteChars = atob(data);
    const byteNumbers = new Array(byteChars.length);

    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });

    return new File([blob], filename, { type: contentType });
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Error desconocido durante la sincronizacion.';
  }
}
