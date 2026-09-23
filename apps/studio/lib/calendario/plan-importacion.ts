import type { Calendario } from "@santiso/actas";
import { claveEquipo, similitudTokens } from "@santiso/domain";

/**
 * El calendario federativo trae la temporada entera con los nombres tal y como los publica la
 * federación: en mayúsculas y abreviados. Antes de escribir nada hay que decir **exactamente**
 * qué se va a crear, qué ya estaba y qué nombres no se han podido resolver. Eso es este plan,
 * que es puro: no toca ni el PDF ni la base de datos.
 */

export interface EquipoConocido {
  id: string;
  nombre: string;
}

export interface JornadaConocida {
  id: string;
  numero: number;
}

export interface CruceConocido {
  jornadaNumero: number;
  equipoLocalId: string;
  equipoVisitanteId: string;
}

/** Lo que hay hoy en la base de datos para esa competición. */
export interface EstadoBd {
  equipos: EquipoConocido[];
  jornadas: JornadaConocida[];
  cruces: CruceConocido[];
}

export type EstadoCruce = "nuevo" | "existe" | "sin-equipo";

export interface CrucePlaneado {
  jornada: number;
  localNombre: string;
  visitanteNombre: string;
  localId: string | null;
  visitanteId: string | null;
  estado: EstadoCruce;
}

export interface JornadaNueva {
  numero: number;
  /** Fecha nominal de la jornada, "YYYY-MM-DD". No es la hora de cada partido. */
  fechaInicio: string;
}

export interface PlanImportacion {
  jornadasNuevas: JornadaNueva[];
  jornadasExistentes: number[];
  cruces: CrucePlaneado[];
  /** Nombres del PDF que no corresponden a ningún equipo, sin repetir. */
  sinResolver: string[];
  resumen: {
    jornadasNuevas: number;
    crucesNuevos: number;
    crucesExistentes: number;
    crucesSinEquipo: number;
  };
}

/** Por debajo de esto no se considera el mismo equipo. */
const PARECIDO_MINIMO = 0.6;


/**
 * Empareja un nombre del PDF con un equipo. Primero por clave idéntica, que es lo que ya usa
 * la tabla de equipos; si no, por parecido de tokens. Un empate entre dos equipos **no** se
 * resuelve: es preferible dejarlo a la vista que elegir al azar y colgar los partidos del
 * equipo equivocado.
 */
function emparejar(nombre: string, equipos: EquipoConocido[]): EquipoConocido | null {
  const clave = claveEquipo(nombre);
  const exactos = equipos.filter((equipo) => claveEquipo(equipo.nombre) === clave);
  if (exactos.length === 1) return exactos[0] ?? null;
  if (exactos.length > 1) return null;

  let mejor: EquipoConocido | null = null;
  let mejorParecido = 0;
  let empatado = false;
  for (const equipo of equipos) {
    const parecido = similitudTokens(claveEquipo(nombre), claveEquipo(equipo.nombre));
    if (parecido > mejorParecido) {
      mejor = equipo;
      mejorParecido = parecido;
      empatado = false;
    } else if (parecido === mejorParecido && parecido > 0) {
      empatado = true;
    }
  }
  if (empatado || mejorParecido < PARECIDO_MINIMO) return null;
  return mejor;
}

export function planDeImportacion(calendario: Calendario, estado: EstadoBd): PlanImportacion {
  const jornadasPorNumero = new Map(estado.jornadas.map((j) => [j.numero, j]));
  const cruceExistente = new Set(
    estado.cruces.map((c) => `${c.jornadaNumero}|${c.equipoLocalId}|${c.equipoVisitanteId}`),
  );

  // Un mismo nombre aparece en muchas jornadas: se resuelve una vez y se reutiliza.
  const resueltos = new Map<string, EquipoConocido | null>();
  const resolver = (nombre: string) => {
    if (!resueltos.has(nombre)) resueltos.set(nombre, emparejar(nombre, estado.equipos));
    return resueltos.get(nombre) ?? null;
  };

  const jornadasNuevas: JornadaNueva[] = [];
  const jornadasExistentes: number[] = [];
  const cruces: CrucePlaneado[] = [];
  const sinResolver = new Set<string>();

  for (const jornada of calendario.jornadas) {
    if (jornadasPorNumero.has(jornada.numero)) jornadasExistentes.push(jornada.numero);
    else jornadasNuevas.push({ numero: jornada.numero, fechaInicio: jornada.fechaNominal });

    for (const partido of jornada.partidos) {
      const local = resolver(partido.local.nombre);
      const visitante = resolver(partido.visitante.nombre);
      if (!local) sinResolver.add(partido.local.nombre);
      if (!visitante) sinResolver.add(partido.visitante.nombre);

      const estadoCruce: EstadoCruce = !local || !visitante
        ? "sin-equipo"
        : cruceExistente.has(`${jornada.numero}|${local.id}|${visitante.id}`)
          ? "existe"
          : "nuevo";

      cruces.push({
        jornada: jornada.numero,
        localNombre: partido.local.nombre,
        visitanteNombre: partido.visitante.nombre,
        localId: local?.id ?? null,
        visitanteId: visitante?.id ?? null,
        estado: estadoCruce,
      });
    }
  }

  const cuenta = (estadoCruce: EstadoCruce) =>
    cruces.filter((cruce) => cruce.estado === estadoCruce).length;

  return {
    jornadasNuevas,
    jornadasExistentes,
    cruces,
    sinResolver: [...sinResolver],
    resumen: {
      jornadasNuevas: jornadasNuevas.length,
      crucesNuevos: cuenta("nuevo"),
      crucesExistentes: cuenta("existe"),
      crucesSinEquipo: cuenta("sin-equipo"),
    },
  };
}
