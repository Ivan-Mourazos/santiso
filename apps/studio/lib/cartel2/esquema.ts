/**
 * Validación de la petición de un cartel (zod), antes de mandarla al Chromium que la pinta.
 * Mismas formas que `modelo.ts`; los límites solo evitan peticiones absurdas.
 */
import { z } from "zod";
import { COMPOSICIONES, TEMAS_ANUNCIO, TIPOS_EVENTO, type PeticionCartel } from "./modelo";

const texto = (max = 200) => z.string().max(max);
/** URL de imagen: `/media/…`, `data:` (subida a mano) o `blob:` ya convertida. */
const imagen = z.string().max(12_000_000);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const entero = z.number().int().min(0).max(999);

const equipo = z.object({
  nombre: texto(120),
  escudo: imagen.nullable(),
  propio: z.boolean(),
  color,
});
const logos = {
  institucionales: z.array(texto(500)).max(4),
  patrocinadores: z.array(texto(500)).max(12),
};
const cabecera = { categoria: texto(40), competicion: texto(200), jornada: texto(10) };
const lado = z.enum(["local", "visitante"]);

const partido = z.object({
  plantilla: z.literal("partido"),
  composicion: z.enum(COMPOSICIONES.map((c) => c.id) as [string, ...string[]]),
  datos: z.object({
    ...logos,
    ...cabecera,
    local: equipo,
    visitante: equipo,
    fecha: texto(10),
    hora: texto(5),
    campo: texto(),
  }),
});

const resultado = z.object({
  plantilla: z.literal("resultado"),
  datos: z.object({
    ...logos,
    ...cabecera,
    local: equipo,
    visitante: equipo,
    golesLocal: entero,
    golesVisitante: entero,
    goles: z
      .array(
        z.object({
          minuto: texto(10),
          jugador: texto(120),
          lado,
          tipo: z.enum(["gol", "penalti", "propia"]),
        }),
      )
      .max(40),
    fecha: texto(10),
    campo: texto(),
    foto: imagen.nullable(),
  }),
});

const cronoloxia = z.object({
  plantilla: z.literal("cronoloxia"),
  datos: z.object({
    ...logos,
    ...cabecera,
    local: equipo,
    visitante: equipo,
    golesLocal: entero,
    golesVisitante: entero,
    eventos: z
      .array(
        z.object({
          minuto: texto(10),
          tipo: z.enum(TIPOS_EVENTO),
          lado,
          jugador: texto(120),
          entra: texto(120),
        }),
      )
      .max(60),
    fecha: texto(10),
    campo: texto(),
  }),
});

const proximos = z.object({
  plantilla: z.literal("proximos"),
  datos: z.object({
    ...logos,
    partidos: z
      .array(
        z.object({
          categoria: texto(40),
          local: equipo,
          visitante: equipo,
          fecha: texto(10),
          hora: texto(5),
          campo: texto(),
        }),
      )
      .max(2),
  }),
});

const jugador = z.object({ dorsal: texto(4), nombre: texto(120), capitan: z.boolean() });
const once = z.object({
  plantilla: z.literal("once"),
  datos: z.object({
    ...logos,
    ...cabecera,
    club: equipo,
    rival: equipo.nullable(),
    fecha: texto(10),
    campo: texto(),
    titulares: z.array(jugador).max(11),
    suplentes: z.array(jugador).max(12),
    foto: z
      .object({ url: imagen, x: z.number(), y: z.number(), zoom: z.number().positive() })
      .nullable(),
    invertido: z.boolean(),
  }),
});

const anuncio = z.object({
  plantilla: z.literal("anuncio"),
  datos: z.object({
    ...logos,
    tema: z.enum(Object.keys(TEMAS_ANUNCIO) as [string, ...string[]]),
    titulo: texto(200),
    texto: texto(1200),
    imagenes: z.array(imagen).max(2),
    escudoClub: imagen.nullable(),
  }),
});

const fila = z.object({
  posicion: entero,
  nombre: texto(120),
  escudo: imagen.nullable(),
  pj: entero,
  pg: entero,
  pe: entero,
  pp: entero,
  gf: entero,
  gc: entero,
  pts: z.number().int().min(-99).max(999),
  propio: z.boolean(),
});
const clasificacionBase = {
  ...logos,
  categoria: texto(40),
  titulo: texto(200),
  escudoClub: imagen.nullable(),
};
const clasificacion = z.object({
  plantilla: z.literal("clasificacion"),
  datos: z.union([
    z.object({ ...clasificacionBase, tipo: z.literal("liga"), filas: z.array(fila).max(24) }),
    z.object({
      ...clasificacionBase,
      tipo: z.literal("copa"),
      rondas: z
        .array(
          z.object({
            nombre: texto(80),
            partidos: z
              .array(
                z.object({
                  local: texto(120),
                  visitante: texto(120),
                  golesLocal: entero.nullable(),
                  golesVisitante: entero.nullable(),
                }),
              )
              .max(32),
          }),
        )
        .max(8),
    }),
  ]),
});

const peticion = z.discriminatedUnion("plantilla", [
  partido,
  resultado,
  cronoloxia,
  proximos,
  once,
  anuncio,
  clasificacion,
]);

/** La petición validada, o `null` si no tiene la forma de ningún cartel. */
export function leerPeticion(cuerpo: unknown): PeticionCartel | null {
  const leida = peticion.safeParse(cuerpo);
  return leida.success ? (leida.data as PeticionCartel) : null;
}
