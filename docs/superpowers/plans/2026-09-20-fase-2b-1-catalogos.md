# Fase 2B-1 — Catálogos sobre SQLite: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que temporadas, competiciones, reglas de clasificación y campos se lean y escriban **solo** en SQLite, y que el editor manual de clasificación pase a ser una vista calculada, sin tocar el resto de secciones.

**Arquitectura:** dos capas por sección dentro de `apps/studio/lib/server/`. `consultas/<seccion>.ts` contiene funciones de lectura con `import "server-only"`, reutilizables desde Server Components en fases posteriores. `acciones/<seccion>.ts` empieza por `"use server"` y expone lo que los componentes cliente invocan: una única función de carga por pantalla y una acción por mutación, todas devolviendo `Resultado<T>`. Los componentes conservan su forma actual: reciben **DTOs de compatibilidad** con los mismos nombres de campo que devolvía Supabase (`created_at`, `escudo_url`), marcados como obsoletos y eliminados en las Fases 4–6.

**Stack:** Next.js 16.3.5 · React 19.3.0 · Drizzle ORM 0.45.2 + @libsql/client 0.18.0 · Zod 4.6.4 · Vitest 4.1.11 · @playwright/test 1.61.1 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). Leer §4 (D6 capa de datos, D12 clasificación calculada), §6.2 (cambios de esquema) y §8 «Fase 2».

**Plan anterior:** [`2026-09-15-fase-2a-infraestructura-servidor.md`](2026-09-15-fase-2a-infraestructura-servidor.md). Sus restricciones globales siguen vigentes y se repiten abajo.

**Alcance de las otras subfases:** 2B-2 cubre equipos, jugadores, staff, patrocinadores y ajustes de cartel (todo lo que sube imágenes). 2B-3 cubre calendario, actas, importador de jornada y datos de carteles. Este plan no toca ninguno de esos ficheros.

## Restricciones globales

- **Supabase queda congelada al terminar la Tarea 1.** A partir de ese punto nadie edita datos en Supabase ni en la app hasta que 2B-3 termine: la herramienta queda en estado mixto y cualquier dato introducido se perdería. El propietario ya ha confirmado que no la usará durante el corte.
- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash (sintaxis POSIX).
- TypeScript 5.9.3. Antes de usar una API de Next, leer su guía en `apps/studio/node_modules/next/dist/docs/`.
- Drizzle: solo el query builder core (`db.select/insert/update/delete`, `db.transaction`). Prohibido `db.query.*`.
- Versiones compartidas solo mediante `catalog:` en `pnpm-workspace.yaml`. Paquetes internos con `workspace:*`.
- Código de servidor en `apps/studio/lib/server/`. Los módulos de `consultas/` empiezan con `import "server-only"`; los de `acciones/` empiezan con `"use server"` (debe ser la primera línea del fichero, antes de cualquier import).
- **Next despacha las Server Actions de una en una por cliente.** No usar `Promise.all` sobre varias acciones desde el cliente: el trabajo paralelo va dentro de una sola acción. Por eso cada pantalla tiene **una** función de carga que devuelve todo lo que necesita.
- Toda operación que toca varias tablas va en **una** transacción (`db.transaction`).
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto: nunca se imprime ni se commitea.
- libSQL no libera el fichero de BD hasta que termina el proceso (`EBUSY`/`EPERM` en Windows). Parar `pnpm dev` antes de mover o reimportar la BD.
- Dominio en español: nombres de funciones de negocio, mensajes y textos. Sin `any`. `as` solo con un comentario que lo justifique. Sin `catch` vacíos.
- `pnpm check` en verde antes de cada commit. `pnpm e2e` al cerrar cada tarea que cambie una pantalla.
- **Prettier y ESLint solo sobre los ficheros nuevos.** `apps/studio` está en `.prettierignore` a propósito (código heredado pendiente de reescritura): pasar Prettier sobre un componente existente lo reformatea entero y convierte un cambio de tres líneas en un diff de doscientas. En los ficheros heredados se editan solo las líneas que toca la tarea. Sus avisos de ESLint forman parte de la línea base de 103 problemas; lo que hay que comprobar es que esa cifra **no sube**, con `pnpm --filter @santiso/studio exec eslint .`
- Cada commit en Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Mapa de ficheros

```
santiso/
├─ packages/domain/src/
│  ├─ clasificacion.ts / .test.ts          (nuevo) calcularClasificacion desde partidos
│  └─ index.ts                             (mod) exporta clasificacion
├─ apps/studio/
│  ├─ lib/dto.ts                           (nuevo) DTOs de compatibilidad, marcados @deprecated
│  ├─ lib/server/consultas/
│  │  ├─ temporadas.ts                     (nuevo) listarTemporadas, temporadaActivaId
│  │  ├─ competiciones.ts                  (nuevo) listarCompeticiones, reglasDeCompeticion
│  │  ├─ campos.ts                         (nuevo) listarCampos
│  │  ├─ equipos.ts                        (nuevo) equiposDeCompeticion
│  │  └─ clasificacion.ts                  (nuevo) clasificacionDeCompeticion
│  ├─ lib/server/acciones/
│  │  ├─ temporadas.ts / .test.ts          (nuevo) cargarTemporadas, crearTemporada, activarTemporada
│  │  ├─ competiciones.ts / .test.ts       (nuevo) cargarCompeticiones, crearCompeticion, borrarCompeticion, guardarReglas
│  │  ├─ campos.ts / .test.ts              (nuevo) cargarCampos
│  │  └─ clasificacion.ts / .test.ts       (nuevo) cargarPantallaClasificacion
│  ├─ lib/supabase-queries.ts              (mod) fetchSeasons, fetchCompeticiones, fetchTeamsForCompetition
│  ├─ lib/useCompeticiones.ts              (mod) addCompeticion / removeCompeticion por acción
│  ├─ components/admin/AdminTemporadas.tsx (mod) sin supabase
│  ├─ components/admin/AdminLeague.tsx     (mod) solo lectura, clasificación calculada
│  └─ e2e/catalogos.spec.ts                (nuevo) humo de temporadas y clasificación
```

---

### Tarea 1: Reimportación fresca y congelación de Supabase

Contexto: la migración es determinista y repetible (spec §6.3). Esta tarea deja `data/santiso.db` con el estado exacto de Supabase en el momento del corte. **Es la última vez que se lee de Supabase para datos.** No produce código: produce el dato sobre el que trabajan las tareas siguientes, y sin ella las pruebas contra la BD real no significan nada.

**Ficheros:**
- Ninguno. Solo se ejecutan las CLIs existentes y se guarda una copia.

**Interfaces:**
- Consume: `pnpm migracion:exportar`, `pnpm migracion:importar`, `pnpm migracion:verificar` (Fase 1); `pnpm db:backup` (Fase 1).
- Produce: `data/santiso.db` reimportada y verificada; copia de seguridad fechada en `data/backups/` y otra fuera del repositorio.

- [ ] **Paso 1: Parar la app y respaldar lo que ya existe**

```bash
netstat -ano | grep ":3000.*LISTENING" || echo "sin dev server"
pnpm db:backup
ls -la data/backups/ | tail -3
```

Esperado: un fichero `santiso-<marca>.db` nuevo. Si `netstat` muestra algo escuchando, pararlo antes de seguir: libSQL bloquea el fichero.

- [ ] **Paso 2: Copia manual fuera del repositorio**

```bash
cp data/santiso.db "$HOME/santiso-antes-de-2b.db"
ls -la "$HOME/santiso-antes-de-2b.db"
```

Esperado: el fichero existe y pesa lo mismo que `data/santiso.db`. Es la red de seguridad si la reimportación sale mal; no borrarla hasta que 2B-3 termine.

- [ ] **Paso 3: Exportar, importar y verificar**

```bash
pnpm migracion:exportar
pnpm migracion:importar
pnpm migracion:verificar
```

Esperado: `verificar` termina sin fallos. Si `importar` se detiene con un `ErrorMigracion`, **no** lo rodees: significa que hay un dato que exige una decisión humana. Anota el mensaje, resuélvelo en Supabase (es la última vez que se permite editarla) y repite los tres comandos.

- [ ] **Paso 4: Registrar el estado de partida**

```bash
ls -t data/informes/ | head -1
head -40 "data/informes/$(ls -t data/informes/ | head -1)"
```

Anotar en el informe de la tarea: número de temporadas, competiciones, equipos y partidos importados. Son las cifras contra las que se comparan las pruebas de las tareas siguientes.

- [ ] **Paso 5: Comprobar que la app ve los datos nuevos**

```bash
(pnpm dev > /dev/null 2>&1 &)
curl -s --retry 40 --retry-delay 2 --retry-connrefused http://127.0.0.1:3000/api/estado
```

