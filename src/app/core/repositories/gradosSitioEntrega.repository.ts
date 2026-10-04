import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { GradoSitioEntregaDTO } from '../models/mainMenu.model';
import { DatabaseService } from '../services/database.service';
import { GradoSitioEntrega } from '../models/photoRecordPAE.model';

@Injectable({
  providedIn: 'root'
})
export class GradosSitioEntregaRepository {

  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  async saveGrados(grados: GradoSitioEntregaDTO[]) {
    const dateCreated = this.databaseService.getCurrentDateTime();

    const set = grados.map(grado => ({
      statement: `INSERT OR REPLACE INTO APPR_Grados_SitioEntrega (
                    idSitioEntrega, idGrado, descripcionGrado,
                    cantidadEstudiantes, dateCreated
                  ) VALUES (?, ?, ?, ?, ?)`,
      values: [
        grado.idSitioEntrega,
        grado.idGrado,
        grado.descripcionGrado,
        grado.cantidadEstudiantes,
        dateCreated
      ]
    }));

            try {
              const result = await this.db.executeSet(set);
               console.log(`Sincronización exitosa: grados procesados.`);
              return result;

            } catch (e) {
              // Si falla, el plugin hace el ROLLBACK automáticamente por ti
              console.error("Error masivo guardando grados:");
              throw e;
            }
 }

  async getGradosBySitioEntrega(idSitioEntrega: number): Promise<GradoSitioEntrega[]> {
    const result = await this.db.query(
      `SELECT idGrado, descripcionGrado
       FROM APPR_Grados_SitioEntrega
       WHERE idSitioEntrega = ?
       ORDER BY idSitioEntrega, idGrado`,
      [idSitioEntrega]
    );

    return (result.values || []) as GradoSitioEntrega[];
  }
}
