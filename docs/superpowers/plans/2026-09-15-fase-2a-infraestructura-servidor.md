# Fase 2A — Infraestructura de servidor, media local y endurecimiento: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** dejar lista la base técnica sobre la que la Fase 2B reconectará las pantallas a SQLite, sin cambiar todavía ninguna pantalla:
- conexión de servidor a `data/santiso.db`,
- patrón `Resultado<T>` para acciones,
- servir y procesar imágenes locales,
- Next 16.3 escuchando solo en `127.0.0.1`,
- los dos fallos aplazados de la Fase 1 (R14, R15),
- banco de pruebas e2e y capturas de referencia.

**Arquitectura:** la app `apps/studio` pasa a depender de `@santiso/db` y `@santiso/domain` (transpilados por Next). El código de servidor vive en `apps/studio/lib/server/` y marca `import "server-only"`. La media se guarda en `data/media/<clave>`, se procesa con `sharp` y se sirve desde el route handler `app/media/[...clave]/route.ts`. La app conserva sus integraciones con Supabase hasta la Fase 2B; durante esta fase solo se permiten comprobaciones de lectura: lo nuevo convive con lo existente.

**Stack:** Next.js 16.3.5 · React 19.3.0 · Drizzle ORM 0.45.2 + @libsql/client 0.18.0 · sharp 0.35.4 · Zod 4.6.4 · Vitest 4.1.11 · @playwright/test 1.61.1 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). Leer §4 (D4 media, D5 sin auth, D6 capa de datos, D14 datos) y §8 «Fase 2».

**Plan anterior:** [`2026-09-13-fase-1-fundacion-datos.md`](2026-09-13-fase-1-fundacion-datos.md). Sus restricciones globales siguen vigentes.

## Restricciones globales

- Revisión de planificación: 20/09/2026. Las versiones indicadas son candidatas del plan anterior, no instalaciones verificadas en esta revisión. Antes de la Tarea 2, comprobar existencia y compatibilidad con `pnpm view next@16.3.5 version peerDependencies engines`, `pnpm view react@19.3.0 version` y `pnpm view sharp@0.35.4 version engines`. Si alguna no existe o es incompatible, conservar la versión instalada y documentar la alternativa estable antes de modificar el lockfile.
- Supabase: ninguna escritura, ni mediante pruebas ni mediante navegación. Las pruebas de humo solo abren vistas y consultan datos. No ejecutar importaciones reales durante 2A.
- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash (sintaxis POSIX). En rutas de Windows para ficheros `.env`, usar `pwd -W` (formato `C:/...`).
- TypeScript 5.9.3. Next **16.3.5**, React y React DOM **19.3.0**, `eslint-config-next` **16.3.5**. Antes de usar una API de Next, leer su guía en `apps/studio/node_modules/next/dist/docs/`.
- Drizzle: solo el query builder core (`db.select/insert/update/delete`, `db.transaction`). Prohibido `db.query.*`.
- Versiones compartidas solo mediante `catalog:` en `pnpm-workspace.yaml`. Paquetes internos con `workspace:*`.
- Código de servidor de la app en `apps/studio/lib/server/`; cada módulo empieza con `import "server-only"`. (La spec decía `src/server`; se sigue la estructura existente `lib/` de la app.)
- `dev` y `start` escuchan **solo en `127.0.0.1`**.
- En esta fase **no se reconecta ninguna pantalla**: no se tocan componentes de `apps/studio/components/` ni las llamadas a Supabase.
- Media: la BD guarda claves relativas (`escudos/<uuid>.webp`); la URL pública es `/media/<clave>`.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto: se le puede **añadir** la línea `SANTISO_DATA_DIR`, pero nunca se imprime ni se commitea.
- libSQL no libera el fichero de BD hasta que termina el proceso (`EBUSY`/`EPERM` en Windows).
- Dominio en español: nombres de funciones de negocio, mensajes y textos. Sin `any`. `as` solo con un comentario que lo justifique. Sin `catch` vacíos.
- Cada commit en Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Antes de cada commit: `pnpm check` en verde.

## Mapa de ficheros

```
santiso/
├─ pnpm-workspace.yaml                         (mod) catalog: sharp, server-only, @playwright/test
├─ vitest.config.ts                            (mod) incluye pruebas de apps/studio; alias server-only y @/
├─ README.md                                   (mod) 127.0.0.1, SANTISO_DATA_DIR, e2e
├─ packages/db/src/
│  ├─ client.test.ts                           (mod) busy_timeout con conexión concurrente (R15)
│  ├─ rutas.ts / rutas.test.ts                 (mod/nuevo) resolverDirDatos sin evaluar import.meta.url si hay variable
│  └─ migraciones.ts                           (mod) dirMigraciones() perezosa
├─ tools/migracion-supabase/src/cli/
│  ├─ intercambio-bd.ts                        (mod) marcha atrás de -wal/-shm y contención de errores (R14)
│  └─ intercambio-bd.test.ts                   (mod)
└─ apps/studio/
   ├─ package.json                             (mod) versiones, 127.0.0.1, dependencias nuevas, script e2e
   ├─ next.config.ts                           (mod) transpilePackages
   ├─ .env.example                             (mod) SANTISO_DATA_DIR
   ├─ test/server-only-vacio.ts                (nuevo) sustituto de server-only en Vitest
   ├─ lib/resultado.ts / .test.ts              (nuevo) Resultado<T>, exito, fallo, validar, capturar
   ├─ lib/media.ts / .test.ts                  (nuevo) urlMedia (isomórfico)
   ├─ lib/server/db.ts / .test.ts              (nuevo) obtenerDb (singleton)
   ├─ lib/server/media.ts / .test.ts           (nuevo) resolverRutaMedia, tipoMedia, guardarImagen, leerImagenDeFormulario
   ├─ app/api/estado/route.ts / .test.ts       (nuevo) diagnóstico de la BD local
   ├─ app/media/[...clave]/route.ts / .test.ts (nuevo) sirve data/media
   ├─ playwright.config.ts                     (nuevo)
   ├─ e2e/humo.spec.ts                         (nuevo)
   └─ scripts/shoot-admin.ts                   (mod) URL por defecto 127.0.0.1
```

---

### Tarea 1: Endurecer el intercambio de ficheros (R14) y la prueba de `busy_timeout` (R15)

Contexto: la revisión final de la Fase 1 dejó dos puntos aplazados.
- **R14:** si falla mover `santiso.db-wal`/`-shm` a `backups/` después de haber movido `santiso.db`, no hay marcha atrás. Además, el bucle que deshace el intercambio no contiene sus propios errores.
- **R15:** la prueba de `busy_timeout` no ejercita una segunda conexión del pool.

**Ficheros:**
- Modificar: `tools/migracion-supabase/src/cli/intercambio-bd.ts`
- Modificar: `tools/migracion-supabase/src/cli/intercambio-bd.test.ts`
- Modificar: `packages/db/src/client.test.ts`

**Interfaces:**
- Consume: `moverBdActualABackup(rutaBd, bdBackup): string[]`, `intercambiarFicheros(parametros): void`, `BdEnUsoError`, `IntercambioFallidoError`, `esErrorFicheroEnUso` (existentes); `abrirDb`, `urlArchivo` (`@santiso/db`).
- Produce: mismas firmas; nuevo comportamiento documentado abajo.

- [ ] **Paso 1: Escribir las pruebas que fallan en `intercambio-bd.test.ts`**

Añadir al final del `describe("moverBdActualABackup", …)`:

