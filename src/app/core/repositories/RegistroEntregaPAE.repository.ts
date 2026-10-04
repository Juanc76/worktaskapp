import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { environment } from '../../../environments/environment';

import { 
RecordsDelivery, 
RecordsDeliveryDB, 
RegistroEntregaPayload, 
RegistroEntregaSyncRow } 
from '../models/registroEntregaPAE.model';

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
export class RegistroEntregaPAERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncRegistroEntregaPAE`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

 
   // Guarda Los registros de entrega en la base de datos local
   // Tabla : registroEntregaPAE
        async addRecordsDeliveryPAE(registroEntrega: RecordsDeliveryDB): Promise<string | null>{
        const query = `
          INSERT INTO APPD_RegistroEntregaPAE (idRegistroEntrega, Fecha, daneColegio, daneSede, idSitioEntrega, dateCreated, syncedDB, idUser) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
          const dateCreated = this.databaseService.getCurrentDateTime();  
          const idUser = registroEntrega.idUser ?? await this.authService.getCurrentUserId();
          const idRegistroEntrega = `${Date.now()}-${crypto.randomUUID()}`;
        const params = [
          idRegistroEntrega,
          dateCreated.split('T')[0],
          registroEntrega.daneColegio,
          registroEntrega.daneSede,
          registroEntrega.idSitioEntrega,
          dateCreated,
          0,
          idUser 
          ];
        try {
            await this.db.run(query, params);
            console.log('Registro guardado con id:');
            return idRegistroEntrega;
        } catch (error) {
          console.error('Error guardando el registro:');
          return null;
        }
      }
 

     //Obtiene de la base de datos SQLlite los datos necesarios para adelantra sincronizacion con el server
    async getPendingRecordsDeliveryPAE(limit: number): Promise<RegistroEntregaSyncRow[]> {
      const query = `
        SELECT
          idRegistroEntrega,
          Fecha,
          daneColegio,
          daneSede,
          idSitioEntrega,
          dateCreated,
          idUser
        FROM APPD_RegistroEntregaPAE
        WHERE COALESCE(syncedDB, 0) = 0
        ORDER BY idRegistroEntrega ASC
        LIMIT ?
      `;

      try {
        const result = await this.db.query(query, [limit]);
        return result.values as RegistroEntregaSyncRow[] || [];
      } catch (error) {
        console.error('Error obteniendo registros de entrega pendientes:');
        return [];
      }
    }

    async getPendingRecordsDeliveryPAEById(idEntrega: string): Promise<RegistroEntregaSyncRow[]> {
      const query = `
        SELECT
          idRegistroEntrega,
          Fecha,
          daneColegio,
          daneSede,
          idSitioEntrega,
          dateCreated,
          idUser
        FROM APPD_RegistroEntregaPAE
        WHERE idRegistroEntrega = ?
          AND COALESCE(syncedDB, 0) = 0
        LIMIT 1
      `;

      try {
        const result = await this.db.query(query, [idEntrega]);
        return result.values as RegistroEntregaSyncRow[] || [];
      } catch (error) {
        console.error('Error obteniendo la entrega pendiente ');
        throw error;
      }
    }
 
    // Obtener registros de entrega desde la base de datos local con filtros de búsqueda y fecha
    async syncRegistroEntregaPAE(options: SyncSqliteOptions = {}): Promise<SyncSqliteSummary<RegistroEntregaSyncRow>> {
      const maxRecords = options.maxRecords ?? 500;
      const pendientes = await this.getPendingRecordsDeliveryPAE(maxRecords);

      return this.syncSqliteRecordsService.syncRecords<RegistroEntregaSyncRow, RegistroEntregaPayload>({
        items: pendientes,
        endpointUrl: options.endpointUrl ?? this.syncEndpoint,
        getLocalId: item => item.idRegistroEntrega,
        buildPayload: (item, context) => ({
          localId: item.idRegistroEntrega,
          fecha: item.Fecha,
          daneColegio: item.daneColegio,
          daneSede: item.daneSede,
          idSitioEntrega: item.idSitioEntrega,
          dateCreated: item.dateCreated,
          idUserRegistro: item.idUser,
          deviceId: context.deviceId,
       }),
        markAsSynced: (item, result, syncDate) =>
          this.markAsSyncedRecordsDeliveryPAE(
            item.idRegistroEntrega,
            syncDate
          ),
        markBatchAsSynced: (confirmedRecords, syncDate) =>
          this.markAsSyncedRecordsDeliveryPAEBatch(
            confirmedRecords.map(record => record.item.idRegistroEntrega),
            syncDate
          ),
        options
      });
    }

    async syncRegistroEntregaPAEById(
      idEntrega: string,
      options: SyncSqliteOptions = {}
    ): Promise<SyncSqliteSummary<RegistroEntregaSyncRow>> {
      const pendientes = await this.getPendingRecordsDeliveryPAEById(idEntrega);

      return this.syncSqliteRecordsService.syncRecords<RegistroEntregaSyncRow, RegistroEntregaPayload>({
        items: pendientes,
        endpointUrl: options.endpointUrl ?? this.syncEndpoint,
        getLocalId: item => item.idRegistroEntrega,
        buildPayload: (item, context) => ({
          localId: item.idRegistroEntrega,
          fecha: item.Fecha,
          daneColegio: item.daneColegio,
          daneSede: item.daneSede,
          idSitioEntrega: item.idSitioEntrega,
          dateCreated: item.dateCreated,
          idUserRegistro: item.idUser,
          deviceId: context.deviceId
        }),
        markAsSynced: (item, result, syncDate) =>
          this.markAsSyncedRecordsDeliveryPAE(item.idRegistroEntrega, syncDate),
        markBatchAsSynced: (confirmedRecords, syncDate) =>
          this.markAsSyncedRecordsDeliveryPAEBatch(
            confirmedRecords.map(record => record.item.idRegistroEntrega),
            syncDate
          ),
        options
      });
    }

         //Metodo que permite marcar como sincronizado los registros que el backend responde
     // con un mensaje de exito.
     async markAsSyncedRecordsDeliveryPAE(id: string, syncDate?: string) {
     const query = `
       UPDATE APPD_RegistroEntregaPAE
       SET syncedDB = 1, syncDBDate = ?
       WHERE idRegistroEntrega = ? `;
     const params = [syncDate ?? this.databaseService.getCurrentDateTime(), id];
     try {
       await this.db.run(query, params);
       console.log(`Registro con ID marcado como sincronizado.`);
     } catch (error) {
       console.error('Error marcando el registro como sincronizado:');
     }
     }

     async markAsSyncedRecordsDeliveryPAEBatch(ids: string[], syncDate?: string): Promise<void> {
     if (ids.length === 0) return;

     const placeholders = ids.map(() => '?').join(',');
     const query = `
       UPDATE APPD_RegistroEntregaPAE
       SET syncedDB = 1, syncDBDate = ?
       WHERE idRegistroEntrega IN (${placeholders})`;
     const params = [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids];

     try {
       await this.db.run(query, params);
       console.log(`registros de entrega marcados como sincronizados.`);
     } catch (error) {
       console.error('Error marcando registros de entrega como sincronizados:');
       throw error;
     }
     }

    //Metodo que permite consultar los registros segun la interaccion del usuario con el scrollInfinite 
    async getRecordsDeliveryPAEPage(filter?: string, startDate?: string, endDate?: string, limit?: number, lastId?: string | null): Promise<RecordsDelivery[]> {
      const whereClauses: string[] = [];
      const params: (string | number)[] = [];
    
      if (filter && filter.trim().length > 0) {
        const likeValue = `%${filter.toLowerCase()}%`;
        const idLikeValue = `%${filter}%`;
        whereClauses.push(
          `(
            LOWER(c.nombreColegio) LIKE ?
            OR LOWER(s.nombreSede) LIKE ?
            OR LOWER(se.descripcionProyectoInversion) LIKE ?
            OR CAST(re.idRegistroEntrega AS TEXT) LIKE ?
            OR LOWER(re.idSitioEntrega) LIKE ?
          )`
        );
        params.push(likeValue, likeValue, likeValue, idLikeValue, idLikeValue);
      }
    
      if (startDate) {
        whereClauses.push('re.Fecha >= ?');
        params.push(startDate);
      }
    
      if (endDate) {
        whereClauses.push('re.Fecha <= ?');
        params.push(endDate);
      }
    
      if (lastId) {
        whereClauses.push('re.idRegistroEntrega < ?');
        params.push(lastId);
      }
    
      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const limitValue = typeof limit === 'number' ? limit : 50;
      
      const query = `
          SELECT 
            re.idRegistroEntrega,
            re.Fecha,
            c.nombreColegio AS Colegio,
            s.nombreSede AS Sede,
            se.descripcionProyectoInversion AS DescripcionProyecto,
            re.daneColegio,
            re.daneSede,
            re.idSitioEntrega,
            re.syncedDB,
            re.syncDBDate
          FROM APPD_RegistroEntregaPAE re
          INNER JOIN APPR_Colegios c ON re.daneColegio = c.daneColegio
          INNER JOIN APPR_Sedes_Educativas s ON re.daneSede = s.daneSede
          INNER JOIN APPR_Sitios_EntregaPAE se ON re.idSitioEntrega = se.idSitioEntrega
          ${whereSql}
          ORDER BY re.idRegistroEntrega DESC
          LIMIT ?
        `;
      params.push(limitValue);
    
      try {
        const result = await this.db.query(query, params);
        return result.values as RecordsDelivery[];
      } catch (error) {
        console.error('Error recuperando los registros de entrega:');
        return [];
      }
    }
 
 
    // Obtener un registro de entrega por su ID 
    async getRecordsDeliveryPAEById(id: string): Promise<RecordsDelivery | null> {
      try {
        const query = `
          SELECT 
            re.idRegistroEntrega,
            re.Fecha,
            c.nombreColegio AS Colegio,
            s.nombreSede AS Sede,
            se.descripcionProyectoInversion AS DescripcionProyecto,
            re.daneColegio,
            re.daneSede,
            re.idSitioEntrega,
            re.syncedDB,
            re.syncDBDate
          FROM APPD_RegistroEntregaPAE re
          INNER JOIN APPR_Colegios c ON re.daneColegio = c.daneColegio
          INNER JOIN APPR_Sedes_Educativas s ON re.daneSede = s.daneSede
          INNER JOIN APPR_Sitios_EntregaPAE se ON re.idSitioEntrega = se.idSitioEntrega
          WHERE re.idRegistroEntrega = ?
        `;
        const result = await this.db.query(query, [id]);
        if (result.values && result.values.length > 0) {
          return result.values[0] as RecordsDelivery;
        } else {
          return null;
        }
      } catch (error) {
        console.error('Error al obtener el registro de entrega:');
        return null;
      }
    }
    
}
