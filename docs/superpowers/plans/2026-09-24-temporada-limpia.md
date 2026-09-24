# Temporada limpia: retirar 2025/26 y empezar 2026/27 desde cero

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** que la base de datos solo contenga la temporada 2026/27, sin nada heredado de la anterior: ni partidos, ni plantillas, ni equipos, campos o fotos que ya no se usan. La temporada 2025/26 queda archivada en un fichero aparte, fuera de la aplicación.

**Decisión del usuario (24/09/2026):**
- «Quiero empezar de 0 sin contaminar con lo del año pasado.»
- Primero, lo necesario para el cartel de este fin de semana (hecho: horas corregidas y escudos en «Próximos encuentros»). Después se retira todo lo de 2025/26.

## Estado de partida (base real, 24/09/2026)

| | 2025/26 | 2026/27 |
|---|---|---|
| Competiciones | 6 | 2 (Tercera Futgal Gr. 3, Veteranos 1ª Galicia Gr. 2) |
| Jornadas / partidos | 92 / 632 | 56 / 422 (calendario completo de las dos ligas) |
| Plantilla | Senior 22, Veteranos 21, Femenino 18 | Senior 12, Veteranos 0 |
| Staff | 11 | 2 |

Además hay 61 jugadores (personas), 901 eventos de acta, 1213 convocatorias, 66 equipos y 62 campos.

**Contaminación detectada:**
- «Prefabricados Faro Rodeiro» (de 2025/26) está inscrito en la liga de veteranos 2026/27 sin ningún partido, junto al que sí juega («PREFABRICADOS FARO RODEIRO VETERANS»). La clasificación de veteranos cuenta 17 equipos en vez de 16.
- Las horas de 2026/27 venían de relleno (Senior 17:00, Veteranos 18:00). Solo están corregidas las de este fin de semana.
- Los nombres de 2026/27 mezclan mayúsculas federativas («S.D. TOURO VETERANOS») con nombres cuidados.

## Qué se pierde (y queda en el archivo)

- **Estadísticas históricas:** goles, tarjetas y minutos de 2025/26 desaparecen de la aplicación. Siguen en el fichero de archivo.
- **Datos de 2025/26:** plantillas, staff, partidos, actas y clasificaciones de esa temporada.
- **Jugadores y técnicos que no se inscriban en 2026/27 antes de limpiar:** se borran, con su foto.

**Recuperación:** solo sustituyendo `data/santiso.db` por el archivo, con `pnpm dev` parado. No hay «deshacer» dentro de la aplicación.

## Antes de limpiar (lo hace Ivan, 10 minutos)

- [ ] Publicar los carteles del fin de semana 26–27/09.
- [ ] En Plantilla, inscribir en 2026/27 a quien siga este año, con «Añadir de 2025/26». Sobre todo **Veteranos**, que está a 0. Esas personas se conservan, con su foto y su dorsal. El resto se borra.
- [ ] Lo mismo en Cuerpo técnico y Directiva.
- [ ] Parar `pnpm dev`.

## T1 — Herramienta de limpieza (Claude, 2–3 h)

Es un CLI en `packages/db/src/cli/limpiar-temporada.ts`: `pnpm db:limpiar-temporada --temporada 2025/26`.

- **Por defecto es un ensayo.** No escribe nada: calcula qué se borraría y guarda el informe en `data/informes/limpieza-2025-26-<marca>.md`.
- **Con `--aplicar`:**
  1. Copia completa con `VACUUM INTO` en `data/backups/archivo-temporada-2025-26-<marca>.db`. Si la copia falla, no toca nada.
  2. En una transacción:
     - La temporada y lo que cuelga de ella: competiciones, alias, jornadas, partidos, eventos, convocatorias, descansos, ajustes de clasificación e inscripciones de equipos.
     - Las inscripciones de jugadores y staff de 2025/26.
     - **Inscripciones fantasma:** equipos inscritos en una competición de 2026/27 con calendario pero sin ningún partido en ella (el Faro Rodeiro viejo). Salen en el informe una a una.
     - **Huérfanos:** equipos, campos, jugadores y staff que ya no referencia nada.
  3. Mueve los ficheros de `data/media` que ya no referencia nadie (escudos, fotos) a `data/backups/media-2025-26-<marca>/`. **No los borra.**
  4. Ejecuta `VACUUM`.
