import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { RegistroMatriculaDTO } from '../models/enrolarEstudiante.model';
import { DatabaseService } from '../services/database.service';

@Injectable({
  providedIn: 'root'
})
export class MatriculaRepository {
  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // Guarda o actualiza la matricula del estudiante en base local
  // Tabla : APPD_Matricula
  async saveMatricula(matricula: RegistroMatriculaDTO): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO APPD_Matricula (
        Per_ID, descripcionAbreviada, numeroDocumento, apellido1, apellido2,
        nombre1, nombre2, fechaNacimiento, genero, grado, idPersonDirectory, fechaCreacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      matricula.perID,
      matricula.descripcionAbreviada,
      matricula.numeroDocumento,
      matricula.apellido1,
      matricula.apellido2,
      matricula.nombre1,
      matricula.nombre2,
      matricula.fechaNacimiento,
      matricula.genero,
      matricula.grado,
      matricula.idPersonDirectory,
      matricula.fechaCreacion
    ];

    try {
      await this.db.run(sql, values);
      console.log(`Matricula guardada en APPD_Matricula para Per_ID: `);
    } catch (error) {
      console.error('Error guardando matricula en APPD_Matricula:');
      throw error;
    }
  }

  async getMatriculaByPerId(perID: string): Promise<RegistroMatriculaDTO | null> {
    try {
      const result = await this.db.query(
        `SELECT
          Per_ID AS perID,
          descripcionAbreviada,
          numeroDocumento,
          apellido1,
          apellido2,
          nombre1,
          nombre2,
          fechaNacimiento,
          genero,
          grado,
          idPersonDirectory,
          fechaCreacion
        FROM APPD_Matricula
        WHERE Per_ID = ?`,
        [perID]
      );

      const row = result.values?.[0];
      return row ? row as RegistroMatriculaDTO : null;
    } catch (error) {
      console.error('Error consultando matricula por Per_ID:');
      return null;
    }
  }
}
