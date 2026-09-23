# Fase 6G — Calendario: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** partir `AdminJornadas.tsx` (1.723 líneas, 115 estilos en línea, 13 `input-group`, `<style jsx>`) en piezas con los componentes de la Fase 3A, sin cambiar lo que guarda ni cómo lo guarda.

**Arquitectura:** carpeta `components/admin/calendario/`. Un orquestador carga y mantiene la selección (temporada, competición, jornada, que viven en la URL como hoy); cada bloque es un componente con su responsabilidad. Las acciones de servidor (`lib/server/acciones/calendario.ts`, `competiciones.ts`) no se tocan.

**Tecnología:** Next 16, `components/ui/foundation/*` (incluido `Dialog`), CSS Modules con tokens, Playwright.

## Restricciones

- **No tocar acciones de servidor, consultas ni esquema.** La pantalla llama a las mismas acciones con los mismos argumentos.
- No tocar `lib/useCompeticiones.ts` salvo que una prueba demuestre que hace falta.
- `pnpm e2e` solo lee la base real; todo lo que escribe va en `e2e-escritura/` con su propia competición sembrada, para no mover los recuentos de `equipos-escritura.spec.ts`.
- `pnpm check` antes de cada commit; ESLint y Prettier explícitos en `apps/studio`.

## Cobertura de partida

Una sola prueba e2e (`calendario.spec.ts`) que abre la pantalla y ve un botón «Guardar». Nada de lo que escribe está probado. Por eso T1 va antes que cualquier cambio.

## Decisiones

- **Crear temporada sale de Calendario.** Ya existe en Temporadas, con confirmación y manejo de fallos. Aquí queda un enlace.
- **Crear y borrar competición salen de Calendario.** Ya existen en Equipos desde la 6C, con protección de la competición con jornadas. Aquí queda un enlace. Es lo mismo que se hizo con los logos en la 6D.
- **Reglas de zona se quedan**, en un `Dialog` propio: son de la competición y la clasificación las pinta.
- **Crear jornadas en lote y crear una jornada** se quedan, en un `Dialog` «Jornadas».
- **Borrar partido, borrar jornada y quitar descanso** siguen pidiendo confirmación.
- **Edición de partido en la fila:** fecha, campo, marcador y estado, con el aviso de cambios sin guardar (`useUnsavedChanges`) que ya existe.

## Comportamientos que hay que conservar

Sacados de los handlers de `AdminJornadas.tsx`:

1. Crear jornada con número, fecha de inicio y fase; aviso si no hay competición.
2. Crear N jornadas en lote.
3. Borrar jornada, con confirmación.
4. Añadir partido: rechaza el mismo equipo a los dos lados y un equipo que ya juega en esa jornada; exige competición.
5. Cambiar fecha, campo y marcador de un partido y guardar; cambiar estado.
6. Borrar partido, con confirmación.
7. Añadir y quitar descanso de un equipo en la jornada, con confirmación al quitar.
8. Reglas de zona: añadir, editar, quitar y guardar.
9. Equipos del rival que faltan en el catálogo de la competición se completan (`mergeMissingTeams`).
10. La selección vive en la URL: temporada, competición y jornada sobreviven a recargar.

---

## T1 — Red de seguridad

**Ficheros:** modificar `e2e-escritura/sembrar.ts`; crear `e2e-escritura/calendario-escritura.spec.ts`; ampliar `e2e/calendario.spec.ts`.

- [ ] **Paso 1:** sembrar una competición propia para estas pruebas, «Copa Calendario», en la temporada activa, con cuatro equipos que no usen otras pruebas, una jornada con un partido y ningún descanso.
- [ ] **Paso 2:** e2e de escritura, en orden, por comportamiento de la lista: 1, 2, 3, 4 (incluidos los dos rechazos), 5, 6, 7 y 8. Cada una comprueba el efecto en pantalla tras recargar, no solo el aviso.
- [ ] **Paso 3:** ampliar la de solo lectura: la selección sobrevive a recargar (10) y cambiar de jornada cambia los partidos.
- [ ] **Paso 4:** los localizadores se escriben con los nombres accesibles de la pantalla nueva (etiquetas asociadas, roles). Contra la pantalla vieja fallarán donde hoy no hay etiqueta: es la especificación de T2, no un fallo de T1. Anotar cuáles pasan ya con la vieja; esas son la comparación de comportamiento.
- [ ] **Paso 5:** commit `test(calendario): cubrir lo que escribe la pantalla`.

## T2 — Piezas

**Ficheros:** crear en `components/admin/calendario/`: `AdminCalendario.tsx` (orquestador), `Cabecera.tsx` (temporada, competición, jornada y accesos), `DialogoJornadas.tsx`, `DialogoReglas.tsx`, `NuevoPartido.tsx`, `Descansos.tsx`, `ListaPartidos.tsx` con `FilaPartido.tsx`, y `Calendario.module.css`. Modificar `StudioSection.tsx`. Borrar `AdminJornadas.tsx` al final.

- [ ] **Paso 1:** orquestador con la carga y la selección, copiando la lógica de datos del viejo (fetch, contexto, `currentCompetition`, `mergeMissingTeams`) sin reescribirla.
- [ ] **Paso 2:** una pieza cada vez, llevando su handler del viejo tal cual y cambiando solo el marcado. Tras cada pieza: typecheck y la parte de T1 que le toca.
- [ ] **Paso 3:** enlaces a Temporadas y a Equipos donde estaban los formularios duplicados.
- [ ] **Paso 4:** responsive: a 360 px la lista de partidos pasa a fichas y los formularios a una columna, sin scroll horizontal.
- [ ] **Paso 5:** todas las pruebas de T1 en verde. Commit por pieza o por grupo coherente.

## Cierre

- [ ] `grep` de `style={{`, `style jsx` e `input-group` en `components/admin/calendario`: cero.
- [ ] `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura`.
- [ ] Fusionar a `main` y empujar.
