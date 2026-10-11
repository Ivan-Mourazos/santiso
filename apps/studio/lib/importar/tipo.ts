/** Qué se puede importar desde capturas. */
export type TipoImportacion = "acta" | "jornada";

/** Lo que devuelve la lectura rápida de la cabecera de unas capturas. */
export interface DeteccionCapturas {
  /** Lo que el modelo cree que son. Las respuestas antiguas no lo traen. */
  tipo?: string | null;
  jornada?: number | null;
  localTeam?: string | null;
  visitorTeam?: string | null;
  categoria?: string | null;
  competicion?: string | null;
  fecha?: string | null;
}

/**
 * Decide a qué revisión van las capturas. `null` = no se sabe y hay que preguntar: es mejor
 * una pregunta que mandar un acta a la pantalla de jornada.
 */
export function tipoDeCapturas(leido: DeteccionCapturas): TipoImportacion | null {
  const tipo = leido.tipo?.trim().toLowerCase();
  if (tipo === "acta" || tipo === "jornada") return tipo;
  if (tipo) return null;
  // Sin tipo declarado: una cabecera con los dos equipos solo la tiene el acta de un partido.
  return leido.localTeam?.trim() && leido.visitorTeam?.trim() ? "acta" : null;
}
