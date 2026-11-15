# Carteles: simplificar y rediseñar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alineación sobre campo táctico (camiseta real, editor estilo Fantasy), Resultado = Cronoloxía rediseñada, y un paquete «Después del partido» que genera y comparte juntos Resultado + O Noso 11.

**Architecture:** Lógica táctica pura en `lib/cartel2/tactica.ts`; colocaciones por partido en una tabla nueva `partido_colocaciones` (momento `previa`/`final`), separada de `partido_alineaciones` y del acta. Plantilla nueva `campo` (publicación e historia) sustituye a `once` y `alineacion`; la plantilla `cronoloxia` se rediseña y pasa a ser el paso «resultado». El paquete de después reutiliza el mecanismo de compartir de `PaqueteAxenda`.

**Tech Stack:** Next.js (leer `node_modules/next/dist/docs/` antes de tocar rutas/acciones), React, Drizzle 0.45 core sobre libSQL, zod, Vitest, Playwright. Solo `pnpm`.

**Spec:** `docs/superpowers/specs/2026-11-15-carteles-simplificar-design.md`

## Global Constraints

- Solo `pnpm`. Drizzle solo query builder core, nunca `db.query`.
- Esquema: editar `packages/db/src/schema`, `pnpm db:generate --name <cambio>`, pruebas en `packages/db/src/schema.test.ts`.
- `pnpm check` es la puerta de cada commit. `pnpm e2e` al cerrar tareas que cambian pantallas (solo lee `data/`). Pruebas que escriben, en `apps/studio/e2e-escritura/` con datos de `sembrar.ts`; ninguna prueba escribe en `data/`.
- Móvil desde 360 px de ancho y escritorio desde 1280×720.
- Carteles: publicación 4:5 (1080×1350), historia 9:16 (1080×1920) con `MARGEN_HISTORIA` = 250 px libres arriba y abajo.
- Estilo unificado: sin `repeating-linear-gradient` de rayas amarillas/negras de franja, sin cortes secos de color; colores fundidos. Club = amarillo `#f5c518` y negro.
- Camiseta: amarilla con rayas verticales negras, tres franjas negras en hombros, cuello amarillo, dorsal blanco con borde negro. Portero: rosa (`#ec4e9c`) con detalles negros, dorsal negro. Igual Senior y Veteranos. Sin fotos de jugadores en la alineación.
- Textos del cartel en gallego («O Noso 11», «Once inicial», «Resultado», «Suplentes», «Banco», «DESCANSO»).
- No borrar filas antiguas de `carteles_partido` ni PNG de `media/carteles/`.
- Sin commits en `main`: trabajar en rama `carteles-simplificar` (worktree). Migrar la base real solo tras `pnpm db:backup` y con autorización de Iván.
- Referencia visual: bocetos H, I, J, K, L en `G:\Mi unidad\Santiso\bocetos-carteles\` (HTML fuente en `C:\Users\Ivan_\bocetos-carteles\gen3.cjs`, `gen4.cjs`).

## Review Focus

1. Convocatoria con menos de 11 o sin porteros: huecos quedan vacíos (se dibuja hueco sin camiseta o se omite), nunca error ni jugador duplicado.
2. Cambiar de sistema con huecos ya elegidos: los mismos once siguen colocados (re-colocación automática), nadie se pierde ni se duplica.
3. Jugador colocado que deja de estar convocado / en el acta: se quita de su hueco al cargar, sin romper.
4. Nombres largos («Roberto Pardo Vázquez») y 18+ eventos: el texto no se sale del lienzo.
5. Partido sin colocación final (Veteranos, sin previa): O Noso 11 arranca con colocación automática desde los titulares del acta; y si no hay acta, desde la convocatoria.

---

### Task 1: Lógica táctica pura

**Files:**
- Create: `apps/studio/lib/cartel2/tactica.ts`
- Test: `apps/studio/lib/cartel2/tactica.test.ts`

**Interfaces:**
- Produces:
  - `SISTEMAS: readonly ["4-4-2","4-3-3","4-2-3-1","3-5-2","4-1-4-1","5-3-2"]`, `type Sistema`.
  - `type Linea = "POR"|"DEF"|"MED"|"DEL"`; `interface Hueco { x: number; y: number; linea: Linea }` (x,y en 0–100; y=0 ataque arriba, y=100 portería abajo).
  - `huecosDe(sistema: Sistema): readonly Hueco[]` (siempre 11; índice 0 = portero).
  - `type Huecos = (string | null)[]` (11 ids de jugador o null).
  - `lineaDe(posicion: Posicion | null): Linea | null` — POR→POR; LD,DFC,LI→DEF; MCD,MC,MCO,MD,MI→MED; ED,EI,DC→DEL.
  - `colocarAutomatico(sistema: Sistema, jugadores: { id: string; posicion: Posicion | null }[]): Huecos` — primero cada jugador a un hueco libre de su línea (en orden de la lista), luego el resto a huecos libres de izquierda a derecha y de atrás adelante; como mucho 11.
  - `ponerEnHueco(huecos: Huecos, indice: number, jugadorId: string): Huecos` — si el jugador ya estaba en otro hueco, intercambia con el ocupante.
  - `quitarDeHueco(huecos: Huecos, indice: number): Huecos`.
  - `cambiarSistema(huecos: Huecos, nuevo: Sistema, jugadores: { id: string; posicion: Posicion | null }[]): Huecos` — `colocarAutomatico` con solo los ids presentes en `huecos`, en su orden.
  - `depurar(huecos: Huecos, disponibles: readonly string[]): Huecos` — vacía huecos cuyo jugador no está en `disponibles` y duplicados.

- [ ] **Step 1: Write the failing tests**

```ts
it("cada sistema tiene 11 huecos y el primero es portero", () => {
  for (const s of SISTEMAS) { expect(huecosDe(s)).toHaveLength(11); expect(huecosDe(s)[0]!.linea).toBe("POR"); }
});
it("4-4-2 tiene 4 DEF, 4 MED y 2 DEL", () => {
  const n = (l: Linea) => huecosDe("4-4-2").filter((h) => h.linea === l).length;
  expect([n("DEF"), n("MED"), n("DEL")]).toEqual([4, 4, 2]);
});
it("coloca por línea y rellena el resto", () => {
  const h = colocarAutomatico("4-4-2", [{ id: "dc", posicion: "DC" }, { id: "por", posicion: "POR" }, { id: "x", posicion: null }]);
  expect(h[0]).toBe("por");
  expect(huecosDe("4-4-2")[h.indexOf("dc")]!.linea).toBe("DEL");
  expect(h.filter(Boolean)).toHaveLength(3);
});
it("con 13 jugadores coloca 11 sin duplicar", () => { /* 13 ids → 11 únicos */ });
it("ponerEnHueco intercambia si el jugador ya estaba colocado", () => {
  expect(ponerEnHueco(["a", "b", ...Array(9).fill(null)], 1, "a").slice(0, 2)).toEqual(["b", "a"]);
});
it("cambiarSistema conserva a los once", () => { /* mismos ids como conjunto */ });
it("depurar quita no disponibles y duplicados", () => {
  expect(depurar(["a", "a", "z", ...Array(8).fill(null)], ["a"]).filter(Boolean)).toEqual(["a"]);
});
```

- [ ] **Step 2: Run** `pnpm --filter @santiso/studio test tactica` → FAIL (módulo no existe).
- [ ] **Step 3: Implement** `tactica.ts`. Coordenadas: copiar las del boceto (`ONCE` en `gen3.cjs`) para 4-4-2 y derivar el resto con el mismo reparto (portero y≈92, defensas y≈72, medios y≈46, delanteros y≈17; tres líneas de medio en 4-2-3-1 a y≈56 y y≈34). `Posicion` de `@santiso/domain`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(carteles): lógica de sistemas y huecos para la alineación en campo`.

