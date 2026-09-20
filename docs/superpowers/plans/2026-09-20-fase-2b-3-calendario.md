# Fase 2B-3 — Calendario sobre SQLite: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [x]`) para el seguimiento.

**Objetivo:** que jornadas, partidos y descansos se lean y escriban **solo** en SQLite, y unificar el cálculo de la clasificación, que hoy existe por duplicado con reglas distintas.

**Arquitectura:** la misma de 2B-1 y 2B-2 (`consultas/` con `server-only`, `acciones/` con `"use server"`, DTO de compatibilidad, una función de carga por pantalla).

**Stack:** Next.js 16.3.5 · React 19.3.0 · Drizzle ORM 0.45.2 + @libsql/client 0.18.0 · Zod 4.6.4 · Vitest 4.1.11 · @playwright/test 1.61.1 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). Leer §4 (D6 capa de datos, D12 clasificación calculada), §6.2 (cambios de esquema) y §8 «Fase 2».

**Planes anteriores:** [`2026-09-20-fase-2b-1-catalogos.md`](2026-09-20-fase-2b-1-catalogos.md) y [`2026-09-20-fase-2b-2-media.md`](2026-09-20-fase-2b-2-media.md).

**Por qué 2B se parte en cuatro:** el alcance restante no cabe en un plan revisable. Esta subfase cubre el calendario; **2B-4** cubrirá las actas (guardado transaccional e importadores) y los datos de carteles. Este plan no toca `AdminActaImporter`, `AdminActaBatch`, `AdminJornadaImporter`, `useCartelForm`, `useCartelAssets` ni `lib/actas/save-acta.ts`.

## Restricciones globales

- **Supabase sigue congelada** desde el 20/09/2026. La app no se usa para datos reales hasta que 2B-4 termine.
- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash (sintaxis POSIX).
- TypeScript 5.9.3. Antes de usar una API de Next, leer su guía en `apps/studio/node_modules/next/dist/docs/`.
- Drizzle: solo el query builder core. Prohibido `db.query.*`.
- **Un módulo con `server-only` no puede importarse desde un componente cliente.** Las lecturas que consume el navegador pasan por una acción `"use server"`. Rompe el build, no las pruebas.
- **Next despacha las Server Actions de una en una por cliente.** Una función de carga por pantalla; nada de `Promise.all` sobre varias acciones desde el cliente.
- **Las acciones de guardado reescriben la fila entera.** Quien actualice un solo campo debe reenviar el resto, o se vacían. En este plan las acciones de partido son de campo único **a propósito** y así se documenta.
- Toda operación que toca varias tablas va en **una** transacción.
- **Prettier y ESLint solo sobre los ficheros nuevos.** `apps/studio` está en `.prettierignore`. El control es que la línea base de ESLint **no suba**: hoy está en **100 problemas**.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto.
- libSQL no libera el fichero de BD hasta que termina el proceso. Parar `pnpm dev` antes de tocarlo; en Windows hay que matar el proceso que escucha en el 3000.
- Dominio en español. Sin `any`. `as` solo con un comentario que lo justifique. Sin `catch` vacíos.
- `pnpm check` en verde antes de cada commit. `pnpm e2e` al cerrar cada tarea que cambie una pantalla.
- Cada commit en Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Restricciones del esquema que la pantalla actual no respeta

`partidos` tiene CHECK que la interfaz de hoy puede violar, porque deja tocar estado y marcador por separado. Las acciones tienen que comprobarlo **antes** de escribir y devolver un mensaje entendible, en vez de dejar que SQLite lance un error opaco:

| CHECK | Qué impide |
| --- | --- |
| `partidos_marcador_completo_ck` | Un marcador a medias: o los dos goles son `null`, o ninguno. |
| `partidos_finalizado_con_marcador_ck` | Marcar `finalizado` un partido sin marcador. |
| `partidos_goles_no_negativos_ck` | Goles negativos. |
| `partidos_equipos_distintos_ck` | Local y visitante iguales. |
| `partidos_jornada_cruce_uq` | Repetir el mismo cruce en la misma jornada. |
| `jornadas_competicion_numero_uq` | Repetir número de jornada en una competición. |
| `jornadas_numero_ck` | Número de jornada ≤ 0. |

## Mapa de ficheros

```
santiso/
├─ packages/domain/src/
│  └─ clasificacion.ts / .test.ts          (mod) desempate por enfrentamiento directo
├─ apps/studio/
│  ├─ lib/dto.ts                           (mod) JornadaDto, PartidoDto, DescansoDto
│  ├─ lib/server/consultas/calendario.ts   (nuevo) listarJornadas, listarPartidos, listarDescansos
│  ├─ lib/server/acciones/calendario.ts / .test.ts (nuevo) carga y mutaciones
│  ├─ lib/supabase-queries.ts              (mod) fetchMatchdaysForCompetition, fetchMatchesForMatchday
│  ├─ components/admin/AdminJornadas.tsx   (mod)
│  └─ e2e/calendario.spec.ts               (nuevo)
```

---

### Tarea 1: Una sola clasificación, con enfrentamiento directo

Contexto: hoy hay **dos** clasificaciones distintas en la aplicación. `calcularClasificacion` (Fase 2B-1, pantalla de Ligas) desempata por puntos → diferencia de goles → goles a favor. `lib/cartel/clasificacion-data.ts` (el cartel de clasificación, que es lo que se publica) desempata por puntos → **enfrentamiento directo** → diferencia → goles a favor. Que la tabla en pantalla y la del cartel puedan diferir es un fallo, y lo introdujo la 2B-1 al no mirar el segundo.

El desempate bueno es el del cartel: es el que se ha venido publicando. Esta tarea lo lleva al dominio para que haya una única fuente. 2B-4 apunta el cartel a esta misma función y borra el cálculo duplicado.

Aviso sobre el método: el enfrentamiento directo **no es transitivo** (A puede ganar a B, B a C y C a A), así que aplicado dentro de un comparador no define un orden total y el resultado puede depender del orden de entrada. Es lo que hace hoy la aplicación y esta tarea lo reproduce tal cual; los desempates configurables por competición son de la Fase 4. Para que el resultado sea al menos **estable**, la entrada se ordena primero por los criterios transitivos y el desempate directo se aplica encima.

