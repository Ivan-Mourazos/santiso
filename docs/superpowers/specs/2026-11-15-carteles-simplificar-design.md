# Carteles: simplificar y rediseñar (15/11/2026)

## Por qué

Iván publica poco: el carrusel de próximos (miércoles/jueves) y el cartel de partido en historias
el día del partido. Después del partido no publica nada porque los diseños no le convencen:
Resultado y Cronoloxía se repiten, y O Noso 11 sin foto (dos columnas de nombres) «queda
horrible». Quiere pocos carteles y buenos, todo desde el móvil (≥360 px) y también en PC.

Uso real (base, 8 partidos con carteles): partido 8, resultado 7, cronoloxía 7, O Noso 11 5,
convocatoria 4, once 3. Cronoloxía y O Noso 11 salen altos porque la tarjeta de Inicio los exige
para «cerrar» el partido (`lib/jornada/vestiario.ts` → `cierreHecho`), no porque se publiquen.

## Objetivos

1. **Alineación sobre campo táctico**: un único diseño que sirve antes del partido (historia
   9:16, «Once inicial», Senior) y después (publicación 4:5, «O Noso 11», Senior y Veteranos).
2. **Resultado único**: el diseño de Cronoloxía mejorado pasa a ser «Resultado»; desaparece el
   Resultado actual y Cronoloxía como cartel aparte.
3. **Menos ruido**: Inicio solo pide el Resultado para cerrar el partido; fuera el cartel suelto
   de Próximos (queda el carrusel Axenda); una sola lista de pasos por partido.

## No objetivos

- Fotos de jugadores en la alineación (descartado por Iván: «nada de fotos»).
- Arrastrar jugadores con el dedo.
- Tocar Partido, Axenda, Convocatoria, Clasificación, Fichaje, Comunicado, Celebración, Lotaría
  (se quedan como están; automatizar publicaciones se estudiará después).
- IA para mejorar fotos.

## Anti-objetivos

- Que el cartel deje de caber o se lea mal con muchos eventos o nombres largos.
- Perder PNG ya guardados en `media/carteles/` o filas de `carteles_partido`.
- Romper el uso desde el móvil o el acceso del técnico (convocatoria y alineación).
- Estilo distinto del resto: seguir la regla de unificar estilo (sin franjas de rayas ni cortes
  secos; colores fundidos) y probar en todos los carteles tocados.

## Referencia visual (aprobada)

