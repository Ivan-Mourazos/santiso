# Fase 2B-4 — Actas y datos de carteles sobre SQLite: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [x]`) para el seguimiento.

**Objetivo:** cerrar la reconexión de la aplicación a SQLite. Al terminar, ninguna pantalla lee ni escribe en Supabase, y el guardado de un acta deja de poder perder datos.

**Arquitectura:** la misma de 2B-1 a 2B-3. La novedad está en el guardado del acta: la transformación del acta a filas es **pura y probada aparte**, y la escritura va en **una sola transacción**.

**Stack:** Next.js 16.3.5 · React 19.3.0 · Drizzle ORM 0.45.2 + @libsql/client 0.18.0 · Zod 4.6.4 · Vitest 4.1.11 · @playwright/test 1.61.1 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). Leer §4 (D6), §6.2 (cambios de esquema), §6.3 (R10–R12) y §8 «Fase 2».

**Planes anteriores:** [2B-1](2026-09-20-fase-2b-1-catalogos.md), [2B-2](2026-09-20-fase-2b-2-media.md) y [2B-3](2026-09-20-fase-2b-3-calendario.md).

## El fallo que cierra esta subfase

La auditoría UX/UI lo recoge como **P1 #3: pérdida de datos al reimportar un acta**. `lib/actas/save-acta.ts` hace hoy esto:

1. borra las estadísticas del partido,
2. borra los eventos del partido,
3. llama a un RPC de Supabase (`save_reviewed_acta`),
4. si el RPC no existe, **repite los borrados** y luego inserta.

Si el paso 4 falla después de borrar, el partido se queda sin estadísticas ni eventos y sin forma de recuperarlos. No es una hipótesis: el respaldo no es atómico por construcción.

En SQLite pasa a ser **una transacción**: actualizar el partido, borrar participaciones y eventos e insertar los nuevos. Si algo falla, no se ha tocado nada.

## Restricciones globales

- **Supabase sigue congelada** desde el 20/09/2026. Al terminar esta subfase la herramienta vuelve a ser usable para datos reales.
- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash (sintaxis POSIX).
- TypeScript 5.9.3. Antes de usar una API de Next, leer su guía en `apps/studio/node_modules/next/dist/docs/`.
- Drizzle: solo el query builder core. Prohibido `db.query.*`.
- **Un módulo con `server-only` no puede importarse desde un componente cliente.** Las lecturas que consume el navegador pasan por una acción `"use server"`.
- **Next despacha las Server Actions de una en una por cliente.** Una función de carga por pantalla.
- **Las acciones de guardado reescriben la fila entera.** Aquí importa más que nunca: el acta reescribe participaciones y eventos completos del partido, y eso es **deliberado**, pero va dentro de una transacción.
- **Prettier y ESLint solo sobre los ficheros nuevos.** El control es que la línea base de ESLint **no suba**: hoy está en **97 problemas**.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto.
- libSQL no libera el fichero de BD hasta que termina el proceso. Parar `pnpm dev` antes de tocarlo; en Windows, matar el proceso que escucha en el 3000.
- Dominio en español. Sin `any`. `as` solo con un comentario que lo justifique. Sin `catch` vacíos.
- `pnpm check` en verde antes de cada commit. Ojo: el código de salida de una tubería es el del último comando, así que `pnpm check | tail` **no** corta un `&&`. Comprobar el resultado a ojo o con `${PIPESTATUS[0]}`.
- Cada commit en Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Mapa de ficheros

```
santiso/
├─ apps/studio/
│  ├─ lib/actas/transformar.ts / .test.ts  (nuevo) acta → participaciones y eventos (puro)
│  ├─ lib/actas/save-acta.ts               (borrar) lo sustituye la acción transaccional
│  ├─ lib/dto.ts                           (mod) PartidoActaDto
│  ├─ lib/server/consultas/actas.ts        (nuevo) partidosParaActa, eventosDePartido, participacionesDePartido
│  ├─ lib/server/acciones/actas.ts / .test.ts (nuevo) cargarPantallaActa, guardarActa
│  ├─ lib/cartel/clasificacion-data.ts     (mod) usa calcularClasificacion del dominio
│  ├─ components/admin/cartel/useCartelAssets.ts (mod)
│  ├─ components/admin/cartel/useCartelForm.ts   (mod)
│  ├─ components/admin/AdminActaImporter.tsx     (mod)
│  ├─ components/admin/AdminActaBatch.tsx        (mod)
│  ├─ components/admin/AdminJornadaImporter.tsx  (mod)
│  └─ e2e/actas.spec.ts                    (nuevo)
```

---

### Tarea 1: Transformación pura del acta

Contexto: antes de tocar la base de datos conviene separar la parte que **decide qué filas hay que escribir**, que es donde está toda la lógica delicada, de la parte que las escribe. Así se puede probar exhaustivamente sin BD.

La correspondencia de eventos ya está resuelta: `tools/migracion-supabase/src/transformar/actas.ts` (`mapearEvento`) convirtió las 7 formas conocidas del modelo viejo al nuevo durante la migración. Aquí se hace lo mismo pero partiendo del acta analizada (`ParsedActa`), que trae la información con otros nombres (`isRival`, `esPropia`, `esPropiaSantiso`).

Las 7 formas, del acta al modelo nuevo:

| Acta | Fila nueva |
| --- | --- |
| gol, propio, con jugador | `tipo: gol, lado: propio, jugadorId` |
| gol, propio, `esPropia` (lo marcó un rival en su portería) | `tipo: gol, lado: propio, propia: true, nombreRival` |
| gol, rival, `esPropiaSantiso` (lo marcó el nuestro en la nuestra) | `tipo: gol, lado: rival, propia: true, jugadorId` |
| gol, rival | `tipo: gol, lado: rival, nombreRival` |
| tarjeta, propio | `lado: propio, jugadorId` |
| tarjeta, rival | `lado: rival, nombreRival` |
| cambio, propio | `lado: propio, jugadorId` (entra), `jugadorSaleId` (sale) |

Cualquier otra combinación es un error que **detiene el guardado**: es preferible a escribir una fila que el CHECK de la tabla rechazaría con un mensaje incomprensible.

**Ficheros:**
- Crear: `apps/studio/lib/actas/transformar.ts`, `apps/studio/lib/actas/transformar.test.ts`