Esperado: `{"ok":true,"temporadaActiva":"<temporada>","partidos":<n>}` con las cifras del Paso 4. Parar el servidor después: en Windows hay que matar el proceso que escucha en el 3000, porque `next dev` sobrevive al cierre de `pnpm`.

- [ ] **Paso 6: Commit del hito**

```bash
git status --short
git commit --allow-empty -m "chore(migracion): reimportación previa al corte de la Fase 2B" -m "Supabase queda congelada: a partir de aquí no se edita ningún dato en ella." -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: `git status` no muestra nada bajo `data/`, que está ignorada.

---

### Tarea 2: Capa de servidor por sección y Temporadas

Contexto: esta tarea establece el patrón que repiten todas las secciones y lo estrena con la más sencilla. La activación de temporada son hoy dos escrituras sueltas; el índice parcial `temporadas_una_activa_uq` obliga a que sea una transacción y en el orden correcto: desactivar todas y luego activar la elegida.

**Ficheros:**
- Crear: `apps/studio/lib/dto.ts`
- Crear: `apps/studio/lib/server/consultas/temporadas.ts`
- Crear: `apps/studio/lib/server/acciones/temporadas.ts`, `apps/studio/lib/server/acciones/temporadas.test.ts`
- Modificar: `apps/studio/lib/supabase-queries.ts` (`fetchSeasons`)
- Modificar: `apps/studio/components/admin/AdminTemporadas.tsx`

**Interfaces:**
- Consume: `obtenerDb` (`@/lib/server/db`); `Resultado`, `exito`, `fallo`, `capturar` (`@/lib/resultado`); `schema` (`@santiso/db`); `normalizarNombreTemporada` (`@santiso/domain`).
- Produce:
  - `type TemporadaDto = { id: string; nombre: string; activa: boolean; created_at: string }`
  - `listarTemporadas(): Promise<TemporadaDto[]>` — la activa primero, el resto por nombre descendente.
  - `temporadaActivaId(): Promise<string | null>`
  - `cargarTemporadas(): Promise<Resultado<TemporadaDto[]>>`
  - `crearTemporada(nombre: string): Promise<Resultado<TemporadaDto>>`
  - `activarTemporada(id: string): Promise<Resultado<null>>`

- [ ] **Paso 1: Escribir los DTO de compatibilidad**

`apps/studio/lib/dto.ts`:

```ts
/**
 * Formas que esperan los componentes heredados, con los nombres de campo que devolvía Supabase.
 * @deprecated Temporal de la Fase 2B. Las Fases 4–6 reescriben las pantallas contra los tipos
 * de `@santiso/db` y estos DTO desaparecen.
 */
export interface TemporadaDto {
  id: string;
  nombre: string;
  activa: boolean;
  created_at: string;
}

/** @deprecated Ver TemporadaDto. `activa` siempre es `true`: el catálogo ya solo trae vigentes. */
export interface CompeticionDto {
  id: string;
  categoria: string;
  nombre: string;
  orden: number;
  activa: boolean;
  formato: string;
}

/** @deprecated Ver TemporadaDto. */
export interface CampoDto {
  id: string;
  nombre: string;
  poblacion: string | null;
}

/** @deprecated Ver TemporadaDto. `escudo_url` es ahora una ruta local `/media/<clave>`. */
export interface EquipoDto {
  id: string;
  nombre: string;
  categoria: string;
  escudo_url: string | null;
  es_propio: boolean;
}
```

- [ ] **Paso 2: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/temporadas.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD migrada y vacía en un temporal; devuelve el módulo de acciones ya apuntando a ella. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-temporadas-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./temporadas");
}

describe("acciones de temporadas", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("la primera temporada creada queda activa", async () => {
    const { crearTemporada, cargarTemporadas } = await entorno();

    const creada = await crearTemporada("2025/26");
    expect(creada).toMatchObject({ ok: true, datos: { nombre: "2025/26", activa: true } });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(1);
  });

  it("normaliza el nombre antes de guardarlo", async () => {
    const { crearTemporada } = await entorno();
    expect(await crearTemporada("  25/26 ")).toMatchObject({
      ok: true,
      datos: { nombre: "2025/26" },
    });
  });

  it("rechaza un nombre inválido sin tocar la base de datos", async () => {
    const { crearTemporada, cargarTemporadas } = await entorno();

    expect(await crearTemporada("temporada que viene")).toMatchObject({ ok: false });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(0);
  });

  it("rechaza un nombre repetido", async () => {
    const { crearTemporada } = await entorno();
    await crearTemporada("2025/26");
    expect(await crearTemporada("2025/26")).toMatchObject({
      ok: false,
      error: "Ya existe una temporada con ese nombre.",
    });
  });

  it("la segunda temporada no queda activa", async () => {
    const { crearTemporada } = await entorno();
    await crearTemporada("2025/26");
    expect(await crearTemporada("2026/27")).toMatchObject({ ok: true, datos: { activa: false } });
  });

  it("activar una temporada deja exactamente una activa", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2025/26");
    const segunda = await crearTemporada("2026/27");
    if (!segunda.ok) throw new Error("no se creó la segunda");

    expect(await activarTemporada(segunda.datos.id)).toEqual({ ok: true, datos: null });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    const activas = listado.datos.filter((t) => t.activa);
    expect(activas).toHaveLength(1);
    expect(activas[0]?.nombre).toBe("2026/27");
  });

  it("activar una temporada inexistente falla y no cambia la activa", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2025/26");

    expect(await activarTemporada("no-existe")).toMatchObject({ ok: false });

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.filter((t) => t.activa)).toHaveLength(1);
  });

  it("lista la activa primero y el resto por nombre descendente", async () => {
    const { crearTemporada, activarTemporada, cargarTemporadas } = await entorno();
    await crearTemporada("2024/25");
    await crearTemporada("2026/27");
    const media = await crearTemporada("2025/26");
    if (!media.ok) throw new Error("no se creó la de en medio");
    await activarTemporada(media.datos.id);

    const listado = await cargarTemporadas();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((t) => t.nombre)).toEqual(["2025/26", "2026/27", "2024/25"]);
  });
});
```

- [ ] **Paso 3: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/temporadas.test.ts`
Esperado: FAIL, el módulo `./temporadas` no existe.

- [ ] **Paso 4: Implementar la consulta**

`apps/studio/lib/server/consultas/temporadas.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { desc, eq } from "drizzle-orm";
import type { TemporadaDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

/** Temporadas para el selector: la activa primero, el resto de más reciente a más antigua. */
export async function listarTemporadas(): Promise<TemporadaDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.temporadas.id,
      nombre: schema.temporadas.nombre,
      activa: schema.temporadas.activa,
      creadoEn: schema.temporadas.creadoEn,
    })
    .from(schema.temporadas)
    .orderBy(desc(schema.temporadas.activa), desc(schema.temporadas.nombre));
  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    activa: f.activa,
    created_at: f.creadoEn,
  }));
}

/** Id de la temporada vigente, o `null` si todavía no hay ninguna. */
export async function temporadaActivaId(): Promise<string | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
  return fila?.id ?? null;
}
```

- [ ] **Paso 5: Implementar las acciones**

`apps/studio/lib/server/acciones/temporadas.ts`:

```ts
"use server";

import { schema } from "@santiso/db";
import { normalizarNombreTemporada } from "@santiso/domain";
import { count, eq, ne } from "drizzle-orm";
import type { TemporadaDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarTemporadas } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

export async function cargarTemporadas(): Promise<Resultado<TemporadaDto[]>> {
  return capturar("No se pudieron cargar las temporadas.", listarTemporadas);
}

export async function crearTemporada(nombre: string): Promise<Resultado<TemporadaDto>> {
  let normalizado: string;
  try {
    normalizado = normalizarNombreTemporada(nombre);
  } catch {
    return fallo("El nombre debe tener la forma 2025/26.", { nombre: "Formato no válido" });
  }

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.nombre, normalizado));
  if (existente) return fallo("Ya existe una temporada con ese nombre.");

  return capturar("No se pudo crear la temporada.", async () => {
    // La primera temporada del sistema queda activa; las siguientes se activan a mano.
    const [total] = await db.select({ n: count() }).from(schema.temporadas);
    const activa = (total?.n ?? 0) === 0;
    const [creada] = await db
      .insert(schema.temporadas)
      .values({ nombre: normalizado, activa })
      .returning({
        id: schema.temporadas.id,
        nombre: schema.temporadas.nombre,
        activa: schema.temporadas.activa,
        creadoEn: schema.temporadas.creadoEn,
      });
    if (!creada) throw new Error("La inserción no devolvió ninguna fila");
    return {
      id: creada.id,
      nombre: creada.nombre,
      activa: creada.activa,
      created_at: creada.creadoEn,
    };
  });
}

