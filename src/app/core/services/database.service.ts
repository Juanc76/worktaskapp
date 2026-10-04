import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';



@Injectable({ providedIn: 'root' })
export class DatabaseService {
   
    private sqlite: SQLiteConnection;
    private db!: SQLiteDBConnection;
    private initPromise: Promise<void> | null = null;

    private readonly dbName = 'appRecognition_db';
    private readonly dbVersion = 1;
    private readonly isReadOnly = false;

      constructor() {
        this.sqlite = new SQLiteConnection(CapacitorSQLite);
      }

      async init() {
      if (this.initPromise) return this.initPromise;
      this.initPromise = this.initializeDatabase().catch((err) => {
        this.initPromise = null;
        throw err;
      });
      return this.initPromise;
      }

  getDatabase(): SQLiteDBConnection {
    if (!this.db) {
      throw new Error("La base de datos no ha sido inicializada. Llame primero a init()");
    }
    return this.db;
  }
  // Inicializa la base de datos, crea las tablas que no existen y demas configuraciones requeridas
  async initializeDatabase(): Promise<void> {
     try {

      const connectionExists = await this.sqlite.isConnection(
        this.dbName,
        false
      );

      if (connectionExists.result) {

        this.db = await this.sqlite.retrieveConnection(
          this.dbName,
          false
        );

      } else {

        this.db = await this.sqlite.createConnection(
          this.dbName,
          false,
          "no-encryption",
          this.dbVersion,
          this.isReadOnly
        );

      }
    
      await this.db.open();


       // Crear tabla de registro de entregasPAE  
      const createTableRegistroEntrega = `
      CREATE TABLE IF NOT EXISTS APPD_RegistroEntregaPAE (
        idRegistroEntrega TEXT NOT NULL UNIQUE,
        Fecha TEXT NOT NULL,
        daneColegio TEXT NOT NULL,
        daneSede  TEXT NOT NULL,
        idSitioEntrega  INTEGER NOT NULL,
        dateCreated TEXT,
        syncedDB  INTEGER,
        syncDBDate  TEXT,
        idUser  INTEGER,
        FOREIGN KEY(idSitioEntrega) REFERENCES APPR_Sitios_EntregaPAE(idSitioEntrega)
       )`;

      // Crear tabla de registro de fotos para Sitios de Entrea PAE
      const createTablePhotosPAE = `
      CREATE TABLE IF NOT EXISTS APPD_PhotosPAE (
        idPhoto TEXT NOT NULL UNIQUE,
        idRegistroEntrega TEXT,
        filePath  TEXT,
        fileName  TEXT,
        url TEXT,
        date  TEXT,
        latitud REAL,
        longitud  REAL,
        daneColegio TEXT,
        daneSede  TEXT,
        IdSitioEntrega  INTEGER,
        dateCreated TEXT,
        syncedPhoto INTEGER,
        syncPhotoDate TEXT,
        deletedPhoto INTEGER,
        syncedDB  INTEGER,
        syncDBDate  TEXT,
        deleteRegistro INTEGER,
        deleteRegistroDate  TEXT,
        idUser  INTEGER,
        faceVector TEXT,
        FOREIGN KEY(idRegistroEntrega) REFERENCES  APPD_RegistroEntregaPAE(idRegistroEntrega)
        );`;


            // Crear tabla de registro de servicios PME
      const createTableRegistroServicioPME = 
      `CREATE TABLE IF NOT EXISTS APPD_RegistroServicioPME (
        idRegistroServicio TEXT NOT NULL UNIQUE,
        Fecha	TEXT NOT NULL,
        idRuta	INTEGER,
        rutaEscolar	TEXT NOT NULL,
        recorrido	TEXT NOT NULL,
        dateCreated	TEXT,
        syncedDB	INTEGER,
        syncDBDate	TEXT,
        idUser	INTEGER,
        FOREIGN KEY(idRuta) REFERENCES APPR_Rutas_Escolares(idRuta)
      )`;


         // Crear tabla de registro de fotos para Sitios de Entrea PME
      const createTablePhotosPME = `
      CREATE TABLE IF NOT EXISTS APPD_PhotosPME (
        idPhoto TEXT NOT NULL UNIQUE,
        idRegistroServicio	TEXT,
        filePath	TEXT,
        fileName	TEXT,
        url	TEXT,
        date	TEXT,
        latitud	REAL,
        longitud	REAL,
        rutaEscolar	TEXT,
        recorrido	TEXT,
        dateCreated	TEXT,
        syncedPhoto	INTEGER,
        syncPhotoDate	TEXT,
        deletedPhoto	INTEGER,
        syncedDB	INTEGER,
        syncDBDate	TEXT,
        deleteRegistro INTEGER,
        deleteRegistroDate  TEXT,
        idUser	INTEGER,
        FOREIGN KEY(idRegistroServicio) REFERENCES APPD_RegistroServicioPME(idRegistroServicio)
        );`;

      // Crear tabla de registro de logs de fotos
      const createTableLogs = `
      CREATE TABLE IF NOT EXISTS sync_logs (
        idLogs INTEGER PRIMARY KEY AUTOINCREMENT,
        idPhoto TEXT,          -- ID de la foto en la tabla photos
        photoName TEXT,        -- nombre del archivo de la foto   
        status TEXT,           -- 'SUCCESS' o 'ERROR'
        message TEXT,          -- detalle del error o confirmación
        tabla TEXT,            -- tabla a la que pertenece la foto (photosPAE o photosPME)
        createdAt TEXT,        -- fecha/hora del log 
        syncedDB INTEGER,      -- 0 = no sincronizado con DB remota, 1 = sincronizado con DB remota
        syncDBDate TEXT       -- fecha/hora de sincronización con DB remota
        
        );` ;



      // Crear tabla de colegios 
      const createTableColegios = `
      CREATE TABLE IF NOT EXISTS APPR_Colegios (
        idAsignacion INTEGER ,
        daneColegio TEXT PRIMARY KEY,
        nombreColegio TEXT,
        idLocalidad INTEGER,
        idColegio INTEGER,
        idUser INTEGER,
        isState INTEGER,
        dateCreated	TEXT
      );` ; 

       // Crear tabla de sedes
      const createTableSedes = `
      CREATE TABLE IF NOT EXISTS APPR_Sedes_Educativas (
        idAsignacion INTEGER,
        daneColegio TEXT,
        daneSede TEXT PRIMARY KEY,
        consecutivoSede TEXT,
        nombreSede TEXT,
        idLocalidad INTEGER,
        idSede INTEGER,
        idUser INTEGER,
        isState INTEGER,
        dateCreated	TEXT
       );`;

       // Crear tabla sitios de entrega  
      const createTableSitiosEntrega = `
      CREATE TABLE IF NOT EXISTS APPR_Sitios_EntregaPAE (
        idSitioEntrega INTEGER PRIMARY KEY,
        daneColegio TEXT,
        daneSede TEXT,
        tipoDeEntrega TEXT,
        descripcionProyectoInversion TEXT,
        dateCreated	TEXT
      );`;

      // Crear tabla de grados por sitio de entrega
      const createTableGradosSitioEntrega = `
      CREATE TABLE IF NOT EXISTS APPR_Grados_SitioEntrega (
        idSitioEntrega INTEGER NOT NULL,
        idGrado TEXT NOT NULL,
        descripcionGrado TEXT,
        cantidadEstudiantes INTEGER,
        dateCreated TEXT,
        PRIMARY KEY (idSitioEntrega, idGrado)
      );`;

      // Crear tabla rutas  
      const createTableRutas = `
      CREATE TABLE IF NOT EXISTS APPR_Rutas_Escolares (
        idAsignacion INTEGER,
        idRuta INTEGER PRIMARY KEY,
        numeroRuta TEXT,
        descripcion TEXT,
        idUser TEXT,
        isState INTEGER,
        dateCreated	TEXT
      );`;

      // Crear tabla de detalle de ruta PME (campos usados en DetalleRuta)
      const createTableDetalleRutaPME = `
      CREATE TABLE IF NOT EXISTS APPR_Detalle_RutasPME (
        idRuta INTEGER PRIMARY KEY,
        rutaEscolar TEXT,
        localidad TEXT,
        segmentoGeografico TEXT,
        tipoRuta TEXT,
        tipologiaRuta TEXT,
        zonaOperacion TEXT,
        movilidadReducida INTEGER,
        daneColegio TEXT,
        nombreColegio TEXT,
        sedeEducativa TEXT,
        jornadaEducativa TEXT,
        inicioRecorrido1 TEXT,
        inicioJornada TEXT,
        finJornada TEXT,
        inicioRecorrido2 TEXT,
        horasRecorrido1 REAL,
        horasRecorrido2 REAL,
        operaLunes INTEGER,
        operaMartes INTEGER,
        operaMiercoles INTEGER,
        operaJueves INTEGER,
        operaViernes INTEGER,
        operaSabado INTEGER,
        operaDomingo INTEGER,
        estadoRuta TEXT,
        dateCreated TEXT,
        idUser INTEGER,
        isState INTEGER,
        FOREIGN KEY(idRuta) REFERENCES APPR_Rutas_Escolares(idRuta)
      )`;

      // Crear tabla de beneficiarios por ruta PME
      const createTableBeneficiariosRutaPME = `
      CREATE TABLE IF NOT EXISTS APPR_BeneficiariosRutaPME (
        idRuta INTEGER NOT NULL,
        perID TEXT NOT NULL,
        numeroDocumento TEXT,
        nombre1 TEXT,
        nombre2 TEXT,
        apellido1 TEXT,
        apellido2 TEXT,
        grado TEXT,
        jornadaEducativa INTEGER,
        dateCreated TEXT,
        idUser INTEGER,
        isState INTEGER,
        PRIMARY KEY (idRuta, perID),
        FOREIGN KEY(idRuta) REFERENCES APPR_Rutas_Escolares(idRuta)
      )`;

      // Crear tabla de matriculas de estudiantes enrolados
      const createTableMatricula = `
      CREATE TABLE IF NOT EXISTS APPD_Matricula (
        Per_ID TEXT PRIMARY KEY,
        descripcionAbreviada TEXT,
        numeroDocumento TEXT,
        apellido1 TEXT,
        apellido2 TEXT,
        nombre1 TEXT,
        nombre2 TEXT,
        fechaNacimiento TEXT,
        genero TEXT,
        grado TEXT,
        idPersonDirectory TEXT,
        fechaCreacion TEXT
      )`;

      // Crear tabla de vectores faciales por estudiante
      const createTableVectores = `
      CREATE TABLE IF NOT EXISTS APPD_Vectores (
        Per_ID TEXT,
        face_embedding TEXT,
        FOREIGN KEY(Per_ID) REFERENCES APPD_Matricula(Per_ID)
      )`;

      
      // Crear tabla soporte de vectores promedio por estudiante
      const createTableVectoresPromedio = `
      CREATE TABLE IF NOT EXISTS APPD_VectoresPromedio (
        Per_ID TEXT PRIMARY KEY,
        face_embedding TEXT,
        cantidadVectores INTEGER,
        FOREIGN KEY(Per_ID) REFERENCES APPD_Matricula(Per_ID)
      )`;

     

  
      // Crear tabla de registro de trazado de ruta PME
      const createTrazadoRutaPME = 
      `CREATE TABLE IF NOT EXISTS APPD_RegistroTrazadoRutaPME (
        idTrazado TEXT NOT NULL UNIQUE,
        FechaStart TEXT,
        idRuta INTEGER ,
        rutaEscolar TEXT NOT NULL,
        recorrido TEXT NOT NULL,
        FechaEnd TEXT, 
        distanciaAcumulada INTEGER,
        tiempoAcumulado REAL,
        velocidadMedia REAL,
        mapUrl TEXT,
        syncedDB INTEGER,
        syncDBDate TEXT,
        synTotal INTEGER,
        syncTotalDate TEXT,
        idUser INTEGER,
        FOREIGN KEY(idRuta) REFERENCES APPR_Rutas_Escolares(idRuta)
      )`;
      
       // Crear tabla de registro de ubicaciones de trazado de ruta PME
      const createTableLocationRutaPME = 
      `CREATE TABLE IF NOT EXISTS APPD_RegistroLocationRutaPME (
        idRegistro TEXT NOT NULL UNIQUE,
        idTrazado TEXT NOT NULL,
        fechaGps TEXT,
        latitud REAL,
        longitud REAL,
        altitud REAL,
        velocidad REAL,
        accuracy REAL,
        procesado_ui INTEGER DEFAULT 0, -- 0 = no procesado por UI, 1 = procesado por UI
        fechaRegistro TEXT,
        syncedDB INTEGER,
        syncDBDate TEXT,
        idUser INTEGER,
        FOREIGN KEY(idTrazado) REFERENCES APPD_RegistroTrazadoRutaPME(idTrazado)
      )`;

      const createTableactiveTracking = 
      `CREATE TABLE IF NOT EXISTS active_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idTrazado TEXT NOT NULL,
        activo INTEGER NOT NULL,
        distanciaAcumulada INTEGER NOT NULL,
        tiempoAcumulado INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );`;

      const createTableparaderos = 
      `CREATE TABLE IF NOT EXISTS APPR_ParaderosPorRuta (
      idParadero INTEGER PRIMARY KEY,
      idRuta INTEGER,
      nombreParadero TEXT NOT NULL,
      descripcion TEXT,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      ordenVisita INTEGER, -- Para saber cuál es el 1ero, 2do, etc.
      FOREIGN KEY(idRuta) REFERENCES APPR_Rutas_Escolares(idRuta)
      );`;

      const createTablevistaparaderos =
      `CREATE TABLE IF NOT EXISTS APPD_ControlVisitaParaderos (
      idRegistro INTEGER PRIMARY KEY AUTOINCREMENT,
      idTrazado TEXT,
      idParadero INTEGER,
      fechaVisita TEXT, -- La hora exacta (ISO string) del paso
      latitudGps REAL,  -- La latitud real reportada por el GPS al marcar
      longitudGps REAL, -- La longitud real reportada por el GPS al marcar
      desfaseMetros REAL, -- La diferencia en metros entre la ubicación del paradero y la ubicación del GPS al marcar
      FOREIGN KEY(idTrazado) REFERENCES APPD_RegistroTrazadoRutaPME(idTrazado),
      FOREIGN KEY(idParadero) REFERENCES APPR_ParaderosPorRuta(idParadero)
      );`;

        const schema = `
        ${createTablePhotosPAE};
        ${createTablePhotosPME};
        ${createTableLogs};
        ${createTableRegistroEntrega};
        ${createTableSitiosEntrega};
        ${createTableGradosSitioEntrega};
        ${createTableColegios};
        ${createTableSedes};
        ${createTableRutas};
        ${createTableDetalleRutaPME};
        ${createTableBeneficiariosRutaPME};
        ${createTableMatricula};
        ${createTableVectores};
        ${createTableVectoresPromedio};
        ${createTableRegistroServicioPME};
        ${createTrazadoRutaPME};
        ${createTableLocationRutaPME};
        ${createTableactiveTracking};
        ${createTableparaderos};
        ${createTablevistaparaderos};
        `;
        await this.db.execute(schema);
       
    } catch (error) {
      console.error("Error inicializando SQLite");
      throw error;
    }
  
  }


