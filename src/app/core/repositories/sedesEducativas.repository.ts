import { Injectable } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SedeByColegioDTO} from '../models/mainMenu.model';
import { SedeOption } from '../models/registroEntregaPAE.model';

@Injectable({
  providedIn: 'root'
})
export class SedesEducativasRepository {

  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
  return this.databaseService.getDatabase();
 }
  
    // Guarda una lista de sedes en la base de datos local
    // Tabla : sedes
      async saveSedes(sedes: SedeByColegioDTO[]) {
        const dateCreated = this.databaseService.getCurrentDateTime();  
        const set = sedes.map(sede => ({
                statement: `INSERT OR REPLACE INTO APPR_Sedes_Educativas (
                              idAsignacion, daneColegio, daneSede, consecutivoSede, 
                              nombreSede, idLocalidad, idSede, idUser, isState, dateCreated
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values: [
                  sede.idAsignacion, 
                  sede.daneColegio, 
                  sede.daneSede, 
                  sede.consecutivoSede, 
                  sede.nombreSede, 
                  sede.idLocalidad, 
                  sede.idSede, 
                  sede.idUserAsig, 
                  sede.isState ? 1 : 0, // Aseguramos que sea 1 o 0 para SQLite
                  dateCreated
                ]
              }));

            try {
              // 2. Ejecutamos el lote completo. 
              // executeSet abre la transacción, inserta todo y hace el COMMIT automáticamente.
              await this.db.executeSet(set);
              
              console.log(`Sincronización exitosa: sedes guardadas o modificadas.`);
            } catch (e) {
              // El plugin maneja el ROLLBACK internamente si executeSet falla
              console.error("Error masivo en saveSedes con executeSet:");
              throw e;
            }
      }

  async getSedesOptionsByColegio(daneColegio: string): Promise<SedeOption[]> {
    const result = await this.db.query('SELECT nombreSede, daneSede, idSede FROM APPR_Sedes_Educativas WHERE daneColegio = ?', [daneColegio]);
    const rows = result.values || [];
    return rows.map((s: any) => ({ label: s.nombreSede, value: s.daneSede, idSede: Number(s.idSede) }));
  }
}