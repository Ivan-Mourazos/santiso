# Fase 2B-5 — Conectar el lector de fichas PDF a la pantalla de actas: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [x]`) para el seguimiento.

**Objetivo:** que subir la ficha en PDF de un partido rellene el acta sin pasar por la nube ni por OCR.

**Arquitectura:** `@santiso/actas` (el parser de Codex, ya fusionado) devuelve una `Ficha` **neutral**: habla de `local` y `visitante`. La pantalla trabaja con `ParsedActa`, que está **centrada en el Santiso**: habla de `isRival`, `esPropia` y `esPropiaSantiso`. Entre las dos va un adaptador **puro y probado aparte**; encima, una acción `"use server"` que lee el PDF en el servidor. La pantalla no cambia de forma: gana un botón más.

**Stack:** Next.js 16.3.5 · React 19.3.0 · `@santiso/actas` (unpdf 1.8.1) · Vitest 4.1.11 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md), «Fase 5».

**Plan anterior:** [2B-4](2026-09-20-fase-2b-4-actas-carteles.md), que construyó el guardado transaccional del acta. Este plan le da la fuente de datos.

## El hueco que cierra

Hoy la pantalla de actas tiene tres caminos y ninguno lee un PDF:

| Camino | Entrada | Dónde corre |
| --- | --- | --- |
| `analyzeImage` | imagen | Gemini, en la nube |
| `analyzeWithLocalOcr` | imagen | Tesseract, en el navegador |
| `reparseText` | texto pegado | `parseFutgalActaText`, heurístico |

El botón de OCR está **deshabilitado a propósito** cuando el fichero es un PDF (`AdminActaImporter.tsx:661`), así que hoy la única forma de procesar el PDF federativo es mandarlo a Gemini. El parser de Codex lo lee en local, por coordenadas, sin IA y con pruebas propias. Falta el cable.

## Las dos formas y la correspondencia entre ellas

`Ficha` es neutral; `ParsedActa` mira desde el Santiso. Sea `nos` el lado del Santiso en ese partido.

**Goles.** `GolFicha` trae `beneficiario` (a quién se le anota), `equipoAutor` (de quién es el autor, o `null` si el nombre aparece en las dos plantillas o en ninguna) y `tipo`, que vale `"propia"` solo cuando el autor es conocido y de la otra parte.

| `beneficiario` | `equipoAutor` | Evento |
| --- | --- | --- |
| `nos` | `nos` | gol propio, con jugador |
| `nos` | contrario | `esPropia: true`, `nombreRival` = autor |
| contrario | contrario | gol del rival, `nombreRival` |
| contrario | `nos` | `esPropiaSantiso: true`, con jugador |
| cualquiera | `null` | se supone **no** en propia, `confidence: "baja"` y aviso |

El caso `null` se resuelve hacia el gol normal a propósito: el gol en propia es raro, y la revisión manual está antes del guardado.

**Tarjetas.** La tabla solo admite `tarjeta_amarilla` y `tarjeta_roja`.

| `TarjetaFicha` | Evento |
| --- | --- |
| `amarilla` | `tarjeta_amarilla` |
| `roja` | `tarjeta_roja` |
| `doble_amarilla` | **una sola** `tarjeta_roja`, con aviso |
| `desconocido` | no se genera evento, con aviso |
| `destinatario: "tecnico"` | no se genera evento, con aviso |

La doble amarilla no se desdobla: el README del parser advierte de que el consumidor no debe duplicar el evento, y la tabla no guarda la amonestación previa.

Las sanciones al cuerpo técnico se descartan porque `partido_eventos.jugador_id` referencia `jugadores`: no hay dónde ponerlas.

**Cambios.** El CHECK `partido_eventos_cambio_ck` exige `lado = 'propio'` con los dos jugadores. Los cambios del rival **se descartan con aviso**; no es una decisión de diseño de este plan, es lo que la tabla admite.

**Minutos.** La ficha normaliza el descuento como `45+1`. `minutoDe` en `transformar.ts` hace `Number(texto)`, así que `45+1` detendría el guardado. El adaptador guarda el **minuto base** (`45`), que es lo que la columna admite.

## Restricciones globales

- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash.
- **Un módulo con `server-only` no puede importarse desde un componente cliente.** El adaptador es puro: sin `server-only`, se puede probar y usar desde cualquier lado.
- **`@santiso/actas` no se importa desde el navegador.** unpdf es de servidor; entra solo por la acción.
- **Prettier y ESLint solo sobre los ficheros nuevos.** La línea base de ESLint no debe subir: hoy está en **78 problemas**.
- El parser **no escribe en la base de datos** y este plan no cambia eso: produce un borrador que el usuario revisa y confirma con el guardado de 2B-4.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto.
- `pnpm check` en verde antes de cada commit. El código de salida de una tubería es el del último comando: `pnpm check | tail` **no** corta un `&&`.
- Cada commit en Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Mapa de ficheros

```
santiso/
├─ apps/studio/
│  ├─ package.json                           (mod) dependencia @santiso/actas
│  ├─ lib/actas/ficha-a-acta.ts / .test.ts   (nuevo) Ficha → ParsedActa (puro)
│  ├─ lib/server/acciones/fichas.ts          (nuevo) leerFichaPdf
│  ├─ components/admin/AdminActaImporter.tsx (mod) botón de PDF y detección local
│  └─ components/admin/AdminActaBatch.tsx    (mod) PDF en local, Gemini como respaldo
```

---

### Tarea 1: Adaptador de ficha a acta

Contexto: toda la lógica delicada de este plan está aquí, y no necesita ni base de datos ni PDF. Se prueba con objetos `Ficha` construidos a mano.