**Ficheros:**
- Modificar: `packages/domain/src/clasificacion.ts`, `packages/domain/src/clasificacion.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `calcularClasificacion(equipoIds, partidos)` con el mismo tipo de antes; cambia solo el orden del resultado.

- [x] **Paso 1: Escribir las pruebas que fallan**

Añadir a `packages/domain/src/clasificacion.test.ts`, antes del cierre del `describe`:

```ts
  it("con los mismos puntos, gana quien ganó el enfrentamiento directo", () => {
    // a y b empatan a 3 puntos y a diferencia; b le ganó a a, así que b va primero.
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 2, 1), finalizado("b", "y", 2, 1)],
    );
    expect(tabla.slice(0, 2).map((f) => f.equipoId)).toEqual(["b", "a"]);
  });

  it("el enfrentamiento directo manda sobre la diferencia de goles", () => {
    // a: 3 pts DG +5 · b: 3 pts DG +1, pero b ganó el directo.
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 6, 0), finalizado("b", "y", 2, 1)],
    );
    expect(tabla.slice(0, 2).map((f) => f.equipoId)).toEqual(["b", "a"]);
  });

  it("con ida y vuelta cuenta el balance de los dos partidos", () => {
    // a gana 3-0 y b gana 1-0: cada uno suma 3 puntos en el cruce, así que decide el gol
    // average del directo, que es +2 para a.
    const tabla = calcularClasificacion(
      ["a", "b"],
      [finalizado("a", "b", 3, 0), finalizado("b", "a", 1, 0)],
    );
    expect(tabla.map((f) => f.equipoId)).toEqual(["a", "b"]);
  });

  it("si el directo también empata, decide la diferencia de goles", () => {
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("a", "b", 1, 1), finalizado("a", "x", 5, 0), finalizado("b", "y", 1, 0)],
    );
    // a: 4 pts DG +5 · b: 4 pts DG +1 · directo empatado → manda la diferencia.
    expect(tabla.slice(0, 2).map((f) => f.equipoId)).toEqual(["a", "b"]);
  });

  it("no aplica el directo cuando los puntos difieren", () => {
    // b ganó el directo pero a tiene más puntos: a va primero igualmente.
    const tabla = calcularClasificacion(
      ["a", "b", "x", "y"],
      [finalizado("b", "a", 1, 0), finalizado("a", "x", 1, 0), finalizado("a", "y", 1, 0)],
    );
    expect(tabla[0]?.equipoId).toBe("a");
  });
```

- [x] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run packages/domain/src/clasificacion.test.ts`
Esperado: FAIL en las pruebas del enfrentamiento directo; las anteriores siguen en verde, porque sus equipos no se enfrentan entre sí.

- [x] **Paso 3: Implementar**

En `packages/domain/src/clasificacion.ts`, sustituir el bloque `return [...tabla.values()]…` final por:

```ts
  const filas = [...tabla.values()].map((linea) => ({
    ...linea,
    diferencia: linea.golesFavor - linea.golesContra,
  }));

  // Orden base por los criterios transitivos: así el resultado es estable aunque el
  // enfrentamiento directo (que no lo es) no llegue a definir un orden total.
  filas.sort(
    (a, b) =>
      b.puntos - a.puntos ||
      b.diferencia - a.diferencia ||
      b.golesFavor - a.golesFavor ||
      a.equipoId.localeCompare(b.equipoId),
  );

  const disputados = partidos.filter(
    (p) => p.estado === "finalizado" && p.golesLocal !== null && p.golesVisitante !== null,
  );
  filas.sort((a, b) => {
    if (a.puntos !== b.puntos) return b.puntos - a.puntos;
    const directo = balanceDirecto(a.equipoId, b.equipoId, disputados);
    if (directo !== 0) return directo;
    return (
      b.diferencia - a.diferencia ||
      b.golesFavor - a.golesFavor ||
      a.equipoId.localeCompare(b.equipoId)
    );
  });
  return filas;
}

/**
 * Compara dos equipos por lo que hicieron entre ellos: primero los puntos de esos partidos y,
 * si empatan, el gol average del cruce. Devuelve un número al estilo de `Array.sort`
 * (negativo = `a` primero) y `0` cuando no se han enfrentado o quedaron igualados.
 */
function balanceDirecto(
  a: string,
  b: string,
  disputados: readonly PartidoClasificacion[],
): number {
  let puntosA = 0;
  let puntosB = 0;
  let golesA = 0;
  let golesB = 0;
  let encuentros = 0;

  for (const partido of disputados) {
    const aEsLocal = partido.equipoLocalId === a && partido.equipoVisitanteId === b;
    const bEsLocal = partido.equipoLocalId === b && partido.equipoVisitanteId === a;
    if (!aEsLocal && !bEsLocal) continue;
    encuentros++;

    const golesLocal = partido.golesLocal ?? 0;
    const golesVisitante = partido.golesVisitante ?? 0;
    const deA = aEsLocal ? golesLocal : golesVisitante;
    const deB = aEsLocal ? golesVisitante : golesLocal;
    golesA += deA;
    golesB += deB;
    if (deA > deB) puntosA += 3;
    else if (deB > deA) puntosB += 3;
    else {
      puntosA++;
      puntosB++;
    }
  }

  if (encuentros === 0) return 0;
  if (puntosA !== puntosB) return puntosB - puntosA;
  return golesB - golesA;
}
```

Ampliar además el comentario de cabecera de `calcularClasificacion` para que diga:

```
 * Desempates, en este orden: puntos, enfrentamiento directo (puntos del cruce y luego su gol
 * average), diferencia de goles, goles a favor y, por último, id. El enfrentamiento directo es
 * el criterio que ha venido usando el cartel de clasificación; no es transitivo, así que la
 * lista se ordena antes por los criterios que sí lo son para que el resultado sea estable.
```

- [x] **Paso 4: Ejecutar las pruebas y commit**

