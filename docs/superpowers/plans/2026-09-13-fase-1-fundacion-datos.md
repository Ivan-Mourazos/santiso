# Fase 1 — Fundación y datos: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** convertir el repositorio en un monorepo pnpm con herramientas de calidad, crear los paquetes `@santiso/domain` y `@santiso/db`, y migrar los datos reales de Supabase a SQLite local con verificación automática. La app sigue funcionando contra Supabase.

**Arquitectura:** la app Next.js se mueve a `apps/studio` sin cambios de comportamiento. `packages/domain` contiene lógica pura con Zod. `packages/db` define el esquema Drizzle (libSQL), las migraciones, el cliente y las copias. `tools/migracion-supabase` hace exportar (REST, solo lectura) → snapshot JSON → transformar (función pura y determinista) → importar en un proceso hijo → verificar → informe.

**Stack:** pnpm 10.33.2 workspaces + catalog · TypeScript 5.9.3 · Drizzle ORM 0.45.2 / drizzle-kit 0.31.10 · @libsql/client 0.18.0 · Zod 4.6.4 · Vitest 4.1.11 · tsx 4.23.13 · ESLint 9 + typescript-eslint 8 · Prettier 3.9.6.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). Léela antes de empezar: §4 (decisiones), §6 (modelo de datos y reglas R1–R17).

## Restricciones globales

- Node ≥ 22.12 (local: 22.23.2). Solo `pnpm` (10.33.2). Comandos en Git Bash (sintaxis POSIX).
- TypeScript **5.9.3**. No usar TS 7.
- Drizzle: **solo el query builder core** (`db.select/insert/update/delete`, `db.transaction`). Prohibido `db.query.*`.
- Versiones compartidas **solo** mediante `catalog:` en `pnpm-workspace.yaml`. Paquetes internos con `"version": "workspace:*"`.
- Paquetes internos sin build: `"type": "module"` y `exports` apuntando a `src/*.ts`.
- Dominio en español: tablas, columnas, funciones de negocio y mensajes. Columnas `snake_case`, propiedades TS `camelCase`.
- IDs: UUID en texto. Los de Supabase se conservan. Las filas creadas por la migración usan `idDeterminista(...)`.
- Formatos de fecha:
  - `partidos.fecha`: `YYYY-MM-DDTHH:mm` (hora de pared, sin zona).
  - Fechas: `YYYY-MM-DD`.
  - Marcas de tiempo: ISO UTC con milisegundos (`2026-04-20T19:34:47.623Z`).
- **Supabase solo lectura.** Ningún código escribe en Supabase. Las claves nunca se imprimen ni se guardan en snapshots o informes.
- `data/` nunca entra en git: contiene nombres, fechas de nacimiento y fotos.
- No modificar el código de `apps/studio` salvo el traslado de la Tarea 1.
- libSQL no libera el fichero de BD hasta que termina el proceso (`EBUSY` en Windows, verificado). Renombrar o borrar ficheros de BD solo desde un proceso distinto del que los abrió.
- Sin `any`. `as` solo con un comentario que lo justifique. Sin `catch` vacíos.
- Commits en Conventional Commits en español, uno por tarea, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- Antes de cada commit a partir de la Tarea 2: `pnpm check` en verde.

## Mapa de ficheros

```
santiso/
├─ package.json                         (reescrito) scripts raíz + devDependencies comunes
├─ pnpm-workspace.yaml                  (modificado) paquetes + catalog
├─ tsconfig.base.json                   (nuevo) opciones estrictas compartidas
├─ tsconfig.json                        (nuevo) ficheros TS de la raíz
├─ vitest.config.ts                     (nuevo)
├─ eslint.config.mjs                    (nuevo) paquetes y herramientas
├─ .prettierrc.json / .prettierignore   (nuevos)
├─ .gitignore                           (modificado) data/, patrones anidados
├─ AGENTS.md / README.md                (modificados)
├─ legacy/supabase/                     (movido) SQL y scripts .mjs de Supabase
├─ apps/studio/                         (movido) app Next actual, intacta
├─ packages/domain/src/
│  ├─ nombres.ts          claveNombre, similitudTokens, esEquipoPropio
│  ├─ categorias.ts       CATEGORIAS, normalizarCategoria
│  ├─ catalogos.ts        estados, formatos, eventos, lados, staff, posiciones, esValorDe
│  ├─ fechas.ts           aFechaHoraLiteral, aFechaLiteral, aInstanteIso
│  ├─ temporadas.ts       normalizarNombreTemporada
│  ├─ competiciones.ts    reglasClasificacionSchema
│  ├─ ajustes.ts          AJUSTES, validarAjuste
│  └─ index.ts
├─ packages/db/
│  ├─ drizzle.config.ts
│  ├─ migrations/         (generado) 0000_inicial.sql + meta/
│  └─ src/
│     ├─ schema/{comunes,plantilla,competicion,calendario,partido,club,index}.ts
│     ├─ rutas.ts         DIR_DATOS, RUTA_BD, urlArchivo, marcaFichero
│     ├─ client.ts        abrirDb, Db, TransaccionDb
│     ├─ migraciones.ts   migrarBd
│     ├─ testing.ts       crearDbPrueba
│     ├─ backup.ts        copiarBd
│     ├─ cli/{migrar,backup}.ts
│     └─ index.ts
└─ tools/migracion-supabase/src/
   ├─ snapshot/{tipos,archivos,media}.ts
   ├─ supabase/cliente.ts
   ├─ hash.ts · ids.ts · exportar.ts · importar.ts · verificar.ts · informe.ts
   ├─ transformar/{tipos,comunes,temporadas,competiciones,equipos,calendario,plantilla,actas,club,index}.ts
   ├─ test/fabricas.ts
   └─ cli/{exportar,importar,construir-bd,verificar}.ts
```

---

### Tarea 1: Monorepo y traslado de la app a `apps/studio`

**Ficheros:**
- Mover: `app/`, `components/`, `lib/`, `public/`, `proxy.ts`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `.env.example` → `apps/studio/`
- Mover: `scripts/render-cartel.ts`, `scripts/shoot-admin.ts`, `scripts/fonts/` → `apps/studio/scripts/`
- Mover: `scripts/*.sql`, `scripts/*.mjs` → `legacy/supabase/`
- Crear: `package.json` (raíz)
- Modificar: `apps/studio/package.json`, `pnpm-workspace.yaml`, `.gitignore`, `AGENTS.md`

**Interfaces:**
- Consume: nada.
- Produce: workspace pnpm con globs `apps/*`, `packages/*`, `tools/*`; paquete `@santiso/studio`; scripts raíz `dev`, `build`, `lint:studio`.

- [ ] **Paso 1: Mover ficheros conservando el historial**

```bash
mkdir -p apps/studio/scripts legacy/supabase
git mv app components lib public proxy.ts next.config.ts tsconfig.json eslint.config.mjs package.json .env.example apps/studio/
git mv scripts/render-cartel.ts scripts/shoot-admin.ts scripts/fonts apps/studio/scripts/
git mv scripts/*.sql scripts/*.mjs legacy/supabase/
mv .env.local apps/studio/.env.local
rm -rf .next next-env.d.ts tsconfig.tsbuildinfo scripts/.out
rmdir scripts
```

Esperado: `git status` muestra renombrados (`R`), no borrados más altas.

- [ ] **Paso 2: Crear `package.json` en la raíz**

```json
{
  "name": "santiso",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.2",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "pnpm --filter @santiso/studio dev",
    "build": "pnpm --filter @santiso/studio build",
    "lint:studio": "pnpm --filter @santiso/studio lint"
  }
}
```

- [ ] **Paso 3: Ajustar `apps/studio/package.json`**

Cambiar solo estas claves y dejar `dependencies` y `devDependencies` tal cual:

```json
{
  "name": "@santiso/studio",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit"
  }
}
```

Eliminar la clave `packageManager` (ahora está en la raíz).

- [ ] **Paso 4: Reescribir `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*
  - tools/*

ignoredBuiltDependencies:
  - sharp
  - unrs-resolver
```

- [ ] **Paso 5: Reescribir `.gitignore` con patrones válidos en subcarpetas**

```gitignore
# dependencias
node_modules/
.pnp
.pnp.*
.pnpm-store/

# builds y cachés
.next/
out/
build/
coverage/
*.tsbuildinfo
next-env.d.ts

# datos locales: BD, media, snapshots, copias e informes (contienen datos personales)
/data/

# entorno
.env*
!.env.example

# sistema y depuración
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# vercel
.vercel

# salida de scripts de revisión visual
apps/studio/scripts/.out/

# metadatos de IA y agentes
.agents/
.claude/
.claudecode
CLAUDE.md
skills-lock.json
```

- [ ] **Paso 6: Actualizar el bloque de herramientas de `AGENTS.md`**

Sustituir el contenido entre `<!-- BEGIN:tooling-env -->` y `<!-- END:tooling-env -->` por:

```markdown
<!-- BEGIN:tooling-env -->
# Tooling & environment

- **Monorepo pnpm:** `apps/studio` (Next.js), `packages/*` (domain, db), `tools/*` (migración). Solo `pnpm`; nunca `npm`/`yarn`.
- **Comandos raíz:** `pnpm dev`, `pnpm build`, `pnpm check` (typecheck + lint + formato + tests), `pnpm test`.
- **Versiones:** compartidas con `catalog:` en `pnpm-workspace.yaml`.
- **Entorno:** `apps/studio/.env.local` (ignorado por git; puede existir aunque la búsqueda de ficheros no lo muestre).
- **Datos locales:** `data/` (ignorado): `santiso.db`, `media/`, `snapshots/`, `backups/`, `informes/`.
- **Arquitectura y hoja de ruta:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`.
<!-- END:tooling-env -->
```

- [ ] **Paso 7: Instalar y verificar que la app sigue igual**

```bash
pnpm install
pnpm --filter @santiso/studio typecheck
pnpm build
pnpm --filter @santiso/studio exec tsx scripts/render-cartel.ts
```

Esperado:
- `typecheck` sale con código 0.
- `build` termina con `✓ Compiled successfully` y la tabla de rutas incluye `/admin`.
- El render escribe `escrito: …apps/studio/scripts/.out/partido-senior.png`.

- [ ] **Paso 8: Prueba manual de humo**

Ejecutar `pnpm dev` y abrir `http://localhost:3000/admin`. Esperado: el panel carga Calendario con datos (el `.env.local` trasladado mantiene `DEV_AUTH_BYPASS`). Parar con Ctrl+C.

- [ ] **Paso 9: Commit**

```bash
git add -A
git commit -m "refactor(repo): convertir en monorepo pnpm con la app en apps/studio" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 2: Herramientas compartidas y paquete `@santiso/domain` (nombres)

**Ficheros:**
- Modificar: `pnpm-workspace.yaml`, `package.json`
- Crear: `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`
- Crear: `packages/domain/package.json`, `packages/domain/tsconfig.json`, `packages/domain/src/index.ts`, `packages/domain/src/nombres.ts`
- Test: `packages/domain/src/nombres.test.ts`

**Interfaces:**
- Consume: workspace de la Tarea 1.
- Produce:
  - `claveNombre(valor: string): string`
  - `similitudTokens(a: string, b: string): number` (entre 0 y 1)
  - `esEquipoPropio(nombre: string): boolean`
  - Scripts raíz `typecheck`, `lint`, `format`, `format:check`, `test`, `check`.

- [ ] **Paso 1: Añadir el catálogo a `pnpm-workspace.yaml`**

Añadir al final:

```yaml
catalog:
  "@libsql/client": 0.18.0
  "@types/node": ^22.0.0
  drizzle-kit: 0.31.10
  drizzle-orm: 0.45.2
  eslint: ^9.0.0
  prettier: 3.9.6
  tsx: 4.23.13
  typescript: 5.9.3
  typescript-eslint: ^8.0.0
  vitest: 4.1.11
  zod: 4.6.4
```

- [ ] **Paso 2: Ampliar el `package.json` raíz**

```json
{
  "name": "santiso",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.33.2",
  "engines": {
    "node": ">=22.12.0"
  },
  "scripts": {
    "dev": "pnpm --filter @santiso/studio dev",
    "build": "pnpm --filter @santiso/studio build",
    "lint:studio": "pnpm --filter @santiso/studio lint",
    "typecheck": "pnpm -r --if-present typecheck",
    "lint": "eslint packages tools",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "typescript-eslint": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Paso 3: Crear `tsconfig.base.json` y `tsconfig.json`**

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```

`tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "include": ["*.ts"]
}
```

- [ ] **Paso 4: Crear `vitest.config.ts`, `eslint.config.mjs` y la configuración de Prettier**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "tools/*/src/**/*.test.ts"],
    environment: "node",
  },
});
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["apps/**", "legacy/**", "data/**", "**/migrations/**"]),
  tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
```

`.prettierrc.json`:

```json
{
  "printWidth": 100
}
```

`.prettierignore`:

```
apps/studio
legacy
data
docs
packages/db/migrations
pnpm-lock.yaml
AGENTS.md
README.md
```

- [ ] **Paso 5: Crear el esqueleto de `@santiso/domain`**

`packages/domain/package.json`:

```json
{
  "name": "@santiso/domain",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`packages/domain/src/index.ts`:

```ts
export * from "./nombres";
```

Ejecutar `pnpm install`. Esperado: termina sin errores.

- [ ] **Paso 6: Escribir la prueba que falla**

`packages/domain/src/nombres.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { claveNombre, esEquipoPropio, similitudTokens } from "./nombres";

describe("claveNombre", () => {
  it("ignora mayúsculas, puntuación y espacios sobrantes", () => {
    expect(claveNombre("  U.D. Santiso F.C. ")).toBe("u d santiso f c");
    expect(claveNombre("U.D. SANTISO F.C.")).toBe(claveNombre("U.D. Santiso F.C."));
  });

  it("elimina tildes y eñes", () => {
    expect(claveNombre("C.D. COMPAÑÍA DE MARÍA")).toBe("c d compania de maria");
  });

  it("devuelve cadena vacía si no hay letras ni dígitos", () => {
    expect(claveNombre(" .-/ ")).toBe("");
  });
});

describe("similitudTokens", () => {
  it("vale 1 para nombres equivalentes", () => {
    expect(similitudTokens("S.D. Touro", "s.d. TOURO")).toBe(1);
  });

  it("es la proporción de tokens comunes sobre el nombre más largo", () => {
    expect(similitudTokens("S.D. Touro", "S.D. Touro Veteranos")).toBe(0.75);
  });

  it("vale 0 sin tokens comunes o con un nombre vacío", () => {
    expect(similitudTokens("Berres", "Cruces")).toBe(0);
    expect(similitudTokens("", "Cruces")).toBe(0);
  });
});

describe("esEquipoPropio", () => {
  it("reconoce al club en cualquier categoría", () => {
    expect(esEquipoPropio("U.D. SANTISO F.C.")).toBe(true);
    expect(esEquipoPropio("U.D. Santiso F.C. Solaina")).toBe(true);
  });

  it("no confunde palabras que solo contienen el texto", () => {
    expect(esEquipoPropio("Santisoil C.F.")).toBe(false);
    expect(esEquipoPropio("C.D. San Mamed")).toBe(false);
  });
});
```

- [ ] **Paso 7: Ejecutar la prueba y comprobar que falla**

Ejecutar: `pnpm exec vitest run packages/domain/src/nombres.test.ts`
Esperado: FAIL; no se puede resolver `./nombres`.

- [ ] **Paso 8: Implementar**

`packages/domain/src/nombres.ts`:

```ts
/** Clave canónica para comparar nombres: sin tildes, en minúsculas, solo `[a-z0-9]` separados por un espacio. */
export function claveNombre(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Proporción (0..1) de tokens compartidos respecto al nombre con más tokens. */
export function similitudTokens(a: string, b: string): number {
  const tokensA = new Set(claveNombre(a).split(" ").filter(Boolean));
  const tokensB = new Set(claveNombre(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let comunes = 0;
  for (const token of tokensA) if (tokensB.has(token)) comunes++;
  return comunes / Math.max(tokensA.size, tokensB.size);
}

/** Equipo del club (UD Santiso), en cualquier categoría. */
export function esEquipoPropio(nombre: string): boolean {
  return claveNombre(nombre).split(" ").includes("santiso");
}
```

- [ ] **Paso 9: Ejecutar la puerta de calidad**

Ejecutar: `pnpm check`
Esperado:
- `typecheck` pasa en `@santiso/domain` y `@santiso/studio`.
- ESLint sin problemas.
- Prettier «All matched files use Prettier code style!».
- Vitest: `nombres.test.ts` con 8 pruebas en verde.

Si Prettier señala ficheros nuevos, ejecutar `pnpm format` y repetir.

- [ ] **Paso 10: Commit**

```bash
git add -A
git commit -m "chore(repo): herramientas compartidas y paquete @santiso/domain con normalización de nombres" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: Dominio base (categorías, catálogos, fechas, temporadas, reglas, ajustes)

**Ficheros:**
- Modificar: `packages/domain/package.json` (dependencia `zod`), `packages/domain/src/index.ts`
- Crear: `packages/domain/src/{categorias,catalogos,fechas,temporadas,competiciones,ajustes}.ts`
- Test: `packages/domain/src/{categorias,catalogos,fechas,temporadas,competiciones,ajustes}.test.ts`

**Interfaces:**
- Consume: `claveNombre` (Tarea 2).
- Produce:
  - `CATEGORIAS`, `Categoria`, `normalizarCategoria(valor: string): Categoria`
  - `FORMATOS_COMPETICION`, `ESTADOS_PARTIDO`, `TIPOS_EVENTO`, `LADOS_EVENTO`, `TIPOS_STAFF`, `POSICIONES` (y sus tipos `FormatoCompeticion`, `EstadoPartido`, `TipoEvento`, `LadoEvento`, `TipoStaff`, `Posicion`), `MINUTO_MAXIMO`, `esValorDe(valores, valor)`
  - `aFechaHoraLiteral(valor: string): string`, `aFechaLiteral(valor: string): string`, `aInstanteIso(valor: string): string`
  - `normalizarNombreTemporada(valor: string): string`
  - `reglaClasificacionSchema`, `reglasClasificacionSchema`, `ReglaClasificacion`
  - `ORDENES_LOGOS`, `AJUSTES`, `ClaveAjuste`, `ValorAjuste<K>`, `esClaveAjuste(valor)`, `validarAjuste(clave, valor)`

- [ ] **Paso 1: Añadir Zod al paquete**

En `packages/domain/package.json` añadir:

```json
"dependencies": {
  "zod": "catalog:"
}
```

Ejecutar `pnpm install`.

- [ ] **Paso 2: Escribir las pruebas que fallan**

`packages/domain/src/categorias.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizarCategoria } from "./categorias";

describe("normalizarCategoria", () => {
  it("acepta variantes de escritura", () => {
    expect(normalizarCategoria("Sénior")).toBe("Senior");
    expect(normalizarCategoria("FEMININO")).toBe("Femenino");
    expect(normalizarCategoria("veteranos")).toBe("Veteranos");
  });

  it("rechaza categorías desconocidas", () => {
    expect(() => normalizarCategoria("Juvenil")).toThrow(/Categoría desconocida/);
  });
});
```

`packages/domain/src/catalogos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ESTADOS_PARTIDO, esValorDe } from "./catalogos";

describe("esValorDe", () => {
  it("indica si el valor pertenece al catálogo", () => {
    expect(esValorDe(ESTADOS_PARTIDO, "finalizado")).toBe(true);
    expect(esValorDe(ESTADOS_PARTIDO, "suspendido")).toBe(false);
  });
});
```

`packages/domain/src/fechas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aFechaHoraLiteral, aFechaLiteral, aInstanteIso } from "./fechas";

describe("aFechaHoraLiteral", () => {
  it("conserva fecha y hora tal cual, sin convertir zona", () => {
    expect(aFechaHoraLiteral("2026-09-27T17:00:00+00:00")).toBe("2026-09-27T17:00");
    expect(aFechaHoraLiteral("2026-09-27T17:00")).toBe("2026-09-27T17:00");
  });

  it("rechaza formatos no ISO", () => {
    expect(() => aFechaHoraLiteral("27/09/2026 17:00")).toThrow(/Fecha-hora inválida/);
  });
});

describe("aFechaLiteral", () => {
  it("se queda con la parte de fecha", () => {
    expect(aFechaLiteral("2025-10-26T00:00:00+00:00")).toBe("2025-10-26");
    expect(aFechaLiteral("2025-10-26")).toBe("2025-10-26");
  });

  it("rechaza valores sin fecha", () => {
    expect(() => aFechaLiteral("")).toThrow(/Fecha inválida/);
  });
});

describe("aInstanteIso", () => {
  it("normaliza a ISO UTC con milisegundos", () => {
    expect(aInstanteIso("2026-04-20T19:34:47.623266+00:00")).toBe("2026-04-20T19:34:47.623Z");
    expect(aInstanteIso("2026-04-20T21:00:00+02:00")).toBe("2026-04-20T19:00:00.000Z");
  });

  it("rechaza instantes inválidos", () => {
    expect(() => aInstanteIso("ayer")).toThrow(/Instante inválido/);
  });
});
```

`packages/domain/src/temporadas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizarNombreTemporada } from "./temporadas";

describe("normalizarNombreTemporada", () => {
  it("normaliza a AAAA/AA", () => {
    expect(normalizarNombreTemporada("25/26")).toBe("2025/26");
    expect(normalizarNombreTemporada("2026/27")).toBe("2026/27");
    expect(normalizarNombreTemporada("2025-2026")).toBe("2025/26");
    expect(normalizarNombreTemporada(" 2026 / 27 ")).toBe("2026/27");
  });

  it("rechaza años no consecutivos", () => {
    expect(() => normalizarNombreTemporada("2025/27")).toThrow(/no consecutiva/);
  });

  it("rechaza textos que no son temporadas", () => {
    expect(() => normalizarNombreTemporada("temporada actual")).toThrow(/inválido/);
  });
});
```

`packages/domain/src/competiciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reglasClasificacionSchema } from "./competiciones";

describe("reglasClasificacionSchema", () => {
  it("acepta las reglas guardadas en la BD actual", () => {
    const reglas = [
      {
        id: "eb69acb1-05ca-444f-bf37-02429587dcc6",
        color: "#10b981",
        nombre: "Pase a Cuadro Copa",
        puestos: [1],
      },
    ];
    expect(reglasClasificacionSchema.parse(reglas)).toEqual(reglas);
  });

  it("rechaza colores no hexadecimales y reglas sin puestos", () => {
    expect(() =>
      reglasClasificacionSchema.parse([{ id: "a", nombre: "X", puestos: [1], color: "verde" }]),
    ).toThrow();
    expect(() =>
      reglasClasificacionSchema.parse([{ id: "a", nombre: "X", puestos: [], color: "#10b981" }]),
    ).toThrow();
  });
});
```

`packages/domain/src/ajustes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { esClaveAjuste, validarAjuste } from "./ajustes";

describe("ajustes", () => {
  it("valida cada clave con su esquema", () => {
    expect(validarAjuste("cartel.orden_logos", "rfgf_izquierda")).toBe("rfgf_izquierda");
    expect(validarAjuste("club.escudo", "escudo_club.webp")).toBe("escudo_club.webp");
    expect(() => validarAjuste("cartel.orden_logos", "izquierda")).toThrow();
    expect(() => validarAjuste("club.escudo", "")).toThrow();
  });

  it("reconoce solo claves conocidas", () => {
    expect(esClaveAjuste("club.escudo")).toBe(true);
    expect(esClaveAjuste("club.color")).toBe(false);
  });
});
```

- [ ] **Paso 3: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run packages/domain`
Esperado: FAIL en los 6 ficheros nuevos por módulos inexistentes; `nombres.test.ts` sigue en verde.

- [ ] **Paso 4: Implementar los módulos**

`packages/domain/src/categorias.ts`:

```ts
import { claveNombre } from "./nombres";

export const CATEGORIAS = ["Senior", "Femenino", "Veteranos"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Admite variantes ("Sénior", "FEMININO", "vet.") y devuelve la categoría canónica. */
export function normalizarCategoria(valor: string): Categoria {
  const clave = claveNombre(valor);
  if (clave.startsWith("sen")) return "Senior";
  if (clave.startsWith("fem")) return "Femenino";
  if (clave.startsWith("vet")) return "Veteranos";
  throw new Error(`Categoría desconocida: "${valor}"`);
}
```

`packages/domain/src/catalogos.ts`:

```ts
export const FORMATOS_COMPETICION = ["liga", "eliminatoria"] as const;
export type FormatoCompeticion = (typeof FORMATOS_COMPETICION)[number];

export const ESTADOS_PARTIDO = [
  "programado",
  "en_juego",
  "finalizado",
  "aplazado",
  "cancelado",
] as const;
export type EstadoPartido = (typeof ESTADOS_PARTIDO)[number];

export const TIPOS_EVENTO = ["gol", "tarjeta_amarilla", "tarjeta_roja", "cambio"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Equipo al que se anota un evento del acta. */
export const LADOS_EVENTO = ["propio", "rival"] as const;
export type LadoEvento = (typeof LADOS_EVENTO)[number];

export const TIPOS_STAFF = ["tecnico", "directiva"] as const;
export type TipoStaff = (typeof TIPOS_STAFF)[number];

export const POSICIONES = [
  "POR",
  "LD",
  "DFC",
  "LI",
  "MCD",
  "MC",
  "MCO",
  "MD",
  "MI",
  "ED",
  "EI",
  "DC",
] as const;
export type Posicion = (typeof POSICIONES)[number];

/** Minuto máximo admitido en un acta (prórroga más descuento). */
export const MINUTO_MAXIMO = 130;

/** Comprueba y estrecha el tipo de un texto a un catálogo cerrado. */
export function esValorDe<T extends string>(valores: readonly T[], valor: string): valor is T {
  return (valores as readonly string[]).includes(valor);
}
```

`packages/domain/src/fechas.ts`:

```ts
const RE_FECHA_HORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;
const RE_FECHA = /^(\d{4}-\d{2}-\d{2})/;

/** "2026-09-27T17:00:00+00:00" → "2026-09-27T17:00". Hora de pared tal cual se guardó, sin convertir zona. */
export function aFechaHoraLiteral(valor: string): string {
  const [, fecha, hora] = RE_FECHA_HORA.exec(valor) ?? [];
  if (!fecha || !hora) throw new Error(`Fecha-hora inválida: "${valor}"`);
  return `${fecha}T${hora}`;
}

/** "2025-10-26T00:00:00+00:00" o "2025-10-26" → "2025-10-26". */
export function aFechaLiteral(valor: string): string {
  const [, fecha] = RE_FECHA.exec(valor) ?? [];
  if (!fecha) throw new Error(`Fecha inválida: "${valor}"`);
  return fecha;
}

/** Instante con zona → ISO UTC con milisegundos ("2026-04-20T19:34:47.623Z"). */
export function aInstanteIso(valor: string): string {
  const instante = new Date(valor);
  if (Number.isNaN(instante.getTime())) throw new Error(`Instante inválido: "${valor}"`);
  return instante.toISOString();
}
```

`packages/domain/src/temporadas.ts`:

```ts
const RE_TEMPORADA = /^(\d{2}|\d{4})\s*[/-]\s*(\d{2}|\d{4})$/;

/** "25/26" | "2025-2026" | "2025/26" → "2025/26". */
export function normalizarNombreTemporada(valor: string): string {
  const [, textoInicio, textoFin] = RE_TEMPORADA.exec(valor.trim()) ?? [];
  if (!textoInicio || !textoFin) throw new Error(`Nombre de temporada inválido: "${valor}"`);
  const inicio = textoInicio.length === 2 ? 2000 + Number(textoInicio) : Number(textoInicio);
  const fin =
    textoFin.length === 2 ? Math.floor(inicio / 100) * 100 + Number(textoFin) : Number(textoFin);
  if (fin !== inicio + 1) throw new Error(`Temporada no consecutiva: "${valor}"`);
  return `${inicio}/${String(fin).slice(-2)}`;
}
```

`packages/domain/src/competiciones.ts`:

