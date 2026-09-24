# Rediseño completo: flujo de la web y carteles nuevos

> Para agentes (Codex): lee entero este plan y `AGENTS.md` antes de tocar nada. Ejecuta por fases, en ramas separadas, con los pasos `- [ ]`. Cada fase termina con sus pruebas en verde y un commit fusionado en `main`. Si una decisión de diseño no está aquí, elige la opción más sobria, apúntala en la sección «Decisiones tomadas» de este documento y sigue.

## Para qué es esto

UD Santiso Studio es la herramienta local del club para la temporada. Sirve para meter partidos, horas y actas, llevar plantillas, ver clasificación y estadísticas y, sobre todo, **generar los carteles de Instagram** de cada semana. Funciona, pero:

1. **El flujo está repartido en 15 secciones de menú.** La tarea real de cada semana siempre es la misma (previa → partido → acta → resultado → clasificación), y hoy obliga a saltar entre pantallas. La pantalla «Jornada» (fase 9A) fue el primer paso para juntarlo. Hay que llevarlo hasta el final.
2. **Los carteles parecen plantillas estáticas.** Todo va dentro de cajas redondeadas de cristal, simétrico y centrado, con pastillas, bordes, un marco redondeado alrededor de todo y una barra de patrocinadores dentro de otra caja. Los escudos son pequeños (unos 100–280 px en un lienzo de 1080 px) y sobra espacio muerto. El usuario lo describe así: *«escudos grandes, modernos, y no que sean carteles estilo estáticos, con demasiada estructura»*.

Las capturas actuales de los 7 carteles están en `data/referencias/antes-fase-2/` (partido, próximos, resumo) y se regeneran con la prueba de huellas descrita en «Verificación de carteles».

## Reglas del proyecto (obligatorias)

- **pnpm siempre**, nunca `npm`/`yarn`. `pnpm check` (typecheck + lint + formato + tests) es la puerta de cada commit.
- **Next 16.3:** esta versión cambia APIs. Antes de escribir código de Next, lee la guía que toque en `node_modules/next/dist/docs/`.
- **Drizzle 0.45:** solo el query builder core, nunca `db.query`. Cambios de esquema: `packages/db/src/schema` + `pnpm db:generate --name <cambio>` + pruebas en `packages/db/src/schema.test.ts`.
- **Datos reales:** `data/` nunca entra en git. `pnpm e2e` corre contra `data/santiso.db` y **solo lee**. Lo que escribe va en `apps/studio/e2e-escritura/`, con la base de juguete de `sembrar.ts`, en el puerto 3111. Ninguna prueba escribe en `data/`.
- **Gemini:** nunca se llama desde pruebas. Siempre se simula `/api/admin/jornada-gemini`.
- **Secretos:** `apps/studio/.env.local` es secreto: no se imprime, no se cita y no se commitea.
- **ESLint con reglas del React Compiler:**
  - Nada de `setState` síncrono en efectos: usa `window.setTimeout(() => …, 0)` más un contador de generación.
  - No se leen refs durante el render: refleja el valor en estado.
  - Bajo StrictMode, la ref se vacía dentro del temporizador, no en el cuerpo del efecto.
- **Formato:** `apps/studio` está en `.prettierignore`. Pasa Prettier a mano **solo** sobre los ficheros que toques, y deshaz cualquier reformateo de ficheros ajenos.
- **Lógica pura:** va en `apps/studio/lib/**`, donde la recoge Vitest.
- **Fechas:** `partidos.fecha` es hora de pared `AAAA-MM-DDTHH:mm`, sin zona. Toda escritura pasa por `fechaHoraDePartido` de `@santiso/domain`. **Nunca** `toISOString()`, `getHours()` ni `Date` para mostrar o guardar una hora de partido.
- **Local-first:** nada de CDNs, fuentes de Google ni imágenes remotas en tiempo de ejecución. Hoy `app/globals.css` importa Outfit y Nunito de Google Fonts, y eso **se corrige en R1**. La utilidad `e2e/red.ts` (`vigilarSalidasAInternet`) comprueba que no salen peticiones.
- **Coordinación:** Claude ejecuta en paralelo `docs/superpowers/plans/2026-09-24-temporada-limpia.md` (retirar la temporada 2025/26). Empieza cada fase desde el `main` más reciente. No toques `packages/db/src/cli/limpiar-temporada.ts`.

