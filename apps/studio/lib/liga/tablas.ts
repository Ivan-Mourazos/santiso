import type { TipoEventoLiga } from "./eventos";

/** Un evento de la liga con lo que hace falta para las tablas. */
export interface EventoLiga {
  equipoId: string;
  equipo: string;
  persona: string;
  personaClave: string;
  tipo: TipoEventoLiga;
  tecnico: boolean;
  /** Número de la jornada del partido. */
  jornada: number;
}

export interface Goleador {
  persona: string;
  equipoId: string;
  equipo: string;
  goles: number;
  /** Puesto en la tabla; los empatados comparten puesto. */
  puesto: number;
}

/** Qué le pasa a alguien de cara al siguiente partido de su equipo. */
export type Situacion = "sancionado" | "expulsado" | "apercibido" | null;

export interface Disciplina {
  persona: string;
  equipoId: string;
  equipo: string;
  amarillas: number;
  /** Rojas directas y dobles amarillas. */
  expulsiones: number;
  situacion: Situacion;
  /** La frase que explica la situación, para enseñarla tal cual. */
  motivo: string;
}

const clave = (e: Pick<EventoLiga, "equipoId" | "personaClave">) =>
  `${e.equipoId}|${e.personaClave}`;

/** Goleadores de la liga, de más a menos goles. Los goles en propia no cuentan. */
export function goleadores(eventos: readonly EventoLiga[]): Goleador[] {
  const suma = new Map<string, Omit<Goleador, "puesto">>();
  for (const e of eventos) {
    if (e.tipo !== "gol") continue;
    const fila = suma.get(clave(e));
    if (fila) fila.goles += 1;
    else suma.set(clave(e), { persona: e.persona, equipoId: e.equipoId, equipo: e.equipo, goles: 1 });
  }
  const orden = [...suma.values()].sort(
    (a, b) => b.goles - a.goles || a.persona.localeCompare(b.persona, "es"),
  );
  let puesto = 0;
  return orden.map((fila, i) => {
    if (i === 0 || fila.goles !== orden[i - 1]!.goles) puesto = i + 1;
    return { ...fila, puesto };
  });
}

/**
 * Tarjetas de cada jugador y qué supone para el siguiente partido de su equipo.
 *
 * `ciclo` son las amarillas que suman un partido de sanción (5 en estas ligas). Solo se puede
 * saber lo que sale de las actas: quien completa un ciclo o es expulsado en el último partido
 * de su equipo se pierde, como mínimo, el siguiente. Cuántos partidos le caen por una roja lo
 * decide el comité y no está en ningún acta. Las tarjetas a técnicos no entran en los ciclos.
 */
export function disciplina(
  eventos: readonly EventoLiga[],
  ciclo: number,
  /**
   * La última jornada que jugó cada equipo (por id). Si no se da, se deduce de los eventos, que
   * solo vale si están cargadas todas las actas: un equipo sin goles ni tarjetas en su último
   * partido, o con ese acta sin leer, parecería no haberlo jugado.
   */
  ultimaJornada?: ReadonlyMap<string, number>,
): Disciplina[] {
  const ultima = new Map<string, number>(ultimaJornada);
  if (!ultimaJornada) {
    for (const e of eventos) {
      ultima.set(e.equipoId, Math.max(ultima.get(e.equipoId) ?? 0, e.jornada));
    }
  }

  const personas = new Map<string, EventoLiga[]>();
  for (const e of eventos) {
    if (e.tecnico || e.tipo === "gol" || e.tipo === "gol_propia") continue;
    const lista = personas.get(clave(e));
    if (lista) lista.push(e);
    else personas.set(clave(e), [e]);
  }

  const filas: Disciplina[] = [];
  for (const lista of personas.values()) {
    const primero = lista[0]!;
    const jornadaEquipo = ultima.get(primero.equipoId) ?? 0;
    const amarillas = lista.filter((e) => e.tipo === "amarilla");
    const expulsiones = lista.filter((e) => e.tipo !== "amarilla");
    const expulsadoAhora = expulsiones.some((e) => e.jornada === jornadaEquipo);
    const completaCiclo =
      ciclo > 0 &&
      amarillas.length > 0 &&
      amarillas.length % ciclo === 0 &&
      Math.max(...amarillas.map((e) => e.jornada)) === jornadaEquipo;

    let situacion: Situacion = null;
    let motivo = "";
    if (expulsadoAhora) {
      situacion = "expulsado";
      motivo = `Expulsado en la jornada ${jornadaEquipo}: al menos 1 partido. El comité decide cuántos.`;
    } else if (completaCiclo) {
      situacion = "sancionado";
      motivo = `${amarillas.length} amarillas: cumple ciclo y se pierde el siguiente partido.`;
    } else if (ciclo > 1 && amarillas.length % ciclo === ciclo - 1) {
      situacion = "apercibido";
      motivo = `${amarillas.length} amarillas: con la siguiente, un partido de sanción.`;
    }
    filas.push({
      persona: primero.persona,
      equipoId: primero.equipoId,
      equipo: primero.equipo,
      amarillas: amarillas.length,
      expulsiones: expulsiones.length,
      situacion,
      motivo,
    });
  }
  const peso = { expulsado: 0, sancionado: 1, apercibido: 2 } as const;
  return filas.sort(
    (a, b) =>
      (a.situacion ? peso[a.situacion] : 3) - (b.situacion ? peso[b.situacion] : 3) ||
      b.amarillas + b.expulsiones * 2 - (a.amarillas + a.expulsiones * 2) ||
      a.persona.localeCompare(b.persona, "es"),
  );
}