- **Nunca toca:**
  - `patrocinadores`, `ajustes` (gráficos), `data/snapshots` ni Supabase.
  - Ninguna fila de la temporada activa, salvo las inscripciones fantasma. Si algo de 2026/27 aparece en el plan de borrado, el CLI aborta.

**Pruebas en `packages/db`:**
- Una base de juguete con dos temporadas.
- El ensayo no escribe.
- `--aplicar` deja 2026/27 intacta, fila a fila (se compara con una foto de la base previa).
- Un jugador inscrito en las dos temporadas se conserva; uno solo de 2025/26 se borra.
- Un equipo fantasma se retira; un equipo con partidos en 2026/27 se conserva.
- El fichero de media huérfano se mueve y el usado se queda.
- Si la copia falla, no se toca nada.

## T2 — Ensayo sobre la base real (Claude, 15 min)

- [ ] Ensayo contra `data/santiso.db`. Revisar el informe con Ivan.

**Esperado:**
- Se borran 632 partidos y 6 competiciones.
- 0 filas de 2026/27, salvo 1 inscripción fantasma (Faro Rodeiro).
- Se borra «Terras de Touro»: queda huérfano, y el de 2026/27 es «S.D. TOURO VETERANOS».
- Se borran los «Boiro» de veteranos, que no juegan este año.

## T3 — Aplicar (Claude, con `pnpm dev` parado, 10 min)

- [ ] `pnpm db:limpiar-temporada --temporada 2025/26 --aplicar`.
- [ ] Comprobar:
  - La clasificación de veteranos tiene 16 equipos.
  - Jornada y Calendario muestran lo mismo que antes para 2026/27.
  - Los carteles del fin de semana se generan igual.
- [ ] `pnpm e2e`, que corre contra la base real. Las pruebas que eligen «2025/26» (Plantilla, Estadísticas, Clasificación, Temporadas) **se reescriben**: deben usar datos de 2026/27 o pasar a `e2e-escritura` con la base de juguete. Esto va en la misma rama.

## T4 — Nombres uniformes de 2026/27 (Claude, 2 h)

Es el «Unificar nombres» aprobado el 24/09, ahora sobre una base limpia.

- Pantalla Equipos → «Unificar nombres». Muestra una tabla con el nombre actual y el propuesto:
  - Formato de título.
  - Siglas conservadas («S.D.», «C.F.», «U.D.»).
  - Sin sufijos redundantes con la categoría: «VETERANOS» / «VETERANS» en equipos de veteranos.
- Cada propuesta se puede editar o descartar antes de aplicar.
- Antes de aplicar hace una copia de la base. Todo va en una transacción.
- La clave (`clave`) se recalcula. Si choca con otro equipo de la categoría, esa fila no se aplica y se dice por qué.
- Pruebas: la función de propuesta es pura y va en `lib/equipos`. La aplicación se prueba en `e2e-escritura`.

## T5 — Horas reales (Ivan, con la herramienta ya hecha)

- Calendario → «Partidos del Santiso»: cambiar las horas conforme la federación las publique.
- Si Ivan confirma que los veteranos juegan siempre a las 19:00 en casa, Claude las pone de golpe (con copia previa).

## Queda fuera

- **`fusionar-equipos`:** detección de duplicados y fusión en servidor, sin pantalla. Está aparcado en esa rama. Con la base limpia, el único duplicado conocido desaparece. Se retoma solo si vuelve a hacer falta.
- **`tools/migracion-supabase`:** se queda hasta la retirada de Supabase (Fase 2), como dice AGENTS.md. Con la temporada 2025/26 archivada, esa retirada se puede adelantar.

## Cierre

- [ ] `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura`. Fusionar en `main` y empujar.
- [ ] Anotar en AGENTS.md que las pruebas de solo lectura ya no pueden contar con una temporada anterior en la base real.

**Esfuerzo total de Claude:** 5–6 h (T1 2–3 h, T2–T3 30 min, reescribir e2e 1 h, T4 2 h).