/**
 * Cambia la temporada vigente. Va en transacción y desactiva antes de activar: el índice parcial
 * `temporadas_una_activa_uq` rechaza que haya dos activas ni siquiera a mitad de operación.
 */
export async function activarTemporada(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [existe] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.id, id));
  if (!existe) return fallo("Esa temporada ya no existe.");

  const resultado = await capturar("No se pudo activar la temporada.", async () => {
    await db.transaction(async (tx) => {
      await tx.update(schema.temporadas).set({ activa: false }).where(ne(schema.temporadas.id, id));
      await tx.update(schema.temporadas).set({ activa: true }).where(eq(schema.temporadas.id, id));
    });
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
```

- [ ] **Paso 6: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/temporadas.test.ts`
Esperado: 8 pruebas en verde.

- [ ] **Paso 7: Conectar `fetchSeasons`**

En `apps/studio/lib/supabase-queries.ts`, añadir el import al principio:

```ts
import { cargarTemporadas } from "@/lib/server/acciones/temporadas";
```

y sustituir la función `fetchSeasons` completa por:

```ts
export async function fetchSeasons() {
  const resultado = await cargarTemporadas();
  if (!resultado.ok) {
    return { data: [] as Season[], error: new Error(resultado.error), active: null };
  }
  const data = resultado.datos as Season[];
  return { data, error: null, active: data.find((t) => t.activa) ?? data[0] ?? null };
}
```

- [ ] **Paso 8: Conectar `AdminTemporadas`**

En `apps/studio/components/admin/AdminTemporadas.tsx`:

1. Quitar la línea `import { supabase } from "@/lib/supabase-browser";`.
2. Añadir, junto a los demás imports:

```ts
import type { TemporadaDto } from "@/lib/dto";
import {
  activarTemporada,
  cargarTemporadas,
  crearTemporada,
} from "@/lib/server/acciones/temporadas";
```

3. Cambiar `useState<any[]>([])` por `useState<TemporadaDto[]>([])`.
4. Sustituir el cuerpo de `fetchTemporadas` por:

```ts
  async function fetchTemporadas() {
    setIsFetching(true);
    const resultado = await cargarTemporadas();
    if (resultado.ok) setTemporadas(resultado.datos);
    else showToast(resultado.error, "error");
    setIsFetching(false);
  }
```

5. En `handleAdd`, sustituir la línea del `insert` y el `if (!error)` que la sigue por:

```ts
    const resultado = await crearTemporada(nombre);

    if (resultado.ok) {
      showToast("Temporada creada");
      setNombre("");
      fetchTemporadas();
    } else {
      showToast(resultado.error, "error");
    }
```

6. En `setActiva`, sustituir las dos llamadas a `supabase` y el `if (!error)` por:

```ts
    const resultado = await activarTemporada(id);
    if (resultado.ok) {
      showToast("Temporada activa actualizada");
      fetchTemporadas();
    } else {
      showToast(resultado.error, "error");
    }
```

- [ ] **Paso 9: Comprobar en el navegador**

```bash
(pnpm dev > /dev/null 2>&1 &)
curl -s --retry 40 --retry-delay 2 --retry-connrefused -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/admin
```

Abrir `http://127.0.0.1:3000/admin`, pestaña **Temporadas**, y comprobar a mano:
- La lista muestra las temporadas reales y marca la activa.
- Crear «2027/28» la añade sin activarla.
- «Activar» sobre ella la marca y desmarca la anterior.
- Crear «2027/28» otra vez muestra el error de nombre repetido.
- Recargar la página conserva el estado.

Después, borrar la temporada de prueba de la BD real: no hay ninguna reimportación posterior que la limpie sola. Con el servidor parado (libSQL bloquea el fichero), un script `.ts` en `apps/studio` ejecutado con `pnpm --filter @santiso/studio exec tsx` que borre la fila por nombre y liste las restantes, y borrar el script al terminar. Ojo: `apps/studio` no declara `"type": "module"`, así que el script no admite `await` de primer nivel — envuélvelo en una función `main()`.

Esperado al listar: solo `2025/26` y `2026/27 (ACTIVA)`. Parar el servidor.

- [ ] **Paso 10: Formato, lint, puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/dto.ts apps/studio/lib/server/consultas apps/studio/lib/server/acciones
pnpm --filter @santiso/studio exec eslint lib/dto.ts lib/server
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1   # debe seguir en 103 problemas
pnpm check
pnpm e2e
git add apps/studio/lib/dto.ts apps/studio/lib/server apps/studio/lib/supabase-queries.ts apps/studio/components/admin/AdminTemporadas.tsx
git commit -m "feat(studio): temporadas sobre SQLite con activación atómica" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: ESLint sin problemas en los ficheros nuevos, `pnpm check` en verde y `pnpm e2e` en `3 passed`.

---

### Tarea 3: Competiciones y reglas de clasificación

Contexto: cambian dos cosas a la vez. `competiciones.activa` desaparece (la jerarquía es temporada → competición, y vigente = pertenecer a la temporada activa) y `reglas_liga` deja de ser una tabla para pasar a `competiciones.reglas_clasificacion` como JSON validado con Zod. El catálogo que consume la UI (`CompetenciaRow`) conserva el campo `activa` para no tocar los helpers de `lib/competition.ts`, pero siempre vale `true`.

`competicion_alias` (antes `competicion_etiquetas`) **no se toca aquí**: hoy no tiene pantalla y sus únicos consumidores son el emparejado del importador de jornada y el de actas, ambos en 2B-3.

**Ficheros:**
- Crear: `apps/studio/lib/server/consultas/competiciones.ts`
- Crear: `apps/studio/lib/server/acciones/competiciones.ts`, `apps/studio/lib/server/acciones/competiciones.test.ts`
- Modificar: `apps/studio/lib/supabase-queries.ts` (`fetchCompeticiones`)
- Modificar: `apps/studio/lib/useCompeticiones.ts`

**Interfaces:**
- Consume: `temporadaActivaId` (Tarea 2); `CompeticionDto` (Tarea 2); `reglasClasificacionSchema`, `normalizarCategoria`, `claveNombre` (`@santiso/domain`).
- Produce:
  - `listarCompeticiones(): Promise<CompeticionDto[]>` — solo las de la temporada activa, ordenadas por categoría y `orden`.
  - `reglasDeCompeticion(competicionId: string): Promise<ReglaClasificacion[]>`
  - `cargarCompeticiones(): Promise<Resultado<CompeticionDto[]>>`
  - `crearCompeticion(entrada: { nombre: string; categoria: string; formato: string }): Promise<Resultado<CompeticionDto>>`
  - `borrarCompeticion(id: string): Promise<Resultado<null>>`
  - `guardarReglas(competicionId: string, reglas: unknown): Promise<Resultado<null>>`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/competiciones.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD migrada con una temporada activa «2026/27»; devuelve las acciones y el id de la temporada. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-competiciones-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  const [temporada] = await inicial.db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning({ id: bd.schema.temporadas.id });
  const [otra] = await inicial.db
    .insert(bd.schema.temporadas)
    .values({ nombre: "2025/26", activa: false })
    .returning({ id: bd.schema.temporadas.id });
  inicial.cerrar();
  if (!temporada || !otra) throw new Error("no se crearon las temporadas");
  return { acciones: await import("./competiciones"), temporadaId: temporada.id, otraId: otra.id };
}

describe("acciones de competiciones", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea la competición en la temporada activa", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Primeira Galega",
      categoria: "Senior",
      formato: "liga",
    });
    expect(creada).toMatchObject({
      ok: true,
      datos: { nombre: "Primeira Galega", categoria: "Senior", formato: "liga", activa: true },
    });
  });

  it("asigna el orden siguiente dentro de la categoría", async () => {
    const { acciones } = await entorno();
    const primera = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    const segunda = await acciones.crearCompeticion({
      nombre: "Copa",
      categoria: "Senior",
      formato: "eliminatoria",
    });
    if (!primera.ok || !segunda.ok) throw new Error("no se crearon");
    expect(segunda.datos.orden).toBeGreaterThan(primera.datos.orden);
  });

  it("rechaza una categoría desconocida", async () => {
    const { acciones } = await entorno();
    expect(
      await acciones.crearCompeticion({ nombre: "X", categoria: "Cadete", formato: "liga" }),
    ).toMatchObject({ ok: false });
  });

  it("rechaza un nombre repetido en la misma categoría y temporada", async () => {
    const { acciones } = await entorno();
    await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" });
    expect(
      await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" }),
    ).toMatchObject({ ok: false, error: "Ya existe una competición con ese nombre." });
  });

  it("solo lista las competiciones de la temporada activa", async () => {
    const { acciones, otraId } = await entorno();
    await acciones.crearCompeticion({ nombre: "Liga", categoria: "Senior", formato: "liga" });

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db
      .insert(bd.schema.competiciones)
      .values({ temporadaId: otraId, categoria: "Senior", nombre: "Liga vieja" });

    const listado = await acciones.cargarCompeticiones();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((c) => c.nombre)).toEqual(["Liga"]);
  });

  it("guarda y devuelve las reglas de clasificación", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const reglas = [{ id: "asc", nombre: "Ascenso", puestos: [1, 2], color: "#10b981" }];
    expect(await acciones.guardarReglas(creada.datos.id, reglas)).toEqual({ ok: true, datos: null });

    const { reglasDeCompeticion } = await import("@/lib/server/consultas/competiciones");
    expect(await reglasDeCompeticion(creada.datos.id)).toEqual(reglas);
  });

  it("rechaza reglas con un color inválido y no las guarda", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const malas = [{ id: "asc", nombre: "Ascenso", puestos: [1], color: "verde" }];
    expect(await acciones.guardarReglas(creada.datos.id, malas)).toMatchObject({ ok: false });

    const { reglasDeCompeticion } = await import("@/lib/server/consultas/competiciones");
    expect(await reglasDeCompeticion(creada.datos.id)).toEqual([]);
  });

  it("borra una competición sin jornadas", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    expect(await acciones.borrarCompeticion(creada.datos.id)).toEqual({ ok: true, datos: null });

    const listado = await acciones.cargarCompeticiones();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos).toHaveLength(0);
  });

  it("se niega a borrar una competición que tiene jornadas", async () => {
    const { acciones } = await entorno();
    const creada = await acciones.crearCompeticion({
      nombre: "Liga",
      categoria: "Senior",
      formato: "liga",
    });
    if (!creada.ok) throw new Error("no se creó");

    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db
      .insert(bd.schema.jornadas)
      .values({ competicionId: creada.datos.id, numero: 1 });

    expect(await acciones.borrarCompeticion(creada.datos.id)).toMatchObject({
      ok: false,
      error: "No se puede borrar: la competición tiene jornadas.",
    });
  });
});
```

- [ ] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/competiciones.test.ts`
Esperado: FAIL, el módulo `./competiciones` no existe.