```ts
  it("si falla al mover -wal/-shm, devuelve la BD a su sitio", () => {
    const { rutaBd, bdBackup } = escenario();
    writeFileSync(rutaBd, "bd-anterior");
    writeFileSync(`${rutaBd}-wal`, "wal");
    // Un directorio no vacío en el destino hace fallar el rename del -wal en cualquier sistema.
    mkdirSync(`${bdBackup}-wal`, { recursive: true });
    writeFileSync(path.join(`${bdBackup}-wal`, "ocupado"), "x");

    expect(() => moverBdActualABackup(rutaBd, bdBackup)).toThrow();

    expect(readFileSync(rutaBd, "utf8")).toBe("bd-anterior");
    expect(readFileSync(`${rutaBd}-wal`, "utf8")).toBe("wal");
    expect(existsSync(bdBackup)).toBe(false);
  });
```

Añadir al final del `describe("intercambiarFicheros", …)`:

```ts
  it("si deshacer también falla, lo explica y no pierde la copia de la BD anterior", () => {
    const { rutaBd, dirMedia, bdTemporal, mediaTemporal, bdBackup, mediaBackup } = escenario();
    writeFileSync(bdBackup, "bd-anterior");
    // rutaBd ocupada por un directorio no vacío: falla el paso bdTemporal -> rutaBd (bdTemporal no
    // existe) y también la restauración bdBackup -> rutaBd.
    mkdirSync(rutaBd, { recursive: true });
    writeFileSync(path.join(rutaBd, "ocupado"), "x");

    expect(() =>
      intercambiarFicheros({
        rutaBd,
        dirMedia,
        bdTemporal,
        mediaTemporal,
        bdBackup,
        mediaBackup,
        sufijosBdRespaldados: [],
      }),
    ).toThrow(/no se pudo restaurar todo automáticamente/);

    expect(readFileSync(bdBackup, "utf8")).toBe("bd-anterior");
  });
```

- [ ] **Paso 2: Sustituir la prueba de `busy_timeout` en `packages/db/src/client.test.ts`**

Reemplazar el `it("aplica el busy_timeout de 5000ms a cada conexión del pool, no solo a la inicial", …)` completo por:

```ts
  it("aplica el busy_timeout a una segunda conexión abierta mientras la primera está ocupada", async () => {
    const { cliente, cerrar } = await abrirDb(urlArchivo(rutaTemporal()));
    // La transacción retiene la conexión inicial; execute() obliga al pool a abrir otra.
    const transaccion = await cliente.transaction("write");
    const otraConexion = (await cliente.execute("PRAGMA busy_timeout")).rows[0]?.["timeout"];
    await transaccion.rollback();
    cerrar();
    expect(otraConexion).toBe(5000);
  });
```

- [ ] **Paso 3: Ejecutar y comprobar qué falla**

```bash
pnpm exec vitest run tools/migracion-supabase/src/cli/intercambio-bd.test.ts packages/db/src/client.test.ts
```

Esperado:
- FAIL en «si falla al mover -wal/-shm…»: la BD queda en `backups/`.
- FAIL en «si deshacer también falla…»: se lanza el error sin controlar o con otro mensaje.
- PASS en la prueba de `busy_timeout` (el arreglo ya existe).

Comprobar que la prueba de `busy_timeout` detecta la regresión:
1. Quitar temporalmente `timeout: 5000` de `createClient({ url, timeout: 5000 })` en `packages/db/src/client.ts`.
2. Ejecutar `pnpm exec vitest run packages/db/src/client.test.ts` → FAIL (`expected 0 to be 5000`).
3. Restaurar `timeout: 5000` y comprobar con `git diff packages/db/src/client.ts` que no queda ningún cambio.

- [ ] **Paso 4: Implementar en `intercambio-bd.ts`**

Sustituir el cuerpo de `moverBdActualABackup` desde `const sufijosRespaldados: string[] = [];` hasta el `return` por:

```ts
  const sufijosRespaldados: string[] = [];
  try {
    for (const sufijo of ["-wal", "-shm"]) {
      if (existsSync(rutaBd + sufijo)) {
        renameSync(rutaBd + sufijo, bdBackup + sufijo);
        sufijosRespaldados.push(sufijo);
      }
    }
  } catch (error) {
    // Intenta todos los pasos aunque uno falle; conserva las copias para recuperación manual.
    const fallos: string[] = [];
    const restaurar = (origen: string, destino: string) => {
      try {
        renameSync(origen, destino);
      } catch (fallo) {
        fallos.push(`${origen} -> ${destino}: ${String(fallo)}`);
      }
    };
    for (const sufijo of [...sufijosRespaldados].reverse()) {
      restaurar(bdBackup + sufijo, rutaBd + sufijo);
    }
    restaurar(bdBackup, rutaBd);
    if (fallos.length > 0) {
      throw new IntercambioFallidoError(
        `No se pudo restaurar todo automáticamente: ${fallos.join("; ")}. ` +
          `No uses la app. Revisa ${rutaBd} y ${bdBackup}. Error original: ${String(error)}`,
      );
    }
    if (esErrorFicheroEnUso(error)) {
      throw new BdEnUsoError(
        "La base de datos está en uso. Cierra `pnpm dev` y repite la importación.",
      );
    }
    throw error;
  }
  return sufijosRespaldados;
```

Sustituir el bloque `catch (error) { … }` de `intercambiarFicheros` por:

```ts
  } catch (error) {
    const fallosAlDeshacer: string[] = [];
    const intentar = (paso: () => void) => {
      try {
        paso();
      } catch (errorDeshacer) {
        fallosAlDeshacer.push(
          errorDeshacer instanceof Error ? errorDeshacer.message : String(errorDeshacer),
        );
      }
    };
    for (const paso of deshacer.reverse()) intentar(paso);
    if (existsSync(bdBackup)) {
      intentar(() => renameSync(bdBackup, rutaBd));
      for (const sufijo of sufijosBdRespaldados) {
        intentar(() => renameSync(bdBackup + sufijo, rutaBd + sufijo));
      }
    }
    const motivo = error instanceof Error ? error.message : String(error);
    if (fallosAlDeshacer.length > 0) {
      throw new IntercambioFallidoError(
        `No se pudo completar el intercambio de ficheros (${motivo}) y no se pudo restaurar todo automáticamente (${fallosAlDeshacer.join("; ")}). ` +
          `No uses la app hasta revisar ${rutaBd}, ${bdBackup} y ${bdTemporal}: ninguna copia se ha borrado.`,
      );
    }
    throw new IntercambioFallidoError(
      `No se pudo completar el intercambio de ficheros (${motivo}). ` +
        `Se restauraron los datos anteriores en ${rutaBd}; la build nueva de la importación sigue disponible en ${bdTemporal}.`,
    );
  }
```

- [ ] **Paso 5: Ejecutar las pruebas**

```bash
pnpm exec vitest run tools/migracion-supabase/src/cli/intercambio-bd.test.ts packages/db/src/client.test.ts
```

Esperado: todas en verde.

- [ ] **Paso 6: Puerta de calidad y commit**

```bash
pnpm check
git add tools/migracion-supabase/src/cli packages/db/src/client.test.ts
git commit -m "fix(migracion): marcha atrás completa al respaldar la BD y prueba real de busy_timeout" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 2: Next 16.3.5, React 19.3, escucha en 127.0.0.1 y paquetes del workspace

**Ficheros:**
- Modificar: `apps/studio/package.json`
- Modificar: `apps/studio/next.config.ts`
- Modificar: `apps/studio/scripts/shoot-admin.ts:16`
- Modificar: `README.md` (URL de `pnpm dev`)

**Interfaces:**
- Consume: paquetes `@santiso/db` y `@santiso/domain` (Fase 1).
- Produce: la app puede importar `@santiso/db` y `@santiso/domain` desde código de servidor; servidor en `http://127.0.0.1:3000`.

