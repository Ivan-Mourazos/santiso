# Libreta del partido en directo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pantalla móvil para apuntar en directo goles, tarjetas y cambios de los dos equipos, con cronómetro, cola sin cobertura, vista para cerrar el acta con el árbitro. Apuntes personales: nunca tocan el acta.

**Architecture:** Dos tablas nuevas (`partido_directo`, `partido_directo_eventos`) separadas del acta. Lógica pura en `apps/studio/lib/directo/` (reloj, cola), acciones de servidor en `lib/server/acciones/directo.ts`, pantalla en sección oculta `directo` abierta desde la ficha del partido en Liga → Partidos.

**Tech Stack:** Next (versión del repo: leer `node_modules/next/dist/docs/` antes de tocar rutas), React, Drizzle 0.45 core sobre libSQL, Vitest, Playwright, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-14-libreta-directo-design.md`

## Global Constraints

- Solo `pnpm`. `pnpm check` en verde antes de cada commit.
- Drizzle: solo query builder core, nunca `db.query`. Esquema en `packages/db/src/schema`, migración con `pnpm db:generate --name libreta-directo`.
- Ninguna prueba escribe en `data/`. Pruebas que escriben → `apps/studio/e2e-escritura/`, datos en `sembrar.ts`.
- Móvil desde 360 px y escritorio desde 1280×720. Estilo actual (look D, grafito); sin modo claro.
- Textos de interfaz en castellano.
- Con `STUDIO_ACCESO=1` todo pasa por `obtenerDb()`; la sección la usan admin y técnico (no `admin: true`).
- La libreta nunca escribe en `partido_eventos`, `partido_participaciones` ni `partidos`, ni hay botón para pasarla al acta (decisión de Iván: se guarda solo el acta oficial).
- Duración de parte por defecto: 45. Descuento se muestra `45+2` / `90+3`.

## Review Focus

1. Móvil bloqueado o pestaña en segundo plano 10 min → al volver el minuto es el real (reloj por marcas de tiempo). Test en Task 2.
2. Mismo evento enviado dos veces (reintento tras corte) → una sola fila. Test en Task 3.
3. Alta y borrado del mismo evento estando sin red → tras enviar no queda nada; orden de la cola respetado. Test en Task 4.
4. Recargar la página con cola pendiente → la cola se conserva y se envía; lo pendiente se ve en la lista. Test en Task 6 (e2e).
5. Jugador borrado de la plantilla con eventos apuntados → la libreta sigue abriendo y muestra el dorsal (FK `set null`). Test en Task 3.

---

### Task 1: Esquema de la libreta

**Files:**
- Create: `packages/db/src/schema/directo.ts`
- Modify: `packages/db/src/schema/index.ts` (añadir `export * from "./directo";`)
- Create: migración generada en `packages/db/drizzle/` (o la carpeta que use `pnpm db:generate`)
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: `schema.partidoDirecto`, `schema.partidoDirectoEventos`; constante `ESTADOS_RELOJ = ["previo","primera","descanso","segunda","final"] as const` y tipo `EstadoReloj` en `@santiso/domain` (`catalogos.ts`).

Tablas:
- `partido_directo`: `partido_id` PK → `partidos.id` cascade; `duracion_parte` int not null default 45 (check 10–60); `estado` text enum `ESTADOS_RELOJ` default `previo`; `inicio_parte` int null (epoch ms); `pausado_ms` int not null default 0; `pausa_desde` int null; `marcasTiempo()`.
- `partido_directo_eventos`: `id` text PK (lo genera el móvil, sin default); `partido_id` → `partidos.id` cascade; `tipo` (`TIPOS_EVENTO`); `lado` (`LADOS_EVENTO`); `propia` bool default false (check solo gol); `parte` int not null (check 1 o 2); `minuto` int null (check 0–`MINUTO_MAXIMO`); `jugador_id`, `jugador_sale_id` → `jugadores.id` **on delete set null**; `dorsal`, `dorsal_sale` int null (check ≥0); `nota` text not null default ''; `marcasTiempo()`. Índice `(partido_id, parte, minuto)`. Sin check de cambio completo (en directo se puede apuntar a medias).

- [ ] **Step 1: Test que falla** en `schema.test.ts`: `it("libreta directo: id del móvil, cascada y checks")` — inserta partido + fila `partido_directo` + evento con `id: "m-1"`; espera rechazo con `parte: 3`, con `propia: true` y `tipo: "tarjeta_amarilla"`, con `dorsal: -1`; borra el partido y espera 0 filas en ambas tablas.
- [ ] **Step 2:** `pnpm --filter @santiso/db test` → FAIL (tabla no existe).
- [ ] **Step 3:** Escribir `directo.ts`, exportarlo, añadir `ESTADOS_RELOJ` al dominio, `pnpm db:generate --name libreta-directo`.
- [ ] **Step 4:** `pnpm --filter @santiso/db test` → PASS.
- [ ] **Step 5: Commit** `feat(db): tablas de la libreta del partido en directo`

### Task 2: Reloj del partido (puro)

**Files:**
- Create: `apps/studio/lib/directo/reloj.ts`
- Test: `apps/studio/lib/directo/reloj.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RelojDirecto { duracionParte: number; estado: EstadoReloj; inicioParte: number | null; pausadoMs: number; pausaDesde: number | null }
  export const RELOJ_INICIAL: RelojDirecto
  export function minutoActual(r: RelojDirecto, ahora: number): { parte: 1 | 2; minuto: number } | null
  export function segundosParte(r: RelojDirecto, ahora: number): number   // para el «63:12»
  export function etiquetaMinuto(parte: 1 | 2, minuto: number | null, duracion: number): string
  export function avanzarReloj(r: RelojDirecto, accion: "empezar" | "descanso" | "segunda" | "final" | "pausa" | "seguir", ahora: number): RelojDirecto
  ```
- Reglas: minuto = `floor(transcurrido / 60000) + 1`, sumando `duracion` en la segunda; transcurrido descuenta `pausadoMs` y la pausa en curso. `previo`/`final` → `null` (la UI deja minuto en blanco); `descanso` → `{ parte: 1, minuto: duracion }`. Etiqueta: por encima de `duracion*parte` → `"45+2"`; null → `""`; resto `"23'"`.

- [ ] **Step 1: Tests que fallan:** `minuto 1 al empezar`, `{parte:1,minuto:23}` a los 22:30, `pausa de 5 min no cuenta`, `segunda: 1 min tras empezar → 46`, `10 min en segundo plano → minuto real (solo marcas de tiempo)`, `etiquetaMinuto(1,47,45) === "45+2"`, `etiquetaMinuto(2,93,45) === "90+3"`, `avanzarReloj` de `previo` con `"segunda"` lanza o devuelve igual (elegir: devuelve igual).
- [ ] **Step 2:** `pnpm --filter studio test lib/directo/reloj` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(directo): reloj por partes con descuento`

