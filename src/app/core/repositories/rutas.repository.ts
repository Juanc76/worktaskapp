import { Injectable } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { RutasByUserDTO} from '../models/mainMenu.model';

import { RutaEscolar } from '../models/tracking.model';

@Injectable({
  providedIn: 'root'
})
export class RutasRepository {

  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
  return this.databaseService.getDatabase();
 }
  
     
  // Guarda una lista de rutas en la base de datos local
  // Tabla: Rutas_Escolares
  async saveRutas(rutas: RutasByUserDTO[]) {
    const dateCreated = this.databaseService.getCurrentDateTime();
    const set = rutas.map(ruta => ({
      statement: `INSERT OR REPLACE INTO APPR_Rutas_Escolares (idAsignacion, idRuta, numeroRuta, dateCreated, isState, idUser)
                  VALUES (?, ?, ?, ?, ?, ?)`,
      values: [
        ruta.idAsignacion, ruta.idRuta, ruta.numeroRuta,
        dateCreated, ruta.isState, ruta.idUser
      ]
    }));

    try {
      await this.db.executeSet(set);
      console.log(`${rutas.length} rutas guardadas o modificadas con éxito`);
    } catch (e) {
      console.error("Error en executeSet:", e);
      throw e;
    }
  }
  
      async getRutasEscolares(): Promise<RutaEscolar[]> {
    const query = `
      SELECT idRuta AS key, numeroRuta AS label
      FROM APPR_Rutas_Escolares
      ORDER BY numeroRuta ASC`;

    try {
      const result = await this.db.query(query);
      return result.values || [];
    } catch (error) {
      console.error('Error al obtener las rutas escolares:', error);
      return [];
    }
  }

}