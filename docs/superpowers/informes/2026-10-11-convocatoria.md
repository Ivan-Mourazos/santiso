# Generador de convocatoria

Rama `convocatoria`, worktree `../santiso-convocatoria`. Trabajo separado de `main`, sin fusión ni push.

## Cambios

- Tablas `partido_convocatorias` y `partido_convocados`, independientes del acta y de la alineación previa. Claves únicas, relaciones y borrado en cascada probados.
- Consulta y guardado con `Resultado<T>`, validación de inscritos de categoría y temporada, al menos un convocado, quedada opcional y protección de partidos finalizados. Todos los inscritos aparecen marcados inicialmente.
- Pantalla `/admin/convocatoria`, selector Senior/Veteranos, fichas en dos columnas, contador, campos de quedada desplegables y barra fija sobre las pestañas móviles.
- Texto en gallego para WhatsApp con copia; cartel privado amarillo y negro con escudos, partido, quedada, nota y convocados. PNG exacto de 1080 × 1350, descarga y hoja de compartir del sistema cuando está disponible. Variante excluida del formulario general de Carteles.
- «Pasar a alineación» guarda la convocatoria pendiente y abre ese partido. Si todavía no hay alineación guardada, ofrece los convocados para elegir titulares; una alineación existente mantiene prioridad.
- Reconciliación de inscritos retirados e invalidación de respuestas antiguas al cambiar de pantalla o partido. Nota del cartel normalizada para que los saltos de línea no desborden.

`StudioShell.tsx` necesitó una única línea: añadir `convocatoria` a las secciones con selector de categoría. Su CSS quedó intacto. Las pantallas y pruebas reservadas a Claude no se modificaron.

## Verificación

- `pnpm check`: tipos, lint, formato y pruebas correctos; 704 pruebas aprobadas y una omisión preexistente.
- `pnpm e2e`: 232/232 aprobadas, datos reales en modo de lectura, servidor en 3300.
- `pnpm e2e:escritura`: 52/52 aprobadas, base temporal y servidor en 3111. Incluye guardar, reabrir, pasar a alineación y navegar mientras se resuelve un guardado.
- Safari móvil y Chrome Android emulados: 360 y 390 px, controles de al menos 44 px, dos columnas, 22 jugadores en un máximo de dos pantallas, barra sobre las pestañas y carteles de 11 y 22 nombres sin desbordamiento.
- PNG de 22 nombres inspeccionado visualmente; exportación y dimensiones comprobadas en pruebas. Revisión adicional sin problemas accionables pendientes. Ninguna prueba llamó a Gemini.

La primera ejecución completa de lectura tuvo dos fallos propios de altura de texto en Android: corregidos aumentando el interlineado del nombre. También falló una prueba preexistente de Calendario, sin cambiar su código ni su prueba:

```text
e2e/movil.spec.ts:62 — Calendario, 360 px, Safari
Test timeout of 30000ms exceeded.
Error: locator.evaluate: Test timeout of 30000ms exceeded.
- waiting for locator('main input:visible, main select:visible, main button:visible').nth(49)
```

Después pasaron las 12 pruebas dirigidas y la repetición completa de 232 pruebas. El fallo de Calendario no se reprodujo.

No se probó la hoja de compartir en teléfonos físicos ni el envío real a WhatsApp. Las pruebas cubren la exportación y la presencia de la acción de compartir; la descarga actúa como alternativa cuando el navegador no admite compartir archivos.

## Migración pendiente

Generada `packages/db/migrations/0008_convocatorias.sql`, con snapshot y diario. **No aplicada a la base real**: corresponde al dueño, con copia previa. Hasta entonces la pantalla permite consultar plantilla y copiar texto, muestra migración pendiente y bloquea guardado/exportación.

No se modificaron `data/`, el puerto 3100 ni `../santiso-estable`. Entorno secreto copiado sin imprimirlo y excluido de Git.