- [ ] **Paso 3: Implementar la consulta**

`apps/studio/lib/server/consultas/competiciones.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { type ReglaClasificacion, reglasClasificacionSchema } from "@santiso/domain";
import { asc, eq } from "drizzle-orm";
import type { CompeticionDto } from "@/lib/dto";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

/**
 * Catálogo de competiciones vigentes: las de la temporada activa.
 * `activa` siempre es `true`; se conserva porque los helpers de `lib/competition.ts` lo leen.
 */
export async function listarCompeticiones(): Promise<CompeticionDto[]> {
  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return [];
  const { db } = await obtenerDb();
  const filas = await db
    .select({
      id: schema.competiciones.id,
      categoria: schema.competiciones.categoria,
      nombre: schema.competiciones.nombre,
      orden: schema.competiciones.orden,
      formato: schema.competiciones.formato,
    })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.temporadaId, temporadaId))
    .orderBy(asc(schema.competiciones.categoria), asc(schema.competiciones.orden));
  return filas.map((f) => ({ ...f, activa: true }));
}

/** Reglas de zona de la clasificación. Un JSON corrupto se trata como «sin reglas», no rompe la UI. */
export async function reglasDeCompeticion(competicionId: string): Promise<ReglaClasificacion[]> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ reglas: schema.competiciones.reglasClasificacion })
    .from(schema.competiciones)
    .where(eq(schema.competiciones.id, competicionId));
  const analizado = reglasClasificacionSchema.safeParse(fila?.reglas ?? []);
  return analizado.success ? analizado.data : [];
}
```

- [ ] **Paso 4: Implementar las acciones**

`apps/studio/lib/server/acciones/competiciones.ts`:

```ts
"use server";

import { schema } from "@santiso/db";
import { esValorDe, FORMATOS_COMPETICION, normalizarCategoria, reglasClasificacionSchema } from "@santiso/domain";
import { and, eq, max } from "drizzle-orm";
import type { CompeticionDto } from "@/lib/dto";
import { capturar, exito, fallo, type Resultado } from "@/lib/resultado";
import { listarCompeticiones } from "@/lib/server/consultas/competiciones";
import { temporadaActivaId } from "@/lib/server/consultas/temporadas";
import { obtenerDb } from "@/lib/server/db";

export async function cargarCompeticiones(): Promise<Resultado<CompeticionDto[]>> {
  return capturar("No se pudieron cargar las competiciones.", listarCompeticiones);
}

export async function crearCompeticion(entrada: {
  nombre: string;
  categoria: string;
  formato: string;
}): Promise<Resultado<CompeticionDto>> {
  const nombre = entrada.nombre.trim();
  if (!nombre) return fallo("El nombre es obligatorio.", { nombre: "Obligatorio" });

  let categoria: ReturnType<typeof normalizarCategoria>;
  try {
    categoria = normalizarCategoria(entrada.categoria);
  } catch {
    return fallo("Categoría desconocida.", { categoria: "No válida" });
  }
  if (!esValorDe(FORMATOS_COMPETICION, entrada.formato)) {
    return fallo("Formato desconocido.", { formato: "No válido" });
  }
  const formato = entrada.formato;

  const temporadaId = await temporadaActivaId();
  if (!temporadaId) return fallo("No hay temporada activa: crea una antes.");

  const { db } = await obtenerDb();
  const [existente] = await db
    .select({ id: schema.competiciones.id })
    .from(schema.competiciones)
    .where(
      and(
        eq(schema.competiciones.temporadaId, temporadaId),
        eq(schema.competiciones.categoria, categoria),
        eq(schema.competiciones.nombre, nombre),
      ),
    );
  if (existente) return fallo("Ya existe una competición con ese nombre.");

  return capturar("No se pudo crear la competición.", async () => {
    const [ultimo] = await db
      .select({ orden: max(schema.competiciones.orden) })
      .from(schema.competiciones)
      .where(
        and(
          eq(schema.competiciones.temporadaId, temporadaId),
          eq(schema.competiciones.categoria, categoria),
        ),
      );
    const [creada] = await db
      .insert(schema.competiciones)
      .values({ temporadaId, categoria, nombre, formato, orden: (ultimo?.orden ?? 0) + 10 })
      .returning({
        id: schema.competiciones.id,
        categoria: schema.competiciones.categoria,
        nombre: schema.competiciones.nombre,
        orden: schema.competiciones.orden,
        formato: schema.competiciones.formato,
      });
    if (!creada) throw new Error("La inserción no devolvió ninguna fila");
    return { ...creada, activa: true };
  });
}

/** Borra una competición vacía. Con jornadas se niega: el borrado en cascada se llevaría partidos. */
export async function borrarCompeticion(id: string): Promise<Resultado<null>> {
  const { db } = await obtenerDb();
  const [jornada] = await db
    .select({ id: schema.jornadas.id })
    .from(schema.jornadas)
    .where(eq(schema.jornadas.competicionId, id));
  if (jornada) return fallo("No se puede borrar: la competición tiene jornadas.");

  const resultado = await capturar("No se pudo borrar la competición.", async () => {
    await db.delete(schema.competiciones).where(eq(schema.competiciones.id, id));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}

export async function guardarReglas(
  competicionId: string,
  reglas: unknown,
): Promise<Resultado<null>> {
  const analizado = reglasClasificacionSchema.safeParse(reglas);
  if (!analizado.success) return fallo("Las reglas de clasificación no son válidas.");

  const { db } = await obtenerDb();
  const resultado = await capturar("No se pudieron guardar las reglas.", async () => {
    await db
      .update(schema.competiciones)
      .set({ reglasClasificacion: analizado.data })
      .where(eq(schema.competiciones.id, competicionId));
    return null;
  });
  return resultado.ok ? exito(null) : resultado;
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/competiciones.test.ts`
Esperado: 9 pruebas en verde.

- [ ] **Paso 6: Conectar `fetchCompeticiones` y `useCompeticiones`**

En `apps/studio/lib/supabase-queries.ts`, sustituir `fetchCompeticiones` completa por:

```ts
export async function fetchCompeticiones(): Promise<CompetenciaRow[]> {
  const resultado = await cargarCompeticiones();
  return resultado.ok ? resultado.datos : [];
}
```

y añadir el import `import { cargarCompeticiones } from "@/lib/server/acciones/competiciones";`.

En `apps/studio/lib/useCompeticiones.ts`:

1. Quitar `import { supabase } from "@/lib/supabase-browser";`.
2. Añadir `import { borrarCompeticion, crearCompeticion } from "@/lib/server/acciones/competiciones";`.
3. Sustituir el cuerpo de `addCompeticion` por:

