# Fase 2D — Plantilla y staff por temporada: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos usan casillas (`- [x]`) para el seguimiento.

**Objetivo:** que cada temporada tenga su propia plantilla y su propio staff, que la de 2026/27 se pueda construir desde cero, y que 2025/26 se conserve tal cual.

**Arquitectura:** se separa **quién es** de **qué papel tiene cada temporada**. `jugadores` y `staff` pasan a ser personas; dos tablas nuevas guardan la inscripción de cada persona en cada temporada, con los datos que cambian de un año a otro. Las pantallas trabajan con la temporada elegida (la activa por defecto) y mantienen la forma de sus DTO, así que el resto de la aplicación casi no se entera.

**Stack:** Drizzle 0.45.2 + libSQL · Next.js 16.3.5 · componentes base de la Fase 3A · Vitest 4.1.11 · Playwright 1.61.1.

**Spec:** [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md). **El spec no contemplaba esto**: la necesidad surgió al empezar 2026/27, con otro entrenador sénior y muchos cambios en la plantilla.

## Por qué

Hoy `jugadores` y `staff` guardan solo el estado actual. Cambiar el entrenador sénior sobrescribe al anterior. Cambiar un dorsal lo cambia también hacia atrás: el once del cartel de un partido de 2025/26 saldría con el dorsal de 2026/27. El único rastro histórico es `jugadores.historial`, un texto libre que tiene relleno 1 de 61 jugadores.

Lo que **sí** es ya por temporada son las estadísticas: goles, tarjetas y convocatorias cuelgan de los partidos, y los partidos de la temporada. Eso no se toca.

## Lo que hay hoy en la base de datos real

Comprobado el 21/09/2026:

- **61 jugadores; los 61 jugaron en 2025/26.** Todos se dieron de alta el 22/04/2026, durante esa temporada.
- **11 de staff** (6 directiva, 5 técnicos), también dados de alta el 22/04/2026.
- 2026/27 es la temporada activa; su calendario ya está cargado (182 + 240 partidos) y aún no tiene convocatorias.

Conclusión: **lo que hay es la plantilla de 2025/26**. La migración la deja ahí, y 2026/27 empieza vacía, que es justo lo que pidió el usuario: construirla desde cero, trayendo del año anterior solo a quien siga.

## Modelo

| Se queda en la persona | Pasa a la inscripción por temporada |
| --- | --- |
| `jugadores`: nombre, apodo, fecha de nacimiento, historial, posiciones conocidas, compromiso | `jugadores_temporada`: temporada, categoría, dorsal, posición, capitanía, **foto** |
| `staff`: nombre | `staff_temporada`: temporada, tipo, categoría, cargo, orden, **foto** |

- **La foto va por temporada.** Los carteles de cada año llevan la foto de ese año. Al traer a alguien del año anterior se copia la suya; solo se cambia si hay nueva.
- **El tipo del staff va por temporada**: alguien puede pasar de técnico a la directiva. El CHECK «categoría según tipo» se muda con él.
- Índice único `(temporada, categoría, jugador)`: la misma persona no se inscribe dos veces en el mismo equipo del mismo año, pero sí puede estar en dos categorías.
- **El dorsal repetido no es un CHECK**, es un aviso en pantalla. En la vida real pasa (lesionado que deja el número, dorsal compartido entre fases) y una restricción bloquearía al usuario.
- Las claves foráneas de las inscripciones hacia `jugadores`/`staff` son `cascade`; hacia `temporadas`, `cascade` también: borrar una temporada borra sus inscripciones, no a las personas.

## La migración

Es **la primera migración sobre datos reales**: hasta hoy solo existe `0000_inicial`. Se genera con `pnpm db:generate --name plantillas-por-temporada` y se le añade a mano el traspaso de datos, **entre** la creación de las tablas nuevas y la reconstrucción de las viejas.

Reglas del traspaso:

- **Cada jugador** va a la **última temporada en la que tiene convocatoria**; si no tiene ninguna, a la activa. En la base de datos real eso deja a los 61 en 2025/26.
- **El staff** no tiene convocatorias. Va a la **temporada anterior a la activa** (orden por nombre: `2025/26` < `2026/27`); si no la hay, a la activa. En la base de datos real, 2025/26.
- Los identificadores se generan en SQL con `randomblob` **en cada llamada**, nunca en una subconsulta escalar: SQLite puede evaluar una subconsulta sin correlación **una sola vez** y dar el mismo id a todas las filas.

