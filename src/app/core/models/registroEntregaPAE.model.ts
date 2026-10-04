export interface ColegioOption {
  label: string;
  value: string;
}

export interface SedeOption {
  label: string;
  value: string;
}

export interface SitioEntregaOption {
  label: string;
  value: number;
}

export interface RecordsDeliveryDB {
  daneColegio: string;
  daneSede: string;
  idSitioEntrega: number;
  syncedDB: number;      // 0 = no, 1 = sí
  syncDBDate?: string;
  idUser?: number;
}


//interface  para realizar lectura de registros de APPD_RegistroEntregaPAE
export interface RecordsDelivery {
  idRegistroEntrega: string;
  Fecha: string;
  Colegio: string;
  Sede: string;
  DescripcionProyecto: string;
  daneColegio: string; 
  daneSede: string;
  idSitioEntrega: number;
  syncedDB: number;      // 0 = no, 1 = sí
  syncDBDate?: string;
  idUser?: number;
}


//Interface que permite obtener registros pendientes de sincronizacion.
export interface RegistroEntregaSyncRow {
  idRegistroEntrega: string;
  Fecha: string;
  daneColegio: string;
  daneSede: string;
  idSitioEntrega: number;
  dateCreated?: string;
  idUser?: number;
}

//Interface que se convierte en la interfaz  que corresponde al DTO en banckend
export interface RegistroEntregaPayload {
  localId: string;
  fecha: string;
  daneColegio: string;
  daneSede: string;
  idSitioEntrega: number;
  dateCreated?: string;
  idUserRegistro?: number;
  deviceId: string;
 }