```ts
import { z } from "zod";

/** Zona de la clasificación (ascenso, descenso, copa…) con su color en carteles. */
export const reglaClasificacionSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().trim().min(1),
  puestos: z.array(z.number().int().positive()).min(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});

export const reglasClasificacionSchema = z.array(reglaClasificacionSchema);

export type ReglaClasificacion = z.infer<typeof reglaClasificacionSchema>;
```

`packages/domain/src/ajustes.ts`:

```ts
import { z } from "zod";

export const ORDENES_LOGOS = ["xunta_izquierda", "rfgf_izquierda"] as const;

const claveMedia = z.string().min(1);

/** Ajustes globales: clave → esquema de su valor JSON. */
export const AJUSTES = {
  "club.escudo": claveMedia,
  "cartel.logo_xunta": claveMedia,
  "cartel.logo_rfgf": claveMedia,
  "cartel.orden_logos": z.enum(ORDENES_LOGOS),
} as const;

export type ClaveAjuste = keyof typeof AJUSTES;
export type ValorAjuste<K extends ClaveAjuste> = z.infer<(typeof AJUSTES)[K]>;

export function esClaveAjuste(valor: string): valor is ClaveAjuste {
  return Object.hasOwn(AJUSTES, valor);
}

export function validarAjuste<K extends ClaveAjuste>(clave: K, valor: unknown): ValorAjuste<K> {
  // TS no correlaciona la clave genérica con su esquema concreto; el parse garantiza la forma.
  return AJUSTES[clave].parse(valor) as ValorAjuste<K>;
}
```

`packages/domain/src/index.ts`:

```ts
export * from "./ajustes";
export * from "./catalogos";
export * from "./categorias";
export * from "./competiciones";
export * from "./fechas";
export * from "./nombres";
export * from "./temporadas";
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run packages/domain`
Esperado: 7 ficheros y todas las pruebas en verde.

- [ ] **Paso 6: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(domain): categorías, catálogos, fechas literales, temporadas, reglas y ajustes" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: Paquete `@santiso/db` — esquema, migración inicial y cliente

> El esquema de esta tarea se verificó en un spike (Windows, Node 22.23, Drizzle 0.45.2 y libSQL 0.18) con `tsc` estricto y 24 comprobaciones de restricciones. Copiar tal cual.

**Ficheros:**
- Crear: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`
- Crear: `packages/db/src/schema/{comunes,plantilla,competicion,calendario,partido,club,index}.ts`
- Crear: `packages/db/src/{rutas,client,migraciones,testing,index}.ts`
- Generar: `packages/db/migrations/0000_inicial.sql` y `packages/db/migrations/meta/*`
- Modificar: `package.json` raíz (scripts `db:*`)
- Test: `packages/db/src/schema.test.ts`, `packages/db/src/client.test.ts`

**Interfaces:**
- Consume: catálogos y tipos de `@santiso/domain` (Tarea 3).
- Produce:
  - Tablas: `temporadas`, `competiciones`, `competicionAlias`, `competicionEquipos`, `clasificacionAjustes`, `equipos`, `jugadores`, `staff`, `campos`, `jornadas`, `jornadaDescansos`, `partidos`, `partidoParticipaciones`, `partidoEventos`, `patrocinadores`, `ajustes`.
  - `type Db`, `type TransaccionDb`, `interface ConexionDb { db; cliente; cerrar }`.
  - `abrirDb(url: string, opciones?: { wal?: boolean }): Promise<ConexionDb>`.
  - `urlArchivo(ruta: string): string`, `marcaFichero(fecha?: Date): string`.
  - Constantes `DIR_DATOS`, `RUTA_BD`, `DIR_MEDIA`, `DIR_SNAPSHOTS`, `DIR_BACKUPS`, `DIR_INFORMES`.
  - `DIR_MIGRACIONES`, `migrarBd(db: Db): Promise<void>`, `crearDbPrueba(): Promise<ConexionDb>`.
  - Exportaciones: `@santiso/db` (todo, con `schema` como espacio de nombres), `@santiso/db/schema`, `@santiso/db/testing`.

- [ ] **Paso 1: Esqueleto del paquete**

`packages/db/package.json`:

```json
{
  "name": "@santiso/db",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./schema": "./src/schema/index.ts",
    "./testing": "./src/testing.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "generate": "drizzle-kit generate",
    "studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@libsql/client": "catalog:",
    "@santiso/domain": "workspace:*",
    "drizzle-orm": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "drizzle-kit": "catalog:",
    "typescript": "catalog:"
  }
}
```

`packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "drizzle.config.ts"]
}
```

`packages/db/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "turso",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: "file:../../data/santiso.db" },
  strict: true,
});
```

Añadir al `package.json` raíz:

```json
"db:generate": "pnpm --filter @santiso/db generate",
"db:studio": "pnpm --filter @santiso/db studio"
```

Ejecutar `pnpm install`.

- [ ] **Paso 2: Rutas y cliente**

`packages/db/src/rutas.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ_REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** Directorio de datos locales (BD, media, snapshots, copias, informes). `SANTISO_DATA_DIR` lo sobrescribe. */
export const DIR_DATOS = process.env.SANTISO_DATA_DIR ?? path.join(RAIZ_REPO, "data");
export const RUTA_BD = path.join(DIR_DATOS, "santiso.db");
export const DIR_MEDIA = path.join(DIR_DATOS, "media");
export const DIR_SNAPSHOTS = path.join(DIR_DATOS, "snapshots");
export const DIR_BACKUPS = path.join(DIR_DATOS, "backups");
export const DIR_INFORMES = path.join(DIR_DATOS, "informes");

/** URL `file:` para libSQL a partir de una ruta del sistema (barras normales también en Windows). */
export const urlArchivo = (ruta: string) => `file:${ruta.replaceAll("\\", "/")}`;

/** Marca de tiempo apta para nombres de fichero: `2026-09-13T20-15-03`. */
export const marcaFichero = (fecha = new Date()) =>
  fecha.toISOString().slice(0, 19).replaceAll(":", "-");
```

`packages/db/src/client.ts`:

```ts
import { type Client, createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;
export type TransaccionDb = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface ConexionDb {
  db: Db;
  cliente: Client;
  /** Ojo: libSQL no libera el fichero hasta que termina el proceso. */
  cerrar: () => void;
}

export interface OpcionesConexion {
  /** WAL para uso normal; `false` deja un único fichero (BD que otro proceso moverá después). */
  wal?: boolean;
}

export async function abrirDb(
  url: string,
  { wal = true }: OpcionesConexion = {},
): Promise<ConexionDb> {
  const cliente = createClient({ url });
  await cliente.execute("PRAGMA foreign_keys = ON");
  if (url.startsWith("file:")) {
    await cliente.execute(`PRAGMA journal_mode = ${wal ? "WAL" : "DELETE"}`);
    await cliente.execute("PRAGMA busy_timeout = 5000");
  }
  return { db: drizzle(cliente, { schema }), cliente, cerrar: () => cliente.close() };
}
```

- [ ] **Paso 3: Esquema — utilidades y plantilla**

`packages/db/src/schema/comunes.ts`:

```ts
import { sql } from "drizzle-orm";
import { check, text } from "drizzle-orm/sqlite-core";

/** Clave primaria UUID generada en la aplicación. */
export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const AHORA_ISO = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

/** `creado_en` y `actualizado_en` en ISO UTC. Es una función: cada tabla necesita builders propios. */
export const marcasTiempo = () => ({
  creadoEn: text("creado_en").notNull().default(AHORA_ISO),
  actualizadoEn: text("actualizado_en")
    .notNull()
    .default(AHORA_ISO)
    .$onUpdateFn(() => new Date().toISOString()),
});

/** Condición SQL literal para CHECK e índices parciales (solo constantes, nunca datos de usuario). */
export const condicion = (expresion: string) => sql.raw(expresion);

/** CHECK que limita una columna de texto a un conjunto cerrado de valores del dominio. */
export const checkEnum = (nombre: string, columna: string, valores: readonly string[]) =>
  check(nombre, condicion(`"${columna}" in (${valores.map((v) => `'${v}'`).join(", ")})`));
```

`packages/db/src/schema/plantilla.ts`:

```ts
import { CATEGORIAS, POSICIONES, TIPOS_STAFF } from "@santiso/domain";
import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";

export const equipos = sqliteTable(
  "equipos",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    /** `claveNombre(nombre)`: unicidad y búsqueda sin mayúsculas, tildes ni puntuación. */
    clave: text("clave").notNull(),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    /** Equipo del club (UD Santiso en cualquier categoría). */
    esPropio: integer("es_propio", { mode: "boolean" }).notNull().default(false),
    /** Clave de media relativa a `data/media`. */
    escudo: text("escudo"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("equipos_categoria_clave_uq").on(t.categoria, t.clave),
    checkEnum("equipos_categoria_ck", "categoria", CATEGORIAS),
  ],
);

export const jugadores = sqliteTable(
  "jugadores",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    apodo: text("apodo"),
    dorsal: integer("dorsal"),
    posicion: text("posicion", { enum: POSICIONES }),
    posicionesConocidas: text("posiciones_conocidas", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** null = no es capitán; 1..n = orden de capitanía. */
    capitania: integer("capitania"),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    foto: text("foto"),
    /** "YYYY-MM-DD". */
    fechaNacimiento: text("fecha_nacimiento"),
    historial: text("historial", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    compromiso: integer("compromiso"),
    ...marcasTiempo(),
  },
  (t) => [
    index("jugadores_categoria_dorsal_idx").on(t.categoria, t.dorsal),
    checkEnum("jugadores_categoria_ck", "categoria", CATEGORIAS),
    checkEnum("jugadores_posicion_ck", "posicion", POSICIONES),
    check("jugadores_capitania_ck", condicion(`"capitania" is null or "capitania" > 0`)),
  ],
);

export const staff = sqliteTable(
  "staff",
  {
    id: id(),
    nombre: text("nombre").notNull(),
    cargo: text("cargo").notNull(),
    tipo: text("tipo", { enum: TIPOS_STAFF }).notNull(),
    categoria: text("categoria", { enum: CATEGORIAS }),
    foto: text("foto"),
    orden: integer("orden").notNull().default(0),
    ...marcasTiempo(),
  },
  () => [
    checkEnum("staff_tipo_ck", "tipo", TIPOS_STAFF),
    checkEnum("staff_categoria_ck", "categoria", CATEGORIAS),
    check(
      "staff_categoria_segun_tipo_ck",
      condicion(
        `("tipo" = 'directiva' and "categoria" is null) or ("tipo" = 'tecnico' and "categoria" is not null)`,
      ),
    ),
  ],
);
```

- [ ] **Paso 4: Esquema — competición y calendario**

`packages/db/src/schema/competicion.ts`:

```ts
import { CATEGORIAS, FORMATOS_COMPETICION, type ReglaClasificacion } from "@santiso/domain";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { equipos } from "./plantilla";

export const temporadas = sqliteTable(
  "temporadas",
  {
    id: id(),
    /** "2026/27". */
    nombre: text("nombre").notNull().unique(),
    activa: integer("activa", { mode: "boolean" }).notNull().default(false),
    ...marcasTiempo(),
  },
  (t) => [uniqueIndex("temporadas_una_activa_uq").on(t.activa).where(condicion(`"activa" = 1`))],
);

export const competiciones = sqliteTable(
  "competiciones",
  {
    id: id(),
    temporadaId: text("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    categoria: text("categoria", { enum: CATEGORIAS }).notNull(),
    nombre: text("nombre").notNull(),
    formato: text("formato", { enum: FORMATOS_COMPETICION }).notNull().default("liga"),
    orden: integer("orden").notNull().default(0),
    reglasClasificacion: text("reglas_clasificacion", { mode: "json" })
      .$type<ReglaClasificacion[]>()
      .notNull()
      .default(sql`'[]'`),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("competiciones_temporada_categoria_nombre_uq").on(
      t.temporadaId,
      t.categoria,
      t.nombre,
    ),
    checkEnum("competiciones_categoria_ck", "categoria", CATEGORIAS),
    checkEnum("competiciones_formato_ck", "formato", FORMATOS_COMPETICION),
  ],
);

/** Nombres alternativos con los que aparece una competición en actas e importaciones. */
export const competicionAlias = sqliteTable(
  "competicion_alias",
  {
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    clave: text("clave").notNull(),
  },
  (t) => [primaryKey({ columns: [t.competicionId, t.clave] })],
);

export const competicionEquipos = sqliteTable(
  "competicion_equipos",
  {
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.competicionId, t.equipoId] }),
    index("competicion_equipos_equipo_idx").on(t.equipoId),
  ],
);

/** Ajustes manuales sobre la clasificación calculada (sanciones, puntos concedidos). */
export const clasificacionAjustes = sqliteTable(
  "clasificacion_ajustes",
  {
    id: id(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    /** Delta de puntos: negativo = sanción. */
    puntos: integer("puntos").notNull(),
    motivo: text("motivo").notNull(),
    ...marcasTiempo(),
  },
  (t) => [
    index("clasificacion_ajustes_competicion_idx").on(t.competicionId),
    check("clasificacion_ajustes_puntos_ck", condicion(`"puntos" <> 0`)),
  ],
);
```

`packages/db/src/schema/calendario.ts`:

```ts
import { ESTADOS_PARTIDO } from "@santiso/domain";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { competiciones } from "./competicion";
import { equipos } from "./plantilla";

export const campos = sqliteTable("campos", {
  id: id(),
  nombre: text("nombre").notNull(),
  clave: text("clave").notNull().unique(),
  poblacion: text("poblacion"),
  ...marcasTiempo(),
});

export const jornadas = sqliteTable(
  "jornadas",
  {
    id: id(),
    competicionId: text("competicion_id")
      .notNull()
      .references(() => competiciones.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    /** Solo eliminatorias: "Semifinal", "Final"… */
    nombreFase: text("nombre_fase"),
    /** "YYYY-MM-DD". */
    fechaInicio: text("fecha_inicio"),
    fechaFin: text("fecha_fin"),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("jornadas_competicion_numero_uq").on(t.competicionId, t.numero),
    check("jornadas_numero_ck", condicion(`"numero" > 0`)),
  ],
);

export const jornadaDescansos = sqliteTable(
  "jornada_descansos",
  {
    jornadaId: text("jornada_id")
      .notNull()
      .references(() => jornadas.id, { onDelete: "cascade" }),
    equipoId: text("equipo_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
  },
  (t) => [
    primaryKey({ columns: [t.jornadaId, t.equipoId] }),
    index("jornada_descansos_equipo_idx").on(t.equipoId),
  ],
);

export const partidos = sqliteTable(
  "partidos",
  {
    id: id(),
    jornadaId: text("jornada_id")
      .notNull()
      .references(() => jornadas.id, { onDelete: "cascade" }),
    equipoLocalId: text("equipo_local_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    equipoVisitanteId: text("equipo_visitante_id")
      .notNull()
      .references(() => equipos.id, { onDelete: "restrict" }),
    golesLocal: integer("goles_local"),
    golesVisitante: integer("goles_visitante"),
    estado: text("estado", { enum: ESTADOS_PARTIDO }).notNull().default("programado"),
    /** Hora local de pared "YYYY-MM-DDTHH:mm", sin zona. */
    fecha: text("fecha"),
    campoId: text("campo_id").references(() => campos.id, { onDelete: "set null" }),
    ...marcasTiempo(),
  },
  (t) => [
    uniqueIndex("partidos_jornada_cruce_uq").on(t.jornadaId, t.equipoLocalId, t.equipoVisitanteId),
    index("partidos_fecha_idx").on(t.fecha),
    index("partidos_local_idx").on(t.equipoLocalId),
    index("partidos_visitante_idx").on(t.equipoVisitanteId),
    checkEnum("partidos_estado_ck", "estado", ESTADOS_PARTIDO),
    check("partidos_equipos_distintos_ck", condicion(`"equipo_local_id" <> "equipo_visitante_id"`)),
    check(
      "partidos_marcador_completo_ck",
      condicion(`("goles_local" is null) = ("goles_visitante" is null)`),
    ),
    check(
      "partidos_goles_no_negativos_ck",
      condicion(`coalesce("goles_local", 0) >= 0 and coalesce("goles_visitante", 0) >= 0`),
    ),
    check(
      "partidos_finalizado_con_marcador_ck",
      condicion(`"estado" <> 'finalizado' or "goles_local" is not null`),
    ),
  ],
);
```

- [ ] **Paso 5: Esquema — acta, club e índice**

`packages/db/src/schema/partido.ts`:

```ts
import { LADOS_EVENTO, MINUTO_MAXIMO, TIPOS_EVENTO } from "@santiso/domain";
import { check, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { partidos } from "./calendario";
import { checkEnum, condicion, id, marcasTiempo } from "./comunes";
import { jugadores } from "./plantilla";

/** Jugadores propios convocados a un partido. Los goles se derivan de `partido_eventos`. */
export const partidoParticipaciones = sqliteTable(
  "partido_participaciones",
  {
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    jugadorId: text("jugador_id")
      .notNull()
      .references(() => jugadores.id, { onDelete: "restrict" }),
    titular: integer("titular", { mode: "boolean" }).notNull().default(false),
    jugo: integer("jugo", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.partidoId, t.jugadorId] }),
    index("partido_participaciones_jugador_idx").on(t.jugadorId),
    check("partido_participaciones_titular_jugo_ck", condicion(`not "titular" or "jugo"`)),
  ],
);

/**
 * Eventos del acta. `lado` = equipo al que se anota el evento.
 * Gol en propia (`propia`): lo marca un jugador del otro equipo.
 *  - lado propio + propia → `nombreRival` es el rival que marcó en su portería.
 *  - lado rival + propia → `jugadorId` es nuestro jugador que marcó en nuestra portería.
 */
export const partidoEventos = sqliteTable(
  "partido_eventos",
  {
    id: id(),
    partidoId: text("partido_id")
      .notNull()
      .references(() => partidos.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull(),
    lado: text("lado", { enum: LADOS_EVENTO }).notNull(),
    propia: integer("propia", { mode: "boolean" }).notNull().default(false),
    /** null = sin minuto o posterior al final. */
    minuto: integer("minuto"),
    /** Jugador propio: autor, amonestado o jugador que entra. */
    jugadorId: text("jugador_id").references(() => jugadores.id, { onDelete: "restrict" }),
    /** Cambios: jugador propio que sale. */
    jugadorSaleId: text("jugador_sale_id").references(() => jugadores.id, { onDelete: "restrict" }),
    nombreRival: text("nombre_rival"),
    ...marcasTiempo(),
  },
  (t) => [
    index("partido_eventos_partido_minuto_idx").on(t.partidoId, t.minuto),
    checkEnum("partido_eventos_tipo_ck", "tipo", TIPOS_EVENTO),
    checkEnum("partido_eventos_lado_ck", "lado", LADOS_EVENTO),
    check("partido_eventos_propia_solo_gol_ck", condicion(`not "propia" or "tipo" = 'gol'`)),
    check(
      "partido_eventos_cambio_ck",
      condicion(
        `"tipo" <> 'cambio' or ("lado" = 'propio' and "jugador_id" is not null and "jugador_sale_id" is not null)`,
      ),
    ),
    check(
      "partido_eventos_minuto_ck",
      condicion(`"minuto" is null or "minuto" between 0 and ${MINUTO_MAXIMO}`),
    ),
  ],
);
```

`packages/db/src/schema/club.ts`:

```ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { id, marcasTiempo } from "./comunes";

export const patrocinadores = sqliteTable("patrocinadores", {
  id: id(),
  nombre: text("nombre").notNull(),
  clave: text("clave").notNull().unique(),
  logo: text("logo"),
  webUrl: text("web_url"),
  orden: integer("orden").notNull().default(0),
  enCarteles: integer("en_carteles", { mode: "boolean" }).notNull().default(false),
  ...marcasTiempo(),
});

/** Configuración global clave → valor JSON. Claves y formas en `@santiso/domain` (`AJUSTES`). */
export const ajustes = sqliteTable("ajustes", {
  id: text("id").primaryKey(),
  valor: text("valor", { mode: "json" }).$type<unknown>().notNull(),
  actualizadoEn: text("actualizado_en")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
    .$onUpdateFn(() => new Date().toISOString()),
});
```

`packages/db/src/schema/index.ts`:

```ts
export * from "./calendario";
export * from "./club";
export * from "./competicion";
export * from "./partido";
export * from "./plantilla";
```

- [ ] **Paso 6: Migraciones, utilidad de pruebas e índice del paquete**

`packages/db/src/migraciones.ts`:

```ts
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Db } from "./client";

export const DIR_MIGRACIONES = fileURLToPath(new URL("../migrations", import.meta.url));

export async function migrarBd(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: DIR_MIGRACIONES });
}
```

`packages/db/src/testing.ts`:

```ts
import { abrirDb, type ConexionDb } from "./client";
import { migrarBd } from "./migraciones";

/** BD en memoria con todas las migraciones aplicadas. */
export async function crearDbPrueba(): Promise<ConexionDb> {
  const conexion = await abrirDb(":memory:");
  await migrarBd(conexion.db);
  return conexion;
}
```

`packages/db/src/index.ts`:

```ts
export * from "./client";
export * from "./migraciones";
export * from "./rutas";
export * as schema from "./schema";
```

- [ ] **Paso 7: Generar la migración inicial**

Ejecutar: `pnpm db:generate --name inicial`
Esperado: 16 tablas listadas y `[✓] Your SQL migration file ➜ migrations\0000_inicial.sql`.

Comprobar que el SQL contiene las restricciones clave:

```bash
grep -c "CONSTRAINT" packages/db/migrations/0000_inicial.sql
grep "temporadas_una_activa_uq" packages/db/migrations/0000_inicial.sql
```

Esperado: al menos `21` constraints y la línea `CREATE UNIQUE INDEX \`temporadas_una_activa_uq\` ON \`temporadas\` (\`activa\`) WHERE "activa" = 1;`.

- [ ] **Paso 8: Escribir las pruebas de restricciones**

`packages/db/src/client.test.ts`:

```ts
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { abrirDb } from "./client";
import { urlArchivo } from "./rutas";

// Los ficheros quedan en el temporal del sistema: libSQL no los libera hasta que termina el proceso.
const rutaTemporal = () => path.join(mkdtempSync(path.join(tmpdir(), "santiso-db-")), "prueba.db");

describe("abrirDb", () => {
  it("crea el fichero en la ruta absoluta indicada y activa WAL", async () => {
    const ruta = rutaTemporal();
    const { cliente, cerrar } = await abrirDb(urlArchivo(ruta));
    const modo = (await cliente.execute("PRAGMA journal_mode")).rows[0]?.["journal_mode"];
    cerrar();
    expect(existsSync(ruta)).toBe(true);
    expect(modo).toBe("wal");
  });

  it("sin WAL usa el diario DELETE (un único fichero)", async () => {
    const { cliente, cerrar } = await abrirDb(urlArchivo(rutaTemporal()), { wal: false });
    const modo = (await cliente.execute("PRAGMA journal_mode")).rows[0]?.["journal_mode"];
    cerrar();
    expect(modo).toBe("delete");
  });

  it("activa las claves foráneas", async () => {
    const { cliente, cerrar } = await abrirDb(":memory:");
    const fk = (await cliente.execute("PRAGMA foreign_keys")).rows[0]?.["foreign_keys"];
    cerrar();
    expect(fk).toBe(1);
  });
});
```

`packages/db/src/schema.test.ts`:

```ts
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ConexionDb } from "./client";
import * as s from "./schema";
import { crearDbPrueba } from "./testing";

let conexion: ConexionDb;
beforeEach(async () => {
  conexion = await crearDbPrueba();
});
afterEach(() => conexion.cerrar());

/** Las consultas de Drizzle son thenables: se envuelven para usar `rejects`. */
const rechaza = (consulta: PromiseLike<unknown>) =>
  expect(Promise.resolve(consulta)).rejects.toThrow();

async function sembrar() {
  const { db } = conexion;
  const [temporada] = await db
    .insert(s.temporadas)
    .values({ nombre: "2026/27", activa: true })
    .returning();
  const [competicion] = await db
    .insert(s.competiciones)
    .values({ temporadaId: temporada!.id, categoria: "Senior", nombre: "Liga" })
    .returning();
  const [local] = await db
    .insert(s.equipos)
    .values({ nombre: "Local", clave: "local", categoria: "Senior" })
    .returning();
  const [visitante] = await db
    .insert(s.equipos)
    .values({ nombre: "Visitante", clave: "visitante", categoria: "Senior" })
    .returning();
  const [jornada] = await db
    .insert(s.jornadas)
    .values({ competicionId: competicion!.id, numero: 1 })
    .returning();
  const [jugador] = await db
    .insert(s.jugadores)
    .values({ nombre: "Jugador", categoria: "Senior", dorsal: 9 })
    .returning();
  return {
    temporada: temporada!,
    competicion: competicion!,
    local: local!,
    visitante: visitante!,
    jornada: jornada!,
    jugador: jugador!,
  };
}

describe("temporadas", () => {
  it("solo admite una temporada activa", async () => {
    const { db } = conexion;
    await db.insert(s.temporadas).values({ nombre: "2025/26", activa: true });
    await rechaza(db.insert(s.temporadas).values({ nombre: "2026/27", activa: true }));
    await db.insert(s.temporadas).values({ nombre: "2026/27", activa: false });
    expect(await db.select().from(s.temporadas)).toHaveLength(2);
  });
});

describe("equipos", () => {
  it("rechaza categorías fuera del catálogo", async () => {
    await rechaza(
      conexion.cliente.execute(
        "insert into equipos (id, nombre, clave, categoria) values ('x', 'X', 'x', 'Juvenil')",
      ),
    );
  });

  it("es único por categoría y clave, pero admite la misma clave en otra categoría", async () => {
    const { db } = conexion;
    await db.insert(s.equipos).values({ nombre: "S.D. Touro", clave: "s d touro", categoria: "Senior" });
    await rechaza(
      db.insert(s.equipos).values({ nombre: "S.D. TOURO", clave: "s d touro", categoria: "Senior" }),
    );
    await db
      .insert(s.equipos)
      .values({ nombre: "S.D. Touro", clave: "s d touro", categoria: "Veteranos" });
  });
});

describe("partidos", () => {
  it("nace programado y sin marcador", async () => {
    const { jornada, local, visitante } = await sembrar();
    const [partido] = await conexion.db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    expect(partido).toMatchObject({ estado: "programado", golesLocal: null, golesVisitante: null });
  });

  it("rechaza equipos iguales, marcador incompleto y finalizado sin marcador", async () => {
    const { jornada, local, visitante } = await sembrar();
    const base = { jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id };
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, equipoVisitanteId: local.id }));
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, golesLocal: 1 }));
    await rechaza(conexion.db.insert(s.partidos).values({ ...base, estado: "finalizado" }));
  });

  it("impide borrar un equipo con partidos y borra en cascada desde la competición", async () => {
    const { db } = conexion;
    const { competicion, jornada, local, visitante, jugador } = await sembrar();
    const [partido] = await db
      .insert(s.partidos)
      .values({
        jornadaId: jornada.id,
        equipoLocalId: local.id,
        equipoVisitanteId: visitante.id,
        golesLocal: 2,
        golesVisitante: 1,
        estado: "finalizado",
      })
      .returning();
    await db
      .insert(s.partidoParticipaciones)
      .values({ partidoId: partido!.id, jugadorId: jugador.id, titular: true, jugo: true });
    await db
      .insert(s.partidoEventos)
      .values({ partidoId: partido!.id, tipo: "gol", lado: "propio", jugadorId: jugador.id, minuto: 10 });

    await rechaza(db.delete(s.equipos).where(eq(s.equipos.id, local.id)));
    await rechaza(db.delete(s.jugadores).where(eq(s.jugadores.id, jugador.id)));

    await db.delete(s.competiciones).where(eq(s.competiciones.id, competicion.id));
    expect(await db.select().from(s.partidos)).toHaveLength(0);
    expect(await db.select().from(s.partidoEventos)).toHaveLength(0);
    expect(await db.select().from(s.partidoParticipaciones)).toHaveLength(0);
  });

  it("actualiza actualizado_en al modificar", async () => {
    const { jornada, local, visitante } = await sembrar();
    const [partido] = await conexion.db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    await new Promise((resolver) => setTimeout(resolver, 5));
    const [actualizado] = await conexion.db
      .update(s.partidos)
      .set({ fecha: "2026-09-27T17:00" })
      .where(eq(s.partidos.id, partido!.id))
      .returning();
    expect(actualizado!.actualizadoEn > partido!.actualizadoEn).toBe(true);
  });
});

describe("acta", () => {
  it("valida propia, cambios, minutos y titularidad", async () => {
    const { db } = conexion;
    const { jornada, local, visitante, jugador } = await sembrar();
    const [partido] = await db
      .insert(s.partidos)
      .values({ jornadaId: jornada.id, equipoLocalId: local.id, equipoVisitanteId: visitante.id })
      .returning();
    const evento = { partidoId: partido!.id, jugadorId: jugador.id };

    await rechaza(
      db.insert(s.partidoEventos).values({ ...evento, tipo: "tarjeta_amarilla", lado: "propio", propia: true }),
    );
    await rechaza(db.insert(s.partidoEventos).values({ ...evento, tipo: "cambio", lado: "propio" }));
    await rechaza(
      db.insert(s.partidoEventos).values({ ...evento, tipo: "gol", lado: "propio", minuto: 999 }),
    );
    await rechaza(
      db
        .insert(s.partidoParticipaciones)
        .values({ partidoId: partido!.id, jugadorId: jugador.id, titular: true, jugo: false }),
    );
    await db
      .insert(s.partidoEventos)
      .values({ partidoId: partido!.id, tipo: "gol", lado: "rival", propia: true, jugadorId: jugador.id });
  });
});

describe("staff, JSON y ajustes", () => {
  it("la directiva no tiene categoría y el técnico sí", async () => {
    const { db } = conexion;
    await rechaza(
      db.insert(s.staff).values({ nombre: "P", cargo: "Presidente", tipo: "directiva", categoria: "Senior" }),
    );
    await rechaza(db.insert(s.staff).values({ nombre: "E", cargo: "Entrenador", tipo: "tecnico" }));
    await db.insert(s.staff).values({ nombre: "P", cargo: "Presidente", tipo: "directiva" });
  });

  it("guarda y lee JSON con valores por defecto", async () => {
    const { db } = conexion;
    const { competicion } = await sembrar();
    expect(competicion.reglasClasificacion).toEqual([]);
    const reglas = [{ id: "r1", nombre: "Ascenso", puestos: [1, 2], color: "#10b981" }];
    const [conReglas] = await db
      .update(s.competiciones)
      .set({ reglasClasificacion: reglas })
      .where(eq(s.competiciones.id, competicion.id))
      .returning();
    expect(conReglas!.reglasClasificacion).toEqual(reglas);

    await db.insert(s.ajustes).values({ id: "cartel.orden_logos", valor: "xunta_izquierda" });
    expect((await db.select().from(s.ajustes))[0]?.valor).toBe("xunta_izquierda");
  });
});
```

- [ ] **Paso 9: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run packages/db`
Esperado: `client.test.ts` (3) y `schema.test.ts` (10) en verde.

Si alguna restricción no se aplica, revisar que la migración se generó **después** de copiar el esquema completo. Si hace falta, borrar `packages/db/migrations` y repetir el Paso 7.

- [ ] **Paso 10: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(db): esquema SQLite con Drizzle, migración inicial y cliente libSQL" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 5: CLI de migraciones y copia de seguridad

**Ficheros:**
- Crear: `packages/db/src/backup.ts`, `packages/db/src/cli/migrar.ts`, `packages/db/src/cli/backup.ts`
- Modificar: `packages/db/package.json` (scripts y `tsx`), `packages/db/src/index.ts`, `package.json` raíz
- Test: `packages/db/src/backup.test.ts`

**Interfaces:**
- Consume: `abrirDb`, `migrarBd`, `urlArchivo`, `marcaFichero`, `RUTA_BD`, `DIR_DATOS`, `DIR_BACKUPS` (Tarea 4).
- Produce:
  - `copiarBd(cliente: Client, dirDestino?: string, fecha?: Date): Promise<string>`
  - Scripts raíz `db:migrate` y `db:backup`.

- [ ] **Paso 1: Escribir la prueba que falla**

`packages/db/src/backup.test.ts`:

```ts
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copiarBd } from "./backup";
import { abrirDb } from "./client";
import { migrarBd } from "./migraciones";
import { marcaFichero, urlArchivo } from "./rutas";
import * as s from "./schema";