```bash
pnpm exec vitest run packages/domain
pnpm check
git add packages/domain/src/clasificacion.ts packages/domain/src/clasificacion.test.ts
git commit -m "feat(domain): desempate por enfrentamiento directo en la clasificación" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: las 13 pruebas del fichero en verde (8 previas más 5 nuevas).

- [x] **Paso 5: Comprobar el efecto sobre los datos reales**

Con el servidor parado, un script `.ts` en `apps/studio` ejecutado con `pnpm --filter @santiso/studio exec tsx` (envuelto en `main()`, porque el paquete no es ESM) que recorra las competiciones de la temporada 2025/26, calcule la tabla y compruebe la coherencia interna: `GF total == GC total`, `puntos == 3×PG + PE`, `PG total == PP total` y `suma PJ == 2 × partidos disputados`. Borrar el script al terminar.

Esperado: todas correctas, igual que antes del cambio. El desempate solo reordena empatados a puntos; no altera ningún recuento. Anotar si el orden de alguna competición cambia respecto al criterio anterior: es el efecto buscado.

---

### Tarea 2: Consultas y acciones de calendario

Contexto: tres tablas cambian de forma. `jornadas` pierde `temporada_id` y `categoria` (los determina la competición). `jornada_equipo_descanso` pasa a `jornada_descansos` con **clave primaria compuesta y sin columna `id`**, así que quitar un descanso deja de identificarse por `id` y pasa a hacerse por `(jornadaId, equipoId)`. Y `partidos_liga` pasa a `partidos`, también sin `categoria` ni `competicion_id`.

**Ficheros:**
- Modificar: `apps/studio/lib/dto.ts`
- Crear: `apps/studio/lib/server/consultas/calendario.ts`
- Crear: `apps/studio/lib/server/acciones/calendario.ts`, `apps/studio/lib/server/acciones/calendario.test.ts`
- Modificar: `apps/studio/lib/supabase-queries.ts`

**Interfaces:**
- Consume: `equiposDeCompeticion` (2B-1); `buscarCampoPorNombre`, `listarCampos` (2B-1); `ESTADOS_PARTIDO`, `esValorDe` (`@santiso/domain`).
- Produce:
  - `type JornadaDto = { id, numero, nombre_fase, fecha_inicio, fecha_fin, competicion_id }`
  - `type PartidoDto = { id, jornada_id, equipo_local_id, equipo_visitante_id, goles_local, goles_visitante, estado, fecha, campo_id }`
  - `type DescansoDto = { jornada_id, equipo_id }`
  - `cargarPantallaCalendario(competicionId, jornadaId)` — **una sola llamada**: jornadas, partidos de la jornada, descansos, equipos inscritos y campos.
  - `crearJornada(entrada)`, `crearJornadasEnLote(competicionId, hasta)`, `borrarJornada(id)`
  - `anadirDescanso(jornadaId, equipoId)`, `quitarDescanso(jornadaId, equipoId)`
  - `crearPartido(entrada)`, `guardarMarcador(id, local, visitante)`, `cambiarEstadoPartido(id, estado)`, `cambiarFechaPartido(id, fecha)`, `cambiarCampoPartido(id, campoId)`, `borrarPartido(id)`

- [x] **Paso 1: Añadir los DTO**

Añadir al final de `apps/studio/lib/dto.ts`:

```ts
/** @deprecated Ver TemporadaDto. Sin `temporada_id` ni `categoria`: los da la competición. */
export interface JornadaDto {
  id: string;
  numero: number;
  nombre_fase: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  competicion_id: string;
}

/** @deprecated Ver TemporadaDto. Sin `categoria` ni `competicion_id`: los da la jornada. */
export interface PartidoDto {
  id: string;
  jornada_id: string;
  equipo_local_id: string;
  equipo_visitante_id: string;
  goles_local: number | null;
  goles_visitante: number | null;
  estado: string;
  fecha: string | null;
  campo_id: string | null;
}

/** El descanso ya no tiene id propio: lo identifica el par (jornada, equipo). */
export interface DescansoDto {
  jornada_id: string;
  equipo_id: string;
}

