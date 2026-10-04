import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DetalleRuta } from '../models/detalleRuta.model';
import { DatabaseService } from '../services/database.service';

@Injectable({
  providedIn: 'root',
})
export class DetalleRutaPMERepository {
  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // ======================
  // PME - Detalle Ruta
  // ======================
  async upsertDetalleRutaPME(detalle: DetalleRuta, idUser?: number): Promise<void> {
    const dateCreated = this.databaseService.getCurrentDateTime();
    const sql = `
      INSERT OR REPLACE INTO APPR_Detalle_RutasPME (
        idRuta, rutaEscolar, localidad, segmentoGeografico, tipoRuta, tipologiaRuta, zonaOperacion,
        movilidadReducida, daneColegio, nombreColegio, sedeEducativa, jornadaEducativa,
        inicioRecorrido1, inicioJornada, finJornada, inicioRecorrido2,
        horasRecorrido1, horasRecorrido2,
        operaLunes, operaMartes, operaMiercoles, operaJueves, operaViernes, operaSabado, operaDomingo,
        estadoRuta, dateCreated, idUser, isState
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )`;

    const values = [
      detalle.idRuta,
      detalle.rutaEscolar,
      detalle.localidad,
      detalle.segmentoGeografico,
      detalle.tipoRuta,
      detalle.tipologiaRuta,
      detalle.zonaOperacion,
      detalle.movilidadReducida ? 1 : 0,
      detalle.daneColegio,
      detalle.nombreColegio,
      detalle.sedeEducativa,
      detalle.jornadaEducativa,
      detalle.inicioRecorrido1,
      detalle.inicioJornada,
      detalle.finJornada,
      detalle.inicioRecorrido2,
      detalle.horasRecorrido1,
      detalle.horasRecorrido2,
      detalle.operaLunes ? 1 : 0,
      detalle.operaMartes ? 1 : 0,
      detalle.operaMiercoles ? 1 : 0,
      detalle.operaJueves ? 1 : 0,
      detalle.operaViernes ? 1 : 0,
      detalle.operaSabado ? 1 : 0,
      detalle.operaDomingo ? 1 : 0,
      detalle.estadoRuta,
      dateCreated,
      idUser ?? null,
      1
    ];

    await this.db.run(sql, values);
  }

  async getDetalleRutaPMEByRutaId(idRuta: number): Promise<DetalleRuta | null> {
    const sql = `
      SELECT *
      FROM APPR_Detalle_RutasPME
      WHERE idRuta = ?
      LIMIT 1`;

    try {
      const res = await this.db.query(sql, [idRuta]);
      const row = res.values?.[0];
      if (!row) return null;

      const detalle: DetalleRuta = {
        idRuta: Number(row.idRuta),
        rutaEscolar: row.rutaEscolar ?? '',
        localidad: row.localidad ?? '',
        segmentoGeografico: row.segmentoGeografico ?? '',
        tipoRuta: row.tipoRuta ?? '',
        tipologiaRuta: row.tipologiaRuta ?? '',
        zonaOperacion: row.zonaOperacion ?? '',
        movilidadReducida: Number(row.movilidadReducida) === 1,
        daneColegio: row.daneColegio ?? '',
        nombreColegio: row.nombreColegio ?? '',
        sedeEducativa: row.sedeEducativa ?? '',
        jornadaEducativa: row.jornadaEducativa ?? '',
        inicioRecorrido1: row.inicioRecorrido1 ?? '',
        inicioJornada: row.inicioJornada ?? '',
        finJornada: row.finJornada ?? '',
        inicioRecorrido2: row.inicioRecorrido2 ?? '',
        horasRecorrido1: Number(row.horasRecorrido1 ?? 0),
        horasRecorrido2: Number(row.horasRecorrido2 ?? 0),
        operaLunes: Number(row.operaLunes) === 1,
        operaMartes: Number(row.operaMartes) === 1,
        operaMiercoles: Number(row.operaMiercoles) === 1,
        operaJueves: Number(row.operaJueves) === 1,
        operaViernes: Number(row.operaViernes) === 1,
        operaSabado: Number(row.operaSabado) === 1,
        operaDomingo: Number(row.operaDomingo) === 1,
        estadoRuta: row.estadoRuta ?? ''
      };

      return detalle;
    } catch (error) {
      console.error('Error al obtener detalle de ruta PME:', error);
      return null;
    }
  }
}
