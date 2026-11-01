import type { Calendario, EquipoCalendario } from "@santiso/actas";
import {
  claveEquipo,
  claveNombre,
  normalizarNombreEquipo,
  similitudTokens,
} from "@santiso/domain";

/**
 * El calendario federativo trae la temporada entera con los nombres tal y como los publica la
 * federación: en mayúsculas y abreviados. Antes de escribir nada hay que decir **exactamente**
 * qué se va a crear, qué ya estaba y qué nombres no se han podido resolver. Eso es este plan,
 * que es puro: no toca ni el PDF ni la base de datos.
 */

export interface EquipoConocido {
  id: string;
  nombre: string;
  /** Su club en la federación, si se sabe. */
  clubCodigo?: string | null;
  /** Ya está inscrito en esta competición. */
  inscrito?: boolean;
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
  /**
   * Con ella, los nombres que no son de ningún equipo se dan de alta en esa categoría. Sin ella
   * se quedan en `sinResolver`.
   */
  categoria?: string;
}

export type EstadoCruce = "nuevo" | "existe" | "sin-equipo";

export interface CrucePlaneado {
  jornada: number;
  localNombre: string;
  visitanteNombre: string;
  localId: string | null;
  visitanteId: string | null;
  /** Clave del equipo por crear, cuando aún no tiene id. */
  localNuevo?: string | null;
  visitanteNuevo?: string | null;
  estado: EstadoCruce;
}

export interface EquipoNuevo {
  /** Ya con las reglas de nombres de equipo. */
  nombre: string;
  clave: string;
  clubCodigo: string | null;
}

export interface JornadaNueva {
  numero: number;
  /** Fecha nominal de la jornada, "YYYY-MM-DD". No es la hora de cada partido. */
  fechaInicio: string;
  /** Nombre de la ronda, en una copa. */
  nombreFase?: string | null;
}

export interface PlanImportacion {
  jornadasNuevas: JornadaNueva[];
  jornadasExistentes: number[];
  cruces: CrucePlaneado[];
  /** Nombres del PDF que no corresponden a ningún equipo, sin repetir. */
  sinResolver: string[];
  /** Equipos que hay que dar de alta. */
  equiposNuevos: EquipoNuevo[];
  /** Equipos que ya existen y juegan aquí: se inscriben en la competición. */
  equiposExistentes: string[];
  /** Los que no se llaman igual: se enseñan para ver de un vistazo si alguno está mal. */
  parecidos: { federacion: string; equipo: string }[];
  resumen: {
    equiposNuevos: number;
    equiposExistentes: number;
    jornadasNuevas: number;
    crucesNuevos: number;
    crucesExistentes: number;
    crucesSinEquipo: number;
  };
}

/** Por debajo de esto no se considera el mismo equipo. */
const PARECIDO_MINIMO = 0.6;


/** El nombre sin la categoría («veteranos», «veterans»), si queda algo; si no, tal cual. */
function sinCategoria(nombre: string): string {
  const corto = nombre.replace(/\bveteran[oa]?s?\b/giu, " ").replace(/\s+/gu, " ").trim();
  return corto || nombre.trim();
}

/**
 * Empareja un nombre del PDF con un equipo. Primero por clave idéntica, que es lo que ya usa
 * la tabla de equipos; si no, por parecido de tokens. Un empate entre dos equipos **no** se
 * resuelve: es preferible dejarlo a la vista que elegir al azar y colgar los partidos del
 * equipo equivocado.
 */