**Interfaces:**
- Consume: `ParsedActa`, `ActaEvent` (`@/lib/actas/types`); `MINUTO_MAXIMO` (`@santiso/domain`).
- Produce:
  - `type ParticipacionActa = { jugadorId: string; titular: boolean; jugo: boolean }`
  - `type EventoActa = { tipo, lado, propia, minuto, jugadorId, jugadorSaleId, nombreRival }`
  - `class ErrorActa extends Error`
  - `participacionesDeActa(acta: ParsedActa): ParticipacionActa[]`
  - `eventosDeActa(acta: ParsedActa): EventoActa[]`

- [x] **Paso 1: Escribir las pruebas que fallan**

`apps/studio/lib/actas/transformar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ErrorActa, eventosDeActa, participacionesDeActa } from "./transformar";
import type { ActaEvent, ActaPlayerRef, ParsedActa } from "./types";

const jugador = (id: string, dorsal = "1"): ActaPlayerRef => ({
  id: `ref-${id}`,
  dorsal,
  rawName: id,
  jugadorId: id,
});

const acta = (parcial: Partial<ParsedActa> = {}): ParsedActa => ({
  marcadorLocal: "1",
  marcadorVisitante: "0",
  campoNombre: "",
  campoPoblacion: "",
  titulares: [],
  suplentes: [],
  eventos: [],
  warnings: [],
  rawText: "",
  ...parcial,
});

const evento = (parcial: Partial<ActaEvent>): ActaEvent => ({
  id: "e1",
  tipo: "gol",
  minuto: "10",
  isRival: false,
  confidence: "alta",
  ...parcial,
});

describe("participacionesDeActa", () => {
  it("marca titulares como jugados y suplentes como no jugados", () => {
    expect(
      participacionesDeActa(acta({ titulares: [jugador("a")], suplentes: [jugador("b")] })),
    ).toEqual([
      { jugadorId: "a", titular: true, jugo: true },
      { jugadorId: "b", titular: false, jugo: false },
    ]);
  });

  it("ignora a quien no está enlazado con un jugador de la base de datos", () => {
    const sinEnlazar: ActaPlayerRef = { id: "ref", dorsal: "9", rawName: "Desconocido" };
    expect(participacionesDeActa(acta({ titulares: [sinEnlazar] }))).toEqual([]);
  });

  it("no duplica a quien aparece como titular y como suplente", () => {
    expect(
      participacionesDeActa(acta({ titulares: [jugador("a")], suplentes: [jugador("a")] })),
    ).toEqual([{ jugadorId: "a", titular: true, jugo: true }]);
  });

  it("marca como jugado al suplente que marca un gol", () => {
    const resultado = participacionesDeActa(
      acta({
        suplentes: [jugador("b")],
        eventos: [evento({ jugador: jugador("b") })],
      }),
    );
    expect(resultado).toEqual([{ jugadorId: "b", titular: false, jugo: true }]);
  });

  it("marca como jugado al suplente que entra en un cambio", () => {
    const resultado = participacionesDeActa(
      acta({
        titulares: [jugador("a")],
        suplentes: [jugador("b")],
        eventos: [
          evento({ tipo: "cambio", jugadorEntra: jugador("b"), jugadorSale: jugador("a") }),
        ],
      }),
    );
    expect(resultado).toContainEqual({ jugadorId: "b", titular: false, jugo: true });
  });

  it("crea la participación de quien tiene eventos pero no estaba en las listas", () => {
    const resultado = participacionesDeActa(
      acta({ eventos: [evento({ jugador: jugador("z") })] }),
    );
    expect(resultado).toEqual([{ jugadorId: "z", titular: false, jugo: true }]);
  });

  it("cuenta como jugado a quien marca en propia en nuestra portería", () => {
    const resultado = participacionesDeActa(
      acta({
        suplentes: [jugador("b")],
        eventos: [evento({ isRival: true, esPropiaSantiso: true, jugador: jugador("b") })],
      }),
    );
    expect(resultado).toEqual([{ jugadorId: "b", titular: false, jugo: true }]);
  });
});

describe("eventosDeActa", () => {
  it("gol propio con jugador", () => {
    expect(eventosDeActa(acta({ eventos: [evento({ jugador: jugador("a") })] }))).toEqual([
      {
        tipo: "gol",
        lado: "propio",
        propia: false,
        minuto: 10,
        jugadorId: "a",
        jugadorSaleId: null,
        nombreRival: null,
      },
    ]);
  });

  it("gol en propia de un rival cuenta para nosotros y guarda su nombre", () => {
    const resultado = eventosDeActa(
      acta({ eventos: [evento({ esPropia: true, nombreRival: "Pérez" })] }),
    );
    expect(resultado[0]).toMatchObject({
      lado: "propio",
      propia: true,
      nombreRival: "Pérez",
      jugadorId: null,
    });
  });

  it("gol en propia nuestro cuenta para el rival y guarda nuestro jugador", () => {
    const resultado = eventosDeActa(
      acta({
        eventos: [evento({ isRival: true, esPropiaSantiso: true, jugador: jugador("a") })],
      }),
    );
    expect(resultado[0]).toMatchObject({
      lado: "rival",
      propia: true,
      jugadorId: "a",
      nombreRival: null,
    });
  });

  it("gol del rival guarda su nombre y ningún jugador", () => {
    const resultado = eventosDeActa(
      acta({ eventos: [evento({ isRival: true, nombreRival: "Gómez" })] }),
    );
    expect(resultado[0]).toMatchObject({
      lado: "rival",
      propia: false,
      jugadorId: null,
      nombreRival: "Gómez",
    });
  });

  it("tarjetas propias y rivales", () => {
    const resultado = eventosDeActa(
      acta({
        eventos: [
          evento({ tipo: "tarjeta_amarilla", jugador: jugador("a") }),
          evento({ id: "e2", tipo: "tarjeta_roja", isRival: true, nombreRival: "Gómez" }),
        ],
      }),
    );
    expect(resultado[0]).toMatchObject({ tipo: "tarjeta_amarilla", lado: "propio", jugadorId: "a" });
    expect(resultado[1]).toMatchObject({ tipo: "tarjeta_roja", lado: "rival", nombreRival: "Gómez" });
  });

  it("cambio guarda quien entra y quien sale", () => {
    const resultado = eventosDeActa(
      acta({
        eventos: [
          evento({ tipo: "cambio", jugadorEntra: jugador("b"), jugadorSale: jugador("a") }),
        ],
      }),
    );
    expect(resultado[0]).toMatchObject({
      tipo: "cambio",
      lado: "propio",
      jugadorId: "b",
      jugadorSaleId: "a",
    });
  });

  it("el minuto vacío o fuera de rango se guarda como nulo o se rechaza", () => {
    expect(eventosDeActa(acta({ eventos: [evento({ minuto: "", jugador: jugador("a") })] }))[0])
      .toMatchObject({ minuto: null });
    expect(() =>
      eventosDeActa(acta({ eventos: [evento({ minuto: "999", jugador: jugador("a") })] })),
    ).toThrow(ErrorActa);
  });

  it("rechaza un gol propio sin jugador ni marca de propia", () => {
    expect(() => eventosDeActa(acta({ eventos: [evento({})] }))).toThrow(ErrorActa);
  });

  it("rechaza un cambio al que le falta el jugador que sale", () => {
    expect(() =>
      eventosDeActa(acta({ eventos: [evento({ tipo: "cambio", jugadorEntra: jugador("b") })] })),
    ).toThrow(ErrorActa);
  });

  it("descarta eventos repetidos", () => {
    const uno = evento({ jugador: jugador("a") });
    const otro = evento({ id: "e2", jugador: jugador("a") });
    expect(eventosDeActa(acta({ eventos: [uno, otro] }))).toHaveLength(1);
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/actas/transformar.test.ts`
Esperado: FAIL, el módulo `./transformar` no existe.

