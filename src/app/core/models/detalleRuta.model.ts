export interface DetalleRuta {
  idRuta: number;
  rutaEscolar: string;
  localidad: string;
  segmentoGeografico: string;
  tipoRuta: string;
  tipologiaRuta: string;
  zonaOperacion: string;
  movilidadReducida: boolean;
  daneColegio: string;
  nombreColegio: string;
  sedeEducativa: string;
  jornadaEducativa: string;
  inicioRecorrido1: string;
  inicioJornada: string;
  finJornada: string;
  inicioRecorrido2: string;
  horasRecorrido1: number;
  horasRecorrido2: number;
  operaLunes: boolean;
  operaMartes: boolean;
  operaMiercoles: boolean;
  operaJueves: boolean;
  operaViernes: boolean;
  operaSabado: boolean;
  operaDomingo: boolean;
  estadoRuta: string;
  
 
}