# Fase 2B-6 — Cargar el calendario de temporada desde el PDF: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [x]`) para el seguimiento.

**Objetivo:** que el PDF del calendario federativo cree de una vez las jornadas y los cruces de la temporada, sin tocar nada de lo que ya hay.

**Arquitectura:** `parsearCalendarioPdf` (de `@santiso/actas`, ya fusionado) devuelve la temporada entera. Entre eso y la base de datos va un **plan de importación puro**: cruza los nombres del PDF con los equipos de la competición y dice exactamente qué se va a crear, qué ya estaba y qué no se ha podido resolver. La pantalla enseña ese plan; escribir es un segundo paso explícito, en una transacción.

**Stack:** Next.js 16.3.5 · React 19.3.0 · `@santiso/actas` · Drizzle 0.45.2 + libSQL · Vitest 4.1.11 · pnpm 10.33.2.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md), «Fase 5».

**Plan hermano:** [2B-5](2026-09-20-fase-2b-5-fichas-pdf.md), que conectó el lector de fichas. Este hace lo mismo con el otro documento que publica la federación.

## Lo que hay y lo que falta

La pantalla «Jornada» importa **una** jornada desde una foto, con Gemini. El PDF del calendario trae la temporada completa: en los dos calendarios reales que el parser tiene de prueba son **14 equipos, 26 jornadas y 182 partidos** el sénior, y **16, 30 y 240** el de veteranos. Meter eso jornada a jornada por una pantalla de una en una son treinta pasadas a mano.

El parser ya está probado contra esos dos calendarios. Falta el camino de escritura.

## Lo que el calendario NO trae

Esto decide el diseño entero:

- **No trae resultados.** Crea el esqueleto; los marcadores llegan de las actas.
- **No trae la fecha y hora de cada partido.** `fechaNominal` es la fecha publicada de la jornada, y el README del parser avisa expresamente de que no es la de cada partido. Por eso va a `jornadas.fechaInicio` (que es `"YYYY-MM-DD"`) y **`partidos.fecha` se queda a `null`**. Inventar una hora sería mentir.
- **No trae campo.** `partidos.campoId` se queda a `null`.

## La regla que no se puede romper

**Nunca se modifica un partido que ya existe.** Puede tener un marcador metido desde un acta; sobrescribirlo con un cruce vacío sería perder datos. El índice único `partidos_jornada_cruce_uq` sobre `(jornada_id, equipo_local_id, equipo_visitante_id)` lo hace barato: `onConflictDoNothing`.

Consecuencia agradable: **la importación es idempotente**. Volver a cargar el mismo PDF no hace nada. Eso permite la estrategia de la tarea 1 con los equipos que no se reconocen: se saltan sus cruces, se listan, el usuario los da de alta en «Equipos» y vuelve a importar.

## Restricciones globales

- Node ≥ 22.12. Solo `pnpm` (10.33.2). Comandos en Git Bash.
- **`@santiso/actas` no se importa desde el navegador**: unpdf es de servidor, entra por la acción.
- **Un módulo con `server-only` no puede importarse desde un componente cliente.**
- **Prettier y ESLint solo sobre los ficheros nuevos.** La línea base de ESLint no debe subir: hoy está en **78 problemas**.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto: ni se imprime ni se edita.
- `pnpm check` en verde antes de cada commit. El código de salida de una tubería es el del último comando.
- Rama `fase-2b-6`. Conventional Commits en español, con esta línea final:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Mapa de ficheros

```
santiso/
├─ apps/studio/
│  ├─ lib/calendario/plan-importacion.ts / .test.ts  (nuevo) calendario + BD → plan (puro)
│  ├─ lib/server/acciones/calendario-pdf.ts          (nuevo) leerCalendarioPdf, guardarCalendario
│  ├─ components/admin/AdminCalendarioPdf.tsx        (nuevo) pantalla del plan
│  ├─ app/admin/page.tsx                             (mod) selector de modo en «Jornada»
│  └─ e2e/calendario-pdf.spec.ts                     (nuevo)
```

---

### Tarea 1: El plan de importación (puro)

Contexto: aquí está toda la decisión —qué crear, qué ya estaba, qué no se resuelve— y no necesita ni PDF ni base de datos. Se prueba con objetos.

**Ficheros:**
- Crear: `apps/studio/lib/calendario/plan-importacion.ts`, `apps/studio/lib/calendario/plan-importacion.test.ts`

**Interfaces:**
- Consume: `Calendario`, `JornadaCalendario` (`@santiso/actas`); `claveNombre`, `similitudTokens` (`@santiso/domain`).
- Produce:
  - `type EquipoConocido = { id: string; nombre: string }`
  - `type EstadoCruce = "nuevo" | "existe" | "sin-equipo"`
  - `type CrucePlaneado = { jornada, localNombre, visitanteNombre, localId, visitanteId, estado }`
  - `type PlanImportacion = { jornadasNuevas, jornadasExistentes, cruces, sinResolver, resumen }`
  - `planDeImportacion(calendario, estado): PlanImportacion`

Emparejado de nombres, en este orden: `claveNombre` idéntica → `similitudTokens ≥ 0.6` con un único candidato mejor → sin resolver. Un empate entre dos equipos deja el cruce sin resolver: es preferible a elegir al azar.

