import { Injectable } from '@angular/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { environment } from '../../../environments/environment';

import { PhotoPMESyncRow, PhotoRecordPME } from '../models/photoRecordPME.model';
import { RecordsService, RegistroServicioSyncRow } from '../models/registroServicioPME.model';
import { SyncFilesSummary } from '../models/syncFiles.model';
import { SyncSqliteOptions, SyncSqliteSummary } from '../models/syncSqliteRecords.model';
import { PhotosPMERepository } from '../repositories/photosPME.repository';
import { RegistroServicioPMERepository } from '../repositories/RegistroServicioPME.repository';
import { DatabaseService } from './database.service';
import { DeviceService } from './device.service';
import { PhotoStorageServicePME } from './photoRecordPME.service';
import { SyncFilesService } from './syncFiles.service';
import { UploadFileService } from './uploadFile.Services';

export interface RegistroServicioPmeSyncAllSummary {
  registrosServicio: SyncSqliteSummary<RegistroServicioSyncRow>;
  archivosFotos: SyncFilesSummary;
  registrosFotos: SyncSqliteSummary<PhotoPMESyncRow>;
}

export interface RegistroServicioPmeSyncOptions {
  idServicio: string;
  sqliteOptions?: SyncSqliteOptions;
  onFileProgress?: (processed: number, total: number) => void;
}

export interface RegistroServicioPmeGlobalSyncOptions {
  idServicio?: string;
  sqliteOptions?: SyncSqliteOptions;
  onFileProgress?: (processed: number, total: number) => void;
}

@Injectable({
  providedIn: 'root'
})
export class RegistroServicioPmeSyncService {
  constructor(
    private repositoryServicio: RegistroServicioPMERepository,
    private repositoryPhotos: PhotosPMERepository,
    private syncFiles: SyncFilesService,
    private uploadFileService: UploadFileService,
    private photoStorageService: PhotoStorageServicePME,
    private db: DatabaseService,
    private deviceService: DeviceService
  ) {}

  async syncRegistrosServicio(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroServicioSyncRow>> {
    return this.repositoryServicio.syncRegistroServicioPME(options);
  }

  async syncRegistrosFotos(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPMESyncRow>> {
    return this.repositoryPhotos.syncRegistrosPhotosPME(options);
  }

  async syncRegistrosFotosByServicio(
    idServicio: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPMESyncRow>> {
    return this.repositoryPhotos.syncRegistrosPhotosByServicioPME(idServicio, options);
  }

  async syncAll(
    options: RegistroServicioPmeGlobalSyncOptions = {}
  ): Promise<RegistroServicioPmeSyncAllSummary> {
    const registrosServicio = await this.syncRegistrosServicio(options.sqliteOptions);
    const archivosFotos = await this.syncArchivosFotos(options);
    const registrosFotos = await this.syncRegistrosFotos(options.sqliteOptions);

    return { registrosServicio, archivosFotos, registrosFotos };
  }

  async syncAllByServicio(
    options: RegistroServicioPmeSyncOptions
  ): Promise<RegistroServicioPmeSyncAllSummary> {
    const registrosServicio = await this.repositoryServicio.syncRegistroServicioPMEById(
      options.idServicio,
      options.sqliteOptions
    );

    if (registrosServicio.rejected > 0) {
      throw new Error(`No fue posible sincronizar el registro de servicio ${options.idServicio}.`);
    }

    const archivosFotos = await this.syncArchivosFotos(options);
    const registrosFotos = await this.syncRegistrosFotosByServicio(
      options.idServicio,
      options.sqliteOptions
    );

    return { registrosServicio, archivosFotos, registrosFotos };
  }

  async syncArchivosFotos(
    options: RegistroServicioPmeGlobalSyncOptions = {}
  ): Promise<SyncFilesSummary> {
    const pendingPhotos = options.idServicio
      ? await this.repositoryPhotos.getPendingPhotosByServicioPME(options.idServicio)
      : await this.repositoryPhotos.getPendingPhotosPME();

    if (pendingPhotos.length === 0) {
      options.onFileProgress?.(0, 0);
      return { total: 0, succeeded: 0, failed: 0, results: [] };
    }

    const devicePathSegment = await this.getDevicePathSegment();
    const serviciosCache = new Map<string, RecordsService | null>();
    const batchSize = options.sqliteOptions?.batchSize ?? environment.sync.batchSize;
    const maxRetries = options.sqliteOptions?.maxRetries ?? 2;
    const retryDelayMs = options.sqliteOptions?.retryDelayMs ?? 1500;

    const results = await this.syncFiles.syncFiles<PhotoRecordPME>(
      pendingPhotos,
      async photo => {
        const file = await Filesystem.readFile({
          path: photo.filePath,
          directory: Directory.Data
        });
        return file.data;
      },
      async (photo, fileData) => {
        const servicio = await this.getServicioForPhoto(photo, serviciosCache);
        if (!servicio) {
          throw new Error(`No se encontro el servicio local ${photo.idRegistroServicio}.`);
        }

        const fileToUpload = this.base64ToFile(fileData, photo.fileName, 'image/jpeg');
        const idPath = this.buildUploadPath(servicio, devicePathSegment);
        return this.uploadFileService.subirArchivosenBloque(
          fileToUpload,
          idPath,
          'E',
          photo.idPhoto!
        );
      },
      async photo => {
        await this.photoStorageService.deleteFileFromDevice(photo.filePath);
        await this.repositoryPhotos.markAsSyncedPME(photo.idPhoto!);
      },
      async (photo, error) => {
        await this.db.addLog(
          photo.idPhoto ?? '',
          photo.fileName,
          'ERROR',
          this.normalizeError(error),
          'PhotoRecordPME'
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

  private async getServicioForPhoto(
    photo: PhotoRecordPME,
    cache: Map<string, RecordsService | null>
  ): Promise<RecordsService | null> {
    if (cache.has(photo.idRegistroServicio)) {
      return cache.get(photo.idRegistroServicio) ?? null;
    }

    const servicio = await this.repositoryServicio.getRecordsServicioPMEById(photo.idRegistroServicio);
    cache.set(photo.idRegistroServicio, servicio);
    return servicio;
  }

  private buildUploadPath(servicio: RecordsService, devicePathSegment: string): string {
    return `${servicio.Fecha}/${servicio.numeroRuta}/${devicePathSegment}`;
  }

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

  private base64ToFile(data: string | Blob, filename: string, contentType: string): File {
    if (typeof data !== 'string') {
      return new File([data], filename, { type: contentType });
    }

    const byteChars = atob(data);
    const byteNumbers = new Array(byteChars.length);
    for (let index = 0; index < byteChars.length; index++) {
      byteNumbers[index] = byteChars.charCodeAt(index);
    }

    return new File([new Uint8Array(byteNumbers)], filename, { type: contentType });
  }

  private normalizeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Error desconocido durante la sincronizacion PME.';
  }
}
