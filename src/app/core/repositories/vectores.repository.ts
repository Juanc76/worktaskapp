import { Injectable } from '@angular/core';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { DatabaseService } from '../services/database.service';

export interface VectorRegistro {
  perID: string;
  faceEmbedding: string;
}

@Injectable({
  providedIn: 'root'
})
export class VectoresRepository {
  constructor(private databaseService: DatabaseService) {}

  private get db(): SQLiteDBConnection {
    return this.databaseService.getDatabase();
  }

  // Guarda el vector facial del estudiante en base local
  // Tabla : APPD_Vectores
  async saveVector(perID: string, faceEmbedding: number[] | string): Promise<void> {
    const sql = `
      INSERT INTO APPD_Vectores (
        Per_ID, face_embedding
      ) VALUES (?, ?)`;

    const embeddingValue = Array.isArray(faceEmbedding)
      ? JSON.stringify(faceEmbedding)
      : faceEmbedding;

    try {
      await this.db.run(sql, [perID, embeddingValue]);
      console.log(`Vector guardado en APPD_Vectores para Per_ID: `);
    } catch (error) {
      console.error('Error guardando vector en APPD_Vectores:');
      throw error;
    }
  }

  async getVectorsByPerId(perID: string): Promise<string[]> {
    try {
      const result = await this.db.query(
        'SELECT face_embedding FROM APPD_Vectores WHERE Per_ID = ?',
        [perID]
      );

      return (result.values ?? []).map((row: any) => row.face_embedding as string);
    } catch (error) {
      console.error('Error consultando vector por Per_ID:');
      return [];
    }
  }

  async rebuildVectorPromedios(): Promise<void> {
    try {
      const result = await this.db.query(
        `SELECT Per_ID AS perID, face_embedding AS faceEmbedding
        FROM APPD_Vectores
        WHERE face_embedding IS NOT NULL
        ORDER BY Per_ID`
      );

      const rows = (result.values ?? []) as VectorRegistro[];
      const grupos = new Map<string, number[][]>();

      for (const row of rows) {
        const vector = this.parseEmbedding(row.faceEmbedding);
        if (!vector) continue;

        const actuales = grupos.get(row.perID) ?? [];
        actuales.push(vector);
        grupos.set(row.perID, actuales);
      }

      await this.db.run('DELETE FROM APPD_VectoresPromedio');

      const set = Array.from(grupos.entries())
        .map(([perID, vectores]) => {
          const promedio = this.calcularVectorPromedio(vectores);
          if (!promedio) return null;

          return {
            statement: `INSERT OR REPLACE INTO APPD_VectoresPromedio (
              Per_ID, face_embedding, cantidadVectores
            ) VALUES (?, ?, ?)`,
            values: [perID, JSON.stringify(promedio), vectores.length]
          };
        })
        .filter((item): item is { statement: string; values: any[] } => item !== null);

      if (set.length > 0) {
        await this.db.executeSet(set);
      }
    } catch (error) {
      console.error('Error reconstruyendo vectores promedio:');
      throw error;
    }
  }

  async getVectorPromedios(): Promise<VectorRegistro[]> {
    try {
      const result = await this.db.query(
        `SELECT Per_ID AS perID, face_embedding AS faceEmbedding
        FROM APPD_VectoresPromedio
        WHERE face_embedding IS NOT NULL`
      );

      return (result.values ?? []) as VectorRegistro[];
    } catch (error) {
      console.error('Error consultando vectores promedio:');
      return [];
    }
  }

  private parseEmbedding(faceEmbedding: string): number[] | null {
    try {
      const vector = JSON.parse(faceEmbedding);
      return Array.isArray(vector) ? vector.map(Number) : null;
    } catch {
      return null;
    }
  }

  private calcularVectorPromedio(vectores: number[][]): number[] | null {
    const primerVector = vectores[0];
    if (!primerVector || primerVector.length === 0) return null;

    const vectoresValidos = vectores.filter(v => v.length === primerVector.length);
    if (vectoresValidos.length === 0) return null;

    const promedio = new Array(primerVector.length).fill(0);
    for (const vector of vectoresValidos) {
      for (let i = 0; i < vector.length; i++) {
        promedio[i] += vector[i];
      }
    }

    for (let i = 0; i < promedio.length; i++) {
      promedio[i] = promedio[i] / vectoresValidos.length;
    }

    return this.normalizarVector(promedio);
  }

  private normalizarVector(vector: number[]): number[] {
    let sumaCuadrados = 0;
    for (let i = 0; i < vector.length; i++) {
      sumaCuadrados += vector[i] * vector[i];
    }

    const magnitud = Math.sqrt(sumaCuadrados);
    if (magnitud === 0) return vector;

    return vector.map(value => value / magnitud);
  }
}