## Mapa del código actual

| Qué | Dónde |
|---|---|
| Carcasa, menú y contexto de URL | `components/studio/*`, `lib/navigation/contexto.ts` (15 secciones en 5 grupos) |
| Componentes base | `components/ui/foundation/*` (Button, Fields, Dialog, DataTable, States, Tabs, Toast, PageHeader), CSS Modules con tokens `--ui-*` |
| Pantalla de la semana | `components/admin/jornada/*` + `lib/server/consultas/jornada.ts` |
| Acciones de servidor | `lib/server/acciones/*`, que devuelven `Resultado<T>` con `capturar`/`exito`/`fallo` |
| Generador de carteles | `components/admin/GeneradorCartel.tsx` + `components/admin/cartel/*` (formularios, `useCartelForm`, `useCartelAssets`) |
| Motor de dibujo | `lib/cartel-draw.ts`, `lib/cartel/{constants,primitives,shared,types}.ts`, `lib/cartel/templates/*.ts` (7 plantillas en Canvas 2D, 1080×1350, exportado a ×2) |
| Selección automática de próximos | `lib/jornada/proximos.ts` |

## Objetivos

1. **Un flujo guiado por la semana.** Abrir la app enseña qué toca hoy y lleva a hacerlo en el mínimo de pasos.
2. **Un sistema visual propio, moderno y coherente** en toda la web, que funcione a 360 px y en escritorio.
3. **Un motor de carteles nuevo,** con composición dinámica, escudos protagonistas y formatos 4:5 y 9:16.
4. **Sin regresiones funcionales:** todo lo que hoy se puede hacer se sigue pudiendo hacer, y las pruebas lo demuestran.

**No son objetivos:**
- Cambiar el modelo de datos, salvo lo imprescindible, y siempre con migración.
- Una web pública.
- Autenticación.
- Llamar a servicios externos.

---

## Fase R0 — Auditoría y dirección (1 sesión)

- [ ] Recorrer las 15 secciones a 360 y 1280 px con los datos reales. Anotar en este documento, por sección:
  - Qué tarea resuelve.
  - Cuántos clics lleva la tarea típica.
  - Qué sobra.
- [ ] Generar las 7 plantillas actuales con la prueba de huellas y guardar los PNG en `data/referencias/antes-rediseno/`, que no entra en git.
- [ ] Escribir la sección «Decisiones tomadas» con la paleta final, las fuentes y las rutas de navegación definitivas.

## Fase R1 — Sistema visual (base de todo)

**Paleta del club,** sacada del escudo:
- Verde de la bandera (≈ `#1f7a3a`), amarillo de las franjas (≈ `#f5c518`) y un negro profundo casi azul (≈ `#0b0f14`).
- Neutros fríos para la interfaz.
- Un color de acento por categoría: Senior amarillo, Veteranos turquesa (el actual `catAccent`).

**Tipografía, servida en local** con `next/font/local` y los ficheros en `apps/studio/app/fonts/`, con licencia OFL:
- Una display condensada y muy gruesa para titulares y carteles: por ejemplo Anton, Bebas Neue o Barlow Condensed 800–900.
- Una sans legible para la interfaz: Inter o la misma familia en peso normal.
- **Quitar el `@import` de Google Fonts** de `globals.css`.
- El Canvas de los carteles espera a `document.fonts.load(...)` antes de dibujar.