function emparejar(nombre: string, equipos: EquipoConocido[]): EquipoConocido | null {
  const clave = claveEquipo(nombre);
  const exactos = equipos.filter((equipo) => claveEquipo(equipo.nombre) === clave);
  // En su liga de veteranos la federación añade la categoría al nombre («MELIDE VETERANOS»)
  // y el Studio guarda el club a secas («Melide»): la palabra no distingue a nadie.
  if (exactos.length === 0 && sinCategoria(nombre) !== nombre.trim()) {
    const corto = equipos.filter(
      (equipo) => claveEquipo(sinCategoria(equipo.nombre)) === claveEquipo(sinCategoria(nombre)),
    );
    if (corto.length === 1) return corto[0] ?? null;
  }
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

/** La letra de un filial («BASTAVALES U.D. "B"»). Dos equipos del mismo club se distinguen por ella. */
const filial = (nombre: string) => /["'\s]([B-E])["']?\s*$/u.exec(nombre)?.[1] ?? "";

/**
 * Un equipo del calendario, mirando toda la categoría. El código es el del club: si otro equipo
 * ya lo tiene es el mismo (salvo que sea su filial) y, si tiene otro distinto, no lo es por mucho
 * que se parezcan los nombres.
 */
function emparejarEnCategoria(
  { nombre, codigoFederativo: codigo }: EquipoCalendario,
  categoria: string,
  equipos: EquipoConocido[],
): EquipoConocido | null {
  const inscritos = equipos.filter((e) => e.inscrito);
  const entreInscritos = inscritos.length ? emparejar(nombre, inscritos) : null;
  if (entreInscritos) return entreInscritos;

  const clave = claveEquipo(normalizarNombreEquipo(nombre, categoria));
  const exactos = equipos.filter((e) => claveEquipo(e.nombre) === clave);
  if (exactos.length === 1) return exactos[0] ?? null;

  const mismoClub = equipos.filter(
    (e) => codigo && e.clubCodigo === codigo && filial(e.nombre) === filial(nombre),
  );
  if (mismoClub.length === 1) return mismoClub[0] ?? null;

  const parecido = emparejar(nombre, equipos);
  if (!parecido || filial(parecido.nombre) !== filial(nombre)) return null;
  return codigo && parecido.clubCodigo && parecido.clubCodigo !== codigo ? null : parecido;
}

export function planDeImportacion(calendario: Calendario, estado: EstadoBd): PlanImportacion {
  const jornadasPorNumero = new Map(estado.jornadas.map((j) => [j.numero, j]));
  const cruceExistente = new Set(
    estado.cruces.map((c) => `${c.jornadaNumero}|${c.equipoLocalId}|${c.equipoVisitanteId}`),
  );

  // Un mismo nombre aparece en muchas jornadas: se resuelve una vez y se reutiliza.
  const resueltos = new Map<string, EquipoConocido | null>();
  const nuevos = new Map<string, EquipoNuevo>();
  const parecidos = new Map<string, string>();
  const { categoria } = estado;
  const claveNueva = (nombre: string) =>
    categoria ? claveNombre(normalizarNombreEquipo(nombre, categoria)) : null;
  const resolver = (equipo: EquipoCalendario) => {
    const { nombre, codigoFederativo } = equipo;
    if (resueltos.has(nombre)) return resueltos.get(nombre) ?? null;
    const hallado = categoria
      ? emparejarEnCategoria(equipo, categoria, estado.equipos)
      : emparejar(nombre, estado.equipos);
    resueltos.set(nombre, hallado);
    if (!categoria) return hallado;
    const normalizado = normalizarNombreEquipo(nombre, categoria);
    if (hallado && claveEquipo(normalizado) !== claveEquipo(hallado.nombre)) {
      parecidos.set(nombre, hallado.nombre);
    }
    const clave = claveNombre(normalizado);
    if (!hallado && !nuevos.has(clave)) {
      nuevos.set(clave, { nombre: normalizado, clave, clubCodigo: codigoFederativo || null });
    }
    return hallado;
  };

  const jornadasNuevas: JornadaNueva[] = [];
  const jornadasExistentes: number[] = [];
  const cruces: CrucePlaneado[] = [];
  const sinResolver = new Set<string>();

  for (const jornada of calendario.jornadas) {
    if (jornadasPorNumero.has(jornada.numero)) jornadasExistentes.push(jornada.numero);
    else {
      jornadasNuevas.push({
        numero: jornada.numero,
        fechaInicio: jornada.fechaNominal,
        ...(jornada.fase ? { nombreFase: jornada.fase } : {}),
      });
    }

    for (const partido of jornada.partidos) {
      const local = resolver(partido.local);
      const visitante = resolver(partido.visitante);
      const localNuevo = local ? null : claveNueva(partido.local.nombre);
      const visitanteNuevo = visitante ? null : claveNueva(partido.visitante.nombre);
      if (!local && !localNuevo) sinResolver.add(partido.local.nombre);
      if (!visitante && !visitanteNuevo) sinResolver.add(partido.visitante.nombre);

      const estadoCruce: EstadoCruce =
        (!local && !localNuevo) || (!visitante && !visitanteNuevo)
          ? "sin-equipo"
          : local &&
              visitante &&
              cruceExistente.has(`${jornada.numero}|${local.id}|${visitante.id}`)
            ? "existe"
            : "nuevo";

      cruces.push({
        jornada: jornada.numero,
        localNombre: partido.local.nombre,
        visitanteNombre: partido.visitante.nombre,
        localId: local?.id ?? null,
        visitanteId: visitante?.id ?? null,
        localNuevo,
        visitanteNuevo,
        estado: estadoCruce,
      });
    }
  }

  const cuenta = (estadoCruce: EstadoCruce) =>
    cruces.filter((cruce) => cruce.estado === estadoCruce).length;

  const existentes = new Set(
    [...resueltos.values()].flatMap((equipo) => (equipo ? [equipo.id] : [])),
  );

  return {
    jornadasNuevas,
    jornadasExistentes,
    cruces,
    sinResolver: [...sinResolver],
    equiposNuevos: [...nuevos.values()],
    equiposExistentes: [...existentes],
    parecidos: [...parecidos].map(([federacion, equipo]) => ({ federacion, equipo })),
    resumen: {
      equiposNuevos: nuevos.size,
      equiposExistentes: existentes.size,
      jornadasNuevas: jornadasNuevas.length,
      crucesNuevos: cuenta("nuevo"),
      crucesExistentes: cuenta("existe"),
      crucesSinEquipo: cuenta("sin-equipo"),
    },
  };
}