### Task 2: Tabla `partido_colocaciones`

**Files:**
- Modify: `packages/db/src/schema/partido.ts` (añadir tabla junto a `partidoAlineaciones`)
- Create: migración con `pnpm db:generate --name colocaciones`
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: `schema.partidoColocaciones` con columnas `partidoId` (FK `partidos.id`, cascade), `momento` (`"previa" | "final"`, `checkEnum`), `sistema` (text, `checkEnum` con `SISTEMAS` copiados como constante en el esquema — `packages/db` no importa de la app), `huecos` (text json `(string|null)[]`), `actualizadoEn`. PK `(partidoId, momento)`. Exporta `MOMENTOS_COLOCACION`.

- [ ] **Step 1: Test**: insertar `previa` y `final` para el mismo partido OK; segundo `previa` mismo partido → error PK; `momento: "otro"` → error check; borrar partido borra colocaciones.
- [ ] **Step 2: Run** `pnpm --filter @santiso/db test` → FAIL.
- [ ] **Step 3: Implement** tabla + `pnpm db:generate --name colocaciones`. No tocar `partido_alineaciones`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(db): colocaciones tácticas por partido (previa y final)`.

### Task 3: Servidor de colocaciones y huellas

**Files:**
- Create: `apps/studio/lib/server/acciones/colocacion.ts`
- Modify: `apps/studio/lib/server/consultas/alineacion.ts` (añadir `posicion` a cada jugador y la colocación previa)
- Modify: `apps/studio/lib/alineacion/modelo.ts` (`JugadorAlineacion.posicion: Posicion | null`; `PantallaAlineacion.colocacion: Colocacion | null`)
- Modify: `apps/studio/lib/server/carteles/guardados.ts` (huellas)
- Test: `apps/studio/lib/server/acciones/colocacion.test.ts`, `apps/studio/lib/server/carteles/guardados.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Sistema`, `Huecos`, `depurar`), Task 2 (`schema.partidoColocaciones`).
- Produces:
  - `interface Colocacion { sistema: Sistema; huecos: Huecos }` (en `lib/cartel2/tactica.ts`).
  - `"use server"` `cargarColocacion(partidoId: string, momento: "previa"|"final"): Promise<Resultado<Colocacion | null>>`.
  - `guardarColocacion(partidoId: string, momento: "previa"|"final", c: Colocacion): Promise<Resultado<null>>` — valida sistema, 11 huecos, ids existentes y sin duplicados; `previa` no se cambia con partido `finalizado` (mismo mensaje que `guardarAlineacion`); `final` sí. Upsert.
  - Huellas: `once` incluye la colocación `previa`; `noso11` incluye la colocación `final`; `resultado` pasa a `hash({ base, marcador, eventos })` (la de cronoloxía).

- [ ] **Step 1: Tests**: guardar/cargar ida y vuelta por momento; `previa` en finalizado → fallo; `final` en finalizado → OK; guardar `final` no crea filas en `partido_alineaciones` ni cambia `huellaPaso(id,"once")`; cambiar `final` cambia `huellaPaso(id,"noso11")`; cambiar un evento cambia `huellaPaso(id,"resultado")`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(carteles): guardar colocación previa y final, y huellas`.