**Tareas:**
- [ ] Tokens: redefinir `--ui-*` (colores, espaciados, radios, sombras, tipografía) en un único fichero de tokens, con modo oscuro por defecto.
- [ ] Revisar los componentes `foundation` con los tokens nuevos:
  - Tamaños táctiles: 44 px en `pointer: coarse`.
  - Foco visible.
  - Estados de carga, vacío y error coherentes.
- [ ] Borrar el CSS global que quede sin usar. Hoy `globals.css` tiene más de 1100 líneas heredadas.
- [ ] **Pruebas:** e2e de solo lectura que recorran las secciones a 360 y 1280 px sin desbordes y sin peticiones a internet.

## Fase R2 — Flujo nuevo de la web

**Navegación nueva** (sustituye los 5 grupos y 15 entradas):

| Entrada | Contiene |
|---|---|
| **Semana** (inicio) | La pantalla Jornada ampliada: ver abajo |
| **Temporada** | Calendario (con la vista «Partidos del Santiso»), Clasificación y Estadísticas, como pestañas |
| **Club** | Plantilla, Cuerpo técnico y Directiva, como pestañas |
| **Estudio** | El generador de carteles (fase R3) |
| **Ajustes** | Temporadas, Equipos (biblioteca y escudos), Campos, Patrocinadores y Ajustes gráficos |

**Semana.** Una tarjeta por partido del club con su **estado del ciclo**:

`Sin hora` → `Previa lista` → `Jugado sin resultado` → `Resultado` → `Acta` → `Carteles publicados`

Cada tarjeta ofrece **solo el siguiente paso** como botón principal («Poner hora», «Hacer cartel de previa», «Meter resultado», «Importar acta», «Cartel de resultado») y el resto en un menú secundario. Arriba va el cartel semanal «Próximos encuentros» con un botón. Hoy ya existe el enlace `carteles?plantilla=proximos&rellenar=1`.

**Resultado y acta desde la tarjeta.** Marcador y goleadores en un diálogo, sin ir a otra pantalla. Reutiliza las acciones de `lib/server/acciones/actas.ts`. La importación por PDF o foto sigue disponible desde el mismo diálogo.

**Temporada en la cabecera:**
- Nombre fijo de la temporada activa en la cabecera de todas las pantallas.
- Un selector de historial **solo** donde tiene sentido consultar otra temporada: Temporada y Club.
- Las pantallas de trabajo (Semana, Estudio, importadores) siempre usan la activa y lo dicen.

**Puesta en marcha de temporada:** un asistente de 4 pasos en Ajustes → Temporadas, que reúne pantallas que ya existen:
1. Crear la temporada.
2. Importar el calendario PDF por competición.
3. Revisar equipos nuevos y escudos. Aviso de posibles duplicados: la lógica está en la rama `fusionar-equipos` (`lib/equipos/duplicados.ts`) y se puede traer.
4. Plantillas: «Añadir de la temporada anterior».

**Compatibilidad de URLs:** las URLs antiguas (`/admin/calendario`, `/admin/carteles?plantilla=…&partido=…`, `/admin/actas?…`, `/admin/importar-jornada?…`) **siguen funcionando**, con redirección a la ruta nueva conservando los parámetros. Las pruebas actuales dependen de ellas. Actualízalas solo cuando la pantalla cambie de verdad.

**Tareas:**
- [ ] Rutas y navegación nuevas + redirecciones, con pruebas de las redirecciones.
- [ ] Semana con estados del ciclo. El estado se calcula en `lib/jornada/ciclo.ts`, puro y con pruebas.
- [ ] Diálogo de resultado y acta rápida, con e2e de escritura sobre la base de juguete.
- [ ] Cabecera con temporada y selector de historial donde toca.
- [ ] Asistente de temporada, con e2e de escritura.
- [ ] Todas las e2e existentes en verde. Reescribe los selectores que cambien, sin debilitar lo que comprueban.

