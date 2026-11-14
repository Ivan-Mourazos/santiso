# Libreta del partido en directo — diseño

Fecha: 14/11/2026 · Aprobado en conversación: enfoque B y boceto de pantalla.

## Para qué

Iván es delegado del Senior. Al acabar cada partido cierra el acta con el árbitro y necesita su
propia lista de lo que pasó para comprobarla: goles, amarillas, rojas y cambios, con minuto y
dorsal, de los dos equipos. Hoy no hay forma de apuntarlo en el momento: el acta del Studio se
rellena entera al final (capturas o a mano) y la de la federación llega días después.

## Objetivos

- Apuntar en directo, desde el móvil (≥360 px), con una mano y pocas pulsaciones.
- Minuto automático con un cronómetro por partes; siempre corregible.
- Nada se pierde: cada toque se guarda al momento; sin cobertura queda en el móvil y se envía
  al volver la señal.
- Al final, vista «Para cerrar el acta» lista para comparar con el árbitro.

## No objetivos

- No escribe en el acta ni en las estadísticas, nunca. Son apuntes personales del delegado; el
  acta que se guarda es la oficial (federación o editor de actas). Decisión de Iván, 14/11.
- No publica nada ni genera carteles.
- Sin service worker / modo sin conexión completo: la página debe abrirse con cobertura antes
  del partido; después aguanta sin red.

## Anti-objetivos

- Que un error con las prisas acabe en estadísticas o carteles sin revisión.
- Que se pierdan apuntes por cerrar la pestaña, bloquear el móvil o perder cobertura.
- Que el minuto sea incorrecto tras bloquear el móvil (el cronómetro se calcula con marcas de
  tiempo, no con un contador en memoria).

## Enfoques considerados

- **A. Escribir directo en el acta (`partido_eventos`).** Descartado: los errores entran en
  estadísticas y el rival solo se conoce por dorsal, que el acta no guarda bien.
- **B. Libreta aparte.** Elegido por Iván. Datos propios, sin efecto en el acta ni en
  estadísticas. Se descartó también un botón «Pasar al acta»: el acta guardada es la oficial.
- **C. Solo en el móvil (localStorage).** Descartado: se pierde al cambiar de móvil y no queda
  registro.

## Diseño

### Dónde vive

Dentro de Partidos (decisión previa: los pasos de nuestro partido van en Partidos). Botón
«Directo» en la ficha del partido. Para cualquier equipo del club; pensado para el Senior.
Ambos roles (admin y técnico) pueden usarla.

### Pantalla (móvil primero)

```
 SANTISO 1 – 0 RIVAL     2ª parte  63:12  [⏸]
 [ GOL ]  [ AMARILLA ]  [ ROJA ]  [ CAMBIO ]
   (nosotros / rival)
 ─────────────────────────────
 58'  🟨  #6  Pablo
 41'  ⚽  #9  Brais
 23'  🔁  #14 entra · #7 sale
```

- Cabecera: marcador calculado de los goles apuntados, parte, cronómetro, pausa.
- Cronómetro: «Empezar 1ª parte», «Descanso», «Empezar 2ª parte», «Final». Duración de la parte
  45' por defecto, editable antes de empezar. En el descuento se muestra «45+2».
- Botón de evento → elegir lado (nosotros/rival) → elegir jugador:
  - Nosotros: rejilla de dorsales + nombre. Convocados si hay convocatoria; si no, plantilla de
    la categoría en la temporada (`jugadoresTemporada.dorsal`).
  - Rival: teclado numérico de dorsal (opcional, se puede dejar sin dorsal).
  - Cambio: quién entra y quién sale (en los dos lados).
  - Gol: casilla «en propia».
- El minuto se rellena solo; tocar un evento de la lista permite editar minuto, jugador o
  borrarlo.
- Indicador discreto «pendiente de enviar (n)» cuando hay cola sin red.

### Vista «Para cerrar el acta»

Marcador final y lista por minuto: `minuto · equipo · dorsal · nombre · evento`. Separada por
partes. Legible en el móvil, al lado del árbitro.

### Datos

Tablas nuevas (migración Drizzle):

- `partido_directo` — uno por partido: duración de parte, estado del cronómetro (parte actual,
  marca de inicio de la parte, tiempo acumulado en pausa) y marcas de tiempo.
- `partido_directo_eventos` — `id` generado en el móvil (para reenvíos idempotentes),
  `partido_id`, `tipo` (`TIPOS_EVENTO`), `lado` (`LADOS_EVENTO`), `propia`, `parte`, `minuto`,
  `jugador_id`/`jugador_sale_id` (propios, opcionales), `dorsal`/`dorsal_sale` (cualquier lado,
  opcionales), `nota`, marcas de tiempo. Borrado de partido en cascada.

### Sin cobertura

Cada alta, cambio o borrado se aplica al momento en pantalla y va a una cola en
`localStorage` por partido. La cola se envía en orden; el servidor usa el `id` del móvil
(alta = insertar o actualizar, borrado = borrar si existe), así que reenviar es seguro. El
estado del cronómetro también se guarda en local y en servidor.

### Acceso

Con `STUDIO_ACCESO=1`, las acciones pasan por `obtenerDb()` con sesión, como el resto.

## Pruebas

- Unitarias: cálculo de minuto (partes, pausas, descuento), aplicación idempotente de la cola.
- `e2e-escritura`: apuntar eventos de los dos lados, editar, borrar, recargar sin perder nada,
  vista de cierre, pasar al acta. Móvil 360 px y escritorio 1280×720.
- `pnpm check` en verde.

## Lo que queda al constructor

Nombres de componentes y rutas, distribución exacta de la rejilla de dorsales y cómo se ve el
indicador de cola, siguiendo el sistema de diseño actual (look D, grafito).