Bocetos en `G:\Mi unidad\Santiso\bocetos-carteles\` (fuente HTML en
`C:\Users\Ivan_\bocetos-carteles\`, `gen3.cjs` y `gen4.cjs`):

- `8-alineacion-camiseta-real-publicacion.png` (H) — O Noso 11, publicación.
- `9-alineacion-camiseta-real-historia.png` (I) — Once inicial, historia.
- `10-resultado-mejorado.png` (J) — Resultado; `11-…` y `12-…` pruebas con 11 y 18 eventos.

Claves del diseño:

- **Campo** en perspectiva (CSS 3D `rotateX ~32°`), césped oscuro a franjas, líneas blancas,
  brillo amarillo; fichas contrarrotadas para verse de frente.
- **Camiseta real** en SVG: amarilla con rayas verticales negras, tres franjas negras en los
  hombros, cuello amarillo; dorsal blanco con borde negro. **Portero: rosa** con detalles negros.
  Senior y Veteranos llevan la misma equipación.
- Nombre en pastilla oscura con borde amarillo bajo la camiseta; «C» de capitán.
- Publicación: cabecera categoría·jornada, título «O Noso 11», pastilla con resultado y escudos;
  suplentes en línea abajo; logos/patrocinadores como hoy.
- Historia: márgenes de 250 px arriba/abajo (`MARGEN_HISTORIA`); «Once inicial», escudos VS,
  día·hora·campo; banco abajo.
- **Resultado**: fondo de focos como la Cronoloxía actual con luz del color de cada equipo,
  título «Resultado», marcador con escudos (goles propios en amarillo), **línea de tiempo
  central**: minuto en pastilla, eventos del local a la izquierda y del visitante a la derecha,
  separador «DESCANSO», pie con día·campo. Iconos: balón SVG, amarilla, roja (doble amarilla =
  roja, como hoy).
- **Muchos eventos**: las filas se encogen; con más de 13, en la línea solo goles y rojas y las
  amarillas pasan a un resumen por equipo abajo. Además, con muchos eventos se reducen marcador y
  escudos para que el texto no baje de un tamaño legible (pedido tras ver la prueba L).

## Enfoques considerados

1. **Reformar sobre el motor actual (`cartel2`) — elegido.** Mismo render HTML→PNG, mismo
   guardado por partido (`carteles_partido`), mismas pantallas.
2. Coordenadas libres por jugador con arrastre — descartado: Iván no necesita arrastrar.
3. Colocar por posición de plantilla sin poder cambiar — descartado: quiere elegir hueco y
   sustituir.

## Lo decidido por Iván

### Alineación estilo «Fantasy»

- Se elige **sistema** (p. ej. 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 4-1-4-1, 5-3-2).
- El dibujo muestra los 11 **huecos** del sistema. Tocar un hueco vacío → lista de jugadores
  disponibles → se coloca. Tocar un jugador colocado → elegir otro para sustituirlo (el sustituido
  vuelve a disponibles o al banco). Sin arrastrar.
- **Disponibles = la convocatoria** del partido (la alineación se hace después de convocar;
  Iván, 15/11). En O Noso 11, los del acta.
- Al abrir sin nada guardado, se rellena solo: cada titular al hueco que encaja con su
  `jugadores_temporada.posicion` (POR, LD, DFC, LI, MCD, MC, MCO, MD, MI, ED, EI, DC); el resto,
  a huecos libres.
- Mismo editor en la pantalla **Alineación** (antes del partido, Senior; la usa también el
  técnico) y en **O Noso 11** (después; para Veteranos, que no hacen alineación previa — ver
  memoria «Veteranos sin convocatoria»).
- O Noso 11 parte de los titulares del acta (como hoy, `cargarJugadoresDePartido`) y, si existe,
  del sistema y huecos guardados en la alineación previa.

### Datos

- Se guardan **dos colocaciones separadas** (decisión de Claude tras la revisión):
  - **Previa** (pantalla Alineación): sistema por partido + `hueco` en `partido_alineaciones`.
    Esa tabla sigue siendo solo la alineación anunciada (la usan `consultas/jornada.ts`, la huella
    del paso `once` en `carteles/guardados.ts` y el capitán en `consultas/actas.ts`).
  - **O Noso 11** (después): sistema y huecos propios, aparte de la previa (tabla nueva pequeña o
    `hueco` en `partido_participaciones` + sistema; lo decide quien construya). Arranca copiando la
    previa si existe; editarla **no** toca la previa, ni crea una previa falsa en Veteranos, ni
    cambia el capitán del acta ni la huella del Once inicial.
- Migración con `pnpm db:generate`, pruebas en `packages/db/src/schema.test.ts`; copia
  (`pnpm db:backup`) antes de migrar la base real.

### Publicación de después del partido: juntos

- Iván (15/11): Resultado y O Noso 11 **se publican juntos, nunca por separado**. Se hace como el
  carrusel Axenda: un único paso «Después del partido» que genera las dos imágenes (1: Resultado,
  2: O Noso 11) y las comparte/guarda juntas en una sola acción (mismo mecanismo que
  `PaqueteAxenda`), con un solo texto de Instagram. Cada imagen sigue guardándose por partido.
  Carrusel de 2 imágenes 4:5 (confirmado por Iván). Diseño aprobado el 15/11/2026.

### Pasos y menú

- Pasos por partido (`lib/cartel2/pasos.ts`): **partido** (publicación+historia),
  **convocatoria**, **once** → nueva alineación en historia, **resultado** → diseño J
  (publicación), **noso11** → nueva alineación en publicación. **cronoloxia** desaparece como paso.
- `cierreHecho` (Inicio): el partido se cierra con el **Resultado** guardado; Cronoloxía y O Noso
  11 dejan de ser obligatorios.
- Menú «Carteles» → «Después del partido»: Resultado, O Noso 11 (sin Cronoloxía).
- «Próximos partidos»: queda solo el carrusel Axenda; se quita el formulario/cartel suelto
  (`FormProximos` dentro de esa pantalla) si nada más lo usa. Verificarlo antes de borrar.
- Las entradas a carteles de un partido (Inicio, Liga › Partidos, Convocatoria, Alineación,
  menú) deben enseñar la misma lista de pasos (un solo catálogo: `PASOS`).

### Compatibilidad

- Filas antiguas de `carteles_partido` con paso `cronoloxia` y sus PNG se conservan (se pueden
  seguir viendo/compartiendo como «Resultado (antiguo)» o simplemente ignorarse); no se borran.
  El `checkEnum` del paso no debe romper con ellas.

## Lo que queda a quien construya

- Lista exacta de sistemas y coordenadas de cada hueco; mapeo posición→hueco.
- Dónde guardar el sistema; nombres de columnas.
- Umbrales de densidad del Resultado (13 es el del boceto) y tamaños mínimos.
- Cómo mostrar en el editor la lista de disponibles (hoja inferior en móvil).
- Qué hacer con plantillas/componentes huérfanos (`CartelResultado`, `CartelCronoloxia` si se
  fusiona, `CartelOnce`, `FormProximos`…): borrar si no quedan usos.
- Texto de Instagram del nuevo Resultado (hoy cada plantilla tiene el suyo).

## Verificación

- `pnpm check` en cada commit; pruebas unitarias del mapeo posición→hueco, sustitución y
  densidad.
- `pnpm e2e` (solo lectura) y `pnpm e2e:escritura` para guardar alineación con sistema/huecos y
  generar carteles; móvil 360 px y escritorio 1280×720.
- Enseñar a Iván PNG reales generados por la app (Drive) antes de dar por bueno.
- Despliegue a la copia estable (3100) solo con su visto bueno; copia de la base antes de migrar.