### Task 4: Plantilla `campo` (O Noso 11 y Once inicial)

**Files:**
- Create: `apps/studio/components/cartel2/CartelCampo.tsx`, `CartelCampo.module.css`, `Camiseta.tsx`
- Modify: `apps/studio/lib/cartel2/modelo.ts` (`PLANTILLAS` + `"campo"`, `PeticionCartel`, `medidasDe`), `lib/cartel2/esquema.ts` (zod), `components/cartel2/Cartel.tsx`
- Test: `apps/studio/lib/cartel2/cartel2.test.ts`

**Interfaces:**
- Consumes: Task 1 (`huecosDe`, `Sistema`).
- Produces:
  - `interface JugadorCampo { dorsal: string; nombre: string; capitan: boolean; portero: boolean }`.
  - `interface DatosCampo extends Logos, Competicion { momento: "previa"|"final"; club: EquipoCartel; rival: EquipoCartel; local: boolean; fecha: string; hora: string; campo: string; golesClub: number|null; golesRival: number|null; sistema: Sistema; huecos: (JugadorCampo|null)[]; suplentes: JugadorOnce[] }`.
  - `PeticionCartel` gana `{ plantilla: "campo"; formato: FormatoCartel; datos: DatosCampo }`; `medidasDe("campo","historia")` = `MEDIDAS_HISTORIA`.
  - `<Camiseta dorsal: string; portero: boolean />` (SVG del boceto `gen3.cjs` → `camiseta()`).
- Diseño: publicación = boceto H; historia = boceto I (título «Once inicial» si `momento==="previa"`, «O Noso 11» si `final`; en publicación con marcador en pastilla si hay goles). Hueco `null` → no se dibuja.

- [ ] **Step 1: Tests** en `cartel2.test.ts`: `leerPeticion` acepta `campo` válido en ambos formatos; rechaza 10 huecos y sistema desconocido; `medidasDe("campo","historia")` y `("campo","publicacion")`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Render de muestra**: generar PNG de ambos formatos con datos de los bocetos (script local o vista `/render/cartel`) y comparar con H e I.
- [ ] **Step 6: Commit** `feat(carteles): cartel de alineación sobre campo con la camiseta del club`.

### Task 5: Resultado = Cronoloxía rediseñada