describe("marcaFichero", () => {
  it("genera una marca sin dos puntos", () => {
    expect(marcaFichero(new Date("2026-09-13T20:15:03.456Z"))).toBe("2026-09-13T20-15-03");
  });
});

describe("copiarBd", () => {
  it("crea una copia íntegra con la marca de tiempo en el nombre", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-backup-"));
    const origen = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
    await migrarBd(origen.db);
    await origen.db.insert(s.temporadas).values({ nombre: "2026/27", activa: true });

    const destino = await copiarBd(
      origen.cliente,
      path.join(dir, "backups"),
      new Date("2026-09-13T20:15:03Z"),
    );
    origen.cerrar();

    expect(path.basename(destino)).toBe("santiso-2026-09-13T20-15-03.db");
    expect(existsSync(destino)).toBe(true);
    const copia = await abrirDb(urlArchivo(destino));
    const integridad = (await copia.cliente.execute("PRAGMA integrity_check")).rows[0]?.[
      "integrity_check"
    ];
    const temporadas = await copia.db.select().from(s.temporadas);
    copia.cerrar();
    expect(integridad).toBe("ok");
    expect(temporadas).toHaveLength(1);
  });
});
```

- [ ] **Paso 2: Ejecutar la prueba y comprobar que falla**

Ejecutar: `pnpm exec vitest run packages/db/src/backup.test.ts`
Esperado: FAIL; no se puede resolver `./backup`.

- [ ] **Paso 3: Implementar**

`packages/db/src/backup.ts`:

```ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { DIR_BACKUPS, marcaFichero } from "./rutas";

/** Copia consistente de la BD con `VACUUM INTO`. Válida con la app en marcha. Devuelve la ruta creada. */
export async function copiarBd(
  cliente: Client,
  dirDestino = DIR_BACKUPS,
  fecha = new Date(),
): Promise<string> {
  mkdirSync(dirDestino, { recursive: true });
  const destino = path.join(dirDestino, `santiso-${marcaFichero(fecha)}.db`);
  await cliente.execute({ sql: "VACUUM INTO ?", args: [destino] });
  return destino;
}
```

`packages/db/src/cli/migrar.ts`:

```ts
import { mkdirSync } from "node:fs";
import { abrirDb } from "../client";
import { migrarBd } from "../migraciones";
import { DIR_DATOS, RUTA_BD, urlArchivo } from "../rutas";

mkdirSync(DIR_DATOS, { recursive: true });
const { db, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
await migrarBd(db);
cerrar();
console.log(`Migraciones aplicadas en ${RUTA_BD}`);
```

`packages/db/src/cli/backup.ts`:

```ts
import { existsSync } from "node:fs";
import { copiarBd } from "../backup";
import { abrirDb } from "../client";
import { RUTA_BD, urlArchivo } from "../rutas";

if (!existsSync(RUTA_BD)) {
  console.error(`No existe la base de datos ${RUTA_BD}.`);
  process.exit(1);
}
const { cliente, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
const destino = await copiarBd(cliente);
cerrar();
console.log(`Copia creada: ${destino}`);
```

En `packages/db/src/index.ts` añadir:

```ts
export * from "./backup";
```

En `packages/db/package.json` añadir a `scripts`:

```json
"migrate": "tsx src/cli/migrar.ts",
"backup": "tsx src/cli/backup.ts"
```

y a `devDependencies`:

```json
"tsx": "catalog:"
```

En el `package.json` raíz añadir a `scripts`:

```json
"db:migrate": "pnpm --filter @santiso/db migrate",
"db:backup": "pnpm --filter @santiso/db backup"
```

Ejecutar `pnpm install`.

- [ ] **Paso 4: Ejecutar pruebas y CLI**

```bash
pnpm exec vitest run packages/db
SANTISO_DATA_DIR="$(mktemp -d)" pnpm db:migrate
```

Esperado:
- Pruebas de `packages/db` en verde.
- El CLI imprime `Migraciones aplicadas en …/santiso.db`. Usa un directorio temporal: `data/` real se crea en la Tarea 14.

- [ ] **Paso 5: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(db): CLI de migraciones y copias de seguridad con VACUUM INTO" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 6: Herramienta de migración — formato del snapshot y fábricas de prueba

**Ficheros:**
- Crear: `tools/migracion-supabase/package.json`, `tools/migracion-supabase/tsconfig.json`
- Crear: `tools/migracion-supabase/src/hash.ts`
- Crear: `tools/migracion-supabase/src/snapshot/tipos.ts`, `tools/migracion-supabase/src/snapshot/archivos.ts`
- Crear: `tools/migracion-supabase/src/test/fabricas.ts`
- Test: `tools/migracion-supabase/src/snapshot/tipos.test.ts`, `tools/migracion-supabase/src/snapshot/archivos.test.ts`

**Interfaces:**
- Consume: `DIR_SNAPSHOTS` de `@santiso/db`.
- Produce:
  - `TABLAS_ORIGEN` (16 esquemas Zod), `TABLAS: TablaOrigen[]`, `type TablaOrigen`, `type Snapshot`.
  - Tipos de fila: `FilaTemporada`, `FilaCompeticion`, `FilaEtiqueta`, `FilaReglas`, `FilaEquipo`, `FilaEquipoCompeticion`, `FilaCampo`, `FilaJornada`, `FilaDescanso`, `FilaPartido`, `FilaJugador`, `FilaEstadistica`, `FilaEvento`, `FilaStaff`, `FilaPatrocinador`, `FilaCartelAsset`.
  - `validarSnapshot(crudo: Partial<Record<TablaOrigen, unknown>>): Snapshot`
  - `manifiestoSchema`, `type Manifiesto { creadoEn; origen; filas: Record<string, number>; media: Record<string, { bytes; sha256 }> }`
  - `escribirSnapshot(dir, snapshot, manifiesto): void`, `leerSnapshot(dir): { snapshot; manifiesto }`, `ultimoSnapshot(dirSnapshots?): string`
  - `sha256(bytes: Uint8Array): string`
  - Fábricas: `snapshotVacio()`, `fabricar.<entidad>(parcial)`, `snapshotMinimo()`, `manifiestoPara(snapshot, media?)`

- [ ] **Paso 1: Esqueleto del paquete**

`tools/migracion-supabase/package.json`:

```json
{
  "name": "@santiso/migracion-supabase",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@santiso/db": "workspace:*",
    "@santiso/domain": "workspace:*",
    "drizzle-orm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:"
  }
}
```

`tools/migracion-supabase/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`tools/migracion-supabase/src/hash.ts`:

```ts
import { createHash } from "node:crypto";

export const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
```

Ejecutar `pnpm install`.

- [ ] **Paso 2: Tipos del snapshot**

Solo se leen las columnas usadas. Zod descarta el resto y detiene el proceso si una forma cambia.

`tools/migracion-supabase/src/snapshot/tipos.ts`:

```ts
import { z } from "zod";

const id = z.string().min(1);
const texto = z.string();
const textoNulo = z.string().nullable();
const enteroNulo = z.number().int().nullable();

export const filaTemporada = z.object({
  id,
  nombre: texto,
  activa: z.boolean().nullable(),
  created_at: textoNulo,
});
export const filaCompeticion = z.object({
  id,
  categoria: texto,
  nombre: texto,
  orden: z.number().int(),
  activa: z.boolean(),
  formato: textoNulo,
  created_at: textoNulo,
});
export const filaEtiqueta = z.object({ competicion_id: id, categoria: texto, etiqueta: texto });
export const filaReglas = z.object({
  id,
  temporada_id: id,
  competicion_id: id,
  reglas: z.unknown(),
});
export const filaEquipo = z.object({
  id,
  nombre: texto,
  escudo_url: textoNulo,
  categoria: textoNulo,
  created_at: texto,
  pts: enteroNulo,
  pj: enteroNulo,
  pg: enteroNulo,
  pe: enteroNulo,
  pp: enteroNulo,
  gf: enteroNulo,
  gc: enteroNulo,
});
export const filaEquipoCompeticion = z.object({ equipo_id: id, competicion_id: id });
export const filaCampo = z.object({ id, nombre: texto, poblacion: textoNulo, created_at: textoNulo });
export const filaJornada = z.object({
  id,
  temporada_id: id,
  competicion_id: id,
  categoria: texto,
  numero: z.number().int(),
  fecha_inicio: textoNulo,
  fecha_fin: textoNulo,
  nombre_fase: textoNulo,
  created_at: textoNulo,
});
export const filaDescanso = z.object({ jornada_id: id, equipo_id: id });
export const filaPartido = z.object({
  id,
  jornada_id: id,
  competicion_id: id,
  categoria: texto,
  equipo_local_id: id,
  equipo_visitante_id: id,
  goles_local: enteroNulo,
  goles_visitante: enteroNulo,
  estado: texto,
  fecha: textoNulo,
  campo_id: textoNulo,
  created_at: textoNulo,
});
export const filaJugador = z.object({
  id,
  nombre: texto,
  apodo: textoNulo,
  dorsal: enteroNulo,
  posicion: textoNulo,
  posiciones_conocidas: z.array(texto).nullable(),
  capitan: enteroNulo,
  foto_url: textoNulo,
  categoria: textoNulo,
  fecha_nacimiento: textoNulo,
  historial_deportivo: z.array(texto).nullable(),
  compromiso: enteroNulo,
  created_at: textoNulo,
});
export const filaEstadistica = z.object({
  jugador_id: id,
  partido_id: id,
  titular: z.boolean().nullable(),
  jugo: z.boolean().nullable(),
  goles: enteroNulo,
});
export const filaEvento = z.object({
  id,
  partido_id: id,
  tipo: texto,
  minuto: enteroNulo,
  jugador_id: textoNulo,
  jugador_relacionado_id: textoNulo,
  es_rival: z.boolean(),
  nombre_mostrado: textoNulo,
  created_at: textoNulo,
});
export const filaStaff = z.object({
  id,
  nombre: texto,
  cargo: texto,
  tipo: texto,
  categoria: textoNulo,
  foto_url: textoNulo,
  created_at: textoNulo,
});
export const filaPatrocinador = z.object({
  id,
  nombre: texto,
  logo_url: textoNulo,
  web_url: textoNulo,
  orden: enteroNulo,
  created_at: textoNulo,
});
export const filaCartelAsset = z.object({
  id,
  nombre: texto,
  tipo: texto,
  subtipo: textoNulo,
  url: texto,
  orden: enteroNulo,
});

/** Tablas de Supabase que se exportan, con el esquema de sus filas. */
export const TABLAS_ORIGEN = {
  temporadas: filaTemporada,
  competiciones: filaCompeticion,
  competicion_etiquetas: filaEtiqueta,
  reglas_liga: filaReglas,
  equipos: filaEquipo,
  equipo_competiciones: filaEquipoCompeticion,
  campos_futbol: filaCampo,
  jornadas: filaJornada,
  jornada_equipo_descanso: filaDescanso,
  partidos_liga: filaPartido,
  jugadores: filaJugador,
  jugador_partido_stats: filaEstadistica,
  partido_eventos_santiso: filaEvento,
  staff_club: filaStaff,
  patrocinadores: filaPatrocinador,
  cartel_assets: filaCartelAsset,
} as const;

export type TablaOrigen = keyof typeof TABLAS_ORIGEN;
// Object.keys pierde el tipo de las claves; la lista sale del mismo objeto.
export const TABLAS = Object.keys(TABLAS_ORIGEN) as TablaOrigen[];
export type Snapshot = { [T in TablaOrigen]: z.infer<(typeof TABLAS_ORIGEN)[T]>[] };

export type FilaTemporada = z.infer<typeof filaTemporada>;
export type FilaCompeticion = z.infer<typeof filaCompeticion>;
export type FilaEtiqueta = z.infer<typeof filaEtiqueta>;
export type FilaReglas = z.infer<typeof filaReglas>;
export type FilaEquipo = z.infer<typeof filaEquipo>;
export type FilaEquipoCompeticion = z.infer<typeof filaEquipoCompeticion>;
export type FilaCampo = z.infer<typeof filaCampo>;
export type FilaJornada = z.infer<typeof filaJornada>;
export type FilaDescanso = z.infer<typeof filaDescanso>;
export type FilaPartido = z.infer<typeof filaPartido>;
export type FilaJugador = z.infer<typeof filaJugador>;
export type FilaEstadistica = z.infer<typeof filaEstadistica>;
export type FilaEvento = z.infer<typeof filaEvento>;
export type FilaStaff = z.infer<typeof filaStaff>;
export type FilaPatrocinador = z.infer<typeof filaPatrocinador>;
export type FilaCartelAsset = z.infer<typeof filaCartelAsset>;

/** Valida cada tabla del volcado; se detiene en la primera con forma inesperada. */
export function validarSnapshot(crudo: Partial<Record<TablaOrigen, unknown>>): Snapshot {
  const salida: Partial<Record<TablaOrigen, unknown>> = {};
  for (const tabla of TABLAS) {
    const resultado = z.array(TABLAS_ORIGEN[tabla]).safeParse(crudo[tabla]);
    if (!resultado.success) {
      throw new Error(`Snapshot inválido en "${tabla}":\n${z.prettifyError(resultado.error)}`);
    }
    salida[tabla] = resultado.data;
  }
  // Cada clave se ha rellenado arriba con los datos ya validados por su esquema.
  return salida as Snapshot;
}

export const manifiestoSchema = z.object({
  creadoEn: z.string(),
  /** Host de Supabase (sin claves). */
  origen: z.string(),
  filas: z.record(z.string(), z.number().int().nonnegative()),
  media: z.record(
    z.string(),
    z.object({ bytes: z.number().int().nonnegative(), sha256: z.string().length(64) }),
  ),
});
export type Manifiesto = z.infer<typeof manifiestoSchema>;
```

- [ ] **Paso 3: Fábricas de prueba**

`tools/migracion-supabase/src/test/fabricas.ts`:

```ts
import { sha256 } from "../hash";
import {
  type FilaCampo,
  type FilaCartelAsset,
  type FilaCompeticion,
  type FilaDescanso,
  type FilaEquipo,
  type FilaEquipoCompeticion,
  type FilaEstadistica,
  type FilaEtiqueta,
  type FilaEvento,
  type FilaJornada,
  type FilaJugador,
  type FilaPartido,
  type FilaPatrocinador,
  type FilaReglas,
  type FilaStaff,
  type FilaTemporada,
  type Manifiesto,
  type Snapshot,
  TABLAS,
} from "../snapshot/tipos";

let secuencia = 0;
const nuevoId = (prefijo: string) => `${prefijo}-${++secuencia}`;
const CREADO = "2026-01-01T10:00:00+00:00";

export const snapshotVacio = (): Snapshot => ({
  temporadas: [],
  competiciones: [],
  competicion_etiquetas: [],
  reglas_liga: [],
  equipos: [],
  equipo_competiciones: [],
  campos_futbol: [],
  jornadas: [],
  jornada_equipo_descanso: [],
  partidos_liga: [],
  jugadores: [],
  jugador_partido_stats: [],
  partido_eventos_santiso: [],
  staff_club: [],
  patrocinadores: [],
  cartel_assets: [],
});

/** Filas de origen con valores por defecto válidos; se sobrescriben con `parcial`. */
export const fabricar = {
  temporada: (parcial: Partial<FilaTemporada> = {}): FilaTemporada => ({
    id: nuevoId("temporada"),
    nombre: "2026/27",
    activa: true,
    created_at: CREADO,
    ...parcial,
  }),
  competicion: (parcial: Partial<FilaCompeticion> = {}): FilaCompeticion => ({
    id: nuevoId("competicion"),
    categoria: "Senior",
    nombre: "Liga",
    orden: 0,
    activa: true,
    formato: "liga",
    created_at: CREADO,
    ...parcial,
  }),
  etiqueta: (parcial: Partial<FilaEtiqueta> = {}): FilaEtiqueta => ({
    competicion_id: "",
    categoria: "Senior",
    etiqueta: "Liga",
    ...parcial,
  }),
  reglas: (parcial: Partial<FilaReglas> = {}): FilaReglas => ({
    id: nuevoId("reglas"),
    temporada_id: "",
    competicion_id: "",
    reglas: [],
    ...parcial,
  }),
  equipo: (parcial: Partial<FilaEquipo> = {}): FilaEquipo => ({
    id: nuevoId("equipo"),
    nombre: "Equipo",
    escudo_url: null,
    categoria: "Senior",
    created_at: CREADO,
    pts: 0,
    pj: 0,
    pg: 0,
    pe: 0,
    pp: 0,
    gf: 0,
    gc: 0,
    ...parcial,
  }),
  equipoCompeticion: (parcial: Partial<FilaEquipoCompeticion> = {}): FilaEquipoCompeticion => ({
    equipo_id: "",
    competicion_id: "",
    ...parcial,
  }),
  campo: (parcial: Partial<FilaCampo> = {}): FilaCampo => ({
    id: nuevoId("campo"),
    nombre: "Campo",
    poblacion: null,
    created_at: CREADO,
    ...parcial,
  }),
  jornada: (parcial: Partial<FilaJornada> = {}): FilaJornada => ({
    id: nuevoId("jornada"),
    temporada_id: "",
    competicion_id: "",
    categoria: "Senior",
    numero: 1,
    fecha_inicio: null,
    fecha_fin: null,
    nombre_fase: null,
    created_at: CREADO,
    ...parcial,
  }),
  descanso: (parcial: Partial<FilaDescanso> = {}): FilaDescanso => ({
    jornada_id: "",
    equipo_id: "",
    ...parcial,
  }),
  partido: (parcial: Partial<FilaPartido> = {}): FilaPartido => ({
    id: nuevoId("partido"),
    jornada_id: "",
    competicion_id: "",
    categoria: "Senior",
    equipo_local_id: "",
    equipo_visitante_id: "",
    goles_local: null,
    goles_visitante: null,
    estado: "programado",
    fecha: null,
    campo_id: null,
    created_at: CREADO,
    ...parcial,
  }),
  jugador: (parcial: Partial<FilaJugador> = {}): FilaJugador => ({
    id: nuevoId("jugador"),
    nombre: "Jugador",
    apodo: null,
    dorsal: null,
    posicion: null,
    posiciones_conocidas: null,
    capitan: 0,
    foto_url: null,
    categoria: "Senior",
    fecha_nacimiento: null,
    historial_deportivo: null,
    compromiso: null,
    created_at: CREADO,
    ...parcial,
  }),
  estadistica: (parcial: Partial<FilaEstadistica> = {}): FilaEstadistica => ({
    jugador_id: "",
    partido_id: "",
    titular: false,
    jugo: false,
    goles: 0,
    ...parcial,
  }),
  evento: (parcial: Partial<FilaEvento> = {}): FilaEvento => ({
    id: nuevoId("evento"),
    partido_id: "",
    tipo: "gol",
    minuto: null,
    jugador_id: null,
    jugador_relacionado_id: null,
    es_rival: false,
    nombre_mostrado: null,
    created_at: CREADO,
    ...parcial,
  }),
  staff: (parcial: Partial<FilaStaff> = {}): FilaStaff => ({
    id: nuevoId("staff"),
    nombre: "Miembro",
    cargo: "Entrenador",
    tipo: "Tecnico",
    categoria: "Senior",
    foto_url: null,
    created_at: CREADO,
    ...parcial,
  }),
  patrocinador: (parcial: Partial<FilaPatrocinador> = {}): FilaPatrocinador => ({
    id: nuevoId("patrocinador"),
    nombre: "Patrocinador",
    logo_url: null,
    web_url: null,
    orden: 0,
    created_at: CREADO,
    ...parcial,
  }),
  asset: (parcial: Partial<FilaCartelAsset> = {}): FilaCartelAsset => ({
    id: nuevoId("asset"),
    nombre: "Asset",
    tipo: "logo_patrocinador",
    subtipo: null,
    url: "",
    orden: 0,
    ...parcial,
  }),
};

/**
 * Snapshot mínimo coherente: 1 temporada activa, 1 competición Senior, Santiso y un rival,
 * 1 campo, 1 jornada, 1 partido finalizado 2-1, 1 jugador titular con 1 gol y 1 técnico.
 */
export function snapshotMinimo() {
  const snapshot = snapshotVacio();
  const temporada = fabricar.temporada();
  const competicion = fabricar.competicion({ nombre: "Tercera Futgal - Gr. 3" });
  const santiso = fabricar.equipo({ nombre: "U.D. Santiso F.C." });
  const rival = fabricar.equipo({ nombre: "C.D. San Mamed" });
  const campo = fabricar.campo({ nombre: "Municipal de Santiso", poblacion: "Santiso" });
  const jornada = fabricar.jornada({ temporada_id: temporada.id, competicion_id: competicion.id });
  const partido = fabricar.partido({
    jornada_id: jornada.id,
    competicion_id: competicion.id,
    equipo_local_id: santiso.id,
    equipo_visitante_id: rival.id,
    goles_local: 2,
    goles_visitante: 1,
    estado: "finalizado",
    fecha: "2026-09-27T17:00:00+00:00",
    campo_id: campo.id,
  });
  const jugador = fabricar.jugador({ nombre: "Iván Pérez", dorsal: 9 });

  snapshot.temporadas.push(temporada);
  snapshot.competiciones.push(competicion);
  snapshot.equipos.push(santiso, rival);
  snapshot.equipo_competiciones.push(
    fabricar.equipoCompeticion({ equipo_id: santiso.id, competicion_id: competicion.id }),
    fabricar.equipoCompeticion({ equipo_id: rival.id, competicion_id: competicion.id }),
  );
  snapshot.campos_futbol.push(campo);
  snapshot.jornadas.push(jornada);
  snapshot.partidos_liga.push(partido);
  snapshot.jugadores.push(jugador);
  snapshot.jugador_partido_stats.push(
    fabricar.estadistica({
      partido_id: partido.id,
      jugador_id: jugador.id,
      titular: true,
      jugo: true,
      goles: 1,
    }),
  );
  snapshot.partido_eventos_santiso.push(
    fabricar.evento({ partido_id: partido.id, tipo: "gol", minuto: 30, jugador_id: jugador.id }),
  );
  snapshot.staff_club.push(fabricar.staff({ nombre: "Entrenador Senior" }));

  return {
    snapshot,
    ids: {
      temporada: temporada.id,
      competicion: competicion.id,
      santiso: santiso.id,
      rival: rival.id,
      campo: campo.id,
      jornada: jornada.id,
      partido: partido.id,
      jugador: jugador.id,
    },
  };
}

export function manifiestoPara(
  snapshot: Snapshot,
  media: Record<string, Uint8Array> = {},
): Manifiesto {
  return {
    creadoEn: "2026-09-13T20:00:00.000Z",
    origen: "prueba.supabase.co",
    filas: Object.fromEntries(TABLAS.map((tabla) => [tabla, snapshot[tabla].length])),
    media: Object.fromEntries(
      Object.entries(media).map(([clave, bytes]) => [
        clave,
        { bytes: bytes.length, sha256: sha256(bytes) },
      ]),
    ),
  };
}
```

- [ ] **Paso 4: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/snapshot/tipos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { snapshotMinimo, snapshotVacio } from "../test/fabricas";
import { validarSnapshot } from "./tipos";

describe("validarSnapshot", () => {
  it("acepta un snapshot coherente", () => {
    const { snapshot } = snapshotMinimo();
    expect(validarSnapshot(snapshot).partidos_liga).toHaveLength(1);
  });

  it("descarta columnas que no se usan", () => {
    const snapshot = snapshotVacio();
    const crudo = {
      ...snapshot,
      campos_futbol: [{ id: "c1", nombre: "Campo", poblacion: null, created_at: null, extra: 1 }],
    };
    expect(validarSnapshot(crudo).campos_futbol[0]).not.toHaveProperty("extra");
  });

  it("se detiene si falta una tabla o una fila tiene otra forma", () => {
    const { temporadas: _omitida, ...sinTemporadas } = snapshotVacio();
    expect(() => validarSnapshot(sinTemporadas)).toThrow(/"temporadas"/);

    const snapshot = snapshotVacio();
    const crudo = {
      ...snapshot,
      temporadas: [{ id: "t", nombre: "2026/27", activa: "si", created_at: null }],
    };
    expect(() => validarSnapshot(crudo)).toThrow(/"temporadas"/);
  });
});
```

`tools/migracion-supabase/src/snapshot/archivos.test.ts`:

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { manifiestoPara, snapshotMinimo } from "../test/fabricas";
import { escribirSnapshot, leerSnapshot, ultimoSnapshot } from "./archivos";

const dirTemporal = () => mkdtempSync(path.join(tmpdir(), "santiso-snapshot-"));

describe("escribirSnapshot / leerSnapshot", () => {
  it("guarda y recupera el mismo contenido", () => {
    const dir = dirTemporal();
    const { snapshot } = snapshotMinimo();
    const manifiesto = manifiestoPara(snapshot);
    escribirSnapshot(dir, snapshot, manifiesto);
    const leido = leerSnapshot(dir);
    expect(leido.snapshot).toEqual(snapshot);
    expect(leido.manifiesto).toEqual(manifiesto);
  });

  it("detecta un manifiesto que no cuadra con las tablas", () => {
    const dir = dirTemporal();
    const { snapshot } = snapshotMinimo();
    escribirSnapshot(dir, snapshot, {
      ...manifiestoPara(snapshot),
      filas: { ...manifiestoPara(snapshot).filas, partidos_liga: 5 },
    });
    expect(() => leerSnapshot(dir)).toThrow(/partidos_liga/);
  });
});

describe("ultimoSnapshot", () => {
  it("elige el directorio más reciente por nombre", () => {
    const dir = dirTemporal();
    for (const nombre of ["2026-09-13T10-00-00", "2026-09-13T20-15-03", "2026-09-12T23-59-59"]) {
      mkdirSync(path.join(dir, nombre));
    }
    writeFileSync(path.join(dir, "notas.txt"), "no es un snapshot");
    expect(path.basename(ultimoSnapshot(dir))).toBe("2026-09-13T20-15-03");
  });

  it("explica qué hacer si no hay snapshots", () => {
    expect(() => ultimoSnapshot(dirTemporal())).toThrow(/pnpm migracion:exportar/);
  });
});
```

- [ ] **Paso 5: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: `tipos.test.ts` pasa; `archivos.test.ts` falla porque no existe `./archivos`.

- [ ] **Paso 6: Implementar lectura y escritura**

`tools/migracion-supabase/src/snapshot/archivos.ts`:

```ts
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_SNAPSHOTS } from "@santiso/db";
import { type Manifiesto, manifiestoSchema, type Snapshot, TABLAS, validarSnapshot } from "./tipos";

const rutaTabla = (dir: string, tabla: string) => path.join(dir, "tablas", `${tabla}.json`);
const aJson = (valor: unknown) => `${JSON.stringify(valor, null, 2)}\n`;

export function escribirSnapshot(dir: string, snapshot: Snapshot, manifiesto: Manifiesto): void {
  mkdirSync(path.join(dir, "tablas"), { recursive: true });
  for (const tabla of TABLAS) writeFileSync(rutaTabla(dir, tabla), aJson(snapshot[tabla]));
  writeFileSync(path.join(dir, "manifiesto.json"), aJson(manifiesto));
}

export function leerSnapshot(dir: string): { snapshot: Snapshot; manifiesto: Manifiesto } {
  const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(ruta, "utf8"));
  const snapshot = validarSnapshot(
    Object.fromEntries(TABLAS.map((tabla) => [tabla, leerJson(rutaTabla(dir, tabla))])),
  );
  const manifiesto = manifiestoSchema.parse(leerJson(path.join(dir, "manifiesto.json")));
  for (const tabla of TABLAS) {
    if (manifiesto.filas[tabla] !== snapshot[tabla].length) {
      throw new Error(
        `Snapshot incoherente: ${tabla} tiene ${snapshot[tabla].length} filas y el manifiesto indica ${manifiesto.filas[tabla]}.`,
      );
    }
  }
  return { snapshot, manifiesto };
}

/** Directorio del snapshot más reciente (los nombres son marcas de tiempo ordenables). */
export function ultimoSnapshot(dirSnapshots = DIR_SNAPSHOTS): string {
  const nombres = existsSync(dirSnapshots)
    ? readdirSync(dirSnapshots, { withFileTypes: true })
        .filter((entrada) => entrada.isDirectory())
        .map((entrada) => entrada.name)
        .sort()
    : [];
  const ultimo = nombres.at(-1);
  if (!ultimo) {
    throw new Error(`No hay snapshots en ${dirSnapshots}. Ejecuta primero pnpm migracion:exportar.`);
  }
  return path.join(dirSnapshots, ultimo);
}
```

- [ ] **Paso 7: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: 7 pruebas en verde.

- [ ] **Paso 8: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): formato validado del snapshot de Supabase y fábricas de prueba" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 7: Exportación de Supabase (tablas y media)