- [x] **Paso 3: Implementar**

`apps/studio/lib/actas/transformar.ts`:

```ts
import { MINUTO_MAXIMO } from "@santiso/domain";
import type { ActaEvent, ParsedActa } from "./types";

/** El acta trae algo que no se puede guardar: se detiene antes de tocar la base de datos. */
export class ErrorActa extends Error {}

export interface ParticipacionActa {
  jugadorId: string;
  titular: boolean;
  jugo: boolean;
}

export interface EventoActa {
  tipo: ActaEvent["tipo"];
  lado: "propio" | "rival";
  propia: boolean;
  minuto: number | null;
  jugadorId: string | null;
  jugadorSaleId: string | null;
  nombreRival: string | null;
}

/** Jugador propio al que se le anota el evento, si lo hay. */
const jugadorDelEvento = (evento: ActaEvent): string | null =>
  (evento.tipo === "cambio" ? evento.jugadorEntra?.jugadorId : evento.jugador?.jugadorId) ?? null;

/**
 * Convocatoria: titulares juegan, suplentes no, y cualquiera con eventos pasa a haber jugado.
 * Los goles no se guardan aquí: se derivan de los eventos (una sola fuente de verdad).
 */
export function participacionesDeActa(acta: ParsedActa): ParticipacionActa[] {
  const participaciones = new Map<string, ParticipacionActa>();

  for (const jugador of acta.titulares) {
    if (!jugador.jugadorId) continue;
    participaciones.set(jugador.jugadorId, {
      jugadorId: jugador.jugadorId,
      titular: true,
      jugo: true,
    });
  }
  for (const jugador of acta.suplentes) {
    if (!jugador.jugadorId || participaciones.has(jugador.jugadorId)) continue;
    participaciones.set(jugador.jugadorId, {
      jugadorId: jugador.jugadorId,
      titular: false,
      jugo: false,
    });
  }

  for (const evento of acta.eventos) {
    const implicados = [jugadorDelEvento(evento), evento.jugadorSale?.jugadorId ?? null];
    for (const jugadorId of implicados) {
      if (!jugadorId) continue;
      const existente = participaciones.get(jugadorId);
      if (existente) existente.jugo = true;
      else participaciones.set(jugadorId, { jugadorId, titular: false, jugo: true });
    }
  }

  return [...participaciones.values()];
}

/** Minuto del acta: vacío es `null`; fuera de rango detiene el guardado. */
function minutoDe(evento: ActaEvent): number | null {
  const texto = evento.minuto.trim();
  if (!texto) return null;
  const minuto = Number(texto);
  if (!Number.isInteger(minuto) || minuto < 0 || minuto > MINUTO_MAXIMO) {
    throw new ErrorActa(
      `Minuto no válido en un evento ${evento.tipo}: "${evento.minuto}". Debe estar entre 0 y ${MINUTO_MAXIMO}.`,
    );
  }
  return minuto;
}

/**
 * Eventos del acta en la forma de la tabla. Cubre las 7 combinaciones conocidas y **rechaza**
 * cualquier otra: es preferible detenerse a escribir una fila que el CHECK rechazaría luego.
 */
export function eventosDeActa(acta: ParsedActa): EventoActa[] {
  const filas = acta.eventos.map((evento): EventoActa => {
    const minuto = minutoDe(evento);
    const jugadorId = jugadorDelEvento(evento);
    const nombreRival = evento.nombreRival?.trim() || null;
    const base = {
      tipo: evento.tipo,
      propia: false,
      minuto,
      jugadorId: null,
      jugadorSaleId: null,
      nombreRival: null,
    } satisfies Omit<EventoActa, "lado">;

    if (evento.tipo === "cambio") {
      const saleId = evento.jugadorSale?.jugadorId ?? null;
      if (evento.isRival || !jugadorId || !saleId) {
        throw new ErrorActa(
          `Cambio incompleto en el minuto ${evento.minuto}: hacen falta el jugador que entra y el que sale.`,
        );
      }
      return { ...base, lado: "propio", jugadorId, jugadorSaleId: saleId };
    }

    if (evento.tipo === "gol") {
      if (!evento.isRival && jugadorId) return { ...base, lado: "propio", jugadorId };
      if (!evento.isRival && evento.esPropia) {
        return { ...base, lado: "propio", propia: true, nombreRival };
      }
      if (evento.isRival && evento.esPropiaSantiso && jugadorId) {
        return { ...base, lado: "rival", propia: true, jugadorId };
      }
      if (evento.isRival) return { ...base, lado: "rival", nombreRival };
    }

    if (evento.tipo === "tarjeta_amarilla" || evento.tipo === "tarjeta_roja") {
      if (!evento.isRival && jugadorId) return { ...base, lado: "propio", jugadorId };
      if (evento.isRival) return { ...base, lado: "rival", nombreRival };
    }

    throw new ErrorActa(
      `Evento ${evento.tipo} del minuto ${evento.minuto} sin jugador enlazado. Revísalo antes de guardar.`,
    );
  });

  // Dos líneas idénticas del acta son la misma jugada leída dos veces, no dos jugadas.
  const vistos = new Set<string>();
  return filas.filter((fila) => {
    const clave = [
      fila.tipo,
      fila.lado,
      fila.propia,
      fila.minuto ?? "",
      fila.jugadorId ?? "",
      fila.jugadorSaleId ?? "",
      fila.nombreRival ?? "",
    ].join("|");
    if (vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}
```

