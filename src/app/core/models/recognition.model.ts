
export interface FaceDetectionResponse {
    message: string;
    results: FaceDetectionResultBackend[]; 
  }

  export interface FaceDetectionResultBackend {
    faceId: string;
    top: number;
    left: number;
    width: number;
    height: number;
    getPupilLeftX: number;
    getPupilLeftY: number;
  }


export interface FacesCandidatesDto {
  personId: string;
  confidence: number;
  numeroDocumento : string;
  apellido1 : string;
  apellido2 : string;
  nombre1 : string;
  nombre2 : string;
}