**Ficheros:**
- Crear: `tools/migracion-supabase/src/snapshot/media.ts`
- Crear: `tools/migracion-supabase/src/supabase/cliente.ts`
- Crear: `tools/migracion-supabase/src/exportar.ts`
- Crear: `tools/migracion-supabase/src/cli/exportar.ts`
- Modificar: `tools/migracion-supabase/package.json`, `package.json` raíz
- Test: `tools/migracion-supabase/src/snapshot/media.test.ts`, `tools/migracion-supabase/src/supabase/cliente.test.ts`, `tools/migracion-supabase/src/exportar.test.ts`

**Interfaces:**
- Consume: `TABLAS`, `validarSnapshot`, `escribirSnapshot`, `leerSnapshot`, `sha256`, fábricas (Tarea 6); `DIR_SNAPSHOTS`, `marcaFichero` (`@santiso/db`).
- Produce:
  - `BUCKET_MEDIA = "fotos"`, `CLAVE_ESCUDO_CLUB = "escudo_club.webp"`
  - `claveMediaDesdeUrl(url: string | null | undefined): string | null`
  - `clavesMedia(snapshot: Snapshot): Set<string>`
  - `interface ConfigSupabase { url; claveServicio }`, `type Fetch = typeof fetch`
  - `leerConfig(rutaEnv: string): ConfigSupabase`
  - `leerTabla(config, tabla, fetchImpl?): Promise<unknown[]>`
  - `descargarMedia(config, clave, fetchImpl?): Promise<Uint8Array>`
  - `exportarSnapshot({ config, dir, fetchImpl?, registrar? }): Promise<Manifiesto>`
  - Script raíz `migracion:exportar`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/snapshot/media.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotMinimo } from "../test/fabricas";
import { claveMediaDesdeUrl, clavesMedia } from "./media";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("claveMediaDesdeUrl", () => {
  it("extrae la clave relativa decodificada y sin parámetros", () => {
    expect(claveMediaDesdeUrl(`${BASE}escudos/a%20b.webp`)).toBe("escudos/a b.webp");
    expect(claveMediaDesdeUrl(`${BASE}escudo_club.webp?t=123`)).toBe("escudo_club.webp");
  });

  it("devuelve null si no hay URL", () => {
    expect(claveMediaDesdeUrl("")).toBeNull();
    expect(claveMediaDesdeUrl(null)).toBeNull();
  });

  it("rechaza URLs de otro origen o con segmentos peligrosos", () => {
    expect(() => claveMediaDesdeUrl("https://otro.com/x.webp")).toThrow(/fuera del bucket/);
    expect(() => claveMediaDesdeUrl(`${BASE}../secreto`)).toThrow(/inválida/);
  });
});

describe("clavesMedia", () => {
  it("reúne las referencias de todas las tablas y el escudo del club", () => {
    const { snapshot } = snapshotMinimo();
    snapshot.equipos[0]!.escudo_url = `${BASE}escudos/santiso.webp`;
    snapshot.cartel_assets.push(
      fabricar.asset({ tipo: "config", subtipo: "logo_order", nombre: "xunta_left", url: "" }),
      fabricar.asset({ nombre: "Concello", url: `${BASE}cartel/logo_patrocinador/concello.webp` }),
    );
    expect([...clavesMedia(snapshot)].sort()).toEqual([
      "cartel/logo_patrocinador/concello.webp",
      "escudo_club.webp",
      "escudos/santiso.webp",
    ]);
  });
});
```

`tools/migracion-supabase/src/supabase/cliente.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { leerTabla } from "./cliente";

const config = { url: "https://abc.supabase.co", claveServicio: "clave-secreta" };

describe("leerTabla", () => {
  it("pagina con Range hasta recibir una página incompleta", async () => {
    const peticiones: { url: string; range: string | null; apikey: string | null }[] = [];
    const fetchFalso: typeof fetch = async (entrada, init) => {
      const cabeceras = new Headers(init?.headers);
      peticiones.push({
        url: String(entrada),
        range: cabeceras.get("Range"),
        apikey: cabeceras.get("apikey"),
      });
      const cantidad = peticiones.length === 1 ? 1000 : 2;
      return Response.json(Array.from({ length: cantidad }, (_, i) => ({ id: `${i}` })));
    };

    const filas = await leerTabla(config, "jugador_partido_stats", fetchFalso);

    expect(filas).toHaveLength(1002);
    expect(peticiones.map((p) => p.range)).toEqual(["0-999", "1000-1999"]);
    expect(peticiones[0]?.url).toBe(
      "https://abc.supabase.co/rest/v1/jugador_partido_stats?select=*&order=id",
    );
    expect(peticiones[0]?.apikey).toBe("clave-secreta");
  });

  it("ordena por clave natural las tablas sin id", async () => {
    let url = "";
    const fetchFalso: typeof fetch = async (entrada) => {
      url = String(entrada);
      return Response.json([]);
    };
    await leerTabla(config, "competicion_etiquetas", fetchFalso);
    expect(url).toContain("order=competicion_id,etiqueta");
  });

  it("informa del código HTTP sin revelar la clave", async () => {
    const fetchFalso: typeof fetch = async () => new Response("no", { status: 401 });
    const error = await leerTabla(config, "equipos", fetchFalso).catch((e: unknown) => e);
    expect(String(error)).toMatch(/HTTP 401/);
    expect(String(error)).not.toMatch(/clave-secreta/);
  });
});
```

`tools/migracion-supabase/src/exportar.test.ts`:

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportarSnapshot } from "./exportar";
import { leerSnapshot } from "./snapshot/archivos";
import { TABLAS, type TablaOrigen } from "./snapshot/tipos";
import { snapshotMinimo } from "./test/fabricas";

const config = { url: "https://abc.supabase.co", claveServicio: "clave-secreta" };
const BASE_MEDIA = "/storage/v1/object/public/fotos/";

const esTabla = (valor: string): valor is TablaOrigen =>
  (TABLAS as readonly string[]).includes(valor);

describe("exportarSnapshot", () => {
  it("vuelca tablas, media referenciada y un manifiesto verificable", async () => {
    const { snapshot } = snapshotMinimo();
    snapshot.equipos[0]!.escudo_url = `https://abc.supabase.co${BASE_MEDIA}escudos/santiso.webp`;
    const ficheros: Record<string, Uint8Array> = {
      "escudos/santiso.webp": new Uint8Array([1, 2, 3]),
      "escudo_club.webp": new Uint8Array([9]),
    };
    const fetchFalso: typeof fetch = async (entrada) => {
      const { pathname } = new URL(String(entrada));
      const tabla = /^\/rest\/v1\/(\w+)$/.exec(pathname)?.[1];
      if (tabla && esTabla(tabla)) return Response.json(snapshot[tabla]);
      const contenido = ficheros[decodeURIComponent(pathname.replace(BASE_MEDIA, ""))];
      return contenido
        ? new Response(contenido.slice().buffer)
        : new Response(null, { status: 404 });
    };
    const dir = mkdtempSync(path.join(tmpdir(), "santiso-exportar-"));

    const manifiesto = await exportarSnapshot({
      config,
      dir,
      fetchImpl: fetchFalso,
      registrar: () => {},
    });

    expect(manifiesto.origen).toBe("abc.supabase.co");
    expect(manifiesto.filas["partidos_liga"]).toBe(1);
    expect(Object.keys(manifiesto.media).sort()).toEqual(["escudo_club.webp", "escudos/santiso.webp"]);
    expect(readFileSync(path.join(dir, "media", "escudos", "santiso.webp"))).toEqual(
      Buffer.from([1, 2, 3]),
    );
    expect(leerSnapshot(dir).snapshot).toEqual(snapshot);
    expect(readFileSync(path.join(dir, "manifiesto.json"), "utf8")).not.toContain("clave-secreta");
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: FAIL en los 3 ficheros nuevos por módulos inexistentes.

- [ ] **Paso 3: Implementar la media**

`tools/migracion-supabase/src/snapshot/media.ts`:

```ts
import type { Snapshot } from "./tipos";

export const BUCKET_MEDIA = "fotos";
/** El escudo del club no está referenciado en ninguna tabla: vive en una ruta fija del bucket. */
export const CLAVE_ESCUDO_CLUB = "escudo_club.webp";

const MARCA_PUBLICA = `/storage/v1/object/public/${BUCKET_MEDIA}/`;

/** URL pública de Supabase Storage → clave relativa (`escudos/<uuid>.webp`). */
export function claveMediaDesdeUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  const inicio = url.indexOf(MARCA_PUBLICA);
  if (inicio < 0) throw new Error(`URL de media fuera del bucket "${BUCKET_MEDIA}": ${url}`);
  const [ruta = ""] = url.slice(inicio + MARCA_PUBLICA.length).split("?");
  const clave = decodeURIComponent(ruta);
  const segmentos = clave.split("/");
  if (segmentos.some((segmento) => segmento === "" || segmento === "." || segmento === "..")) {
    throw new Error(`Clave de media inválida: ${url}`);
  }
  return clave;
}

/** Claves de todos los ficheros referenciados más el escudo del club. */
export function clavesMedia(snapshot: Snapshot): Set<string> {
  const urls = [
    ...snapshot.equipos.map((equipo) => equipo.escudo_url),
    ...snapshot.jugadores.map((jugador) => jugador.foto_url),
    ...snapshot.staff_club.map((miembro) => miembro.foto_url),
    ...snapshot.patrocinadores.map((patrocinador) => patrocinador.logo_url),
    ...snapshot.cartel_assets.filter((asset) => asset.tipo !== "config").map((asset) => asset.url),
  ];
  const claves = new Set<string>([CLAVE_ESCUDO_CLUB]);
  for (const url of urls) {
    const clave = claveMediaDesdeUrl(url);
    if (clave) claves.add(clave);
  }
  return claves;
}
```

- [ ] **Paso 4: Implementar el cliente de Supabase**

`tools/migracion-supabase/src/supabase/cliente.ts`:

```ts
import { BUCKET_MEDIA } from "../snapshot/media";
import type { TablaOrigen } from "../snapshot/tipos";

export interface ConfigSupabase {
  url: string;
  claveServicio: string;
}

export type Fetch = typeof fetch;

const TAMANO_PAGINA = 1000;

/** Orden estable para paginar; las tablas sin `id` usan su clave natural. */
const ORDEN: Partial<Record<TablaOrigen, string>> = {
  competicion_etiquetas: "competicion_id,etiqueta",
};

export function leerConfig(rutaEnv: string): ConfigSupabase {
  process.loadEnvFile(rutaEnv);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !claveServicio) {
    throw new Error(`Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${rutaEnv}.`);
  }
  return { url: url.replace(/\/+$/, ""), claveServicio };
}

const cabeceras = (config: ConfigSupabase) => ({
  apikey: config.claveServicio,
  Authorization: `Bearer ${config.claveServicio}`,
});

/** Lee todas las filas de una tabla vía PostgREST (máximo 1.000 por petición). Solo GET. */
export async function leerTabla(
  config: ConfigSupabase,
  tabla: TablaOrigen,
  fetchImpl: Fetch = fetch,
): Promise<unknown[]> {
  const filas: unknown[] = [];
  const orden = ORDEN[tabla] ?? "id";
  for (let desde = 0; ; desde += TAMANO_PAGINA) {
    const respuesta = await fetchImpl(`${config.url}/rest/v1/${tabla}?select=*&order=${orden}`, {
      headers: { ...cabeceras(config), Range: `${desde}-${desde + TAMANO_PAGINA - 1}` },
    });
    if (!respuesta.ok) throw new Error(`Lectura de ${tabla}: HTTP ${respuesta.status}.`);
    const pagina: unknown = await respuesta.json();
    if (!Array.isArray(pagina)) throw new Error(`Lectura de ${tabla}: la respuesta no es una lista.`);
    filas.push(...pagina);
    if (pagina.length < TAMANO_PAGINA) return filas;
  }
}

export async function descargarMedia(
  config: ConfigSupabase,
  clave: string,
  fetchImpl: Fetch = fetch,
): Promise<Uint8Array> {
  const ruta = clave.split("/").map(encodeURIComponent).join("/");
  const respuesta = await fetchImpl(
    `${config.url}/storage/v1/object/public/${BUCKET_MEDIA}/${ruta}`,
    { headers: cabeceras(config) },
  );
  if (!respuesta.ok) throw new Error(`Descarga de media "${clave}": HTTP ${respuesta.status}.`);
  return new Uint8Array(await respuesta.arrayBuffer());
}
```

- [ ] **Paso 5: Implementar la exportación y su CLI**

`tools/migracion-supabase/src/exportar.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "./hash";
import { escribirSnapshot } from "./snapshot/archivos";
import { clavesMedia } from "./snapshot/media";
import { type Manifiesto, TABLAS, type TablaOrigen, validarSnapshot } from "./snapshot/tipos";
import { type ConfigSupabase, descargarMedia, type Fetch, leerTabla } from "./supabase/cliente";

export interface OpcionesExportacion {
  config: ConfigSupabase;
  dir: string;
  fetchImpl?: Fetch;
  registrar?: (mensaje: string) => void;
}

/** Vuelca tablas y media referenciada a `dir`. Solo lectura sobre Supabase. */
export async function exportarSnapshot({
  config,
  dir,
  fetchImpl = fetch,
  registrar = console.log,
}: OpcionesExportacion): Promise<Manifiesto> {
  const crudo: Partial<Record<TablaOrigen, unknown>> = {};
  for (const tabla of TABLAS) {
    const filas = await leerTabla(config, tabla, fetchImpl);
    crudo[tabla] = filas;
    registrar(`${tabla}: ${filas.length} filas`);
  }
  const snapshot = validarSnapshot(crudo);

  const media: Manifiesto["media"] = {};
  for (const clave of [...clavesMedia(snapshot)].sort()) {
    const bytes = await descargarMedia(config, clave, fetchImpl);
    const destino = path.join(dir, "media", ...clave.split("/"));
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, bytes);
    media[clave] = { bytes: bytes.length, sha256: sha256(bytes) };
  }
  registrar(`media: ${Object.keys(media).length} ficheros`);

  const manifiesto: Manifiesto = {
    creadoEn: new Date().toISOString(),
    origen: new URL(config.url).host,
    filas: Object.fromEntries(TABLAS.map((tabla) => [tabla, snapshot[tabla].length])),
    media,
  };
  escribirSnapshot(dir, snapshot, manifiesto);
  return manifiesto;
}
```

`tools/migracion-supabase/src/cli/exportar.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_SNAPSHOTS, marcaFichero } from "@santiso/db";
import { exportarSnapshot } from "../exportar";
import { leerConfig } from "../supabase/cliente";

const rutaEnv = fileURLToPath(new URL("../../../../apps/studio/.env.local", import.meta.url));
const config = leerConfig(rutaEnv);
const dir = path.join(DIR_SNAPSHOTS, marcaFichero());

console.log(`Exportando desde ${new URL(config.url).host} a ${dir}`);
const manifiesto = await exportarSnapshot({ config, dir });
const filas = Object.values(manifiesto.filas).reduce((total, cantidad) => total + cantidad, 0);
console.log(
  `Snapshot listo: ${filas} filas y ${Object.keys(manifiesto.media).length} ficheros de media.`,
);
```

En `tools/migracion-supabase/package.json` añadir a `scripts`:

```json
"exportar": "tsx src/cli/exportar.ts"
```

En el `package.json` raíz añadir a `scripts`:

```json
"migracion:exportar": "pnpm --filter @santiso/migracion-supabase exportar"
```

- [ ] **Paso 6: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde (15 pruebas en el paquete).

> No ejecutar todavía `pnpm migracion:exportar` contra Supabase: la exportación real se hace en la Tarea 14.

- [ ] **Paso 7: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): exportación de tablas y media de Supabase en solo lectura" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 8: Transformación — tipos, ids, temporadas y competiciones

**Ficheros:**
- Crear: `tools/migracion-supabase/src/ids.ts`
- Crear: `tools/migracion-supabase/src/transformar/tipos.ts`, `tools/migracion-supabase/src/transformar/comunes.ts`
- Crear: `tools/migracion-supabase/src/transformar/temporadas.ts`, `tools/migracion-supabase/src/transformar/competiciones.ts`
- Test: `tools/migracion-supabase/src/ids.test.ts`, `tools/migracion-supabase/src/transformar/temporadas.test.ts`, `tools/migracion-supabase/src/transformar/competiciones.test.ts`

**Interfaces:**
- Consume: `Snapshot` y tipos de fila (Tarea 6); `normalizarNombreTemporada`, `normalizarCategoria`, `claveNombre`, `aInstanteIso`, `esValorDe`, `FORMATOS_COMPETICION`, `reglasClasificacionSchema` (`@santiso/domain`); tablas de `@santiso/db/schema` (solo tipos).
- Produce:
  - `idDeterminista(...partes: string[]): string`
  - Tipos `TemporadaNueva`, `CompeticionNueva`, `CompeticionAliasNuevo`, `EquipoNuevo`, `CompeticionEquipoNuevo`, `JugadorNuevo`, `StaffNuevo`, `CampoNuevo`, `JornadaNueva`, `JornadaDescansoNuevo`, `PartidoNuevo`, `ParticipacionNueva`, `EventoNuevo`, `PatrocinadorNuevo`, `AjusteNuevo`
  - `interface ModeloNuevo` (una propiedad por tabla, mismos nombres que las exportaciones del esquema)
  - `interface Informe`, `crearInforme(): Informe`, `class ErrorMigracion extends Error`
  - `marcasDesde(createdAt): { creadoEn?; actualizadoEn? }`, `textoOpcional(valor): string | null`
  - `transformarTemporadas(origen, informe): TemporadaNueva[]`
  - `transformarCompeticiones(origen, temporadas, informe): { competiciones: CompeticionNueva[]; competicionAlias: CompeticionAliasNuevo[] }`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/ids.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { idDeterminista } from "./ids";

describe("idDeterminista", () => {
  it("es estable, distingue entradas y tiene formato UUID v8", () => {
    const id = idDeterminista("equipo", "Veteranos", "s d cruces");
    expect(idDeterminista("equipo", "Veteranos", "s d cruces")).toBe(id);
    expect(idDeterminista("equipo", "Senior", "s d cruces")).not.toBe(id);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("no confunde partes concatenadas", () => {
    expect(idDeterminista("ab", "c")).not.toBe(idDeterminista("a", "bc"));
  });
});
```

`tools/migracion-supabase/src/transformar/temporadas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

describe("transformarTemporadas", () => {
  it("normaliza nombres, conserva ids y fechas, y avisa del cambio", () => {
    const origen = snapshotVacio();
    const antigua = fabricar.temporada({
      nombre: "25/26",
      activa: false,
      created_at: "2025-08-01T10:00:00.123456+00:00",
    });
    origen.temporadas.push(antigua, fabricar.temporada({ nombre: "2026/27", activa: true }));
    const informe = crearInforme();

    const temporadas = transformarTemporadas(origen, informe);

    expect(temporadas[0]).toEqual({
      id: antigua.id,
      nombre: "2025/26",
      activa: false,
      creadoEn: "2025-08-01T10:00:00.123Z",
      actualizadoEn: "2025-08-01T10:00:00.123Z",
    });
    expect(informe.avisos).toEqual(['Temporada "25/26" renombrada a "2025/26".']);
  });

  it("exige exactamente una temporada activa", () => {
    const sinActiva = snapshotVacio();
    sinActiva.temporadas.push(fabricar.temporada({ activa: false }));
    expect(() => transformarTemporadas(sinActiva, crearInforme())).toThrow(/exactamente una/);

    const dosActivas = snapshotVacio();
    dosActivas.temporadas.push(
      fabricar.temporada({ nombre: "2025/26" }),
      fabricar.temporada({ nombre: "2026/27" }),
    );
    expect(() => transformarTemporadas(dosActivas, crearInforme())).toThrow(/exactamente una/);
  });
});
```

`tools/migracion-supabase/src/transformar/competiciones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCompeticiones } from "./competiciones";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

function escenario() {
  const origen = snapshotVacio();
  const antigua = fabricar.temporada({ nombre: "2025/26", activa: false });
  const actual = fabricar.temporada({ nombre: "2026/27", activa: true });
  origen.temporadas.push(antigua, actual);
  return { origen, antigua, actual };
}

describe("transformarCompeticiones", () => {
  it("toma la temporada de sus jornadas y normaliza formato y reglas", () => {
    const { origen, antigua } = escenario();
    const competicion = fabricar.competicion({ activa: false, formato: null });
    origen.competiciones.push(competicion);
    origen.jornadas.push(
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: antigua.id }),
    );
    const reglas = [{ id: "r1", nombre: "Ascenso", puestos: [1], color: "#10b981" }];
    origen.reglas_liga.push(
      fabricar.reglas({ competicion_id: competicion.id, temporada_id: antigua.id, reglas }),
    );
    const informe = crearInforme();

    const { competiciones } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competiciones[0]).toMatchObject({
      id: competicion.id,
      temporadaId: antigua.id,
      categoria: "Senior",
      formato: "liga",
      reglasClasificacion: reglas,
    });
  });

  it("asigna competiciones sin jornadas: activa → temporada activa; inactiva → última inactiva", () => {
    const { origen, antigua, actual } = escenario();
    const vigente = fabricar.competicion({ activa: true, nombre: "Liga nueva" });
    const vieja = fabricar.competicion({ activa: false, nombre: "Copa vieja" });
    origen.competiciones.push(vigente, vieja);
    const informe = crearInforme();

    const { competiciones } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competiciones.find((c) => c.id === vigente.id)?.temporadaId).toBe(actual.id);
    expect(competiciones.find((c) => c.id === vieja.id)?.temporadaId).toBe(antigua.id);
    expect(informe.avisos).toContain(
      'Competición sin jornadas "Copa vieja" asignada a la temporada 2025/26.',
    );
  });

  it("se detiene si una competición abarca varias temporadas o sus reglas son de otra", () => {
    const { origen, antigua, actual } = escenario();
    const competicion = fabricar.competicion();
    origen.competiciones.push(competicion);
    origen.jornadas.push(
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: antigua.id, numero: 1 }),
      fabricar.jornada({ competicion_id: competicion.id, temporada_id: actual.id, numero: 2 }),
    );
    const informe = crearInforme();
    const temporadas = transformarTemporadas(origen, informe);
    expect(() => transformarCompeticiones(origen, temporadas, informe)).toThrow(/2 temporadas/);

    origen.jornadas.pop();
    origen.reglas_liga.push(
      fabricar.reglas({ competicion_id: competicion.id, temporada_id: actual.id }),
    );
    expect(() => transformarCompeticiones(origen, temporadas, informe)).toThrow(/otra temporada/);
  });

  it("deduplica alias por clave normalizada", () => {
    const { origen, actual } = escenario();
    const competicion = fabricar.competicion({ activa: true });
    origen.competiciones.push(competicion);
    origen.competicion_etiquetas.push(
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "División de Honor" }),
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "Division de Honor " }),
      fabricar.etiqueta({ competicion_id: competicion.id, etiqueta: "Liga principal" }),
    );
    const informe = crearInforme();

    const { competicionAlias } = transformarCompeticiones(
      origen,
      transformarTemporadas(origen, informe),
      informe,
    );

    expect(competicionAlias).toEqual([
      { competicionId: competicion.id, alias: "División de Honor", clave: "division de honor" },
      { competicionId: competicion.id, alias: "Liga principal", clave: "liga principal" },
    ]);
    expect(actual.activa).toBe(true);
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/ids.test.ts tools/migracion-supabase/src/transformar`
Esperado: FAIL por módulos inexistentes.

- [ ] **Paso 3: Implementar ids y tipos del modelo nuevo**

`tools/migracion-supabase/src/ids.ts`:

```ts
import { createHash } from "node:crypto";

