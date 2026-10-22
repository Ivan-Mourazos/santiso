/**
 * Validación de la petición de un cartel (zod), antes de mandarla al Chromium que la pinta.
 * Mismas formas que `modelo.ts`; los límites solo evitan peticiones absurdas.
 */
import { z } from "zod";
import {
  COMPOSICIONES,
  ESTILOS_FOTO,
  SORTEOS_LOTERIA,
  TEMAS_ANUNCIO,
  TIPOS_COMUNICADO,
  TIPOS_EVENTO,
  TIPOS_FICHAXE,
  type PeticionCartel,
} from "./modelo";

const texto = (max = 200) => z.string().max(max);
/**
 * Una imagen que el Chromium del PC puede abrir: un fichero de `/media/` del propio Studio o
 * una foto subida a mano ya pasada a `data:`. Nada más: con una URL cualquiera, quien pide el
 * cartel haría que el PC llamase a otra máquina de su red o de internet. Vacía, sin imagen.
 */
export function esImagenLocal(url: string) {
  if (url === "") return true;
  // `data:` va dentro de la propia petición: no sale a la red. Un SVG en `<img>` tampoco.
  if (/^data:image\/(png|jpeg|webp|gif|avif|svg\+xml)[;,]/.test(url)) return true;
  // Que no salga de /media/: sin tramos vacíos, `.` ni `..` (tampoco escritos `%2e`), ni `\`.
  if (!url.startsWith("/media/") || /[\\\s?#]/.test(url)) return false;
  return url
    .slice("/media/".length)
    .split("/")
    .every((tramo) => !["", ".", ".."].includes(tramo.replace(/%2e/gi, ".")));
}
const imagenDe = (max: number) =>
  z.string().max(max).refine(esImagenLocal, "Imagen fuera del Studio.");
const imagen = imagenDe(12_000_000);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const entero = z.number().int().min(0).max(999);

const equipo = z.object({
  nombre: texto(120),
  escudo: imagen.nullable(),
  propio: z.boolean(),
  color,
  color2: color.optional(),
  relieve: z.boolean(),
});
const logos = {
  institucionales: z.array(imagenDe(500)).max(4),
  patrocinadores: z.array(imagenDe(500)).max(12),
};
const cabecera = { categoria: texto(40), competicion: texto(200), jornada: texto(10) };
const lado = z.enum(["local", "visitante"]);
const formato = z.enum(["publicacion", "historia"]).optional();
const forma = z.object({
  posicion: z.number().int().min(1).max(999).nullable(),
  racha: z.array(z.enum(["V", "E", "D"])).max(5),
});
const contexto = z.object({ local: forma, visitante: forma }).optional();
const fotoFondo = z.object({
  zoom: z.number().positive().max(4).optional(),
  url: imagen,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  estilo: z.enum(ESTILOS_FOTO.map((e) => e.id) as [string, ...string[]]),
});

const partido = z.object({
  plantilla: z.literal("partido"),
  formato,
  composicion: z.enum(COMPOSICIONES.map((c) => c.id) as [string, ...string[]]),
  datos: z.object({
    ...logos,
    ...cabecera,
    local: equipo,
    visitante: equipo,
    fecha: texto(10),
    hora: texto(5),
    campo: texto(),
    localidad: texto().optional(),
    contexto,
    foto: fotoFondo.nullable().optional(),
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
    foto: fotoFondo.nullable(),
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
    foto: fotoFondo.nullable().optional(),
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
  formato,
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
          localidad: texto().optional(),
          competicion: texto().optional(),
          jornada: texto(10).optional(),
          contexto,
        }),
      )
      .max(4),
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
    modoFoto: z.enum(["retrato", "fondo"]).optional(),
  }),
});

const alineacion = z.object({
  plantilla: z.literal("alineacion"),
  datos: z.object({
    ...logos,
    ...cabecera,
    club: equipo,
    rival: equipo,
    local: z.boolean(),
    fecha: texto(10),
    hora: texto(5),
    campo: texto(),
    titulares: z.array(jugador).max(11),
    suplentes: z.array(jugador).max(12),
    foto: fotoFondo.nullable().optional(),
  }),
});

const convocatoria = z.object({
  plantilla: z.literal("convocatoria"),
  datos: z.object({
    ...logos,
    ...cabecera,
    club: equipo,
    rival: equipo,
    local: z.boolean(),
    fecha: texto(10),
    hora: texto(5),
    campo: texto(),
    convocados: z.array(jugador).min(1).max(22),
    horaQuedada: texto(5),
    lugarQuedada: texto(200),
    equipacion: texto(120),
    nota: texto(400),
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

const fichaxe = z.object({
  plantilla: z.literal("fichaxe"),
  datos: z.object({
    tipo: z.enum(Object.keys(TIPOS_FICHAXE) as [string, ...string[]]),
    nombre: texto(60),
    apellido: texto(60),
    detalle: texto(120),
    frase: texto(240),
    foto: z
      .object({
        url: imagen,
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        zoom: z.number().positive().max(4),
      })
      .nullable(),
    escudoClub: imagen.nullable(),
    conEscudo: z.boolean(),
  }),
});

const comunicado = z.object({
  plantilla: z.literal("comunicado"),
  datos: z.object({
    tipo: z.enum(Object.keys(TIPOS_COMUNICADO) as [string, ...string[]]),
    titulo: texto(120),
    texto: texto(1600),
    fecha: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    firma: texto(80),
    escudoClub: imagen.nullable(),
  }),
});

const importe = z.union([z.literal(""), z.string().regex(/^\d{1,4}(,\d{1,2})?$/)]);

const loteria = z.object({
  plantilla: z.literal("loteria"),
  datos: z.object({
    sorteo: z.enum(Object.keys(SORTEOS_LOTERIA) as [string, ...string[]]),
    anio: z.number().int().min(2000).max(2100),
    numeros: z.array(z.string().regex(/^\d{5}$/)).max(2),
    titulo: texto(80),
    prezo: importe,
    xoga: importe,
    puntos: texto(400),
    escudoClub: imagen.nullable(),
    patrocinadores: logos.patrocinadores,
  }),
});

const peticion = z.discriminatedUnion("plantilla", [
  loteria,
  fichaxe,
  comunicado,
  partido,
  resultado,
  cronoloxia,
  proximos,
  once,
  anuncio,
  clasificacion,
  alineacion,
  convocatoria,
]);

/** La petición validada, o `null` si no tiene la forma de ningún cartel. */
export function leerPeticion(cuerpo: unknown): PeticionCartel | null {
  const leida = peticion.safeParse(cuerpo);
  return leida.success ? (leida.data as PeticionCartel) : null;
}
