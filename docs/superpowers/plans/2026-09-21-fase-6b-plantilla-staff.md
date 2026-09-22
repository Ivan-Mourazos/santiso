# Fase 6B — Rediseño de Plantilla y Staff (versión recortada)

> **Origen:** plan de Codex del mismo nombre (worktree `codex/base-visual`, sin commitear), revisado
> el 21/09/2026. Se ejecuta la **opción B** acordada con el usuario: todo lo que aporta al uso
> diario, sin la infraestructura de pruebas que no protege nada nuevo.

**Objetivo:** que Jugadores, Cuerpo técnico y Directiva sean listados primero, con buscador, y que
el alta y la edición pasen a un único editor en diálogo, con la foto dentro.

**Base:** `main` en `7a7cacb` (2D + arreglos A). Las acciones de servidor de la 2D no cambian.

## Qué se toma del plan de Codex

- Listado primero: buscador (nombre/apodo, sin tildes ni mayúsculas), filtros de posición y
  «sin foto», contador visible/total. Estado «sin resultados» distinto de «plantilla vacía».
- Editor único en `Dialog` de foundation: grupo «Persona» (compartido entre temporadas) y grupo
  «Temporada» (dorsal, posición, foto), con el alcance dicho en pantalla.
- Foto dentro del editor, con vista previa y URL revocada; fuera la subida en el acto de 18 px.
- Staff con el mismo patrón, incluida la edición de nombre y cargo por papel.
- Errores de guardado dentro del editor, sin cerrarlo ni perder lo escrito; sin doble envío.
- Cerrar el editor con cambios pide descartar.
- Una sola fuente de datos para escritorio (tabla) y móvil (tarjetas), por CSS.

## Qué se deja fuera, y por qué

| Del plan de Codex | Motivo |
| --- | --- |
| T0: servidor e2e de escritura con fixtures propias + suite paralela | Las escrituras ya están probadas contra BD temporales (2D). Se hace **una** e2e de escritura sobre carpeta de datos temporal, sin infraestructura aparte. |
| Nuevo hook de contexto de temporada | `useCompeticiones` ya resuelve temporada; los fallos reales (carga colgada) se arreglaron en la A. |
| Revisión a 360/390/768/1280 px y zoom 200 % | Se comprueba 360 y 1280. |
| Buscador y aviso de descarte en «Añadir de temporada anterior» | Útil pero no urgente: la lista del año anterior son ~20 personas. |

## Pruebas que cambian

Dos pruebas de `e2e/navegacion.spec.ts` escribían en `form input` de Jugadores para probar la
guardia de borradores. Con el editor en un diálogo modal, el menú queda bloqueado detrás, así que
se mudan a **Equipos** (formulario en línea, grupo de categoría y guardia) con las mismas
comprobaciones. Plantilla gana su propia prueba: cerrar el editor con cambios pide descartar.

## Tareas

- [x] T1 Modelo puro (`plantilla/modelo.ts`): filtrado, borradores, `FormData`, comparación. Pruebas.
- [x] T2 Piezas: `FotoFormulario`, `EditorJugador`, `EditorStaff`, `Plantilla.module.css`.
- [x] T3 `AdminPlayers` como orquestador: barra de temporada, herramientas, lista, editor.
- [x] T4 `AdminStaff` igual.
- [x] T5 e2e: selectores semánticos en `plantilla.spec.ts`, guardia mudada a Equipos, una e2e de
      escritura (alta + edición anual + quitar) sobre carpeta de datos temporal.
- [x] T6 `pnpm check`, build, e2e, ESLint sin subir la línea base, fusión.

## Cierre — 22/09/2026

Implementación de Claude revisada y completada por Codex en el checkout principal.
No se cambiaron el esquema ni las acciones de servidor de la Fase 2D.

Correcciones de cierre:
- Bloqueo síncrono de guardado y campos deshabilitados durante el envío en ambos editores.
- Vista previa de foto sincronizada con el elemento de imagen, sin estado derivado en efectos;
  se libera cada URL temporal al sustituirla o cerrar el editor.
- Cada ejecución de escritura usa una carpeta temporal única, sin borrar directorios previos.
- Pruebas de anchura a 360/1280 px y de conservación de borrador tras fallo de guardado.

Validación final:
- `pnpm check`: 64 archivos, 491 pruebas correctas y 1 omitida previamente existente.
- `pnpm build`: correcto, incluidas las rutas del panel.
- `pnpm e2e`: 31 correctas; solo lectura sobre datos locales.
- `pnpm e2e:escritura`: 4 correctas sobre datos ficticios aislados.
- ESLint de todos los módulos nuevos/modificados de Plantilla y Staff: sin errores ni avisos.
- Formato comprobado explícitamente en los archivos de Studio, excluidos del formato raíz.

Los servidores de pruebas se detuvieron. Las carpetas temporales quedan disponibles para
inspección. La rama fase-6b del checkout principal se integra en main por avance rápido;
no hace falta fusionar el antiguo worktree codex/base-visual ni su plan desactualizado.