### Task 3: Acciones de servidor

**Files:**
- Create: `apps/studio/lib/directo/tipos.ts`, `apps/studio/lib/server/acciones/directo.ts`
- Test: `apps/studio/lib/server/acciones/directo.test.ts` (patrón de `convocatoria.test.ts`: BD temporal con `SANTISO_DATA_DIR`)

**Interfaces:**
- Consumes: `RelojDirecto` (Task 2), tablas (Task 1), `jugadoresDePartido` y `listarJugadores` existentes.
- Produces (`tipos.ts`):
  ```ts
  export interface EventoDirecto { id: string; tipo: TipoEvento; lado: LadoEvento; propia: boolean; parte: 1 | 2; minuto: number | null; jugadorId: string | null; jugadorSaleId: string | null; dorsal: number | null; dorsalSale: number | null; nota: string }
  export type OperacionDirecto = { op: "guardar"; evento: EventoDirecto } | { op: "borrar"; id: string } | { op: "reloj"; reloj: RelojDirecto }
  export interface JugadorDirecto { id: string; nombre: string; dorsal: number | null }
  export interface PantallaDirecto { partido: { id: string; categoria: string; local: string; visitante: string; somosLocal: boolean; conActa: boolean }; reloj: RelojDirecto; eventos: EventoDirecto[]; jugadores: JugadorDirecto[] }
  ```