**Files:**
- Modify: `apps/studio/components/cartel2/CartelCronoloxia.tsx` + `.module.css`, `apps/studio/lib/cartel2/cronoloxia.ts`
- Test: `apps/studio/lib/cartel2/cartel2.test.ts` (o `cronoloxia.test.ts` nuevo)

**Interfaces:**
- Produces: `filasLinea(eventos: readonly EventoCartel[], max = 13): { enLinea: EventoCartel[]; amarillasLocal: EventoCartel[]; amarillasVisitante: EventoCartel[] }` — con `eventos.length > max`, en línea solo goles, rojas, dobles amarillas (y cambios si los hay); amarillas al resumen. `medidasLinea` se adapta a una línea central (filas, no dos columnas) y además devuelve `escudo` y `marcador` reducidos cuando la letra bajaría del mínimo (mínimo de cuerpo 30 px).
- Diseño: boceto J/K/L — título «Resultado», marcador con escudos (goles propios en amarillo), línea de tiempo central con minuto en pastilla, local a la izquierda, visitante a la derecha, separador «DESCANSO» entre ≤45 y >45, pie día·campo, focos del color de cada equipo. Mantiene logos y foto opcional como hoy.

- [ ] **Step 1: Tests**: 7 eventos → todo en línea; 18 eventos con 9 amarillas → amarillas fuera de la línea, repartidas por lado; con 18 eventos la letra resultante ≥ 30.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Render de muestra** con los datos de K (Senior 1-1 Arzúa B) y L (18 eventos); comparar con bocetos.
- [ ] **Step 6: Commit** `feat(carteles): resultado con línea de tiempo central`.

### Task 6: Pasos, menú y cierre

**Files:**
- Modify: `apps/studio/lib/cartel2/pasos.ts`, `lib/jornada/vestiario.ts`, `components/admin/jornada/TarjetaPartido.tsx`, `components/admin/liga/AdminPartidos.tsx`, `lib/navigation/menu.ts`, `components/admin/cartel/types.ts`, `components/admin/GeneradorCartel.tsx`, `lib/cartel/instagram.ts`
- Delete si quedan sin usos (comprobar con grep): `components/cartel2/CartelResultado.*`, `CartelOnce.*`, `CartelAlineacion.*`, `components/admin/cartel/FormResumo.tsx`, `FormNoso11.tsx`, `FormProximos.tsx` (solo si `PaqueteAxenda` no depende de él) y sus ramas en `esquema.ts`/`modelo.ts`/`formulario.ts`. `DatosConvocatoria` conserva sus campos actuales (dejar de extender `DatosAlineacion` si se borra).
- Test: `apps/studio/lib/jornada/vestiario.test.ts` (o el existente), `cartel2.test.ts`

**Interfaces:**
- Produces:
  - `PASOS.once = { plantilla: "campo", formatos: ["historia"], nombre: "Once inicial" }`; `PASOS.resultado = { plantilla: "cronoloxia", formatos: ["publicacion"], nombre: "Resultado" }`; `PASOS.noso11 = { plantilla: "campo", formatos: ["publicacion"], nombre: "O Noso 11" }`; `PASOS.cronoloxia` se queda con `retirado: true` (no sale en listas; las filas antiguas siguen leyéndose). `PASOS_VISIBLES: PasoCartel[]` sin retirados.
  - `PASOS_DESPUES = ["resultado", "noso11"] as const`.
  - `cierreHecho(c)` = `PASOS_DESPUES` todos no pendientes.
  - Menú «Después del partido»: una entrada `cartel("despues", "Resultado e O Noso 11", "Carrusel de después", I.marcador)`. «Antes del partido»: sin cambios salvo que Próximos abre solo el carrusel.
  - Enlaces de Inicio/Partidos a pasos de después → `/admin/carteles?plantilla=despues&partido=<id>`.
  - Texto de Instagram del paquete de después: el de cronoloxía actual con el once («O Noso 11: …») añadido al final.

- [ ] **Step 1: Tests**: `cierreHecho` con solo resultado → false; con resultado y noso11 → true; con cronoloxía antigua y sin resultado → false. `leerPeticionesPaso("once", [campo historia])` OK y con `alineacion` → error.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y borrar huérfanos (grep antes de cada borrado). **Step 4:** `pnpm check` → PASS.
- [ ] **Step 5: Commit** `refactor(carteles): pasos de después juntos y fuera los carteles retirados`.

### Task 7: Editor táctico (Fantasy)

**Files:**
- Create: `apps/studio/components/admin/cartel/EditorTactico.tsx`, `EditorTactico.module.css`
- Modify: `apps/studio/components/admin/alineacion/AdminAlineacion.tsx`
- Test: `apps/studio/e2e-escritura/alineacion-escritura.spec.ts` (ampliar)

