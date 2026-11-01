export { parsearFicha } from "./ficha";
export { marcadorDeFichaPdf, parsearFichaPdf } from "./pdf";
export type {
  Ficha,
  Fragmento,
  EquipoFicha,
  JugadorFicha,
  GolFicha,
  CambioFicha,
  TarjetaFicha,
  Lado,
} from "./ficha";
export { parsearCalendario, parsearCalendarioPdf } from "./calendario";
export { catalogoDeCalendarioPdf, parsearCalendarioWeb } from "./calendario-web";
export type { MarcaFicha } from "./iconos";
export type {
  Calendario,
  EquipoCalendario,
  JornadaCalendario,
  FragmentoCalendario,
} from "./calendario";
export { parsearJornada, parsearJornadaPdf } from "./jornada";
export type { JornadaFederacion, PartidoJornada } from "./jornada";
export { parsearClasificacion, parsearClasificacionPdf } from "./clasificacion";
export type { ClasificacionOficial, FilaOficial } from "./clasificacion";
export { jugadoresDeActaHtml, parsearEstadisticasJugador } from "./jugador-rfgf";
export type { EstadisticasOficiales, JugadorDeActa } from "./jugador-rfgf";
export { codigoDeTemporada, gruposDeEquipoHtml, partidosConCodigos } from "./equipo-rfgf";
export type { GrupoDeEquipo, PartidoConCodigos } from "./equipo-rfgf";

export { competicionesDeClubHtml } from "./equipo-rfgf";

export { ClasificacionVacia } from "./clasificacion";