- Produces (`directo.ts`, `"use server"`):
  - `cargarDirecto(partidoId: string): Promise<Resultado<PantallaDirecto>>` — reloj guardado o `RELOJ_INICIAL`; eventos ordenados por parte, minuto, creación; jugadores = `jugadoresDePartido` si trae alguno, si no `listarJugadores(categoria)`; dorsal de la temporada activa.
  - `aplicarDirecto(partidoId: string, ops: OperacionDirecto[]): Promise<Resultado<null>>` — una transacción, en orden. `guardar` = insert … `onConflictDoUpdate` por `id`, rechazando si la fila existente es de otro partido; `borrar` = delete por `id` y `partidoId` (no falla si no existe); `reloj` = upsert en `partido_directo`. Valida con `TIPOS_EVENTO`/`LADOS_EVENTO`, `parte ∈ {1,2}`, minuto 0–`MINUTO_MAXIMO`; si algo es inválido → `fallo(...)` sin tocar nada.

- [ ] **Step 1: Tests que fallan:** `cargarDirecto sin libreta → reloj inicial, sin eventos, jugadores de la plantilla`; `con convocatoria → solo convocados`; `guardar dos veces el mismo id → 1 fila con los datos del segundo`; `borrar id inexistente → ok`; `id de otro partido → fallo y nada cambia`; `tipo inválido en la 3ª operación → fallo y las 2 primeras no se aplican`; `no toca partido_eventos ni partidos.estado`; `jugador borrado → evento conserva dorsal, jugadorId null`.
- [ ] **Step 2:** `pnpm --filter studio test lib/server/acciones/directo` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(directo): cargar y aplicar cambios de la libreta`

### Task 4: Cola sin cobertura (pura + almacenamiento)

**Files:**
- Create: `apps/studio/lib/directo/cola.ts`
- Test: `apps/studio/lib/directo/cola.test.ts`

**Interfaces:**
- Consumes: `OperacionDirecto`, `EventoDirecto` (Task 3).
- Produces:
  ```ts
  export function claveCola(partidoId: string): string           // "santiso:directo:<id>"
  export function leerCola(almacen: Pick<Storage,"getItem">, partidoId: string): OperacionDirecto[]
  export function escribirCola(almacen: Pick<Storage,"setItem"|"removeItem">, partidoId: string, ops: OperacionDirecto[]): void
  export function aplicarLocal(eventos: EventoDirecto[], ops: OperacionDirecto[]): EventoDirecto[]   // lo que se ve en pantalla
  export function compactar(ops: OperacionDirecto[]): OperacionDirecto[]
  export async function enviarCola(ops: OperacionDirecto[], enviar: (ops: OperacionDirecto[]) => Promise<Resultado<null>>): Promise<{ enviadas: number; error?: string }>
  ```
- `compactar`: por id deja la última operación; `guardar`+`borrar` del mismo id antes de enviarse → solo `borrar` (idempotente). Solo el último `reloj`. Conserva el orden relativo.
- `enviarCola` envía todo en un lote; si falla o lanza (sin red), `enviadas: 0` y la cola sigue intacta.
- JSON corrupto en `localStorage` → cola vacía, sin lanzar.

- [ ] **Step 1: Tests que fallan:** `aplicarLocal alta+edición+borrado`, `compactar guardar,guardar mismo id → uno`, `compactar guardar+borrar → borrar`, `enviarCola con enviar que lanza → enviadas 0`, `leerCola con basura → []`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementar. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(directo): cola local para apuntar sin cobertura`

### Task 5: Pantalla de directo

