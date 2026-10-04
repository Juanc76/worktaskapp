import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { ActiveTracking } from '../models/tracking.model';
import { DatabaseService } from '../services/database.service';

@Injectable({
  providedIn: 'root',
})
export class ActiveTrackingRepository {
  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  async saveActiveTracking(data: ActiveTracking): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO active_tracking (idTrazado, activo, distanciaAcumulada, tiempoAcumulado, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `;

    const params = [
      data.idTrazado,
      data.activo ? 1 : 0,
      data.distanciaAcumulada,
      data.tiempoAcumulado,
      new Date().toISOString(),
    ];

    await this.db.run(sql, params);
  }

  async getActiveTracking(): Promise<ActiveTracking | null> {
    const sql = `
      SELECT idTrazado, activo, distanciaAcumulada, tiempoAcumulado
      FROM active_tracking
      WHERE activo = 1
    `;

    const res = await this.db.query(sql);

    if (res.values && res.values.length > 0) {
      return {
        idTrazado: res.values[0].idTrazado,
        activo: res.values[0].activo === 1,
        distanciaAcumulada: res.values[0].distanciaAcumulada,
        tiempoAcumulado: res.values[0].tiempoAcumulado,
      };
    }

    return null;
  }

  async updateActiveTracking(idTrazado: string, distanciaAcumulada: number, tiempoAcumulado: number): Promise<void> {
    const sql = `
      UPDATE active_tracking
      SET distanciaAcumulada = ?, tiempoAcumulado = ?, updatedAt = ?
      WHERE idTrazado = ? AND activo = 1
    `;

    const params = [
      distanciaAcumulada,
      tiempoAcumulado,
      new Date().toISOString(),
      idTrazado
    ];

    try {
      const result = await this.db.run(sql, params);
      if (!result.changes) {
        console.warn(`No se encontró un registro activo para idTrazado: ${idTrazado}`);
      } else {
        console.log(`Registro actualizado en active_tracking para idTrazado: ${idTrazado}`);
      }
    } catch (error) {
      console.error('Error al actualizar active_tracking:', error);
      throw error;
    }
  }

  async deleteActiveTrackingByIdTrazado(idTrazado: string): Promise<void> {
    const sql = `
      DELETE FROM active_tracking
      WHERE idTrazado = ?`;

    const params = [idTrazado];

    try {
      const result = await this.db.run(sql, params);
      if (!result.changes) {
        console.warn(`No se encontraron registros para eliminar con idTrazado: ${idTrazado}`);
      } else {
        console.log(`Todos los registros para idTrazado: ${idTrazado} han sido eliminados.`);
      }
    } catch (error) {
      console.error('Error al eliminar registros en active_tracking:', error);
      throw error;
    }
  }
}
