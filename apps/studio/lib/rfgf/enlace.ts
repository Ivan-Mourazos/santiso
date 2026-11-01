/**
 * Direcciones de la web pública de la federación (futgal.es). Una competición se identifica
 * por cuatro códigos que van en la dirección de su calendario; con ellos se arma la página de
 * cada jornada y, con el código de acta, el PDF de cada partido.
 */

const BASE = "https://www.futgal.es/pnfg/NPcd/";

export interface GrupoRfgf {
  codPrimaria: string;
  codTemporada: string;
  codCompeticion: string;
  codGrupo: string;
}

const numero = (valor: string | null) => (valor && /^\d{1,12}$/.test(valor) ? valor : null);

/**
 * Lee los códigos de una dirección pegada por el usuario (la del calendario o la de una
 * jornada). `null` si no es de la federación o le falta alguno.
 */
export function grupoDeEnlace(enlace: string): GrupoRfgf | null {
  let url: URL;
  try {
    url = new URL(enlace.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)futgal\.es$/i.test(url.hostname)) return null;
  // La federación escribe los parámetros con mayúsculas distintas según la página.
  const parametros = new Map(
    [...url.searchParams].map(([clave, valor]) => [clave.toLowerCase(), valor] as const),
  );
  const codPrimaria = numero(parametros.get("cod_primaria") ?? null);
  const codTemporada = numero(parametros.get("codtemporada") ?? null);
  const codCompeticion = numero(parametros.get("codcompeticion") ?? null);
  const codGrupo = numero(parametros.get("codgrupo") ?? null);
  if (!codPrimaria || !codTemporada || !codCompeticion || !codGrupo) return null;
  return { codPrimaria, codTemporada, codCompeticion, codGrupo };
}

/** Página de una jornada: lista de partidos con el enlace a cada acta cerrada. */
export function urlJornada(grupo: GrupoRfgf, jornada: number): string {
  const consulta = new URLSearchParams({
    cod_primaria: grupo.codPrimaria,
    CodTemporada: grupo.codTemporada,
    CodGrupo: grupo.codGrupo,
    CodCompeticion: grupo.codCompeticion,
    CodJornada: String(jornada),
  });
  return `${BASE}NFG_CmpJornada?${consulta}`;
}

/**
 * El PDF que la propia web ofrece con «Generar PDF» en la página de una jornada: todos los
 * partidos con su día, hora y campo y, si ya se jugaron, su marcador.
 */
export function urlJornadaPdf(grupo: GrupoRfgf, jornada: number): string {
  return `${urlJornada(grupo, jornada)}&NPcd_Pdf=1`;
}

/** El PDF que la propia web ofrece con «Generar PDF» en la ficha de un partido. */
export function urlActaPdf(grupo: GrupoRfgf, codActa: string): string {
  const consulta = new URLSearchParams({
    cod_primaria: grupo.codPrimaria,
    CodActa: codActa,
    cod_acta: codActa,
    NPcd_Pdf: "1",
  });
  return `${BASE}NFG_CmpPartido?${consulta}`;
}

/** El PDF de la clasificación oficial tras una jornada («Generar PDF» en su página). */
export function urlClasificacionPdf(grupo: GrupoRfgf, jornada: number): string {
  const consulta = new URLSearchParams({
    cod_primaria: grupo.codPrimaria,
    codcompeticion: grupo.codCompeticion,
    codtemporada: grupo.codTemporada,
    codgrupo: grupo.codGrupo,
    CodJornada: String(jornada),
    NPcd_Pdf: "1",
  });
  return `${BASE}NFG_VisClasificacion?${consulta}`;
}

/** El PDF del calendario entero de la competición («Generar PDF» en su página). */
export function urlCalendarioPdf(grupo: GrupoRfgf): string {
  const consulta = new URLSearchParams({
    cod_primaria: grupo.codPrimaria,
    codtemporada: grupo.codTemporada,
    codcompeticion: grupo.codCompeticion,
    codgrupo: grupo.codGrupo,
    NPcd_Pdf: "1",
  });
  return `${BASE}NFG_VisCalendario_Vis?${consulta}`;
}

/** La página del calendario: la única con las rondas de una copa y lo que queda por sortear. */
export function urlCalendarioWeb(grupo: GrupoRfgf): string {
  return urlCalendarioPdf(grupo).replace("&NPcd_Pdf=1", "");
}

/** La página de un partido en la web (no el PDF): lista a los jugadores con su código. */
export function urlActaWeb(grupo: GrupoRfgf, codActa: string): string {
  const consulta = new URLSearchParams({
    cod_primaria: grupo.codPrimaria,
    CodActa: codActa,
    cod_acta: codActa,
  });
  return `${BASE}NFG_CmpPartido?${consulta}`;
}

/** Sección de estadísticas de jugadores en la web de la federación. */
const COD_ESTADISTICAS = "5000274";

/**
 * La página de estadísticas de un jugador. Las cifras son las de la competición del partido
 * indicado: con uno de otra temporada, las de aquella.
 */
export function urlEstadisticasJugador(codigo: string, codActa: string): string {
  const consulta = new URLSearchParams({
    cod_primaria: COD_ESTADISTICAS,
    jugador: codigo,
    codacta: codActa,
  });
  return `${BASE}NFG_EstadisticasJugador?${consulta}`;
}

/** Sección «competiciones de un equipo» de la web de la federación. */
const COD_COMPETICIONES_EQUIPO = "1000123";

/** Todas las competiciones y grupos de un equipo, temporada a temporada, en una página. */
export function urlCompeticionesDeEquipo(codEquipo: string, codTemporada: string): string {
  const consulta = new URLSearchParams({
    cod_primaria: COD_COMPETICIONES_EQUIPO,
    codequipo: codEquipo,
    codtemporada: codTemporada,
  });
  return `${BASE}NFG_VisCompeticiones_Equipo?${consulta}`;
}
