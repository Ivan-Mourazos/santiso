# Fase 2C — Retirada de Supabase y del login: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que en `apps/` y `packages/` no quede ni una línea de Supabase, y que el panel abra sin login.

**Arquitectura:** no se añade nada. Se borra: el cliente de Supabase, el login, el proxy de autenticación, el respaldo de datos estáticos y las dependencias. Lo único que se construye es lo que hoy tapaba el respaldo estático: un estado de error de verdad.

**Stack:** Next.js 16.3.5 · React 19.3.0 · Vitest 4.1.11 · @playwright/test 1.61.1 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md), § «Fase 2 — Corte de Supabase», viñeta 2C.

**Planes anteriores:** [2A](2026-09-15-fase-2a-infraestructura-servidor.md), [2B-1](2026-09-20-fase-2b-1-catalogos.md), [2B-2](2026-09-20-fase-2b-2-media.md), [2B-3](2026-09-20-fase-2b-3-calendario.md), [2B-4](2026-09-20-fase-2b-4-actas-carteles.md), [2B-5](2026-09-20-fase-2b-5-fichas-pdf.md).

## Por qué desaparece el login

La herramienta escucha solo en `127.0.0.1`, corre en el ordenador de su único usuario y guarda sus datos en un fichero local. El login era de Supabase Auth: existía porque los datos estaban en la nube. Sin nube no protege nada —cualquiera con acceso al ordenador tiene ya el fichero de la base de datos— y a cambio obliga a mantener `@supabase/ssr`, un proxy de peticiones y un `DEV_AUTH_BYPASS` que es un segundo camino de entrada. Quitarlo reduce la superficie, no la aumenta.

Esto vale mientras la herramienta siga siendo local. El día que se publique la web del equipo, esa web es un proyecto aparte que **lee** esta base de datos: si alguna vez hubiera que exponer el panel en red, haría falta autenticación nueva, no esta.

## El hallazgo que cambia una tarea

`lib/data/season-2026-2027.ts` son **743 líneas de datos escritos a mano** (competiciones, equipos y 300 partidos de la temporada) que hoy no son un seed: son el **respaldo silencioso** de dos pantallas.

```ts
// lib/useCompeticiones.ts
const list = await fetchCompeticiones();
const activeList = list && list.length > 0 ? list : COMPETICIONES_2026_2027;
// …
} catch {
  setCompeticionesCatalog(COMPETICIONES_2026_2027);
}
```

Con Supabase caído eso era un apaño razonable. Ahora es una trampa: si la lectura falla, la pantalla se llena de competiciones con identificadores inventados (`comp-senior-2026-2027`) que **no existen en la base de datos**. Todo lo que se guarde contra ellos apunta a la nada, y el usuario no ve ningún error porque la pantalla parece llena.

Por eso la Tarea 2 no es «borrar un fichero»: es **sustituir el respaldo por un estado de error visible**. Borrar el import y dejar `[]` cambiaría un fallo ruidoso por uno mudo, que es peor.

## Restricciones globales

