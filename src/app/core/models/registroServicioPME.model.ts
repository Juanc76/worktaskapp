export interface RecordsServiceDB {
  idRuta: number;
  rutaEscolar: string;
  recorrido: string;
  syncedDB?: number;
  syncDBDate?: string;
  idUser?: number;
}

export interface RecordsService {
  idRegistroServicio: string;
  Fecha: string;
  idRuta: number;
  numeroRuta: string;
  recorrido: string;
  dateCreated: string;
  syncedDB: number;      // 0 = no, 1 = sí
  syncDBDate?: string;
  idUser?: number;
}

export interface RutaEscolar {
  key: number;
  label: string;
}

export interface RegistroServicioSyncRow {
  idRegistroServicio: string;
  Fecha: string;
  idRuta: number;
  rutaEscolar: string;
  recorrido: string;
  dateCreated?: string;
  idUser?: number;
}

export interface RegistroServicioPayload {
  localId: string;
  fecha: string;
  idRuta: number;
  rutaEscolar: string;
  recorrido: string;
  dateCreated?: string;
  idUserRegistro?: number;
  deviceId: string;
}