## Fase R3 — Estudio de carteles y motor nuevo

### Dirección visual (lo importante)

Hoy: cajas → dentro, escudos pequeños → alrededor, texto centrado → debajo, barra de logos en otra caja. **Rompe eso:**

- **Sin cajas ni marcos.**
  - Fuera el marco redondeado exterior, las tarjetas de cristal, las pastillas y los bordes.
  - La jerarquía la dan el tamaño, el color y la posición.
- **Escudos protagonistas.**
  - Cartel de partido: cada escudo mide **al menos el 40–50 % del ancho**. Pueden salirse del borde (sangrado) o solaparse con la diagonal central.
  - Luz de contorno y sombra proyectada suave, para que parezcan objetos y no pegatinas.
- **Composición en diagonal o asimétrica.**
  - El lienzo se divide con un corte diagonal o curvo entre los dos equipos. Cada mitad lleva el **color dominante de su escudo**.
  - El «VS» es tipográfico y enorme sobre el corte, no una pastilla.
- **Tipografía como imagen.**
  - Titulares en la display condensada a 140–260 px, que pueden recortarse con el borde o ir detrás de los escudos.
  - Fecha y hora grandes y legibles en el móvil: el dato que busca la gente.
- **Textura y movimiento.**
  - Grano sutil, líneas de velocidad o franjas de la bandera del club en diagonal.
  - Degradados de luz.
  - La marca de agua del escudo, en todo caso, fuera de centro y con escala grande.
- **Patrocinadores discretos:** una franja inferior sin caja, logos en blanco/monocromo cuando el logo lo permita (opción por patrocinador) y tamaño homogéneo por altura óptica.
- **Variedad controlada:** 2–3 **composiciones** por plantilla (por ejemplo «diagonal», «enfrentados», «escudo gigante») que se eligen en el Estudio. El mismo partido no siempre sale igual.
- **Legibilidad primero:** contraste AA en todo texto sobre imagen o degradado, y nada importante a menos de 60 px del borde. Instagram recorta la vista previa 4:5 → 1:1 en la cuadrícula del perfil: el partido y la fecha tienen que leerse en el cuadrado central.

### Motor

El motor nuevo va en `lib/cartel2/`. El actual se mantiene hasta que el nuevo lo sustituya del todo.

- `escena.ts`: el cartel se describe como **capas** (fondo, color, textura, escudos, tipografía, patrocinadores) con coordenadas relativas. Esto permite los formatos **4:5 (1080×1350)** y **9:16 (1080×1920, historias)** con la misma plantilla.
- `color.ts`: el **color dominante y el secundario de un escudo**. Es una función pura sobre `ImageData`: cuantización, descartar transparentes, casi blancos y casi negros, y elegir por saturación y área. Tiene pruebas con imágenes generadas con `sharp`. Si no hay escudo o sale un gris, se usa el color de la categoría.
- `recorte.ts`: la caja visible de un escudo, sin márgenes transparentes, para que todos se vean del mismo tamaño aunque el PNG traiga aire.
- Fuentes: el motor espera a `document.fonts` y falla con un error claro si falta una fuente, en vez de dibujar con la de reserva.
- **Determinismo:** el mismo formulario más los mismos ficheros dan el mismo PNG, lo que permite probarlo por huella. Las texturas pseudoaleatorias usan una semilla derivada del id del partido.

### Plantillas nuevas

Las mismas 7, rehechas:

| Plantilla | Nombre en el Estudio |
|---|---|
| `partido` | «Previa» |
| `resumo` | «Resultado» |
| `cronoloxia` | Minuto a minuto |
| `proximos` | 1 o 2 partidos: sénior y veteranos, nunca más; si una categoría descansa, sale solo la otra, ocupando todo el cartel |
| `noso11` | Alineación sobre campo, en perspectiva, con dorsales grandes |
| `multiusos` | Anuncio |
| `clasificacion` | Tabla con el Santiso resaltado, y cuadro de copa |