```ts
    async (nombre: string, cat: string, formato: string = "liga") => {
      const resultado = await crearCompeticion({ nombre, categoria: cat, formato });
      if (!resultado.ok) return { data: null, error: new Error(resultado.error) };
      await loadCompeticiones();
      setSelectedCompetitionId(resultado.datos.id);
      return { data: resultado.datos, error: null };
    },
    [loadCompeticiones],
```

4. Sustituir el cuerpo de `removeCompeticion` por:

```ts
    async (id: string) => {
      if (!id) return { error: new Error("ID inválido") };
      const resultado = await borrarCompeticion(id);
      if (!resultado.ok) return { error: new Error(resultado.error) };
      await loadCompeticiones();
      return { error: null };
    },
    [loadCompeticiones],
```

Nota: `competicionesCatalog` ya no se usa dentro de `addCompeticion` (el orden lo calcula el servidor); quítalo de su lista de dependencias.

- [ ] **Paso 7: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/server
pnpm --filter @santiso/studio exec eslint lib/server
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1   # debe seguir en 103 problemas
pnpm check
pnpm e2e
git add apps/studio/lib/server apps/studio/lib/supabase-queries.ts apps/studio/lib/useCompeticiones.ts
git commit -m "feat(studio): competiciones y reglas de clasificación sobre SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: Campos

Contexto: `campos_futbol` pasa a `campos` y gana una columna `clave` única, calculada con `claveNombre`. Es un catálogo pequeño, pero lo consumen el calendario, el importador de jornada y el de actas (todos en 2B-3), así que se migra aquí para que esas tareas lo encuentren hecho.

**Ficheros:**
- Crear: `apps/studio/lib/server/consultas/campos.ts`
- Crear: `apps/studio/lib/server/acciones/campos.ts`, `apps/studio/lib/server/acciones/campos.test.ts`

**Interfaces:**
- Consume: `claveNombre` (`@santiso/domain`); `CampoDto` (Tarea 2).
- Produce:
  - `listarCampos(): Promise<CampoDto[]>` — por nombre ascendente.
  - `buscarCampoPorNombre(nombre: string): Promise<CampoDto | null>` — por `clave`, no por texto literal.
  - `cargarCampos(): Promise<Resultado<CampoDto[]>>`
  - `asegurarCampo(nombre: string, poblacion: string | null): Promise<Resultado<CampoDto>>` — devuelve el existente (actualizando la población si llega una nueva y no había) o crea uno.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/campos.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-campos-"));
  process.env.SANTISO_DATA_DIR = dir;
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  inicial.cerrar();
  return await import("./campos");
}

describe("acciones de campos", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("crea un campo nuevo", async () => {
    const { asegurarCampo } = await entorno();
    expect(await asegurarCampo("A Carballeira", "Santiso")).toMatchObject({
      ok: true,
      datos: { nombre: "A Carballeira", poblacion: "Santiso" },
    });
  });

  it("reutiliza el campo existente aunque cambien tildes y mayúsculas", async () => {
    const { asegurarCampo } = await entorno();
    const primero = await asegurarCampo("A Carballeira", "Santiso");
    const segundo = await asegurarCampo("  a carballeira ", null);
    if (!primero.ok || !segundo.ok) throw new Error("fallaron");
    expect(segundo.datos.id).toBe(primero.datos.id);
  });

  it("rellena la población si el campo no la tenía", async () => {
    const { asegurarCampo } = await entorno();
    await asegurarCampo("A Carballeira", null);
    const segundo = await asegurarCampo("A Carballeira", "Santiso");
    expect(segundo).toMatchObject({ ok: true, datos: { poblacion: "Santiso" } });
  });

  it("no pisa una población ya registrada", async () => {
    const { asegurarCampo } = await entorno();
    await asegurarCampo("A Carballeira", "Santiso");
    const segundo = await asegurarCampo("A Carballeira", "Otra villa");
    expect(segundo).toMatchObject({ ok: true, datos: { poblacion: "Santiso" } });
  });

  it("rechaza un nombre vacío", async () => {
    const { asegurarCampo } = await entorno();
    expect(await asegurarCampo("   ", null)).toMatchObject({ ok: false });
  });

  it("lista los campos por nombre", async () => {
    const { asegurarCampo, cargarCampos } = await entorno();
    await asegurarCampo("Zulo", null);
    await asegurarCampo("A Carballeira", null);

    const listado = await cargarCampos();
    if (!listado.ok) throw new Error("el listado falló");
    expect(listado.datos.map((c) => c.nombre)).toEqual(["A Carballeira", "Zulo"]);
  });
});
```

- [ ] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/campos.test.ts`
Esperado: FAIL, el módulo `./campos` no existe.

- [ ] **Paso 3: Implementar la consulta**

`apps/studio/lib/server/consultas/campos.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { asc, eq } from "drizzle-orm";
import type { CampoDto } from "@/lib/dto";
import { obtenerDb } from "@/lib/server/db";

export async function listarCampos(): Promise<CampoDto[]> {
  const { db } = await obtenerDb();
  return db
    .select({
      id: schema.campos.id,
      nombre: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
    })
    .from(schema.campos)
    .orderBy(asc(schema.campos.nombre));
}

/** Busca por `clave`, de modo que «A Carballeira» y «a carballeira» son el mismo campo. */
export async function buscarCampoPorNombre(nombre: string): Promise<CampoDto | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({
      id: schema.campos.id,
      nombre: schema.campos.nombre,
      poblacion: schema.campos.poblacion,
    })
    .from(schema.campos)
    .where(eq(schema.campos.clave, claveNombre(nombre)));
  return fila ?? null;
}
```

- [ ] **Paso 4: Implementar las acciones**

`apps/studio/lib/server/acciones/campos.ts`:

```ts
"use server";

import { schema } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { eq } from "drizzle-orm";
import type { CampoDto } from "@/lib/dto";
import { capturar, fallo, type Resultado } from "@/lib/resultado";
import { buscarCampoPorNombre, listarCampos } from "@/lib/server/consultas/campos";
import { obtenerDb } from "@/lib/server/db";

export async function cargarCampos(): Promise<Resultado<CampoDto[]>> {
  return capturar("No se pudieron cargar los campos.", listarCampos);
}

/**
 * Devuelve el campo con ese nombre, creándolo si no existe. Si el campo ya estaba pero sin
 * población y ahora llega una, la rellena; nunca sobrescribe una población ya registrada.
 */
export async function asegurarCampo(
  nombre: string,
  poblacion: string | null,
): Promise<Resultado<CampoDto>> {
  const limpio = nombre.trim();
  if (!limpio) return fallo("El nombre del campo es obligatorio.", { nombre: "Obligatorio" });
  const poblacionLimpia = poblacion?.trim() || null;

  return capturar("No se pudo guardar el campo.", async () => {
    const { db } = await obtenerDb();
    const existente = await buscarCampoPorNombre(limpio);
    if (existente) {
      if (!existente.poblacion && poblacionLimpia) {
        await db
          .update(schema.campos)
          .set({ poblacion: poblacionLimpia })
          .where(eq(schema.campos.id, existente.id));
        return { ...existente, poblacion: poblacionLimpia };
      }
      return existente;
    }
    const [creado] = await db
      .insert(schema.campos)
      .values({ nombre: limpio, clave: claveNombre(limpio), poblacion: poblacionLimpia })
      .returning({
        id: schema.campos.id,
        nombre: schema.campos.nombre,
        poblacion: schema.campos.poblacion,
      });
    if (!creado) throw new Error("La inserción no devolvió ninguna fila");
    return creado;
  });
}
```

- [ ] **Paso 5: Ejecutar las pruebas y commit**

```bash
pnpm exec vitest run apps/studio/lib/server/acciones/campos.test.ts
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/server
pnpm --filter @santiso/studio exec eslint lib/server
pnpm check
git add apps/studio/lib/server
git commit -m "feat(studio): catálogo de campos sobre SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: 6 pruebas en verde y `pnpm check` en verde.

---

### Tarea 5: Clasificación calculada en el dominio

Contexto: por D12 la clasificación deja de guardarse y se calcula desde los partidos finalizados. Esta tarea añade el cálculo puro al dominio, con los mismos desempates que la UI aplicaba en cliente: puntos, luego diferencia de goles, luego goles a favor. La Fase 6 lo amplía con `clasificacion_ajustes` y desempates configurables; aquí no se tocan.

**Ficheros:**
- Crear: `packages/domain/src/clasificacion.ts`, `packages/domain/src/clasificacion.test.ts`
- Modificar: `packages/domain/src/index.ts`

**Interfaces:**
- Consume: nada.
- Produce:
  - `type PartidoClasificacion = { equipoLocalId: string; equipoVisitanteId: string; golesLocal: number | null; golesVisitante: number | null; estado: string }`
  - `type LineaClasificacion = { equipoId: string; puntos: number; jugados: number; ganados: number; empatados: number; perdidos: number; golesFavor: number; golesContra: number; diferencia: number }`
  - `calcularClasificacion(equipoIds: readonly string[], partidos: readonly PartidoClasificacion[]): LineaClasificacion[]`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`packages/domain/src/clasificacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularClasificacion, type PartidoClasificacion } from "./clasificacion";