Se aplica con este orden, y **con `pnpm dev` parado** (libSQL en Windows no suelta el fichero):

1. `pnpm db:backup`
2. `pnpm db:migrate`
3. comprobar recuentos: 61 inscripciones de jugador y 11 de staff en 2025/26, 0 en 2026/27; las 61 personas y las 11 siguen

Antes se ensaya **sobre una copia** de la base de datos real, nunca sobre la real.

## Restricciones globales

- Node ≥ 22.12. Solo `pnpm`. Comandos en Git Bash.
- Drizzle: solo query builder core. Cambios de esquema en `packages/db/src/schema`, pruebas en `packages/db/src/schema.test.ts`.
- **`vitest` no comprueba tipos**: `pnpm check` antes de cada commit, y con `&&`, nunca con `;`.
- Prettier y ESLint solo sobre ficheros tocados.
- Pantallas con los componentes de `components/ui/foundation` (Fase 3A), no con los estilos viejos.
- `data/` nunca entra en git. `apps/studio/.env.local` es secreto.
- Rama `fase-2d`. Conventional Commits en español con la línea `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

## Mapa de ficheros

```
packages/db/src/schema/plantilla.ts               (mod) jugadores/staff personas + dos tablas nuevas
packages/db/src/schema.test.ts                    (mod)
packages/db/migrations/0001_plantillas-por-temporada.sql (nuevo, generado + traspaso a mano)
apps/studio/lib/server/temporada.ts               (nuevo) temporada activa / anterior
apps/studio/lib/server/consultas/{jugadores,staff}.ts   (mod) por temporada
apps/studio/lib/server/acciones/{jugadores,staff}.ts    (mod) + incorporar, quitar, parecidos
apps/studio/lib/server/consultas/actas.ts         (mod) dorsal de la temporada del partido
apps/studio/lib/navigation/contexto.ts            (mod) Femenino en Plantilla
apps/studio/components/studio/StudioShell.tsx     (mod) íd.
apps/studio/components/admin/AdminPlayers.tsx     (mod) temporada, vacío, traer del año anterior
apps/studio/components/admin/AdminStaff.tsx       (mod) íd.
apps/studio/components/admin/IncorporarDeTemporada.tsx (nuevo) diálogo compartido
apps/studio/e2e/plantilla.spec.ts                 (nuevo)
```

---

### Tarea 1: Esquema y migración

- [x] **Paso 1:** pruebas de esquema que fallan — inscripción única por (temporada, categoría, persona); borrar persona borra sus inscripciones; borrar temporada borra inscripciones pero no personas; CHECK de categoría según tipo en `staff_temporada`
- [x] **Paso 2:** esquema nuevo y `pnpm db:generate --name plantillas-por-temporada`
- [x] **Paso 3:** traspaso de datos a mano en la migración, con las reglas de arriba
- [x] **Paso 4:** prueba de migración **con datos**: una BD en el esquema 0000 con jugadores que jugaron en dos temporadas, uno sin convocatorias y staff; tras migrar, cada uno en su temporada, ids distintos, nada perdido
- [x] **Paso 5:** ensayo sobre una **copia** de la BD real: recuentos esperados
- [x] **Paso 6:** commit

### Tarea 2: Capa de servidor

- [x] **Paso 1:** `lib/server/temporada.ts` — `temporadaActiva()`, `temporadaAnterior(id)`
- [x] **Paso 2:** consultas por temporada (por defecto la activa), mismos DTO más `temporada_id`
- [x] **Paso 3:** acciones: guardar (persona + inscripción de esa temporada), **quitar de la temporada** (no borra a la persona), **incorporar** desde otra temporada (copia dorsal, posición y foto), **candidatos** del año anterior no inscritos aún, **parecidos** por nombre para el aviso de duplicado
- [x] **Paso 4:** pruebas sobre BD temporal: quitar de 2026/27 no toca 2025/26; incorporar copia dorsal y foto; parecidos encuentra «Xan Fiel» al escribir «xan fiel»
- [x] **Paso 5:** commit

### Tarea 3: Actas y carteles

- [x] **Paso 1:** `participacionesDePartido` toma el dorsal de la **temporada del partido**, no el actual
- [x] **Paso 2:** prueba: un jugador con el 9 en 2025/26 y el 10 en 2026/27; la convocatoria de un partido de 2025/26 dice 9
- [x] **Paso 3:** el importador de actas enlaza por dorsal contra la plantilla de la temporada activa (ya lo hace a través de `listarJugadores`, ahora por temporada)
- [x] **Paso 4:** commit

### Tarea 4: Pantalla de jugadores

- [x] **Paso 1:** selector de temporada en la pantalla (parámetro `temporada` de la URL, que el shell ya respeta); por defecto la activa
- [x] **Paso 2:** estado vacío con «Añadir de {anterior}» y «Nuevo jugador»
- [x] **Paso 3:** diálogo de incorporación con casillas, dorsal editable y «ver otras categorías»
- [x] **Paso 4:** aviso de posible duplicado al crear
- [x] **Paso 5:** «Quitar de la temporada» en lugar de «Borrar»
- [x] **Paso 6:** Femenino vuelve al selector de categoría en las secciones de Plantilla
- [x] **Paso 7:** commit

### Tarea 5: Pantalla de staff

- [x] Lo mismo para cuerpo técnico y directiva; commit

### Tarea 6: Aplicar y verificar

- [x] **Paso 1:** `pnpm check`, build
- [x] **Paso 2:** **con `pnpm dev` parado:** copia, migración de la BD real, recuentos
- [x] **Paso 3:** e2e completo más `e2e/plantilla.spec.ts` (2026/27 vacía → traer a dos de 2025/26 → aparecen con su dorsal; 2025/26 intacta)
- [x] **Paso 4:** carteles de referencia idénticos
- [x] **Paso 5:** fusión y publicación

## Hallazgos de la ejecución

- **La migración generada habría borrado las inscripciones recién creadas, si no fuera por
  cómo la ejecuta libSQL.** Drizzle reconstruye `jugadores` y `staff` con `DROP TABLE` y, para
  `staff`, lo pone **después** de `PRAGMA foreign_keys=ON`. Con las claves foráneas activas, ese
  `DROP` hace un `DELETE` implícito que borra en cascada `staff_temporada`. No pasa porque el
  migrador de Drizzle ejecuta todo dentro de `client.migrate` de libSQL, que desactiva las claves
  foráneas **antes** de abrir la transacción (dentro de una transacción el `PRAGMA` no hace
  nada). Comprobado leyendo el código de `@libsql/client` 0.18 y cubierto por
  `packages/db/src/migraciones.test.ts`. Si algún día se cambia de cliente, esa prueba es la que
  avisa.
- **Aplicada sobre la base de datos real el 21/09/2026**, tras `pnpm db:backup`
  (`data/backups/santiso-2026-09-21T18-19-01.db`). Recuentos idénticos al ensayo: 61 jugadores
  y 11 de staff en 2025/26, 2026/27 vacía, 1213 convocatorias, 901 eventos, 57 fotos, integridad
  y claves foráneas correctas.
- **Femenino había desaparecido del panel** con la 3B (`categoriaDe` solo devolvía Sénior o
  Veteranos): 18 jugadoras y 2 técnicos de 2025/26 quedaban sin poder consultarse. Se añade
  `categoriaPlantillaDe`, que solo usan Jugadores y Cuerpo técnico; el resto de secciones no cambia.
- **La herramienta de migración de Supabase también escribía con el modelo viejo.** Ahora reparte
  con las mismas reglas que la migración SQL, y una prueba con el mismo caso fija que ambas
  coinciden.
- **Python en Windows escribe CRLF** al abrir ficheros en modo texto: de ahí los avisos de fin de
  línea en los commits de esta sesión. Git los normaliza al guardar; no afecta al código.
- **Dos pruebas de navegación de Codex esperaban el título exacto «Plantilla Senior».** Se había
  añadido la temporada al título; se quitó, porque la temporada ya se ve en el selector de encima.
- **La prueba e2e de Plantilla es de solo lectura**: las e2e corren contra la base de datos real y
  no deben meter jugadores en la temporada de verdad. Se comprobó después que 2026/27 seguía vacía.

## Lo que este plan no hace

- **Estadísticas por temporada en pantalla.** Los datos ya lo permiten; la vista es de la Fase 6.
- **Convertir `historial` en filas.** Sigue siendo texto para las temporadas anteriores a la herramienta.
- **Selector de temporada global en el shell.** Va dentro de las pantallas de Plantilla. Si Calendario o Clasificación lo necesitan, se sube al shell en una fase de interfaz.
