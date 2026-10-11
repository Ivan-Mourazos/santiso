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