- [x] **Paso 4: Ejecutar las pruebas y commit**

```bash
pnpm exec vitest run apps/studio/lib/actas/transformar.test.ts
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/actas
pnpm --filter @santiso/studio exec eslint lib/actas
pnpm check
git add apps/studio/lib/actas
git commit -m "feat(studio): transformación pura del acta a participaciones y eventos" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: 18 pruebas en verde.

---

### Tarea 2: Guardado transaccional del acta

Contexto: con la transformación resuelta, la escritura es corta y lo único que importa es que sea **atómica**. Aquí se cierra P1 #3.

Un detalle del esquema: `partido_participaciones` y `partido_eventos` tienen clave foránea `restrict` contra `jugadores`, así que un `jugadorId` que no exista detiene la transacción entera; y `partidos_finalizado_con_marcador_ck` exige marcador al marcar `finalizado`, cosa que el acta siempre trae.

**Ficheros:**
- Crear: `apps/studio/lib/server/acciones/actas.ts`, `apps/studio/lib/server/acciones/actas.test.ts`
- Borrar: `apps/studio/lib/actas/save-acta.ts`

**Interfaces:**
- Consume: `participacionesDeActa`, `eventosDeActa`, `ErrorActa` (Tarea 1); `asegurarCampo` (2B-1).
- Produce: `guardarActa(partidoId: string, acta: ParsedActa): Promise<Resultado<null>>`

- [x] **Paso 1: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/actas.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActaPlayerRef, ParsedActa } from "@/lib/actas/types";

/** BD con una competición, dos equipos, una jornada, un partido y dos jugadores propios. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-actas-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const { db, cerrar } = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(db);

  const [temporada] = await db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  if (!temporada) throw new Error("sin temporada");
  const [competicion] = await db
    .insert(bd.schema.competiciones)
    .values({ temporadaId: temporada.id, categoria: "Senior", nombre: "Liga" })
    .returning({ id: bd.schema.competiciones.id });
  if (!competicion) throw new Error("sin competición");
  const equipos = await db
    .insert(bd.schema.equipos)
    .values([
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true },
      { nombre: "Rival", clave: "rival", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id });
  const [jornada] = await db
    .insert(bd.schema.jornadas)
    .values({ competicionId: competicion.id, numero: 1 })
    .returning({ id: bd.schema.jornadas.id });
  if (!jornada || !equipos[0] || !equipos[1]) throw new Error("sin jornada o equipos");
  const [partido] = await db
    .insert(bd.schema.partidos)
    .values({
      jornadaId: jornada.id,
      equipoLocalId: equipos[0].id,
      equipoVisitanteId: equipos[1].id,
    })
    .returning({ id: bd.schema.partidos.id });
  if (!partido) throw new Error("sin partido");
  const jugadores = await db
    .insert(bd.schema.jugadores)
    .values([
      { nombre: "Ana", categoria: "Senior", dorsal: 1 },
      { nombre: "Bea", categoria: "Senior", dorsal: 2 },
    ])
    .returning({ id: bd.schema.jugadores.id, nombre: bd.schema.jugadores.nombre });
  cerrar();

  const idDe = (nombre: string) => {
    const encontrado = jugadores.find((j) => j.nombre === nombre);
    if (!encontrado) throw new Error(`sin jugador ${nombre}`);
    return encontrado.id;
  };
  return { acciones: await import("./actas"), partidoId: partido.id, idDe };
}

const ref = (jugadorId: string): ActaPlayerRef => ({
  id: `ref-${jugadorId}`,
  dorsal: "1",
  rawName: "x",
  jugadorId,
});

const acta = (parcial: Partial<ParsedActa> = {}): ParsedActa => ({
  marcadorLocal: "2",
  marcadorVisitante: "1",
  campoNombre: "",
  campoPoblacion: "",
  titulares: [],
  suplentes: [],
  eventos: [],
  warnings: [],
  rawText: "",
  ...parcial,
});

/** Lee lo que quedó guardado del partido. */
async function estado(partidoId: string) {
  const bd = await import("@santiso/db");
  const { eq } = await import("drizzle-orm");
  const { db } = await (await import("@/lib/server/db")).obtenerDb();
  const [partido] = await db
    .select()
    .from(bd.schema.partidos)
    .where(eq(bd.schema.partidos.id, partidoId));
  const participaciones = await db
    .select()
    .from(bd.schema.partidoParticipaciones)
    .where(eq(bd.schema.partidoParticipaciones.partidoId, partidoId));
  const eventos = await db
    .select()
    .from(bd.schema.partidoEventos)
    .where(eq(bd.schema.partidoEventos.partidoId, partidoId));
  return { partido, participaciones, eventos };
}

describe("guardarActa", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("guarda marcador, convocatoria y eventos, y finaliza el partido", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    const resultado = await acciones.guardarActa(
      partidoId,
      acta({
        titulares: [ref(idDe("Ana"))],
        suplentes: [ref(idDe("Bea"))],
        eventos: [
          {
            id: "e1",
            tipo: "gol",
            minuto: "12",
            isRival: false,
            confidence: "alta",
            jugador: ref(idDe("Ana")),
          },
        ],
      }),
    );
    expect(resultado).toEqual({ ok: true, datos: null });

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 2, golesVisitante: 1, estado: "finalizado" });
    expect(participaciones).toHaveLength(2);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ tipo: "gol", lado: "propio", minuto: 12 });
  });

  it("reimportar sustituye lo anterior en vez de acumularlo", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({
        titulares: [ref(idDe("Ana"))],
        eventos: [
          { id: "e1", tipo: "gol", minuto: "12", isRival: false, confidence: "alta", jugador: ref(idDe("Ana")) },
        ],
      }),
    );
    await acciones.guardarActa(
      partidoId,
      acta({
        marcadorLocal: "3",
        marcadorVisitante: "0",
        titulares: [ref(idDe("Bea"))],
        eventos: [
          { id: "e2", tipo: "gol", minuto: "20", isRival: false, confidence: "alta", jugador: ref(idDe("Bea")) },
        ],
      }),
    );

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 3, golesVisitante: 0 });
    expect(participaciones).toHaveLength(1);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ minuto: 20 });
  });

  it("si el acta trae un evento imposible no toca nada: ni marcador ni datos previos", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    // Primero, un guardado bueno del que queden datos.
    await acciones.guardarActa(
      partidoId,
      acta({
        titulares: [ref(idDe("Ana"))],
        eventos: [
          { id: "e1", tipo: "gol", minuto: "12", isRival: false, confidence: "alta", jugador: ref(idDe("Ana")) },
        ],
      }),
    );
    const antes = await estado(partidoId);

    // Ahora uno con un evento propio sin jugador: la transformación lo rechaza.
    const resultado = await acciones.guardarActa(
      partidoId,
      acta({
        marcadorLocal: "9",
        marcadorVisitante: "9",
        eventos: [{ id: "e2", tipo: "gol", minuto: "30", isRival: false, confidence: "alta" }],
      }),
    );
    expect(resultado.ok).toBe(false);

    const despues = await estado(partidoId);
    expect(despues.partido).toMatchObject({ golesLocal: 2, golesVisitante: 1 });
    expect(despues.participaciones).toHaveLength(antes.participaciones.length);
    expect(despues.eventos).toHaveLength(antes.eventos.length);
  });

  it("si un jugador del acta no existe, la transacción no deja nada a medias", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({
        titulares: [ref(idDe("Ana"))],
        eventos: [
          { id: "e1", tipo: "gol", minuto: "12", isRival: false, confidence: "alta", jugador: ref(idDe("Ana")) },
        ],
      }),
    );

    const resultado = await acciones.guardarActa(
      partidoId,
      acta({ marcadorLocal: "5", marcadorVisitante: "5", titulares: [ref("jugador-inexistente")] }),
    );
    expect(resultado.ok).toBe(false);

    const { partido, participaciones, eventos } = await estado(partidoId);
    expect(partido).toMatchObject({ golesLocal: 2, golesVisitante: 1 });
    expect(participaciones).toHaveLength(1);
    expect(eventos).toHaveLength(1);
  });

  it("registra el campo del acta y lo deja apuntado en el partido", async () => {
    const { acciones, partidoId, idDe } = await entorno();
    await acciones.guardarActa(
      partidoId,
      acta({
        campoNombre: "A Carballeira",
        campoPoblacion: "Santiso",
        titulares: [ref(idDe("Ana"))],
      }),
    );

    const { partido } = await estado(partidoId);
    expect(partido?.campoId).toBeTruthy();

    const { cargarCampos } = await import("./campos");
    const campos = await cargarCampos();
    if (!campos.ok) throw new Error("sin campos");
    expect(campos.datos.map((c) => c.nombre)).toEqual(["A Carballeira"]);
  });

  it("rechaza un marcador que no son números", async () => {
    const { acciones, partidoId } = await entorno();
    expect(
      await acciones.guardarActa(partidoId, acta({ marcadorLocal: "dos", marcadorVisitante: "1" })),
    ).toMatchObject({ ok: false });
  });

  it("rechaza guardar en un partido que no existe", async () => {
    const { acciones } = await entorno();
    expect(await acciones.guardarActa("no-existe", acta())).toMatchObject({ ok: false });
  });
});
```