/** Todo lo que necesita la pantalla de calendario en una sola respuesta. */
export interface PantallaCalendario {
  jornadas: JornadaDto[];
  partidos: PartidoDto[];
  descansos: DescansoDto[];
  equipos: EquipoDto[];
  campos: CampoDto[];
}
```

- [x] **Paso 2: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/calendario.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con temporada activa, una competición y tres equipos inscritos. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-calendario-"));
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
      { nombre: "Alfa", clave: "alfa", categoria: "Senior" },
      { nombre: "Beta", clave: "beta", categoria: "Senior" },
      { nombre: "Gamma", clave: "gamma", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id, nombre: bd.schema.equipos.nombre });
  await db
    .insert(bd.schema.competicionEquipos)
    .values(equipos.map((e) => ({ competicionId: competicion.id, equipoId: e.id })));
  cerrar();

  const idDe = (nombre: string) => {
    const encontrado = equipos.find((e) => e.nombre === nombre);
    if (!encontrado) throw new Error(`sin equipo ${nombre}`);
    return encontrado.id;
  };
  return { acciones: await import("./calendario"), competicionId: competicion.id, idDe };
}

describe("acciones de calendario", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea una jornada y la lista", async () => {
    const { acciones, competicionId } = await entorno();
    expect(
      await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: true, datos: { numero: 1, nombre_fase: null, fecha_inicio: null } });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas.map((j) => j.numero)).toEqual([1]);
    expect(pantalla.equipos).toHaveLength(3);
  });

  it("rechaza una jornada con número repetido", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" });
    expect(
      await acciones.crearJornada({ competicionId, numero: "1", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false, error: "Ya existe la jornada 1 en esta competición." });
  });

  it("rechaza un número de jornada que no es positivo", async () => {
    const { acciones, competicionId } = await entorno();
    expect(
      await acciones.crearJornada({ competicionId, numero: "0", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false });
    expect(
      await acciones.crearJornada({ competicionId, numero: "no", fechaInicio: "", nombreFase: "" }),
    ).toMatchObject({ ok: false });
  });

  it("crea en lote solo las jornadas que faltan", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornada({ competicionId, numero: "2", fechaInicio: "", nombreFase: "" });

    expect(await acciones.crearJornadasEnLote(competicionId, 4)).toEqual({ ok: true, datos: 3 });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas.map((j) => j.numero)).toEqual([1, 2, 3, 4]);
  });

  it("crear en lote cuando ya están todas no crea ninguna", async () => {
    const { acciones, competicionId } = await entorno();
    await acciones.crearJornadasEnLote(competicionId, 2);
    expect(await acciones.crearJornadasEnLote(competicionId, 2)).toEqual({ ok: true, datos: 0 });
  });

  it("crea un partido y lo lista en su jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");

    expect(
      await acciones.crearPartido({
        jornadaId: jornada.datos.id,
        equipoLocalId: idDe("Alfa"),
        equipoVisitanteId: idDe("Beta"),
        fecha: "2026-09-20T18:00",
        campoId: "",
      }),
    ).toMatchObject({
      ok: true,
      datos: { estado: "programado", goles_local: null, goles_visitante: null },
    });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, jornada.datos.id);
    expect(pantalla.partidos).toHaveLength(1);
  });

  it("rechaza un partido con el mismo equipo a los dos lados", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");

    expect(
      await acciones.crearPartido({
        jornadaId: jornada.datos.id,
        equipoLocalId: idDe("Alfa"),
        equipoVisitanteId: idDe("Alfa"),
        fecha: "",
        campoId: "",
      }),
    ).toMatchObject({ ok: false });
  });

  it("rechaza repetir el mismo cruce en la misma jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const cruce = {
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    };
    await acciones.crearPartido(cruce);
    expect(await acciones.crearPartido(cruce)).toMatchObject({ ok: false });
  });

  it("guarda un marcador completo y deja el partido finalizado", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const partido = await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.guardarMarcador(partido.datos.id, "2", "1")).toMatchObject({
      ok: true,
      datos: { goles_local: 2, goles_visitante: 1, estado: "finalizado" },
    });
  });

  it("borrar el marcador devuelve el partido a programado", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const partido = await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");
    await acciones.guardarMarcador(partido.datos.id, "2", "1");

    expect(await acciones.guardarMarcador(partido.datos.id, "", "")).toMatchObject({
      ok: true,
      datos: { goles_local: null, goles_visitante: null, estado: "programado" },
    });
  });

  it("rechaza un marcador a medias", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const partido = await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.guardarMarcador(partido.datos.id, "2", "")).toMatchObject({
      ok: false,
      error: "El marcador debe tener los dos goles o ninguno.",
    });
    expect(await acciones.guardarMarcador(partido.datos.id, "-1", "0")).toMatchObject({
      ok: false,
    });
  });

  it("se niega a marcar finalizado un partido sin marcador", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const partido = await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "finalizado")).toMatchObject({
      ok: false,
      error: "Un partido finalizado necesita marcador.",
    });
    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "aplazado")).toEqual({
      ok: true,
      datos: null,
    });
    expect(await acciones.cambiarEstadoPartido(partido.datos.id, "inventado")).toMatchObject({
      ok: false,
    });
  });

  it("añade y quita descansos por par (jornada, equipo)", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");

    expect(await acciones.anadirDescanso(jornada.datos.id, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });
    // Repetirlo no falla: la clave primaria compuesta lo absorbe.
    expect(await acciones.anadirDescanso(jornada.datos.id, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });

    let pantalla = await acciones.cargarPantallaCalendario(competicionId, jornada.datos.id);
    expect(pantalla.descansos).toHaveLength(1);

    expect(await acciones.quitarDescanso(jornada.datos.id, idDe("Gamma"))).toEqual({
      ok: true,
      datos: null,
    });
    pantalla = await acciones.cargarPantallaCalendario(competicionId, jornada.datos.id);
    expect(pantalla.descansos).toHaveLength(0);
  });

  it("se niega a dar descanso a un equipo que ya juega esa jornada", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });

    expect(await acciones.anadirDescanso(jornada.datos.id, idDe("Alfa"))).toMatchObject({
      ok: false,
      error: "Ese equipo ya tiene partido en esta jornada.",
    });
  });

  it("borrar una jornada se lleva sus partidos y descansos", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    await acciones.anadirDescanso(jornada.datos.id, idDe("Gamma"));

    expect(await acciones.borrarJornada(jornada.datos.id)).toEqual({ ok: true, datos: null });

    const pantalla = await acciones.cargarPantallaCalendario(competicionId, "");
    expect(pantalla.jornadas).toHaveLength(0);
    expect(pantalla.partidos).toHaveLength(0);
  });

  it("borra un partido suelto", async () => {
    const { acciones, competicionId, idDe } = await entorno();
    const jornada = await acciones.crearJornada({
      competicionId,
      numero: "1",
      fechaInicio: "",
      nombreFase: "",
    });
    if (!jornada.ok) throw new Error("sin jornada");
    const partido = await acciones.crearPartido({
      jornadaId: jornada.datos.id,
      equipoLocalId: idDe("Alfa"),
      equipoVisitanteId: idDe("Beta"),
      fecha: "",
      campoId: "",
    });
    if (!partido.ok) throw new Error("sin partido");

    expect(await acciones.borrarPartido(partido.datos.id)).toEqual({ ok: true, datos: null });
    const pantalla = await acciones.cargarPantallaCalendario(competicionId, jornada.datos.id);
    expect(pantalla.partidos).toHaveLength(0);
  });
});
```

