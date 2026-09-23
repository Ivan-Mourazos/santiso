# Fase 9A — Pantalla «Jornada»: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** una pantalla que reúna el trabajo de cada semana —el partido de cada categoría, su acta, los carteles y la clasificación— y que abra las demás pantallas con el partido ya elegido, en vez de obligar a buscarlo en cada una.

**Arquitectura:** una consulta nueva devuelve, para la semana pedida (lunes a domingo), los partidos del club por categoría con el estado de su acta y la posición en la clasificación. La pantalla no guarda nada: enlaza. Carteles, Actas e Importar jornada aceptan parámetros de URL para abrirse con el partido o la jornada ya puestos; sin esos parámetros se comportan como hoy.

**Tecnología:** Next 16, Drizzle core, componentes `foundation`, Playwright.

**Decisión del usuario (23/09/2026):** aprobado el diseño tal cual; primera sección del menú.

## Restricciones

- No escribe: la pantalla solo lee y enlaza.
- No tocar el dibujo de carteles (`lib/cartel-draw.ts`, `lib/cartel/**`).
- Los parámetros nuevos de Carteles, Actas e Importar jornada son opcionales: sin ellos, cada pantalla hace exactamente lo de antes (lo comprueban sus pruebas actuales).
- `pnpm check` antes de cada commit; ahora incluye ESLint de `apps/studio`.

## Decisiones

- **Semana** = lunes a domingo, por la fecha local del partido (`partidos.fecha` es hora de pared `AAAA-MM-DDTHH:mm`): se filtra comparando texto, sin zona horaria. En la URL, `?semana=AAAA-MM-DD` (cualquier día de la semana); sin ella, la de hoy.
- **Categorías:** las que tienen competición en la temporada activa. Cada una enseña sus partidos de la semana (puede haber liga y copa) o «Sin partido esta semana».
- **Acta:** guardada si el partido tiene convocatoria. Se enseñan convocados, goleadores del Santiso, goles en propia del rival y tarjetas.
- **Clasificación:** posición del Santiso, puntos y número de equipos, solo en competiciones de formato liga.
- **Enlaces:** `carteles?plantilla=…&partido=ID`, `actas?categoria=…&competicion=…&partido=ID`, `importar-jornada?origen=foto&categoria=…&competicion=…&jornada=ID`, `clasificacion?categoria=…&competicion=…`.

## T1 — Datos

- [ ] `lib/jornada/semana.ts`: `semanaDe(dia)`, `semanaVecina(dia, ±1)` y `hoyLocal()`, puros y con pruebas (cambio de mes y de año, domingo, día no válido).
- [ ] `lib/server/consultas/jornada.ts`: `pantallaJornada(semana)`; pruebas con base temporal: filtra por semana y temporada activa, agrupa por categoría, acta pendiente frente a guardada, goleadores y tarjetas bien atribuidos, posición en la clasificación.
- [ ] `lib/server/acciones/jornada.ts`: `cargarPantallaJornada(semana?)` con `Resultado`.

## T2 — Enlaces en las pantallas existentes

- [ ] Carteles: `partido` en la URL carga ese partido en cuanto llega la lista (`loadMatchFromDb`), una sola vez.
- [ ] Actas: `categoria`, `competicion` y `partido` como valores iniciales.
- [ ] Importar jornada (foto): `categoria`, `competicion` y `jornada` como valores iniciales.
- [ ] Pruebas e2e de solo lectura de cada enlace.

## T3 — Pantalla

- [ ] Sección `jornada`, la primera del grupo «Competición».
- [ ] Navegación de semanas (anterior, esta, siguiente) en la URL.
- [ ] Tarjeta por partido con los botones del diseño; acciones de acta y carteles según el estado.
- [ ] e2e de solo lectura contra la base real y de escritura sobre la de juguete; 360 y 1280 sin desbordes.

## Cierre

- [ ] `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura`. Fusionar y empujar.
