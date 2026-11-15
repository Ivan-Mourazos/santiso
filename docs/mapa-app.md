# Mapa de la app (Studio)

Inventario de todas las pantallas, agrupadas como la barra de abajo del móvil (Inicio · Liga ·
Equipo · Carteles · Más). Cada pantalla tiene un código (`L2`, `E3.1`…) para referirse a ella en
otras conversaciones. Columna **Decisión**: mantener / compactar / fusionar con… / eliminar /
pendiente. Se rellena al repasar cada parte.

Hecho el 15/11/2026 a partir del código (`lib/navigation/contexto.ts`, `menu.ts`,
`components/admin/**`). Rutas: `/admin/<sección>`.

## I · Inicio

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| I1 | Inicio | `inicio` | Solo el partido de cada equipo (cruce, puesto en la tabla); tocarlo abre su detalle en L1 | **hecho 15/11**: tarjeta compacta (idea C), sin pasos ni tareas |

## L · Liga

Subnavegación arriba: Partidos · Clasificación · Goleadores · Estadísticas · Archivo.

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| L1 | Partidos | `partidos` | Competición, jornada ‹ ›, lista de la jornada con el nuestro el primero | **hecho 15/11**: sin mesa ni pasos |
| L1.1 | Mesa del partido | — | (Siguiente tarea, sanciones, «Más tareas», Directo) | **eliminada de L1 15/11**; solo queda en O4 |
| L1.2 | Fotos del partido | diálogo | Galería del partido, desde «Fotos» en L1.3 | |
| L1.3 | Detalle de partido | diálogo | Equipos (a su ficha), día·hora·campo, árbitro, Directo, Fotos, Traer acta (si falta), carteles en una línea, goles y tarjetas por separado | **hecho 15/11**: sin corregir/meter acta a mano (manda la federación) |
| L2 | Clasificación | `clasificacion` | Tabla de la competición | |
| L2.1 | Ficha rápida de equipo | diálogo | Resumen del equipo, enlace a O2 | |
| L2.2 | Opciones / Zonas | diálogos | Zonas de ascenso/descenso; actualizar con la federación (admin) | |
| L3 | Goleadores | `liga` | Pestañas Avisos · Goleadores · Tarjetas; traer jornadas que faltan | |
| L4 | Estadísticas | `estadisticas` | Tabla de jugadores con buscador, filtros y orden | |
| L4.1 | Ficha rápida de jugador | diálogo | Resumen del jugador, enlace a O1 | |
| L5 | Archivo | `archivo` | Temporadas pasadas: clasificaciones finales y partidos | |

## E · Equipo

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| E1 | Convocatoria | `convocatoria` | Marcar quién va, avisos de sanción, cartel de convocatoria | |
| E2 | Once inicial | `alineacion` | Titulares, capitán, campo táctico, cartel del once | |
| E2.1 | Elegir jugador del hueco | hoja | Entra / cambiar de sitio / quitar del campo | |
| E3 | Jugadores | `jugadores` | Plantilla de la temporada, buscador, plantilla frente a actas | |
| E3.1 | Editor de jugador | diálogo | Nombre, apodo, dorsal, posición, foto, historial | |
| E3.2 | Añadir de temporada anterior | diálogo | Traer jugadores del año pasado | |
| E3.3 | Ficha rápida de jugador | diálogo | La misma que L4.1 | |
| E4 | Cuerpo técnico | `tecnicos` | Lista, editor, añadir de temporada | |

## C · Carteles (solo admin)

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| C0 | Catálogo | `carteles` | Lista de carteles por grupos | |
| C1 | Resultado e O Noso 11 | `carteles?plantilla=despues` | Resultado arriba (equipos → su ficha, ✎ cambiar partido) y dos desplegables: Carteles (vistas, descargar uno o los 2, once, texto) y Eventos | **hecho 15/11**: eventos en una línea con hoja para editar; fuera «Logos y patrocinadores» en todos los carteles |
| C2 | Cartel de partido | `?plantilla=partido` | Día, hora y campo | |
| C3 | Próximos partidos | `?plantilla=proximos` | Agenda del finde | |
| C4 | Clasificación | `?plantilla=clasificacion` | Cartel de la tabla | |
| C5 | Fichaje | `?plantilla=fichaxe` | Altas y renovaciones | |
| C6 | Comunicado | `?plantilla=comunicado` | Aviso del club | |
| C7 | Celebración | `?plantilla=multiusos&tema=celebracion` | Títulos y fiestas | |
| C8 | Lotaría | `?plantilla=loteria` | Nadal e Neno | |
| C9 | Restos sin menú | `?plantilla=resumo` / `cronoloxia` / `noso11` | Plantillas viejas, solo por dirección | |