- **`tools/migracion-supabase` se queda.** El criterio de aceptación del spec es `rg -i supabase apps packages`, y excluye `tools/` a propósito. Es la única forma de volver a leer la nube si apareciera un dato perdido.
- **Por eso `apps/studio/.env.local` NO se toca.** La herramienta de migración lee de ahí `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ([`cli/exportar.ts:7`](../../../tools/migracion-supabase/src/cli/exportar.ts)); borrarlas la rompe. El fichero es del usuario y es secreto: **no se imprime, no se edita, no se commitea**. El plan solo anota al final qué líneas puede borrar él cuando retire la herramienta.
- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash.
- Antes de usar una API de Next, leer su guía en `apps/studio/node_modules/next/dist/docs/`.
- **Prettier y ESLint solo sobre los ficheros que se toquen.** La línea base de ESLint no debe subir: hoy está en **78 problemas**.
- `data/` nunca entra en git.
- `pnpm check` en verde antes de cada commit. El código de salida de una tubería es el del último comando: `pnpm check | tail` **no** corta un `&&`.
- Rama `fase-2c`. Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Inventario

Lo que queda hoy, verificado:

| Fichero | Qué tiene | Destino |
| --- | --- | --- |
| `app/login/page.tsx` | 187 líneas de login | borrar |
| `proxy.ts` | proxy de auth + `DEV_AUTH_BYPASS` | borrar |
| `lib/supabase.ts`, `lib/supabase-browser.ts`, `lib/supabase-server.ts` | los clientes | borrar |
| `components/admin/AdminShield.tsx` | `signOut` y botón «Cerrar sesión» | quitar esas partes |
| `package.json` | `@supabase/ssr`, `@supabase/supabase-js` | quitar |
| `next.config.ts` | `images.remotePatterns` → `**.supabase.co` | quitar |
| `lib/data/season-2026-2027.ts` | 743 líneas de respaldo estático | borrar (Tarea 2) |
| `lib/supabase-queries.ts` | 138 líneas **sin Supabase dentro**: solo el nombre | renombrar |
| `legacy/supabase/` | 27 SQL y 2 `.mjs` de la época de la nube | borrar |
| `scripts/shoot-admin.ts` | instrucciones con `DEV_AUTH_BYPASS` | actualizar |
| `AGENTS.md` | «necesita `DEV_AUTH_BYPASS=1` mientras exista el login» | actualizar |
| comentarios sueltos | `useCartelAssets.ts`, `lib/dto.ts`, `lib/server/tipos-staff.ts` | reescribir |

---

### Tarea 1: Retirar el login

**Ficheros:**
- Borrar: `apps/studio/app/login/page.tsx` (y el directorio), `apps/studio/proxy.ts`, `apps/studio/lib/supabase.ts`, `apps/studio/lib/supabase-browser.ts`, `apps/studio/lib/supabase-server.ts`
- Modificar: `apps/studio/components/admin/AdminShield.tsx`, `apps/studio/package.json`, `apps/studio/scripts/shoot-admin.ts`, `AGENTS.md`

- [ ] **Paso 1: Comprobar que nadie más importa los clientes** — `rg -n "supabase-browser|supabase-server|@/lib/supabase\"" apps packages`
- [ ] **Paso 2: Quitar el cierre de sesión de `AdminShield`** — fuera el import, el `handleLogout` y el botón; el resto del componente (escudo del club) se queda
- [ ] **Paso 3: Borrar login, proxy y clientes**
- [ ] **Paso 4: Quitar `@supabase/ssr` y `@supabase/supabase-js`** de `apps/studio/package.json` y `pnpm install`
- [ ] **Paso 5: Actualizar las instrucciones de `shoot-admin.ts` y la línea de `AGENTS.md`** que condiciona `pnpm e2e` a `DEV_AUTH_BYPASS=1`
- [ ] **Paso 6: `pnpm --filter studio build`** — verde, y `/admin` ya no redirige
- [ ] **Paso 7: `pnpm e2e` sin `DEV_AUTH_BYPASS`** — las 12 pruebas pasan igual
- [ ] **Paso 8: Commit**

---

### Tarea 2: Sustituir el respaldo estático por un estado de error

Contexto: ver «El hallazgo que cambia una tarea». El objetivo no es borrar el fichero, es que un fallo de lectura **se vea**.

**Ficheros:**
- Borrar: `apps/studio/lib/data/season-2026-2027.ts`
- Modificar: `apps/studio/lib/useCompeticiones.ts`, `apps/studio/components/admin/cartel/useCartelForm.ts`
- Crear: `apps/studio/lib/useCompeticiones.test.ts`

**Interfaces:**
- `useCompeticiones` pasa a exponer `errorCompeticiones: string | null` junto a lo que ya devuelve.

- [ ] **Paso 1: Escribir las pruebas que fallan** — el hook con una lectura que lanza deja el catálogo vacío y `errorCompeticiones` con mensaje; con una lectura que devuelve filas, las devuelve y `errorCompeticiones` a `null`; y **nunca** aparece un id `comp-senior-2026-2027`
- [ ] **Paso 2: Comprobar que fallan**
- [ ] **Paso 3: Implementar en `useCompeticiones`** — fuera el respaldo, dentro el error
- [ ] **Paso 4: Implementar en `useCartelForm`** — mismo criterio: sin competiciones no se inventan equipos ni partidos; el selector queda vacío y avisa
- [ ] **Paso 5: Borrar `lib/data/season-2026-2027.ts`** y comprobar que nadie lo importa
- [ ] **Paso 6: Comprobar que las pruebas pasan y `pnpm --filter studio typecheck`**
- [ ] **Paso 7: Comprobar a mano que el generador de carteles sigue trayendo rivales reales** — es la pantalla que más dependía del respaldo
- [ ] **Paso 8: Commit**

---

### Tarea 3: Renombrar `lib/supabase-queries.ts`

Contexto: el fichero ya no tiene Supabase dentro —desde 2B llama a acciones de servidor—, pero el nombre hace creer lo contrario y es el que dispara 7 de las 11 coincidencias de `rg -i supabase apps`.

**Ficheros:**
- Renombrar: `apps/studio/lib/supabase-queries.ts` → `apps/studio/lib/lecturas-cliente.ts`
- Modificar (los 7 que lo importan): `components/admin/AdminActaImporter.tsx`, `AdminEquipos.tsx`, `AdminJornadaImporter.tsx`, `AdminJornadas.tsx`, `AdminLeague.tsx`, `components/admin/cartel/useCartelForm.ts`, `lib/useCompeticiones.ts`, `lib/cartel/clasificacion-data.ts`
- Modificar (comentarios obsoletos): `components/admin/cartel/useCartelAssets.ts`, `lib/dto.ts`, `lib/server/tipos-staff.ts`

- [ ] **Paso 1: `git mv` y actualizar los imports**
- [ ] **Paso 2: Reescribir los tres comentarios** que nombran Supabase como si aún fuese el origen de los datos
- [ ] **Paso 3: `pnpm check`**
- [ ] **Paso 4: Commit**

---

### Tarea 4: Limpieza final y verificación

**Ficheros:**
- Modificar: `apps/studio/next.config.ts`, `apps/studio/e2e/*.spec.ts`
- Borrar: `legacy/supabase/`

- [ ] **Paso 1: Quitar `images.remotePatterns`** de `next.config.ts` — ya no hay imágenes remotas: la media sale del route handler local
- [ ] **Paso 2: Borrar `legacy/supabase/`** — 27 SQL y 2 `.mjs` de la época de la nube; siguen en el historial de git
- [ ] **Paso 3: Generalizar las comprobaciones de red de las pruebas e2e** — hoy comprueban «ninguna petición a `supabase.co`»; sin Supabase eso ya no dice nada. La invariante que importa en una herramienta local es **ninguna petición a ningún host externo**, así que se comprueba eso
- [ ] **Paso 4: Criterio de aceptación del spec** — `rg -i supabase apps packages` sin resultados
- [ ] **Paso 5: `pnpm check`, `pnpm --filter studio build` y `pnpm e2e` completos**
- [ ] **Paso 6: Capturas nuevas de referencia** — `pnpm dlx tsx apps/studio/scripts/shoot-admin.ts` con `pnpm dev` levantado, a `data/referencias/antes-fase-3/`. Comparar con `antes-fase-2/`: el panel debe verse **igual** salvo el botón de cerrar sesión, que ya no está. Esta tanda pasa a ser el patrón de la Fase 3
- [ ] **Paso 7: Los 5 carteles de referencia siguen idénticos byte a byte** — `pnpm dlx tsx apps/studio/scripts/render-cartel.ts`
- [ ] **Paso 8: Commit**

---

## Lo que queda después

- **`tools/migracion-supabase` sigue viva**, y con ella las dos variables que necesita en `.env.local`. Cuando el usuario decida que no va a volver a leer la nube, se borran juntas: la herramienta, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- **Líneas que el usuario ya puede borrar de `apps/studio/.env.local`**, porque después de esta fase no las lee nadie: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` y `DEV_AUTH_BYPASS`. Lo hace él: el fichero es suyo y es secreto.
- **El respaldo `~/santiso-antes-de-2b.db` puede borrarse** cuando esta fase esté fusionada y el usuario haya usado la herramienta con datos reales sin sobresaltos.
- **Fase 3B** (shell, menú agrupado, rutas por sección) se desbloquea en cuanto esto entre en `main`. Ver [el traspaso a Astra](../traspasos/2026-09-21-fase-3a-astra.md).
