import { Injectable } from '@angular/core';

import { RegistroLocationRutaPMERepository } from '../repositories/registroLocationRutaPME.repository';
import { RegistroTrazadoRutaPMERepository } from '../repositories/registroTrazadoRutaPME.repository';
import { RegistroLocationRutaPME, RegistroTrazadoRutaPMEBD } from '../models/tracking.model';
import { SyncSqliteOptions, SyncSqliteSummary } from '../models/syncSqliteRecords.model';

export interface SyncTrackingSummary {
  locations: SyncSqliteSummary<RegistroLocationRutaPME>;
  trazado: SyncSqliteSummary<RegistroTrazadoRutaPMEBD>;
}

@Injectable({
  providedIn: 'root'
})
export class SyncTrackingService {
  constructor(
    private registroTrazadoRutaPMERepository: RegistroTrazadoRutaPMERepository,
    private registroLocationRutaPMERepository: RegistroLocationRutaPMERepository
  ) {}

  async syncAll(
    idTrazado?: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncTrackingSummary> {
    const locations = await this.syncPendingLocations(idTrazado, options);
    const trazado = await this.syncPendingTrazadosFinalizados(idTrazado, options);

    return {
      locations,
      trazado
    };
  }

  private async syncPendingLocations(
    idTrazado?: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroLocationRutaPME>> {
    return this.syncInBatches<RegistroLocationRutaPME>(() =>
      idTrazado
        ? this.registroLocationRutaPMERepository.syncRegistroLocationRutaPMEByTrazado(
            idTrazado,
            { ...options, maxRecords: options.maxRecords ?? 500 }
          )
        : this.registroLocationRutaPMERepository.syncRegistroLocationRutaPME({
            ...options,
            maxRecords: options.maxRecords ?? 500
          })
    );
  }

  private async syncPendingTrazadosFinalizados(
    idTrazado?: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    return this.syncInBatches<RegistroTrazadoRutaPMEBD>(() =>
      idTrazado
        ? this.registroTrazadoRutaPMERepository.syncRegistroTrazadoRutaPMEFinalizadoById(
            idTrazado,
            options
          )
        : this.registroTrazadoRutaPMERepository.syncRegistroTrazadoRutaPMEFinalizado({
            ...options,
            maxRecords: options.maxRecords ?? 500
          })
    );
  }

  private async syncInBatches<T>(
    syncBatch: () => Promise<SyncSqliteSummary<T>>
  ): Promise<SyncSqliteSummary<T>> {
    const totalSummary: SyncSqliteSummary<T> = {
      total: 0,
      confirmed: 0,
      rejected: 0,
      details: []
    };

    while (true) {
      const summary = await syncBatch();

      totalSummary.total += summary.total;
      totalSummary.confirmed += summary.confirmed;
      totalSummary.rejected += summary.rejected;
      totalSummary.details.push(...summary.details);

      if (summary.total === 0 || summary.confirmed === 0) {
        break;
      }
    }

    return totalSummary;
  }
}
