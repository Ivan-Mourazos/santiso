# Plan: móvil compacto, importar unificado, carteles, convocatoria y despliegue

Fecha: 11/10/2026. Estado: decisiones cerradas el 11/10/2026; pendiente de empezar.

## Objetivo

1. Que en el móvil (iPhone y Android) ninguna pantalla obligue a un scroll interminable.
2. Que meter resultados y actas sea un solo camino, no tres sitios distintos.
3. Que los carteles de «próximos» y «partido» dejen de repetir lo mismo.
4. Generar el cartel de la convocatoria desde el móvil para pasarlo por el grupo.
5. Que el míster pueda usar la web desde su móvil sin depender del PC de Iván.

## 1. Análisis del móvil (medido)

Medido el 11/10/2026 en la copia estable, iPhone 13 en Safari (390 × 664 px útiles), con los datos reales. «Pantallas» = alto de la página entre alto visible.

| Sección | Pantallas | Qué lo provoca |
|---|---|---|
| Estadísticas | 9,0 | cada jugador es una tarjeta de 212 px (22 jugadores) |
| Equipos | 6,5 | cada equipo ocupa 252 px (14 equipos) |
| Calendario | 6,3 | cada partido es un formulario abierto de 549 px |
| Jugadores | 5,8 | fila de 135 px + botones de 44 px por jugador |
| Multas | 4,9 | 66 campos y 59 botones a la vista; multa de 119 px |
| Patrocinadores | 3,5 | tarjetas de 130–155 px |
| Alineación | 2,8 | 22 filas de 55 px |
| Carteles | 2,6 | formulario antes que la vista previa |
| Ajustes gráficos | 2,2 | bloques de 382 px |
| Jornada | 2,0 | tarjetas de 288 px |
| Clasificación | 2,0 | filas de 59 px (aceptable) |
| Directiva / Actas / Importar / Técnicos / Temporadas | 1,0–1,9 | bien |

Causas comunes, vistas en las capturas:

- **La primera pantalla no enseña ningún dato.** En Estadísticas y Calendario, cabecera (109 px) + tres filtros apilados + texto explicativo ocupan la pantalla entera.
- **Cabecera en dos filas**: título arriba y Senior/Veteranos debajo a todo el ancho.
- **Filtros apilados**: cada desplegable con su etiqueta encima son ~80 px; tres filtros, 240 px.
- **Tablas convertidas en tarjetas altas**: en móvil cada fila se despliega en vertical con todos sus datos y botones.
- **Edición siempre abierta**: Calendario y Multas muestran el formulario de cada elemento en vez de abrirlo al tocar.
- **Doble margen**: margen de página más relleno del panel; se pierden ~50 px de ancho.

Solo se ha medido iPhone. Android (Chrome) no está en las pruebas todavía: es la Fase 0.

## 2. Diseño móvil propuesto

Reglas para todas las pantallas (solo por debajo de 900 px; escritorio no cambia):

- **Cabecera de una fila, 48 px**: título a la izquierda, Senior/Veteranos como selector pequeño a la derecha. Se quita el rótulo de grupo.
- **Filtros en una línea-resumen** («2026/27 · Tercera · J1 ▾») que abre una hoja inferior con los desplegables. Los filtros dejan de ocupar pantalla.
- **Textos de ayuda fuera** del flujo en móvil (detrás de un «?»).
- **Listas densas**: fila de 56–64 px con dos líneas (principal y secundaria). Tocar la fila abre una **hoja inferior** con el detalle y la edición. El área táctil sigue siendo de 44 px.
- **Un solo margen**: en móvil el panel pierde su relleno propio.
- **Barra inferior con 4 pestañas** en lugar del botón «Menú»: Jornada · Importar · Carteles · Más. Lo del día de partido queda a un toque.

Por pantalla:

