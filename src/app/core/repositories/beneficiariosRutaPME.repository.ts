import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DetalleBeneficiarios } from '../models/detalleBeneficiarios.model';
import { DatabaseService } from '../services/database.service';

@Injectable({
  providedIn: 'root',
})
export class BeneficiariosRutaPMERepository {
  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  async replaceBeneficiariosRutaPME(idRuta: number, beneficiarios: DetalleBeneficiarios[], idUser?: number): Promise<void> {
    const dateCreated = this.databaseService.getCurrentDateTime();

    // Estrategia simple: borrar y volver a insertar (evita merges parciales y mantiene datos consistentes)
    await this.db.run('DELETE FROM APPR_BeneficiariosRutaPME WHERE idRuta = ?', [idRuta]);

    if (!beneficiarios || beneficiarios.length === 0) return;

    const statement = `
      INSERT OR REPLACE INTO APPR_BeneficiariosRutaPME (
        idRuta, perID, numeroDocumento, nombre1, nombre2, apellido1, apellido2, grado, jornadaEducativa,
        dateCreated, idUser, isState
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const set = beneficiarios.map(b => {
      return {
        statement,
        values: [
          idRuta,
          b.perID,
          b.numeroDocumento,
          b.nombre1,
          b.nombre2,
          b.apellido1,
          b.apellido2,
          b.grado,
          b.jornadaEducativa,
          dateCreated,
          idUser ?? null,
          1
        ]
      };
    });

    await this.db.executeSet(set);
  }

  async getBeneficiariosRutaPMEByRutaId(idRuta: number): Promise<DetalleBeneficiarios[]> {
    const sql = `
      SELECT perID, numeroDocumento, nombre1, nombre2, apellido1, apellido2, grado, jornadaEducativa
      FROM APPR_BeneficiariosRutaPME
      WHERE idRuta = ?
      ORDER BY apellido1 ASC, apellido2 ASC, nombre1 ASC, nombre2 ASC`;

    try {
      const res = await this.db.query(sql, [idRuta]);
      const rows = res.values ?? [];
      return rows.map((r: any) => ({
        perID: String(r.perID ?? ''),
        numeroDocumento: String(r.numeroDocumento ?? ''),
        nombre1: String(r.nombre1 ?? ''),
        nombre2: String(r.nombre2 ?? ''),
        apellido1: String(r.apellido1 ?? ''),
        apellido2: String(r.apellido2 ?? ''),
        grado: String(r.grado ?? ''),
        jornadaEducativa: Number(r.jornadaEducativa ?? 0)
      }));
    } catch (error) {
      console.error('Error al obtener beneficiarios por ruta PME:', error);
      return [];
    }
  }
}