- [ ] **Paso 1: Registrar la línea base de lint de la app**

```bash
pnpm lint:studio 2>&1 | tail -3
```

Anotar el recuento (`✖ N problems (E errors, W warnings)`). Hoy son unos 103 problemas previos a este plan. Esta tarea no debe aumentarlo.

- [ ] **Paso 2: Actualizar `apps/studio/package.json`**

Cambiar solo estas claves (el resto igual):

```json
"scripts": {
  "dev": "next dev -H 127.0.0.1",
  "build": "next build",
  "start": "next start -H 127.0.0.1",
  "lint": "eslint",
  "typecheck": "tsc --noEmit"
},
```

En `dependencies`:
- `"next": "16.3.5"`
- `"react": "19.3.0"`
- `"react-dom": "19.3.0"`
- añadir `"@santiso/db": "workspace:*"`
- añadir `"@santiso/domain": "workspace:*"`

En `devDependencies`:
- `"eslint-config-next": "16.3.5"`

- [ ] **Paso 3: Transpilar los paquetes del workspace en `apps/studio/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTA: React Compiler queda DESACTIVADO de momento — rompe styled-jsx
  // (hydration mismatch: el cliente pierde las clases scoped). Se reactivará
  // tras migrar el admin a CSS global (sin styled-jsx) en el sistema de diseño.
  // Los paquetes internos exportan TypeScript sin compilar (`exports` → `src/*.ts`).
  transpilePackages: ["@santiso/db", "@santiso/domain"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Paso 4: URL por defecto de capturas y README**

- En `apps/studio/scripts/shoot-admin.ts`, cambiar `"http://localhost:3000"` por `"http://127.0.0.1:3000"`.
- En `README.md`, cambiar `pnpm dev          # http://localhost:3000/admin` por `pnpm dev          # http://127.0.0.1:3000/admin (solo accesible desde este equipo)`.

- [ ] **Paso 5: Instalar y verificar**

```bash
pnpm install
pnpm --filter @santiso/studio typecheck
pnpm build
pnpm lint:studio 2>&1 | tail -3
```

Esperado:
- `typecheck` con código 0.
- `build` termina con `✓ Compiled successfully` y lista `/admin`.
- El lint de la app no supera la línea base del Paso 1. Si hay reglas nuevas de `eslint-config-next` 16.3.5, anotar la diferencia en el informe **sin corregir componentes** (se reescriben en fases posteriores).

- [ ] **Paso 6: Comprobar la escucha**

```bash
(pnpm dev > /tmp/dev.log 2>&1 &) ; for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/admin); [ "$code" = "200" ] && break; sleep 2; done; echo "127.0.0.1 → $code"
grep -iE "ready|local:" /tmp/dev.log | head -3
```

Esperado: `127.0.0.1 → 200` y el log muestra `http://127.0.0.1:3000`. Parar el servidor (`kill` del proceso de `next dev`) y comprobar que el puerto deja de responder.

- [ ] **Paso 7: Puerta de calidad y commit**

```bash
pnpm check
git add apps/studio/package.json apps/studio/next.config.ts apps/studio/scripts/shoot-admin.ts README.md pnpm-lock.yaml
git commit -m "chore(studio): Next 16.3.5 y React 19.3, escucha solo en 127.0.0.1 y paquetes del workspace" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: Rutas de datos seguras dentro de un bundler

Contexto: `rutas.ts` y `migraciones.ts` calculan rutas con `import.meta.url` **al importarse**. Dentro del bundle de Next esa URL puede no apuntar al fichero fuente. En la app, la ruta llegará siempre por `SANTISO_DATA_DIR`, y `import.meta.url` solo debe evaluarse cuando la variable no existe (CLIs y pruebas).

**Ficheros:**
- Modificar: `packages/db/src/rutas.ts`
- Crear: `packages/db/src/rutas.test.ts`
- Modificar: `packages/db/src/migraciones.ts`

**Interfaces:**
- Consume: nada nuevo.
- Produce:
  - `resolverDirDatos(entorno?: NodeJS.ProcessEnv): string` (variable → ruta absoluta; sin variable → `<repo>/data`).
  - `DIR_DATOS`, `RUTA_BD`, `DIR_MEDIA`, `DIR_SNAPSHOTS`, `DIR_BACKUPS`, `DIR_INFORMES`, `urlArchivo`, `marcaFichero` (sin cambios de nombre).
  - `dirMigraciones(): string` sustituye a la constante `DIR_MIGRACIONES` (solo se usaba dentro de `migraciones.ts`).
  - `migrarBd(db: Db, carpeta?: string): Promise<void>`.

- [ ] **Paso 1: Escribir la prueba que falla**

`packages/db/src/rutas.test.ts`:

```ts
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolverDirDatos } from "./rutas";

describe("resolverDirDatos", () => {
  it("usa SANTISO_DATA_DIR como ruta absoluta", () => {
    const absoluta = path.resolve(tmpdir(), "santiso-datos");
    expect(resolverDirDatos({ SANTISO_DATA_DIR: absoluta })).toBe(absoluta);
  });

  it("resuelve una ruta relativa contra el directorio actual", () => {
    expect(resolverDirDatos({ SANTISO_DATA_DIR: "datos-relativos" })).toBe(
      path.resolve(process.cwd(), "datos-relativos"),
    );
  });

  it("sin variable (o vacía) usa la carpeta data del repositorio", () => {
    const dir = resolverDirDatos({});
    expect(path.basename(dir)).toBe("data");
    expect(existsSync(path.join(dir, "..", "pnpm-workspace.yaml"))).toBe(true);
    expect(resolverDirDatos({ SANTISO_DATA_DIR: "   " })).toBe(dir);
  });
});
```

- [ ] **Paso 2: Ejecutar y comprobar que falla**

Ejecutar: `pnpm exec vitest run packages/db/src/rutas.test.ts`
Esperado: FAIL, `resolverDirDatos` no existe.

- [ ] **Paso 3: Implementar**

Sustituir en `packages/db/src/rutas.ts` las líneas desde `import path` hasta `export const DIR_INFORMES…` por:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Directorio de datos locales (BD, media, snapshots, copias, informes).
 * `SANTISO_DATA_DIR` lo sobrescribe y se resuelve a ruta absoluta. Sin ella se usa `<repo>/data`,
 * calculado desde este fichero: solo es fiable fuera de un bundler (CLIs y pruebas), por eso
 * `import.meta.url` únicamente se evalúa en ese caso.
 */
export function resolverDirDatos(entorno: NodeJS.ProcessEnv = process.env): string {
  const configurado = entorno.SANTISO_DATA_DIR?.trim();
  if (configurado) return path.resolve(configurado);
  return path.join(fileURLToPath(new URL("../../../", import.meta.url)), "data");
}

export const DIR_DATOS = resolverDirDatos();
export const RUTA_BD = path.join(DIR_DATOS, "santiso.db");
export const DIR_MEDIA = path.join(DIR_DATOS, "media");
export const DIR_SNAPSHOTS = path.join(DIR_DATOS, "snapshots");
export const DIR_BACKUPS = path.join(DIR_DATOS, "backups");
export const DIR_INFORMES = path.join(DIR_DATOS, "informes");
```

(`urlArchivo` y `marcaFichero` se quedan igual.)

`packages/db/src/migraciones.ts` completo:

```ts
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