| Sección | Cambio | Objetivo |
|---|---|---|
| Estadísticas | tabla real compacta: nombre fijo a la izquierda, columnas PJ/Tit/Min/G/TA/TR con scroll lateral; fila de 44 px; tocar abre la ficha | ≤ 2 pantallas |
| Calendario | fila de 64 px (equipos, marcador, fecha); editar en hoja inferior | ≤ 2 |
| Jugadores / Técnicos / Directiva | fila de 56 px (foto, dorsal, nombre, posición); acciones dentro de la hoja | ≤ 2,5 |
| Equipos | fila de 56 px (escudo, nombre, campo) | ≤ 2 |
| Multas | lista por persona con total pendiente; tocar abre sus multas; «Poner multa» en hoja inferior | ≤ 1,5 |
| Patrocinadores | cuadrícula de logos 3 por fila | ≤ 1,5 |
| Alineación | dos columnas de fichas compactas | ≤ 1,5 |
| Carteles | vista previa arriba y fija; formulario en acordeones debajo | vista previa siempre visible |
| Jornada | tarjeta de 120 px con acciones como iconos | ≤ 1,5 |

Para que no vuelva a crecer: prueba automática que falla si una sección supera su presupuesto de pantallas o si el primer dato no cabe en la primera pantalla, en iPhone y en Android.

## 3. Importar: un solo camino

Hoy hay tres entradas: **Importar jornada** (foto / calendario PDF), **Actas** (individual / lote) y los botones sueltos de **Jornada**. Hay que saber de antemano a cuál ir.

Propuesta:

- **Una sola pantalla «Importar»** con una única zona de subida. Se sueltan las capturas y la app decide qué son (acta de un partido, lista de jornada, clasificación, calendario PDF) con una lectura rápida de la cabecera, y abre la revisión que toca. Si duda, pregunta con dos botones.
- **«Ficha de partido»** como centro de cada partido, con sus pasos en orden: Convocatoria → Alineación → Acta → Fotos → Carteles. Cada paso muestra si está hecho. Desde Jornada se entra tocando el partido.
- **Tras guardar, el siguiente paso**: guardar un acta ofrece «Cartel de resultado» y «Cronoloxía»; guardar resultados de jornada ofrece «Resumo da xornada» y actualizar clasificación.
- En el menú, «Actas» e «Importar jornada» pasan a ser una entrada: «Importar». El modo lote y el calendario PDF quedan dentro, como opciones de escritorio.

## 4. Carteles

### Qué se sabe de lo que funciona

La búsqueda no encontró datos medidos sobre qué formato rinde mejor en cuentas de clubes modestos; lo que hay son vendedores de plantillas y estudios sobre clubes profesionales. Con esa reserva:

- Los paquetes de plantillas para clubes amateur coinciden en el mismo ciclo: partido (local/visitante), once inicial, resultado y jugador del partido, en 4:5 (1080 × 1350) y en carrusel.
- Un proveedor de gráficos de alineación recomienda publicarla 30–60 minutos antes del partido (sin datos que lo respalden).
- Estudios sobre clubes españoles apuntan a que publicar menos y mejor rinde más que publicar a diario, y a que la información deportiva rutinaria interesa poco si se repite.

Esto último es justo el problema actual: «Próximos encontros» y el cartel de cada partido cuentan lo mismo dos veces.

### Propuesta

**a) «Axenda» como carrusel, no como carteles sueltos.** Un botón genera el paquete del fin de semana: portada + una lámina por partido, numeradas y con un único texto de Instagram. Se sube como una sola publicación.

- **Portada (axenda)**: mínima. Día y hora grandes, escudo del rival, categoría. Sin campo ni competición.
- **Lámina de partido**: lo que la portada no dice. Campo y cómo llegar, competición y jornada, puesto de los dos equipos en la tabla, últimos resultados y patrocinador.

Así cada lámina aporta algo y dejan de ser duplicados.

**b) Versión historia (9:16)** de portada y de partido, para «Hoxe xogamos» el día del partido.

**c) Calendario de la semana que la app propone:**

| Cuándo | Qué | Formato |
|---|---|---|
| Lunes | Resumo da xornada (los dos equipos) | 4:5 |
| Jueves | Axenda: portada + partidos | carrusel 4:5 |
| Día de partido, mañana | Hoxe xogamos | historia 9:16 |
| Víspera o mañana | Convocatoria | grupo del club |
| 30–60 min antes | Alineación | historia 9:16 |
| Al acabar | Resultado y cronoloxía | 4:5 |

**d) Arreglos de diseño vistos**: «Próximos encontros» deja un vacío enorme con uno o dos partidos (la composición debe adaptarse al número de filas); en «Partido», «DATA POR DEFINIR» pesa más que el rival.

## 5. Convocatoria

Pantalla nueva dentro de la ficha de partido, pensada para el móvil:

