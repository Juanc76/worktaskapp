import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { environment } from '../../../environments/environment';
import {
  RegistroLocationRutaPME,
  LocationRutaPME,
  RegistroLocationRutaPMEPayload
} from '../models/tracking.model';
import { DatabaseService } from '../services/database.service';
import { SyncSqliteRecordsService } from '../services/syncSqliteRecords.service';
import { AuthService } from '../auth/auth.service';
import {
  SyncSqliteOptions,
  SyncSqliteSummary
} from '../models/syncSqliteRecords.model';

@Injectable({
  providedIn: 'root',
})
export class RegistroLocationRutaPMERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncRegistroLocationRutaPME`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // Método para agregar ubicaciones a RegistroLocationRutaPME
  async addRegistroLocationRutaPME(location: RegistroLocationRutaPME) {
    const sql = `
      INSERT INTO APPD_RegistroLocationRutaPME (
        idRegistro, idTrazado, fechaGps, latitud, longitud, altitud, velocidad, accuracy, fechaRegistro, syncedDB, syncDBDate, idUser
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const idUser = location.idUser ?? await this.authService.getCurrentUserId();
    const idRegistro = location.idRegistro ?? `${Date.now()}-${crypto.randomUUID()}`;

    const values = [
      idRegistro,
      location.idTrazado,
      location.fechaGps,
      location.latitud,
      location.longitud,
      location.altitud ?? null,
      location.velocidad,
      location.accuracy,
      location.fechaRegistro,
      location.syncedDB ?? 0,
      location.syncDBDate ?? null,
      idUser
    ];

    try {
      await this.db.run(sql, values);
      console.log('Registro agregado a la tabla APPD_RegistroLocationRutaPME.');
    } catch (error) {
      console.error('Error al agregar el registro a APPD_RegistroLocationRutaPME:', error);
      throw error;
    }
  }

  // Método para agregar múltiples ubicaciones en una sola transacción (Bulk Insert)
  async addBatchRegistroLocationRutaPME(locations: RegistroLocationRutaPME[]) {
    if (!locations || locations.length === 0) return;

    const query = `INSERT INTO APPD_RegistroLocationRutaPME (
        idRegistro, idTrazado, fechaGps, latitud, longitud, altitud, velocidad, accuracy, fechaRegistro, syncedDB, syncDBDate, idUser
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const currentUserId = await this.authService.getCurrentUserId();

    // Preparamos el set de instrucciones para executeSet
    const set = locations.map(location => {
        return {
          statement: query,
          values: [
            location.idRegistro ?? `${Date.now()}-${crypto.randomUUID()}`,
            location.idTrazado,
            location.fechaGps,
            location.latitud,
            location.longitud,
            location.altitud ?? null,
            location.velocidad,
            location.accuracy,
            location.fechaRegistro,
            location.syncedDB ?? 0,
            location.syncDBDate ?? null,
            location.idUser ?? currentUserId
          ]
        };
    });

    try {
 
    const inicio = performance.now();
    await this.db.executeSet(set);
    const fin = performance.now();
    console.log(`⏱️ Batch de ${locations.length} puntos guardado en ${(fin - inicio).toFixed(2)}ms`);
 
    } catch (error: any) {
      console.error('Error en batch insert (executeSet):', error);
      
      // FALLBACK: Si falla la inserción masiva (por transacción bloqueada o lo que sea),
      // insertamos uno por uno. Es más lento pero garantiza que no perdemos datos.
      console.warn('Ejecutando fallback de inserción individual...');
      for (const location of locations) {
        try {
           await this.addRegistroLocationRutaPME(location);
        } catch(e) {
           console.error("Error insertando punto individual en fallback:", e);
        }
      }
    }
  }

  async getLocationsByTrazado(idTrazado: string): Promise<LocationRutaPME[]> {
    const sql = `
    SELECT idTrazado, fechaGps, latitud, longitud, altitud
    FROM APPD_RegistroLocationRutaPME
    WHERE idTrazado = ? ORDER BY fechaGps ASC, idRegistro ASC`;
    try {
      const result = await this.db.query(sql, [idTrazado]);
      const rows = result.values || [];
      return rows;
    } catch (error) {
      console.error('Error al obtener el registro de RegistroLocationRutaPME por idTrazado:', error);
      return [];
    }
  }

  // Obtiene puntos (ubicaciones) NO procesados por UI (procesado_ui = 0) para un trazado
  async getUnprocessedRegistroLocationRutaPMEByTrazado(idTrazado: string): Promise<RegistroLocationRutaPME[]> {
    const sql = `
    SELECT idRegistro, idTrazado, fechaGps, latitud, longitud, altitud, velocidad, accuracy, procesado_ui, fechaRegistro, syncedDB, syncDBDate
    FROM APPD_RegistroLocationRutaPME
    WHERE idTrazado = ? AND procesado_ui = 0
    ORDER BY fechaGps ASC, idRegistro ASC`;

    try {
      const result = await this.db.query(sql, [idTrazado]);
      return (result.values || []) as RegistroLocationRutaPME[];
    } catch (error) {
      console.error('Error al obtener ubicaciones no procesadas (procesado_ui=0) por idTrazado:', error);
      return [];
    }
  }


    async syncRegistroLocationRutaPME(options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroLocationRutaPME>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingRegistroLocationRutaPME(maxRecords);

    return this.syncPendingRegistroLocationRutaPME(pending, options);
  }

  // Marca registros leídos con el estado indicado en procesado_ui (1 = procesado, 3 = descartado por distancia, etc.)
  async getPendingRegistroLocationRutaPME(limit: number): Promise<RegistroLocationRutaPME[]> {
    const sql = `
    SELECT
      idRegistro,
      idTrazado,
      fechaGps,
      latitud,
      longitud,
      altitud,
      velocidad,
      accuracy,
      procesado_ui,
      fechaRegistro,
      idUser
    FROM APPD_RegistroLocationRutaPME
    WHERE COALESCE(syncedDB, 0) = 0
    ORDER BY fechaGps ASC, idRegistro ASC
    LIMIT ?`;

    try {
      const result = await this.db.query(sql, [limit]);
      return (result.values || []) as RegistroLocationRutaPME[];
    } catch (error) {
      console.error('Error obteniendo ubicaciones pendientes:', error);
      return [];
    }
  }


    async syncRegistroLocationRutaPMEByTrazado(idTrazado: string, options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroLocationRutaPME>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingRegistroLocationRutaPMEByTrazado(idTrazado, maxRecords);

    return this.syncPendingRegistroLocationRutaPME(pending, options);
  }

  async getPendingRegistroLocationRutaPMEByTrazado(idTrazado: string, limit: number): Promise<RegistroLocationRutaPME[]> {
    const sql = `
    SELECT
      idRegistro,
      idTrazado,
      fechaGps,
      latitud,
      longitud,
      altitud,
      velocidad,
      accuracy,
      procesado_ui,
      fechaRegistro,
      idUser
    FROM APPD_RegistroLocationRutaPME
    WHERE idTrazado = ?
      AND COALESCE(syncedDB, 0) = 0
    ORDER BY fechaGps ASC, idRegistro ASC
    LIMIT ?`;

    try {
      const result = await this.db.query(sql, [idTrazado, limit]);
      return (result.values || []) as RegistroLocationRutaPME[];
    } catch (error) {
      console.error('Error obteniendo ubicaciones pendientes por trazado:', error);
      return [];
    }
  }

  private async syncPendingRegistroLocationRutaPME(
    pending: RegistroLocationRutaPME[],
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroLocationRutaPME>> {
    return this.syncSqliteRecordsService.syncRecords<RegistroLocationRutaPME, RegistroLocationRutaPMEPayload>({
      items: pending,
      endpointUrl: options.endpointUrl ?? this.syncEndpoint,
      getLocalId: item => item.idRegistro!,
      buildPayload: (item, context) => ({
        localId: item.idRegistro!,
        idTrazadoLocal: item.idTrazado,
        fechaGps: item.fechaGps,
        latitud: item.latitud,
        longitud: item.longitud,
        altitud: item.altitud ?? null,
        velocidad: item.velocidad,
        accuracy: item.accuracy,
        fechaRegistro: item.fechaRegistro,
        idUserRegistro: item.idUser,
        deviceId: context.deviceId
      }),
      markAsSynced: (item, result, syncDate) =>
        this.markAsSyncedRegistroLocationRutaPME(
          item.idRegistro!,
          syncDate
        ),
      markBatchAsSynced: (confirmedRecords, syncDate) =>
        this.markAsSyncedRegistroLocationRutaPMEBatch(
          confirmedRecords.map(record => record.item.idRegistro!),
          syncDate
        ),
      options
    });
  }

  async markAsSyncedRegistroLocationRutaPME(idRegistro: string, syncDate?: string): Promise<void> {
    const sql = `
    UPDATE APPD_RegistroLocationRutaPME
    SET syncedDB = 1, syncDBDate = ?
    WHERE idRegistro = ?`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), idRegistro];

    try {
      await this.db.run(sql, params);
      console.log(`Ubicacion con ID ${idRegistro} marcada como sincronizada.`);
    } catch (error) {
      console.error('Error marcando la ubicacion como sincronizada:', error);
      throw error;
    }
  }

  async markAsSyncedRegistroLocationRutaPMEBatch(ids: string[], syncDate?: string): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
    UPDATE APPD_RegistroLocationRutaPME
    SET syncedDB = 1, syncDBDate = ?
    WHERE idRegistro IN (${placeholders})`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids];

    try {
      await this.db.run(sql, params);
      console.log(`${ids.length} ubicaciones marcadas como sincronizadas.`);
    } catch (error) {
      console.error('Error marcando ubicaciones como sincronizadas:', error);
      throw error;
    }
  }

  async markRegistroLocationRutaPMEAsProcessed(idRegistros: string[], procesadoUiValue: number = 1): Promise<void> {
    const ids = (idRegistros || []).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const fechaActual = this.databaseService.getCurrentDateTime();
    const sql = `
    UPDATE APPD_RegistroLocationRutaPME
    SET procesado_ui = ?, fechaRegistro = ?
    WHERE idRegistro IN (${placeholders})`;

    try {
      await this.db.run(sql, [procesadoUiValue, fechaActual, ...ids]);
    } catch (error) {
      console.error('Error marcando registros como procesados (procesado_ui):', error);
      throw error;
    }
  }
}