/** UUID estable (formato v8, RFC 9562) derivado de las partes. Para filas que crea la migración. */
export function idDeterminista(...partes: string[]): string {
  const h = createHash("sha256").update(partes.join(" ")).digest("hex");
  const variante = ((Number.parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
```

`tools/migracion-supabase/src/transformar/tipos.ts`:

```ts
import type * as s from "@santiso/db/schema";
import type { Categoria } from "@santiso/domain";
import type { InferInsertModel } from "drizzle-orm";

/** Las filas migradas siempre llevan id explícito (conservado o determinista). */
type ConId<T> = T & { id: string };

export type TemporadaNueva = ConId<InferInsertModel<typeof s.temporadas>>;
export type CompeticionNueva = ConId<InferInsertModel<typeof s.competiciones>>;
export type CompeticionAliasNuevo = InferInsertModel<typeof s.competicionAlias>;
export type EquipoNuevo = ConId<InferInsertModel<typeof s.equipos>>;
export type CompeticionEquipoNuevo = InferInsertModel<typeof s.competicionEquipos>;
export type JugadorNuevo = ConId<InferInsertModel<typeof s.jugadores>>;
export type StaffNuevo = ConId<InferInsertModel<typeof s.staff>>;
export type CampoNuevo = ConId<InferInsertModel<typeof s.campos>>;
export type JornadaNueva = ConId<InferInsertModel<typeof s.jornadas>>;
export type JornadaDescansoNuevo = InferInsertModel<typeof s.jornadaDescansos>;
export type PartidoNuevo = ConId<InferInsertModel<typeof s.partidos>>;
export type ParticipacionNueva = InferInsertModel<typeof s.partidoParticipaciones>;
export type EventoNuevo = ConId<InferInsertModel<typeof s.partidoEventos>>;
export type PatrocinadorNuevo = ConId<InferInsertModel<typeof s.patrocinadores>>;
export type AjusteNuevo = InferInsertModel<typeof s.ajustes>;

/** Datos listos para insertar, con una propiedad por tabla del esquema nuevo. */
export interface ModeloNuevo {
  temporadas: TemporadaNueva[];
  competiciones: CompeticionNueva[];
  competicionAlias: CompeticionAliasNuevo[];
  equipos: EquipoNuevo[];
  competicionEquipos: CompeticionEquipoNuevo[];
  jugadores: JugadorNuevo[];
  staff: StaffNuevo[];
  campos: CampoNuevo[];
  jornadas: JornadaNueva[];
  jornadaDescansos: JornadaDescansoNuevo[];
  partidos: PartidoNuevo[];
  partidoParticipaciones: ParticipacionNueva[];
  partidoEventos: EventoNuevo[];
  patrocinadores: PatrocinadorNuevo[];
  ajustes: AjusteNuevo[];
}

export interface ClasificacionManualAntigua {
  equipoId: string;
  nombre: string;
  categoria: string;
  pts: number;
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
}

/** Correcciones aplicadas automáticamente y datos de referencia. Se vuelca al informe de migración. */
export interface Informe {
  avisos: string[];
  equiposFusionados: { conservado: string; eliminados: string[]; nombre: string; categoria: Categoria }[];
  equiposSeparados: {
    origen: string;
    nuevo: string;
    nombre: string;
    categoria: Categoria;
    competicion: string;
  }[];
  participacionesCreadas: number;
  clasificacionManualAntigua: ClasificacionManualAntigua[];
}

export const crearInforme = (): Informe => ({
  avisos: [],
  equiposFusionados: [],
  equiposSeparados: [],
  participacionesCreadas: 0,
  clasificacionManualAntigua: [],
});

/** Dato de origen que exige una decisión humana: la migración se detiene. */
export class ErrorMigracion extends Error {
  override name = "ErrorMigracion";
}
```

`tools/migracion-supabase/src/transformar/comunes.ts`:

```ts
import { aInstanteIso } from "@santiso/domain";

/** Conserva la fecha de creación de origen. Sin ella, la BD pone la fecha actual. */
export function marcasDesde(createdAt: string | null | undefined): {
  creadoEn?: string;
  actualizadoEn?: string;
} {
  if (!createdAt) return {};
  const instante = aInstanteIso(createdAt);
  return { creadoEn: instante, actualizadoEn: instante };
}

/** Texto recortado, o null si queda vacío. */
export const textoOpcional = (valor: string | null | undefined): string | null =>
  valor?.trim() || null;
```

- [ ] **Paso 4: Implementar temporadas y competiciones**

`tools/migracion-supabase/src/transformar/temporadas.ts`:

```ts
import { normalizarNombreTemporada } from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import { ErrorMigracion, type Informe, type TemporadaNueva } from "./tipos";

/** R1: nombres normalizados y exactamente una temporada activa. */
export function transformarTemporadas(origen: Snapshot, informe: Informe): TemporadaNueva[] {
  const temporadas = origen.temporadas.map((fila) => {
    const nombre = normalizarNombreTemporada(fila.nombre);
    if (nombre !== fila.nombre) {
      informe.avisos.push(`Temporada "${fila.nombre}" renombrada a "${nombre}".`);
    }
    return { id: fila.id, nombre, activa: fila.activa === true, ...marcasDesde(fila.created_at) };
  });
  const activas = temporadas.filter((temporada) => temporada.activa).length;
  if (activas !== 1) {
    throw new ErrorMigracion(`Debe haber exactamente una temporada activa y hay ${activas}.`);
  }
  return temporadas;
}
```

`tools/migracion-supabase/src/transformar/competiciones.ts`:

```ts
import {
  claveNombre,
  esValorDe,
  FORMATOS_COMPETICION,
  normalizarCategoria,
  reglasClasificacionSchema,
} from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import {
  type CompeticionAliasNuevo,
  type CompeticionNueva,
  ErrorMigracion,
  type Informe,
  type TemporadaNueva,
} from "./tipos";

/** R2–R4: temporada de cada competición, reglas validadas y alias deduplicados. */
export function transformarCompeticiones(
  origen: Snapshot,
  temporadas: TemporadaNueva[],
  informe: Informe,
): { competiciones: CompeticionNueva[]; competicionAlias: CompeticionAliasNuevo[] } {
  const activa = temporadas.find((temporada) => temporada.activa);
  const [ultimaInactiva] = temporadas
    .filter((temporada) => !temporada.activa)
    .sort((a, b) => b.nombre.localeCompare(a.nombre));

  const temporadasPorCompeticion = new Map<string, Set<string>>();
  for (const jornada of origen.jornadas) {
    const conjunto = temporadasPorCompeticion.get(jornada.competicion_id) ?? new Set<string>();
    conjunto.add(jornada.temporada_id);
    temporadasPorCompeticion.set(jornada.competicion_id, conjunto);
  }

  const competiciones = origen.competiciones.map((fila): CompeticionNueva => {
    const nombre = fila.nombre.trim();
    const deJornadas = [...(temporadasPorCompeticion.get(fila.id) ?? [])];
    if (deJornadas.length > 1) {
      throw new ErrorMigracion(
        `La competición "${nombre}" tiene jornadas en ${deJornadas.length} temporadas.`,
      );
    }

    let [temporadaId] = deJornadas;
    if (!temporadaId) {
      const destino = fila.activa ? activa : ultimaInactiva;
      if (!destino) {
        throw new ErrorMigracion(`No hay temporada para la competición sin jornadas "${nombre}".`);
      }
      temporadaId = destino.id;
      informe.avisos.push(
        `Competición sin jornadas "${nombre}" asignada a la temporada ${destino.nombre}.`,
      );
    }

    const filasReglas = origen.reglas_liga.filter((reglas) => reglas.competicion_id === fila.id);
    if (filasReglas.length > 1) {
      throw new ErrorMigracion(`La competición "${nombre}" tiene ${filasReglas.length} filas de reglas.`);
    }
    const [filaReglas] = filasReglas;
    if (filaReglas && filaReglas.temporada_id !== temporadaId) {
      throw new ErrorMigracion(`Las reglas de "${nombre}" pertenecen a otra temporada.`);
    }

    const formato = fila.formato ?? "liga";
    if (!esValorDe(FORMATOS_COMPETICION, formato)) {
      throw new ErrorMigracion(`La competición "${nombre}" tiene un formato desconocido: "${formato}".`);
    }

    return {
      id: fila.id,
      temporadaId,
      categoria: normalizarCategoria(fila.categoria),
      nombre,
      formato,
      orden: fila.orden,
      reglasClasificacion: filaReglas ? reglasClasificacionSchema.parse(filaReglas.reglas) : [],
      ...marcasDesde(fila.created_at),
    };
  });

  const vistos = new Set<string>();
  const competicionAlias: CompeticionAliasNuevo[] = [];
  for (const etiqueta of origen.competicion_etiquetas) {
    const clave = claveNombre(etiqueta.etiqueta);
    const clavePar = `${etiqueta.competicion_id}|${clave}`;
    if (!clave || vistos.has(clavePar)) continue;
    vistos.add(clavePar);
    competicionAlias.push({
      competicionId: etiqueta.competicion_id,
      alias: etiqueta.etiqueta.trim(),
      clave,
    });
  }

  return { competiciones, competicionAlias };
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

- [ ] **Paso 6: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): transformación de temporadas y competiciones con ids deterministas" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 9: Transformación de equipos (fusión, separación e inscripciones)

Casos reales que cubre (volcado del 13/09/2026):
- `U.D. Santiso F.C.` y `U.D. SANTISO F.C.`, ambos Senior, se fusionan.
- `S.D. Touro` y `S.D. TOURO`, ambos Senior, se fusionan.
- `S.D. CRUCES` (Senior) juega en «Veteranos 1ª Galicia - Gr. 2»: se separa en un equipo Veteranos.

**Ficheros:**
- Crear: `tools/migracion-supabase/src/transformar/equipos.ts`
- Test: `tools/migracion-supabase/src/transformar/equipos.test.ts`

**Interfaces:**
- Consume: `CompeticionNueva[]` (Tarea 8); `claveMediaDesdeUrl` (Tarea 7); `idDeterminista`, `marcasDesde`, `ErrorMigracion`, `Informe` (Tarea 8); `claveNombre`, `esEquipoPropio`, `normalizarCategoria`, `aInstanteIso`, `Categoria` (`@santiso/domain`).
- Produce:
  - `interface ResultadoEquipos { equipos: EquipoNuevo[]; competicionEquipos: CompeticionEquipoNuevo[]; resolver(equipoIdOrigen: string, competicionId: string): string }`
  - `transformarEquipos(origen: Snapshot, competiciones: CompeticionNueva[], informe: Informe): ResultadoEquipos`
  - `resolver` solo admite referencias que existen en el origen (inscripciones, partidos y descansos); cualquier otra lanza `ErrorMigracion`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/transformar/equipos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { idDeterminista } from "../ids";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

function preparar(configurar: (ctx: ReturnType<typeof base>) => void) {
  const ctx = base();
  configurar(ctx);
  const informe = crearInforme();
  const temporadas = transformarTemporadas(ctx.origen, informe);
  const { competiciones } = transformarCompeticiones(ctx.origen, temporadas, informe);
  return { ...ctx, informe, resultado: transformarEquipos(ctx.origen, competiciones, informe) };
}

function base() {
  const origen = snapshotVacio();
  const temporada = fabricar.temporada();
  const senior = fabricar.competicion({ categoria: "Senior", nombre: "Tercera" });
  const veteranos = fabricar.competicion({ categoria: "Veteranos", nombre: "Veteranos 1ª" });
  origen.temporadas.push(temporada);
  origen.competiciones.push(senior, veteranos);
  const jornadaSenior = fabricar.jornada({ temporada_id: temporada.id, competicion_id: senior.id });
  const jornadaVeteranos = fabricar.jornada({
    temporada_id: temporada.id,
    competicion_id: veteranos.id,
  });
  origen.jornadas.push(jornadaSenior, jornadaVeteranos);
  return { origen, senior, veteranos, jornadaSenior, jornadaVeteranos };
}

describe("transformarEquipos", () => {
  it("fusiona duplicados por categoría y clave: conserva el más antiguo con el primer escudo", () => {
    const antiguo = fabricar.equipo({
      nombre: "U.D. Santiso F.C.",
      created_at: "2026-04-17T10:00:00+00:00",
    });
    const nuevo = fabricar.equipo({
      nombre: "U.D. SANTISO F.C.",
      escudo_url: `${BASE}escudos/santiso.webp`,
      created_at: "2026-09-12T10:00:00+00:00",
    });
    const rival = fabricar.equipo({ nombre: "C.D. Berres" });

    const { resultado, informe, senior, jornadaSenior } = preparar(({ origen, senior, jornadaSenior }) => {
      origen.equipos.push(nuevo, antiguo, rival);
      origen.equipo_competiciones.push(
        fabricar.equipoCompeticion({ equipo_id: nuevo.id, competicion_id: senior.id }),
        fabricar.equipoCompeticion({ equipo_id: antiguo.id, competicion_id: senior.id }),
        fabricar.equipoCompeticion({ equipo_id: rival.id, competicion_id: senior.id }),
      );
      origen.partidos_liga.push(
        fabricar.partido({
          jornada_id: jornadaSenior.id,
          competicion_id: senior.id,
          equipo_local_id: nuevo.id,
          equipo_visitante_id: rival.id,
        }),
      );
    });

    expect(resultado.equipos).toHaveLength(2);
    expect(resultado.equipos.find((e) => e.id === antiguo.id)).toMatchObject({
      nombre: "U.D. Santiso F.C.",
      clave: "u d santiso f c",
      esPropio: true,
      escudo: "escudos/santiso.webp",
    });
    expect(resultado.resolver(nuevo.id, senior.id)).toBe(antiguo.id);
    expect(resultado.competicionEquipos).toHaveLength(2);
    expect(informe.equiposFusionados).toEqual([
      { conservado: antiguo.id, eliminados: [nuevo.id], nombre: "U.D. Santiso F.C.", categoria: "Senior" },
    ]);
    expect(jornadaSenior.competicion_id).toBe(senior.id);
  });

  it("no fusiona la misma clave en categorías distintas", () => {
    const { resultado } = preparar(({ origen }) => {
      origen.equipos.push(
        fabricar.equipo({ nombre: "S.D. Touro", categoria: "Senior" }),
        fabricar.equipo({ nombre: "S.D. Touro", categoria: "Veteranos" }),
      );
    });
    expect(resultado.equipos).toHaveLength(2);
  });

  it("separa un equipo usado en una competición de otra categoría", () => {
    const cruces = fabricar.equipo({ nombre: "S.D. CRUCES", categoria: "Senior" });
    const solaina = fabricar.equipo({ nombre: "U.D. Santiso F.C. Solaina", categoria: "Veteranos" });

    const { resultado, informe, senior, veteranos } = preparar(
      ({ origen, senior, veteranos, jornadaSenior, jornadaVeteranos }) => {
        const rivalSenior = fabricar.equipo({ nombre: "C.D. Berres" });
        origen.equipos.push(cruces, solaina, rivalSenior);
        origen.equipo_competiciones.push(
          fabricar.equipoCompeticion({ equipo_id: cruces.id, competicion_id: senior.id }),
          fabricar.equipoCompeticion({ equipo_id: cruces.id, competicion_id: veteranos.id }),
          fabricar.equipoCompeticion({ equipo_id: solaina.id, competicion_id: veteranos.id }),
          fabricar.equipoCompeticion({ equipo_id: rivalSenior.id, competicion_id: senior.id }),
        );
        origen.partidos_liga.push(
          fabricar.partido({
            jornada_id: jornadaVeteranos.id,
            competicion_id: veteranos.id,
            equipo_local_id: cruces.id,
            equipo_visitante_id: solaina.id,
          }),
          fabricar.partido({
            jornada_id: jornadaSenior.id,
            competicion_id: senior.id,
            equipo_local_id: cruces.id,
            equipo_visitante_id: rivalSenior.id,
          }),
        );
      },
    );

    const idVeteranos = idDeterminista("equipo", "Veteranos", "s d cruces");
    expect(resultado.resolver(cruces.id, senior.id)).toBe(cruces.id);
    expect(resultado.resolver(cruces.id, veteranos.id)).toBe(idVeteranos);
    expect(resultado.equipos.find((e) => e.id === idVeteranos)).toMatchObject({
      nombre: "S.D. CRUCES",
      categoria: "Veteranos",
    });
    expect(resultado.competicionEquipos).toContainEqual({
      competicionId: veteranos.id,
      equipoId: idVeteranos,
    });
    expect(resultado.competicionEquipos).not.toContainEqual({
      competicionId: veteranos.id,
      equipoId: cruces.id,
    });
    expect(informe.equiposSeparados).toEqual([
      {
        origen: cruces.id,
        nuevo: idVeteranos,
        nombre: "S.D. CRUCES",
        categoria: "Veteranos",
        competicion: "Veteranos 1ª",
      },
    ]);
  });

  it("reutiliza el equipo homónimo que ya existe en la categoría destino", () => {
    const crucesSenior = fabricar.equipo({ nombre: "S.D. Cruces", categoria: "Senior" });
    const crucesVeteranos = fabricar.equipo({ nombre: "S.D. CRUCES", categoria: "Veteranos" });
    const { resultado, informe, veteranos } = preparar(({ origen, veteranos }) => {
      origen.equipos.push(crucesSenior, crucesVeteranos);
      origen.equipo_competiciones.push(
        fabricar.equipoCompeticion({ equipo_id: crucesSenior.id, competicion_id: veteranos.id }),
      );
    });
    expect(resultado.resolver(crucesSenior.id, veteranos.id)).toBe(crucesVeteranos.id);
    expect(informe.equiposSeparados).toEqual([]);
  });

  it("inscribe equipos que juegan sin estar inscritos y guarda la clasificación manual antigua", () => {
    const local = fabricar.equipo({ nombre: "Local", pts: 30, pj: 12, pg: 9, pe: 3, gf: 25, gc: 10 });
    const visitante = fabricar.equipo({ nombre: "Visitante" });
    const { resultado, informe, senior } = preparar(({ origen, senior, jornadaSenior }) => {
      origen.equipos.push(local, visitante);
      origen.partidos_liga.push(
        fabricar.partido({
          jornada_id: jornadaSenior.id,
          competicion_id: senior.id,
          equipo_local_id: local.id,
          equipo_visitante_id: visitante.id,
        }),
      );
    });
    expect(resultado.competicionEquipos).toEqual([
      { competicionId: senior.id, equipoId: local.id },
      { competicionId: senior.id, equipoId: visitante.id },
    ]);
    expect(informe.avisos.filter((a) => a.includes("inscrito"))).toHaveLength(2);
    expect(informe.clasificacionManualAntigua).toEqual([
      {
        equipoId: local.id,
        nombre: "Local",
        categoria: "Senior",
        pts: 30,
        pj: 12,
        pg: 9,
        pe: 3,
        pp: 0,
        gf: 25,
        gc: 10,
      },
    ]);
  });

  it("se detiene ante referencias rotas o equipos sin categoría", () => {
    expect(() =>
      preparar(({ origen, senior }) => {
        origen.equipo_competiciones.push(
          fabricar.equipoCompeticion({ equipo_id: "no-existe", competicion_id: senior.id }),
        );
      }),
    ).toThrow(/equipo inexistente/);

    expect(() =>
      preparar(({ origen }) => {
        origen.equipos.push(fabricar.equipo({ nombre: "Sin categoría", categoria: null }));
      }),
    ).toThrow(/no tiene categoría/);
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/transformar/equipos.test.ts`
Esperado: FAIL; no se puede resolver `./equipos`.

- [ ] **Paso 3: Implementar**

`tools/migracion-supabase/src/transformar/equipos.ts`:

```ts
import {
  aInstanteIso,
  type Categoria,
  claveNombre,
  esEquipoPropio,
  normalizarCategoria,
} from "@santiso/domain";
import { idDeterminista } from "../ids";
import { claveMediaDesdeUrl } from "../snapshot/media";
import type { FilaEquipo, Snapshot } from "../snapshot/tipos";
import { marcasDesde } from "./comunes";
import {
  type CompeticionEquipoNuevo,
  type CompeticionNueva,
  type EquipoNuevo,
  ErrorMigracion,
  type Informe,
} from "./tipos";

export interface ResultadoEquipos {
  equipos: EquipoNuevo[];
  competicionEquipos: CompeticionEquipoNuevo[];
  /** Id definitivo de un equipo de origen dentro de una competición (tras fusiones y separaciones). */
  resolver: (equipoIdOrigen: string, competicionId: string) => string;
}

/** R5–R7 y R17. */
export function transformarEquipos(
  origen: Snapshot,
  competiciones: CompeticionNueva[],
  informe: Informe,
): ResultadoEquipos {
  const competicionPorId = new Map(competiciones.map((competicion) => [competicion.id, competicion]));
  const competicionDeJornada = new Map(
    origen.jornadas.map((jornada) => [jornada.id, jornada.competicion_id]),
  );

  // R5 — Agrupar por categoría + clave y conservar el más antiguo.
  const grupos = new Map<string, { categoria: Categoria; filas: FilaEquipo[] }>();
  for (const fila of origen.equipos) {
    if (!fila.categoria) {
      throw new ErrorMigracion(`El equipo "${fila.nombre}" (${fila.id}) no tiene categoría.`);
    }
    const categoria = normalizarCategoria(fila.categoria);
    const clave = `${categoria}|${claveNombre(fila.nombre)}`;
    const grupo = grupos.get(clave) ?? { categoria, filas: [] };
    grupo.filas.push(fila);
    grupos.set(clave, grupo);
  }

  const equipos = new Map<string, EquipoNuevo>();
  const idPorCategoriaClave = new Map<string, string>();
  const idConservado = new Map<string, string>();

  for (const [claveGrupo, { categoria, filas }] of grupos) {
    const ordenadas = [...filas].sort((a, b) =>
      aInstanteIso(a.created_at).localeCompare(aInstanteIso(b.created_at)),
    );
    const [conservada, ...resto] = ordenadas;
    if (!conservada) continue;
    const nombre = conservada.nombre.trim();
    const equipo: EquipoNuevo = {
      id: conservada.id,
      nombre,
      clave: claveNombre(nombre),
      categoria,
      esPropio: esEquipoPropio(nombre),
      escudo:
        ordenadas.map((fila) => claveMediaDesdeUrl(fila.escudo_url)).find((c) => c !== null) ?? null,
      ...marcasDesde(conservada.created_at),
    };
    equipos.set(equipo.id, equipo);
    idPorCategoriaClave.set(claveGrupo, equipo.id);
    for (const fila of ordenadas) idConservado.set(fila.id, equipo.id);
    if (resto.length > 0) {
      informe.equiposFusionados.push({
        conservado: equipo.id,
        eliminados: resto.map((fila) => fila.id),
        nombre,
        categoria,
      });
    }
  }

  // R6 — Materializar el equipo definitivo de cada referencia (equipo de origen, competición).
  const destino = new Map<string, string>();
  const materializar = (equipoIdOrigen: string, competicionId: string) => {
    const clave = `${equipoIdOrigen}|${competicionId}`;
    if (destino.has(clave)) return;
    const base = equipos.get(idConservado.get(equipoIdOrigen) ?? "");
    if (!base) throw new ErrorMigracion(`Referencia a un equipo inexistente: ${equipoIdOrigen}.`);
    const competicion = competicionPorId.get(competicionId);
    if (!competicion) {
      throw new ErrorMigracion(`Referencia a una competición inexistente: ${competicionId}.`);
    }
    if (base.categoria === competicion.categoria) {
      destino.set(clave, base.id);
      return;
    }
    const claveDestino = `${competicion.categoria}|${base.clave}`;
    let id = idPorCategoriaClave.get(claveDestino);
    if (!id) {
      id = idDeterminista("equipo", competicion.categoria, base.clave);
      equipos.set(id, {
        id,
        nombre: base.nombre,
        clave: base.clave,
        categoria: competicion.categoria,
        esPropio: base.esPropio,
        escudo: base.escudo ?? null,
      });
      idPorCategoriaClave.set(claveDestino, id);
      informe.equiposSeparados.push({
        origen: base.id,
        nuevo: id,
        nombre: base.nombre,
        categoria: competicion.categoria,
        competicion: competicion.nombre,
      });
    }
    destino.set(clave, id);
  };

  const competicionDe = (jornadaId: string) => {
    const id = competicionDeJornada.get(jornadaId);
    if (!id) throw new ErrorMigracion(`Referencia a una jornada inexistente: ${jornadaId}.`);
    return id;
  };

  for (const relacion of origen.equipo_competiciones) {
    materializar(relacion.equipo_id, relacion.competicion_id);
  }
  for (const partido of origen.partidos_liga) {
    const competicionId = competicionDe(partido.jornada_id);
    materializar(partido.equipo_local_id, competicionId);
    materializar(partido.equipo_visitante_id, competicionId);
  }
  for (const descanso of origen.jornada_equipo_descanso) {
    materializar(descanso.equipo_id, competicionDe(descanso.jornada_id));
  }

  const resolver = (equipoIdOrigen: string, competicionId: string) => {
    const id = destino.get(`${equipoIdOrigen}|${competicionId}`);
    if (!id) {
      throw new ErrorMigracion(
        `El equipo ${equipoIdOrigen} no tiene referencias en la competición ${competicionId}.`,
      );
    }
    return id;
  };

  // R7 — Inscripciones, incluidas las de equipos que juegan sin estar inscritos.
  const relaciones = new Map<string, CompeticionEquipoNuevo>();
  const inscribir = (competicionId: string, equipoId: string, desdePartido: boolean) => {
    const clave = `${competicionId}|${equipoId}`;
    if (relaciones.has(clave)) return;
    if (desdePartido) {
      const equipo = equipos.get(equipoId)?.nombre ?? equipoId;
      const competicion = competicionPorId.get(competicionId)?.nombre ?? competicionId;
      informe.avisos.push(`Equipo "${equipo}" inscrito en "${competicion}" porque juega en ella.`);
    }
    relaciones.set(clave, { competicionId, equipoId });
  };
  for (const relacion of origen.equipo_competiciones) {
    inscribir(relacion.competicion_id, resolver(relacion.equipo_id, relacion.competicion_id), false);
  }
  for (const partido of origen.partidos_liga) {
    const competicionId = competicionDe(partido.jornada_id);
    inscribir(competicionId, resolver(partido.equipo_local_id, competicionId), true);
    inscribir(competicionId, resolver(partido.equipo_visitante_id, competicionId), true);
  }

  // R17 — Clasificación manual antigua, solo como referencia.
  for (const fila of origen.equipos) {
    const valores = {
      pts: fila.pts ?? 0,
      pj: fila.pj ?? 0,
      pg: fila.pg ?? 0,
      pe: fila.pe ?? 0,
      pp: fila.pp ?? 0,
      gf: fila.gf ?? 0,
      gc: fila.gc ?? 0,
    };
    if (Object.values(valores).some((valor) => valor !== 0)) {
      informe.clasificacionManualAntigua.push({
        equipoId: idConservado.get(fila.id) ?? fila.id,
        nombre: fila.nombre,
        categoria: fila.categoria ?? "",
        ...valores,
      });
    }
  }

  return {
    equipos: [...equipos.values()],
    competicionEquipos: [...relaciones.values()],
    resolver,
  };
}
```

- [ ] **Paso 4: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

- [ ] **Paso 5: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): fusión y separación de equipos con remapeo de referencias" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 10: Transformación del calendario (campos, jornadas, descansos, partidos)

**Ficheros:**
- Crear: `tools/migracion-supabase/src/transformar/calendario.ts`
- Test: `tools/migracion-supabase/src/transformar/calendario.test.ts`

**Interfaces:**
- Consume: `CompeticionNueva[]`, `ResultadoEquipos` (tareas 8–9); `aFechaHoraLiteral`, `aFechaLiteral`, `claveNombre`, `esValorDe`, `ESTADOS_PARTIDO`, `normalizarCategoria` (`@santiso/domain`); `marcasDesde`, `textoOpcional`.
- Produce: `transformarCalendario(origen, competiciones, equipos, informe): { campos: CampoNuevo[]; jornadas: JornadaNueva[]; jornadaDescansos: JornadaDescansoNuevo[]; partidos: PartidoNuevo[] }`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/transformar/calendario.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FilaPartido } from "../snapshot/tipos";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarCalendario } from "./calendario";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarTemporadas } from "./temporadas";
import { crearInforme } from "./tipos";

function crearContexto() {
  const origen = snapshotVacio();
  const temporada = fabricar.temporada();
  const competicion = fabricar.competicion({ nombre: "Tercera" });
  const local = fabricar.equipo({ nombre: "Local" });
  const visitante = fabricar.equipo({ nombre: "Visitante" });
  const campo = fabricar.campo({ nombre: " A Gándara ", poblacion: "" });
  const jornada = fabricar.jornada({
    temporada_id: temporada.id,
    competicion_id: competicion.id,
    numero: 1,
    fecha_inicio: "2026-09-27T00:00:00+00:00",
    fecha_fin: "2026-09-28",
    nombre_fase: " ",
  });
  origen.temporadas.push(temporada);
  origen.competiciones.push(competicion);
  origen.equipos.push(local, visitante);
  origen.campos_futbol.push(campo);
  origen.jornadas.push(jornada);
  const partido = (parcial: Partial<FilaPartido> = {}) =>
    fabricar.partido({
      jornada_id: jornada.id,
      competicion_id: competicion.id,
      equipo_local_id: local.id,
      equipo_visitante_id: visitante.id,
      ...parcial,
    });
  return { origen, temporada, competicion, local, visitante, campo, jornada, partido };
}

function preparar(configurar: (ctx: ReturnType<typeof crearContexto>) => void = () => {}) {
  const ctx = crearContexto();
  configurar(ctx);
  const informe = crearInforme();
  const temporadas = transformarTemporadas(ctx.origen, informe);
  const { competiciones } = transformarCompeticiones(ctx.origen, temporadas, informe);
  const equipos = transformarEquipos(ctx.origen, competiciones, informe);
  return {
    ...ctx,
    informe,
    resultado: transformarCalendario(ctx.origen, competiciones, equipos, informe),
  };
}

describe("transformarCalendario", () => {
  it("normaliza campos y jornadas", () => {
    const { resultado, campo, competicion } = preparar();
    expect(resultado.campos[0]).toMatchObject({
      id: campo.id,
      nombre: "A Gándara",
      clave: "a gandara",
      poblacion: null,
    });
    expect(resultado.jornadas[0]).toMatchObject({
      competicionId: competicion.id,
      numero: 1,
      nombreFase: null,
      fechaInicio: "2026-09-27",
      fechaFin: "2026-09-28",
    });
  });

  it("conserva marcador y fecha literal de un partido finalizado", () => {
    const { resultado, jornada, local, visitante, campo } = preparar(({ origen, partido, campo }) => {
      origen.partidos_liga.push(
        partido({
          estado: "finalizado",
          goles_local: 2,
          goles_visitante: 1,
          fecha: "2026-09-27T17:00:00+00:00",
          campo_id: campo.id,
        }),
      );
    });
    expect(resultado.partidos[0]).toMatchObject({
      jornadaId: jornada.id,
      equipoLocalId: local.id,
      equipoVisitanteId: visitante.id,
      golesLocal: 2,
      golesVisitante: 1,
      estado: "finalizado",
      fecha: "2026-09-27T17:00",
      campoId: campo.id,
    });
  });

  it("quita el 0-0 por defecto a los partidos sin disputar y lo avisa", () => {
    const { resultado, informe } = preparar(({ origen, partido, local, visitante }) => {
      const tercero = fabricar.equipo({ nombre: "Tercero" });
      origen.equipos.push(tercero);
      origen.partidos_liga.push(
        partido({ estado: "programado", goles_local: 0, goles_visitante: 0 }),
        partido({ estado: "cancelado", equipo_local_id: tercero.id, equipo_visitante_id: local.id }),
      );
      expect(visitante.id).toBeTruthy();
    });
    expect(resultado.partidos.map((p) => [p.golesLocal, p.golesVisitante])).toEqual([
      [null, null],
      [null, null],
    ]);
    expect(informe.avisos).toContain(
      "Partidos sin disputar con marcador 0-0 por defecto: 1. Ahora quedan sin marcador.",
    );
  });

  it("se detiene ante marcadores o estados incoherentes", () => {
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ estado: "programado", goles_local: 2, goles_visitante: 1 })),
      ),
    ).toThrow(/"programado" pero tiene marcador 2-1/);
    expect(() =>
      preparar(({ origen, partido }) => origen.partidos_liga.push(partido({ estado: "finalizado" }))),
    ).toThrow(/no tiene marcador/);
    expect(() =>
      preparar(({ origen, partido }) => origen.partidos_liga.push(partido({ estado: "suspendido" }))),
    ).toThrow(/estado desconocido/);
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ estado: "en_juego", goles_local: 1 })),
      ),
    ).toThrow(/marcador incompleto/);
  });

  it("exige que el partido pertenezca a la competición de su jornada", () => {
    expect(() =>
      preparar(({ origen, partido }) =>
        origen.partidos_liga.push(partido({ competicion_id: "otra-competicion" })),
      ),
    ).toThrow(/distinta a la de su jornada/);
  });

  it("detecta jornadas repetidas, categorías distintas y campos duplicados", () => {
    expect(() =>
      preparar(({ origen, temporada, competicion }) =>
        origen.jornadas.push(
          fabricar.jornada({ temporada_id: temporada.id, competicion_id: competicion.id, numero: 1 }),
        ),
      ),
    ).toThrow(/repetida/);
    expect(() =>
      preparar(({ origen, temporada, competicion }) =>
        origen.jornadas.push(
          fabricar.jornada({
            temporada_id: temporada.id,
            competicion_id: competicion.id,
            numero: 2,
            categoria: "Veteranos",
          }),
        ),
      ),
    ).toThrow(/otra categoría/);
    expect(() =>
      preparar(({ origen }) => origen.campos_futbol.push(fabricar.campo({ nombre: "a gandara" }))),
    ).toThrow(/Campos duplicados/);
  });

  it("deduplica descansos y resuelve el equipo", () => {
    const { resultado, jornada, local } = preparar(({ origen, jornada, local }) => {
      origen.jornada_equipo_descanso.push(
        fabricar.descanso({ jornada_id: jornada.id, equipo_id: local.id }),
        fabricar.descanso({ jornada_id: jornada.id, equipo_id: local.id }),
      );
    });
    expect(resultado.jornadaDescansos).toEqual([{ jornadaId: jornada.id, equipoId: local.id }]);
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/transformar/calendario.test.ts`
Esperado: FAIL; no se puede resolver `./calendario`.

- [ ] **Paso 3: Implementar**

`tools/migracion-supabase/src/transformar/calendario.ts`:

```ts
import {
  aFechaHoraLiteral,
  aFechaLiteral,
  claveNombre,
  ESTADOS_PARTIDO,
  esValorDe,
  normalizarCategoria,
} from "@santiso/domain";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import type { ResultadoEquipos } from "./equipos";
import {
  type CampoNuevo,
  type CompeticionNueva,
  ErrorMigracion,
  type Informe,
  type JornadaDescansoNuevo,
  type JornadaNueva,
  type PartidoNuevo,
} from "./tipos";

/** R8–R9: campos, jornadas, descansos y partidos. */
export function transformarCalendario(
  origen: Snapshot,
  competiciones: CompeticionNueva[],
  equipos: ResultadoEquipos,
  informe: Informe,
) {
  const competicionPorId = new Map(competiciones.map((competicion) => [competicion.id, competicion]));

  const campos = origen.campos_futbol.map((fila): CampoNuevo => {
    const nombre = fila.nombre.trim();
    return {
      id: fila.id,
      nombre,
      clave: claveNombre(nombre),
      poblacion: textoOpcional(fila.poblacion),
      ...marcasDesde(fila.created_at),
    };
  });
  const duplicados = campos.filter(
    (campo, indice) => campos.findIndex((otro) => otro.clave === campo.clave) !== indice,
  );
  if (duplicados.length > 0) {
    throw new ErrorMigracion(`Campos duplicados: ${duplicados.map((c) => c.nombre).join(", ")}.`);
  }

  const jornadas = origen.jornadas.map((fila): JornadaNueva => {
    const competicion = competicionPorId.get(fila.competicion_id);
    if (!competicion) {
      throw new ErrorMigracion(`La jornada ${fila.id} apunta a una competición inexistente.`);
    }
    if (normalizarCategoria(fila.categoria) !== competicion.categoria) {
      throw new ErrorMigracion(
        `La jornada ${fila.numero} de "${competicion.nombre}" tiene otra categoría (${fila.categoria}).`,
      );
    }
    return {
      id: fila.id,
      competicionId: competicion.id,
      numero: fila.numero,
      nombreFase: textoOpcional(fila.nombre_fase),
      fechaInicio: fila.fecha_inicio ? aFechaLiteral(fila.fecha_inicio) : null,
      fechaFin: fila.fecha_fin ? aFechaLiteral(fila.fecha_fin) : null,
      ...marcasDesde(fila.created_at),
    };
  });
  const numeros = new Set<string>();
  for (const jornada of jornadas) {
    const clave = `${jornada.competicionId}|${jornada.numero}`;
    if (numeros.has(clave)) {
      throw new ErrorMigracion(
        `Jornada ${jornada.numero} repetida en la competición ${jornada.competicionId}.`,
      );
    }
    numeros.add(clave);
  }

  const jornadaPorId = new Map(jornadas.map((jornada) => [jornada.id, jornada]));
  const jornadaDe = (id: string) => {
    const jornada = jornadaPorId.get(id);
    if (!jornada) throw new ErrorMigracion(`Referencia a una jornada inexistente: ${id}.`);
    return jornada;
  };

  const descansos = new Map<string, JornadaDescansoNuevo>();
  for (const fila of origen.jornada_equipo_descanso) {
    const jornada = jornadaDe(fila.jornada_id);
    const equipoId = equipos.resolver(fila.equipo_id, jornada.competicionId);
    descansos.set(`${jornada.id}|${equipoId}`, { jornadaId: jornada.id, equipoId });
  }

  let sinDisputarConCeros = 0;
  const partidos = origen.partidos_liga.map((fila): PartidoNuevo => {
    const jornada = jornadaDe(fila.jornada_id);
    if (fila.competicion_id !== jornada.competicionId) {
      throw new ErrorMigracion(
        `El partido ${fila.id} tiene una competición distinta a la de su jornada.`,
      );
    }
    const estado = fila.estado;
    if (!esValorDe(ESTADOS_PARTIDO, estado)) {
      throw new ErrorMigracion(`El partido ${fila.id} tiene un estado desconocido: "${estado}".`);
    }
    if ((fila.goles_local === null) !== (fila.goles_visitante === null)) {
      throw new ErrorMigracion(`El partido ${fila.id} tiene un marcador incompleto.`);
    }

    let golesLocal = fila.goles_local;
    let golesVisitante = fila.goles_visitante;
    const disputado = estado === "finalizado" || estado === "en_juego";
    if (estado === "finalizado" && golesLocal === null) {
      throw new ErrorMigracion(`El partido finalizado ${fila.id} no tiene marcador.`);
    }
    if (!disputado && golesLocal !== null) {
      if (golesLocal !== 0 || golesVisitante !== 0) {
        throw new ErrorMigracion(
          `El partido ${fila.id} está "${estado}" pero tiene marcador ${golesLocal}-${golesVisitante}.`,
        );
      }
      golesLocal = null;
      golesVisitante = null;
      sinDisputarConCeros++;
    }

    return {
      id: fila.id,
      jornadaId: jornada.id,
      equipoLocalId: equipos.resolver(fila.equipo_local_id, jornada.competicionId),
      equipoVisitanteId: equipos.resolver(fila.equipo_visitante_id, jornada.competicionId),
      golesLocal,
      golesVisitante,
      estado,
      fecha: fila.fecha ? aFechaHoraLiteral(fila.fecha) : null,
      campoId: fila.campo_id,
      ...marcasDesde(fila.created_at),
    };
  });
  if (sinDisputarConCeros > 0) {
    informe.avisos.push(
      `Partidos sin disputar con marcador 0-0 por defecto: ${sinDisputarConCeros}. Ahora quedan sin marcador.`,
    );
  }

  return { campos, jornadas, jornadaDescansos: [...descansos.values()], partidos };
}
```

- [ ] **Paso 4: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

- [ ] **Paso 5: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): transformación de campos, jornadas, descansos y partidos" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 11: Transformación de plantilla y actas (jugadores, staff, participaciones, eventos)

**Ficheros:**
- Crear: `tools/migracion-supabase/src/transformar/plantilla.ts`, `tools/migracion-supabase/src/transformar/actas.ts`
- Test: `tools/migracion-supabase/src/transformar/plantilla.test.ts`, `tools/migracion-supabase/src/transformar/actas.test.ts`

**Interfaces:**
- Consume: `Snapshot`, `FilaEvento`, fábricas (Tarea 6); `claveMediaDesdeUrl` (Tarea 7); `marcasDesde`, `textoOpcional`, `ErrorMigracion`, `Informe` (Tarea 8); `aFechaLiteral`, `claveNombre`, `esValorDe`, `normalizarCategoria`, `POSICIONES`, `Posicion`, `TIPOS_STAFF`, `Categoria`, `MINUTO_MAXIMO` (`@santiso/domain`).
- Produce:
  - `transformarPlantilla(origen, informe): { jugadores: JugadorNuevo[]; staff: StaffNuevo[] }`
  - `mapearEvento(fila: FilaEvento): EventoNuevo`
  - `transformarActas(origen, informe): { partidoParticipaciones: ParticipacionNueva[]; partidoEventos: EventoNuevo[] }`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/transformar/plantilla.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarPlantilla } from "./plantilla";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("transformarPlantilla — jugadores", () => {
  it("normaliza textos, capitanía, foto, fecha y listas", () => {
    const origen = snapshotVacio();
    origen.jugadores.push(
      fabricar.jugador({
        nombre: " Iván Pérez ",
        apodo: "",
        dorsal: 9,
        posicion: "DC",
        posiciones_conocidas: ["DC", "MCO"],
        capitan: 0,
        foto_url: `${BASE}jugadores/ivan.webp`,
        fecha_nacimiento: "1995-02-12",
        historial_deportivo: null,
        compromiso: 3,
      }),
      fabricar.jugador({ nombre: "Capitán", capitan: 2 }),
    );

    const { jugadores } = transformarPlantilla(origen, crearInforme());

    expect(jugadores[0]).toMatchObject({
      nombre: "Iván Pérez",
      apodo: null,
      dorsal: 9,
      posicion: "DC",
      posicionesConocidas: ["DC", "MCO"],
      capitania: null,
      categoria: "Senior",
      foto: "jugadores/ivan.webp",
      fechaNacimiento: "1995-02-12",
      historial: [],
      compromiso: 3,
    });
    expect(jugadores[1]?.capitania).toBe(2);
  });

  it("rechaza posiciones desconocidas y jugadores sin categoría", () => {
    const conPosicion = snapshotVacio();
    conPosicion.jugadores.push(fabricar.jugador({ posicion: "LIBERO" }));
    expect(() => transformarPlantilla(conPosicion, crearInforme())).toThrow(/Posición desconocida/);

    const sinCategoria = snapshotVacio();
    sinCategoria.jugadores.push(fabricar.jugador({ categoria: null }));
    expect(() => transformarPlantilla(sinCategoria, crearInforme())).toThrow(/no tiene categoría/);
  });
});

describe("transformarPlantilla — staff", () => {
  it("normaliza el tipo, descarta la categoría de la directiva y ordena por antigüedad", () => {
    const origen = snapshotVacio();
    const segundo = fabricar.staff({ nombre: "Segundo", created_at: "2026-01-02T00:00:00+00:00" });
    const primero = fabricar.staff({ nombre: "Primero", created_at: "2026-01-01T00:00:00+00:00" });
    const presidente = fabricar.staff({
      nombre: "Presidente",
      cargo: "Presidente",
      tipo: "Directiva",
      categoria: "Senior",
    });
    origen.staff_club.push(segundo, primero, presidente);
    const informe = crearInforme();

    const { staff } = transformarPlantilla(origen, informe);

    expect(staff.find((m) => m.id === primero.id)).toMatchObject({ tipo: "tecnico", categoria: "Senior", orden: 0 });
    expect(staff.find((m) => m.id === segundo.id)?.orden).toBe(1);
    expect(staff.find((m) => m.id === presidente.id)).toMatchObject({
      tipo: "directiva",
      categoria: null,
      orden: 0,
    });
    expect(informe.avisos).toEqual(['Directivo "Presidente" tenía categoría "Senior"; se descarta.']);
  });

  it("exige categoría a los técnicos y un tipo conocido", () => {
    const sinCategoria = snapshotVacio();
    sinCategoria.staff_club.push(fabricar.staff({ categoria: null }));
    expect(() => transformarPlantilla(sinCategoria, crearInforme())).toThrow(/no tiene categoría/);

    const tipoRaro = snapshotVacio();
    tipoRaro.staff_club.push(fabricar.staff({ tipo: "Utillero" }));
    expect(() => transformarPlantilla(tipoRaro, crearInforme())).toThrow(/Tipo de staff desconocido/);
  });
});
```

`tools/migracion-supabase/src/transformar/actas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FilaEvento } from "../snapshot/tipos";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { mapearEvento, transformarActas } from "./actas";
import { crearInforme } from "./tipos";

const P = "partido-1";
const J1 = "jugador-1";
const J2 = "jugador-2";

const casos: [string, Partial<FilaEvento>, Record<string, unknown>][] = [
  [
    "gol propio",
    { tipo: "gol", jugador_id: J1 },
    { tipo: "gol", lado: "propio", propia: false, jugadorId: J1, jugadorSaleId: null, nombreRival: null },
  ],
  [
    "gol en propia de un rival (cuenta para nosotros)",
    { tipo: "gol", nombre_mostrado: "GÓMEZ MEJUTO, HUGO" },
    { tipo: "gol", lado: "propio", propia: true, jugadorId: null, nombreRival: "GÓMEZ MEJUTO, HUGO" },
  ],
  [
    "gol en propia nuestro (cuenta para el rival)",
    { tipo: "gol", es_rival: true, jugador_id: J1, nombre_mostrado: "En propia" },
    { tipo: "gol", lado: "rival", propia: true, jugadorId: J1, nombreRival: null },
  ],
  [
    "gol rival",
    { tipo: "gol", es_rival: true, nombre_mostrado: "PÉREZ, ANA" },
    { tipo: "gol", lado: "rival", propia: false, jugadorId: null, nombreRival: "PÉREZ, ANA" },
  ],
  [
    "tarjeta propia",
    { tipo: "tarjeta_roja", jugador_id: J1 },
    { tipo: "tarjeta_roja", lado: "propio", jugadorId: J1, nombreRival: null },
  ],
  [
    "tarjeta rival",
    { tipo: "tarjeta_amarilla", es_rival: true, nombre_mostrado: "RIVAL, X" },
    { tipo: "tarjeta_amarilla", lado: "rival", jugadorId: null, nombreRival: "RIVAL, X" },
  ],
  [
    "cambio (jugador_id entra, relacionado sale)",
    { tipo: "cambio", jugador_id: J2, jugador_relacionado_id: J1 },
    { tipo: "cambio", lado: "propio", jugadorId: J2, jugadorSaleId: J1 },
  ],
];

describe("mapearEvento", () => {
  it.each(casos)("%s", (_caso, parcial, esperado) => {
    const fila = fabricar.evento({ partido_id: P, minuto: 12, ...parcial });
    expect(mapearEvento(fila)).toMatchObject({ id: fila.id, partidoId: P, minuto: 12, ...esperado });
  });

  it("convierte el minuto 999 en null y rechaza minutos fuera de rango", () => {
    expect(mapearEvento(fabricar.evento({ jugador_id: J1, minuto: 999 })).minuto).toBeNull();
    expect(() => mapearEvento(fabricar.evento({ jugador_id: J1, minuto: 200 }))).toThrow(
      /fuera de rango/,
    );
  });

  it("rechaza formas no reconocidas", () => {
    expect(() =>
      mapearEvento(fabricar.evento({ tipo: "cambio", es_rival: true, nombre_mostrado: "X" })),
    ).toThrow(/forma no reconocida/);
    expect(() => mapearEvento(fabricar.evento({ tipo: "gol" }))).toThrow(/forma no reconocida/);
    expect(() => mapearEvento(fabricar.evento({ tipo: "penalti", jugador_id: J1 }))).toThrow(
      /forma no reconocida/,
    );
  });
});

describe("transformarActas", () => {
  it("crea participaciones y completa las de jugadores que solo aparecen en eventos", () => {
    const origen = snapshotVacio();
    origen.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: P, jugador_id: J1, titular: true, jugo: false, goles: 1 }),
      fabricar.estadistica({ partido_id: P, jugador_id: J2, titular: false, jugo: false, goles: 0 }),
    );
    origen.partido_eventos_santiso.push(
      fabricar.evento({ partido_id: P, tipo: "gol", jugador_id: J1, minuto: 10 }),
      fabricar.evento({ partido_id: P, tipo: "cambio", jugador_id: J2, jugador_relacionado_id: J1 }),
      fabricar.evento({ partido_id: P, tipo: "tarjeta_amarilla", jugador_id: "jugador-3" }),
    );
    const informe = crearInforme();

    const { partidoParticipaciones, partidoEventos } = transformarActas(origen, informe);

    expect(partidoEventos).toHaveLength(3);
    expect(partidoParticipaciones).toEqual([
      { partidoId: P, jugadorId: J1, titular: true, jugo: true },
      { partidoId: P, jugadorId: J2, titular: false, jugo: true },
      { partidoId: P, jugadorId: "jugador-3", titular: false, jugo: true },
    ]);
    expect(informe.participacionesCreadas).toBe(1);
    expect(informe.avisos).toEqual([
      `Jugador ${J2} marcado como que jugó el partido ${P} por tener eventos.`,
    ]);
  });

  it("se detiene si los goles de la estadística no cuadran con los eventos", () => {
    const origen = snapshotVacio();
    origen.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: P, jugador_id: J1, titular: true, jugo: true, goles: 2 }),
    );
    origen.partido_eventos_santiso.push(fabricar.evento({ partido_id: P, jugador_id: J1 }));
    expect(() => transformarActas(origen, crearInforme())).toThrow(/estadística 2, eventos 1/);
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/transformar/plantilla.test.ts tools/migracion-supabase/src/transformar/actas.test.ts`
Esperado: FAIL por módulos inexistentes.

- [ ] **Paso 3: Implementar la plantilla**

`tools/migracion-supabase/src/transformar/plantilla.ts`:

```ts
import {
  aFechaLiteral,
  type Categoria,
  claveNombre,
  esValorDe,
  normalizarCategoria,
  type Posicion,
  POSICIONES,
  TIPOS_STAFF,
} from "@santiso/domain";
import { claveMediaDesdeUrl } from "../snapshot/media";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { ErrorMigracion, type Informe, type JugadorNuevo, type StaffNuevo } from "./tipos";

/** Jugadores y R13 (staff). */
export function transformarPlantilla(
  origen: Snapshot,
  informe: Informe,
): { jugadores: JugadorNuevo[]; staff: StaffNuevo[] } {
  const jugadores = origen.jugadores.map((fila): JugadorNuevo => {
    if (!fila.categoria) {
      throw new ErrorMigracion(`El jugador "${fila.nombre}" no tiene categoría.`);
    }
    const textoPosicion = textoOpcional(fila.posicion);
    let posicion: Posicion | null = null;
    if (textoPosicion !== null) {
      if (!esValorDe(POSICIONES, textoPosicion)) {
        throw new ErrorMigracion(
          `Posición desconocida "${textoPosicion}" en el jugador "${fila.nombre}".`,
        );
      }
      posicion = textoPosicion;
    }
    return {
      id: fila.id,
      nombre: fila.nombre.trim(),
      apodo: textoOpcional(fila.apodo),
      dorsal: fila.dorsal,
      posicion,
      posicionesConocidas: fila.posiciones_conocidas ?? [],
      capitania: fila.capitan !== null && fila.capitan > 0 ? fila.capitan : null,
      categoria: normalizarCategoria(fila.categoria),
      foto: claveMediaDesdeUrl(fila.foto_url),
      fechaNacimiento: fila.fecha_nacimiento ? aFechaLiteral(fila.fecha_nacimiento) : null,
      historial: fila.historial_deportivo ?? [],
      compromiso: fila.compromiso,
      ...marcasDesde(fila.created_at),
    };
  });

  const siguienteOrden = new Map<string, number>();
  const staff = [...origen.staff_club]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map((fila): StaffNuevo => {
      const tipo = claveNombre(fila.tipo);
      if (!esValorDe(TIPOS_STAFF, tipo)) {
        throw new ErrorMigracion(`Tipo de staff desconocido "${fila.tipo}" en "${fila.nombre}".`);
      }
      let categoria: Categoria | null = null;
      if (tipo === "tecnico") {
        if (!fila.categoria) {
          throw new ErrorMigracion(`El técnico "${fila.nombre}" no tiene categoría.`);
        }
        categoria = normalizarCategoria(fila.categoria);
      } else if (fila.categoria) {
        informe.avisos.push(
          `Directivo "${fila.nombre}" tenía categoría "${fila.categoria}"; se descarta.`,
        );
      }
      const grupo = `${tipo}|${categoria ?? ""}`;
      const orden = siguienteOrden.get(grupo) ?? 0;
      siguienteOrden.set(grupo, orden + 1);
      return {
        id: fila.id,
        nombre: fila.nombre.trim(),
        cargo: fila.cargo.trim(),
        tipo,
        categoria,
        foto: claveMediaDesdeUrl(fila.foto_url),
        orden,
        ...marcasDesde(fila.created_at),
      };
    });

  return { jugadores, staff };
}
```

- [ ] **Paso 4: Implementar las actas**

`tools/migracion-supabase/src/transformar/actas.ts`:

```ts
import { MINUTO_MAXIMO } from "@santiso/domain";
import type { FilaEvento, Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { ErrorMigracion, type EventoNuevo, type Informe, type ParticipacionNueva } from "./tipos";

/** Minuto que usaba el importador antiguo para eventos posteriores al final. */
const MINUTO_FINAL_ANTIGUO = 999;

/** R12: correspondencia exhaustiva de las 7 formas conocidas; cualquier otra detiene la migración. */
export function mapearEvento(fila: FilaEvento): EventoNuevo {
  const minuto =
    fila.minuto === null || fila.minuto === MINUTO_FINAL_ANTIGUO ? null : fila.minuto;
  if (minuto !== null && (minuto < 0 || minuto > MINUTO_MAXIMO)) {
    throw new ErrorMigracion(`El evento ${fila.id} tiene un minuto fuera de rango: ${minuto}.`);
  }
  const base = {
    id: fila.id,
    partidoId: fila.partido_id,
    minuto,
    propia: false,
    jugadorId: null,
    jugadorSaleId: null,
    nombreRival: null,
    ...marcasDesde(fila.created_at),
  };
  const nombre = textoOpcional(fila.nombre_mostrado);
  const { tipo, es_rival: esRival, jugador_id: jugadorId } = fila;
  const jugadorSaleId = fila.jugador_relacionado_id;

  if (tipo === "gol") {
    if (!esRival && jugadorId) return { ...base, tipo, lado: "propio", jugadorId };
    if (!esRival && nombre) return { ...base, tipo, lado: "propio", propia: true, nombreRival: nombre };
    if (esRival && jugadorId) return { ...base, tipo, lado: "rival", propia: true, jugadorId };
    if (esRival) return { ...base, tipo, lado: "rival", nombreRival: nombre };
  }
  if (tipo === "tarjeta_amarilla" || tipo === "tarjeta_roja") {
    if (!esRival && jugadorId) return { ...base, tipo, lado: "propio", jugadorId };
    if (esRival && !jugadorId) return { ...base, tipo, lado: "rival", nombreRival: nombre };
  }
  if (tipo === "cambio" && !esRival && jugadorId && jugadorSaleId) {
    return { ...base, tipo, lado: "propio", jugadorId, jugadorSaleId };
  }
  throw new ErrorMigracion(
    `El evento ${fila.id} tiene una forma no reconocida: ${JSON.stringify({
      tipo,
      esRival,
      jugador: Boolean(jugadorId),
      sale: Boolean(jugadorSaleId),
      nombre,
    })}.`,
  );
}

/** R10–R11: participaciones desde estadísticas, goles verificados y jugadores completados. */
export function transformarActas(
  origen: Snapshot,
  informe: Informe,
): { partidoParticipaciones: ParticipacionNueva[]; partidoEventos: EventoNuevo[] } {
  const partidoEventos = origen.partido_eventos_santiso.map(mapearEvento);
  const clave = (partidoId: string, jugadorId: string) => `${partidoId}|${jugadorId}`;

  const participaciones = new Map<string, ParticipacionNueva>();
  for (const fila of origen.jugador_partido_stats) {
    const titular = fila.titular === true;
    participaciones.set(clave(fila.partido_id, fila.jugador_id), {
      partidoId: fila.partido_id,
      jugadorId: fila.jugador_id,
      titular,
      jugo: titular || fila.jugo === true,
    });
  }

  const golesPorJugador = new Map<string, number>();
  for (const evento of partidoEventos) {
    if (evento.tipo === "gol" && evento.lado === "propio" && !evento.propia && evento.jugadorId) {
      const k = clave(evento.partidoId, evento.jugadorId);
      golesPorJugador.set(k, (golesPorJugador.get(k) ?? 0) + 1);
    }
  }
  for (const fila of origen.jugador_partido_stats) {
    const deEventos = golesPorJugador.get(clave(fila.partido_id, fila.jugador_id)) ?? 0;
    if ((fila.goles ?? 0) !== deEventos) {
      throw new ErrorMigracion(
        `Goles del jugador ${fila.jugador_id} en el partido ${fila.partido_id}: estadística ${fila.goles ?? 0}, eventos ${deEventos}.`,
      );
    }
  }

  for (const evento of partidoEventos) {
    for (const jugadorId of [evento.jugadorId, evento.jugadorSaleId]) {
      if (!jugadorId) continue;
      const k = clave(evento.partidoId, jugadorId);
      const existente = participaciones.get(k);
      if (!existente) {
        participaciones.set(k, { partidoId: evento.partidoId, jugadorId, titular: false, jugo: true });
        informe.participacionesCreadas++;
      } else if (!existente.jugo) {
        existente.jugo = true;
        informe.avisos.push(
          `Jugador ${jugadorId} marcado como que jugó el partido ${evento.partidoId} por tener eventos.`,
        );
      }
    }
  }

  return { partidoParticipaciones: [...participaciones.values()], partidoEventos };
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

> En la prueba de participaciones, el orden importa: J1 y J2 vienen de estadísticas, y `jugador-3` se crea al recorrer los eventos. El aviso de J2 aparece porque era suplente con `jugo = false` y entra en un cambio.

- [ ] **Paso 6: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): transformación de plantilla, participaciones y eventos de acta" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 12: Transformación del club y función `transformar` completa

**Ficheros:**
- Crear: `tools/migracion-supabase/src/transformar/club.ts`, `tools/migracion-supabase/src/transformar/index.ts`
- Test: `tools/migracion-supabase/src/transformar/club.test.ts`, `tools/migracion-supabase/src/transformar/index.test.ts`

**Interfaces:**
- Consume: todas las transformaciones de las tareas 8–11; `CLAVE_ESCUDO_CLUB`, `claveMediaDesdeUrl` (Tarea 7); `claveNombre`, `validarAjuste` (`@santiso/domain`).
- Produce:
  - `transformarClub(origen, informe): { patrocinadores: PatrocinadorNuevo[]; ajustes: AjusteNuevo[] }`
  - `interface ResultadoTransformacion { modelo: ModeloNuevo; informe: Informe }`
  - `transformar(origen: Snapshot): ResultadoTransformacion` (pura y determinista)
  - `validarReferencias(modelo: ModeloNuevo): void`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/transformar/club.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarClub } from "./club";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("transformarClub — patrocinadores", () => {
  it("une el catálogo con los logos de carteles, fusionando por nombre", () => {
    const origen = snapshotVacio();
    const autobuses = fabricar.patrocinador({
      nombre: "Autobuses Santiso",
      web_url: " https://autobuses.example ",
      logo_url: `${BASE}sponsors/autobuses.webp`,
      orden: 3,
    });
    const concello = fabricar.asset({
      nombre: "Concello de Santiso",
      url: `${BASE}cartel/logo_patrocinador/concello.webp`,
      orden: 1,
    });
    origen.patrocinadores.push(autobuses);
    origen.cartel_assets.push(
      concello,
      fabricar.asset({
        nombre: "AUTOBUSES SANTISO",
        url: `${BASE}cartel/logo_patrocinador/autobuses.webp`,
        orden: 0,
      }),
    );
    const informe = crearInforme();

    const { patrocinadores } = transformarClub(origen, informe);

    expect(patrocinadores).toEqual([
      expect.objectContaining({
        id: autobuses.id,
        nombre: "Autobuses Santiso",
        clave: "autobuses santiso",
        logo: "sponsors/autobuses.webp",
        webUrl: "https://autobuses.example",
        orden: 0,
        enCarteles: true,
      }),
      expect.objectContaining({
        id: concello.id,
        nombre: "Concello de Santiso",
        logo: "cartel/logo_patrocinador/concello.webp",
        webUrl: null,
        orden: 1,
        enCarteles: true,
      }),
    ]);
    expect(informe.avisos).toEqual([
      'Logo de cartel "AUTOBUSES SANTISO" unido al patrocinador existente.',
    ]);
  });
});

describe("transformarClub — ajustes", () => {
  it("guarda escudo, logos institucionales y orden de logos", () => {
    const origen = snapshotVacio();
    origen.cartel_assets.push(
      fabricar.asset({
        tipo: "logo_institucional",
        subtipo: "xunta",
        url: `${BASE}cartel/logo_institucional/xunta.webp`,
      }),
      fabricar.asset({
        tipo: "logo_institucional",
        subtipo: "rfgf",
        url: `${BASE}cartel/logo_institucional/rfgf.webp`,
      }),
      fabricar.asset({ tipo: "config", subtipo: "logo_order", nombre: "rfgf_left", url: "" }),
    );

    const { ajustes } = transformarClub(origen, crearInforme());

    expect(ajustes).toEqual([
      { id: "club.escudo", valor: "escudo_club.webp" },
      { id: "cartel.logo_xunta", valor: "cartel/logo_institucional/xunta.webp" },
      { id: "cartel.logo_rfgf", valor: "cartel/logo_institucional/rfgf.webp" },
      { id: "cartel.orden_logos", valor: "rfgf_izquierda" },
    ]);
  });

  it("usa valores por defecto si no hay activos", () => {
    expect(transformarClub(snapshotVacio(), crearInforme()).ajustes).toEqual([
      { id: "club.escudo", valor: "escudo_club.webp" },
      { id: "cartel.orden_logos", valor: "xunta_izquierda" },
    ]);
  });

  it("se detiene ante activos desconocidos o duplicados", () => {
    const tipoRaro = snapshotVacio();
    tipoRaro.cartel_assets.push(fabricar.asset({ tipo: "fondo", nombre: "Fondo" }));
    expect(() => transformarClub(tipoRaro, crearInforme())).toThrow(/tipo desconocido/);

    const duplicado = snapshotVacio();
    duplicado.cartel_assets.push(
      fabricar.asset({ tipo: "logo_institucional", subtipo: "xunta", url: `${BASE}a.webp` }),
      fabricar.asset({ tipo: "logo_institucional", subtipo: "xunta", url: `${BASE}b.webp` }),
    );
    expect(() => transformarClub(duplicado, crearInforme())).toThrow(/2 logos institucionales/);
  });
});
```

`tools/migracion-supabase/src/transformar/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fabricar, snapshotMinimo } from "../test/fabricas";
import { transformar } from "./index";

describe("transformar", () => {
  it("transforma el snapshot mínimo completo sin avisos", () => {
    const { snapshot, ids } = snapshotMinimo();

    const { modelo, informe } = transformar(snapshot);

    expect(
      Object.fromEntries(Object.entries(modelo).map(([tabla, filas]) => [tabla, filas.length])),
    ).toEqual({
      temporadas: 1,
      competiciones: 1,
      competicionAlias: 0,
      equipos: 2,
      competicionEquipos: 2,
      jugadores: 1,
      staff: 1,
      campos: 1,
      jornadas: 1,
      jornadaDescansos: 0,
      partidos: 1,
      partidoParticipaciones: 1,
      partidoEventos: 1,
      patrocinadores: 0,
      ajustes: 2,
    });
    expect(modelo.equipos.find((e) => e.id === ids.santiso)?.esPropio).toBe(true);
    expect(modelo.partidos[0]).toMatchObject({ golesLocal: 2, golesVisitante: 1, fecha: "2026-09-27T17:00" });
    expect(informe.avisos).toEqual([]);
  });

  it("es determinista", () => {
    const { snapshot } = snapshotMinimo();
    expect(transformar(snapshot)).toEqual(transformar(snapshot));
  });

  it("detecta referencias rotas antes de importar", () => {
    const conJugadorFantasma = snapshotMinimo();
    conJugadorFantasma.snapshot.jugador_partido_stats.push(
      fabricar.estadistica({ partido_id: conJugadorFantasma.ids.partido, jugador_id: "fantasma" }),
    );
    expect(() => transformar(conJugadorFantasma.snapshot)).toThrow(/Referencia rota/);

    const conCampoFantasma = snapshotMinimo();
    conCampoFantasma.snapshot.partidos_liga[0]!.campo_id = "campo-fantasma";
    expect(() => transformar(conCampoFantasma.snapshot)).toThrow(/Referencia rota/);
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/transformar/club.test.ts tools/migracion-supabase/src/transformar/index.test.ts`
Esperado: FAIL por módulos inexistentes.

- [ ] **Paso 3: Implementar el club**

`tools/migracion-supabase/src/transformar/club.ts`:

```ts
import { claveNombre, validarAjuste } from "@santiso/domain";
import { CLAVE_ESCUDO_CLUB, claveMediaDesdeUrl } from "../snapshot/media";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { type AjusteNuevo, ErrorMigracion, type Informe, type PatrocinadorNuevo } from "./tipos";

const TIPOS_ASSET = new Set(["logo_institucional", "logo_patrocinador", "config"]);
const LOGOS_INSTITUCIONALES = [
  ["xunta", "cartel.logo_xunta"],
  ["rfgf", "cartel.logo_rfgf"],
] as const;

/** R14–R15: patrocinadores unificados y ajustes globales. */
export function transformarClub(
  origen: Snapshot,
  informe: Informe,
): { patrocinadores: PatrocinadorNuevo[]; ajustes: AjusteNuevo[] } {
  const subtiposInstitucionales = new Set<string>(LOGOS_INSTITUCIONALES.map(([subtipo]) => subtipo));
  const desconocidos = origen.cartel_assets.filter(
    (asset) =>
      !TIPOS_ASSET.has(asset.tipo) ||
      (asset.tipo === "logo_institucional" && !subtiposInstitucionales.has(asset.subtipo ?? "")),
  );
  if (desconocidos.length > 0) {
    throw new ErrorMigracion(
      `Activos de cartel con tipo desconocido: ${desconocidos.map((a) => `${a.tipo}/${a.subtipo ?? ""}`).join(", ")}.`,
    );
  }

  const patrocinadores = new Map<string, PatrocinadorNuevo>();
  for (const fila of origen.patrocinadores) {
    const nombre = fila.nombre.trim();
    const clave = claveNombre(nombre);
    if (patrocinadores.has(clave)) throw new ErrorMigracion(`Patrocinador duplicado: "${nombre}".`);
    patrocinadores.set(clave, {
      id: fila.id,
      nombre,
      clave,
      logo: claveMediaDesdeUrl(fila.logo_url),
      webUrl: textoOpcional(fila.web_url),
      orden: fila.orden ?? 0,
      enCarteles: false,
      ...marcasDesde(fila.created_at),
    });
  }

  const logosCartel = origen.cartel_assets
    .filter((asset) => asset.tipo === "logo_patrocinador")
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  for (const [orden, asset] of logosCartel.entries()) {
    const nombre = asset.nombre.trim();
    const clave = claveNombre(nombre);
    const existente = patrocinadores.get(clave);
    if (existente) {
      existente.enCarteles = true;
      existente.orden = orden;
      existente.logo ??= claveMediaDesdeUrl(asset.url);
      informe.avisos.push(`Logo de cartel "${nombre}" unido al patrocinador existente.`);
      continue;
    }
    patrocinadores.set(clave, {
      id: asset.id,
      nombre,
      clave,
      logo: claveMediaDesdeUrl(asset.url),
      webUrl: null,
      orden,
      enCarteles: true,
    });
  }

  const ajustes: AjusteNuevo[] = [
    { id: "club.escudo", valor: validarAjuste("club.escudo", CLAVE_ESCUDO_CLUB) },
  ];
  for (const [subtipo, id] of LOGOS_INSTITUCIONALES) {
    const logos = origen.cartel_assets.filter(
      (asset) => asset.tipo === "logo_institucional" && asset.subtipo === subtipo,
    );
    if (logos.length > 1) {
      throw new ErrorMigracion(`Hay ${logos.length} logos institucionales "${subtipo}".`);
    }
    const claveLogo = claveMediaDesdeUrl(logos[0]?.url);
    if (claveLogo) ajustes.push({ id, valor: validarAjuste(id, claveLogo) });
  }
  const configuracion = origen.cartel_assets.find(
    (asset) => asset.tipo === "config" && asset.subtipo === "logo_order",
  );
  const ordenLogos = configuracion?.nombre === "rfgf_left" ? "rfgf_izquierda" : "xunta_izquierda";
  ajustes.push({ id: "cartel.orden_logos", valor: validarAjuste("cartel.orden_logos", ordenLogos) });

  return { patrocinadores: [...patrocinadores.values()], ajustes };
}
```

- [ ] **Paso 4: Implementar `transformar` y la validación de referencias**

`tools/migracion-supabase/src/transformar/index.ts`:

```ts
import type { Snapshot } from "../snapshot/tipos";
import { transformarActas } from "./actas";
import { transformarCalendario } from "./calendario";
import { transformarClub } from "./club";
import { transformarCompeticiones } from "./competiciones";
import { transformarEquipos } from "./equipos";
import { transformarPlantilla } from "./plantilla";
import { transformarTemporadas } from "./temporadas";
import { crearInforme, ErrorMigracion, type Informe, type ModeloNuevo } from "./tipos";

export interface ResultadoTransformacion {
  modelo: ModeloNuevo;
  informe: Informe;
}

/** Snapshot de Supabase → modelo nuevo. Pura y determinista: misma entrada, mismos ids y filas. */
export function transformar(origen: Snapshot): ResultadoTransformacion {
  const informe = crearInforme();
  const temporadas = transformarTemporadas(origen, informe);
  const { competiciones, competicionAlias } = transformarCompeticiones(origen, temporadas, informe);
  const equipos = transformarEquipos(origen, competiciones, informe);
  const calendario = transformarCalendario(origen, competiciones, equipos, informe);
  const plantilla = transformarPlantilla(origen, informe);
  const actas = transformarActas(origen, informe);
  const club = transformarClub(origen, informe);

  const modelo: ModeloNuevo = {
    temporadas,
    competiciones,
    competicionAlias,
    equipos: equipos.equipos,
    competicionEquipos: equipos.competicionEquipos,
    jugadores: plantilla.jugadores,
    staff: plantilla.staff,
    campos: calendario.campos,
    jornadas: calendario.jornadas,
    jornadaDescansos: calendario.jornadaDescansos,
    partidos: calendario.partidos,
    partidoParticipaciones: actas.partidoParticipaciones,
    partidoEventos: actas.partidoEventos,
    patrocinadores: club.patrocinadores,
    ajustes: club.ajustes,
  };
  validarReferencias(modelo);
  return { modelo, informe };
}

/** Comprueba todas las claves foráneas en memoria para dar mensajes claros antes de tocar la BD. */
export function validarReferencias(modelo: ModeloNuevo): void {
  const ids = (filas: { id: string }[]) => new Set(filas.map((fila) => fila.id));
  const temporadas = ids(modelo.temporadas);
  const competiciones = ids(modelo.competiciones);
  const equipos = ids(modelo.equipos);
  const jugadores = ids(modelo.jugadores);
  const campos = ids(modelo.campos);
  const jornadas = ids(modelo.jornadas);
  const partidos = ids(modelo.partidos);

  const exigir = (conjunto: Set<string>, valor: string | null | undefined, contexto: string) => {
    if (valor != null && !conjunto.has(valor)) {
      throw new ErrorMigracion(`Referencia rota en ${contexto}: ${valor}.`);
    }
  };

  for (const c of modelo.competiciones) exigir(temporadas, c.temporadaId, `competición "${c.nombre}"`);
  for (const a of modelo.competicionAlias) exigir(competiciones, a.competicionId, `alias "${a.alias}"`);
  for (const r of modelo.competicionEquipos) {
    exigir(competiciones, r.competicionId, "inscripción de equipo");
    exigir(equipos, r.equipoId, "inscripción de equipo");
  }
  for (const j of modelo.jornadas) exigir(competiciones, j.competicionId, `jornada ${j.numero}`);
  for (const d of modelo.jornadaDescansos) {
    exigir(jornadas, d.jornadaId, "descanso");
    exigir(equipos, d.equipoId, "descanso");
  }
  for (const p of modelo.partidos) {
    exigir(jornadas, p.jornadaId, `partido ${p.id}`);
    exigir(equipos, p.equipoLocalId, `partido ${p.id}`);
    exigir(equipos, p.equipoVisitanteId, `partido ${p.id}`);
    exigir(campos, p.campoId, `partido ${p.id}`);
  }
  for (const x of modelo.partidoParticipaciones) {
    exigir(partidos, x.partidoId, "participación");
    exigir(jugadores, x.jugadorId, "participación");
  }
  for (const e of modelo.partidoEventos) {
    exigir(partidos, e.partidoId, `evento ${e.id}`);
    exigir(jugadores, e.jugadorId, `evento ${e.id}`);
    exigir(jugadores, e.jugadorSaleId, `evento ${e.id}`);
  }
}
```

- [ ] **Paso 5: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

- [ ] **Paso 6: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): patrocinadores unificados, ajustes y transformación completa verificada" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 13: Importación transaccional, verificación, informe y CLIs

> Diseño verificado en spike: `close()` de libSQL no libera el fichero hasta que termina el proceso (`EBUSY` al renombrar). Por eso `importar` (padre) lanza `construir-bd` (hijo) para crear, importar y verificar una BD temporal. Cuando el hijo termina, el padre hace copia de la BD actual y cambia los ficheros.

**Ficheros:**
- Crear: `tools/migracion-supabase/src/importar.ts`, `tools/migracion-supabase/src/verificar.ts`, `tools/migracion-supabase/src/informe.ts`
- Crear: `tools/migracion-supabase/src/cli/construir-bd.ts`, `tools/migracion-supabase/src/cli/importar.ts`, `tools/migracion-supabase/src/cli/verificar.ts`, `tools/migracion-supabase/src/cli/snapshot-prueba.ts`
- Modificar: `tools/migracion-supabase/package.json`, `package.json` raíz
- Test: `tools/migracion-supabase/src/importar.test.ts`

**Interfaces:**
- Consume: `Db`, `TransaccionDb`, `schema`, `abrirDb`, `migrarBd`, `urlArchivo`, `marcaFichero`, `RUTA_BD`, `DIR_MEDIA`, `DIR_BACKUPS`, `DIR_INFORMES` (`@santiso/db`); `crearDbPrueba` (`@santiso/db/testing`); `transformar`, `ModeloNuevo`, `Informe`, `ErrorMigracion`; `leerSnapshot`, `ultimoSnapshot`, `Manifiesto`, `Snapshot`; `sha256`.
- Produce:
  - `importarModelo(db: Db, modelo: ModeloNuevo): Promise<void>` (una transacción)
  - `interface Comprobacion { nombre; ok; detalle }`, `interface ResultadoVerificacion { ok; comprobaciones }`
  - `verificarImportacion({ db, cliente, origen, modelo, dirMedia, manifiesto }): Promise<ResultadoVerificacion>`
  - `renderizarInforme({ dirSnapshot, modelo, informe, verificacion, fecha }): string`
  - Scripts raíz `migracion:importar [dirSnapshot]` y `migracion:verificar [dirSnapshot]`.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tools/migracion-supabase/src/importar.test.ts`:

```ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { schema as s } from "@santiso/db";
import { crearDbPrueba } from "@santiso/db/testing";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { importarModelo } from "./importar";
import { renderizarInforme } from "./informe";
import { manifiestoPara, snapshotMinimo } from "./test/fabricas";
import { transformar } from "./transformar";
import { verificarImportacion } from "./verificar";

async function escenario() {
  const { snapshot, ids } = snapshotMinimo();
  const { modelo, informe } = transformar(snapshot);
  const conexion = await crearDbPrueba();
  await importarModelo(conexion.db, modelo);

  const dirMedia = mkdtempSync(path.join(tmpdir(), "santiso-media-"));
  const escudo = new Uint8Array([1, 2, 3]);
  writeFileSync(path.join(dirMedia, "escudo_club.webp"), escudo);
  const manifiesto = manifiestoPara(snapshot, { "escudo_club.webp": escudo });

  const verificar = () =>
    verificarImportacion({
      db: conexion.db,
      cliente: conexion.cliente,
      origen: snapshot,
      modelo,
      dirMedia,
      manifiesto,
    });
  return { ids, modelo, informe, conexion, dirMedia, verificar };
}

describe("importarModelo + verificarImportacion", () => {
  it("importa el modelo completo y todas las comprobaciones pasan", async () => {
    const { verificar, conexion, modelo } = await escenario();

    const resultado = await verificar();

    expect(resultado.comprobaciones.filter((c) => !c.ok)).toEqual([]);
    expect(resultado.ok).toBe(true);
    expect(await conexion.db.select().from(s.partidos)).toHaveLength(modelo.partidos.length);
    conexion.cerrar();
  });

  it("detecta marcadores alterados, eventos perdidos y media corrupta", async () => {
    const { verificar, conexion, ids, dirMedia } = await escenario();
    await conexion.db
      .update(s.partidos)
      .set({ golesLocal: 9 })
      .where(eq(s.partidos.id, ids.partido));
    await conexion.db.delete(s.partidoEventos);
    writeFileSync(path.join(dirMedia, "escudo_club.webp"), new Uint8Array([0]));

    const resultado = await verificar();

    expect(resultado.ok).toBe(false);
    expect(resultado.comprobaciones.filter((c) => !c.ok).map((c) => c.nombre)).toEqual(
      expect.arrayContaining([
        "Filas en partidoEventos",
        "Marcadores de partidos",
        "Goles por jugador",
        "Ficheros de media",
      ]),
    );
    conexion.cerrar();
  });

  it("revierte toda la importación si falla una fila", async () => {
    const { snapshot } = snapshotMinimo();
    const { modelo } = transformar(snapshot);
    const conexion = await crearDbPrueba();
    const [evento] = modelo.partidoEventos;
    const roto = { ...modelo, partidoEventos: [{ ...evento!, minuto: 500 }] };

    await expect(importarModelo(conexion.db, roto)).rejects.toThrow();

    expect(await conexion.db.select().from(s.temporadas)).toHaveLength(0);
    conexion.cerrar();
  });

  it("renderiza un informe legible", async () => {
    const { verificar, modelo, informe, conexion } = await escenario();

    const texto = renderizarInforme({
      dirSnapshot: "data/snapshots/prueba",
      modelo,
      informe,
      verificacion: await verificar(),
      fecha: new Date("2026-09-13T20:00:00Z"),
    });

    expect(texto).toContain("# Informe de migración Supabase → SQLite");
    expect(texto).toContain("| partidos | 1 |");
    expect(texto).toContain("| Marcadores de partidos | OK |");
    expect(texto).toContain("## Clasificación manual antigua");
    conexion.cerrar();
  });
});
```

- [ ] **Paso 2: Ejecutar las pruebas y comprobar que fallan**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase/src/importar.test.ts`
Esperado: FAIL por módulos inexistentes.

- [ ] **Paso 3: Implementar la importación**

`tools/migracion-supabase/src/importar.ts`:

```ts
import { type Db, schema as s, type TransaccionDb } from "@santiso/db";
import type { InferInsertModel } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import type { ModeloNuevo } from "./transformar/tipos";

/** 100 filas × ≤ 14 columnas queda muy por debajo del límite de parámetros de SQLite. */
const TAMANO_LOTE = 100;

async function insertar<T extends SQLiteTable>(
  tx: TransaccionDb,
  tabla: T,
  filas: InferInsertModel<T>[],
) {
  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    await tx.insert(tabla).values(filas.slice(i, i + TAMANO_LOTE));
  }
}

/** Inserta el modelo completo en una sola transacción, en orden de claves foráneas. */
export async function importarModelo(db: Db, modelo: ModeloNuevo): Promise<void> {
  await db.transaction(async (tx) => {
    await insertar(tx, s.temporadas, modelo.temporadas);
    await insertar(tx, s.competiciones, modelo.competiciones);
    await insertar(tx, s.competicionAlias, modelo.competicionAlias);
    await insertar(tx, s.equipos, modelo.equipos);
    await insertar(tx, s.competicionEquipos, modelo.competicionEquipos);
    await insertar(tx, s.jugadores, modelo.jugadores);
    await insertar(tx, s.staff, modelo.staff);
    await insertar(tx, s.campos, modelo.campos);
    await insertar(tx, s.jornadas, modelo.jornadas);
    await insertar(tx, s.jornadaDescansos, modelo.jornadaDescansos);
    await insertar(tx, s.partidos, modelo.partidos);
    await insertar(tx, s.partidoParticipaciones, modelo.partidoParticipaciones);
    await insertar(tx, s.partidoEventos, modelo.partidoEventos);
    await insertar(tx, s.patrocinadores, modelo.patrocinadores);
    await insertar(tx, s.ajustes, modelo.ajustes);
  });
}
```

- [ ] **Paso 4: Implementar la verificación**

`tools/migracion-supabase/src/verificar.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Client } from "@libsql/client";
import { type Db, schema as s } from "@santiso/db";
import { and, count, eq, isNotNull } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { sha256 } from "./hash";
import type { Manifiesto, Snapshot } from "./snapshot/tipos";
import type { ModeloNuevo } from "./transformar/tipos";

export interface Comprobacion {
  nombre: string;
  ok: boolean;
  detalle: string;
}

export interface ResultadoVerificacion {
  ok: boolean;
  comprobaciones: Comprobacion[];
}

export interface EntradaVerificacion {
  db: Db;
  cliente: Client;
  origen: Snapshot;
  modelo: ModeloNuevo;
  dirMedia: string;
  manifiesto: Manifiesto;
}

const AJUSTES_CON_MEDIA = new Set(["club.escudo", "cartel.logo_xunta", "cartel.logo_rfgf"]);

const contar = (valores: string[]) => {
  const mapa = new Map<string, number>();
  for (const valor of valores) mapa.set(valor, (mapa.get(valor) ?? 0) + 1);
  return mapa;
};
const mapasIguales = (a: Map<string, number>, b: Map<string, number>) =>
  a.size === b.size && [...a].every(([clave, valor]) => b.get(clave) === valor);
const conjuntosIguales = (a: Set<string>, b: Set<string>) =>
  a.size === b.size && [...a].every((valor) => b.has(valor));
const sumar = (mapa: Map<string, number>) => [...mapa.values()].reduce((t, n) => t + n, 0);

/** Compara la BD importada con el snapshot de origen. Solo lectura. */
export async function verificarImportacion({
  db,
  cliente,
  origen,
  modelo,
  dirMedia,
  manifiesto,
}: EntradaVerificacion): Promise<ResultadoVerificacion> {
  const comprobaciones: Comprobacion[] = [];
  const anotar = (nombre: string, ok: boolean, detalle: string) =>
    comprobaciones.push({ nombre, ok, detalle });

  const integridad = String(
    (await cliente.execute("PRAGMA integrity_check")).rows[0]?.["integrity_check"],
  );
  anotar("Integridad SQLite", integridad === "ok", integridad);
  const violaciones = (await cliente.execute("PRAGMA foreign_key_check")).rows.length;
  anotar("Claves foráneas", violaciones === 0, `${violaciones} violaciones`);

  const recuentos: [string, SQLiteTable, number][] = [
    ["temporadas", s.temporadas, modelo.temporadas.length],
    ["competiciones", s.competiciones, modelo.competiciones.length],
    ["competicionAlias", s.competicionAlias, modelo.competicionAlias.length],
    ["equipos", s.equipos, modelo.equipos.length],
    ["competicionEquipos", s.competicionEquipos, modelo.competicionEquipos.length],
    ["jugadores", s.jugadores, modelo.jugadores.length],
    ["staff", s.staff, modelo.staff.length],
    ["campos", s.campos, modelo.campos.length],
    ["jornadas", s.jornadas, modelo.jornadas.length],
    ["jornadaDescansos", s.jornadaDescansos, modelo.jornadaDescansos.length],
    ["partidos", s.partidos, modelo.partidos.length],
    ["partidoParticipaciones", s.partidoParticipaciones, modelo.partidoParticipaciones.length],
    ["partidoEventos", s.partidoEventos, modelo.partidoEventos.length],
    ["patrocinadores", s.patrocinadores, modelo.patrocinadores.length],
    ["ajustes", s.ajustes, modelo.ajustes.length],
  ];
  for (const [nombre, tabla, esperado] of recuentos) {
    const [fila] = await db.select({ total: count() }).from(tabla);
    const total = fila?.total ?? 0;
    anotar(`Filas en ${nombre}`, total === esperado, `${total} de ${esperado}`);
  }

  const marcadores = new Map(
    (
      await db
        .select({
          id: s.partidos.id,
          golesLocal: s.partidos.golesLocal,
          golesVisitante: s.partidos.golesVisitante,
        })
        .from(s.partidos)
    ).map((partido) => [partido.id, partido]),
  );
  const discrepancias = origen.partidos_liga.filter((partido) => {
    const enBd = marcadores.get(partido.id);
    const disputado = partido.estado === "finalizado" || partido.estado === "en_juego";
    return (
      !enBd ||
      enBd.golesLocal !== (disputado ? partido.goles_local : null) ||
      enBd.golesVisitante !== (disputado ? partido.goles_visitante : null)
    );
  });
  anotar(
    "Marcadores de partidos",
    discrepancias.length === 0,
    discrepancias.length === 0
      ? `${origen.partidos_liga.length} partidos coinciden`
      : `Discrepancias: ${discrepancias.slice(0, 10).map((p) => p.id).join(", ")}`,
  );

  const eventosPropiosPorJugador = async (tipo: "gol" | "tarjeta_amarilla" | "tarjeta_roja") => {
    const filtros = [
      eq(s.partidoEventos.tipo, tipo),
      eq(s.partidoEventos.lado, "propio"),
      eq(s.partidoEventos.propia, false),
      isNotNull(s.partidoEventos.jugadorId),
    ];
    const filas = await db
      .select({ jugadorId: s.partidoEventos.jugadorId, total: count() })
      .from(s.partidoEventos)
      .where(and(...filtros))
      .groupBy(s.partidoEventos.jugadorId);
    return new Map(filas.map((fila) => [fila.jugadorId ?? "", fila.total]));
  };
  const eventosOrigenPorJugador = (tipo: string) =>
    contar(
      origen.partido_eventos_santiso
        .filter((evento) => evento.tipo === tipo && !evento.es_rival && evento.jugador_id)
        .map((evento) => evento.jugador_id ?? ""),
    );

  const golesOrigen = eventosOrigenPorJugador("gol");
  anotar(
    "Goles por jugador",
    mapasIguales(golesOrigen, await eventosPropiosPorJugador("gol")),
    `${sumar(golesOrigen)} goles de ${golesOrigen.size} jugadores`,
  );
  for (const tipo of ["tarjeta_amarilla", "tarjeta_roja"] as const) {
    const enOrigen = eventosOrigenPorJugador(tipo);
    anotar(
      `Tarjetas por jugador (${tipo})`,
      mapasIguales(enOrigen, await eventosPropiosPorJugador(tipo)),
      `${sumar(enOrigen)} tarjetas`,
    );
  }

  const titularesOrigen = new Set(
    origen.jugador_partido_stats
      .filter((fila) => fila.titular)
      .map((fila) => `${fila.partido_id}|${fila.jugador_id}`),
  );
  const titularesBd = new Set(
    (
      await db
        .select({
          partidoId: s.partidoParticipaciones.partidoId,
          jugadorId: s.partidoParticipaciones.jugadorId,
        })
        .from(s.partidoParticipaciones)
        .where(eq(s.partidoParticipaciones.titular, true))
    ).map((fila) => `${fila.partidoId}|${fila.jugadorId}`),
  );
  anotar(
    "Titularidades",
    conjuntosIguales(titularesOrigen, titularesBd),
    `${titularesBd.size} titularidades`,
  );

  const clavesUsadas = new Set<string>();
  const anadir = (clave: unknown) => {
    if (typeof clave === "string" && clave) clavesUsadas.add(clave);
  };
  for (const fila of await db.select({ clave: s.equipos.escudo }).from(s.equipos)) anadir(fila.clave);
  for (const fila of await db.select({ clave: s.jugadores.foto }).from(s.jugadores)) anadir(fila.clave);
  for (const fila of await db.select({ clave: s.staff.foto }).from(s.staff)) anadir(fila.clave);
  for (const fila of await db.select({ clave: s.patrocinadores.logo }).from(s.patrocinadores)) {
    anadir(fila.clave);
  }
  for (const fila of await db.select().from(s.ajustes)) {
    if (AJUSTES_CON_MEDIA.has(fila.id)) anadir(fila.valor);
  }
  const problemas = [...clavesUsadas].filter((clave) => {
    const ruta = path.join(dirMedia, ...clave.split("/"));
    const esperado = manifiesto.media[clave];
    return !esperado || !existsSync(ruta) || sha256(readFileSync(ruta)) !== esperado.sha256;
  });
  anotar(
    "Ficheros de media",
    problemas.length === 0,
    problemas.length === 0
      ? `${clavesUsadas.size} ficheros verificados`
      : `Faltan o no coinciden: ${problemas.join(", ")}`,
  );

  return { ok: comprobaciones.every((comprobacion) => comprobacion.ok), comprobaciones };
}
```

- [ ] **Paso 5: Implementar el informe**

`tools/migracion-supabase/src/informe.ts`:

```ts
import type { Informe, ModeloNuevo } from "./transformar/tipos";
import type { ResultadoVerificacion } from "./verificar";

export interface EntradaInforme {
  dirSnapshot: string;
  modelo: ModeloNuevo;
  informe: Informe;
  verificacion: ResultadoVerificacion;
  fecha: Date;
}

const lista = (elementos: string[]) =>
  elementos.length > 0 ? elementos.map((elemento) => `- ${elemento}`) : ["- Ninguno"];
const celda = (valor: string | number) => String(valor).replaceAll("|", "\\|");

export function renderizarInforme({
  dirSnapshot,
  modelo,
  informe,
  verificacion,
  fecha,
}: EntradaInforme): string {
  const lineas = [
    "# Informe de migración Supabase → SQLite",
    "",
    `- **Fecha:** ${fecha.toISOString()}`,
    `- **Snapshot:** \`${dirSnapshot}\``,
    `- **Resultado:** ${verificacion.ok ? "correcto" : "CON ERRORES"}`,
    "",
    "## Filas importadas",
    "",
    "| Tabla | Filas |",
    "| --- | ---: |",
    ...Object.entries(modelo).map(([tabla, filas]) => `| ${tabla} | ${filas.length} |`),
    "",
    "## Comprobaciones",
    "",
    "| Comprobación | Estado | Detalle |",
    "| --- | --- | --- |",
    ...verificacion.comprobaciones.map(
      (c) => `| ${celda(c.nombre)} | ${c.ok ? "OK" : "FALLO"} | ${celda(c.detalle)} |`,
    ),
    "",
    "## Correcciones aplicadas",
    "",
    ...lista(informe.avisos),
    "",
    "## Equipos fusionados",
    "",
    ...lista(
      informe.equiposFusionados.map(
        (f) => `${f.nombre} (${f.categoria}): se conserva ${f.conservado}; se fusionan ${f.eliminados.join(", ")}`,
      ),
    ),
    "",
    "## Equipos separados por categoría",
    "",
    ...lista(
      informe.equiposSeparados.map(
        (f) => `${f.nombre} → ${f.categoria} en "${f.competicion}" (${f.origen} → ${f.nuevo})`,
      ),
    ),
    "",
    "## Participaciones creadas desde eventos",
    "",
    String(informe.participacionesCreadas),
    "",
    "## Clasificación manual antigua",
    "",
    "Referencia para validar la clasificación calculada en la Fase 6. No se importa.",
    "",
    "| Equipo | Categoría | PTS | PJ | PG | PE | PP | GF | GC |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...informe.clasificacionManualAntigua.map(
      (c) =>
        `| ${celda(c.nombre)} | ${c.categoria} | ${c.pts} | ${c.pj} | ${c.pg} | ${c.pe} | ${c.pp} | ${c.gf} | ${c.gc} |`,
    ),
  ];
  return `${lineas.join("\n")}\n`;
}
```

- [ ] **Paso 6: Ejecutar las pruebas**

Ejecutar: `pnpm exec vitest run tools/migracion-supabase`
Esperado: todas en verde.

- [ ] **Paso 7: CLIs**

`tools/migracion-supabase/src/cli/construir-bd.ts`:

```ts
/** Proceso hijo de `importar`: crea, importa y verifica la BD temporal. Al terminar, libera los ficheros. */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { abrirDb, migrarBd, urlArchivo } from "@santiso/db";
import { importarModelo } from "../importar";
import { renderizarInforme } from "../informe";
import { leerSnapshot } from "../snapshot/archivos";
import { transformar } from "../transformar";
import { ErrorMigracion } from "../transformar/tipos";
import { verificarImportacion } from "../verificar";

const [dirSnapshot, rutaBd, dirMedia, rutaInforme] = process.argv.slice(2);
if (!dirSnapshot || !rutaBd || !dirMedia || !rutaInforme) {
  console.error("Uso: construir-bd <dirSnapshot> <rutaBd> <dirMedia> <rutaInforme>");
  process.exit(2);
}

try {
  const { snapshot, manifiesto } = leerSnapshot(dirSnapshot);
  const { modelo, informe } = transformar(snapshot);

  const { db, cliente, cerrar } = await abrirDb(urlArchivo(rutaBd), { wal: false });
  await migrarBd(db);
  await importarModelo(db, modelo);

  const mediaSnapshot = path.join(dirSnapshot, "media");
  if (existsSync(mediaSnapshot)) cpSync(mediaSnapshot, dirMedia, { recursive: true });

  const verificacion = await verificarImportacion({
    db,
    cliente,
    origen: snapshot,
    modelo,
    dirMedia,
    manifiesto,
  });
  cerrar();

  mkdirSync(path.dirname(rutaInforme), { recursive: true });
  writeFileSync(
    rutaInforme,
    renderizarInforme({ dirSnapshot, modelo, informe, verificacion, fecha: new Date() }),
  );
  for (const c of verificacion.comprobaciones) {
    console.log(`${c.ok ? "OK   " : "FALLO"} ${c.nombre}: ${c.detalle}`);
  }
  process.exit(verificacion.ok ? 0 : 1);
} catch (error) {
  console.error(error instanceof ErrorMigracion ? `Migración detenida: ${error.message}` : error);
  process.exit(1);
}
```

`tools/migracion-supabase/src/cli/importar.ts`:

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIR_BACKUPS, DIR_INFORMES, DIR_MEDIA, marcaFichero, RUTA_BD } from "@santiso/db";
import { ultimoSnapshot } from "../snapshot/archivos";

const marca = marcaFichero();
const dirSnapshot = process.argv[2] ? path.resolve(process.argv[2]) : ultimoSnapshot();
const bdTemporal = `${RUTA_BD}.importando`;
const mediaTemporal = `${DIR_MEDIA}.importando`;
const rutaInforme = path.join(DIR_INFORMES, `migracion-${marca}.md`);

// Restos de una importación fallida: su proceso ya terminó, así que no están bloqueados.
rmSync(bdTemporal, { force: true });
rmSync(mediaTemporal, { recursive: true, force: true });
mkdirSync(path.dirname(RUTA_BD), { recursive: true });

console.log(`Importando ${dirSnapshot}`);
const tsx = createRequire(import.meta.url).resolve("tsx/cli");
const hijo = fileURLToPath(new URL("./construir-bd.ts", import.meta.url));
try {
  execFileSync(
    process.execPath,
    [tsx, hijo, dirSnapshot, bdTemporal, mediaTemporal, rutaInforme],
    { stdio: "inherit" },
  );
} catch {
  console.error(
    `\nLa importación no se completó y la BD actual no se ha tocado. Informe (si existe): ${rutaInforme}`,
  );
  process.exit(1);
}

// libSQL solo libera los ficheros al terminar su proceso: el cambio se hace aquí, con el hijo ya cerrado.
mkdirSync(DIR_BACKUPS, { recursive: true });
if (existsSync(RUTA_BD)) {
  try {
    renameSync(RUTA_BD, path.join(DIR_BACKUPS, `santiso-${marca}.db`));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EBUSY") {
      console.error("La base de datos está en uso. Cierra `pnpm dev` y repite la importación.");
      process.exit(1);
    }
    throw error;
  }
  for (const sufijo of ["-wal", "-shm"]) {
    if (existsSync(RUTA_BD + sufijo)) {
      renameSync(RUTA_BD + sufijo, path.join(DIR_BACKUPS, `santiso-${marca}.db${sufijo}`));
    }
  }
}
if (existsSync(DIR_MEDIA)) renameSync(DIR_MEDIA, path.join(DIR_BACKUPS, `media-${marca}`));
renameSync(bdTemporal, RUTA_BD);
if (existsSync(mediaTemporal)) renameSync(mediaTemporal, DIR_MEDIA);

console.log(`\nBase de datos lista: ${RUTA_BD}\nInforme: ${rutaInforme}`);
```

`tools/migracion-supabase/src/cli/verificar.ts`:

```ts
import { existsSync } from "node:fs";
import path from "node:path";
import { abrirDb, DIR_MEDIA, RUTA_BD, urlArchivo } from "@santiso/db";
import { leerSnapshot, ultimoSnapshot } from "../snapshot/archivos";
import { transformar } from "../transformar";
import { verificarImportacion } from "../verificar";

if (!existsSync(RUTA_BD)) {
  console.error(`No existe ${RUTA_BD}. Ejecuta primero pnpm migracion:importar.`);
  process.exit(1);
}

const dirSnapshot = process.argv[2] ? path.resolve(process.argv[2]) : ultimoSnapshot();
const { snapshot, manifiesto } = leerSnapshot(dirSnapshot);
const { modelo } = transformar(snapshot);
const { db, cliente, cerrar } = await abrirDb(urlArchivo(RUTA_BD));
const resultado = await verificarImportacion({
  db,
  cliente,
  origen: snapshot,
  modelo,
  dirMedia: DIR_MEDIA,
  manifiesto,
});
cerrar();

for (const c of resultado.comprobaciones) {
  console.log(`${c.ok ? "OK   " : "FALLO"} ${c.nombre}: ${c.detalle}`);
}
process.exit(resultado.ok ? 0 : 1);
```

En `tools/migracion-supabase/package.json` añadir a `scripts`:

```json
"importar": "tsx src/cli/importar.ts",
"verificar": "tsx src/cli/verificar.ts"
```

En el `package.json` raíz añadir a `scripts`:

```json
"migracion:importar": "pnpm --filter @santiso/migracion-supabase importar",
"migracion:verificar": "pnpm --filter @santiso/migracion-supabase verificar"
```

> `migracion:verificar` solo tiene sentido **antes** de editar datos en la BD nueva: compara con el snapshot. Tras el corte de la Fase 2 dejará de coincidir, y es lo esperado.

- [ ] **Paso 8: Prueba de humo de los CLIs con un snapshot sintético**

`tsx -e` no resuelve bien imports ESM con `await` (comprobado en el spike), así que el snapshot sintético se genera con un script versionado.

`tools/migracion-supabase/src/cli/snapshot-prueba.ts`:

```ts
/** Genera un snapshot sintético en DIR_SNAPSHOTS para probar importar/verificar sin Supabase. */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DIR_SNAPSHOTS, marcaFichero } from "@santiso/db";
import { escribirSnapshot } from "../snapshot/archivos";
import { manifiestoPara, snapshotMinimo } from "../test/fabricas";

const dir = path.join(DIR_SNAPSHOTS, marcaFichero());
const { snapshot } = snapshotMinimo();
const escudo = new Uint8Array([1, 2, 3]);
mkdirSync(path.join(dir, "media"), { recursive: true });
writeFileSync(path.join(dir, "media", "escudo_club.webp"), escudo);
escribirSnapshot(dir, snapshot, manifiestoPara(snapshot, { "escudo_club.webp": escudo }));
console.log(`Snapshot de prueba: ${dir}`);
```

En `tools/migracion-supabase/package.json` añadir a `scripts`:

```json
"snapshot:prueba": "tsx src/cli/snapshot-prueba.ts"
```

Ejecutar en un directorio de datos temporal, sin tocar `data/`:

```bash
export SANTISO_DATA_DIR="$(mktemp -d)"
pnpm --filter @santiso/migracion-supabase snapshot:prueba
pnpm migracion:importar
pnpm migracion:importar
pnpm migracion:verificar
ls "$SANTISO_DATA_DIR" "$SANTISO_DATA_DIR/backups"
unset SANTISO_DATA_DIR
```

Esperado:
- Las dos importaciones imprimen todas las comprobaciones `OK` y `Base de datos lista`.
- La segunda mueve la BD anterior a `backups/santiso-<marca>.db` y la media a `backups/media-<marca>`.
- `migracion:verificar` sale con código 0.
- `ls` muestra `santiso.db`, `media`, `snapshots`, `informes` y `backups`.

- [ ] **Paso 9: Puerta de calidad y commit**

```bash
pnpm check
git add -A
git commit -m "feat(migracion): importación transaccional en proceso aislado, verificación e informe" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 14: Migración real, comprobación y documentación

> Esta tarea lee de Supabase de verdad (solo lectura) y crea `data/`. Hazla en una sesión con el propietario disponible: cualquier `ErrorMigracion` es una decisión suya y **no se resuelve relajando reglas**.

**Ficheros:**
- Generar (sin versionar): `data/snapshots/<marca>/`, `data/santiso.db`, `data/media/`, `data/informes/migracion-<marca>.md`, `data/backups/`
- Modificar: `README.md`, `AGENTS.md`

**Interfaces:**
- Consume: todos los CLIs de las tareas 5, 7 y 13.
- Produce: BD local con los datos reales verificados; README operativo.

- [ ] **Paso 1: Condiciones previas**

```bash
git status --short
pnpm check
```

Esperado: árbol limpio y `pnpm check` en verde. Confirmar con el propietario que no está editando datos en la app mientras se exporta.

- [ ] **Paso 2: Exportar desde Supabase**

Ejecutar: `pnpm migracion:exportar`

Esperado (cifras del 13/09/2026; pueden variar si se editaron datos después):

| Tabla | Filas |
| --- | ---: |
| temporadas | 2 |
| competiciones | 8 |
| competicion_etiquetas | 19 |
| reglas_liga | 4 |
| equipos | 67 |
| equipo_competiciones | 81 |
| campos_futbol | 64 |
| jornadas | 148 |
| jornada_equipo_descanso | 30 |
| partidos_liga | 688 |
| jugadores | 61 |
| jugador_partido_stats | 1211 |
| partido_eventos_santiso | 901 |
| staff_club | 11 |
| patrocinadores | 1 |
| cartel_assets | 8 |

La salida termina con `media: 111 ficheros` (110 referenciados + escudo del club) y `Snapshot listo`. Comprobar que ninguna línea ni fichero contiene la clave de servicio:

```bash
grep -rl "$(grep SUPABASE_SERVICE_ROLE_KEY apps/studio/.env.local | cut -d= -f2)" data/ || echo "sin claves en data/"
```

Esperado: `sin claves en data/`.

- [ ] **Paso 3: Importar**

Ejecutar: `pnpm migracion:importar`

Esperado: todas las comprobaciones `OK`, `Base de datos lista` y ruta del informe. Filas esperadas en el informe:

| Tabla | Filas | Motivo |
| --- | ---: | --- |
| temporadas | 2 | |
| competiciones | 8 | |
| competicionAlias | ≤ 19 | alias con igual clave normalizada se unen |
| equipos | 66 | 67 − 2 fusionados + 1 separado |
| competicionEquipos | 81 | |
| jugadores | 61 | |
| staff | 11 | |
| campos | 64 | |
| jornadas | 148 | |
| jornadaDescansos | 30 | |
| partidos | 688 | |
| partidoParticipaciones | 1212 | 1211 + 1 creada desde un gol sin estadística |
| partidoEventos | 901 | |
| patrocinadores | 6 | 1 del catálogo + 5 logos de carteles (salvo fusión por nombre) |
| ajustes | 4 | escudo, logo Xunta, logo RFGF, orden de logos |

Correcciones esperadas en «Correcciones aplicadas»:
- `Temporada "25/26" renombrada a "2025/26".`
- `Competición sin jornadas "Veteranos Copa - Santiago" asignada a la temporada 2025/26.`
- `Partidos sin disputar con marcador 0-0 por defecto: 56. Ahora quedan sin marcador.`

En «Equipos fusionados»: U.D. Santiso F.C. y S.D. Touro. En «Equipos separados»: S.D. CRUCES → Veteranos.

**Si la importación se detiene con `Migración detenida: …`:** no cambiar reglas ni datos para forzarla. Copiar el mensaje y llevarlo al propietario con las opciones (corregir el dato en Supabase y reexportar, o añadir una regla nueva con su prueba). La BD local no se ha tocado.

- [ ] **Paso 4: Verificar de nuevo y revisar el informe**

```bash
pnpm migracion:verificar
```

Esperado: todas las líneas `OK` y código de salida 0.

Revisión manual del informe (`data/informes/migracion-<marca>.md`) con el propietario:
- La tabla «Clasificación manual antigua» lista 37 equipos.
- No hay avisos inesperados.

Comprobación puntual con `pnpm db:studio` (se abre en el navegador; cerrar con Ctrl+C al terminar):
- `partidos` de la jornada 1 de «Tercera Futgal - Gr. 3»: fecha `2026-09-27T17:00`, estado `programado`, sin marcador.
- `equipos`: `U.D. Santiso F.C.` con `es_propio = 1` y escudo `escudos/…webp`.
- `ajustes`: `cartel.orden_logos` = `"xunta_izquierda"`.

- [ ] **Paso 5: Primera copia de seguridad**

Ejecutar: `pnpm db:backup`
Esperado: `Copia creada: …data/backups/santiso-<marca>.db`.

- [ ] **Paso 6: Reescribir `README.md`**

````markdown
# Santiso Studio

Herramienta local de UD Santiso para carteles, calendario, actas y estadísticas de jugadores. Uso personal en local: no se despliega.

> **Estado (Fase 1):** los datos ya están migrados a SQLite en `data/santiso.db`, pero la app todavía lee y escribe en Supabase hasta la Fase 2. Hoja de ruta: [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md).

## Requisitos

- Node.js 22.12 o superior
- pnpm 10.33.2 (`corepack enable`)

## Puesta en marcha

```bash
pnpm install
pnpm dev          # http://localhost:3000/admin
```

## Estructura

| Ruta | Contenido |
| --- | --- |
| `apps/studio` | App Next.js (panel, carteles, importadores) |
| `packages/domain` | Reglas de negocio puras (categorías, fechas, nombres, temporadas, ajustes) |
| `packages/db` | Esquema Drizzle, migraciones SQL, cliente libSQL y copias |
| `tools/migracion-supabase` | Migración única Supabase → SQLite |
| `data/` | Datos locales (ignorado por git) |
| `docs/` | Especificación, planes y auditorías |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` / `pnpm build` | Arranca o compila la app |
| `pnpm check` | Tipos, lint, formato y pruebas: obligatorio antes de cada commit |
| `pnpm test` | Pruebas (Vitest) |
| `pnpm db:generate --name <nombre>` | Genera una migración tras cambiar el esquema |
| `pnpm db:migrate` | Aplica las migraciones a `data/santiso.db` |
| `pnpm db:backup` | Copia consistente de la BD en `data/backups/` |
| `pnpm db:studio` | Explorador visual de la BD |
| `pnpm migracion:exportar` | Vuelca Supabase a `data/snapshots/` (solo lectura) |
| `pnpm migracion:importar [snapshot]` | Construye `data/santiso.db` desde el último snapshot (hace copia de la anterior) |
| `pnpm migracion:verificar [snapshot]` | Compara la BD con el snapshot |

## Datos y copias de seguridad

- `data/` contiene datos personales (nombres, fechas de nacimiento, fotos): **nunca** se sube a git.
- Haz `pnpm db:backup` con frecuencia y sincroniza `data/backups/` con una carpeta en la nube.
- **Restaurar una copia:** para `pnpm dev`, mueve `data/santiso.db` a otro sitio y copia el fichero de `data/backups/` como `data/santiso.db`.
- Importar o restaurar exige la app parada: en Windows, libSQL bloquea el fichero mientras el proceso vive.

## Documentación

- [Arquitectura y hoja de ruta](docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md)
- [Plan de la Fase 1](docs/superpowers/plans/2026-09-13-fase-1-fundacion-datos.md)
- [Auditoría UX/UI](docs/audits/2026-09-13-ux-ui.md)
````

- [ ] **Paso 7: Completar `AGENTS.md`**

Añadir al final del bloque `tooling-env`, antes de `<!-- END:tooling-env -->`:

```markdown
- **Base de datos:** Drizzle 0.45 (solo query builder core, nunca `db.query`) sobre libSQL. Cambios de esquema: editar `packages/db/src/schema`, `pnpm db:generate --name <cambio>`, pruebas en `packages/db/src/schema.test.ts`.
- **libSQL en Windows:** no libera el fichero hasta que termina el proceso. Para mover o borrar ficheros de BD, hazlo desde otro proceso y con `pnpm dev` parado.
- **Supabase:** solo lectura y solo desde `tools/migracion-supabase` hasta su retirada en la Fase 2.
```

- [ ] **Paso 8: Comprobar que la app sigue igual y que `data/` no entra en git**

```bash
pnpm build
git status --short
```

Esperado:
- `build` correcto.
- `git status` muestra solo `README.md` y `AGENTS.md`, nunca rutas bajo `data/`.

Prueba de humo manual: `pnpm dev`, abrir `/admin` y cambiar entre Calendario y Carteles; los datos se ven como antes.

- [ ] **Paso 9: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: README operativo del monorepo y reglas de datos locales" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Criterios de aceptación de la Fase 1

- [ ] `pnpm check` en verde (tipos, lint, formato y pruebas de `domain`, `db` y `migracion-supabase`).
- [ ] `pnpm build` y `pnpm dev` funcionan igual que antes (la app sigue en Supabase).
- [ ] `data/santiso.db` generada desde un snapshot real, con informe «correcto» y `pnpm migracion:verificar` sin fallos.
- [ ] Revisión del informe con el propietario: fusiones, separaciones y correcciones aceptadas.
- [ ] Copia de seguridad inicial creada.
- [ ] Nada de `data/` ni claves en git.

## Después de esta fase

- Hasta la Fase 2, cualquier cambio hecho en la app queda en Supabase. Justo antes del corte, repetir `pnpm migracion:exportar && pnpm migracion:importar && pnpm migracion:verificar` (el proceso es determinista).
- Siguiente plan: **Fase 2 — Corte de Supabase** (spec §8). Se escribe al empezarla, a partir de los aprendizajes de esta fase.