- Elegir partido → lista de la plantilla con casillas (todos marcados; se desmarca quien no va).
- Datos de la quedada: hora, lugar, equipación y una nota libre.
- Cartel 4:5 para WhatsApp: partido, día y hora, quedada, y los convocados en dos columnas con dorsal. - Compartir con la hoja del sistema (como en Alineación) y texto listo para pegar.
- «Pasar a alineación» carga los convocados para elegir el once.

Datos: tabla nueva para la quedada y los convocados de cada partido, aparte del acta (igual que la alineación previa).

## 6. Despliegue para el míster

Hoy la app está atada al PC por cuatro cosas: la base de datos es un fichero, las fotos están en disco, los PNG de los carteles se generan con un navegador (Chromium) en el servidor y **no hay contraseña**.

| Opción | Cambios | Pega |
|---|---|---|
| Vercel + base y almacenamiento en la nube | base remota, fotos a almacenamiento externo, rehacer el generador de PNG | la más cara en trabajo; el navegador para PNG encaja mal en funciones sin servidor |
| **Servidor pequeño con disco propio** (VPS o similar, con Docker) | casi ninguno: mismo fichero de base, mismas fotos, mismo generador | cuota mensual pequeña; hay que mantener copias |
| Seguir en el PC y dar acceso por Tailscale al míster | ninguno | el PC tiene que estar encendido; el míster instala Tailscale |

**Decidido el 11/10/2026 (Iván no quiere gastar): seguir en el PC y dar acceso al míster por Tailscale.** Coste cero y sin tocar base, fotos ni generador de PNG. El míster instala Tailscale en su móvil y entra con la misma dirección que Iván. Según fuentes de 2026 el plan gratuito admite seis usuarios; hay que confirmarlo en la cuenta al invitarle.

Pega aceptada: el PC tiene que estar encendido (ya arranca la copia móvil solo al iniciar sesión).

Si esa dependencia molesta más adelante, la salida gratuita es una máquina «Always Free» de Oracle Cloud con Docker: mismo código, sin PC. No se elige ahora porque el alta pide tarjeta, la capacidad gratuita a menudo no está disponible y Oracle recortó el tramo gratuito en 2026. Vercel gratuito queda descartado: obliga a rehacer base, fotos y generador de PNG (3–5 días) para ahorrar lo mismo.

Antes de dar acceso al míster:

- **Acceso con usuario y contraseña** y dos papeles: administrador (Iván) y cuerpo técnico (el míster: convocatoria, alineación, multas, actas, carteles; sin borrar temporadas ni catálogos).
- HTTPS ya lo pone Tailscale; no hace falta dominio.
- **Copia diaria** automática de base y fotos (hoy es manual con `pnpm db:backup`).
- La clave de Gemini solo en el servidor.
- Las multas siguen sin salir en carteles ni exportaciones.

Los datos siguen viviendo en el PC: la especificación «solo local» no cambia.

## 7. Fases y esfuerzo

| Fase | Qué | Esfuerzo |
|---|---|---|
| 0 | Pruebas en Android (Chrome, 360 y 412 px) y presupuestos de scroll | 0,5 día |
| 1 | Marco móvil: cabecera de una fila, barra de pestañas, filtros en hoja, densidad | 1,5 días |
| 2 | Convocatoria | 1 día |
| 3 | Listas compactas, pantalla a pantalla (tabla de la sección 2) | 3 días |
| 4 | Acceso del míster: usuario y contraseña con dos papeles, copia diaria, invitación por Tailscale | 1 día |
| 5 | Importar unificado y ficha de partido | 2 días |
| 6 | Carteles: carrusel de axenda, rediseño de próximos/partido, 9:16 | 2–3 días |

Total: 11–12 días de trabajo. Cada fase se entrega con `pnpm check`, e2e de lectura (iPhone y Android) y e2e de escritura en verde.

El orden pone primero lo que el míster va a tocar (marco, convocatoria, listas) y su acceso justo después.

## 8. Decisiones de Iván (11/10/2026)

1. **Alojamiento**: sin gasto. PC + Tailscale para el míster (ver sección 6).
2. **Quién entra**: el míster, que también pone multas.
3. **Barra de pestañas** en móvil en lugar del botón «Menú»: sí.
4. **Convocatoria**: solo para el grupo del club; sin versión pública.