**Ficheros:**
- Modificar: `apps/studio/package.json` (añadir `"@santiso/actas": "workspace:*"`)
- Crear: `apps/studio/lib/actas/ficha-a-acta.ts`, `apps/studio/lib/actas/ficha-a-acta.test.ts`

**Interfaces:**
- Consume: `Ficha`, `Lado`, `EquipoFicha`, `JugadorFicha` (`@santiso/actas`); `ActaEvent`, `ActaPlayerRef`, `ParsedActa` (`@/lib/actas/types`).
- Produce: `actaDeFicha(ficha: Ficha, santisoEsLocal: boolean): ParsedActa`.

- [x] **Paso 1: Declarar la dependencia y comprobar que se resuelve**
- [x] **Paso 2: Escribir las pruebas que fallan** — las cinco filas de la tabla de goles, las cinco de tarjetas, el descarte de cambios del rival, el minuto de descuento y la convocatoria
- [x] **Paso 3: Comprobar que fallan** — `pnpm exec vitest run apps/studio/lib/actas/ficha-a-acta.test.ts`, FAIL por import sin resolver
- [x] **Paso 4: Implementar**
- [x] **Paso 5: Comprobar que pasan**
- [x] **Paso 6: Comprobar que el acta resultante atraviesa `transformar.ts`** — una prueba que encadena `actaDeFicha` con `eventosDeActa`, que es lo que rechaza las formas que el CHECK no admite
- [x] **Paso 7: Commit**

---

### Tarea 2: Acción de servidor

**Ficheros:**
- Crear: `apps/studio/lib/server/acciones/fichas.ts`

**Interfaces:**
- Consume: `parsearFichaPdf` (`@santiso/actas`), `actaDeFicha`, `Resultado`.
- Produce: `leerFichaPdf(formulario: FormData): Promise<Resultado<FichaLeida>>`, con
  `FichaLeida = { acta: ParsedActa; deteccion: { jornada, localTeam, visitorTeam, competicion, fecha } }`.

La detección viaja junto al acta porque la ficha ya trae jornada, equipos, competición y fecha: para un PDF no hace falta llamar a `/api/admin/acta-detect`, que es otra llamada a la nube.

- [x] **Paso 1: Implementar la acción**
- [x] **Paso 2: Comprobar que compila y que unpdf se resuelve en el servidor** — `pnpm --filter studio build`; si unpdf falla al empaquetarse, añadir `serverExternalPackages: ["unpdf"]` a `next.config.ts`
- [x] **Paso 3: Commit**

---

### Tarea 3: Botón de PDF en la pantalla de actas

**Ficheros:**
- Modificar: `apps/studio/components/admin/AdminActaImporter.tsx`

- [x] **Paso 1: Detección local para PDF** — `detectMatch` usa `leerFichaPdf` cuando el fichero es PDF, y `/api/admin/acta-detect` en los demás casos
- [x] **Paso 2: Análisis local para PDF** — nueva función `analizarFichaPdf`, botón «Leer ficha PDF (sin IA)», visible solo con un PDF seleccionado
- [x] **Paso 3: Comprobar a mano con una ficha real**
- [x] **Paso 4: Commit**

---

### Tarea 4: Lote

**Ficheros:**
- Modificar: `apps/studio/components/admin/AdminActaBatch.tsx`

- [x] **Paso 1:** `callAnalyze` intenta el lector local cuando el fichero es un PDF y cae a Gemini si el parser lo rechaza
- [x] **Paso 2:** `callDetect` igual
- [x] **Paso 3: `pnpm check` y `pnpm e2e`**
- [x] **Paso 4: Commit**

---

## Hallazgos de la ejecución

- **La categoría hacía falta y no estaba en el plan.** El lote elige el partido filtrando por
  categoría y jornada. Al devolver la categoría vacía, `candidates` salía vacío y **todas** las
  fichas habrían acabado en «Partido no encontrado en BD». La ficha nombra la competición en
  claro (`VETERANOS - PRIMERA GALICIA (…)`, `TERCERA FUTGAL (…)`), así que se deduce de ahí;
  cuando el nombre no la dice se prueban todas las categorías de esa jornada y desempata el
  nombre del rival, que ya estaba implementado.
- **Playwright transpila los `e2e/*.spec.ts` a CommonJS**: `import.meta.url` revienta ahí con
  «Cannot use 'import.meta' outside a module». En las pruebas de navegador va `__dirname`; en
  las de Vitest, `new URL(import.meta.url)` de un solo argumento.
- **La primera versión de la prueba e2e subía el fichero al sitio equivocado.** `input[type=file]`
  con `.first()` cogía el del escudo del club, que está más arriba en la página. Con el
  identificador propio (`#acta-file-input`) deja de ser ambiguo.
- **El parser avisa siempre de los penaltis** («Los PDF no indican penaltis: revisar el tipo de
  gol antes de guardar»), así que toda ficha llega con al menos un aviso. El panel de avisos de
  la pantalla ya los pinta.

## Lo que este plan no hace

- **Penaltis.** Los PDF examinados no los distinguen. El parser nunca los clasifica como gol normal por omisión; corregirlo es revisión manual, y la pantalla ya permite editar el evento.
- **Alineaciones.** El PDF de alineación (portero, capitán) queda como fuente complementaria sin usar.
- **Calendarios.** `parsearCalendario` está listo y probado contra los dos calendarios reales, pero conectarlo va con el importador de jornada, no con el de actas.
- **Retirar Gemini.** Sigue siendo el único camino para una foto del acta en papel.
