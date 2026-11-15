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
| I1 | Inicio | `inicio` | Tablero: partido de cada equipo, siguiente paso, pasos, clasificación | compactar (idea C) |

## L · Liga

Subnavegación arriba: Partidos · Clasificación · Goleadores · Estadísticas · Archivo.

| Código | Pantalla | Ruta | Qué se hace | Decisión |
|---|---|---|---|---|
| L1 | Partidos | `partidos` | Competición, jornada ‹ ›, mesa del partido de la semana, lista de la jornada | |
| L1.1 | Mesa del partido | (dentro de L1) | Siguiente tarea, sanciones, «Más tareas», Directo | |
| L1.2 | Fotos del partido | diálogo | Galería del partido | |
| L1.3 | Detalle de partido | diálogo | Fichas de equipo, día/campo, goles y tarjetas, acta (traer/abrir), carteles, Directo | |
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
| C1 | Resultado e O Noso 11 | `carteles?plantilla=despues` | Carrusel de después: eventos + once | compactar (idea A) |
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
| M1 | Importar | `importar` | Subir capturas: decide si es acta o jornada | |
| M1.1 | Acta individual | `actas?modoActas=individual` | Revisar datos, titulares, suplentes, eventos | |
| M1.2 | Actas en lote | `actas?modoActas=lote` | Varias actas de una vez, revisar cada una | |
| M1.3 | Jornada desde foto | `importar-jornada?origen=foto` | Lectura con IA y revisión fila a fila | |
| M1.4 | Calendario completo (PDF) | `importar-jornada?origen=calendario` | Traer la temporada entera | |
| M2 | Federación (admin) | `federacion` | Enlaces, traer calendario, traer a mano, jornadas, temporadas pasadas | |
| M3 | Calendario | `calendario` | Editar jornadas y partidos, nuevo partido, descansos, traer horarios | |

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
| O1 | Ficha de jugador | `jugador?id=` | Ficha rápida (L4.1 / E3.3) | |
| O2 | Ficha de equipo | `equipo?id=` | L1.3, L2.1, «Otros equipos» de O1 | |
| O3 | Directo (libreta) | `directo?partido=` | L1.1, L1.3 | |
| O4 | Jornada | `jornada` | **Ninguna pantalla la enlaza** (su mesa ya vive en L1) | |

Fuera del panel: `/entrar` (login) y `/render/cartel` (interna, para hacer los PNG).

## Solapes a decidir

1. **Traer de la federación** en varios sitios: acta (L1.3 y M2), horarios (M3 y M2),
   clasificación (L2.2 y M2), calendario (M2 y M1.4).
2. **Temporadas pasadas**: L5 (ver) y M2 (traer).
3. **Fichas dobles**: jugador (L4.1/E3.3 diálogo + O1 pantalla) y equipo (L2.1 y L1.3
   diálogos + O2 pantalla).
4. **Mesa del partido** en L1 y en O4 (oculta); Inicio (I1) la resume.
5. **Carteles de resultado**: C1 (carrusel) y los viejos de C9.
6. **Importar** (M1) reparte a M1.1–M1.4, que tienen selectores propios.
7. **Multas** las crea M4 y se gestionan en M5.
8. **Logos** repartidos: M8 (patrocinadores), M10 (institucionales), M7 (escudos).
9. **E4 y M6** son el mismo componente con otro filtro.

## Orden propuesto para repasar

1. I1 Inicio · 2. C1 Resultado · 3. L1 Partidos · 4. E1–E2 Convocatoria y Once ·
5. E3 Jugadores · 6. resto de Liga · 7. resto de Carteles · 8. Más (Federación, Vestuario,
Ajustes) · 9. ocultas y solapes.
