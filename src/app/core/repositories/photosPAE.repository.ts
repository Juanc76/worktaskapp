import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';

import { DatabaseService } from '../services/database.service';
import { SyncSqliteRecordsService } from '../services/syncSqliteRecords.service';
import { AuthService } from '../auth/auth.service';


//Interfaces enfocadas en servir informacion al componente.
import { 
PhotoRecordPAE,
PhotoRecordPAESummary,
PhotoPAEPayload,
PhotoPAESyncRow } 
from '../models/photoRecordPAE.model';

import {
  SyncSqliteOptions,
  SyncSqliteSummary
} from '../models/syncSqliteRecords.model';

@Injectable({
  providedIn: 'root'
})

export class PhotosPAERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncPhotosPAE`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
  return this.databaseService.getDatabase();
 }
  
    // Agrega registro de foto tomada a la 
    // Tabla : photosPAE
    async addPhotoPAE(photo: PhotoRecordPAE) {
      const sql = `
        INSERT INTO APPD_PhotosPAE 
        (idPhoto,idRegistroEntrega, filePath, fileName, url, date, latitud, longitud, daneColegio, 
         daneSede, idSitioEntrega, dateCreated, syncedPhoto, syncPhotoDate, deletedPhoto,syncedDB, deleteRegistro, idUser, faceVector) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const dateCreated = this.databaseService.getCurrentDateTime();  
      const idUser = photo.idUser ?? await this.authService.getCurrentUserId();
      const idPhoto = `${Date.now()}-${crypto.randomUUID()}`;
      const values = [
        idPhoto,
        photo.idRegistroEntrega,
        photo.filePath,
        photo.fileName,
        photo.url,
        photo.date,
        photo.latitud ?? null,
        photo.longitud ?? null,
        photo.daneColegio,
        photo.daneSede,
        photo.IdSitioEntrega,
        dateCreated,
        photo.syncedPhoto,
        photo.syncPhotoDate ?? null,
        photo.deletedPhoto,
        photo.syncedDB,
        photo.deleteRegistro,
        idUser,
        photo.faceVector ?? null
      ];
      await this.db.run(sql, values);
    }
  
    
      // Obtener fotos pendientes de sincronización con el blob storage
      // Tabla : photosPAE
      async getPendingPhotosPAE(): Promise<PhotoRecordPAE[]> {
          const result = await this.db.query('SELECT * FROM APPD_PhotosPAE WHERE syncedPhoto = 0 AND deletedPhoto = 0 And deleteRegistro = 0');
          return result.values as PhotoRecordPAE[];
      }
  
      // Obtener fotos pendientes de sincronización con el blob storage por entrega
      // Tabla : photosPAE
      async getPendingPhotosByDeliveryPAE(idEntrega: string): Promise<PhotoRecordPAE[]> {
        const result = await this.db.query(
          'SELECT * FROM APPD_PhotosPAE WHERE idRegistroEntrega = ? AND syncedPhoto = 0 AND deletedPhoto = 0 AND deleteRegistro = 0',
          [idEntrega]
        );
        return result.values as PhotoRecordPAE[];
      }
  
      // Marcar foto como sincronizada con el blob storage
      // Tabla : photosPAE
      async markAsSyncedPAE(id: string) {
          const dateCreated = this.databaseService.getCurrentDateTime();  
          await this.db.run('UPDATE APPD_PhotosPAE SET syncedPhoto = 1, syncPhotoDate = ? WHERE idPhoto = ?', [dateCreated, id]);
      }

      // Obtener fotos pendientes de sincronizacion de metadata con la DB remota
      // Tabla : photosPAE
      async getPendingPhotosDBPAE(limit: number): Promise<PhotoPAESyncRow[]> {
          const result = await this.db.query(`
            SELECT *
            FROM APPD_PhotosPAE
            WHERE COALESCE(syncedDB, 0) = 0
              AND COALESCE(syncedPhoto, 0) = 1
              AND COALESCE(deleteRegistro, 0) = 0
            ORDER BY idPhoto ASC
            LIMIT ?
          `, [limit]);
          return result.values as PhotoPAESyncRow[] || [];
      }

      async getPendingPhotosDBByDeliveryPAE(idEntrega: string, limit: number): Promise<PhotoPAESyncRow[]> {
          const result = await this.db.query(`
            SELECT *
            FROM APPD_PhotosPAE
            WHERE idRegistroEntrega = ?
              AND COALESCE(syncedDB, 0) = 0
              AND COALESCE(syncedPhoto, 0) = 1
              AND COALESCE(deleteRegistro, 0) = 0
            ORDER BY idPhoto ASC
            LIMIT ?
          `, [idEntrega, limit]);
          return result.values as PhotoPAESyncRow[] || [];
      }

      // Marcar foto como sincronizada con la DB remota
      // Tabla : photosPAE
      async markAsSyncedDBPAE(id: string, syncDate?: string): Promise<void> {
          const dateCreated = syncDate ?? this.databaseService.getCurrentDateTime();
          await this.db.run(
            `UPDATE APPD_PhotosPAE
             SET syncedDB = 1, syncDBDate = ?
             WHERE idPhoto = ?`,
            [dateCreated, id]
          );
      }

      async markAsSyncedDBPAEBatch(ids: string[], syncDate?: string): Promise<void> {
          if (ids.length === 0) return;

          const placeholders = ids.map(() => '?').join(',');
          const dateCreated = syncDate ?? this.databaseService.getCurrentDateTime();
          await this.db.run(
            `UPDATE APPD_PhotosPAE
             SET syncedDB = 1, syncDBDate = ?
             WHERE idPhoto IN (${placeholders})`,
            [dateCreated, ...ids]
          );
      }

      async syncRegistrosPhotosPAE(options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<PhotoPAESyncRow>> {
          const maxRecords = options.maxRecords ?? 500;
          const pending = await this.getPendingPhotosDBPAE(maxRecords);

          return this.syncSqliteRecordsService.syncRecords<PhotoPAESyncRow, PhotoPAEPayload>({
            items: pending,
            endpointUrl: options.endpointUrl ?? this.syncEndpoint,
            getLocalId: item => item.idPhoto,
            buildPayload: (item, context) => ({
              localId: item.idPhoto,
              idRegistroEntregaLocal: item.idRegistroEntrega,
              filePath: item.filePath,
              fileName: item.fileName,
              url: item.url,
              photoDate: item.date,
              latitud: item.latitud,
              longitud: item.longitud,
              daneColegio: item.daneColegio,
              daneSede: item.daneSede,
              idSitioEntrega: item.IdSitioEntrega,
              dateCreated: item.dateCreated,
              syncedPhoto: item.syncedPhoto,
              syncPhotoDate: item.syncPhotoDate,
              deletedPhoto: item.deletedPhoto,
              faceVector: item.faceVector,
              idUserRegistro: item.idUser,
              deviceId: context.deviceId
            }),
            markAsSynced: (item, result, syncDate) =>
              this.markAsSyncedDBPAE(
                item.idPhoto,
                syncDate
              ),
            markBatchAsSynced: (confirmedRecords, syncDate) =>
              this.markAsSyncedDBPAEBatch(
                confirmedRecords.map(record => record.item.idPhoto),
                syncDate
              ),
            options
          });
      }

      async syncRegistrosPhotosByDeliveryPAE(idEntrega: string, options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<PhotoPAESyncRow>> {
          const maxRecords = options.maxRecords ?? 500;
          const pending = await this.getPendingPhotosDBByDeliveryPAE(idEntrega, maxRecords);

          return this.syncSqliteRecordsService.syncRecords<PhotoPAESyncRow, PhotoPAEPayload>({
            items: pending,
            endpointUrl: options.endpointUrl ?? this.syncEndpoint,
            getLocalId: item => item.idPhoto,
            buildPayload: (item, context) => ({
              localId: item.idPhoto,
              idRegistroEntregaLocal: item.idRegistroEntrega,
              filePath: item.filePath,
              fileName: item.fileName,
              url: item.url,
              photoDate: item.date,
              latitud: item.latitud,
              longitud: item.longitud,
              daneColegio: item.daneColegio,
              daneSede: item.daneSede,
              idSitioEntrega: item.IdSitioEntrega,
              dateCreated: item.dateCreated,
              syncedPhoto: item.syncedPhoto,
              syncPhotoDate: item.syncPhotoDate,
              deletedPhoto: item.deletedPhoto,
              faceVector: item.faceVector,
              idUserRegistro: item.idUser,
              deviceId: context.deviceId
            }),
            markAsSynced: (item, result, syncDate) =>
              this.markAsSyncedDBPAE(
                item.idPhoto,
                syncDate
              ),
            markBatchAsSynced: (confirmedRecords, syncDate) =>
              this.markAsSyncedDBPAEBatch(
                confirmedRecords.map(record => record.item.idPhoto),
                syncDate
              ),
            options
          });
      }
      
      // Marcar foto como borrada
      // Tabla : photosPAE
      async markDeletePhotoPAE(id: string) {
          const dateCreated = this.databaseService.getCurrentDateTime();  
          await this.db.run('UPDATE APPD_PhotosPAE SET deleteRegistro = 1, deleteRegistroDate = ? WHERE idPhoto = ?', [dateCreated, id]);
      }
  
      // Obtener todas las fotos 
      // Tabla : photosPAE
      async getAllPhotosPAE(): Promise<PhotoRecordPAE[]> {
          const result = await this.db.query('SELECT * FROM APPD_PhotosPAE WHERE deleteRegistro = 0');
          const rows = result.values || [];
          return rows;
      }
  
        // Obtener todas las fotos por entrega, con paginación
      async getAllPhotosByDeliveryPAE(idEntrega: string, limit?: number, lastId?: string | null): Promise<PhotoRecordPAE[]> {
      const whereClauses: string[] = ['idRegistroEntrega = ?', 'deleteRegistro = 0'];
      const params: (string | number)[] = [idEntrega];
  
      if (lastId) {
        whereClauses.push('idPhoto < ?');
        params.push(lastId);
      }
  
      const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
      const limitValue = typeof limit === 'number' ? limit : 50;
  
      const query = `
        SELECT *
        FROM APPD_PhotosPAE
        ${whereSql}
        ORDER BY idPhoto DESC
        LIMIT ?
      `;
      params.push(limitValue);
  
      try {
        const result = await this.db.query(query, params);
        const rows = result.values || [];
        return rows as PhotoRecordPAE[];
      } catch (error) {
         return [];
      }
      }
  
      // Obtener los vectores faciales de fotos existentes por entrega
      async getFaceVectorsByDeliveryPAE(idEntrega: string): Promise<string[]> {
        const result = await this.db.query(
          `SELECT faceVector FROM APPD_PhotosPAE
           WHERE idRegistroEntrega = ? AND deleteRegistro = 0 AND faceVector IS NOT NULL`,
          [idEntrega]
        );
        const rows = result.values || [];
        return rows.map((r: any) => r.faceVector as string);
      }

      //cuenta los registros de fotos por entrega, para mostrar un resumen en la pantalla de fotos
      async getPhotoSummaryByDeliveryPAE(idEntrega: string): Promise<PhotoRecordPAESummary> {
          const result = await this.db.query(`
              SELECT 
                  COUNT(*) AS totalFotos,
                  SUM(CASE WHEN syncedPhoto = 1 THEN 1 ELSE 0 END) AS sincronizadas,
                  SUM(CASE WHEN syncedPhoto = 0 THEN 1 ELSE 0 END) AS pendientes
              FROM APPD_PhotosPAE
              WHERE idRegistroEntrega = ? AND deleteRegistro = 0
          `, [idEntrega]);
  
          const row = result.values?.[0];
          return {
              totalFotos: row?.totalFotos ?? 0,
              sincronizadas: row?.sincronizadas ?? 0,
              pendientes: row?.pendientes ?? 0
          };
      }
  
    

}
