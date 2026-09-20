/** Coordenadas relativas a la página, con origen arriba a la izquierda. */
export interface Fragmento {
  texto: string;
  x: number;
  y: number;
}
export type Lado = "local" | "visitante";
export interface JugadorFicha {
  dorsal: number;
  nombre: string;
}
export interface EquipoFicha {
  nombre: string;
  titulares: JugadorFicha[];
  suplentes: JugadorFicha[];
}
export interface GolFicha {
  autor: string;
  minuto: string;
  beneficiario: Lado;
  marcador: [number, number];
  tipo: "desconocido" | "propia";
  equipoAutor: Lado | null;
}
export interface CambioFicha {
  equipo: Lado;
  minuto: string;
  entra: JugadorFicha;
  sale: JugadorFicha;
}
export interface TarjetaFicha {
  autor: string;
  minuto: string;
  equipo: Lado;
  tipo: "desconocido" | "amarilla" | "roja" | "doble_amarilla";
  destinatario: "jugador" | "tecnico" | "desconocido";
}
export interface Ficha {
  version: 2;
  competicion: string;
  jornada: number;
  temporada: string;
  fecha: string;
  campo: string;
  poblacion: string;
  marcador: [number, number];
  local: EquipoFicha;
  visitante: EquipoFicha;
  goles: GolFicha[];
  tarjetas: TarjetaFicha[];
  sustituciones: "no_registradas" | CambioFicha[];
  coberturaSustituciones: Record<Lado, "registradas" | "no_registradas">;
  avisos: string[];
}
