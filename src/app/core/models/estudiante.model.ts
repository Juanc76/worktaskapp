
  export interface Estudiantes {
  perID : string;
  descripcionAbreviada : string;
  numeroDocumento : string;
  nombre1 : string;
  nombre2 : string;
  apellido1 : string;
  apellido2 : string;
  fechaNacimiento : string;
  genero : string;
  grado : string;
  daneColegio : string;
  daneSede : string;
  jornadaEducativa : number;
  idPersonDirectory : string;
  fechaCreacion : string;

  //Columnas precalculadas para facilitar la búsqueda y filtrado. estas no son enviadas desde el backend
  searchKey?: string;
  gradoKey?: string;

  }