    private async getTableInfo(tableName: string): Promise<any[]> {
    const result = await this.db.query(`PRAGMA table_info(${tableName})`);
    return result.values ?? [];
  }

          // Agrega log de sincronización, cuando se sube una foto al blob storage
          // Tabla : sync_logs
          async addLog(photoId: string | number, photoName: string, status: 'SUCCESS' | 'ERROR', message: string, tabla: string) {
          const dateCreated = this.getCurrentDateTime();  
  
          await this.db.run(
              `INSERT INTO sync_logs (idPhoto, photoName, status, message, tabla, createdAt) 
              VALUES (?, ?, ?, ?, ?, ?)`,
              [photoId, photoName, status, message, tabla, dateCreated]
          );
          }
  
          // Obtiene los últimos registros  de logs de sincronización
          // Tabla : sync_logs
          async getLogs(limit: number = 100) {
          const result = await this.db.query(`SELECT * FROM sync_logs ORDER BY createdAt DESC LIMIT ?`, [limit]);
          return result.values ?? [];
          }
  
        // Consultar registros Generico
        // Utilizado para consultar colegios, sedes, sitios de entrega y rutas
        async select(table: string, where?: string, params?: any[]): Promise<any[]> {
          let sql = `SELECT * FROM ${table}`;
          if (where) {
            sql += ` WHERE ${where}`;
          }
          const result = await this.db.query(sql, params);
          return result.values || [];
        }



public getCurrentDateTime(): string {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };

    // Formatear la fecha en formato ISO con la zona horaria especificada
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    const formattedDate = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}T${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`;

    return formattedDate;
  }
}

