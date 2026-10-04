import { Injectable } from '@angular/core';
import { DatabaseService } from '../services/database.service';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { SitioEntregaPAEDTO} from '../models/mainMenu.model';
import { SitioEntregaOption } from '../models/registroEntregaPAE.model';

@Injectable({
  providedIn: 'root'
})
export class SitiosEntregaRepository {

  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
  return this.databaseService.getDatabase();
 }
    async saveSitiosEntrega(sitios: SitioEntregaPAEDTO[]) {
          const dateCreated = this.databaseService.getCurrentDateTime();

              const set = sitios.map(sitio => ({
              statement: `INSERT OR REPLACE INTO APPR_Sitios_EntregaPAE (
                            idSitioEntrega, daneColegio, daneSede, tipoDeEntrega, 
                            descripcionProyectoInversion, dateCreated
                          ) VALUES (?, ?, ?, ?, ?, ?)`,
              values: [
                sitio.idSitioEntrega,
                sitio.daneColegio,
                sitio.daneSede,
                sitio.tipoDeEntrega,
                sitio.descripcionProyectoInversion,
                dateCreated
              ]
            }));

            try {
              const result = await this.db.executeSet(set);
               console.log(`Sincronización exitosa: sitios de entrega procesados.`);
              return result;

            } catch (e) {
              // Si falla, el plugin hace el ROLLBACK automáticamente por ti
              console.error("Error masivo guardando sitios de entrega:");
              throw e;
            }
        }
  
  async getSitiosEntregaOptionsBySede(daneSede: string): Promise<SitioEntregaOption[]> {
    const result = await this.db.query('SELECT descripcionProyectoInversion, idSitioEntrega FROM APPR_Sitios_EntregaPAE WHERE daneSede = ?', [daneSede]);
    const rows = result.values || [];
    return rows.map((se: any) => ({ label: se.descripcionProyectoInversion, value: se.idSitioEntrega }));
  }

}