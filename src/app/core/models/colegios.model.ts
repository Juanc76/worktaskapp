export interface JornadaDTO {
  jornada: string;
  idJornada: string;
  nivelArbol: string;
}

export interface SedeDTO {
  daneSede: string;
  nombreSede: string;
  ordenSede: string;
  nivelArbol: string;
  jornadas: JornadaDTO[];
}

export interface ColegioDTO {
  daneColegio: string;
  nombreColegio: string;
  nivelArbol: string;
  sedes: SedeDTO[];
}

export interface Localidad {
  key: number;
  label: string;
}

export interface Column {
    field: string;
    header: string;
    visible: boolean;
    width: string;
    filter: boolean;
    show: boolean;
    filterValue: string;
}

export const COLUMNAS_TABLA: Column[] = [
            { field: 'nombreinstitucion', header: 'Nombre Institucion', visible: true, show: true,width: '300px', filter: true, filterValue: "" },
            { field: 'dane', header: 'Dane Colegio/Sede', visible: true, show: true,width: '300px', filter: true, filterValue: "" },
            { field: 'ordensede', header: 'Sede Educativa', visible: true, show: true,width: '170px', filter: true, filterValue: "" },
            { field: 'idjornada', header: 'Id Jornada Educativa', visible: false, show: false,width: '60px', filter: false, filterValue: "" },
            { field: 'nivelarbol', header: 'Nivel Arbol', visible: false, show: false,width: '80px', filter: false, filterValue: "" }
]

  