Todas comparten: formulario + vista previa + formato (4:5 / 9:16) + texto para Instagram.

## M · Más

### Federación

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| M1 | Importar | — | (Subir capturas: acta o jornada) | **eliminada 15/11** (redirige a M2) |
| M1.1 | Acta individual | — | (Revisar datos, titulares, suplentes, eventos) | **eliminada 15/11**: manda la federación |
| M1.2 | Actas en lote | — | (Varias actas de una vez) | **eliminada 15/11** |
| M1.3 | Jornada desde foto | — | (Lectura con IA) | **eliminada 15/11** |
| M1.4 | Calendario completo (PDF) | — | (Subir PDF) | **eliminada 15/11**: el calendario se trae en M2 |
| M2 | Federación (admin) | `federacion` | «Volver a traer»: ponerse al día, calendario completo, horarios, jornada o partido, clasificación, jugadores (uno o cuatro); debajo, qué hay traído, temporadas pasadas y enlaces | **hecho 15/11** |
| M3 | Amistosos y torneos | `calendario` | Crear y editar partidos que no están en futgal.es (antes «Calendario»); sin traer horarios | **hecho 15/11**: renombrada |

### Vestuario

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| M4 | Adestramentos | `adestramentos` | Entrenos y cuadrante de asistencia (crea multas solas) | |
| M5 | Multas | `multas` | Multas · Resumen · Normas; nueva multa | |
| M6 | Directiva | `directiva` | Lista y editor (mismo componente que E4) | |

### Club y ajustes

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| M7 | Equipos | `equipos` | Competiciones, equipos, enlazar con la federación, escudos | |
| M8 | Patrocinadores y logos | `patrocinadores` | Catálogo de logos y orden de la barra del cartel | |
| M9 | Temporadas (admin) | `temporadas` | Lista y nueva temporada | |
| M10 | Ajustes gráficos (admin) | `ajustes-graficos` | Logos de Xunta y RFGF | |
| M11 | Usuarios (admin) | `usuarios` | Altas, rol, cambiar contraseña | |
| M12 | Mi cuenta | `cuenta` | Mi contraseña, cerrar sesión | |

## O · Pantallas sin entrada en el menú

| Código | Pantalla | Ruta | Desde dónde se llega | Decisión |
|---|---|---|---|---|
| O1 | Ficha de jugador | `jugador?id=` | Ficha rápida (L4.1 / E3.3); «Traer cifras de esta temporada» (admin) | |
| O2 | Ficha de equipo | `equipo?id=` | L1.3, L2.1, «Otros equipos» de O1 | |
| O3 | Directo (libreta) | `directo?partido=` | L1.1, L1.3 | |
| O4 | Jornada | — | (Mesa del partido con pasos) | **eliminada 15/11** (redirige a Inicio) |

Fuera del panel: `/entrar` (login) y `/render/cartel` (interna, para hacer los PNG).

## Solapes a decidir

1. **Traer de la federación**: todo en M2 «Volver a traer»; atajos en L1.3 (acta si falta),
   O1 (cifras del jugador) y L2.2 (clasificación).
2. **Temporadas pasadas**: L5 (ver) y M2 (traer).
3. **Fichas dobles**: jugador (L4.1/E3.3 diálogo + O1 pantalla) y equipo (L2.1 y L1.3
   diálogos + O2 pantalla).
4. **Mesa del partido**: eliminada el 15/11 (I1, L1 y O4).
5. **Carteles de resultado**: C1 (carrusel) y los viejos de C9.
6. **Importar** (M1–M1.4): eliminado el 15/11.
7. **Multas** las crea M4 y se gestionan en M5.
8. **Logos** repartidos: M8 (patrocinadores), M10 (institucionales), M7 (escudos).
9. **E4 y M6** son el mismo componente con otro filtro.

## Orden propuesto para repasar

1. I1 Inicio · 2. C1 Resultado · 3. L1 Partidos · 4. E1–E2 Convocatoria y Once ·
5. E3 Jugadores · 6. resto de Liga · 7. resto de Carteles · 8. Más (Federación, Vestuario,
Ajustes) · 9. ocultas y solapes.
