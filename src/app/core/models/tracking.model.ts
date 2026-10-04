export interface RegistroTrazadoRutaPMEBD {
  idTrazado?: string;
  idRuta: number;
  rutaEscolar: string;
  recorrido: string; 
  FechaStart: string;
  FechaEnd: string;
  distanciaAcumulada: number;
  tiempoAcumulado: number;
  velocidadMedia: number;
  mapUrl?: string;
  syncedDB?: number;
  syncDBDate?: string;
  synTotal?: number;
  syncTotalDate?: string;
  idUser?: number;
}


export interface RegistroTrazadoRutaPME {
  recorrido: string; 
  FechaStart: string;
  FechaEnd: string;
  distanciaAcumulada: number;
  tiempoAcumulado: number;
  velocidadMedia: number;
  mapUrl?: string;
  syncedDB?: number;
  synTotal?: number;
  syncTotalDate?: string;
  idTrazado: string;
 }


export interface RegistroLocationRutaPME {
  idRegistro?: string;
  idTrazado: string;
  fechaGps: string;
  latitud: number;
  longitud: number;
  altitud?: number | null;
  velocidad: number;
  accuracy: number;
  procesado_ui?: number;
  fechaRegistro: string;
  syncedDB?: number;
  syncDBDate?: string;
  idUser?: number;
}

export interface RegistroTrazadoRutaPMEPayload {
  localId: string;
  idRuta: number;
  rutaEscolar: string;
  recorrido: string;
  fechaStart: string;
  fechaEnd: string;
  distanciaAcumulada: number;
  tiempoAcumulado: number;
  velocidadMedia: number;
  mapUrl?: string;
  idUserRegistro?: number;
  deviceId: string;
}

export interface RegistroLocationRutaPMEPayload {
  localId: string;
  idTrazadoLocal: string;
  fechaGps: string;
  latitud: number;
  longitud: number;
  altitud?: number | null;
  velocidad: number;
  accuracy: number;
  fechaRegistro: string;
  idUserRegistro?: number;
  deviceId: string;
}

export interface LocationRutaPME {
  idTrazado: string;
  Fecha: string;
  latitud: number;
  longitud: number;
  altitud?: number | null;
 }


export interface RutaEscolar {
  key: number;
  label: string;
}

export interface ActiveTracking {
  idTrazado: string;
  activo: boolean;
  distanciaAcumulada: number;
  tiempoAcumulado: number;
}

export interface TrackingState {   
    active:boolean;
    paused: boolean;
    trazado: RegistroTrazadoRutaPMEBD | null;
    duration: number;
    distance: number;
    speedMedia: number;
}