**Interfaces:**
- Consumes: Task 1, Task 3 (`cargarColocacion`, `guardarColocacion`, `JugadorAlineacion.posicion`), Task 4 (`CartelCampo` para la vista previa).
- Produces: `<EditorTactico jugadores: { id; nombre; dorsal; posicion }[]; colocacion: Colocacion; onCambio(c: Colocacion): void; soloLectura?: boolean />`.
- Comportamiento: selector de sistema; campo plano (no 3D) con 11 huecos; tocar hueco vacío → hoja inferior con los disponibles no colocados; tocar jugador colocado → misma hoja con «Cambiar por…» (lista) y «Quitar». Sin arrastre. Botones ≥ 44 px; cabe en 360 px.
- En Alineación: disponibles = los titulares elegidos (la pantalla ya filtra por convocatoria); al abrir sin colocación previa → `colocarAutomatico`; guardar con el botón de la pantalla junto a la alineación (`guardarAlineacion` + `guardarColocacion(…,"previa",…)`); el paso «once» genera `campo` historia.

- [ ] **Step 1: e2e (escritura)**: con base sembrada, elegir 11 titulares, sistema 4-3-3, tocar un hueco y cambiar jugador, guardar, recargar → misma colocación; viewport 360×740 y 1280×720.
- [ ] **Step 2: Run** `pnpm e2e:escritura alineacion` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(alineacion): colocar el once en el campo eligiendo hueco`.

### Task 8: Paquete «Después del partido»

**Files:**
- Create: `apps/studio/components/admin/cartel/PaqueteDespues.tsx`, `.module.css`
- Create: `apps/studio/components/admin/cartel/compartirArchivos.ts` (extraer de `PaqueteAxenda.compartir`/`descargar`)
- Modify: `PaqueteAxenda.tsx` (usar el helper), `GeneradorCartel.tsx` (plantilla `despues`), `app/api/carteles/guardar/route.ts` solo si hace falta guardar dos pasos en una llamada (preferible: dos llamadas, una por paso)
- Test: `apps/studio/e2e-escritura/movil-carteles.spec.ts` (ampliar)

**Interfaces:**
- Consumes: Tasks 3–7; `CartelesDelPaso` como referencia de guardado/estado; `FormCronoloxia` para retocar eventos.
- Produces: `compartirArchivos(archivos: File[], titulo: string, texto: string): Promise<"compartido"|"descargado">`; `<PaqueteDespues partidoId categoria showToast />`.
- Pantalla: (1) Resultado: vista previa + `FormCronoloxia` plegado; (2) O Noso 11: `EditorTactico` con colocación `final` (arranca de la `final` guardada; si no, de la `previa` depurada con los titulares del acta; si no, `colocarAutomatico` con titulares del acta o, sin acta, con la convocatoria); (3) botón único «Generar» que guarda los pasos `resultado` y `noso11` y la colocación `final`; (4) botón único «Guardar o compartir» con los dos PNG en orden Resultado, O Noso 11 y el texto de Instagram. Estado desactualizado como `CartelesDelPaso`.

- [ ] **Step 1: e2e (escritura)**: partido finalizado sembrado con acta → abrir paquete, «Generar» → ambos pasos guardados (Inicio deja de pedirlo); cambiar un hueco → aparece desactualizado; móvil 360 px.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(carteles): resultado y O Noso 11 juntos en un carrusel`.

### Task 9: Verificación y entrega

- [ ] **Step 1:** `pnpm check` → todo verde.
- [ ] **Step 2:** `pnpm e2e` (con `pnpm dev` parado salvo lo que el comando arranque) → verde; actualizar pruebas de solo lectura que mencionen Cronoloxía/Resultado/Once antiguos.
- [ ] **Step 3:** `pnpm e2e:escritura` y `pnpm e2e:acceso` → verde (el técnico sigue pudiendo hacer alineación).
- [ ] **Step 4:** Generar con la app (base de juguete) los PNG de Once inicial, Resultado (pocos y muchos eventos) y O Noso 11; copiarlos a `G:\Mi unidad\Santiso\bocetos-carteles\app\` y pedir visto bueno a Iván.
- [ ] **Step 5:** Con su autorización: `pnpm db:backup`, `pnpm db:migrate` (desde el repo principal), `pnpm db:verificar-copia`; fusionar y avanzar la copia estable según la memoria «acceso-movil-tailscale».
