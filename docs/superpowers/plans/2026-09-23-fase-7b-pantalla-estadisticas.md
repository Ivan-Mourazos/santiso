# Fase 7B — Pantalla de estadísticas: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** ver las estadísticas por jugador que la 7A ya calcula, por temporada, categoría y competición, sin inventar nada que la base de datos no guarde.

**Arquitectura:** la 7A dejó `listarEstadisticasJugadores` en `lib/server/consultas/estadisticas-jugadores.ts`. La 7B añade una acción de servidor que devuelve la pantalla entera en un viaje (temporadas, competiciones del ámbito y filas), una sección nueva en el panel y la tabla. Cálculo, cero: lo que se vea sale de la 7A tal cual.

**Tecnología:** Next 16, componentes `components/ui/foundation/*`, CSS Modules con tokens, Playwright.

**Especificación:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`, Fase 7; capa de datos en `docs/superpowers/plans/2026-09-22-fase-7a-estadisticas-jugadores.md`.

## Restricciones

- **No tocar el cálculo de la 7A** (`packages/domain/src/estadisticas-jugadores.ts`, `lib/server/consultas/estadisticas-jugadores.ts`, `auditar-estadisticas.ts`, `packages/db/src/lectura-estadisticas.ts`). Si la pantalla necesita un dato que no está, se añade una consulta aparte, no se cambia el cálculo.
- **Nada de medias ni proyecciones inventadas.** Goles por partido se puede mostrar porque se deriva de dos columnas reales; penaltis no se muestra: el esquema no los distingue y la 7A devuelve `null`.
- Sin migraciones, sin escrituras: la pantalla solo lee.
- `pnpm check` antes de cada commit; ESLint y Prettier explícitos de los ficheros de `apps/studio`.
- `pnpm e2e` al cerrar la fase (solo lectura, base real).

## Decisiones tomadas

- **Dónde va:** grupo «Competición», después de Clasificación, con id `estadisticas` y etiqueta «Estadísticas».
- **Categoría:** la elige la cabecera del panel, como Calendario y Clasificación. Incluye Femenino, porque la 7A lo cubre y hay datos (49 goles en 2025/26).
- **Temporada:** selector propio en la pantalla, como en Plantilla. Por defecto, la activa.
- **Competición:** selector propio, con «Todas» como opción por defecto; las de esa temporada y categoría.
- **Orden:** por defecto el de la 7A (dorsal, luego nombre). La cabecera de cada columna numérica ordena de mayor a menor al pulsarla.
- **Ausencias dichas, no escondidas:** quien está inscrito y no jugó sale con ceros; quien tiene eventos pero no inscripción sale marcado, no se oculta. Ambos casos se explican en pantalla.

---

## T1 — Acción de servidor y catálogo del ámbito

**Ficheros:**

- Crear: `apps/studio/lib/server/acciones/estadisticas.ts`
- Modificar: `apps/studio/lib/server/consultas/competiciones.ts`
- Crear: `apps/studio/lib/server/consultas/competiciones.test.ts` si no existe ya cobertura del listado por temporada

- [ ] **Paso 1:** añadir `listarCompeticionesDeTemporada(temporadaId, categoria)` a `consultas/competiciones.ts`. La actual (`listarCompeticiones`) solo trae las de la temporada activa y aquí hacen falta las de cualquier temporada.
- [ ] **Paso 2:** escribir el test de esa consulta: dos temporadas y dos categorías, y que no se crucen.
- [ ] **Paso 3:** crear `acciones/estadisticas.ts` con `"use server"` y una sola acción:
      `cargarPantallaEstadisticas(categoria: string, temporadaId?: string | null, competicionId?: string | null): Promise<Resultado<PantallaEstadisticas>>`,
      que devuelve `{ temporadas, temporadaId, competiciones, competicionId, filas, disponibilidadPenaltis }`. Un viaje: Next despacha las acciones del cliente de una en una.
- [ ] **Paso 4:** la acción resuelve la temporada con `resolverTemporada` (activa si no llega ninguna) y descarta un `competicionId` que no sea de ese ámbito, en vez de fallar: el usuario acaba de cambiar de temporada y la competición anterior ya no vale.
- [ ] **Paso 5:** test de la acción con base temporal: ámbito por defecto, cambio de temporada, competición de otra temporada ignorada, categoría desconocida rechazada.
- [ ] **Paso 6:** `pnpm check`, ESLint y Prettier, y commit `feat(estadisticas): cargar la pantalla en un solo viaje`.

---

## T2 — Pantalla

**Ficheros:**

- Crear: `apps/studio/components/admin/estadisticas/AdminEstadisticas.tsx`
- Crear: `apps/studio/components/admin/estadisticas/Estadisticas.module.css`
- Crear: `apps/studio/lib/estadisticas/modelo.ts` y `modelo.test.ts`
- Modificar: `apps/studio/lib/navigation/contexto.ts`, `apps/studio/components/studio/StudioSection.tsx`, `apps/studio/components/studio/StudioShell.tsx`

- [ ] **Paso 1:** `lib/estadisticas/modelo.ts` con lo que se puede probar sin navegador: `ordenarEstadisticas(filas, columna, sentido)`, `filtrarPorTexto(filas, texto)` y `totales(filas)`. Puro, sin acceso a BD.
- [ ] **Paso 2:** tests del modelo: orden estable ante empates, texto que no distingue tildes ni mayúsculas, totales que suman lo que hay y no inventan penaltis.
- [ ] **Paso 3:** registrar la sección `estadisticas` en `contexto.ts` (grupo «Competición») y añadirla a la lista de secciones con categoría en `StudioShell`, con Femenino incluido.
- [ ] **Paso 4:** montar `AdminEstadisticas` en `StudioSection`, con `categoria` de la cabecera y `showToast`.
- [ ] **Paso 5:** la pantalla: selector de temporada, selector de competición («Todas» primero), buscador, tabla con dorsal, jugador, convocatorias, titularidades, partidos jugados, goles, goles en propia, amarillas y rojas. Cabeceras numéricas ordenables con `aria-sort`.
- [ ] **Paso 6:** estados: cargando, error con reintentar, vacío («Todavía no hay datos de esta temporada»), y avisos para inscritos sin minutos y para quien aparece sin inscripción.
- [ ] **Paso 7:** decir lo que no se sabe: una línea fija bajo la tabla explicando que el acta no distingue penaltis, así que no hay desglose.
- [ ] **Paso 8:** responsive: a 360 px la tabla pasa a tarjetas, como en Patrocinadores; sin scroll horizontal.
- [ ] **Paso 9:** `pnpm check`, ESLint y Prettier, y commit `feat(estadisticas): pantalla de estadísticas por jugador`.

---

## T3 — Pruebas de pantalla y cierre

**Ficheros:**

- Crear: `apps/studio/e2e/estadisticas.spec.ts`
- Modificar: `apps/studio/e2e/humo.spec.ts` si enumera secciones

- [ ] **Paso 1:** e2e de solo lectura: la sección carga, la tabla tiene filas en 2025/26 Senior, cambiar de categoría cambia los datos, elegir una competición reduce los totales y «Todas» los recupera.
- [ ] **Paso 2:** e2e de orden: pulsar «Goles» ordena de mayor a menor y lo dice con `aria-sort`.
- [ ] **Paso 3:** e2e de anchos 360 y 1280 sin desbordes.
- [ ] **Paso 4:** comprobar contra la auditoría de la 7A: los goles que muestra la pantalla para Senior 2025/26 coinciden con los 123 del informe.
- [ ] **Paso 5:** `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura`.
- [ ] **Paso 6:** commit, fusionar a `main` y empujar.