/** Carpeta de migraciones SQL. Es una función para no evaluar `import.meta.url` al importar el paquete. */
export const dirMigraciones = () => fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrarBd(db: Db, carpeta = dirMigraciones()): Promise<void> {
  await migrate(db, { migrationsFolder: carpeta });
}
```

- [ ] **Paso 4: Ejecutar las pruebas del paquete y de la migración**

```bash
pnpm exec vitest run packages/db tools/migracion-supabase
```

Esperado: todo en verde.

- [ ] **Paso 5: Puerta de calidad y commit**

```bash
pnpm check
git add packages/db/src/rutas.ts packages/db/src/rutas.test.ts packages/db/src/migraciones.ts
git commit -m "refactor(db): rutas de datos y migraciones sin evaluar import.meta.url al importar" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: Conexión de servidor, `Resultado<T>` y diagnóstico `/api/estado`

**Ficheros:**
- Modificar: `pnpm-workspace.yaml` (catalog `server-only: 0.0.1`)
- Modificar: `apps/studio/package.json` (dependencias `server-only`, `zod`, `drizzle-orm`)
- Modificar: `vitest.config.ts`
- Crear: `apps/studio/test/server-only-vacio.ts`
- Crear: `apps/studio/lib/resultado.ts`, `apps/studio/lib/resultado.test.ts`
- Crear: `apps/studio/lib/server/db.ts`, `apps/studio/lib/server/db.test.ts`
- Crear: `apps/studio/app/api/estado/route.ts`, `apps/studio/app/api/estado/route.test.ts`
- Modificar: `apps/studio/.env.example`, `README.md`
- Modificar (sin commitear): `apps/studio/.env.local` (añadir `SANTISO_DATA_DIR`)

**Interfaces:**
- Consume: `abrirDb`, `migrarBd`, `urlArchivo`, `RUTA_BD`, `ConexionDb`, `schema` (`@santiso/db`); `resolverDirDatos` (Tarea 3).
- Produce:
  - `type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string; campos?: Record<string, string> }`
  - `type Fallo = Extract<Resultado<unknown>, { ok: false }>`
  - `exito<T>(datos: T): Resultado<T>`
  - `fallo(error: string, campos?: Record<string, string>): Fallo`
  - `validar<T>(esquema: z.ZodType<T>, entrada: unknown): Resultado<T>`
  - `capturar<T>(mensajeError: string, operacion: () => Promise<T>): Promise<Resultado<T>>`
  - `obtenerDb(): Promise<ConexionDb>` (singleton en `globalThis.santisoConexionDb`)
  - `GET /api/estado` → `{ ok: true, temporadaActiva: string | null, partidos: number }` o `503 { ok: false, error }`
  - Pruebas de Vitest en `apps/studio/{lib,app}/**/*.test.ts`, con alias `@/` → `apps/studio/` y `server-only` → módulo vacío.

- [ ] **Paso 1: Dependencias y configuración de Vitest**

En `pnpm-workspace.yaml`, añadir al `catalog:` (orden alfabético):

```yaml
  server-only: 0.0.1
```

En `apps/studio/package.json`, añadir a `dependencies`:

```json
"drizzle-orm": "catalog:",
"server-only": "catalog:",
"zod": "catalog:"
```

`apps/studio/test/server-only-vacio.ts`:

```ts
// Sustituto de `server-only` en Vitest: el paquete real lanza fuera de React Server Components.
export {};
```

`vitest.config.ts` completo:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const studio = fileURLToPath(new URL("./apps/studio/", import.meta.url)).replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: `${studio}test/server-only-vacio.ts` },
      { find: /^@\//, replacement: studio },
    ],
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "tools/*/src/**/*.test.ts",
      "apps/studio/{lib,app}/**/*.test.ts",
    ],
    environment: "node",
  },
});
```

Ejecutar `pnpm install`.

- [ ] **Paso 2: Escribir las pruebas que fallan**

`apps/studio/lib/resultado.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { capturar, exito, fallo, validar } from "./resultado";

describe("exito / fallo", () => {
  it("construyen las dos variantes", () => {
    expect(exito(3)).toEqual({ ok: true, datos: 3 });
    expect(fallo("Error")).toEqual({ ok: false, error: "Error" });
    expect(fallo("Error", { nombre: "Obligatorio" })).toEqual({
      ok: false,
      error: "Error",
      campos: { nombre: "Obligatorio" },
    });
  });
});

describe("validar", () => {
  const esquema = z.object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio"),
    jugador: z.object({ dorsal: z.number().int().positive("Dorsal no válido") }),
  });

  it("devuelve los datos ya transformados", () => {
    expect(validar(esquema, { nombre: "  Ana ", jugador: { dorsal: 9 } })).toEqual({
      ok: true,
      datos: { nombre: "Ana", jugador: { dorsal: 9 } },
    });
  });

  it("devuelve el primer mensaje de cada campo con su ruta", () => {
    expect(validar(esquema, { nombre: " ", jugador: { dorsal: -1 } })).toEqual({
      ok: false,
      error: "Revisa los datos del formulario.",
      campos: { nombre: "El nombre es obligatorio", "jugador.dorsal": "Dorsal no válido" },
    });
  });
});

describe("capturar", () => {
  it("envuelve el resultado de la operación", async () => {
    await expect(capturar("No se pudo", async () => "hecho")).resolves.toEqual({
      ok: true,
      datos: "hecho",
    });
  });

  it("convierte una excepción en un fallo y la registra", async () => {
    const registro = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      capturar("No se pudo guardar el equipo.", async () => {
        throw new Error("SQLITE_CONSTRAINT");
      }),
    ).resolves.toEqual({ ok: false, error: "No se pudo guardar el equipo." });
    expect(registro).toHaveBeenCalledOnce();
    registro.mockRestore();
  });
});
```

`apps/studio/lib/server/db.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dirTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-studio-"));

describe("obtenerDb", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.santisoConexionDb = undefined;
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
  });

  it("falla con instrucciones si no existe la base de datos", async () => {
    process.env.SANTISO_DATA_DIR = dirTemporal();
    const { obtenerDb } = await import("./db");
    await expect(obtenerDb()).rejects.toThrow(/pnpm migracion:importar/);
    expect(globalThis.santisoConexionDb).toBeUndefined();
  });

  it("abre la base de datos existente una sola vez", async () => {
    const dir = dirTemporal();
    process.env.SANTISO_DATA_DIR = dir;
    const bd = await import("@santiso/db");
    const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
    await bd.migrarBd(inicial.db);
    inicial.cerrar();

    const { obtenerDb } = await import("./db");
    const primera = obtenerDb();
    expect(obtenerDb()).toBe(primera);
    const { cliente } = await primera;
    const fila = (await cliente.execute("select count(*) as total from temporadas")).rows[0];
    expect(fila?.["total"]).toBe(0);
  });
});
```

`apps/studio/app/api/estado/route.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/estado", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.santisoConexionDb = undefined;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    vi.restoreAllMocks();
  });

  it("informa de la temporada activa y del número de partidos", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-estado-"));
    process.env.SANTISO_DATA_DIR = dir;
    const bd = await import("@santiso/db");
    const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
    await bd.migrarBd(inicial.db);
    await inicial.db.insert(bd.schema.temporadas).values({ nombre: "2026/27", activa: true });
    inicial.cerrar();

    const { GET } = await import("./route");
    const respuesta = await GET();

    expect(respuesta.status).toBe(200);
    await expect(respuesta.json()).resolves.toEqual({
      ok: true,
      temporadaActiva: "2026/27",
      partidos: 0,
    });
  });

  it("responde 503 si no hay base de datos", async () => {
    process.env.SANTISO_DATA_DIR = mkdtempSync(path.join(tmpdir(), "santiso-estado-"));
    const { GET } = await import("./route");
    const respuesta = await GET();
    expect(respuesta.status).toBe(503);
    await expect(respuesta.json()).resolves.toMatchObject({ ok: false });
  });
});
```

- [ ] **Paso 3: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio`
Esperado: FAIL en los tres ficheros por módulos inexistentes.

