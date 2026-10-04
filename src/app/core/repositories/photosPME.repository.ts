import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { environment } from '../../../environments/environment';
import {
  PhotoPMEPayload,
  PhotoPMESyncRow,
  PhotoRecordPME,
  PhotoRecordPMESummary
} from '../models/photoRecordPME.model';
import { DatabaseService } from '../services/database.service';
import { SyncSqliteRecordsService } from '../services/syncSqliteRecords.service';
import { AuthService } from '../auth/auth.service';
import { SyncSqliteOptions, SyncSqliteSummary } from '../models/syncSqliteRecords.model';

@Injectable({
  providedIn: 'root',
})
export class PhotosPMERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncPhotosPME`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // Agrega registro de foto tomada a la
  // Tabla : APPD_photosPME
  async addPhotoPME(photo: PhotoRecordPME): Promise<void> {
    const sql = `
      INSERT INTO APPD_PhotosPME 
      (idPhoto, idRegistroServicio, filePath, fileName, url, date, latitud, longitud, rutaEscolar,
      recorrido, dateCreated, syncedPhoto, syncPhotoDate, deletedPhoto, syncedDB, deleteRegistro, idUser)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const dateCreated = this.databaseService.getCurrentDateTime();
    const idUser = photo.idUser ?? await this.authService.getCurrentUserId();
    const idPhoto = `${Date.now()}-${crypto.randomUUID()}`;

    const values = [
      idPhoto,
      photo.idRegistroServicio,
      photo.filePath,
      photo.fileName,
      photo.url,
      photo.date,
      photo.latitud ?? null,
      photo.longitud ?? null,
      photo.rutaEscolar,
      photo.recorrido,
      dateCreated,
      photo.syncedPhoto,
      photo.syncPhotoDate ?? null,
      photo.deletedPhoto,
      photo.syncedDB,
      photo.deleteRegistro,
      idUser,
    ];

    await this.db.run(sql, values);
  }

  // Obtener fotos pendientes de sincronización con el blob storage
  // Tabla : APPD_PhotosPME
  async getPendingPhotosPME(): Promise<PhotoRecordPME[]> {
    const result = await this.db.query(
      'SELECT * FROM APPD_PhotosPME WHERE syncedPhoto = 0 AND deletedPhoto = 0 AND deleteRegistro = 0'
    );
    const rows = result.values || [];
    return rows as PhotoRecordPME[];
  }

  async getPendingPhotosByServicioPME(idServicio: string): Promise<PhotoRecordPME[]> {
          const result = await this.db.query(
            'SELECT * FROM APPD_PhotosPME WHERE idRegistroServicio = ? AND syncedPhoto = 0 AND deletedPhoto = 0 AND deleteRegistro = 0',
            [idServicio]
          );
          return result.values as PhotoRecordPME[];
  }
        
  // Marcar foto como sincronizada con el blob storage
  // Tabla : APPD_PhotosPME
  async markAsSyncedPME(id: string): Promise<void> {
    const dateCreated = this.databaseService.getCurrentDateTime();
    await this.db.run('UPDATE APPD_PhotosPME SET syncedPhoto = 1, syncPhotoDate = ? WHERE idPhoto = ?', [dateCreated, id]);
  }

  async getPendingPhotosDBPME(limit: number): Promise<PhotoPMESyncRow[]> {
    const result = await this.db.query(`
      SELECT *
      FROM APPD_PhotosPME
      WHERE COALESCE(syncedDB, 0) = 0
        AND COALESCE(syncedPhoto, 0) = 1
        AND COALESCE(deleteRegistro, 0) = 0
      ORDER BY idPhoto ASC
      LIMIT ?
    `, [limit]);

    return result.values as PhotoPMESyncRow[] || [];
  }

  async getPendingPhotosDBByServicioPME(
    idServicio: string,
    limit: number
  ): Promise<PhotoPMESyncRow[]> {
    const result = await this.db.query(`
      SELECT *
      FROM APPD_PhotosPME
      WHERE idRegistroServicio = ?
        AND COALESCE(syncedDB, 0) = 0
        AND COALESCE(syncedPhoto, 0) = 1
        AND COALESCE(deleteRegistro, 0) = 0
      ORDER BY idPhoto ASC
      LIMIT ?
    `, [idServicio, limit]);

    return result.values as PhotoPMESyncRow[] || [];
  }

  async markAsSyncedDBPME(id: string, syncDate?: string): Promise<void> {
    await this.db.run(`
      UPDATE APPD_PhotosPME
      SET syncedDB = 1, syncDBDate = ?
      WHERE idPhoto = ?
    `, [syncDate ?? this.databaseService.getCurrentDateTime(), id]);
  }

  async markAsSyncedDBPMEBatch(ids: string[], syncDate?: string): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    await this.db.run(`
      UPDATE APPD_PhotosPME
      SET syncedDB = 1, syncDBDate = ?
      WHERE idPhoto IN (${placeholders})
    `, [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids]);
  }

  async syncRegistrosPhotosPME(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPMESyncRow>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingPhotosDBPME(maxRecords);
    return this.syncPhotoRecords(pending, options);
  }

  async syncRegistrosPhotosByServicioPME(
    idServicio: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<PhotoPMESyncRow>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingPhotosDBByServicioPME(idServicio, maxRecords);
    return this.syncPhotoRecords(pending, options);
  }

  private syncPhotoRecords(
    items: PhotoPMESyncRow[],
    options: SyncSqliteOptions
  ): Promise<SyncSqliteSummary<PhotoPMESyncRow>> {
    return this.syncSqliteRecordsService.syncRecords<PhotoPMESyncRow, PhotoPMEPayload>({
      items,
      endpointUrl: options.endpointUrl ?? this.syncEndpoint,
      getLocalId: item => item.idPhoto,
      buildPayload: (item, context) => ({
        localId: item.idPhoto,
        idRegistroServicioLocal: item.idRegistroServicio,
        filePath: item.filePath,
        fileName: item.fileName,
        url: item.url,
        photoDate: item.date,
        latitud: item.latitud,
        longitud: item.longitud,
        rutaEscolar: item.rutaEscolar,
        recorrido: item.recorrido,
        dateCreated: item.dateCreated,
        syncedPhoto: item.syncedPhoto,
        syncPhotoDate: item.syncPhotoDate,
        deletedPhoto: item.deletedPhoto,
        idUserRegistro: item.idUser,
        deviceId: context.deviceId
      }),
      markAsSynced: (item, result, syncDate) =>
        this.markAsSyncedDBPME(item.idPhoto, syncDate),
      markBatchAsSynced: (confirmedRecords, syncDate) =>
        this.markAsSyncedDBPMEBatch(
          confirmedRecords.map(record => record.item.idPhoto),
          syncDate
        ),
      options
    });
  }

  // Marcar foto como borrada
      // Tabla : APPD_PhotosPME
      async markDeletePhotoPME(id: string) {
          const dateCreated = this.databaseService.getCurrentDateTime();  
          await this.db.run('UPDATE APPD_PhotosPME SET deleteRegistro = 1, deleteRegistroDate = ? WHERE idPhoto = ?', [dateCreated, id]);
      }

  // Obtener todas las fotos
  // Tabla : APPD_PhotosPME
  async getAllPhotosPME(): Promise<PhotoRecordPME[]> {
    const result = await this.db.query('SELECT * FROM APPD_PhotosPME WHERE deleteRegistro = 0');
    const rows = result.values || [];
    return rows as PhotoRecordPME[];
  }

  // Obtener todas las fotos de un servicio de ruta escolar
  // Tabla : APPD_PhotosPME
  // Obtener todas las fotos por entrega, con paginación
      async getAllPhotosByServicioPME(idServicio: string, limit?: number, lastId?: string | null): Promise<PhotoRecordPME[]> {
      const whereClauses: string[] = ['idRegistroServicio = ?', 'deleteRegistro = 0'];
      const params: (string | number)[] = [idServicio];
  
      if (lastId) {
        whereClauses.push('idPhoto < ?');
        params.push(lastId);
      }
  
      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const limitValue = typeof limit === 'number' ? limit : 50;
  
      const query = `
        SELECT *
        FROM APPD_PhotosPME
        ${whereSql}
        ORDER BY idPhoto DESC
        LIMIT ?
      `;
      params.push(limitValue);
  
      try {
        const result = await this.db.query(query, params);
        const rows = result.values || [];
        return rows as PhotoRecordPME[];
      } catch (error) {
         return [];
      }
      }
  
      //cuenta los registros de fotos por servicio, para mostrar un resumen en la pantalla de fotos
      async getPhotoSummaryByServicioPME(idServicio: string): Promise<PhotoRecordPMESummary> {
          const result = await this.db.query(`
              SELECT 
                  COUNT(*) AS totalFotos,
                  SUM(CASE WHEN syncedPhoto = 1 THEN 1 ELSE 0 END) AS sincronizadas,
                  SUM(CASE WHEN syncedPhoto = 0 THEN 1 ELSE 0 END) AS pendientes
              FROM APPD_PhotosPME
              WHERE idRegistroServicio = ? AND deleteRegistro = 0
          `, [idServicio]);
  
          const row = result.values?.[0];
          return {
              totalFotos: row?.totalFotos ?? 0,
              sincronizadas: row?.sincronizadas ?? 0,
              pendientes: row?.pendientes ?? 0
          };
      }
}
