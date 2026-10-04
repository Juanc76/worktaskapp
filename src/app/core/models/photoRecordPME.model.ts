
export interface PhotoRecordPME {
  idPhoto?: string;
  idRegistroServicio: string; 
  filePath: string;         
  fileName: string;            
  url: string;             
  date: string;            
  latitud?: number;       
  longitud?: number;      
  rutaEscolar: string;
  recorrido: string;
  syncedPhoto: number;     
  syncPhotoDate?: string;   
  deletedPhoto: number;    
  syncedDB: number;        
  syncDBDate?: string;      
  deleteRegistro: number;  
  idUser?: number;
}

export interface PhotoRecordPMESummary {
  totalFotos: number;
  sincronizadas: number;
  pendientes: number;
}

export interface PhotoPMESyncRow {
  idPhoto: string;
  idRegistroServicio: string;
  filePath: string;
  fileName: string;
  url: string;
  date: string;
  latitud?: number;
  longitud?: number;
  rutaEscolar: string;
  recorrido: string;
  dateCreated?: string;
  syncedPhoto: number;
  syncPhotoDate?: string;
  deletedPhoto: number;
  deleteRegistro: number;
  deleteRegistroDate?: string;
  idUser?: number;
}

export interface PhotoPMEPayload {
  localId: string;
  idRegistroServicioLocal: string;
  filePath: string;
  fileName: string;
  url: string;
  photoDate: string;
  latitud?: number;
  longitud?: number;
  rutaEscolar: string;
  recorrido: string;
  dateCreated?: string;
  syncedPhoto: number;
  syncPhotoDate?: string;
  deletedPhoto: number;
  idUserRegistro?: number;
  deviceId: string;
}