- [ ] **Paso 4: Implementar**

`apps/studio/lib/resultado.ts`:

```ts
import type { z } from "zod";

/** Salida de toda acción de servidor: nunca lanza hacia el cliente. */
export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: Record<string, string> };

export type Fallo = Extract<Resultado<unknown>, { ok: false }>;

export const exito = <T>(datos: T): Resultado<T> => ({ ok: true, datos });

export const fallo = (error: string, campos?: Record<string, string>): Fallo =>
  campos ? { ok: false, error, campos } : { ok: false, error };

/** Valida la entrada de una acción. De cada campo se devuelve el primer mensaje, con su ruta. */
export function validar<T>(esquema: z.ZodType<T>, entrada: unknown): Resultado<T> {
  const resultado = esquema.safeParse(entrada);
  if (resultado.success) return exito(resultado.data);
  const campos: Record<string, string> = {};
  for (const problema of resultado.error.issues) {
    const campo = problema.path.map(String).join(".") || "_";
    campos[campo] ??= problema.message;
  }
  return fallo("Revisa los datos del formulario.", campos);
}

/** Ejecuta una operación de servidor y convierte cualquier excepción en un fallo con mensaje para el usuario. */
export async function capturar<T>(
  mensajeError: string,
  operacion: () => Promise<T>,
): Promise<Resultado<T>> {
  try {
    return exito(await operacion());
  } catch (error) {
    console.error(mensajeError, error);
    return fallo(mensajeError);
  }
}
```

`apps/studio/lib/server/db.ts`:

```ts
import "server-only";
import { existsSync } from "node:fs";
import { abrirDb, type ConexionDb, RUTA_BD, urlArchivo } from "@santiso/db";

declare global {
  // Una conexión por proceso, guardada en globalThis para sobrevivir a la recarga en caliente.
  // eslint-disable-next-line no-var -- las declaraciones globales de TypeScript requieren `var`
  var santisoConexionDb: Promise<ConexionDb> | undefined;
}

/** Conexión única a `data/santiso.db` para Server Components, acciones y route handlers. */
export function obtenerDb(): Promise<ConexionDb> {
  if (!globalThis.santisoConexionDb) {
    if (!existsSync(RUTA_BD)) {
      return Promise.reject(
        new Error(`No existe la base de datos ${RUTA_BD}. Ejecuta pnpm migracion:importar.`),
      );
    }
    globalThis.santisoConexionDb = abrirDb(urlArchivo(RUTA_BD)).catch((error: unknown) => {
      globalThis.santisoConexionDb = undefined;
      throw error;
    });
  }
  return globalThis.santisoConexionDb;
}
```

`apps/studio/app/api/estado/route.ts`:

```ts
import { schema } from "@santiso/db";
import { count, eq } from "drizzle-orm";
import { obtenerDb } from "@/lib/server/db";

/** Diagnóstico local: confirma que la app lee `data/santiso.db`. */
export async function GET() {
  try {
    const { db } = await obtenerDb();
    const [temporada] = await db
      .select({ nombre: schema.temporadas.nombre })
      .from(schema.temporadas)
      .where(eq(schema.temporadas.activa, true));
    const [partidos] = await db.select({ total: count() }).from(schema.partidos);
    return Response.json({
      ok: true,
      temporadaActiva: temporada?.nombre ?? null,
      partidos: partidos?.total ?? 0,
    });
  } catch (error) {
    console.error("GET /api/estado", error);
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 503 },
    );
  }
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio`
Esperado: 3 ficheros en verde.

- [ ] **Paso 6: Configurar la ruta de datos de la app**

Añadir a `apps/studio/.env.example`, al final:

```dotenv

# Datos locales (BD SQLite y media). Ruta absoluta a la carpeta data/ del repositorio.
SANTISO_DATA_DIR=C:/ruta/al/repositorio/santiso/data
```

Añadir la línea real a `apps/studio/.env.local` **sin mostrar el fichero**:

```bash
grep -q '^SANTISO_DATA_DIR=' apps/studio/.env.local || printf '\nSANTISO_DATA_DIR=%s/data\n' "$(pwd -W)" >> apps/studio/.env.local
grep -c '^SANTISO_DATA_DIR=' apps/studio/.env.local
```

Esperado: `1`.

En `README.md`, sección «Puesta en marcha», añadir tras el bloque de código:

