import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { environment } from '../../../environments/environment';
import {
  RecordsService,
  RecordsServiceDB,
  RegistroServicioPayload,
  RegistroServicioSyncRow
} from '../models/registroServicioPME.model';
import { DatabaseService } from '../services/database.service';
import { SyncSqliteRecordsService } from '../services/syncSqliteRecords.service';
import { AuthService } from '../auth/auth.service';
import { SyncSqliteOptions, SyncSqliteSummary } from '../models/syncSqliteRecords.model';

@Injectable({
  providedIn: 'root',
})
export class RegistroServicioPMERepository {
  private readonly syncEndpoint = `${environment.apiUrls.endpoint2}/synApp/syncRegistroServicioPME`;

  constructor(
    private databaseService: DatabaseService,
    private syncSqliteRecordsService: SyncSqliteRecordsService,
    private authService: AuthService
  ) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

 
   // Guarda los registros de servicios PME en la base de datos local
     // Tabla: RegistroServicioPME
     async addRecordsServicioPME(registroServicio: RecordsServiceDB): Promise<string | null> {
       const query = `
         INSERT INTO APPD_RegistroServicioPME (idRegistroServicio, Fecha, idRuta, rutaEscolar,recorrido, dateCreated, syncedDB, idUser)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const dateCreated = this.databaseService.getCurrentDateTime();    
        const idUser = registroServicio.idUser ?? await this.authService.getCurrentUserId();
        const idRegistroServicio = `${Date.now()}-${crypto.randomUUID()}`;
        const params = [
         idRegistroServicio,
         dateCreated.split('T')[0],
         registroServicio.idRuta,
         registroServicio.rutaEscolar,
          registroServicio.recorrido,
          dateCreated,
          0, // syncedDB inicializado en 0
          idUser
       ];
       try {
        await this.db.run(query, params);
        console.log('Registro guardado con id:', idRegistroServicio);
        return idRegistroServicio;
        } catch (error) {
              console.error('Error guardando el registro en RegistroServicioPME:', error);
              return null;
       }
     }

  async getPendingRecordsServicioPME(limit: number): Promise<RegistroServicioSyncRow[]> {
    const result = await this.db.query(`
      SELECT
        idRegistroServicio,
        Fecha,
        idRuta,
        rutaEscolar,
        recorrido,
        dateCreated,
        idUser
      FROM APPD_RegistroServicioPME
      WHERE COALESCE(syncedDB, 0) = 0
      ORDER BY idRegistroServicio ASC
      LIMIT ?
    `, [limit]);

    return result.values as RegistroServicioSyncRow[] || [];
  }

  async getPendingRecordsServicioPMEById(idServicio: string): Promise<RegistroServicioSyncRow[]> {
    const result = await this.db.query(`
      SELECT
        idRegistroServicio,
        Fecha,
        idRuta,
        rutaEscolar,
        recorrido,
        dateCreated,
        idUser
      FROM APPD_RegistroServicioPME
      WHERE idRegistroServicio = ?
        AND COALESCE(syncedDB, 0) = 0
      LIMIT 1
    `, [idServicio]);

    return result.values as RegistroServicioSyncRow[] || [];
  }

  async syncRegistroServicioPME(
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroServicioSyncRow>> {
    const maxRecords = options.maxRecords ?? 500;
    const pending = await this.getPendingRecordsServicioPME(maxRecords);
    return this.syncServicioRecords(pending, options);
  }

  async syncRegistroServicioPMEById(
    idServicio: string,
    options: SyncSqliteOptions = {}
  ): Promise<SyncSqliteSummary<RegistroServicioSyncRow>> {
    const pending = await this.getPendingRecordsServicioPMEById(idServicio);
    return this.syncServicioRecords(pending, options);
  }

  private syncServicioRecords(
    items: RegistroServicioSyncRow[],
    options: SyncSqliteOptions
  ): Promise<SyncSqliteSummary<RegistroServicioSyncRow>> {
    return this.syncSqliteRecordsService.syncRecords<RegistroServicioSyncRow, RegistroServicioPayload>({
      items,
      endpointUrl: options.endpointUrl ?? this.syncEndpoint,
      getLocalId: item => item.idRegistroServicio,
      buildPayload: (item, context) => ({
        localId: item.idRegistroServicio,
        fecha: item.Fecha,
        idRuta: item.idRuta,
        rutaEscolar: item.rutaEscolar,
        recorrido: item.recorrido,
        dateCreated: item.dateCreated,
        idUserRegistro: item.idUser,
        deviceId: context.deviceId
      }),
      markAsSynced: (item, result, syncDate) =>
        this.markAsSyncedRecordsServicioPME(item.idRegistroServicio, syncDate),
      markBatchAsSynced: (confirmedRecords, syncDate) =>
        this.markAsSyncedRecordsServicioPMEBatch(
          confirmedRecords.map(record => record.item.idRegistroServicio),
          syncDate
        ),
      options
    });
  }

  async markAsSyncedRecordsServicioPME(id: string, syncDate?: string): Promise<void> {
    await this.db.run(`
      UPDATE APPD_RegistroServicioPME
      SET syncedDB = 1, syncDBDate = ?
      WHERE idRegistroServicio = ?
    `, [syncDate ?? this.databaseService.getCurrentDateTime(), id]);
  }

  async markAsSyncedRecordsServicioPMEBatch(ids: string[], syncDate?: string): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    await this.db.run(`
      UPDATE APPD_RegistroServicioPME
      SET syncedDB = 1, syncDBDate = ?
      WHERE idRegistroServicio IN (${placeholders})
    `, [syncDate ?? this.databaseService.getCurrentDateTime(), ...ids]);
  }
   
       
     // Obtener registros de entrega desde la base de datos local con filtros de búsqueda y fecha
         async getRecordsServicioPMEPage(filter?: string, startDate?: string, endDate?: string, limit?: number, lastId?: string | null): Promise<RecordsService[]> {
           const whereClauses: string[] = [];
           const params: (string | number)[] = [];
         
           if (filter && filter.trim().length > 0) {
             const likeValue = `%${filter.toLowerCase()}%`;
             const idLikeValue = `%${filter}%`;
             whereClauses.push(
               `(
                 LOWER(rs.rutaEscolar) LIKE ?
                 OR LOWER(rs.recorrido) LIKE ?
                 OR CAST(rs.idRegistroServicio AS TEXT) LIKE ?
               )`
             );
             params.push(likeValue, likeValue, idLikeValue);
           }
         
           if (startDate) {
             whereClauses.push('rs.Fecha >= ?');
             params.push(startDate);
           }
         
           if (endDate) {
             whereClauses.push('rs.Fecha <= ?');
             params.push(endDate);
           }
         
           if (lastId) {
             whereClauses.push('rs.idRegistroServicio < ?');
             params.push(lastId);
           }
         
           const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
           const limitValue = typeof limit === 'number' ? limit : 50;
           
           const query = `
               SELECT 
                rs.idRegistroServicio,
                rs.Fecha,
                rs.idRuta,
                r.numeroRuta ,
                rs.recorrido ,
                rs.dateCreated,
                rs.syncedDB,
                rs.syncDBDate
              FROM APPD_RegistroServicioPME rs
              INNER JOIN APPR_Rutas_Escolares r ON rs.idRuta = r.idRuta
               ${whereSql}
               ORDER BY rs.idRegistroServicio DESC
               LIMIT ?
             `;
           params.push(limitValue);
         
           try {
             const result = await this.db.query(query, params);
             return result.values as RecordsService[];
           } catch (error) {
             console.error('Error recuperando los registros de entrega:', JSON.stringify(error));
             return [];
           }
         }
      

     // Obtener un servicio  por su ID 
   async getRecordsServicioPMEById(id: string): Promise<RecordsService | null> {
     try {
       const query = `
         SELECT 
           rs.idRegistroServicio,
           rs.Fecha,
           rs.idRuta,
           r.numeroRuta ,
           rs.recorrido ,
           rs.dateCreated,
           rs.syncedDB,
           rs.syncDBDate
         FROM APPD_RegistroServicioPME rs
         INNER JOIN APPR_Rutas_Escolares r ON rs.idRuta = r.idRuta
         WHERE rs.idRegistroServicio = ?
       `;
       const result = await this.db.query(query, [id]);
       
       if (result.values && result.values.length > 0) {
         return result.values[0] as RecordsService;
       } else {
         return null;
       }
     } catch (error) {
       console.error('Error al obtener el registro deL Servicio:', error);
       return null;
     }
   }
    
}