const finalizado = (
  local: string,
  visitante: string,
  golesLocal: number,
  golesVisitante: number,
): PartidoClasificacion => ({
  equipoLocalId: local,
  equipoVisitanteId: visitante,
  golesLocal,
  golesVisitante,
  estado: "finalizado",
});

describe("calcularClasificacion", () => {
  it("incluye a todos los equipos aunque no hayan jugado", () => {
    const tabla = calcularClasificacion(["a", "b"], []);
    expect(tabla).toHaveLength(2);
    expect(tabla[0]).toMatchObject({ puntos: 0, jugados: 0, diferencia: 0 });
  });

  it("da 3 puntos al ganador y 0 al perdedor", () => {
    const tabla = calcularClasificacion(["a", "b"], [finalizado("a", "b", 2, 1)]);
    expect(tabla.find((f) => f.equipoId === "a")).toMatchObject({
      puntos: 3,
      ganados: 1,
      perdidos: 0,
      golesFavor: 2,
      golesContra: 1,
    });
    expect(tabla.find((f) => f.equipoId === "b")).toMatchObject({ puntos: 0, perdidos: 1 });
  });

  it("da 1 punto a cada uno en el empate", () => {
    const tabla = calcularClasificacion(["a", "b"], [finalizado("a", "b", 1, 1)]);
    expect(tabla.every((f) => f.puntos === 1 && f.empatados === 1)).toBe(true);
  });

  it("ignora los partidos que no están finalizados", () => {
    const tabla = calcularClasificacion(
      ["a", "b"],
      [{ ...finalizado("a", "b", 3, 0), estado: "aplazado" }],
    );
    expect(tabla.every((f) => f.jugados === 0)).toBe(true);
  });

  it("ignora los partidos finalizados sin marcador", () => {
    const tabla = calcularClasificacion(
      ["a", "b"],
      [{ ...finalizado("a", "b", 0, 0), golesLocal: null, golesVisitante: null }],
    );
    expect(tabla.every((f) => f.jugados === 0)).toBe(true);
  });

  it("ignora los partidos de equipos que no están en la lista", () => {
    const tabla = calcularClasificacion(["a"], [finalizado("a", "fuera", 1, 0)]);
    expect(tabla).toHaveLength(1);
    expect(tabla[0]).toMatchObject({ jugados: 0, puntos: 0 });
  });

  it("ordena por puntos, luego diferencia de goles y luego goles a favor", () => {
    // a: 3 pts, DG +1, GF 2 · b: 3 pts, DG +3, GF 3 · c: 3 pts, DG +1, GF 5
    const tabla = calcularClasificacion(
      ["a", "b", "c", "x", "y", "z"],
      [finalizado("a", "x", 2, 1), finalizado("b", "y", 3, 0), finalizado("c", "z", 5, 4)],
    );
    expect(tabla.slice(0, 3).map((f) => f.equipoId)).toEqual(["b", "c", "a"]);
  });

  it("desempata por orden alfabético de id cuando todo lo demás coincide", () => {
    const tabla = calcularClasificacion(["b", "a"], []);
    expect(tabla.map((f) => f.equipoId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Paso 2: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run packages/domain/src/clasificacion.test.ts`
Esperado: FAIL, `./clasificacion` no existe.

- [ ] **Paso 3: Implementar**

`packages/domain/src/clasificacion.ts`:

```ts
/** Partido tal y como lo necesita el cálculo: sin fechas, campos ni nombres. */
export interface PartidoClasificacion {
  equipoLocalId: string;
  equipoVisitanteId: string;
  golesLocal: number | null;
  golesVisitante: number | null;
  estado: string;
}

export interface LineaClasificacion {
  equipoId: string;
  puntos: number;
  jugados: number;
  ganados: number;
  empatados: number;
  perdidos: number;
  golesFavor: number;
  golesContra: number;
  diferencia: number;
}

const nuevaLinea = (equipoId: string): LineaClasificacion => ({
  equipoId,
  puntos: 0,
  jugados: 0,
  ganados: 0,
  empatados: 0,
  perdidos: 0,
  golesFavor: 0,
  golesContra: 0,
  diferencia: 0,
});

/**
 * Clasificación desde los partidos disputados. Solo cuentan los finalizados con marcador: un
 * «finalizado» sin goles o un aplazado 0-0 no son un empate, son un partido sin jugar.
 * Desempates: puntos, diferencia de goles, goles a favor y, por último, id (orden estable).
 * La Fase 6 añade `clasificacion_ajustes` y desempates configurables por competición.
 */
export function calcularClasificacion(
  equipoIds: readonly string[],
  partidos: readonly PartidoClasificacion[],
): LineaClasificacion[] {
  const tabla = new Map(equipoIds.map((id) => [id, nuevaLinea(id)]));

  for (const partido of partidos) {
    if (partido.estado !== "finalizado") continue;
    const { golesLocal, golesVisitante } = partido;
    if (golesLocal === null || golesVisitante === null) continue;
    const local = tabla.get(partido.equipoLocalId);
    const visitante = tabla.get(partido.equipoVisitanteId);
    if (!local || !visitante) continue;

    local.jugados++;
    visitante.jugados++;
    local.golesFavor += golesLocal;
    local.golesContra += golesVisitante;
    visitante.golesFavor += golesVisitante;
    visitante.golesContra += golesLocal;

    if (golesLocal > golesVisitante) {
      local.ganados++;
      local.puntos += 3;
      visitante.perdidos++;
    } else if (golesLocal < golesVisitante) {
      visitante.ganados++;
      visitante.puntos += 3;
      local.perdidos++;
    } else {
      local.empatados++;
      visitante.empatados++;
      local.puntos++;
      visitante.puntos++;
    }
  }

  return [...tabla.values()]
    .map((linea) => ({ ...linea, diferencia: linea.golesFavor - linea.golesContra }))
    .sort(
      (a, b) =>
        b.puntos - a.puntos ||
        b.diferencia - a.diferencia ||
        b.golesFavor - a.golesFavor ||
        a.equipoId.localeCompare(b.equipoId),
    );
}
```

En `packages/domain/src/index.ts`, añadir en orden alfabético:

```ts
export * from "./clasificacion";
```

- [ ] **Paso 4: Ejecutar las pruebas y commit**

```bash
pnpm exec vitest run packages/domain
pnpm check
git add packages/domain/src/clasificacion.ts packages/domain/src/clasificacion.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): clasificación calculada desde los partidos disputados" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: 8 pruebas nuevas en verde.

---

### Tarea 6: `AdminLeague` pasa a vista calculada

Contexto: `AdminLeague` es hoy un editor manual que escribe `equipos.pts/pj/pg/pe/pp/gf/gc`. Esas columnas **no existen** en el esquema nuevo (D12), así que la pantalla no puede migrarse tal cual: pierde el botón de guardar y pasa a mostrar la clasificación calculada. La leyenda de reglas sigue funcionando, ahora desde `competiciones.reglas_clasificacion`. El editor de ajustes (sanciones y puntos concedidos) llega en la Fase 6; hasta entonces la pantalla avisa de ello.

**Ficheros:**
- Crear: `apps/studio/lib/server/consultas/equipos.ts`, `apps/studio/lib/server/consultas/clasificacion.ts`
- Crear: `apps/studio/lib/server/acciones/clasificacion.ts`, `apps/studio/lib/server/acciones/clasificacion.test.ts`
- Modificar: `apps/studio/lib/dto.ts` (añadir `FilaClasificacion` y `PantallaClasificacion`)
- Modificar: `apps/studio/lib/supabase-queries.ts` (`fetchTeamsForCompetition`, `fetchTeamsByIds`)
- Modificar: `apps/studio/components/admin/AdminLeague.tsx`
- Crear: `apps/studio/e2e/catalogos.spec.ts`

**Interfaces:**
- Consume: `calcularClasificacion` (Tarea 5); `reglasDeCompeticion` (Tarea 3); `urlMedia` (`@/lib/media`, Fase 2A).
- Produce:
  - `equiposDeCompeticion(competicionId: string): Promise<EquipoDto[]>`
  - `equiposPorIds(ids: readonly string[]): Promise<EquipoDto[]>`
  - `type FilaClasificacion` y `type PantallaClasificacion` en `@/lib/dto`
  - `cargarPantallaClasificacion(competicionId: string): Promise<Resultado<PantallaClasificacion>>` — **una sola llamada** que trae equipos, reglas y tabla, porque Next serializa las acciones que lanza el cliente.

- [ ] **Paso 1: Ampliar los DTO**

Añadir esta línea **arriba del todo** de `apps/studio/lib/dto.ts` (los imports van al principio del fichero, no junto al tipo que los usa):

```ts
import type { LineaClasificacion, ReglaClasificacion } from "@santiso/domain";
```

y estos dos tipos al final:

```ts
/** Fila de la clasificación calculada, ya con los datos de presentación del equipo. */
export interface FilaClasificacion extends LineaClasificacion {
  nombre: string;
  escudoUrl: string | null;
}

/** Todo lo que necesita la pantalla de clasificación en una sola respuesta. */
export interface PantallaClasificacion {
  filas: FilaClasificacion[];
  reglas: ReglaClasificacion[];
}
```

- [ ] **Paso 2: Escribir las pruebas que fallan**

`apps/studio/lib/server/acciones/clasificacion.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** BD con una competición, tres equipos inscritos y una jornada; devuelve ids y acciones. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-clasificacion-"));
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
      { nombre: "Santiso", clave: "santiso", categoria: "Senior", esPropio: true, escudo: "escudos/s.webp" },
      { nombre: "Rival A", clave: "rival a", categoria: "Senior" },
      { nombre: "Rival B", clave: "rival b", categoria: "Senior" },
    ])
    .returning({ id: bd.schema.equipos.id, nombre: bd.schema.equipos.nombre });
  await db
    .insert(bd.schema.competicionEquipos)
    .values(equipos.map((e) => ({ competicionId: competicion.id, equipoId: e.id })));
  const [jornada] = await db
    .insert(bd.schema.jornadas)
    .values({ competicionId: competicion.id, numero: 1 })
    .returning({ id: bd.schema.jornadas.id });
  if (!jornada) throw new Error("sin jornada");

  const porNombre = (nombre: string) => {
    const encontrado = equipos.find((e) => e.nombre === nombre);
    if (!encontrado) throw new Error(`sin equipo ${nombre}`);
    return encontrado.id;
  };
  cerrar();

  return {
    acciones: await import("./clasificacion"),
    competicionId: competicion.id,
    jornadaId: jornada.id,
    porNombre,
  };
}

describe("cargarPantallaClasificacion", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("devuelve una fila por equipo inscrito, a cero, sin partidos", async () => {
    const { acciones, competicionId } = await entorno();
    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.filas).toHaveLength(3);
    expect(pantalla.datos.filas.every((f) => f.puntos === 0)).toBe(true);
    expect(pantalla.datos.reglas).toEqual([]);
  });

  it("convierte la clave del escudo en una URL de media local", async () => {
    const { acciones, competicionId } = await entorno();
    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    const santiso = pantalla.datos.filas.find((f) => f.nombre === "Santiso");
    expect(santiso?.escudoUrl).toBe("/media/escudos/s.webp");
    expect(pantalla.datos.filas.find((f) => f.nombre === "Rival A")?.escudoUrl).toBeNull();
  });

  it("cuenta los partidos finalizados de la competición", async () => {
    const { acciones, competicionId, jornadaId, porNombre } = await entorno();
    const bd = await import("@santiso/db");
    const { db } = await (await import("@/lib/server/db")).obtenerDb();
    await db.insert(bd.schema.partidos).values({
      jornadaId,
      equipoLocalId: porNombre("Santiso"),
      equipoVisitanteId: porNombre("Rival A"),
      golesLocal: 3,
      golesVisitante: 1,
      estado: "finalizado",
    });

    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.filas[0]).toMatchObject({ nombre: "Santiso", puntos: 3, golesFavor: 3 });
  });

  it("devuelve las reglas guardadas en la competición", async () => {
    const { acciones, competicionId } = await entorno();
    const reglas = [{ id: "asc", nombre: "Ascenso", puestos: [1], color: "#10b981" }];
    const { guardarReglas } = await import("./competiciones");
    await guardarReglas(competicionId, reglas);

    const pantalla = await acciones.cargarPantallaClasificacion(competicionId);
    if (!pantalla.ok) throw new Error("falló la carga");
    expect(pantalla.datos.reglas).toEqual(reglas);
  });

  it("devuelve una pantalla vacía si la competición no existe", async () => {
    const { acciones } = await entorno();
    const pantalla = await acciones.cargarPantallaClasificacion("no-existe");
    expect(pantalla).toEqual({ ok: true, datos: { filas: [], reglas: [] } });
  });
});
```

- [ ] **Paso 3: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/clasificacion.test.ts`
Esperado: FAIL, el módulo `./clasificacion` no existe.

- [ ] **Paso 4: Implementar las consultas**

`apps/studio/lib/server/consultas/equipos.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { asc, eq, inArray } from "drizzle-orm";
import type { EquipoDto } from "@/lib/dto";
import { urlMedia } from "@/lib/media";
import { obtenerDb } from "@/lib/server/db";

const aDto = (fila: {
  id: string;
  nombre: string;
  categoria: string;
  escudo: string | null;
  esPropio: boolean;
}): EquipoDto => ({
  id: fila.id,
  nombre: fila.nombre,
  categoria: fila.categoria,
  escudo_url: fila.escudo ? urlMedia(fila.escudo) : null,
  es_propio: fila.esPropio,
});

const columnas = {
  id: schema.equipos.id,
  nombre: schema.equipos.nombre,
  categoria: schema.equipos.categoria,
  escudo: schema.equipos.escudo,
  esPropio: schema.equipos.esPropio,
};

/** Equipos inscritos en una competición, por nombre. */
export async function equiposDeCompeticion(competicionId: string): Promise<EquipoDto[]> {
  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.competicionEquipos)
    .innerJoin(schema.equipos, eq(schema.equipos.id, schema.competicionEquipos.equipoId))
    .where(eq(schema.competicionEquipos.competicionId, competicionId))
    .orderBy(asc(schema.equipos.nombre));
  return filas.map(aDto);
}

export async function equiposPorIds(ids: readonly string[]): Promise<EquipoDto[]> {
  const unicos = [...new Set(ids.filter(Boolean))];
  if (unicos.length === 0) return [];
  const { db } = await obtenerDb();
  const filas = await db
    .select(columnas)
    .from(schema.equipos)
    .where(inArray(schema.equipos.id, unicos))
    .orderBy(asc(schema.equipos.nombre));
  return filas.map(aDto);
}
```

`apps/studio/lib/server/consultas/clasificacion.ts`:

```ts
import "server-only";
import { schema } from "@santiso/db";
import { calcularClasificacion, type PartidoClasificacion } from "@santiso/domain";
import { eq } from "drizzle-orm";
import type { FilaClasificacion } from "@/lib/dto";
import { equiposDeCompeticion } from "@/lib/server/consultas/equipos";
import { obtenerDb } from "@/lib/server/db";

/** Tabla de una competición, calculada desde sus partidos finalizados. */
export async function clasificacionDeCompeticion(
  competicionId: string,
): Promise<FilaClasificacion[]> {
  const equipos = await equiposDeCompeticion(competicionId);
  if (equipos.length === 0) return [];

  const { db } = await obtenerDb();
  const partidos: PartidoClasificacion[] = await db
    .select({
      equipoLocalId: schema.partidos.equipoLocalId,
      equipoVisitanteId: schema.partidos.equipoVisitanteId,
      golesLocal: schema.partidos.golesLocal,
      golesVisitante: schema.partidos.golesVisitante,
      estado: schema.partidos.estado,
    })
    .from(schema.partidos)
    .innerJoin(schema.jornadas, eq(schema.jornadas.id, schema.partidos.jornadaId))
    .where(eq(schema.jornadas.competicionId, competicionId));

  const porId = new Map(equipos.map((e) => [e.id, e]));
  return calcularClasificacion(
    equipos.map((e) => e.id),
    partidos,
  ).map((linea) => ({
    ...linea,
    nombre: porId.get(linea.equipoId)?.nombre ?? "",
    escudoUrl: porId.get(linea.equipoId)?.escudo_url ?? null,
  }));
}
```

- [ ] **Paso 5: Implementar la acción**

`apps/studio/lib/server/acciones/clasificacion.ts`:

```ts
"use server";

import type { PantallaClasificacion } from "@/lib/dto";
import { capturar, type Resultado } from "@/lib/resultado";
import { clasificacionDeCompeticion } from "@/lib/server/consultas/clasificacion";
import { reglasDeCompeticion } from "@/lib/server/consultas/competiciones";

/**
 * Todo lo que pinta la pantalla de clasificación, en una sola acción: Next despacha las acciones
 * del cliente de una en una, así que dos llamadas serían dos viajes en serie.
 */
export async function cargarPantallaClasificacion(
  competicionId: string,
): Promise<Resultado<PantallaClasificacion>> {
  return capturar("No se pudo cargar la clasificación.", async () => {
    const [filas, reglas] = await Promise.all([
      clasificacionDeCompeticion(competicionId),
      reglasDeCompeticion(competicionId),
    ]);
    return { filas, reglas };
  });
}
```

- [ ] **Paso 6: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio/lib/server/acciones/clasificacion.test.ts`
Esperado: 5 pruebas en verde.

- [ ] **Paso 7: Conectar los helpers de equipos**

En `apps/studio/lib/supabase-queries.ts`:

1. Añadir `import { equiposDeCompeticion, equiposPorIds } from "@/lib/server/consultas/equipos";`
2. Sustituir `fetchTeamsByIds` completa por:

```ts
export async function fetchTeamsByIds(ids: string[]) {
  return (await equiposPorIds(ids)) as Team[];
}
```

3. Sustituir `fetchTeamsForCompetition` completa por:

```ts
/** `categoria` ya no filtra: la competición determina la categoría. Se conserva por compatibilidad. */
export async function fetchTeamsForCompetition(_categoria: string, competicionId: string) {
  return (await equiposDeCompeticion(competicionId)) as Team[];
}
```

- [ ] **Paso 8: Convertir `AdminLeague` en vista calculada**

En `apps/studio/components/admin/AdminLeague.tsx`:

1. Quitar `import { supabase } from "@/lib/supabase-browser";` y `fetchTeamsForCompetition` del import de `supabase-queries`.
2. Añadir:

```ts
import type { FilaClasificacion } from "@/lib/dto";
import { cargarPantallaClasificacion } from "@/lib/server/acciones/clasificacion";
```

3. Sustituir los estados `equipos`, `leagueRules`, `temporadaActiva` y `loading` por:

```ts
  const [filas, setFilas] = useState<FilaClasificacion[]>([]);
  const [leagueRules, setLeagueRules] = useState<LeagueRule[]>([]);
  const [isFetching, setIsFetching] = useState(true);
```

4. Borrar los tres `useEffect` que cargaban temporada activa, reglas y equipos, y la función `fetchEquipos`, y poner en su lugar:

```ts
  useEffect(() => {
    if (!selectedCompetitionId) return;
    let cancelado = false;
    (async () => {
      setIsFetching(true);
      const pantalla = await cargarPantallaClasificacion(selectedCompetitionId);
      if (cancelado) return;
      if (pantalla.ok) {
        setFilas(pantalla.datos.filas);
        setLeagueRules(pantalla.datos.reglas);
      } else {
        showToast(pantalla.error, "error");
      }
      setIsFetching(false);
    })();
    return () => {
      cancelado = true;
    };
  }, [selectedCompetitionId, showToast]);
```

5. Borrar `handleInputChange`, `handleSaveLeague`, `equiposOrdenados` y el botón «Guardar Clasificación» con su `div` contenedor de cabecera; sustituir esa cabecera por:

```tsx
        <div>
          <h3>Clasificación</h3>
          <p style={{ color: "#a3a3a3", fontSize: "0.9rem" }}>
            Se calcula desde los partidos finalizados. El editor de sanciones y puntos concedidos
            llega en una fase posterior.
          </p>
        </div>
```

6. En el `<tbody>`, sustituir `equiposOrdenados.map((eq, index) => {` por `filas.map((fila, index) => {`, y dentro:
   - `eq.id` → `fila.equipoId`
   - `eq.escudo_url` → `fila.escudoUrl`
   - `eq.nombre` → `fila.nombre`
   - cada `<td><input …/></td>` de `pts`, `pj`, `pg`, `pe`, `pp`, `gf`, `gc` pasa a ser una celda de texto: `<td>{fila.puntos}</td>`, `<td>{fila.jugados}</td>`, `<td>{fila.ganados}</td>`, `<td>{fila.empatados}</td>`, `<td>{fila.perdidos}</td>`, `<td>{fila.golesFavor}</td>`, `<td>{fila.golesContra}</td>`
   - la celda de diferencia: `{fila.diferencia}` con el mismo color condicional, comparando `fila.diferencia >= 0`
7. En el `BusyBanner`, dejar `show={isFetching}` y `text="Cargando clasificación..."`.
8. Borrar el bloque `<style jsx>` de `.league-editor input`, que ya no aplica; dejar la regla de `.league-editor td`.

- [ ] **Paso 9: Prueba e2e de la pantalla**

`apps/studio/e2e/catalogos.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("la clasificación se muestra calculada y sin editor", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");
  await page.getByText("Ligas", { exact: true }).first().click();

  await expect(page.getByRole("heading", { name: "Clasificación" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Guardar Clasificación/i })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("la pestaña de temporadas lista la temporada activa", async ({ page }) => {
  await page.goto("/admin");
  await page.getByText("Temporadas", { exact: true }).first().click();
  await expect(page.getByText("(ACTIVA)").first()).toBeVisible();
});
```

- [ ] **Paso 10: Comprobar en el navegador**

Con `pnpm dev` en marcha, abrir la pestaña **Ligas** y comprobar contra las capturas de `data/referencias/antes-fase-2/`:
- Los mismos equipos aparecen en la tabla.
- Los escudos se ven (ahora servidos desde `/media/`).
- La suma de puntos coincide con la clasificación manual del informe de migración, salvo diferencias que expliquen sanciones federativas. Anotar cualquier desajuste: es la validación que pide el spec (R17) y la entrada del editor de ajustes de la Fase 6.

Parar el servidor.

- [ ] **Paso 11: Puerta de calidad y commit**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/dto.ts apps/studio/lib/server apps/studio/e2e
pnpm --filter @santiso/studio exec eslint lib/server e2e
pnpm --filter @santiso/studio exec eslint . 2>&1 | tail -1   # debe seguir en 103 problemas
pnpm check
pnpm e2e
git add apps/studio/lib apps/studio/components/admin/AdminLeague.tsx apps/studio/e2e
git commit -m "feat(studio): clasificación calculada en pantalla y equipos desde SQLite" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: `pnpm e2e` en `5 passed` (3 de humo más 2 de catálogos).

---

## Verificación final de la subfase

- [ ] `pnpm check` en verde.
- [ ] `pnpm build` correcto.
- [ ] `pnpm e2e` → `5 passed`.
- [ ] `grep -rn "supabase" apps/studio/components/admin/AdminTemporadas.tsx apps/studio/components/admin/AdminLeague.tsx apps/studio/lib/useCompeticiones.ts` sin resultados.
- [ ] `apps/studio/lib/supabase-queries.ts` **sigue importando** `@/lib/supabase`, y es correcto: `fetchMatchdaysForCompetition` y `fetchMatchesForMatchday` no se migran hasta 2B-3. Lo que debe cumplirse es que `fetchSeasons`, `fetchCompeticiones`, `fetchTeamsByIds` y `fetchTeamsForCompetition` ya no lo usen.
- [ ] `curl http://127.0.0.1:3000/api/estado` responde con las cifras del informe de la Tarea 1.
- [ ] Temporadas: crear, activar y listar funcionan en el navegador; exactamente una activa.
- [ ] Ligas: la tabla calculada coincide con la clasificación manual del informe de migración, salvo desajustes anotados.
- [ ] `git status --short` limpio y sin `data/` ni `.env.local`.
- [ ] Las secciones de 2B-2 y 2B-3 siguen leyendo de Supabase y sin cambios: `git diff --name-only` no toca `AdminEquipos`, `AdminPlayers`, `AdminStaff`, `AdminSponsors`, `AdminCartelAssets`, `AdminShield`, `AdminJornadas`, `AdminActaImporter`, `AdminActaBatch`, `AdminJornadaImporter`, `useCartelForm` ni `useCartelAssets`.

## Pendientes que heredan 2B-2 y 2B-3

- **`serverActions.bodySizeLimit`**: el límite por defecto de una Server Action es 1 MB, pero `leerImagenDeFormulario` (Fase 2A) admite hasta 15 MB. 2B-2 debe subirlo en `next.config.ts` o mover las subidas a un route handler, y probarlo con una foto real grande.
- **`lib/data/season-2026-2027.ts`**: `useCompeticiones` todavía lo usa como respaldo cuando el catálogo viene vacío. Eso enmascara fallos de lectura. Se retira en 2C junto con el resto de datos estáticos.
- **Clasificación contra el informe**: los desajustes anotados en la Tarea 6, Paso 10 son la entrada del editor de ajustes de la Fase 6.
- **Cobertura visual de carteles**: solo hay referencia de 3 de las 7 plantillas (`partido`, `proximos`, `resumo`). Falta `clasificacion`, `cronoloxia`, `multiusos` y `noso11` antes de la 2C.