Los textos del cartel siguen en gallego («XORNADA», «PRÓXIMOS ENCONTROS», «RESUMO»), como ahora.

### Estudio

- A la izquierda (arriba en el móvil), la vista previa grande. A la derecha, el formulario corto.
- Selector de composición y de formato (4:5 / 9:16).
- «Descargar PNG» y «Copiar texto para Instagram»; este último ya existe para la clasificación y se extiende a todas.
- Se abre siempre con los datos ya puestos desde Semana. Los parámetros actuales de URL se mantienen.

### Opcional, al final: carteles animados

Es la otra lectura de «no estáticos». Consiste en exportar la escena en **vídeo corto (5–6 s)** para historias o reels: entrada de escudos, «VS» y fecha, con `canvas.captureStream()` + `MediaRecorder` (WebM; MP4 si el navegador lo admite). Va solo si R3 queda cerrada y el usuario lo pide.

### Tareas R3

- [ ] `lib/cartel2/` (escena, color, recorte y fuentes), con pruebas unitarias.
- [ ] Plantilla `partido` nueva en 4:5 y 9:16, con 3 composiciones. **Enseñar al usuario los PNG y ajustar antes de seguir** con el resto.
- [ ] Resto de plantillas.
- [ ] Estudio nuevo, que sustituye a `GeneradorCartel`.
- [ ] Retirar el motor antiguo (`lib/cartel-draw.ts`, `lib/cartel/**`) cuando no quede ningún uso.

## Verificación de carteles

Crea `apps/studio/e2e/huellas-carteles.spec.ts`: una prueba **de solo lectura** que se salta sin la variable `SANTISO_REFERENCIA_DIR`.
- Abre cada plantilla con un **formulario fijo** (no con datos reales).
- Espera a dos lecturas iguales del lienzo.
- Guarda el PNG y el SHA-256 de cada una en esa carpeta.

Así:
- Un cambio que **no** debe tocar el dibujo deja las huellas idénticas.
- Un cambio que sí lo toca se revisa mirando los PNG.

Antes de cada fusión que toque el motor, adjunta en el mensaje del commit qué huellas cambian y por qué.

## Pruebas por fase

- `pnpm check` en cada commit. `pnpm build` al cerrar cada fase.
- `pnpm e2e` (solo lectura, base real) y `pnpm e2e:escritura` (base de juguete). Las dos en verde al cerrar cada fase.
- **Con `pnpm dev` abierto** las e2e no arrancan su servidor. Hay dos opciones:
  - Pararlo.
  - Usar un `git worktree` aparte con `pnpm install --offline` para `e2e:escritura`, y una configuración temporal con `reuseExistingServer: true` para `e2e`. **Esa configuración no se commitea.**
- Capturas a 360 y 1280 px de cada pantalla nueva, adjuntas en la conversación con el usuario.

## Orden y esfuerzo estimado

| Fase | Contenido | Esfuerzo |
|---|---|---|
| R0 | Auditoría y decisiones | 2–3 h |
| R1 | Sistema visual, fuentes locales y limpieza de CSS | 1–1,5 días |
| R2 | Flujo nuevo: navegación, Semana con ciclo, acta rápida, cabecera, asistente | 3–4 días |
| R3 | Motor y 7 plantillas, en 2 formatos, y el Estudio | 4–6 días |
| R3+ | Carteles animados (opcional) | 1–2 días |

**Orden recomendado:** R0 → R1 → **R3 (plantilla `partido`, enseñar y ajustar)** → R2 → resto de R3.

Los carteles son lo que el club publica cada semana, y el usuario quiere verlos pronto. R2 puede ir en paralelo a partir de R1.

## Decisiones tomadas

_(Codex: rellena esta sección conforme decidas: paleta final, fuentes y licencias, composiciones elegidas, rutas.)_