- [x] **Paso 3: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/calendario.test.ts`
Esperado: FAIL, el módulo `./calendario` no existe.

- [x] **Paso 4: Implementar la consulta**

`apps/studio/lib/server/consultas/calendario.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { asc, eq } from "drizzle-orm";
import type { DescansoDto, JornadaDto, PartidoDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

/** Se exportan para que las acciones usen exactamente las mismas columnas en sus `returning`. */
export const COLUMNAS_JORNADA = {
  id: schema.jornadas.id,
  numero: schema.jornadas.numero,
  nombreFase: schema.jornadas.nombreFase,
  fechaInicio: schema.jornadas.fechaInicio,
  fechaFin: schema.jornadas.fechaFin,
  competicionId: schema.jornadas.competicionId,
};

export const COLUMNAS_PARTIDO = {
  id: schema.partidos.id,
  jornadaId: schema.partidos.jornadaId,
  equipoLocalId: schema.partidos.equipoLocalId,
  equipoVisitanteId: schema.partidos.equipoVisitanteId,
  golesLocal: schema.partidos.golesLocal,
  golesVisitante: schema.partidos.golesVisitante,
  estado: schema.partidos.estado,
  fecha: schema.partidos.fecha,
  campoId: schema.partidos.campoId,
};

export const aJornadaDto = (f: {
  id: string;
  numero: number;
  nombreFase: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  competicionId: string;
}): JornadaDto => ({
  id: f.id,
  numero: f.numero,
  nombre_fase: f.nombreFase,
  fecha_inicio: f.fechaInicio,
  fecha_fin: f.fechaFin,
  competicion_id: f.competicionId,
});

export const aPartidoDto = (f: {
  id: string;
  jornadaId: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: string;
  fecha: string | null;
  campoId: string | null;
}): PartidoDto => ({
  id: f.id,
  jornada_id: f.jornadaId,
  equipo_local_id: f.equipoLocalId,
  equipo_visitante_id: f.equipoVisitanteId,
  goles_local: f.golesLocal,
  goles_visitante: f.golesVisitante,
  estado: f.estado,
  fecha: f.fecha,
  campo_id: f.campoId,
});

/** Jornadas de una competición, por número. */
export async function listarJornadas(competicionId: string): Promise<JornadaDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_JORNADA)
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.jornadas.numero));
  return filas.map(aJornadaDto);
}

/** Partidos de una jornada, por fecha. */
export async function listarPartidos(jornadaId: string): Promise<PartidoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_PARTIDO)
    .from(schema.partidos)
    .where(eq(schema.partidos.jornadaId, jornadaId))
    .orderBy(asc(schema.partidos.fecha));
  return filas.map(aPartidoDto);
}

/** Todos los partidos de una competición: lo que necesita la clasificación. */
export async function listarPartidosDeCompeticion(competicionId: string): Promise<PartidoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(COLUMNAS_PARTIDO)
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .where(eq(schema.jornadas.competicionId, competicionId))
    .orderBy(asc(schema.partidos.fecha));
  return filas.map(aPartidoDto);
}

export async function listarDescansos(jornadaId: string): Promise<DescansoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      jornadaId: schema.jornadaDescansos.jornadaId,
      equipoId: schema.jornadaDescansos.equipoId,
    })
    .from(schema.jornadaDescansos)
    .where(eq(schema.jornadaDescansos.jornadaId, jornadaId));
  return filas.map((f) => ({ jornada_id: f.jornadaId, equipo_id: f.equipoId }));
}
```

- [x] **Paso 5: Implementar las acciones**

`apps/studio/lib/server/acciones/calendario.ts`:

```ts
"use server";

import { schema } from "@santiso/db";
import { esValorDe, ESTADOS_PARTIDO } from "@santiso/domain";
import { and, eq, or } from "drizzle-orm";
import type { JornadaDto, PantallaCalendario, PartidoDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import {
  aJornadaDto,
  aPartidoDto,
  COLUMNAS_JORNADA,
  COLUMNAS_PARTIDO,
  listarDescansos,
  listarJornadas,
  listarPartidos,
} from "@/lib/server/consultas/calendario";
import { listarCampos } from "@/lib/server/consultas/campos";
import { equiposDeCompeticion } from "@/lib/server/consultas/equipos";
import { obtenerDb } from "@/lib/server/db";

/** Partidos de una jornada suelta, para los consumidores que no cargan la pantalla entera. */
export async function cargarPartidosDeJornada(jornadaId: string): Promise<PartidoDto[]> {
  return jornadaId ? listarPartidos(jornadaId) : [];
}

/** Jornadas de una competición, para los consumidores que no cargan la pantalla entera. */
export async function cargarJornadasDeCompeticion(competicionId: string): Promise<JornadaDto[]> {
  return competicionId ? listarJornadas(competicionId) : [];
}

/** Carga de la pantalla en una sola acción: Next despacha las del cliente en serie. */
export async function cargarPantallaCalendario(
  competicionId: string,
  jornadaId: string,
): Promise<PantallaCalendario> {
  const [jornadas, equipos, campos] = await Promise.all([
    listarJornadas(competicionId),
    equiposDeCompeticion(competicionId),
    listarCampos(),
  ]);
  const [partidos, descansos] = jornadaId
    ? await Promise.all([listarPartidos(jornadaId), listarDescansos(jornadaId)])
    : [[], []];
  return { jornadas, partidos, descansos, equipos, campos };
}

export async function crearJornada(entrada: {
  competicionId: string;
  numero: string;
  fechaInicio: string;
  nombreFase: string;
}): Promise<Resultado<JornadaDto>> {
  const numero = Number(entrada.numero);
  if (!Number.isInteger(numero) || numero <= 0) {
    return fallo("El número de jornada debe ser un entero positivo.", { numero: "No válido" });
  }
  if (!entrada.competicionId) return fallo("Elige una competición antes de crear jornadas.");

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.jornadas.id })
    .from(schema.jornadas)
    .where(
      and(
        eq(schema.jornadas.competicionId, entrada.competicionId),
        eq(schema.jornadas.numero, numero),
      ),
    );
  if (existente) return fallo(`Ya existe la jornada ${numero} en esta competición.`);

  return capturar("No se pudo crear la jornada.", async () => {
    const [fila] = await db
      .insert(schema.jornadas)
      .values({
        competicionId: entrada.competicionId,
        numero,
        fechaInicio: entrada.fechaInicio.trim() || null,
        nombreFase: entrada.nombreFase.trim() || null,
      })
      .returning(COLUMNAS_JORNADA);
    if (!fila) throw new Error("La inserción no devolvió ninguna fila");
    return aJornadaDto(fila);
  });
}

