import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { environment } from '../../../environments/environment';
import {
  RegistroTrazadoRutaPMEBD,
  RegistroTrazadoRutaPME,
  RegistroTrazadoRutaPMEPayload
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
export class RegistroTrazadoRutaPMERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncRegistroTrazadoRutaPME`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // Agrega un registro a la tabla RegistroTrazadoRutaPME
  async addRegistroTrazadoRutaPME(registro: RegistroTrazadoRutaPMEBD): Promise<string> {
    const dateCreated = this.databaseService.getCurrentDateTime();    
    const idUser = registro.idUser ?? await this.authService.getCurrentUserId();
    const idTrazado = `${Date.now()}-${crypto.randomUUID()}`;
    const sql = `
    INSERT INTO APPD_RegistroTrazadoRutaPME (
      idTrazado, idRuta, rutaEscolar, recorrido, FechaStart, FechaEnd, distanciaAcumulada, tiempoAcumulado, velocidadMedia, syncedDB, syncDBDate, synTotal, syncTotalDate, idUser
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      idTrazado,
      registro.idRuta,
      registro.rutaEscolar,
      registro.recorrido,
      dateCreated,
      registro.FechaEnd,
      registro.distanciaAcumulada ?? 0,
      registro.tiempoAcumulado ?? 0,
      registro.velocidadMedia ?? 0,
      registro.syncedDB ?? 0,
      registro.syncDBDate ?? null,
      registro.synTotal ?? 0,
      registro.syncTotalDate ?? null,
      idUser
    ];

    try {
      await this.db.run(sql, values);
      console.log('Registro agregado a la tabla RegistroTrazadoRutaPME con ID:', idTrazado);
      return idTrazado;
    } catch (error) {
      console.error('Error al agregar el registro a RegistroTrazadoRutaPME:', error);
      throw error;
    }
  }

  // Actualiza un registro en la tabla RegistroTrazadoRutaPME
  async updateRegistroTrazadoRutaPME(idTrazado: string, distanciaAcumulada: number, tiempoAcumulado: number, velocidadMedia: number): Promise<void> {
    const FechaEnd = this.databaseService.getCurrentDateTime();    
    const sql = `
    UPDATE APPD_RegistroTrazadoRutaPME
    SET FechaEnd = ?, distanciaAcumulada = ?, tiempoAcumulado = ?, velocidadMedia = ?
    WHERE idTrazado = ?`;

    const params = [
      FechaEnd,
      distanciaAcumulada,
      tiempoAcumulado,
      velocidadMedia,
      idTrazado
    ];

    try {
      await this.db.run(sql, params);
      console.log(`Registro actualizado en APPD_RegistroTrazadoRutaPME para idTrazado: ${idTrazado}`);
    } catch (error) {
      console.error('Error al actualizar APPD_RegistroTrazadoRutaPME:', error);
      throw error;
    }
  }

  // Obtiene un registro de la tabla RegistroTrazadoRutaPME por su ID
  async getRegistroTrazadoRutaPMEById(idTrazado: string): Promise<RegistroTrazadoRutaPMEBD | null> {
    const sql = `
    SELECT *
    FROM APPD_RegistroTrazadoRutaPME
    WHERE idTrazado = ?`;

    try {
      const result = await this.db.query(sql, [idTrazado]);
      if (result.values && result.values.length > 0) {
        return result.values[0] as RegistroTrazadoRutaPMEBD;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error al obtener el registro de RegistroTrazadoRutaPME por ID:', error);
      throw error;
    }
  }

  
   
  async syncRegistroTrazadoRutaPME(options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingRegistroTrazadoRutaPME(maxRecords);

    return this.syncPendingRegistroTrazadoRutaPME(pending, options);
  }

  //
  async getPendingRegistroTrazadoRutaPME(limit: number): Promise<RegistroTrazadoRutaPMEBD[]> {
    const sql = `
    SELECT
      idTrazado,
      idRuta,
      rutaEscolar,
      recorrido,
      FechaStart,
      FechaEnd,
      distanciaAcumulada,
      tiempoAcumulado,
      velocidadMedia,
      mapUrl,
      syncedDB,
      syncDBDate,
      synTotal,
      syncTotalDate,
      idUser
    FROM APPD_RegistroTrazadoRutaPME
    WHERE COALESCE(syncedDB, 0) = 0
      AND COALESCE(synTotal, 0) = 0
      AND (FechaEnd IS NULL OR TRIM(FechaEnd) = '')
    ORDER BY FechaStart ASC, idTrazado ASC
    LIMIT ?`;

    try {
      const result = await this.db.query(sql, [limit]);
      return result.values as RegistroTrazadoRutaPMEBD[] || [];
    } catch (error) {
      console.error('Error obteniendo trazados pendientes:', error);
      return [];
    }
  }

   async syncRegistroTrazadoRutaPMEById(idTrazado: string, options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    const pending = await this.getPendingRegistroTrazadoRutaPMEById(idTrazado);

    return this.syncPendingRegistroTrazadoRutaPME(pending, options);
  }


  async getPendingRegistroTrazadoRutaPMEById(idTrazado: string): Promise<RegistroTrazadoRutaPMEBD[]> {
    const sql = `
    SELECT
      idTrazado,
      idRuta,
      rutaEscolar,
      recorrido,
      FechaStart,
      FechaEnd,
      distanciaAcumulada,
      tiempoAcumulado,
      velocidadMedia,
      mapUrl,
      syncedDB,
      syncDBDate,
      synTotal,
      syncTotalDate,
      idUser
    FROM APPD_RegistroTrazadoRutaPME
    WHERE idTrazado = ?
      AND COALESCE(syncedDB, 0) = 0
      AND COALESCE(synTotal, 0) = 0
      AND (FechaEnd IS NULL OR TRIM(FechaEnd) = '')
    LIMIT 1`;

    try {
      const result = await this.db.query(sql, [idTrazado]);
      return result.values as RegistroTrazadoRutaPMEBD[] || [];
    } catch (error) {
      console.error('Error obteniendo trazado pendiente por ID:', error);
      return [];
    }
  }

 
  private async syncPendingRegistroTrazadoRutaPME(
    pending: RegistroTrazadoRutaPMEBD[],
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    return this.syncSqliteRecordsService.syncRecords<RegistroTrazadoRutaPMEBD, RegistroTrazadoRutaPMEPayload>({
      items: pending,
      endpointUrl: options.endpointUrl ?? this.syncEndpoint,
      getLocalId: item => item.idTrazado!,
      buildPayload: (item, context) => ({
        localId: item.idTrazado!,
        idRuta: item.idRuta,
        rutaEscolar: item.rutaEscolar,
        recorrido: item.recorrido,
        fechaStart: item.FechaStart,
        fechaEnd: item.FechaEnd,
        distanciaAcumulada: item.distanciaAcumulada,
        tiempoAcumulado: item.tiempoAcumulado,
        velocidadMedia: item.velocidadMedia,
        mapUrl: item.mapUrl,
        idUserRegistro: item.idUser,
        deviceId: context.deviceId
      }),
      markAsSynced: (item, result, syncDate) =>
        this.markAsSyncedRegistroTrazadoRutaPME(
          item.idTrazado!,
          syncDate
        ),
      markBatchAsSynced: (confirmedRecords, syncDate) =>
        this.markAsSyncedRegistroTrazadoRutaPMEBatch(
          confirmedRecords.map(record => record.item.idTrazado!),
          syncDate
        ),
      options
    });
  }


  async markAsSyncedRegistroTrazadoRutaPME(idTrazado: string, syncDate?: string): Promise<void> {
    const sql = `
    UPDATE APPD_RegistroTrazadoRutaPME
    SET syncedDB = 1, syncDBDate = ?
    WHERE idTrazado = ?`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), idTrazado];

    try {
      await this.db.run(sql, params);
      console.log(`Trazado con ID ${idTrazado} marcado como sincronizado.`);
    } catch (error) {
      console.error('Error marcando el trazado como sincronizado:', error);
      throw error;
    }
  }

  async markAsSyncedRegistroTrazadoRutaPMEBatch(ids: string[], syncDate?: string): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
    UPDATE APPD_RegistroTrazadoRutaPME
    SET syncedDB = 1, syncDBDate = ?
    WHERE idTrazado IN (${placeholders})`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids];

    try {
      await this.db.run(sql, params);
      console.log(`${ids.length} trazados marcados como sincronizados.`);
    } catch (error) {
      console.error('Error marcando trazados como sincronizados:', error);
      throw error;
    }
  }

  //Aqui se encuentra los metodos que se utilizan para sincrinizar los datos de trazados ya finalizados 

    async syncRegistroTrazadoRutaPMEFinalizado(options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingRegistroTrazadoRutaPMEFinalizado(maxRecords);

    return this.syncPendingRegistroTrazadoRutaPMEFinalizado(pending, options);
  }
  
  async getPendingRegistroTrazadoRutaPMEFinalizado(limit: number): Promise<RegistroTrazadoRutaPMEBD[]> {
    const sql = `
    SELECT
      idTrazado,
      idRuta,
      rutaEscolar,
      recorrido,
      FechaStart,
      FechaEnd,
      distanciaAcumulada,
      tiempoAcumulado,
      velocidadMedia,
      mapUrl,
      syncedDB,
      syncDBDate,
      synTotal,
      syncTotalDate,
      idUser
    FROM APPD_RegistroTrazadoRutaPME
    WHERE COALESCE(syncedDB, 0) = 1
      AND COALESCE(synTotal, 0) = 0
      AND FechaEnd IS NOT NULL
      AND TRIM(FechaEnd) <> ''
    ORDER BY FechaStart ASC, idTrazado ASC
    LIMIT ?`;

    try {
      const result = await this.db.query(sql, [limit]);
      return result.values as RegistroTrazadoRutaPMEBD[] || [];
    } catch (error) {
      console.error('Error obteniendo trazados finalizados pendientes:', error);
      return [];
    }
  }

  
  async syncRegistroTrazadoRutaPMEFinalizadoById(idTrazado: string, options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    const pending = await this.getPendingRegistroTrazadoRutaPMEFinalizadoById(idTrazado);

    return this.syncPendingRegistroTrazadoRutaPMEFinalizado(pending, options);
  }

  async getPendingRegistroTrazadoRutaPMEFinalizadoById(idTrazado: string): Promise<RegistroTrazadoRutaPMEBD[]> {
    const sql = `
    SELECT
      idTrazado,
      idRuta,
      rutaEscolar,
      recorrido,
      FechaStart,
      FechaEnd,
      distanciaAcumulada,
      tiempoAcumulado,
      velocidadMedia,
      mapUrl,
      syncedDB,
      syncDBDate,
      synTotal,
      syncTotalDate,
      idUser
    FROM APPD_RegistroTrazadoRutaPME
    WHERE idTrazado = ?
      AND COALESCE(syncedDB, 0) = 1
      AND COALESCE(synTotal, 0) = 0
      AND FechaEnd IS NOT NULL
      AND TRIM(FechaEnd) <> ''
    LIMIT 1`;

    try {
      const result = await this.db.query(sql, [idTrazado]);
      return result.values as RegistroTrazadoRutaPMEBD[] || [];
    } catch (error) {
      console.error('Error obteniendo trazado finalizado pendiente por ID:', error);
      return [];
    }
  }



  private async syncPendingRegistroTrazadoRutaPMEFinalizado(
    pending: RegistroTrazadoRutaPMEBD[],
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroTrazadoRutaPMEBD>> {
    return this.syncSqliteRecordsService.syncRecords<RegistroTrazadoRutaPMEBD, RegistroTrazadoRutaPMEPayload>({
      items: pending,
      endpointUrl: options.endpointUrl ?? this.syncEndpoint,
      getLocalId: item => item.idTrazado!,
      buildPayload: (item, context) => ({
        localId: item.idTrazado!,
        idRuta: item.idRuta,
        rutaEscolar: item.rutaEscolar,
        recorrido: item.recorrido,
        fechaStart: item.FechaStart,
        fechaEnd: item.FechaEnd,
        distanciaAcumulada: item.distanciaAcumulada,
        tiempoAcumulado: item.tiempoAcumulado,
        velocidadMedia: item.velocidadMedia,
        mapUrl: item.mapUrl,
        idUserRegistro: item.idUser,
        deviceId: context.deviceId
      }),
      markAsSynced: (item, result, syncDate) =>
        this.markAsSyncedTotalRegistroTrazadoRutaPME(
          item.idTrazado!,
          syncDate
        ),
      markBatchAsSynced: (confirmedRecords, syncDate) =>
        this.markAsSyncedTotalRegistroTrazadoRutaPMEBatch(
          confirmedRecords.map(record => record.item.idTrazado!),
          syncDate
        ),
      options
    });
  }

  

  async markAsSyncedTotalRegistroTrazadoRutaPME(idTrazado: string, syncDate?: string): Promise<void> {
    const sql = `
    UPDATE APPD_RegistroTrazadoRutaPME
    SET synTotal = 1, syncTotalDate = ?
    WHERE idTrazado = ?`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), idTrazado];

    try {
      await this.db.run(sql, params);
      console.log(`Cierre del trazado con ID ${idTrazado} marcado como sincronizado.`);
    } catch (error) {
      console.error('Error marcando el cierre del trazado como sincronizado:', error);
      throw error;
    }
  }

  async markAsSyncedTotalRegistroTrazadoRutaPMEBatch(ids: string[], syncDate?: string): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const sql = `
    UPDATE APPD_RegistroTrazadoRutaPME
    SET synTotal = 1, syncTotalDate = ?
    WHERE idTrazado IN (${placeholders})`;
    const params = [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids];

    try {
      await this.db.run(sql, params);
      console.log(`${ids.length} cierres de trazado marcados como sincronizados.`);
    } catch (error) {
      console.error('Error marcando cierres de trazado como sincronizados:', error);
      throw error;
    }
  }

  // Obtiene registros de trazado por ruta
  async getRegistroTrazadoRutaPMEByRuta(idRuta: number): Promise<RegistroTrazadoRutaPME[]> {
    const sql = `
    SELECT recorrido, FechaStart, FechaEnd, distanciaAcumulada, tiempoAcumulado, velocidadMedia, mapUrl, syncedDB, syncDBDate, synTotal, syncTotalDate, idTrazado
    FROM APPD_RegistroTrazadoRutaPME
    WHERE idRuta = ?`;
    try {
      const result = await this.db.query(sql, [idRuta]);
      const rows = result.values || [];
      return rows;
    } catch (error) {
      console.error('Error al obtener el registro de RegistroTrazadoRutaPME por Numero Ruta:', error);
      return [];
    }
  }

  // Obtiene todos los registros de trazado de rutas
  async getRegistrosTrazadoRutas(): Promise<RegistroTrazadoRutaPME[]> {
    const sql = `
    SELECT recorrido, FechaStart, FechaEnd, distanciaAcumulada, tiempoAcumulado, velocidadMedia, mapUrl, syncedDB, syncDBDate, synTotal, syncTotalDate, idTrazado
    FROM APPD_RegistroTrazadoRutaPME`;
    try {
      const result = await this.db.query(sql);
      const rows = result.values || [];
      return rows;
    } catch (error) {
      console.error('Error al obtener los registros de RegistroTrazadoRutaPME:', error);
      return [];
    }
  }

  // Obtiene la ruta completa para sincronizar (cabecera + puntos GPS)
  async getRutaCompletaParaSincronizar(idTrazado: string) {
    const trazado = await this.db.query(
      "SELECT * FROM APPD_RegistroTrazadoRutaPME WHERE idTrazado = ?",
      [idTrazado]
    );

    const puntos = await this.db.query(
      "SELECT fechaGps, latitud, longitud, altitud, velocidad FROM APPD_RegistroLocationRutaPME WHERE idTrazado = ?",
      [idTrazado]
    );

    return {
      puntosGps: puntos.values
    };
  }

  // Obtiene la URL del mapa estático por idTrazado
  async getMapUrlByTrazado(idTrazado: string): Promise<string | null> {
    const sql = `SELECT mapUrl FROM APPD_RegistroTrazadoRutaPME WHERE idTrazado = ?`;
    try {
      const result = await this.db.query(sql, [idTrazado]);
      const rows = result.values || [];
      return rows.length > 0 ? rows[0].mapUrl : null;
    } catch (error) {
      console.error('Error al obtener la URL del mapa para idTrazado:', error);
      return null;
    }
  }

  // Guarda la URL del mapa estático para un trazado
  async saveMapUrl(idTrazado: string, mapUrl: string): Promise<void> {
    const sql = `UPDATE APPD_RegistroTrazadoRutaPME SET mapUrl = ? WHERE idTrazado = ?`;
    try {
      await this.db.run(sql, [mapUrl, idTrazado]);
      console.log('URL del mapa guardada en la base de datos:', mapUrl);
    } catch (error) {
      console.error('Error al guardar la URL del mapa en la base de datos:', error);
    }
  }
}
