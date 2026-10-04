export interface SasResponse {
  sasUrl: string;
  expiresOn: string;
}

export interface RegistroMatriculaDTO {
  perID: string;
  descripcionAbreviada: string;
  numeroDocumento: string;
  apellido1: string;
  apellido2: string;
  nombre1: string;
  nombre2: string;
  fechaNacimiento: string;
  genero: string;
  grado: string;
  idPersonDirectory: string;
  fechaCreacion: string;
}

export interface addFaceEstudianteDTO {
  idPersonDirectory: string;
  persistedFaceId: string;
}

export interface DeletePersonDto {
  personId: string;
  responseString: string;
}

export interface DeletePersonResponseDto {
  personId: string;
  statusCode: string;
  message: string;
  azureStatusCode: number;
  azureSincronizado: boolean;
  baseDatosSincronizada: boolean;
  totalFacesActualizadas: number;
  operationLocation: string;
  fechaHoraApi: string;
  requestId: string;
}

export interface DeleteFacePersonDto {
  personId: string;
  persistedFaceId: string;
}

export interface IdFacesCreatedDto {
  persistedFaceIds: string;
}

export interface IdPersonFacesDto {
  personId: string;
  persistedFaceIds: IdFacesCreatedDto[] | null;
}

export interface PersonsDirectoryDto {
  name: string;
  userData: string;
  personId: string;
}


export interface FacesEstudianteDTO {
  idRegistryFace: number;
  idPersonDirectory: string;
  persistedFaceId: string;
  urlFile: string;
  nameFile: string;
  contenedor: string;
  idPathContenedor: string;
  fechaCreacion: string;
  isState: boolean | null;
  fechaDelete: string | null;
  apiDeleteFechaHora: string | null;
  apiDeleteOperationLocation: string | null;
  apiDeleteRequestId: string | null;
}

 
