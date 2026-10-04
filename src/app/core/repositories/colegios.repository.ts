import { Injectable } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { ColegioByUserDTO} from '../models/mainMenu.model';
import { ColegioOption } from '../models/registroEntregaPAE.model';


@Injectable({
  providedIn: 'root'
})
export class ColegiosRepository {

  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
  return this.databaseService.getDatabase();
 }
  
          // Guarda una lista de colegios en la base de datos local
          // Tabla : colegios
            async saveColegios(colegios: ColegioByUserDTO[]) {
              const dateCreated = this.databaseService.getCurrentDateTime();  
              const set = colegios.map(colegio => ({
                  statement: `INSERT OR REPLACE INTO APPR_Colegios (idAsignacion, daneColegio, nombreColegio, idLocalidad, 
                              idColegio, idUser, isState, dateCreated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  values: [
                    colegio.idAsignacion, colegio.daneColegio, colegio.nombreColegio, colegio.idLocalidad,
                    colegio.idColegio, colegio.idUser, 
                    (colegio.state ? 1 : 0), // Convertimos boolean a 1/0 para SQLite
                    dateCreated
                  ]
                }));

                try {
                  await this.db.executeSet(set);
                  console.log(`colegios guardados o modificados con éxito`);
                } catch (e) {
                  console.error("Error en executeSet:");
                  throw e;
                }

            }
    
  async getAllColegios(): Promise<ColegioByUserDTO[]> {
    const result = await this.db.query('SELECT * FROM APPR_Colegios');
    return (result.values || []) as ColegioByUserDTO[];
  }

  async getColegiosOptions(): Promise<ColegioOption[]> {
    const result = await this.db.query('SELECT nombreColegio, daneColegio FROM APPR_Colegios');
    const rows = result.values || [];
    return rows.map((c: any) => ({ label: c.nombreColegio, value: c.daneColegio }));
  }


}