export interface PhotoRecordPAE {
  idPhoto?: string;
  idRegistroEntrega: string; 
  filePath: string;        
  fileName: string;          
  url: string;             
  date: string;            
  latitud?: number;       
  longitud?: number;      
  daneColegio: string;
  daneSede: string;
  IdSitioEntrega: number;
  syncedPhoto: number;          
  syncPhotoDate?: string;       
  deletedPhoto: number;       
  syncedDB: number;      
  syncDBDate?: string;    
  deleteRegistro: number;
  idUser?: number;
  faceVector?: string; 
}

export interface PhotoRecordPAESummary {
  totalFotos: number;
  sincronizadas: number;
  pendientes: number;
}

export interface GradoSitioEntrega {
  label: string;
  value: number;
}

export interface SelectedGrado {
  label: string;
  value: number;
}

export const DEFAULT_SELECTED_GRADOS: SelectedGrado[] = [
  { label: 'Primero', value: 1 },
  { label: 'Segundo', value: 2 },
  { label: 'Tercero', value: 3 },
  { label: 'Cuarto', value: 4 },
  { label: 'Quinto', value: 5 },
  { label: 'Sexto', value: 6 }
];


export interface PhotoPAESyncRow {
  idPhoto: string;
  idRegistroEntrega: string;
  filePath: string;
  fileName: string;
  url: string;
  date: string;
  latitud?: number;
  longitud?: number;
  daneColegio: string;
  daneSede: string;
  IdSitioEntrega: number;
  dateCreated?: string;
  syncedPhoto: number;
  syncPhotoDate?: string;
  deletedPhoto: number;
  deleteRegistro: number;
  deleteRegistroDate?: string;
  faceVector?: string;
  idUser?: number;
}

export interface PhotoPAEPayload {
  localId: string;
  idRegistroEntregaLocal: string;
  filePath: string;
  fileName: string;
  url: string;
  photoDate: string;
  latitud?: number;
  longitud?: number;
  daneColegio: string;
  daneSede: string;
  idSitioEntrega: number;
  dateCreated?: string;
  syncedPhoto: number;
  syncPhotoDate?: string;
  deletedPhoto: number;
  faceVector?: string;
  idUserRegistro?: number;
  deviceId: string;
}
