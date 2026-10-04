export interface SitioEntregaPAEDTO {
  idSitioEntrega: number;
  daneColegio: string;
  daneSede: string;
  tipoDeEntrega: string;
  descripcionProyectoInversion: string;
}

export interface GradoSitioEntregaDTO {
  idSitioEntrega: number;
  idGrado: string;
  descripcionGrado: string;
  cantidadEstudiantes: number;
}

export interface SedeByColegioDTO {
  idAsignacion: number;
  fechaCreacion?: string;
  daneColegio: string;
  daneSede: string;
  consecutivoSede: string;
  nombreSede: string;
  idLocalidad: number;
  idSede: number;
  idUserAsig: string;
  isState: boolean;
}

export interface ColegioByUserDTO {
  idAsignacion: number;
  daneColegio: string;
  nombreColegio: string;
  idLocalidad: number;
  idColegio: number;
  idUser: string;
  state: boolean;
}

export interface RutasByUserDTO {
  
  idAsignacion: number;
  idRuta: number;
  numeroRuta: string;
  idUser: string;
  isState: string;
}