- [x] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/actas.test.ts`
Esperado: FAIL, el módulo `./actas` no existe.

- [x] **Paso 3: Implementar**

`apps/studio/lib/server/acciones/actas.ts`:

```ts
"use server";

import { schema } from "@santiso/db";
import { eq } from "drizzle-orm";
import { ErrorActa, eventosDeActa, participacionesDeActa } from "@/lib/actas/transformar";
import type { ParsedActa } from "@/lib/actas/types";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { asegurarCampo } from "@/lib/server/acciones/campos";
import { obtenerDb } from "@/lib/server/db";

/**
 * Guarda un acta revisada. Todo el trabajo va en **una** transacción: actualizar el partido,
 * borrar la convocatoria y los eventos anteriores e insertar los nuevos. Es lo que arregla el
 * hallazgo P1 #3 de la auditoría: antes se borraba primero y se insertaba después sin
 * transacción, así que un fallo a medias dejaba el partido sin datos y sin forma de volver.
 */
export async function guardarActa(
  partidoId: string,
  acta: ParsedActa,
): Promise<Resultado<null>> {
  const golesLocal = Number(acta.marcadorLocal);
  const golesVisitante = Number(acta.marcadorVisitante);
  const valido = (n: number) => Number.isInteger(n) && n >= 0;
  if (!valido(golesLocal) || !valido(golesVisitante)) {
    return fallo("El marcador del acta no es válido.");
  }

  // La transformación se hace antes de abrir la transacción: si el acta trae algo imposible,
  // se rechaza sin haber tocado la base de datos.
  let participaciones;
  let eventos;
  try {
    participaciones = participacionesDeActa(acta);
    eventos = eventosDeActa(acta);
  } catch (error) {
    if (error instanceof ErrorActa) return fallo(error.message);
    throw error;
  }

  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, partidoId));
  if (!partido) return fallo("Ese partido ya no existe.");

  let campoId: string | null = null;
  if (acta.campoNombre.trim()) {
    const campo = await asegurarCampo(acta.campoNombre, acta.campoPoblacion);
    if (!campo.ok) return campo;
    campoId = campo.datos.id;
  } else if (acta.campoId) {
    campoId = acta.campoId;
  }

  const resultado = await capturar("No se pudo guardar el acta.", async () => {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.partidos)
        .set({
          golesLocal,
          golesVisitante,
          estado: "finalizado",
          ...(campoId ? { campoId } : {}),
        })
        .where(eq(schema.partidos.id, partidoId));

      await tx
        .delete(schema.partidoParticipaciones)
        .where(eq(schema.partidoParticipaciones.partidoId, partidoId));
      await tx.delete(schema.partidoEventos).where(eq(schema.partidoEventos.partidoId, partidoId));

      if (participaciones.length > 0) {
        await tx
          .insert(schema.partidoParticipaciones)
          .values(participaciones.map((p) => ({ ...p, partidoId })));
      }
      if (eventos.length > 0) {
        await tx.insert(schema.partidoEventos).values(eventos.map((e) => ({ ...e, partidoId })));
      }
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
```

- [x] **Paso 4: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/actas.test.ts`
Esperado: 7 pruebas en verde. Las dos de «no toca nada» son las que demuestran que P1 #3 está cerrado.

- [x] **Paso 5: Commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/server
pnpm --filter @santiso/studio exec eslint lib/server
pnpm check
git add apps/studio/lib/server
git commit -m "feat(studio): guardado del acta en una sola transacción" -m "Cierra el hallazgo P1 #3 de la auditoría: el guardado anterior borraba estadísticas y eventos
y después insertaba sin transacción, así que un fallo a medias dejaba el partido vacío." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: Lecturas para las pantallas de actas

Contexto: los tres importadores necesitan la misma información: los partidos de una categoría con los nombres de los equipos, el número de jornada y el campo ya resueltos, más la plantilla y el catálogo de campos. En Supabase eso venía de un `select` con relaciones anidadas; aquí se resuelve con `join`.

**Ficheros:**
- Modificar: `apps/studio/lib/dto.ts`
- Crear: `apps/studio/lib/server/consultas/actas.ts`
- Modificar: `apps/studio/lib/server/acciones/actas.ts`

**Interfaces:**
- Produce:
  - `type PartidoActaDto` con la forma que espera `ActaMatchDb`.
  - `cargarPantallaActa(categoria: string): Promise<{ partidos: PartidoActaDto[]; jugadores: JugadorDto[]; campos: CampoDto[] }>` — una sola llamada.

- [x] **Paso 1: Añadir el DTO**

Añadir al final de `apps/studio/lib/dto.ts`:

```ts
/** @deprecated Ver TemporadaDto. Forma que esperan los importadores de actas. */
export interface PartidoActaDto {
  id: string;
  categoria: string;
  competicion_id: string | null;
  competicion: string | null;
  equipo_local_id: string | null;
  equipo_visitante_id: string | null;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: string | null;
  fecha: string | null;
  campo_id: string | null;
  equipo_local: { nombre: string | null } | null;
  equipo_visitante: { nombre: string | null } | null;
  jornada: { numero: number | null; competicion_id: string | null } | null;
  campo: { nombre: string | null; poblacion: string | null } | null;
}
```

- [x] **Paso 2: Implementar la consulta**

`apps/studio/lib/server/consultas/actas.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { normalizarCategoria } from "@santiso/domain";
import { aliasedTable, desc, eq } from "drizzle-orm";
import type { PartidoActaDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

/**
 * Partidos de una categoría con lo que los importadores necesitan mostrar: nombres de los dos
 * equipos, número de jornada y campo. La categoría la determina la competición de la jornada.
 */
export async function partidosParaActa(categoria: string): Promise<PartidoActaDto[]> {
  const local = aliasedTable(schema.equipos, "equipo_local");
  const visitante = aliasedTable(schema.equipos, "equipo_visitante");

  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.partidos.id,
      categoria: schema.competiciones.categoria,
      competicionId: schema.competiciones.id,
      competicionNombre: schema.competiciones.nombre,
      equipoLocalId: schema.partidos.equipoLocalId,
      equipoVisitanteId: schema.partidos.equipoVisitanteId,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      estado: schema.partidos.estado,
      fecha: schema.partidos.fecha,
      campoId: schema.partidos.campoId,
      nombreLocal: local.nombre,
      nombreVisitante: visitante.nombre,
      jornadaNumero: schema.jornadas.numero,
      campoNombre: schema.campos.nombre,
      campoPoblacion: schema.campos.poblacion,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .innerJoin(schema.competiciones, eq(schema.competiciones.id, schema.jornadas.competicionId))
    .innerJoin(local, eq(local.id, schema.partidos.equipoLocalId))
    .innerJoin(visitante, eq(visitante.id, schema.partidos.equipoVisitanteId))
    .leftJoin(schema.campos, eq(schema.campos.id, schema.partidos.campoId))
    .where(eq(schema.competiciones.categoria, normalizarCategoria(categoria)))
    .orderBy(desc(schema.partidos.fecha));

  return filas.map((f) => ({
    id: f.id,
    categoria: f.categoria,
    competicion_id: f.competicionId,
    competicion: f.competicionNombre,
    equipo_local_id: f.equipoLocalId,
    equipo_visitante_id: f.equipoVisitanteId,
    goles_local: f.golesLocal,
    goles_visitante: f.golesVisitante,
    estado: f.estado,
    fecha: f.fecha,
    campo_id: f.campoId,
    equipo_local: { nombre: f.nombreLocal },
    equipo_visitante: { nombre: f.nombreVisitante },
    jornada: { numero: f.jornadaNumero, competicion_id: f.competicionId },
    campo: f.campoNombre ? { nombre: f.campoNombre, poblacion: f.campoPoblacion } : null,
  }));
}
```

- [x] **Paso 3: Añadir la carga de pantalla a las acciones**

Añadir a `apps/studio/lib/server/acciones/actas.ts`:

```ts
/** Todo lo que necesita un importador de actas, en una sola acción. */
export async function cargarPantallaActa(categoria: string): Promise<{
  partidos: PartidoActaDto[];
  jugadores: JugadorDto[];
  campos: CampoDto[];
}> {
  const [partidos, jugadores, campos] = await Promise.all([
    partidosParaActa(categoria),
    listarJugadores(categoria),
    listarCampos(),
  ]);
  return { partidos, jugadores, campos };
}
```

con los imports correspondientes de `@/lib/server/consultas/actas`, `@/lib/server/consultas/jugadores` y `@/lib/server/consultas/campos`.

- [x] **Paso 4: Comprobar contra los datos reales y commit**

Un script `.ts` en `apps/studio` con `tsx` (envuelto en `main()`) que llame a `partidosParaActa("Senior")` y compruebe que devuelve partidos con los dos nombres de equipo y el número de jornada rellenos, y que el total coincide con los partidos de las competiciones Senior. Borrar el script al terminar.

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib
pnpm --filter @santiso/studio exec eslint lib/server lib/dto.ts
pnpm check
git add apps/studio/lib
git commit -m "feat(studio): lecturas de partidos para los importadores de actas" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: Conectar los tres importadores

Contexto: `AdminActaImporter`, `AdminActaBatch` y `AdminJornadaImporter` comparten forma: cargan partidos, plantilla y campos, dejan revisar y luego guardan. El primero y el segundo guardan actas; el tercero escribe jornadas y partidos, que ya tienen acciones desde 2B-3.

**Ficheros:**
- Modificar: `apps/studio/components/admin/AdminActaImporter.tsx`, `apps/studio/components/admin/AdminActaBatch.tsx`, `apps/studio/components/admin/AdminJornadaImporter.tsx`
- Borrar: `apps/studio/lib/actas/save-acta.ts`

- [x] **Paso 1: Sustituir las lecturas**

En los tres, la carga inicial pasa a **una** llamada a `cargarPantallaActa(categoria)` (o, en el importador de jornada, a `cargarPantallaCalendario` más `cargarCampos`). Se eliminan los `Promise.all` de varias consultas a Supabase: Next las serializaría igual y una sola acción es un único viaje.

- [x] **Paso 2: Sustituir el guardado del acta**

`saveReviewedActa({ supabase, partidoId, acta })` pasa a `guardarActa(partidoId, acta)`, que devuelve `Resultado<null>`:

```ts
const resultado = await guardarActa(partidoId, acta);
if (!resultado.ok) {
  showToast(resultado.error, "error");
  return;
}
```

Son tres puntos de llamada: `AdminActaImporter.tsx:548`, `AdminActaBatch.tsx:385` y `AdminActaBatch.tsx:698`. El tercero está dentro del guardado en lote: ahí el error debe marcar **esa fila** como fallida y dejar que el resto siga, que es justo lo que pide la auditoría (§8.1).

- [x] **Paso 3: Sustituir las escrituras del importador de jornada**

`AdminJornadaImporter` crea jornadas, crea o actualiza partidos y registra campos. Usa `crearJornada`, `crearPartido`, `guardarMarcador`, `cambiarFechaPartido`, `cambiarCampoPartido` y `asegurarCampo`, todas ya existentes. La creación de campo por nombre se resuelve con `asegurarCampo`, que ya hace «buscar o crear» y rellena la población si faltaba.

- [x] **Paso 4: Borrar el guardado antiguo**

```bash
rm apps/studio/lib/actas/save-acta.ts
grep -rn "save-acta\|saveReviewedActa" apps --include="*.ts" --include="*.tsx"
```

Esperado: sin resultados.

- [x] **Paso 5: Comprobar en el navegador**

Con `pnpm dev`, pestañas **Actas** y **Jornada**:
- La lista de partidos sale con los nombres de los dos equipos y el número de jornada.
- El desplegable de plantilla trae los jugadores de la categoría.
- No hace falta importar un acta real para validar la pantalla; lo que sí hay que comprobar es que **carga sin errores de JavaScript y sin peticiones a `supabase.co`**.

- [x] **Paso 6: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib
pnpm --filter @santiso/studio exec eslint lib
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1
pnpm check
pnpm e2e
git add apps/studio
git commit -m "feat(studio): importadores de actas y jornada sobre SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 5: Datos de carteles

Contexto: quedan tres piezas. `useCartelAssets` lee `cartel_assets` y el escudo de Storage; `clasificacion-data.ts` duplica el cálculo de la clasificación; y `useCartelForm` lee jugadores, equipos, campos, partidos, eventos y estadísticas.

Dos avisos concretos:
- **`xuntaIsLeft`** comparaba con el valor antiguo `"xunta_left"`. El valor nuevo es `"xunta_izquierda"`. Si se olvida, el orden de los logos se invierte en todos los carteles sin que nada falle.
- **Los eventos cambian de forma.** `es_rival` + `nombre_mostrado` pasan a `lado` + `propia` + `nombreRival`, y la deducción que hacía el hook (`esPropiaSantiso = es_rival && jugador && nombre === "En propia"`) ya no hace falta: ahora `propia` es una columna.

**Ficheros:**
- Modificar: `apps/studio/components/admin/cartel/useCartelAssets.ts`, `apps/studio/components/admin/cartel/useCartelForm.ts`, `apps/studio/lib/cartel/clasificacion-data.ts`
- Modificar: `apps/studio/lib/server/consultas/actas.ts` (añadir `eventosDePartido`, `participacionesDePartido`)

- [x] **Paso 1: Apuntar `useCartelAssets` a los ajustes**

Sustituir el cuerpo de `loadAssets` por una llamada a `cargarAjustesCartel()` (2B-2) y mapear:

```ts
      const resultado = await cargarAjustesCartel();
      if (!resultado.ok) {
        setAssetUrls(DEFAULT_URLS);
        return;
      }
      const { escudoClub, logoXunta, logoRfgf, ordenLogos, patrocinadores } = resultado.datos;
      setAssetUrls({
        xunta: logoXunta ?? "",
        rfgf: logoRfgf ?? "",
        // El valor antiguo era "xunta_left"; el nuevo, "xunta_izquierda".
        xuntaIsLeft: ordenLogos !== "rfgf_izquierda",
        santiso: escudoClub ?? "",
        sponsors: patrocinadores
          .map((p) => p.logo_url)
          .filter((u): u is string => Boolean(u)),
      });
```

`listarPatrocinadores(true)` ya devuelve los logos ordenados por `orden`, así que el `sort` del hook desaparece.

- [x] **Paso 2: Apuntar la clasificación del cartel al dominio**

En `lib/cartel/clasificacion-data.ts`, sustituir todo el cálculo (desde `const withStats = ...` hasta el `sorted`) por una llamada a `calcularClasificacion` del dominio, y quedarse con el mapeo a la forma que espera el cartel (`equipo_id`, `nombre`, `escudo_url`, `pj`, `pg`, `pe`, `pp`, `gf`, `gc`, `pts`).

Conservar la rama de `formato === "eliminatoria"`, que devuelve rondas en vez de tabla, y `isCompletedMatch`: **pero ya no hace falta**, porque tras la migración un partido con marcador es un partido finalizado (R8). Usar directamente los partidos que devuelve `listarPartidosDeCompeticion` (2B-3) y dejar que el dominio filtre.

Al terminar, `lib/cartel/clasificacion-data.ts` no debe contener ninguna suma de puntos: solo lectura y mapeo.

- [x] **Paso 3: Añadir las lecturas de eventos y convocatoria**

Añadir a `apps/studio/lib/server/consultas/actas.ts`:

```ts
/** Eventos de un partido con los nombres ya resueltos, para la cronología del cartel. */
export async function eventosDePartido(partidoId: string) {
  const entra = aliasedTable(schema.jugadores, "jugador_entra");
  const sale = aliasedTable(schema.jugadores, "jugador_sale");

  const { db } = await obtenerDb();
  return db
    .select({
      id: schema.partidoEventos.id,
      tipo: schema.partidoEventos.tipo,
      lado: schema.partidoEventos.lado,
      propia: schema.partidoEventos.propia,
      minuto: schema.partidoEventos.minuto,
      nombreRival: schema.partidoEventos.nombreRival,
      jugadorNombre: entra.nombre,
      jugadorApodo: entra.apodo,
      saleNombre: sale.nombre,
      saleApodo: sale.apodo,
    })
    .from(schema.partidoEventos)
    .leftJoin(entra, eq(entra.id, schema.partidoEventos.jugadorId))
    .leftJoin(sale, eq(sale.id, schema.partidoEventos.jugadorSaleId))
    .where(eq(schema.partidoEventos.partidoId, partidoId))
    .orderBy(asc(schema.partidoEventos.minuto));
}

/** Convocatoria de un partido con dorsal y nombre, para el once del cartel. */
export async function participacionesDePartido(partidoId: string) {
  const { db } = await obtenerDb();
  return db
    .select({
      titular: schema.partidoParticipaciones.titular,
      jugo: schema.partidoParticipaciones.jugo,
      id: schema.jugadores.id,
      nombre: schema.jugadores.nombre,
      apodo: schema.jugadores.apodo,
      dorsal: schema.jugadores.dorsal,
      categoria: schema.jugadores.categoria,
    })
    .from(schema.partidoParticipaciones)
    .innerJoin(schema.jugadores, eq(schema.jugadores.id, schema.partidoParticipaciones.jugadorId))
    .where(eq(schema.partidoParticipaciones.partidoId, partidoId))
    .orderBy(desc(schema.partidoParticipaciones.titular), asc(schema.jugadores.dorsal));
}
```

Requiere añadir `asc` al import de `drizzle-orm` del fichero. Sus envoltorios `"use server"` en `acciones/actas.ts` son dos funciones de una línea que simplemente los reexportan, como `cargarEquiposDeCompeticion` en 2B-2.

- [x] **Paso 4: Conectar `useCartelForm`**

- Jugadores, equipos y campos: de las acciones ya existentes (`cargarJugadores`, `cargarEquiposDeCategoria`, `cargarCampos`).
- Partidos del selector: de `partidosParaActa`, que ya trae nombres de equipo y jornada.
- Cronología: de `eventosDePartido`. El mapeo a `CronEvent` se simplifica, porque `propia` deja de deducirse:

```ts
          let tipo = mapDbEventType(fila.tipo);
          if (tipo === "gol" && fila.propia) tipo = "propia";
          const esRival = fila.lado === "rival";
```

- Once: de `participacionesDePartido`, con el mismo criterio de orden (titulares primero, luego por dorsal).

- [x] **Paso 5: Comprobar los carteles contra las referencias**

Con `pnpm dev`, generar los carteles que cubren las capturas de `data/referencias/antes-fase-2/`: `partido`, `proximos` y `resumo`. Compararlos a ojo con las referencias. Debe coincidir **todo**: escudos, logos institucionales, orden de los logos, patrocinadores de la barra inferior y, en el de clasificación, el orden de la tabla salvo donde el desempate por mini-liga (2B-3) lo corrija.

Anotar cualquier diferencia. Las cuatro plantillas sin captura de referencia (`clasificacion`, `cronoloxia`, `multiusos`, `noso11`) se revisan a ojo contra lo que se esperaría.

- [x] **Paso 6: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib
pnpm --filter @santiso/studio exec eslint lib
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1
pnpm check
pnpm e2e
git add apps/studio
git commit -m "feat(studio): datos de carteles sobre SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final de la subfase

- [x] `pnpm check` en verde.
- [x] `pnpm build` correcto.
- [x] `pnpm e2e` en verde.
- [x] `grep -rn "supabase" apps/studio/components apps/studio/lib --include="*.ts" --include="*.tsx"` deja **solo** `AdminShield.tsx` (el `signOut`, que se retira en 2C) y el nombre del fichero `supabase-queries.ts`.
- [x] `apps/studio/lib/actas/save-acta.ts` ya no existe.
- [x] La línea base de ESLint de la app no supera los **97 problemas**.
- [x] `git status --short` limpio y sin `data/` ni `.env.local`.
- [x] Los carteles `partido`, `proximos` y `resumo` coinciden con las capturas de referencia.

## Hallazgos de la ejecución

- **La comparación de carteles no prueba lo que parece.** `scripts/render-cartel.ts` dibuja
  desde datos fijos dentro del propio script, no de la base de datos. Que los 5 carteles salgan
  idénticos byte a byte a las referencias demuestra que el motor de dibujo y las plantillas no
  han cambiado, pero **no** verifica el camino de datos. Eso se comprobó aparte, abriendo el
  generador con datos reales: el lienzo de 2160x2700 se pinta entero y el formulario trae
  rivales reales de la base de datos.
- **`components/ui/BracketTree.tsx` era código muerto.** No lo importaba nadie y consultaba el
  esquema antiguo (`jornadas.categoria`), así que ya estaba roto contra la base nueva. Se borró
  en vez de migrarlo; mantenerlo habría obligado a dejar vivo `lib/supabase.ts` en la 2C.
- **El importador en lote y el generador trabajan con las tres categorías**, no con una. Por eso
  `partidosParaActa` y `listarJugadores` aceptan la categoría como opcional.

## Lo que queda para 2C

- Retirar el login: `app/login/`, `proxy.ts`, el `signOut` de `AdminShield`, `lib/supabase*`, las dependencias `@supabase/*` y las variables de entorno.
- Quitar `images.remotePatterns` de `next.config.ts`, que apunta a `**.supabase.co`.
- Retirar `lib/data/season-2026-2027.ts`, que `useCompeticiones` y `useCartelForm` usan como respaldo y que enmascara fallos de lectura.
- Renombrar `lib/supabase-queries.ts`, que ya no habla con Supabase.
- Borrar `legacy/supabase/` y el `DEV_AUTH_BYPASS` de `.env.local`.
- Verificación final contra las capturas de referencia.