```markdown
La app lee los datos de `SANTISO_DATA_DIR` (ruta absoluta a `data/`), definida en `apps/studio/.env.local`. Comprueba la conexión con `http://127.0.0.1:3000/api/estado`.
```

- [ ] **Paso 7: Verificar con la BD real**

```bash
pnpm build
(pnpm dev > /tmp/dev.log 2>&1 &) ; for i in $(seq 1 30); do r=$(curl -s http://127.0.0.1:3000/api/estado); [ -n "$r" ] && break; sleep 2; done; echo "$r"
```

Esperado:
- `build` correcto; `/api/estado` aparece como ruta dinámica (`ƒ`).
- La respuesta es `{"ok":true,"temporadaActiva":"2026/27","partidos":688}`.

Si responde `ok:false`, anotar el mensaje: suele ser `SANTISO_DATA_DIR` o la resolución de `@santiso/db` dentro del bundle. Parar el servidor.

- [ ] **Paso 8: Puerta de calidad y commit**

```bash
pnpm check
git status --short   # no debe aparecer apps/studio/.env.local ni data/
git add pnpm-workspace.yaml pnpm-lock.yaml vitest.config.ts apps/studio/package.json apps/studio/test apps/studio/lib/resultado.ts apps/studio/lib/resultado.test.ts apps/studio/lib/server apps/studio/app/api/estado apps/studio/.env.example README.md
git commit -m "feat(studio): conexión de servidor a SQLite, patrón Resultado y diagnóstico /api/estado" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 5: Media local, procesado con `sharp` y ruta `/media/[...clave]`

Contexto: hoy el navegador procesa las imágenes en `apps/studio/lib/image-utils.ts` y las sube a Supabase Storage. El proceso es:
1. convertir HEIC con `heic2any`;
2. recortar la transparencia (alfa > 15);
3. hacer el lienzo cuadrado con un 5 % de margen transparente;
4. comprimir a WebP con un máximo de 1200 px.

En la Fase 2B el cliente seguirá convirtiendo HEIC y enviará el fichero a una acción de servidor. El recorte, el cuadrado y la compresión pasan al servidor con `sharp`. En esta tarea solo se crean las piezas; no se conecta ningún formulario.

**Ficheros:**
- Modificar: `pnpm-workspace.yaml` (catalog `sharp: 0.35.4`)
- Modificar: `apps/studio/package.json` (dependencia `sharp`)
- Crear: `apps/studio/lib/media.ts`, `apps/studio/lib/media.test.ts`
- Crear: `apps/studio/lib/server/media.ts`, `apps/studio/lib/server/media.test.ts`
- Crear: `apps/studio/app/media/[...clave]/route.ts`, `apps/studio/app/media/[...clave]/route.test.ts`

**Interfaces:**
- Consume: `DIR_MEDIA` (`@santiso/db`); `Resultado`, `exito`, `fallo` (Tarea 4); alias `@/` y `server-only` en Vitest (Tarea 4).
- Produce:
  - `urlMedia(clave: string): string`: `"escudos/a b.webp"` → `"/media/escudos/a%20b.webp"`.
  - `type CarpetaMedia = "escudos" | "jugadores" | "staff" | "sponsors" | "cartel"`
  - `resolverRutaMedia(segmentos: readonly string[], raiz?: string): string | null`
  - `tipoMedia(ruta: string): string | null`
  - `guardarImagen(bytes: Uint8Array, carpeta: CarpetaMedia, raiz?: string): Promise<string>` (devuelve la clave).
  - `leerImagenDeFormulario(formulario: FormData, campo: string): Promise<Resultado<Uint8Array>>`
  - `GET /media/<clave>`: 200 con el fichero y caché inmutable, o 404.

- [ ] **Paso 1: Dependencias**

En `pnpm-workspace.yaml`, añadir al `catalog:` en orden alfabético:

```yaml
  sharp: 0.35.4
```

En `apps/studio/package.json`, añadir a `dependencies`:

```json
"sharp": "catalog:"
```

Ejecutar:

```bash
pnpm install
pnpm --filter @santiso/studio exec node -e "import('sharp').then(s => console.log(s.default.versions.sharp))"
```

Esperado: `0.35.4`. `sharp` usa binarios precompilados (`@img/sharp-win32-x64`), así que no necesita el script de build que ignora `ignoredBuiltDependencies`.

- [ ] **Paso 2: Escribir las pruebas que fallan**

`apps/studio/lib/media.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { urlMedia } from "./media";

describe("urlMedia", () => {
  it("construye la URL codificando cada segmento", () => {
    expect(urlMedia("escudos/abc.webp")).toBe("/media/escudos/abc.webp");
    expect(urlMedia("sponsors/café bar#1.webp")).toBe("/media/sponsors/caf%C3%A9%20bar%231.webp");
  });
});
```

`apps/studio/lib/server/media.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { guardarImagen, leerImagenDeFormulario, resolverRutaMedia, tipoMedia } from "./media";

const raizTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-media-"));

/** Imagen transparente de 200x100 con un rectángulo rojo opaco de 50x20 en (100, 40). */
const logoConTransparencia = () =>
  sharp({
    create: { width: 200, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: {
          create: { width: 50, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
        },
        left: 100,
        top: 40,
      },
    ])
    .png()
    .toBuffer();

describe("resolverRutaMedia", () => {
  const raiz = path.resolve(tmpdir(), "raiz-media");

  it("resuelve una clave válida dentro de la raíz", () => {
    expect(resolverRutaMedia(["escudos", "a.webp"], raiz)).toBe(path.join(raiz, "escudos", "a.webp"));
  });

  it.each([
    [[]],
    [[""]],
    [["."]],
    [[".."]],
    [["escudos", "..", "..", "secreto"]],
    [["a\\..\\b.webp"]],
    [["a/b.webp"]],
    [["C:", "Windows"]],
    [["a\0.webp"]],
  ])("rechaza %j", (segmentos) => {
    expect(resolverRutaMedia(segmentos, raiz)).toBeNull();
  });
});

describe("tipoMedia", () => {
  it("reconoce las extensiones de imagen admitidas sin distinguir mayúsculas", () => {
    expect(tipoMedia("a/b.webp")).toBe("image/webp");
    expect(tipoMedia("a/b.PNG")).toBe("image/png");
    expect(tipoMedia("a/b.jpeg")).toBe("image/jpeg");
  });

  it("no sirve otros tipos", () => {
    expect(tipoMedia("a/b.svg")).toBeNull();
    expect(tipoMedia("a/b.html")).toBeNull();
    expect(tipoMedia("a/sin-extension")).toBeNull();
  });
});

describe("guardarImagen", () => {
  it("recorta la transparencia, centra en un cuadrado con 5 % de margen y guarda WebP", async () => {
    const raiz = raizTemporal();
    const clave = await guardarImagen(await logoConTransparencia(), "escudos", raiz);

    expect(clave).toMatch(/^escudos\/[0-9a-f-]{36}\.webp$/);
    const guardada = readFileSync(path.join(raiz, clave));
    const meta = await sharp(guardada).metadata();
    // Recorte 50x20; margen floor(50 * 0.05) = 2; lado 50 + 2 * 2 = 54.
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 54, 54]);

    const { data, info } = await sharp(guardada).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
    expect(pixel(0, 0)[3]).toBe(0);
    const [rojo = 0, verde = 255, , alfa = 0] = pixel(27, 27);
    expect(rojo).toBeGreaterThan(200);
    expect(verde).toBeLessThan(60);
    expect(alfa).toBe(255);
  });

  it("reduce a un máximo de 1200 px y no amplía las pequeñas", async () => {
    const raiz = raizTemporal();
    const grande = await sharp({
      create: { width: 3000, height: 1000, channels: 3, background: { r: 0, g: 80, b: 160 } },
    })
      .jpeg()
      .toBuffer();
    const clave = await guardarImagen(grande, "jugadores", raiz);
    const meta = await sharp(readFileSync(path.join(raiz, clave))).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 1200]);
  });

  it("rechaza bytes que no son una imagen", async () => {
    await expect(guardarImagen(new TextEncoder().encode("hola"), "staff", raizTemporal())).rejects.toThrow();
  });
});

describe("leerImagenDeFormulario", () => {
  const formularioCon = (valor: File | string) => {
    const formulario = new FormData();
    formulario.set("imagen", valor);
    return formulario;
  };

  it("devuelve los bytes de una imagen válida", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const resultado = await leerImagenDeFormulario(
      formularioCon(new File([bytes], "a.png", { type: "image/png" })),
      "imagen",
    );
    expect(resultado).toEqual({ ok: true, datos: bytes });
  });

  it("rechaza campos vacíos, ficheros que no son imagen y los mayores de 15 MB", async () => {
    await expect(leerImagenDeFormulario(new FormData(), "imagen")).resolves.toMatchObject({ ok: false });
    await expect(leerImagenDeFormulario(formularioCon("texto"), "imagen")).resolves.toMatchObject({ ok: false });
    await expect(
      leerImagenDeFormulario(formularioCon(new File(["x"], "a.pdf", { type: "application/pdf" })), "imagen"),
    ).resolves.toMatchObject({ ok: false, error: "El fichero debe ser una imagen." });
    const enorme = new File([new Uint8Array(15 * 1024 * 1024 + 1)], "a.png", { type: "image/png" });
    await expect(leerImagenDeFormulario(formularioCon(enorme), "imagen")).resolves.toMatchObject({
      ok: false,
      error: "La imagen supera los 15 MB.",
    });
  });
});
```

`apps/studio/app/media/[...clave]/route.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

let GET: typeof import("./route").GET;

const pedir = (clave: string[]) =>
  GET(new Request("http://127.0.0.1:3000/media"), { params: Promise.resolve({ clave }) });

describe("GET /media/[...clave]", () => {
  beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-ruta-media-"));
    mkdirSync(path.join(dir, "media", "escudos"), { recursive: true });
    writeFileSync(path.join(dir, "media", "escudos", "a.webp"), "contenido");
    writeFileSync(path.join(dir, "media", "nota.txt"), "no es imagen");
    writeFileSync(path.join(dir, "fuera.webp"), "fuera de media");
    process.env.SANTISO_DATA_DIR = dir;
    vi.resetModules();
    ({ GET } = await import("./route"));
    delete process.env.SANTISO_DATA_DIR;
  });

  it("sirve el fichero con su tipo y caché inmutable", async () => {
    const respuesta = await pedir(["escudos", "a.webp"]);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("image/webp");
    expect(respuesta.headers.get("cache-control")).toBe("no-cache");
    await expect(respuesta.text()).resolves.toBe("contenido");
  });

  it.each([[["escudos", "no-existe.webp"]], [["nota.txt"]], [["..", "fuera.webp"]], [["escudos"]]])(
    "responde 404 para %j",
    async (clave) => {
      expect((await pedir(clave)).status).toBe(404);
    },
  );
});
```

- [ ] **Paso 3: Ejecutar y comprobar que fallan**

Ejecutar: `pnpm exec vitest run apps/studio/lib/media.test.ts apps/studio/lib/server/media.test.ts "apps/studio/app/media"`
Esperado: FAIL por módulos inexistentes.

- [ ] **Paso 4: Implementar**

`apps/studio/lib/media.ts`:

```ts
/** URL pública de un fichero de `data/media` a partir de su clave relativa (`escudos/<uuid>.webp`). */
export const urlMedia = (clave: string) =>
  `/media/${clave.split("/").map(encodeURIComponent).join("/")}`;
```

`apps/studio/lib/server/media.ts`:

```ts
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DIR_MEDIA } from "@santiso/db";
import sharp from "sharp";
import { exito, fallo, type Resultado } from "@/lib/resultado";

export type CarpetaMedia = "escudos" | "jugadores" | "staff" | "sponsors" | "cartel";

const TIPOS_MEDIA: Readonly<Record<string, string>> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

const MAX_BYTES_IMAGEN = 15 * 1024 * 1024;
const LADO_MAXIMO = 1200;
const UMBRAL_ALFA = 15;
const MARGEN = 0.05;
const TRANSPARENTE = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Ruta absoluta de una clave de media, o `null` si la clave no es segura.
 * Cada segmento debe ser un nombre simple: sin separadores, sin `.`/`..`, sin unidad de Windows
 * (`C:`) y sin byte nulo. Además, el resultado debe quedar dentro de la raíz.
 */
export function resolverRutaMedia(segmentos: readonly string[], raiz = DIR_MEDIA): string | null {
  if (segmentos.length === 0) return null;
  const inseguro = (segmento: string) =>
    segmento === "" || segmento === "." || segmento === ".." || /[\\/:\0]/.test(segmento);
  if (segmentos.some(inseguro)) return null;
  const ruta = path.resolve(raiz, ...segmentos);
  const relativa = path.relative(raiz, ruta);
  if (relativa === "" || relativa.startsWith("..") || path.isAbsolute(relativa)) return null;
  return ruta;
}

/** Tipo MIME de los ficheros que se sirven; `null` para cualquier otro. SVG queda fuera a propósito. */
export const tipoMedia = (ruta: string): string | null =>
  TIPOS_MEDIA[path.extname(ruta).toLowerCase()] ?? null;

/**
 * Normaliza una imagen y la guarda en `<raiz>/<carpeta>/<uuid>.webp`. Devuelve la clave relativa.
 * Mismo resultado que el antiguo proceso del navegador: recorta los bordes transparentes
 * (alfa > 15), la centra en un cuadrado con un 5 % de margen transparente y la reduce a un
 * máximo de 1200 px en WebP.
 */
export async function guardarImagen(
  bytes: Uint8Array,
  carpeta: CarpetaMedia,
  raiz = DIR_MEDIA,
): Promise<string> {
  const { data, info } = await sharp(bytes)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((data[(y * width + x) * channels + 3] ?? 0) > UMBRAL_ALFA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  let imagen = sharp(data, { raw: { width, height, channels } });
  if (maxX >= minX && maxY >= minY) {
    const ancho = maxX - minX + 1;
    const alto = maxY - minY + 1;
    const lado = Math.max(ancho, alto) + 2 * Math.floor(Math.max(ancho, alto) * MARGEN);
    const izquierda = Math.floor((lado - ancho) / 2);
    const arriba = Math.floor((lado - alto) / 2);
    // Se materializa el cuadrado antes de redimensionar: sharp aplica `extend` después de `resize`.
    const cuadrada = await imagen
      .extract({ left: minX, top: minY, width: ancho, height: alto })
      .extend({
        left: izquierda,
        right: lado - ancho - izquierda,
        top: arriba,
        bottom: lado - alto - arriba,
        background: TRANSPARENTE,
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    imagen = sharp(cuadrada.data, {
      raw: { width: cuadrada.info.width, height: cuadrada.info.height, channels: cuadrada.info.channels },
    });
  }

  const salida = await imagen
    .resize(LADO_MAXIMO, LADO_MAXIMO, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const clave = `${carpeta}/${randomUUID()}.webp`;
  await mkdir(path.join(raiz, carpeta), { recursive: true });
  await writeFile(path.join(raiz, clave), salida);
  return clave;
}

/** Extrae y valida la imagen de un campo de formulario enviado a una acción de servidor. */
export async function leerImagenDeFormulario(
  formulario: FormData,
  campo: string,
): Promise<Resultado<Uint8Array>> {
  const valor = formulario.get(campo);
  if (!(valor instanceof File) || valor.size === 0) return fallo("Selecciona una imagen.");
  if (!valor.type.startsWith("image/")) return fallo("El fichero debe ser una imagen.");
  if (valor.size > MAX_BYTES_IMAGEN) return fallo("La imagen supera los 15 MB.");
  return exito(new Uint8Array(await valor.arrayBuffer()));
}
```

`apps/studio/app/media/[...clave]/route.ts`:

```ts
import { readFile } from "node:fs/promises";
import { resolverRutaMedia, tipoMedia } from "@/lib/server/media";

const noEncontrado = () => new Response("No encontrado", { status: 404 });

const esFicheroInexistente = (error: unknown) =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "EISDIR");

/** Sirve `data/media/<clave>`. Revalida también claves heredadas que conservan el nombre tras una restauración. */
export async function GET(
  _solicitud: Request,
  { params }: { params: Promise<{ clave: string[] }> },
) {
  const { clave } = await params;
  const ruta = resolverRutaMedia(clave);
  const tipo = ruta ? tipoMedia(ruta) : null;
  if (!ruta || !tipo) return noEncontrado();
  try {
    const contenido = await readFile(ruta);
    return new Response(new Uint8Array(contenido), {
      headers: {
        "Content-Type": tipo,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (esFicheroInexistente(error)) return noEncontrado();
    throw error;
  }
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run apps/studio`
Esperado: todas en verde.

- [ ] **Paso 6: Verificar con la media real**

```bash
pnpm build
(pnpm dev > /tmp/dev.log 2>&1 &) ; for i in $(seq 1 30); do code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/media/escudo_club.webp); [ "$code" = "200" ] && break; sleep 2; done
curl -s -D - -o /dev/null http://127.0.0.1:3000/media/escudo_club.webp | grep -iE "^HTTP|content-type|cache-control"
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3000/media/..%2F..%2Fsantiso.db"
```

Esperado:
- `HTTP/1.1 200`, `content-type: image/webp` y `cache-control: no-cache`.
- `404` para el intento de salir de la carpeta.

Parar el servidor.

- [ ] **Paso 7: Formato, lint y commit**

Prettier y el lint raíz ignoran `apps/studio` (código heredado pendiente de reescritura). Los ficheros nuevos se formatean y se lintan de forma explícita:

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/lib/media.ts apps/studio/lib/media.test.ts apps/studio/lib/server/media.ts apps/studio/lib/server/media.test.ts "apps/studio/app/media"
pnpm --filter @santiso/studio exec eslint lib/media.ts lib/media.test.ts lib/server app/media
pnpm check
git add pnpm-workspace.yaml pnpm-lock.yaml apps/studio/package.json apps/studio/lib/media.ts apps/studio/lib/media.test.ts apps/studio/lib/server/media.ts apps/studio/lib/server/media.test.ts "apps/studio/app/media"
git commit -m "feat(studio): media local con procesado sharp y ruta /media" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Esperado: ESLint sin problemas en los ficheros nuevos.

---

### Tarea 6: Pruebas e2e de humo y capturas de referencia antes del corte

Contexto: las Fases 2B y 2C cambian la fuente de datos de todas las pantallas. Antes hace falta:
- una prueba de humo automatizable;
- capturas del estado actual (con Supabase) para comparar a mano después.

Mientras exista el login de Supabase (se retira en la 2C), `/admin` solo es accesible en desarrollo con `DEV_AUTH_BYPASS=1` en `apps/studio/.env.local`, que ya está configurado.

**Ficheros:**
- Modificar: `pnpm-workspace.yaml` (catalog `@playwright/test: 1.61.1`)
- Modificar: `apps/studio/package.json` (devDependency `@playwright/test`, script `e2e`)
- Modificar: `package.json` raíz (script `e2e`)
- Modificar: `.gitignore`
- Crear: `apps/studio/playwright.config.ts`
- Crear: `apps/studio/e2e/humo.spec.ts`
- Modificar: `README.md`, `AGENTS.md`

**Interfaces:**
- Consume: `GET /api/estado` (Tarea 4), `GET /media/<clave>` (Tarea 5), servidor en `127.0.0.1:3000` (Tarea 2).
- Produce:
  - `pnpm e2e` (raíz) → `pnpm --filter @santiso/studio e2e` → `playwright test`. No forma parte de `pnpm check`.
  - Capturas en `data/referencias/antes-fase-2/`, que no se versionan.

- [ ] **Paso 1: Dependencias, scripts e ignorados**

- En `pnpm-workspace.yaml`, añadir al `catalog:` (primera clave, orden alfabético): `"@playwright/test": 1.61.1`.
- En `apps/studio/package.json`:
  - añadir a `devDependencies`: `"@playwright/test": "catalog:"`;
  - añadir a `scripts`: `"e2e": "playwright test"`.
- En `package.json` raíz, añadir a `scripts`: `"e2e": "pnpm --filter @santiso/studio e2e"`.
- En `.gitignore`, bajo `# salida de scripts de revisión visual`, añadir:

```gitignore
apps/studio/test-results/
apps/studio/playwright-report/
```

Ejecutar:

```bash
pnpm install
pnpm --filter @santiso/studio exec playwright install chromium
```

- [ ] **Paso 2: Configuración de Playwright**

`apps/studio/playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

const URL_BASE = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  // Una sola BD SQLite local compartida: sin paralelismo entre pruebas.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: { baseURL: URL_BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: `${URL_BASE}/api/estado`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [ ] **Paso 3: Prueba de humo**

`apps/studio/e2e/humo.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const SECCIONES = [
  "Temporadas",
  "Ligas",
  "Equipos",
  "Plantilla",
  "Sponsors",
  "Calendario",
  "Carteles",
  "Actas",
  "Jornada",
];

test("el panel carga con todas sus secciones", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");

  for (const seccion of SECCIONES) {
    await expect(page.getByText(seccion, { exact: true }).first()).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test("la app lee la base de datos local", async ({ request }) => {
  const respuesta = await request.get("/api/estado");
  expect(respuesta.ok()).toBe(true);
  const estado: unknown = await respuesta.json();
  expect(estado).toMatchObject({ ok: true, temporadaActiva: expect.any(String) });
  expect(estado).toHaveProperty("partidos", expect.any(Number));
});

test("sirve la media local", async ({ request }) => {
  const respuesta = await request.get("/media/escudo_club.webp");
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toBe("image/webp");
});
```

- [ ] **Paso 4: Ejecutar la prueba de humo**

Ejecutar: `pnpm e2e`
Esperado: `3 passed`.

Si falla una etiqueta de sección:
1. Abrir `/admin` y comprobar el texto real del menú en `apps/studio/app/admin/` o en `apps/studio/components/admin/`.
2. Ajustar solo la lista `SECCIONES`, sin tocar componentes.
3. Anotar el cambio en el informe.

- [ ] **Paso 5: Formato y lint de los ficheros nuevos**

```bash
pnpm exec prettier --write --ignore-path .gitignore apps/studio/playwright.config.ts apps/studio/e2e
pnpm --filter @santiso/studio exec eslint playwright.config.ts e2e
pnpm --filter @santiso/studio typecheck
```

Esperado: sin problemas.

- [ ] **Paso 6: Capturas de referencia (no se versionan)**

Con `pnpm dev` en marcha:

```bash
pnpm --filter @santiso/studio exec tsx scripts/shoot-admin.ts http://127.0.0.1:3000
pnpm --filter @santiso/studio exec tsx scripts/render-cartel.ts
mkdir -p data/referencias/antes-fase-2
cp -r apps/studio/scripts/.out/. data/referencias/antes-fase-2/
ls data/referencias/antes-fase-2 | wc -l
git status --short data/   # no debe mostrar nada: data/ está ignorada
```

Esperado:
- Al menos una captura por sección del panel. Registrar qué plantillas y categorías cubre realmente render-cartel.ts; su cobertura actual es parcial y no prueba las siete plantillas.
- `git status` no muestra nada bajo `data/`.

Parar el servidor.

- [ ] **Paso 7: Documentación**

En `README.md`, sección de comandos, añadir:

```markdown
pnpm e2e         # pruebas de humo en navegador (arranca pnpm dev si no está en marcha)
```

En `AGENTS.md`, sección de verificación, añadir:

```markdown
- `pnpm check` es la puerta de cada commit. `pnpm e2e` se ejecuta al cerrar cada tarea que cambie pantallas; necesita `data/santiso.db` y `DEV_AUTH_BYPASS=1` mientras exista el login.
- Las capturas de `data/referencias/antes-fase-2/` son la referencia visual para validar las Fases 2B y 2C.
```

Si alguna de esas secciones no existe con ese nombre, añadir el texto al final del bloque de comandos correspondiente.

- [ ] **Paso 8: Puerta de calidad y commit**

```bash
pnpm check
git add pnpm-workspace.yaml pnpm-lock.yaml package.json apps/studio/package.json apps/studio/playwright.config.ts apps/studio/e2e .gitignore README.md AGENTS.md
git commit -m "test(studio): pruebas e2e de humo con Playwright y capturas de referencia previas al corte" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final de la fase

- [ ] `pnpm check` en verde.
- [ ] `pnpm build` correcto.
- [ ] `pnpm e2e` → `3 passed`.
- [ ] `curl http://127.0.0.1:3000/api/estado` → `{"ok":true,"temporadaActiva":"2026/27","partidos":688}`.
- [ ] `git status --short` limpio y sin `data/` ni `.env.local`.
- [ ] La app sigue funcionando igual contra Supabase: ninguna pantalla cambió.
- [ ] Ledger: R14 y R15 cerrados. R13 cerrado parcialmente (`rutas.ts`/`migraciones.ts` perezosos); el resto sigue aplazado a 2B/2C.