**Files:**
- Modify: `apps/studio/lib/navigation/contexto.ts` (añadir `{ id: "directo", label: "Directo", oculta: true }`)
- Modify: `apps/studio/components/studio/StudioSection.tsx` (cargar `AdminDirecto` con `dynamic`, como `Callup`)
- Create: `apps/studio/components/admin/directo/AdminDirecto.tsx`, `PanelEvento.tsx`, `CierreActa.tsx`, `AdminDirecto.module.css`
- Modify: `apps/studio/components/admin/liga/AdminPartidos.tsx` (en la ficha de partido propio: enlace «Directo» a `/admin/directo?categoria=…&partido=…`, visible antes y después del partido)

**Interfaces:**
- Consumes: Tasks 2–4.
- Comportamiento:
  - Lee `partido` de la URL; sin él, aviso «Abre el directo desde la ficha del partido».
  - Al montar: `cargarDirecto`, luego `aplicarLocal(eventos, leerCola(...))`; intenta `enviarCola`. Reintenta al evento `online`, cada 20 s si hay cola y tras cada operación.
  - Cada operación: `crypto.randomUUID()` para altas, actualiza pantalla, añade a la cola (`compactar` + `escribirCola`) y envía.
  - Cabecera fija: `SANTISO n – n RIVAL` (orden local/visitante real), parte y `mm:ss` (`segundosParte`, refresco 1 s), botones de reloj según estado (`Empezar 1ª parte` → `Descanso` → `Empezar 2ª parte` → `Final`; `⏸`/`▶`). Antes de empezar, campo «Minutos por parte» (45).
  - Cuatro botones grandes (≥56 px de alto): Gol, Amarilla, Roja, Cambio → `PanelEvento` (hoja inferior): Nosotros/Rival; nosotros = rejilla `#dorsal nombre` (sin dorsal al final); rival = teclado numérico + «Sin dorsal»; cambio pide «Entra» y luego «Sale»; gol con casilla «En propia». Minuto prellenado con `minutoActual`, editable.
  - Lista: más reciente arriba, `etiquetaMinuto · icono · #dorsal nombre` (rival en otro tono). Tocar → `PanelEvento` en modo edición con «Borrar» (confirmación).
  - «Pendiente de enviar (n)» pequeño bajo la cabecera cuando la cola no está vacía.
  - Pestaña/botón «Para cerrar el acta» → `CierreActa`: marcador y tabla por partes ordenada por minuto: `minuto · Santiso/Rival · #dorsal · nombre · evento`.
- [ ] **Step 1:** Leer en `node_modules/next/dist/docs/` lo relativo a client components y `useSearchParams` en esta versión.
- [ ] **Step 2:** Implementar sección, componentes y enlace.
- [ ] **Step 3:** `pnpm dev` y comprobar a mano en 360 px y 1280×720 contra una copia de la base (no `data/` real si se va a escribir: usar `SANTISO_DATA_DIR` a una copia).
- [ ] **Step 4:** `pnpm check` → verde.
- [ ] **Step 5: Commit** `feat(directo): pantalla para apuntar el partido en directo`

### Task 6: E2E de la libreta

**Files:**
- Modify: `apps/studio/e2e-escritura/sembrar.ts` (si falta: partido Senior propio con jugadores con dorsal y convocatoria)
- Create: `apps/studio/e2e-escritura/directo-escritura.spec.ts`

- [ ] **Step 1: Tests** (proyectos móvil 360 y escritorio, como los demás `*-escritura`):
  - `apunta gol propio, amarilla rival #7 y cambio; marcador 1–0 y lista correcta`.
  - `editar minuto y borrar un evento`.
  - `recargar conserva todo`.
  - `sin red: setOffline(true), apuntar 2 eventos → «Pendiente de enviar (2)» y siguen en la lista; setOffline(false) → indicador desaparece; recargar → siguen ahí` (Review Focus 4; recargar sin red no se prueba porque no hay service worker).
  - `reloj: empezar, page.clock.fastForward("22:30") → nuevo evento con 23'`.
  - `Para cerrar el acta muestra #7 Rival Amarilla`.
- [ ] **Step 2:** `pnpm e2e:escritura directo` → PASS (con `pnpm dev` parado). Luego `pnpm check` y `pnpm e2e` (solo lectura) → verdes.
- [ ] **Step 3: Commit** `test(directo): e2e de la libreta en directo`