- [x] **Paso 1: Escribir las pruebas que fallan** — cruce nuevo, cruce que ya existe, equipo sin resolver, empate de similitud, jornada nueva vs existente, idempotencia (aplicar el plan dos veces no añade nada) y que la fecha nominal viaja a la jornada
- [x] **Paso 2: Comprobar que fallan**
- [x] **Paso 3: Implementar**
- [x] **Paso 4: Comprobar que pasan**
- [x] **Paso 5: Commit**

---

### Tarea 2: Acciones de servidor

**Ficheros:**
- Crear: `apps/studio/lib/server/acciones/calendario-pdf.ts`, `.test.ts`

**Interfaces:**
- `leerCalendarioPdf(formulario: FormData): Promise<Resultado<{ calendario, plan }>>` — lee el PDF y arma el plan contra la competición elegida. **No escribe.**
- `guardarCalendario(entrada: { competicionId, plan }): Promise<Resultado<{ jornadas: number; partidos: number }>>` — una transacción: crea las jornadas que faltan, luego los cruces, con `onConflictDoNothing`.

- [x] **Paso 1: Escribir las pruebas** — sobre una BD temporal: importar dos veces seguidas crea lo mismo la primera vez y **nada** la segunda; un partido con marcador ya metido sobrevive intacto a una reimportación
- [x] **Paso 2: Implementar**
- [x] **Paso 3: Comprobar que pasan**
- [x] **Paso 4: Commit**

---

### Tarea 3: Pantalla

**Ficheros:**
- Crear: `apps/studio/components/admin/AdminCalendarioPdf.tsx`
- Modificar: `apps/studio/app/admin/page.tsx`

Selector de modo en la sección «Jornada», igual que «Individual / Lote» en Actas: **«Una jornada (foto)» / «Calendario completo (PDF)»**.

- [x] **Paso 1: Selector de modo**
- [x] **Paso 2: Pantalla del plan** — elegir categoría y competición, subir el PDF, ver el resumen (cuántas jornadas, cuántos cruces nuevos, cuántos ya estaban, cuáles no se resuelven y por qué), y un botón que escribe
- [x] **Paso 3: Comprobar con un calendario real** — hecho el 21/09 con los dos PDF de la temporada, contra la base de datos real y **sin escribir**. Sénior: 14 equipos, 26 jornadas, 182 partidos; 156 nuevos, 26 ya estaban, 0 sin equipo. Veteranos: 16, 30, 240; 210 nuevos, 30 ya estaban, 0 sin equipo. Los 30 nombres del PDF casan con el equipo correcto, incluidos `C.S.D ARZUA "B"` y `S.D. CRUCES` (que existe en las dos categorías y cae en la suya por la inscripción). Los partidos que ya estaban son exactamente los del Santiso, uno por jornada, y los 56 se reconocen como existentes: el sentido local/visitante del PDF coincide con el de la base de datos
- [x] **Paso 4: Commit**

---

### Tarea 4: Verificación

- [x] **Paso 1: e2e** — encuadre y rechazo; ver los hallazgos sobre por qué no puede ser el camino feliz
- [x] **Paso 2: `pnpm check`, `pnpm --filter studio build`, `pnpm e2e`**
- [x] **Paso 3: Commit y fusión**

---

## Hallazgos de la ejecución

- **`claveNombre` no basta para emparejar equipos, y la prueba lo pilló a la primera.** La
  federación separa las siglas (`U.D. SANTISO F.C.`) y el catálogo del club las junta
  (`UD Santiso FC`): `claveNombre` deja `u d santiso f c` frente a `ud santiso fc`, que no casan
  ni por igualdad ni por parecido (0,2 sobre un mínimo de 0,6). Hizo falta una clave propia que
  une las tiradas de **dos o más** letras sueltas. Una letra sola se respeta a propósito, porque
  es lo que distingue al filial: en el calendario real conviven `C.S.D ARZUA` y `C.S.D ARZUA "B"`.
  `equipos.clave` sigue calculándose con `claveNombre`; esto es solo para emparejar.
- **No hay ningún PDF de calendario en git.** Los originales son privados y las pruebas del
  parser los dejan fuera; lo que sí está son sus fragmentos anonimizados. Así que la prueba e2e
  solo puede comprobar el encuadre y el rechazo de un PDF que no es un calendario. La cadena
  entera se prueba en unitarias sobre esos fragmentos: 26 jornadas y 182 cruces en sénior, 30 y
  240 en veteranos, todos resueltos y ninguno contra sí mismo.
- **`vitest` no comprueba tipos.** Las dos pruebas de la Tarea 2 pasaban en verde con un error
  de tipos dentro (`() => void` contra `() => Promise<void>`); lo encontró `tsc`. Y el commit
  salió igualmente porque usé `;` en vez de `&&` tras `pnpm check`. Enmendado.
- **El recuento de jornadas creadas no podía hacerse con `inArray`** sobre una lista vacía: si
  el plan no trae jornadas nuevas pero sí cruces, la consulta se quedaba sin valores. Se cuenta
  en memoria contra lo que el plan pedía.

## Lo que este plan no hace

- **Alta automática de equipos.** Un nombre que no está en la base de datos no crea un equipo: el nombre del PDF viene en mayúsculas y abreviado (`N.A.K YZUXI "Q"`), y crearía duplicados del catálogo cuidado a mano. Se listan y el usuario decide.
- **Fecha y hora de cada partido.** El calendario no las trae. Se ponen en la pantalla de Calendario, o llegan del acta.
- **Descansos.** Un grupo impar deja un equipo libre por jornada; el modelo ya tiene descansos, pero el parser no los marca. Queda para cuando aparezca un calendario impar de verdad.