/** Crea las jornadas 1..`hasta` que falten. Devuelve cuántas ha creado. */
export async function crearJornadasEnLote(
  competicionId: string,
  hasta: number,
): Promise<Resultado<number>> {
  if (!Number.isInteger(hasta) || hasta <= 0) return fallo("Indica cuántas jornadas quieres.");
  if (!competicionId) return fallo("Elige una competición antes de crear jornadas.");

  return capturar("No se pudieron crear las jornadas.", async () => {
    const { db } = await obtenerDb();
    const existentes = await db
      .select({ numero: schema.jornadas.numero })
      .from(schema.jornadas)
      .where(eq(schema.jornadas.competicionId, competicionId));
    const ya = new Set(existentes.map((j) => j.numero));
    const faltan = Array.from({ length: hasta }, (_, i) => i + 1).filter((n) => !ya.has(n));
    if (faltan.length === 0) return 0;
    await db
      .insert(schema.jornadas)
      .values(faltan.map((numero) => ({ competicionId, numero })));
    return faltan.length;
  });
}

/** Borra la jornada. Partidos y descansos caen con ella por cascada. */
export async function borrarJornada(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar la jornada.", async () => {
    await db.delete(schema.jornadas).where(eq(schema.jornadas.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function crearPartido(entrada: {
  jornadaId: string;
  equipoLocalId: string;
  equipoVisitanteId: string;
  fecha: string;
  campoId: string;
}): Promise<Resultado<PartidoDto>> {
  const { jornadaId, equipoLocalId, equipoVisitanteId } = entrada;
  if (!jornadaId) return fallo("Elige una jornada.");
  if (!equipoLocalId || !equipoVisitanteId) return fallo("Elige los dos equipos.");
  if (equipoLocalId === equipoVisitanteId) return fallo("Un equipo no puede jugar contra sí mismo.");

  const { db } = await obtenerDb();
  const enJornada = await db
    .select({
      local: schema.partidos.equipoLocalId,
      visitante: schema.partidos.equipoVisitanteId,
    })
    .from(schema.partidos)
    .where(eq(schema.partidos.jornadaId, jornadaId));
  const ocupados = new Set(enJornada.flatMap((p) => [p.local, p.visitante]));
  if (ocupados.has(equipoLocalId) || ocupados.has(equipoVisitanteId)) {
    return fallo("Uno de los equipos ya juega en esta jornada.");
  }

  return capturar("No se pudo añadir el partido.", async () => {
    const [fila] = await db
      .insert(schema.partidos)
      .values({
        jornadaId,
        equipoLocalId,
        equipoVisitanteId,
        fecha: entrada.fecha.trim() || null,
        campoId: entrada.campoId.trim() || null,
      })
      .returning(COLUMNAS_PARTIDO);
    if (!fila) throw new Error("La inserción no devolvió ninguna fila");
    return aPartidoDto(fila);
  });
}

/**
 * Guarda el marcador. Los dos goles o ninguno: el CHECK `partidos_marcador_completo_ck` no
 * admite medios marcadores. Poner marcador finaliza el partido; quitarlo lo devuelve a
 * programado, porque `partidos_finalizado_con_marcador_ck` no deja un finalizado sin goles.
 */
export async function guardarMarcador(
  id: string,
  local: string,
  visitante: string,
): Promise<Resultado<PartidoDto>> {
  const textoLocal = local.trim();
  const textoVisitante = visitante.trim();
  if (!textoLocal !== !textoVisitante) {
    return fallo("El marcador debe tener los dos goles o ninguno.");
  }

  let golesLocal: number | null = null;
  let golesVisitante: number | null = null;
  if (textoLocal && textoVisitante) {
    golesLocal = Number(textoLocal);
    golesVisitante = Number(textoVisitante);
    const valido = (n: number) => Number.isInteger(n) && n >= 0;
    if (!valido(golesLocal) || !valido(golesVisitante)) {
      return fallo("Los goles deben ser números enteros no negativos.");
    }
  }

  const { db } = await obtenerDb();
  return capturar("No se pudo guardar el marcador.", async () => {
    const [fila] = await db
      .update(schema.partidos)
      .set({
        golesLocal,
        golesVisitante,
        estado: golesLocal === null ? "programado" : "finalizado",
      })
      .where(eq(schema.partidos.id, id))
      .returning(COLUMNAS_PARTIDO);
    if (!fila) throw new Error("El partido no existe");
    return aPartidoDto(fila);
  });
}

/** Cambia el estado. `finalizado` exige marcador, así que se comprueba antes de escribir. */
export async function cambiarEstadoPartido(id: string, estado: string): Promise<Resultado<null>> {
  if (!esValorDe(ESTADOS_PARTIDO, estado)) return fallo("Estado de partido desconocido.");

  const { db } = await obtenerDb();
  const [partido] = await db
    .select({ golesLocal: schema.partidos.golesLocal })
    .from(schema.partidos)
    .where(eq(schema.partidos.id, id));
  if (!partido) return fallo("Ese partido ya no existe.");
  if (estado === "finalizado" && partido.golesLocal === null) {
    return fallo("Un partido finalizado necesita marcador.");
  }

  const resultado = await capturar("No se pudo cambiar el estado del partido.", async () => {
    await db.update(schema.partidos).set({ estado }).where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function cambiarFechaPartido(id: string, fecha: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo cambiar la fecha del partido.", async () => {
    await db
      .update(schema.partidos)
      .set({ fecha: fecha.trim() || null })
      .where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function cambiarCampoPartido(id: string, campoId: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo cambiar el campo del partido.", async () => {
    await db
      .update(schema.partidos)
      .set({ campoId: campoId.trim() || null })
      .where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function borrarPartido(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo borrar el partido.", async () => {
    await db.delete(schema.partidos).where(eq(schema.partidos.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

/** Marca el descanso de un equipo. Repetirlo no falla: la clave primaria compuesta lo absorbe. */
export async function anadirDescanso(
  jornadaId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  if (!jornadaId || !equipoId) return fallo("Elige la jornada y el equipo.");

  const { db } = await obtenerDb();
  const [juega] = await db
    .select({ id: schema.partidos.id })
    .from(schema.partidos)
    .where(
      and(
        eq(schema.partidos.jornadaId, jornadaId),
        or(
          eq(schema.partidos.equipoLocalId, equipoId),
          eq(schema.partidos.equipoVisitanteId, equipoId),
        ),
      ),
    );
  if (juega) return fallo("Ese equipo ya tiene partido en esta jornada.");

  const resultado = await capturar("No se pudo registrar el descanso.", async () => {
    await db
      .insert(schema.jornadaDescansos)
      .values({ jornadaId, equipoId })
      .onConflictDoNothing();
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function quitarDescanso(
  jornadaId: string,
  equipoId: string,
): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudo quitar el descanso.", async () => {
    await db
      .delete(schema.jornadaDescansos)
      .where(
        and(
          eq(schema.jornadaDescansos.jornadaId, jornadaId),
          eq(schema.jornadaDescansos.equipoId, equipoId),
        ),
      );
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
```

- [x] **Paso 6: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/calendario.test.ts`
Esperado: 16 pruebas en verde.

- [x] **Paso 7: Conectar los dos helpers que quedaban en `supabase-queries.ts`**

En `apps/studio/lib/supabase-queries.ts`:

1. Añadir `import { cargarJornadasDeCompeticion, cargarPartidosDeJornada } from "@/lib/server/acciones/calendario";`
2. Sustituir `fetchMatchdaysForCompetition` completa por:

```ts
/** `temporadaId` y `categoria` ya no filtran: los determina la competición. */
export async function fetchMatchdaysForCompetition(
  _temporadaId: string,
  _categoria: string,
  competicionId: string,
) {
  const jornadas = await cargarJornadasDeCompeticion(competicionId);
  // `Matchday` arrastra un índice de cadena de la época de Supabase; el DTO es un subconjunto
  // estricto con los mismos nombres, así que la conversión es segura.
  return { data: jornadas as unknown as Matchday[], error: null };
}
```

3. Sustituir `fetchMatchesForMatchday` completa por:

```ts
/**
 * `categoria` y `competicionId` ya no filtran: los determina la jornada. `embed` desaparece;
 * la pantalla resuelve equipos y campos con los catálogos que ya carga.
 */
export async function fetchMatchesForMatchday(
  jornadaId: string,
  _categoria: string,
  _competicionId: string,
) {
  const partidos = await cargarPartidosDeJornada(jornadaId);
  // Misma conversión documentada que en `fetchMatchdaysForCompetition`.
  return { data: partidos as unknown as LeagueMatch[], error: null };
}
```

4. Quitar el import de `supabase` y el de `CompetenciaRow` si dejan de usarse. Comprobar con `pnpm --filter @santiso/studio typecheck` y con `grep -n "supabase" apps/studio/lib/supabase-queries.ts`: al terminar, el fichero **no** debe importar `@/lib/supabase`.

- [x] **Paso 8: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/dto.ts apps/studio/lib/server
pnpm --filter @santiso/studio exec eslint lib/dto.ts lib/server
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1   # no debe pasar de 100 problemas
pnpm check
pnpm build
git add apps/studio/lib
git commit -m "feat(studio): consultas y acciones de calendario sobre SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: `AdminJornadas` sobre SQLite

Contexto: es la pantalla más grande de la aplicación (1.804 líneas) y la que más cosas mezcla: temporadas, reglas de liga, campos, jornadas, descansos y partidos. Varias de esas lecturas ya están migradas desde 2B-1 y 2B-2; aquí se conectan las que faltan y se retira Supabase del fichero.

Dos cambios de comportamiento que hay que respetar:
- **Quitar un descanso** ya no se hace por `id` de fila, sino por `(jornadaId, equipoId)`.
- **El estado y el marcador dejan de ser independientes.** Guardar marcador finaliza el partido; borrarlo lo devuelve a programado; y marcar finalizado sin marcador se rechaza con un mensaje. Es lo que imponen los CHECK de la tabla.

**Ficheros:**
- Modificar: `apps/studio/components/admin/AdminJornadas.tsx`
- Crear: `apps/studio/e2e/calendario.spec.ts`

**Interfaces:**
- Consume: todo lo que produce la Tarea 2, más `cargarCompeticiones` (2B-1) y `guardarReglas`/`reglasDeCompeticion` (2B-1).
- Produce: nada nuevo.

- [x] **Paso 1: Inventariar las llamadas que quedan**

```bash
grep -n "supabase" apps/studio/components/admin/AdminJornadas.tsx
```

Anotar la lista. Son nueve, sobre seis tablas: `reglas_liga`, `campos_futbol`, `temporadas`, `jornada_equipo_descanso`, `jornadas` y `partidos_liga`.

- [x] **Paso 2: Sustituir las lecturas**

- Las de `temporadas` pasan a `fetchSeasons` (ya migrada en 2B-1) o se eliminan si solo servían para filtrar jornadas: la competición ya determina la temporada.
- Las de `reglas_liga` pasan a `reglasDeCompeticion` / `guardarReglas` de `@/lib/server/acciones/competiciones`.
- Las de `campos_futbol` pasan a los `campos` que devuelve `cargarPantallaCalendario`.
- `fetchJornadas`, `fetchPartidos` y `fetchDescansos` se funden en **una** llamada a `cargarPantallaCalendario(selectedCompetitionId, selectedJornada ?? "")`, que rellena los cuatro estados de golpe. Tres acciones separadas serían tres viajes en serie.

- [x] **Paso 3: Sustituir las escrituras**

| Función de la pantalla | Acción nueva |
| --- | --- |
| `handleAddJornada` | `crearJornada({ competicionId, numero, fechaInicio, nombreFase })` |
| `handleBulkCreateJornadas` | `crearJornadasEnLote(competicionId, bulkCount)`; el toast dice cuántas creó, con el número que devuelve |
| `handleDeleteJornada` | `borrarJornada(id)` |
| `handleAddDescanso` | `anadirDescanso(jornadaId, equipoId)` — la comprobación de «ya juega» la hace la acción; quita la que hace la pantalla |
| `handleRemoveDescanso` | `quitarDescanso(jornadaId, equipoId)` — **cambia la firma**: recibe el equipo, no el id de fila |
| `handleAddPartido` | `crearPartido({ jornadaId, equipoLocalId, equipoVisitanteId, fecha, campoId })` |
| `saveMatchScore` | `guardarMarcador(id, local, visitante)` — refresca la lista, porque el estado cambia |
| `updatePartidoState(id, "estado", v)` | `cambiarEstadoPartido(id, v)` |
| `updatePartidoState(id, "fecha", v)` | `cambiarFechaPartido(id, v)` |
| `updatePartidoState(id, "campo_id", v)` | `cambiarCampoPartido(id, v)` |
| `handleDeletePartido` | `borrarPartido(id)` |

Todas muestran `resultado.error` en el toast cuando fallan, en vez de tragarse el error como hoy.

En el JSX, la fila de descanso deja de pasar `d.id` y pasa `d.equipo_id` junto con la jornada seleccionada.

- [x] **Paso 4: Comprobar que no queda Supabase**

```bash
grep -n "supabase" apps/studio/components/admin/AdminJornadas.tsx
pnpm --filter @santiso/studio typecheck
pnpm build
```

Esperado: el `grep` no devuelve nada, y typecheck y build en verde.

- [x] **Paso 5: Prueba e2e del calendario**

`apps/studio/e2e/calendario.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("el calendario carga jornadas y partidos desde la base de datos local", async ({ page }) => {
  const errores: string[] = [];
  const aSupabase: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("response", (respuesta) => {
    if (respuesta.url().includes("supabase.co")) aSupabase.push(respuesta.url());
  });

  await page.goto("/admin");
  await page.getByText("Calendario", { exact: true }).first().click();
  await page.waitForTimeout(2500);

  expect(errores).toEqual([]);
  expect(aSupabase).toEqual([]);
});
```

Ejecutar `pnpm e2e`. Esperado: `11 passed`.

- [x] **Paso 6: Comprobar en el navegador con los datos reales**

Con `pnpm dev`, pestaña **Calendario**, competición Senior de la temporada activa:
- Se listan las jornadas de la competición (la 2026/27 Senior tiene calendario completo).
- Al elegir una jornada salen sus partidos con equipos y campo.
- Crear una jornada con un número ya existente muestra «Ya existe la jornada N en esta competición.».
- Guardar un marcador en un partido lo pasa a finalizado; borrarlo lo devuelve a programado.
- Intentar marcar finalizado un partido sin marcador muestra «Un partido finalizado necesita marcador.».
- Marcar descanso a un equipo que ya juega esa jornada muestra el aviso correspondiente.

Deshacer los cambios de prueba antes de terminar: la temporada activa es la real. Si se ha creado alguna jornada de prueba, borrarla desde la propia pantalla.

- [x] **Paso 7: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/e2e
pnpm --filter @santiso/studio exec eslint e2e lib/server
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1
pnpm check
pnpm e2e
git add apps/studio/components/admin/AdminJornadas.tsx apps/studio/e2e apps/studio/lib
git commit -m "feat(studio): calendario sobre SQLite con marcador y estado coherentes" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final de la subfase

- [x] `pnpm check` en verde.
- [x] `pnpm build` correcto.
- [x] `pnpm e2e` → `11 passed`.
- [x] `grep -n "supabase" apps/studio/components/admin/AdminJornadas.tsx` sin resultados.
- [x] `apps/studio/lib/supabase-queries.ts` ya **no** importa `@/lib/supabase`.
- [x] La línea base de ESLint de la app no supera los **100 problemas**.
- [x] `git status --short` limpio y sin `data/` ni `.env.local`.
- [x] Las pantallas de 2B-4 siguen intactas: `git diff --name-only` no toca `AdminActaImporter`, `AdminActaBatch`, `AdminJornadaImporter`, `useCartelForm`, `useCartelAssets` ni `lib/actas/`.

## Hallazgo de la Tarea 1

El desempate por enfrentamiento directo del cartel **no funcionaba**. Se aplicaba dentro del
comparador de `sort` y ese criterio no es transitivo: el orden de dos equipos podía deducirse
a través de un tercero sin llegar a compararlos entre sí. Se comprobó reproduciéndolo en una
prueba, donde un equipo que había ganado el enfrentamiento directo acababa por debajo. Se ha
sustituido por una mini-liga entre los equipos empatados a puntos, que además resuelve los
empates de tres o más. Los datos reales mantienen la coherencia interna en las 8 competiciones,
y hay 7 grupos de empate a puntos donde el criterio nuevo sí actúa.

## Pendientes que hereda 2B-4

- **`lib/actas/save-acta.ts`**: el guardado del acta borra estadísticas y eventos y luego inserta, apoyándose en un RPC de Supabase con respaldo no atómico. Es el hallazgo P1 #3 de la auditoría. En SQLite pasa a ser **una** transacción: actualizar el partido, borrar participaciones y eventos, e insertar los nuevos. La correspondencia de las 7 formas de evento ya está resuelta en `tools/migracion-supabase/src/transformar/actas.ts` (`mapearEvento`); reutilizar esa lógica en vez de reinventarla.
- **`lib/cartel/clasificacion-data.ts`** duplica el cálculo de la clasificación. Tras la Tarea 1 hay que apuntarlo a `calcularClasificacion` del dominio y borrar el cálculo local. Ojo: también resuelve el formato `eliminatoria`, devolviendo rondas en vez de tabla; eso se conserva.
- **`useCartelAssets.ts`** sigue leyendo `cartel_assets` y el escudo de Supabase Storage. Apuntarlo a `cargarAjustesCartel` (2B-2). Cuidado con `xuntaIsLeft`: comparaba con `"xunta_left"` y el valor nuevo es `"xunta_izquierda"`.
- **`useCartelForm.ts`** lee jugadores, equipos, campos, partidos, eventos y estadísticas. Los eventos cambian de forma (`es_rival`/`nombre_mostrado` → `lado`/`propia`/`nombreRival`) y las estadísticas pasan a `partido_participaciones` sin columna `goles`.
- **Media huérfana** y el renombrado de `supabase-queries.ts`: siguen pendientes para 2C y la Fase 7.
