import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SyncSqliteBackendResponse,
  SyncSqliteBackendResult,
  SyncSqliteConfirmedRecord,
  SyncSqliteLocalId,
  SyncSqliteRecordsConfig,
  SyncSqliteRecordDetail,
  SyncSqliteSummary
} from '../models/syncSqliteRecords.model';
import { DeviceService } from './device.service';

@Injectable({
  providedIn: 'root'
})
export class SyncSqliteRecordsService {
  constructor(
    private http: HttpClient,
    private deviceService: DeviceService
  ) {}

  //SynRecords toma 

  async syncRecords<T, TPayload>(
    config: SyncSqliteRecordsConfig<T, TPayload>
  ): Promise<SyncSqliteSummary<T>> {
    const details: SyncSqliteRecordDetail<T>[] = [];
    const options = config.options ?? {};
    const batchSize = options.batchSize ?? environment.sync.batchSize;
    const maxRetries = options.maxRetries ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 1500;
    const deviceData = await this.deviceService.getDeviceData();
    const context = {
      deviceId: deviceData.deviceId,
    };

    for (let i = 0; i < config.items.length; i += batchSize) {
      const batch = config.items.slice(i, i + batchSize);
      const records = batch.map(item => config.buildPayload(item, context));

      try {
        const response = await this.postBatchWithRetry(
          config.endpointUrl,
          records,
          maxRetries,
          retryDelayMs
        );
        const resultsByLocalId = new Map<SyncSqliteLocalId, SyncSqliteBackendResult>(
          response.results.map(result => [result.localId, result])
        );
        const batchDetails: SyncSqliteRecordDetail<T>[] = [];
        const confirmedRecords: SyncSqliteConfirmedRecord<T>[] = [];

        for (const item of batch) {
          const localId = config.getLocalId(item);
          const result = resultsByLocalId.get(localId) ?? this.buildMissingResult(localId);

          if (result.synced) {
            confirmedRecords.push({ item, localId, result });
          }

          batchDetails.push({ item, localId, synced: result.synced, result });
        }

        if (confirmedRecords.length > 0) {
          if (config.markBatchAsSynced) {
            await config.markBatchAsSynced(confirmedRecords, response.fechaSincronizacion);
          } else {
            for (const confirmedRecord of confirmedRecords) {
              await config.markAsSynced(
                confirmedRecord.item,
                confirmedRecord.result,
                response.fechaSincronizacion
              );
            }
          }
        }

        for (const detail of batchDetails) {
          details.push(detail);
          options.onProgress?.(details.length, config.items.length);
        }
      } catch (error) {
        const errorMessage = this.normalizeError(error);

        for (const item of batch) {
          details.push({
            item,
            localId: config.getLocalId(item),
            synced: false,
            error: errorMessage
          });
          options.onProgress?.(details.length, config.items.length);
        }
      }
    }

    const confirmed = details.filter(detail => detail.synced).length;

    return {
      total: details.length,
      confirmed,
      rejected: details.length - confirmed,
      details
    };
  }

  private async postBatchWithRetry<TPayload>(
    endpointUrl: string,
    records: TPayload[],
    maxRetries: number,
    retryDelayMs: number
  ): Promise<SyncSqliteBackendResponse> {
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
             
        const response = await firstValueFrom(
          this.http.post<SyncSqliteBackendResponse>(endpointUrl, records)
        );

        if (!response || !Array.isArray(response.results)) {
          throw new Error('Respuesta de sincronizacion invalida.');
        }

        return response;
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          throw error;
        }

        await this.delay(retryDelayMs * attempt);
      }
    }

    throw new Error('No fue posible sincronizar el lote.');
  }

  private buildMissingResult(localId: SyncSqliteLocalId): SyncSqliteBackendResult {
    return {
      localId,
      status: 'NO_RESPONSE',
      synced: false,
      message: 'El backend no devolvio resultado para el registro local.'
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
