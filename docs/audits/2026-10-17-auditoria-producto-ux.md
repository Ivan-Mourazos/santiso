# Auditoría de Producto, Diseño y UX — UD Santiso Studio

**Fecha:** 17 de octubre de 2026  
**Ámbito:** `apps/studio` (Next.js App Router), `@santiso/db` (`packages/db`) y `@santiso/domain` (`packages/domain`)  
**Usuarios objetivo:**
- **Delegado / 2.º entrenador (`rol: "admin"`):** uso diario intensivo desde móvil por Tailscale (a pie de campo, vestuario, autobús) y desde escritorio (`>= 1280×720`) para tareas de cierre o revisión.
- **Míster / 1.er entrenador (`rol: "tecnico"`, Android):** uso móvil (`>= 360 px`) centrado en preparar jornada, convocatoria, once inicial, estadísticas de plantilla y vestuario (multas).
- **Audiencia externa (Instagram):** afición y jugadores que consumen los carteles en formato `4:5` (`1080×1350`) e historias `9:16` (`1080×1920`) íntegramente en gallego, con la identidad visual amarillo (`#f5c518`) y negro (`#0b0b0c`) de la UD Santiso.

---

## Metodología, declaración de evidencia visual y estado respecto a la auditoría anterior

### Declaración sobre navegación e inspección visual
Para proteger la integridad de `data/santiso.db` (base de datos real de la temporada activa) y respetar la restricción de cero escrituras y cero tráfico hacia `futgal.es`, **no se ejecutaron acciones interactivas contra un servidor en vivo**. El análisis combina tres fuentes verificables:
1. **Evidencia visual por capturas reales (`data/referencias/antes-fase-2/`):** inspección directa de las capturas de referencia en escritorio (`1280×720`) y móvil (`360×780`) de las secciones del panel (`calendario`, `clasificacion`, `jugadores`, `staff`, `directiva`, `equipos`, `sponsors`, `temporadas`, `actas`) y carteles (`partido`, `proximos`, `resumo`).
2. **Inspección exhaustiva del código actual:** revisión línea a línea de las 20 secciones registradas en `apps/studio/lib/navigation/contexto.ts`, todos los componentes en `apps/studio/components/admin/**`, `components/studio/**`, `components/ui/**`, hojas de estilo (`styles/tokens.module.css`, `app/globals.css` y los 21 módulos `*.module.css`), y el esquema real en `packages/db/src/schema/*`.
3. **Contratos E2E de presupuesto móvil:** revisión de las pruebas de diseño móvil (`apps/studio/e2e/movil-*.spec.ts`) que validan anchuras de `360 px`, objetivos táctiles de `44×44 px` y ausencia de desbordamiento horizontal.

### Qué ya se resolvió desde `docs/audits/2026-09-13-ux-ui.md` (no se repite como deuda pendiente)
La aplicación ha dado un salto enorme desde la auditoría del 13/09/2026 y los planes de octubre (`2026-10-11-*`):
- **Navegación por URL y persistencia de contexto (`Resuelto`):** `StudioShell.tsx` y `StudioContext.tsx` sincronizan `?categoria=`, `?partido=`, `?jornada=` y `?menu=`, separando además `Directiva` del selector deportivo (`Senior`/`Veteranos`).
- **Primitivas de interfaz y accesibilidad base (`Resuelto`):** se crearon `Button`, `Field`, `Select`, `Textarea`, `Dialog` (sobre `<dialog>` nativo con foco atrapado y cierre con `Escape`), `Toast` (`role="status"` / `role="alert"` con `aria-live="polite"`), `FiltrosMovil` (hoja inferior en móvil) y estados `LoadingState`/`EmptyState`/`ErrorState`.
- **Guardado atómico en servidor (`Resuelto`):** las acciones en `lib/server/acciones/*` emplean transacciones de Drizzle sobre SQLite y devuelven `Resultado<T>` tipado.
- **Nuevas pantallas operativas de día de partido (`Resuelto`):** se incorporaron `Inicio` (`AdminInicio.tsx`), `Jornada` (`AdminJornada.tsx`), `Convocatoria` (`AdminConvocatoria.tsx`), `Alineación` (`AdminAlineacion.tsx`), `Multas` (`AdminMultas.tsx`), `Estadísticas` (`AdminEstadisticas.tsx`), `Goleadores y tarjetas` (`AdminLiga.tsx`), `Importar` unificado (`Importar.tsx`) y control de acceso por roles (`AdminUsuarios.tsx`, `MiCuenta.tsx`).

Lo que sigue a continuación se centra **exclusivamente en los problemas vigentes en el código actual (17/10/2026)** y en las oportunidades de producto para el club.

---

## 1. Diseño visual y coherencia (tokens, tipografía, espaciado, componentes repetidos)

### 1.1. Convivencia de dos sistemas de estilos y 1.747 líneas de CSS global heredado
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/app/globals.css` (líneas 1–1747), `apps/studio/styles/tokens.module.css` (líneas 1–88) y `apps/studio/components/ui/AdminUI.tsx` (líneas 1–187).
- **Diagnóstico:**
  - `globals.css` conserva reglas heredadas de fases anteriores que ya no pertenecen al sistema `tokens.module.css`: cartas estilo FIFA Ultimate Team (`.fifa-card`, líneas 880–1250), acordeones antiguos (`.ud-accordion-*`), contenedores `.page-shell` y botones `.btn-primary`.
  - Más grave aún: `globals.css` declara selectores globales de etiqueta sin ámbito (`input, textarea, select` en líneas 376–425 y `button` en líneas 290–345) con fondos, bordes y `transition` propios que compiten con `:where(.theme)` de `tokens.module.css` y obligan a los módulos CSS (como `Calendario.module.css:176`, `Multas.module.css:324` o `Jornada.module.css:187`) a reescribir bordes, alturas y colores a mano.
  - Además, `apps/studio/components/ui/AdminUI.tsx` sigue en el repositorio con estilos inline (`#facc15`, `rgba(...)`) pero tiene **cero importaciones** en toda la app.
- **Qué cambiar:**
  1. Eliminar `apps/studio/components/ui/AdminUI.tsx`.
  2. Purgar de `apps/studio/app/globals.css` todas las clases muertas (`.fifa-card*`, `.ud-*`, `.btn-*`) y los selectores desnudos de `input, select, textarea, button`, dejando en `globals.css` solo el reset básico (`box-sizing`, `body`, variables de fuentes) y delegando el aspecto de controles en `Fields.module.css` y `Button.module.css`.
- **Valor para el club:** elimina efectos colaterales visuales al crear o tocar pantallas, reduce el CSS enviado por Tailscale en conexiones móviles lentas y garantiza que todos los controles tengan el mismo relieve y foco.
- **Esfuerzo:** `M`

### 1.2. Divergencia en el amarillo corporativo y en tokens de superficie
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/styles/tokens.module.css` (línea 9: `--ui-accent: #f5c518`), `apps/studio/app/globals.css` (línea 20: `--primary: #facc15`), `apps/studio/components/admin/inicio/Inicio.module.css` (línea 62: `var(--ui-accent, #facc15)`), `apps/studio/components/admin/estadisticas/Estadisticas.module.css` (líneas 44, 90, 93, 107, 452: `var(--ui-accent, #facc15)`), `apps/studio/components/admin/calendario/Calendario.module.css` (líneas 20, 28, 477).
- **Diagnóstico:** coexisten dos tonos de amarillo en el código (`#f5c518` oro Santiso frente a `#facc15` amarillo Tailwind) y tres formas distintas de declarar el borde de un panel (`1px solid rgb(255 255 255 / 8%)` en `Estadisticas.module.css:6`, `1px solid var(--ui-border)` en `StudioShell.module.css:112`, y `1px solid rgb(255 255 255 / 6%)` en `Calendario.module.css:116`). Asimismo, la tipografía de títulos usa `--ui-font-title` en los módulos nuevos pero `--font-display` en `globals.css`.
- **Qué cambiar:** unificar en `apps/studio/styles/tokens.module.css` los tokens `--ui-accent: #f5c518`, `--ui-panel-border: rgb(255 255 255 / 8%)` y `--ui-row-border: rgb(255 255 255 / 6%)`, y reemplazar los valores hardcoded en los módulos CSS de `admin/*`.
- **Valor para el club:** coherencia cromática total con el escudo de la UD Santiso en todas las pantallas y previsualizaciones.
- **Esfuerzo:** `S`

### 1.3. Controles nativos sueltos que se saltan `Button`, `Field` y `Select`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:**
  - `apps/studio/components/admin/jornada/AdminJornada.tsx` (líneas 101–111: botones de categoría `.equipos button`; líneas 130–145: `<select>` crudo de competición sin `Select`).
  - `apps/studio/components/admin/multas/AdminMultas.tsx` (líneas 387–399: `<select className={styles.filtroPersona}>` crudo; líneas 585–624: `<input>` crudos en `FilaConcepto`).
  - `apps/studio/components/admin/GeneradorCartel.tsx` (líneas 290–298: `<textarea>` cruda para el texto del cartel de convocatoria).
  - `apps/studio/components/studio/StudioShell.tsx` (línea 182: `<button type="button" onClick={...}>Salir</button>` crudo).
- **Diagnóstico:** aunque existe `components/ui/foundation/Fields.tsx` y `Button.tsx`, estas pantallas reimplementan controles nativos con estilos ad-hoc. El resultado es que el `<select>` de `AdminMultas.tsx:387` o los `<input>` de `FilaConcepto` no tienen el gradiente `--ui-control-face`, ni la sombra interior `--ui-control-shadow`, ni el indicador de foco estándar de `Fields.module.css`.
- **Qué cambiar:** sustituir los `<select>`, `<input>` y `<textarea>` crudos en `AdminJornada.tsx`, `AdminMultas.tsx` y `GeneradorCartel.tsx` por las primitivas `Select`, `Field` y `Textarea` (añadiendo una variante `size="sm"` o `inline` en `Fields.tsx` para barras compactas).
- **Valor para el club:** aspecto táctil consistente en móvil y escritorio sin tener que mantener reglas `@media (pointer: coarse)` duplicadas en cada módulo CSS.
- **Esfuerzo:** `S`

### 1.4. Cabeceras duplicadas y salto semántico de `<h1>` a `<h3>`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/studio/StudioShell.tsx` (línea 206: `<h1 className={styles.title}>{section.label}</h1>`) frente a `AdminClasificacion.tsx:297` (`<h3>Clasificación</h3>`), `AdminMultas.tsx:85` (`<h3>Multas · ...</h3>`), `AdminEstadisticas.tsx:188` (`<h3>Estadísticas · ...</h3>`), `AdminPlayers.tsx:372` (`<h3>Jugadores</h3>`), `AjustesGraficos.tsx:111` (`<h3>Ajustes gráficos</h3>`), `AdminTemporadas.tsx:104` (`<h2>Temporadas</h2>`).
- **Diagnóstico:** en escritorio (`>= 901 px`), `StudioShell` ya pinta el `<h1>` con el nombre de la sección arriba del todo y, justo debajo, el panel vuelve a pintar un `<h3>` con el mismo nombre («Clasificación» debajo de «Clasificación», «Jugadores» debajo de «Jugadores»). En móvil (`<= 640 px`), cada módulo CSS tuvo que añadir un parche `.cabecera { position: absolute; width: 1px; height: 1px; clip-path: inset(50%); }` para ocultar ese `<h3>` repetido (`Multas.module.css:151`, `Estadisticas.module.css:142`, `Clasificacion.module.css`). Además, se salta el nivel `<h2>` en la mayoría de pantallas.
- **Qué cambiar:** dejar que el título principal de la pantalla viva únicamente en el `<header>` de `StudioShell.tsx` (tanto en escritorio como en móvil, permitiendo un subtítulo contextual opcional en `StudioShell`), y usar `<h2>` para las subsecciones reales dentro de cada pantalla.
- **Valor para el club:** limpia espacio vertical en escritorio (`1280×720` gana ~50 px útiles de alto en tablas y carteles) y elimina decenas de líneas de CSS `sr-only` repetidas.
- **Esfuerzo:** `S`

---

## 2. Navegación y arquitectura de información

### 2.1. Ausencia de botón «Menú / Más» en la barra inferior móvil y bloqueo de «Cerrar sesión» en móvil
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/studio/StudioShell.tsx` (líneas 25–64 y 179–186) y `apps/studio/components/studio/StudioShell.module.css` (líneas 191–227).
- **Diagnóstico:**
  - En móvil (`<= 900 px`), `.sidebar` tiene `display: none` (`StudioShell.module.css:192`) y la barra fija inferior `.tabs` muestra únicamente 4 botones para el administrador (`Inicio`, `Jornada`, `Carteles`, `Multas`) o 5 para el cuerpo técnico (`Inicio`, `Jornada`, `Convocar`, `Once`, `Multas`).
  - Para ir desde `Jornada` a `Clasificación`, `Estadísticas`, `Jugadores` o `Importar`, el usuario está obligado a pulsar `Inicio` (perdiendo de vista su pantalla actual) y navegar por la cuadrícula de dos niveles (`?menu=competicion`, `?menu=plantilla`, etc.).
  - **Problema crítico de sesión en móvil:** el bloque `.cuenta` con el nombre del usuario conectado y el botón `Salir` (`StudioShell.tsx:179–186`) está dentro de `<aside className={styles.sidebar}>`, que desaparece en móvil. Además, en `AdminInicio.tsx:108–114`, la categoría `Ajustes` solo es visible en el primer nivel para el administrador (`soloAdmin: true` en `AdminInicio.tsx:119`). Por tanto:
    1. **Un usuario con `rol: "tecnico"` en móvil NO tiene ningún camino en la interfaz para entrar a «Mi cuenta» (cambiar su contraseña) ni para pulsar «Salir» (cerrar sesión)**, salvo escribir a mano `/admin/mi-cuenta` en la barra de direcciones del navegador.
    2. Incluso el administrador en móvil tiene que hacer 3 toques (`Inicio` → `Ajustes` → `Mi cuenta` → `Salir`) para cerrar sesión.
- **Qué cambiar:**
  1. En `StudioShell.tsx`, añadir en la cabecera móvil `.header` (o como último ítem de `.tabs`) un botón `Menú` / `Cuenta` que abra una hoja inferior (`Dialog` con `mobilePresentation="sheet"`) con acceso directo a todas las secciones agrupadas, al usuario activo, a `Mi cuenta` y al botón `Salir`.
  2. En `AdminInicio.tsx:115–125`, no ocultar por completo el acceso a `Mi cuenta` cuando `rol === "tecnico"`: mostrar un acceso directo a `Mi cuenta` / `Salir` visible para cualquier usuario autenticado cuando `usuario !== null`.
- **Valor para el club:** desbloquea el cambio de contraseña y cierre de sesión del míster en su móvil Android y permite saltar entre `Jornada`, `Clasificación` y `Estadísticas` con un gesto desde cualquier pantalla.
- **Esfuerzo:** `S`

### 2.2. Selector de categoría (`Senior` / `Veteranos`) duplicado y cambiante según la sección
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/studio/StudioShell.tsx` (líneas 123–133 y 212–233), `apps/studio/components/admin/jornada/AdminJornada.tsx` (líneas 101–111), `apps/studio/components/admin/importar/ImportarFoto.tsx` (línea 382) e `ImportarCalendarioPdf.tsx` (línea 152).
- **Diagnóstico:**
  - `StudioShell.tsx:123` oculta el selector global de categoría cuando `sectionId === "jornada"`, `inicio`, `calendario` o `importar`.
  - Como consecuencia, `AdminJornada.tsx:101` renderiza su propia botonera `.equipos` dentro del cuerpo de la página; `AdminCalendario.tsx:266`, `ImportarFoto.tsx:382` e `ImportarCalendarioPdf.tsx:152` renderizan un `<Select label="Categoría">` distinto dentro del formulario (y en `ImportarFoto`/`ImportarCalendarioPdf` ni siquiera usan `categoria` del `StudioContext`, sino un `useState("Senior")` local que ignora si el usuario venía trabajando en `Veteranos`).
- **Qué cambiar:**
  1. En `ImportarFoto.tsx` e `ImportarCalendarioPdf.tsx`, inicializar y sincronizar la categoría con `useStudioContext().categoria` para que si el delegado está en `Veteranos`, al abrir `Importar` no aparezca por defecto `Senior`.
  2. Mostrar el selector de categoría en la cabecera pegajosa de `StudioShell.tsx` también en `Jornada` (o unificar el componente de píldoras `Senior | Veteranos` en `StudioShell` para todas las pantallas deportivas).
- **Valor para el club:** evita el error humano más frecuente en un club con dos equipos (importar un acta o tocar una jornada de Veteranos creyendo estar en Senior o viceversa).
- **Esfuerzo:** `S`

### 2.3. Cuadrícula de `Inicio` en móvil aplasta botones cuando una carpeta tiene 6 o 7 opciones
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/inicio/AdminInicio.tsx` (líneas 58–71 y 107–114) y `apps/studio/components/admin/inicio/Inicio.module.css` (líneas 81–128).
- **Diagnóstico:** en móvil (`@media (max-width: 900px)`), `.panel` fija `height: calc(100dvh - var(--studio-cabecera, 57px) - 56px - ...)` (`Inicio.module.css:85`) sin scroll interno (`overflow: hidden` en `.boton`, línea 105). La regla de 1 columna solo aplica a `data-cuantos="2" | "3" | "4"` (`Inicio.module.css:95–99`). Cuando el usuario abre `Carteles` (`data-cuantos="7"`, 4 filas en 2 columnas) o `Ajustes` (`data-cuantos="6"`), en un móvil de altura contenida (`360×640` o con barra de navegación de Chrome Android abierta) las 4 filas + botón `← Inicio` se comprimen verticalmente y el subtítulo `.boton span` (`display: -webkit-box; -webkit-line-clamp: 2`) queda cortado o apretado.
- **Qué cambiar:** cambiar `height` por `min-height` en `Inicio.module.css:85` permitiendo scroll vertical natural cuando `data-cuantos` sea `>= 5`, y hacer que el último botón impar en `data-cuantos="7"` ocupe las dos columnas (`grid-column: 1 / -1`) para mantener la simetría visual.
- **Valor para el club:** lectura cómoda y sin recortes en móviles Android de pantalla compacta al elegir plantilla de cartel o entrar en ajustes.
- **Esfuerzo:** `S`

### 2.4. Permisos de navegación entre `contexto.ts`, `AdminInicio.tsx` y `StudioSection.tsx`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/lib/navigation/contexto.ts` (líneas 7–29), `apps/studio/components/admin/inicio/AdminInicio.tsx` (líneas 107–125) y `apps/studio/components/studio/StudioSection.tsx` (líneas 45–53).
- **Diagnóstico:** en `contexto.ts`, las secciones `equipos` y `sponsors` **no** tienen `admin: true`, pero en `AdminInicio.tsx:107–120` están metidas dentro de la carpeta `Ajustes` que tiene `soloAdmin: true`. Resultado: un usuario `tecnico` en escritorio ve `Equipos` y `Patrocinadores y logos` en la barra lateral izquierda (`StudioShell.tsx:66` filtra por `!s.admin`), pero en móvil no aparecen en `Inicio` porque toda la carpeta `Ajustes` está oculta para `tecnico`.
- **Qué cambiar:** alinear el criterio en `contexto.ts` y `StudioSection.tsx`: si `Equipos` y `Patrocinadores y logos` son catálogo de administración (como describe `AdminUsuarios.tsx:118`), marcarlos con `admin: true` en `contexto.ts`; y en `AdminInicio.tsx` separar `Mi cuenta` de `Ajustes` para que `tecnico` siempre vea su cuenta.
- **Valor para el club:** coherencia entre lo que el míster ve en ordenador y en móvil, evitando que toque por accidente el catálogo de patrocinadores o escudos 3D.
- **Esfuerzo:** `S`

---

## 3. Móvil vs escritorio: responsive, objetivos táctiles, tablas en 360 px, teclados y formularios largos

### 3.1. Desajuste de posición en la barra inferior fija de `Alineación` frente a `Convocatoria`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/alineacion/Alineacion.module.css` (líneas 208–216) frente a `apps/studio/components/admin/convocatoria/Convocatoria.module.css` (líneas 153–161) y `apps/studio/components/studio/StudioShell.module.css` (línea 202).
- **Diagnóstico:** la barra de pestañas móvil de `StudioShell` mide exactamente `56px + env(safe-area-inset-bottom, 0px)`. `Convocatoria.module.css:159` coloca su barra de acciones en `bottom: calc(56px + env(safe-area-inset-bottom, 0px))`, encajando al píxel. En cambio, `Alineacion.module.css:213` dejó un valor antiguo (`bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px))` = `68px`), dejando una franja hueca de `12 px` entre la barra de navegación inferior y la barra de «Guardar / Hacer historia» a través de la cual se ven pasar los nombres de los jugadores al hacer scroll.
- **Qué cambiar:** actualizar `Alineacion.module.css:213` a `bottom: calc(56px + env(safe-area-inset-bottom, 0px))` y unificar `--studio-tabs-height: 56px` en `tokens.module.css`.
- **Valor para el club:** elimina el hueco visual en la pantalla de `Alineación` en móvil y aprovecha 12 px más de lista de jugadores.
- **Esfuerzo:** `S`

### 3.2. Pestaña «Normas» de `Multas` en 360 px: 6 controles por fila sin plegado móvil
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/multas/AdminMultas.tsx` (líneas 545–645, componente `FilaConcepto`) y `apps/studio/components/admin/multas/Multas.module.css` (líneas 310–373).
- **Diagnóstico:** mientras que las pestañas `Apuntar`, `Registro` y `Bote` están muy bien adaptadas a `360 px`, la pestaña `Normas` renderiza una lista de conceptos donde **cada fila** (`<li>`) contiene hasta 6 elementos interactivos abiertos a la vez: input de nombre (`normaNombre`), input de importe (`normaImporte`), casilla `por unidad`, input de prendas (`normaOpciones`), casilla `en uso` y botón `Guardar`. En un móvil de `360 px`, cada concepto ocupa entre 3 y 4 líneas de controles repetidos (~180 px de alto por norma), haciendo muy pesado recorrer o editar el reglamento de vestuario.
- **Qué cambiar:** mostrar cada norma en vista compacta de una sola línea (`Nombre · 5 € / ud. · En uso`) y abrir su edición al tocarla (en acordeón o en `Dialog` `mobilePresentation="sheet"`, igual que hace `AdminPlayers.tsx` o `FilaPartido.tsx` en `Calendario`).
- **Valor para el club:** lectura inmediata del cuadro de multas en el vestuario desde el móvil sin una pared interminable de inputs abiertos.
- **Esfuerzo:** `S`

### 3.3. Reglas táctiles atadas solo a `@media (pointer: coarse)` frente a `@media (max-width: 900px)`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/ui/foundation/Button.module.css` (línea 65), `apps/studio/components/ui/foundation/Fields.module.css` (línea 71) y `apps/studio/components/admin/multas/Multas.module.css` (línea 358).
- **Diagnóstico:** el layout móvil se activa por ancho (`@media (max-width: 900px)` o `640px`), pero el tamaño táctil de `44 px` y `font-size: 16px` en `Button` y `Fields` solo se activa con `@media (pointer: coarse)`. En ventanas estrechas de escritorio, tablets con teclado/stylus o pruebas responsive sin emulación táctil, los botones `size="sm"` caen a `32 px` y los inputs a `38 px` con `font-size: 14px`.
- **Qué cambiar:** usar `@media (max-width: 900px), (pointer: coarse)` en `Button.module.css:65` y `Fields.module.css:71` (tal como ya hace `Estadisticas.module.css:424`).
- **Valor para el club:** garantiza objetivos de `44 px` de forma uniforme en cualquier vista móvil o ventana partida.
- **Esfuerzo:** `S`

### 3.4. Atributos de teclado móvil (`inputMode`, `enterKeyHint`) incompletos en campos numéricos y de búsqueda
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:**
  - `apps/studio/components/admin/AdminPlayers.tsx` (línea 409: buscador sin `type="search"` ni `enterKeyHint="search"`; línea 568: dorsal con `type="number"` pero sin `inputMode="numeric"`).
  - `apps/studio/components/admin/calendario/FilaPartido.tsx` (inputs de goles local/visitante).
  - `apps/studio/components/admin/AdminActaImporter.tsx` (inputs de minutos y dorsales en eventos del acta).
- **Diagnóstico:** en `AdminMultas.tsx:266` sí se cuidó `inputMode="numeric"` para los minutos/unidades, pero en `AdminPlayers.tsx`, `FilaPartido.tsx` y `AdminActaImporter.tsx` varios campos numéricos usan `type="number"` sin `inputMode="numeric"` (en algunos teclados Android/iOS abre el teclado completo con símbolos en lugar del teclado telefónico grande de 10 dígitos) y los buscadores usan `type="text"` en vez de `type="search"` (que en móvil añade el botón nativo `×` para limpiar de un toque).
- **Qué cambiar:** añadir `inputMode="numeric" pattern="[0-9]*"` en todos los campos de goles, dorsales y minutos, y `type="search" enterKeyHint="search"` en los buscadores de `AdminPlayers.tsx`, `AdminStaff.tsx`, `AdminEquipos.tsx` y `AdminSponsors.tsx`.
- **Valor para el club:** meter resultados, dorsales o minutos desde el móvil en el campo se hace con el teclado numérico gigante a una mano.
- **Esfuerzo:** `S`

### 3.5. Diseño diferente de tarjetas de jugadores entre `Convocatoria` y `Alineación`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx` (líneas 221–241, `Convocatoria.module.css:30–71`) frente a `apps/studio/components/admin/alineacion/AdminAlineacion.tsx` (líneas 247–291, `Alineacion.module.css:66–170`).
- **Diagnóstico:** siendo dos pasos consecutivos del mismo flujo para el míster:
  - En `Convocatoria`, los jugadores se muestran en una cuadrícula de **2 columnas** (`grid-template-columns: repeat(2, minmax(0, 1fr))`), sin foto, sin posición y ordenados alfabéticamente o por dorsal según vengan, sin separar convocados de no convocados ni mostrar quién está sancionado/lesionado.
  - En `Alineación`, los jugadores se muestran en **1 columna** con foto, dorsal grande y pastilla de estado (`Titular` / `Suplente` / `Sin convocar`).
  - Además, en `Convocatoria` con `360 px` de ancho, 2 columnas dejan ~`160 px` por botón (`Convocatoria.module.css:32`), lo que obliga a partir nombres compuestos en 2 líneas (`overflow-wrap: anywhere`) y no deja sitio para ver la demarcación (`POR`, `DEF`, `MED`, `DEL`).
- **Qué cambiar:** añadir en `AdminConvocatoria.tsx` agrupación o insignia de demarcación (`POR`, `DEF`, `MED`, `DEL`) y botones rápidos «Marcar todos / Limpiar» para no tener que tocar 18 veces cada viernes cuando van casi los mismos.
- **Valor para el club:** el míster ve de un vistazo cuántos porteros, defensas, medios y delanteros lleva convocados sin contar de cabeza.
- **Esfuerzo:** `S`

---

## 4. Accesibilidad y legibilidad (contraste amarillo/negro, foco, labels, ARIA, tamaños)

### 4.1. Contraste insuficiente en textos secundarios y estados deshabilitados sobre fondo oscuro
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:**
  - `apps/studio/app/globals.css` (líneas 29–30: `--text-muted: #52525b` sobre `#09090b` → ratio **2.58:1**, falla WCAG AA 4.5:1; `--text-secondary: #8e8e93` → ratio **3.95:1**).
  - `apps/studio/components/admin/estadisticas/Estadisticas.module.css` (líneas 205 y 255: `font-size: 0.66rem` = `10.5px` en cabeceras de tabla móvil `.ordenar` y `0.7rem` = `11.2px` en `.dato span`).
  - `apps/studio/components/admin/calendario/Calendario.module.css` (línea 109: `font-size: 0.68rem` = `10.8px`; línea 473: `0.66rem`).
- **Diagnóstico:** mientras que `tokens.module.css` acertó subiendo `--ui-muted` a `#a8a8b2` (ratio **8.3:1** sobre `#0b0b0c`) y usando negro `#000` sobre el amarillo `#f5c518` (ratio **13.1:1**), varios módulos usan tamaños de fuente por debajo de `11 px` (`0.66rem`) en móvil para encajar cabeceras. A pleno sol en el campo de fútbol, un texto de `10.5 px` en gris es muy difícil de leer.
- **Qué cambiar:** establecer un suelo tipográfico de `0.75rem` (`12 px`) en móvil usando abreviaturas estándar de fútbol en las cabeceras de `AdminEstadisticas.tsx:254–262` (`PJ`, `TIT`, `GOL`, `TA`, `TR` en lugar de `Jugados`, `Goles`, `Amarillas`, `Rojas` a `10.5 px` en `360 px`) con `<abbr title="Partidos jugados">PJ</abbr>`.
- **Valor para el club:** legibilidad real en exteriores con brillo de pantalla bajo o luz solar directa los domingos de partido.
- **Esfuerzo:** `S`

### 4.2. Pestañas de `Multas` e `Importar` usan `aria-pressed` en lugar del patrón `role="tablist"` / `role="tab"`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/multas/AdminMultas.tsx` (líneas 105–123) y `apps/studio/components/admin/importar/Importar.tsx` (líneas 149–162).
- **Diagnóstico:** mientras que `AdminLiga.tsx:161–186` implementa de forma ejemplar `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls` y `role="tabpanel"`, tanto `AdminMultas.tsx` (`Apuntar | Registro | Bote | Normas`) como `Importar.tsx` (`Capturas o acta | Calendario completo`) usan una botonera con `aria-pressed` sin `role="tablist"` ni asociación semántica con el panel inferior.
- **Qué cambiar:** aplicar en `AdminMultas.tsx` e `Importar.tsx` el mismo patrón `role="tablist"` / `role="tab"` (`aria-selected`) que ya usa `AdminLiga.tsx`.
- **Valor para el club:** consistencia semántica y mejor soporte de navegación por teclado y lectores de pantalla.
- **Esfuerzo:** `S`

### 4.3. Enlaces de navegación activa en barra lateral y barra inferior móvil sin `aria-current="page"`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/studio/StudioShell.tsx` (líneas 157–175 para `.sidebar` y líneas 236–260 para `.tabs`).
- **Diagnóstico:** los enlaces `<Link>` de la barra lateral y de la barra inferior móvil marcan la sección activa visualmente con clases CSS (`styles.linkActive` y `styles.tabActive`), pero no incluyen `aria-current={active ? "page" : undefined}`.
- **Qué cambiar:** añadir `aria-current={active ? "page" : undefined}` en ambos `<Link>` dentro de `StudioShell.tsx`.
- **Valor para el club:** accesibilidad estándar en el componente marco de toda la aplicación con un cambio de dos líneas.
- **Esfuerzo:** `S`

---

## 5. Formularios, tablas, filtros, buscadores, estados vacíos/carga/error y confirmaciones

### 5.1. Uso de `window.confirm` nativo en `Convocatoria` y `Alineación` al cambiar de partido
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx` (línea 202) y `apps/studio/components/admin/alineacion/AdminAlineacion.tsx` (línea 215).
- **Diagnóstico:** toda la aplicación migró a `showConfirm` (`ConfirmDialog` basado en `Dialog.tsx` con estética oscura/amarilla del club), incluido el guardián de navegación `StudioContext.tsx:96`. Sin embargo, al cambiar el `<Select label="Partido">` en `AdminConvocatoria.tsx:202` y `AdminAlineacion.tsx:215`, se sigue llamando a `window.confirm("Hay cambios sin guardar. ¿Descartarlos?")`, abriendo la alerta nativa del navegador que bloquea el hilo y rompe la interfaz.
- **Qué cambiar:** recibir `showConfirm` (o leerlo de `useStudioContext().showConfirm`) en `AdminConvocatoria.tsx` y `AdminAlineacion.tsx` y reemplazar `window.confirm(...)` por `showConfirm("Hay cambios sin guardar. ¿Descartarlos?", () => elegirPartido(nuevoId))`.
- **Valor para el club:** experiencia coherente en móvil sin diálogos nativos bruscos del navegador.
- **Esfuerzo:** `S`

### 5.2. Pérdida silenciosa de cambios sin guardar en `Multas` (pestaña `Normas`) y en `Importar`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/multas/AdminMultas.tsx` (líneas 545–645) y `apps/studio/components/admin/importar/ImportarFoto.tsx` / `AdminActaImporter.tsx`.
- **Diagnóstico:**
  - En `AdminMultas.tsx`, `useUnsavedChanges` no se invoca en ningún punto: si el administrador edita importes o prendas en `Normas` o tiene a medias un alta de multa en `Apuntar` y toca otra pestaña de la barra inferior móvil, los cambios se pierden sin aviso.
  - En `ImportarFoto.tsx` y `AdminActaImporter.tsx`, tras haber esperado a que Gemini analice una captura y haber corregido filas a mano (`filas.length > 0`), no se activa `useUnsavedChanges(filas.length > 0)`: un toque accidental en la barra inferior descarta toda la lectura de Gemini sin pedir confirmación.
- **Qué cambiar:** conectar `useUnsavedChanges` en `AdminMultas.tsx` (cuando hay cambios pendientes en `Normas` o en el formulario de `Apuntar`), en `ImportarFoto.tsx` (`filas.length > 0`) y en `AdminActaImporter.tsx` (cuando hay acta leída y modificada sin guardar).
- **Valor para el club:** evita perder una lectura de acta o de jornada ya revisada por tocar sin querer un botón del menú inferior en el móvil.
- **Esfuerzo:** `S`

### 5.3. `DataTable.tsx` en `foundation` no se usa en ninguna pantalla
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/ui/foundation/DataTable.tsx` (líneas 1–41) frente a `AdminEstadisticas.tsx`, `AdminClasificacion.tsx`, `AdminPlayers.tsx`, `AdminStaff.tsx`, `AdminEquipos.tsx`, `AdminSponsors.tsx`, `AdminMultas.tsx` y `AdminLiga.tsx`.
- **Diagnóstico:** `DataTable.tsx` se creó en la Fase 3A pero tiene **cero usos** en `components/admin/*`. Cada pantalla construye su propio `<table>` con cabeceras, estados vacíos y reglas `@media (max-width: 640px)` distintas (por ejemplo, `Estadisticas.module.css` usa `position: sticky; top: var(--studio-cabecera, 0px)` en `thead`, mientras que `Clasificacion.module.css` y `Multas.module.css` no fijan la cabecera al hacer scroll largo).
- **Qué cambiar:** o bien retirar `DataTable.tsx` si se prefiere CSS Grid por pantalla, o bien dotar a `DataTable.tsx` de soporte para cabecera sticky (`top: var(--studio-cabecera, 0px)`), `font-variant-numeric: tabular-nums` y columnas con `data-prioridad="false"` ocultables en móvil, reutilizándolo en `Clasificación`, `Estadísticas` y `Bote de multas`.
- **Valor para el club:** al bajar por la clasificación o la tabla de deudores de multas en el móvil, la cabecera de columnas permanece visible arriba igual que en `Estadísticas`.
- **Esfuerzo:** `M`

---

## 6. Paneles, estadísticas y gráficos: qué hay y qué falta

### Qué existe hoy en el código (verificado)
- **`AdminEstadisticas.tsx` + `FichaJugador.tsx`:** resumen numérico de 4 tarjetas (`Jugadores`, `Partidos con acta`, `Goles`, `Tarjetas`), tabla ordenable (`Convocados`, `Titular`, `Jugados`, `Goles`, `Propia`, `Amarillas`, `Rojas`) y ficha modal por jugador con contraste frente a cifras oficiales de la RFGF (`rfgf_jugadores`) e historial de temporadas pasadas (`rfgf_historico`).
- **`AdminLiga.tsx` (`Goleadores y tarjetas`):** clasificación de goleadores de toda la liga y control de ciclos de tarjetas (`ciclo = 5` amarillas) con filtro `Solo UD Santiso` / `Todos los equipos`.
- **`AdminJornada.tsx` (`PanelRfgf.tsx`):** estado de sincronización con `futgal.es`, avisos de cambios de horario/campo (`rfgf_partidos`) y descuadres de clasificación (`rfgf_competiciones.clasificacion`).

### Qué falta y aporta valor directo al cuerpo técnico

#### 6.1. Falta de indicadores visuales de racha, balance local/visitante y goles por tramo de partido
- **Tipo:** `EVIDENCIA` (ausencia verificada en `AdminEstadisticas.tsx`, `AdminClasificacion.tsx` y `lib/server/acciones/estadisticas.ts`)
- **Pantalla y fichero:** `apps/studio/components/admin/estadisticas/AdminEstadisticas.tsx` y `apps/studio/lib/server/acciones/estadisticas.ts`.
- **Diagnóstico:** la base de datos ya guarda en `partido_eventos` el `minuto` exacto (`0..130`), el `tipo` (`gol`, `amarilla`, `roja`, `cambio`) y el `lado` (`propio`, `rival`), y en `partidos` si el Santiso es local o visitante. Sin embargo, `AdminEstadisticas.tsx` solo muestra sumatorios planos de jugadores; no hay ninguna vista de **rendimiento colectivo del equipo** ni una sola barra visual en toda la app.
- **Qué cambiar:** añadir en `AdminEstadisticas.tsx` un conmutador superior `Plantilla | Equipo` (o un bloque plegable de equipo) que calcule con los datos ya existentes en `partidos` y `partido_eventos`:
  1. **Racha de los últimos 5 partidos** con pastillas de color (`V` verde, `E` gris, `D` rojo).
  2. **Balance en casa vs. fuera** (puntos, goles a favor y en contra en A Baiuca / local frente a visitante).
  3. **Distribución de goles a favor y en contra por tramos de 15 minutos** (`1-15'`, `16-30'`, `31-45+'`, `46-60'`, `61-75'`, `76-90+'`) mediante barras horizontales en CSS puro (sin librerías externas de gráficos).
- **Valor para el club:** el míster puede ver con datos reales si el equipo encaja más goles en los últimos 15 minutos o al salir del descanso, sin añadir ni una sola tabla nueva a la base de datos.
- **Esfuerzo:** `M`

#### 6.2. Alerta de apercibidos de sanción oculta dentro de `Goleadores y tarjetas`
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/liga/AdminLiga.tsx` (líneas 270–310), `apps/studio/components/admin/jornada/AdminJornada.tsx` y `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx`.
- **Diagnóstico:** el cálculo de quién está **Sancionado** (5.ª amarilla o roja en la última jornada) o **Apercibido** (4 amarillas en el ciclo de 5) ya existe en `lib/server/acciones/liga.ts` y se pinta en `AdminLiga.tsx`. Pero esa información **no se cruza** con `Jornada`, `Convocatoria` ni `Alineación`. El míster puede convocar o poner de titular en `AdminConvocatoria` / `AdminAlineacion` a un jugador que cumplió ciclo de 5 amarillas la semana anterior sin que la pantalla le avise (riesgo real de alineación indebida).
- **Qué cambiar:** exponer desde `lib/server/acciones/liga.ts` el estado disciplinario de los jugadores propios para la jornada activa y mostrar una insignia de aviso (`Sancionado` en rojo / `4 amarillas (apercibido)` en ámbar) junto al nombre del jugador en `AdminConvocatoria.tsx`, `AdminAlineacion.tsx` y en la tarjeta de `AdminJornada.tsx`.
- **Valor para el club:** altísimo valor deportivo: previene sanciones por alineación indebida en competición oficial y ayuda a gestionar las 4 amarillas antes de partidos clave.
- **Esfuerzo:** `M`

---

## 7. Claridad de flujos clave (día de partido, multas, importar)

### 7.1. Flujo de día de partido (`Jornada` → `Convocatoria` → `Alineación` → `Cartel` → `Acta/Resultado`)
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:**
  - `apps/studio/components/admin/jornada/TarjetaPartido.tsx` (líneas 165–257)
  - `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx` (líneas 115–155)
  - `apps/studio/components/admin/alineacion/AdminAlineacion.tsx` (líneas 120–175)
  - `apps/studio/components/admin/GeneradorCartel.tsx`
- **Diagnóstico:**
  1. **`TarjetaPartido.tsx` es el mejor acierto de UX del proyecto:** concentra en una sola tarjeta los pasos antes del partido (`Anunciar partido`, `Convocatoria`, `Alineación`) y después del partido (`Traer acta de la federación`, `Subir acta a mano`, `Fotos del partido`, `Cartel del resultado`, `Clasificación`, `Goleadores`).
  2. **Fricción entre `Convocatoria` y `Alineación`:** cuando el míster guarda la convocatoria el viernes o sábado en `AdminConvocatoria.tsx` (tabla `partido_convocados`) y el domingo abre `AdminAlineacion.tsx` (tabla `partido_alineaciones`), si todavía no hay alineación guardada, `AdminAlineacion.tsx` muestra a **toda la plantilla en «Sin convocar»** en lugar de pre-cargar como `Suplente` (convocados) a los jugadores que ya habían sido citados en `partido_convocados`. El míster tiene que volver a buscar y marcar uno por uno a los 16/18 convocados.
  3. **Fricción al terminar `Convocatoria` o `Alineación`:** al guardar en `AdminConvocatoria.tsx` o `AdminAlineacion.tsx`, no hay un enlace directo de retorno `← Volver a la jornada` en la cabecera de la tarjeta del partido (salvo pulsar la pestaña inferior `Jornada`).
  4. **Generación de carteles de `Convocatoria` duplicada en dos sitios con resultados distintos:** en `AdminConvocatoria.tsx:167` el botón «Hacer imagen» genera un PNG mediante `/api/admin/convocatoria-png` (con hora de quedada, lugar y equipación), mientras que en `GeneradorCartel.tsx` (`?plantilla=convocatoria`) se pide pegar a mano una lista de texto libre en un `<textarea>` (`GeneradorCartel.tsx:290`) que **no lee** los convocados guardados en `partido_convocados`.
- **Qué cambiar:**
  1. En `lib/server/acciones/alineacion.ts` (o en `AdminAlineacion.tsx` mediante un botón «Traer de la convocatoria» o pre-carga automática cuando `partido_alineaciones` está vacío), inicializar como `suplente` a los jugadores presentes en `partido_convocados` para ese `partidoId`, de modo que el míster solo tenga que tocar a los 11 titulares.
  2. En `GeneradorCartel.tsx`, cuando `template === "convocatoria"`, ofrecer un selector de partido o botón «Rellenar desde la convocatoria del partido» que cargue automáticamente los nombres de `partido_convocados` en el `<textarea>`.
- **Valor para el club:** ahorra 16–18 toques cada domingo en el vestuario antes del partido y conecta la convocatoria guardada con el cartel de Instagram.
- **Esfuerzo:** `M`

### 7.2. Flujo de `Multas`: falta alta múltiple para cuando varios jugadores cometen la misma falta
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/multas/AdminMultas.tsx` (líneas 165–335, componente `SeccionApuntar`).
- **Diagnóstico:** el formulario `SeccionApuntar` usa un `<Select label="Persona">` de selección única (`personaClave`). En la vida real de un vestuario amateur, las multas más habituales tras un entrenamiento o partido («No traer peto», «Llegar tarde a la charla», «Olvidar prenda de paseo») afectan a **3 o 4 jugadores a la vez**. Hoy el delegado tiene que elegir jugador 1 → elegir motivo → pulsar `Apuntar multa` → volver a elegir el motivo → elegir jugador 2 → pulsar `Apuntar multa`... (porque al guardar en `AdminMultas.tsx:229–232` se limpian `personaClave` y `conceptoId`).
- **Qué cambiar:**
  1. Mantener el `conceptoId` y la `fecha` seleccionados tras apuntar una multa (o añadir un botón secundario `Apuntar y seguir con este motivo`) o permitir seleccionar varias personas con chips táctiles en `SeccionApuntar`.
  2. En la pestaña `Bote` (`AdminMultas.tsx:460–540`), hacer que al tocar la fila de un jugador con deuda (`Pendiente > 0 €`) te lleve directamente a la pestaña `Registro` filtrada por esa persona (`setFiltroPersona(fila.personaClave)` + `setVista("registro")`) o permita un botón «Liquidar todo lo pendiente de X» con confirmación.
- **Valor para el club:** el delegado apunta las multas del entrenamiento en 15 segundos y puede saldar la cuenta de un jugador que paga todo de golpe a final de mes con un solo toque.
- **Esfuerzo:** `S`

### 7.3. Flujo de `Importar`: desconexión visual tras guardar un acta o jornada
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/importar/ImportarFoto.tsx` (líneas 348–355) y `apps/studio/components/admin/AdminActaImporter.tsx`.
- **Diagnóstico:** cuando el usuario entra a `Importar` desde `Jornada` (por ejemplo, tocando «Subir capturas de resultados» o «Subir acta a mano» en `AdminJornada.tsx`), tras analizar con Gemini y pulsar `Guardar`, `ImportarFoto.tsx:349–352` muestra un toast `"X partido(s) guardados correctamente"` y vacía la pantalla (`setLeido(null); setFilas([]);`), dejando al usuario frente al formulario vacío en `/admin/importar` en lugar de ofrecerle volver a `Jornada` o ir directamente a hacer el cartel del resultado / clasificación.
- **Qué cambiar:** al terminar de guardar con éxito en `ImportarFoto.tsx` y `AdminActaImporter.tsx`, mostrar una tarjeta de éxito con dos botones claros: `Ver la jornada actualizada` (`/admin/jornada?categoria=...&jornada=...`) y `Hacer cartel de resultados` (`/admin/cartel?plantilla=resumo&...`), además de `Importar otra captura`.
- **Valor para el club:** cierra el círculo completo del domingo por la tarde (subir captura → ver jornada lista → sacar cartel para Instagram) sin pasos muertos.
- **Esfuerzo:** `S`

---

## 8. Funcionalidades deportivas útiles que NO existen hoy (verificadas en código y BD)

Se ha revisado íntegramente el esquema de base de datos en `packages/db/src/schema/` (`calendario.ts`, `club.ts`, `competicion.ts`, `partido.ts`, `plantilla.ts`, `multas.ts`, `convocatoria.ts`, `rfgf.ts`, `acceso.ts`, `liga.ts`) para verificar qué soporta ya el modelo de datos y qué no existe aún.

### 8.1. Minutos jugados reales y promedio de minutos por jugador
- **Tipo:** `EVIDENCIA` (los datos brutos YA están en BD, pero no se calculan ni se muestran)
- **Verificación en código:**
  - En `packages/db/src/schema/partido.ts`, `partido_participaciones` guarda `titular` (`boolean`) y `jugo` (`boolean`), y `partido_eventos` guarda todos los eventos con `tipo = 'cambio'`, `minuto` (`0..130`), `jugadorId` (quien entra), `jugadorSaleId` (quien sale) y las expulsiones (`roja` / segunda `amarilla` con `minuto`).
  - Sin embargo, en `apps/studio/lib/server/acciones/estadisticas.ts` y `AdminEstadisticas.tsx` solo se cuentan partidos (`convocados`, `titular`, `jugados`), ignorando los minutos de los cambios guardados en `partido_eventos`. Un jugador que entra en el minuto 88 computa exactamente igual (`1 partido jugado`) que uno que juega los 90 minutos.
- **Propuesta concreta:**
  - **Ficheros:** `apps/studio/lib/server/acciones/estadisticas.ts`, `apps/studio/components/admin/estadisticas/AdminEstadisticas.tsx` y `FichaJugador.tsx`.
  - **Qué añadir:** calcular los minutos jugados de cada jugador cruzando `partido_participaciones` con los eventos `cambio` y expulsiones de `partido_eventos` (asumiendo 90' para Senior —o duración configurable por categoría— cuando el partido tiene eventos con minuto), y mostrar la columna `Min.` en `AdminEstadisticas.tsx` y el dato `Minutos` en `FichaJugador.tsx`.
- **Valor para el club:** permite al míster gestionar de verdad el reparto de minutos de la plantilla (saber quién acumula fatiga y qué suplentes han jugado pocos minutos reales) sin necesidad de crear tablas nuevas ni introducir más datos que el acta que ya se importa.
- **Esfuerzo:** `S`

### 8.2. Estadísticas específicas de porteros (goles encajados y porterías a cero)
- **Tipo:** `IDEA` (verificado que no existe en `AdminEstadisticas.tsx` ni en `FichaJugador.tsx`)
- **Verificación en código:** `jugadores_temporada.posicion` distingue `"Portero"` (`@santiso/domain`), y `partidos` tiene `goles_local` y `goles_visitante`. Hoy, en `AdminEstadisticas.tsx` y `FichaJugador.tsx`, a los porteros se les muestran las mismas cajas que a un delantero (`Goles: 0`), sin mostrar cuántas **porterías a cero** (*clean sheets*) lograron ni cuántos goles encajaron mientras estaban en el campo.
- **Propuesta concreta:**
  - **Ficheros:** `apps/studio/lib/server/acciones/estadisticas.ts` y `apps/studio/components/admin/estadisticas/FichaJugador.tsx`.
  - **Qué añadir:** cuando `jugador.posicion === "Portero"` (o en una vista rápida de porteros), calcular en `estadisticas.ts` a partir de los partidos jugados y los cambios de portero: **Porterías a cero**, **Goles encajados** y **Promedio encajado por partido**, mostrándolos en las tarjetas superiores de `FichaJugador.tsx` en lugar de `Goles en propia`.
- **Valor para el club:** reconoce el trabajo de los porteros de Senior y Veteranos con datos reales que ya están en las actas.
- **Esfuerzo:** `S`

### 8.3. Estado de disponibilidad para la jornada (con protección estricta de datos de salud)
- **Tipo:** `IDEA` (verificado que no existe en `packages/db/src/schema/plantilla.ts` ni `convocatoria.ts`)
- **Verificación en código:** hoy `jugadores` tiene un campo `compromiso: integer("compromiso")` (que ni siquiera se edita en `AdminPlayers.tsx`), pero no existe ningún indicador de si un jugador está disponible para el fin de semana.
- **Criterio de privacidad / protección de datos de salud (RGPD art. 9):** un club amateur **no debe almacenar diagnósticos médicos, partes de lesiones ni historiales clínicos** en la base de datos.
- **Propuesta concreta:**
  - **Ficheros:** `packages/db/src/schema/plantilla.ts` (en `jugadores_temporada`), `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx` y `AdminPlayers.tsx`.
  - **Qué añadir:** un único estado operativo no médico y efímero en `jugadores_temporada`: `disponibilidad: text("disponibilidad", { enum: ["disponible", "duda", "baja_deportiva", "ausente", "sancionado"] }).notNull().default("disponible")` y una nota breve opcional no clínica (`nota_disponibilidad`, p. ej. `"Viaje trabajo sábado"` o `"Vuelve la próxima jornada"`, con aviso explícito en el hint del campo: *"No anotar datos médicos"*).
  - En `AdminConvocatoria.tsx`, mostrar a los jugadores en `baja_deportiva`, `ausente` o `sancionado` agrupados al final de la lista con un distintivo visual claro para que el míster no los convoque por error.
- **Valor para el club:** resuelve la pregunta de cada viernes («¿quién está disponible este domingo?») directamente en la pantalla de `Convocatoria`, cumpliendo estrictamente con la privacidad de datos de salud.
- **Esfuerzo:** `M`

### 8.4. Entrenamientos y control rápido de asistencia semanal
- **Tipo:** `IDEA` (verificado que no existe en `packages/db/src/schema/index.ts`)
- **Verificación en código:** no existe ninguna tabla ni pantalla de entrenamientos. Sin embargo, en un club amateur como la UD Santiso, la convocatoria y la titularidad del domingo dependen directamente de quién fue a entrenar el martes y el jueves, y además las faltas/retrasos a entrenar suelen alimentar las `Multas`.
- **Propuesta concreta:**
  - **Ficheros nuevos:** `packages/db/src/schema/entrenamientos.ts` (`entrenamientos` con `id, temporadaId, categoria, fecha, nota` y `entrenamiento_asistencias` con `entrenamientoId, jugadorId, estado: 'asiste' | 'avisa' | 'falta' | 'retraso'`), y pantalla ligera `apps/studio/components/admin/entrenamientos/AdminEntrenamientos.tsx`.
  - **Integración con lo existente:**
    1. Pantalla móvil de una sola mano (idéntica a `Convocatoria`): por defecto todos en `Asiste`, un toque cambia a `Avisa` / `Retraso` / `Falta`.
    2. En `AdminConvocatoria.tsx`, mostrar junto al nombre de cada jugador cuántas sesiones entrenó esa semana (`2/2`, `1/2`, `0/2`).
    3. Botón opcional en el entrenamiento: «Pasar retrasos/faltas a Multas» para pre-rellenar las multas de vestuario sin apuntarlas dos veces.
- **Valor para el club:** conecta el trabajo semanal en A Baiuca con la convocatoria del fin de semana y con el bote de multas en menos de 30 segundos por sesión.
- **Esfuerzo:** `M`

### 8.5. Evolución del jugador y comparativa entre temporadas en `FichaJugador`
- **Tipo:** `IDEA` (verificado en `apps/studio/components/admin/estadisticas/FichaJugador.tsx`)
- **Verificación en código:** `FichaJugador.tsx` (líneas 155–186) ya recibe `rfgf_historico` (cifras oficiales de las últimas 5 temporadas leídas de la federación: `convocados, titular, suplente, jugados, amarillas, rojas, goles`), pero solo las imprime como una lista de texto plano dentro de un `<details className={styles.fichaAnteriores}>` plegado.
- **Propuesta concreta:**
  - **Fichero:** `apps/studio/components/admin/estadisticas/FichaJugador.tsx` y `Estadisticas.module.css`.
  - **Qué cambiar:** añadir una fila de **Totales históricos en la UD Santiso** (suma de la temporada actual + `rfgf_historico`: total de partidos oficiales y goles con la camiseta del club) y una tabla comparativa compacta año a año (`Temporada | PJ | Tit. | Goles | TA`) para ver la progresión del jugador.
- **Valor para el club:** permite saber al instante cuándo un jugador cumple 50 o 100 partidos oficiales con la UD Santiso (dato perfecto para hacerle un cartel de homenaje o mencionarlo en redes).
- **Esfuerzo:** `S`

### 8.6. Informes exportables de un toque (PDF / WhatsApp) y avisos operativos en `Jornada`
- **Tipo:** `IDEA` (verificado que `data/informes/` figura en `AGENTS.md` pero no existe generador en `apps/studio`)
- **Verificación en código:** `Convocatoria` ya tiene el botón `Copiar texto` para WhatsApp (`AdminConvocatoria.tsx:157`), lo cual es excelente. Pero ni `Multas` (`Bote`), ni `Estadísticas`, ni el resumen del próximo rival tienen salida directa para compartir en el grupo de WhatsApp de la plantilla o cuerpo técnico.
- **Propuesta concreta:**
  1. **En `AdminMultas.tsx` (pestaña `Bote`, líneas 460–540):** añadir un botón `Copiar resumen para WhatsApp` que copie al portapapeles el total del bote, el pendiente total y la lista de jugadores con deuda pendiente formateada limpia para pegar en el grupo del vestuario a final de mes.
  2. **En `AdminJornada.tsx` (`TarjetaPartido.tsx`):** añadir una píldora de **Previa del rival** generada automáticamente con los datos que ya están en `partidos` y `liga_eventos`: puesto actual del rival en la clasificación, su racha en las últimas 3 jornadas y su máximo goleador / jugadores sancionados para este partido según las actas de la liga.
- **Valor para el club:** el míster recibe en la misma pantalla de `Jornada` el *scouting* automático del rival de ese domingo (quién lleva sus goles y si su delantero está sancionado por 5 amarillas) usando los datos que el programador ya descarga de `futgal.es`.
- **Esfuerzo:** `M`

---

## 9. Ideas para modernizar sin complicar

Todas las propuestas siguientes respetan la filosofía **local-first, cero dependencias pesadas y cero complejidad innecesaria** de la UD Santiso Studio:

### 9.1. Manifiesto PWA (`manifest.webmanifest`) e iconos de instalación para Android/iOS
- **Tipo:** `EVIDENCIA` / `IDEA` (verificado que no existe `app/manifest.ts` ni `manifest.webmanifest` en `apps/studio/app/`)
- **Pantalla y fichero:** `apps/studio/app/layout.tsx` y nuevo `apps/studio/app/manifest.ts`.
- **Diagnóstico:** el delegado y el míster usan la app a diario desde el móvil por Tailscale, pero `apps/studio/app/` no expone un Web App Manifest (`display: "standalone"`, `theme_color: "#0b0b0c"`, `background_color: "#0b0b0c"`). Al abrirla en Chrome para Android, la barra de direcciones del navegador come ~`56-64 px` verticales de pantalla en cada vista.
- **Qué cambiar:** crear `apps/studio/app/manifest.ts` (nativo de Next.js App Router, ~25 líneas sin librerías ni Service Workers complejos que cacheen de más) con el escudo de la UD Santiso, `display: "standalone"` y `start_url: "/admin/jornada"`.
- **Valor para el club:** el delegado y el míster pueden pulsar «Añadir a pantalla de inicio» en Android/iPhone y abrir **UD Santiso Studio** como una aplicación nativa a pantalla completa, ganando ~60 px verticales para las listas de jugadores y carteles.
- **Esfuerzo:** `S`

### 9.2. Compartir nativo con `navigator.share` en `Convocatoria` (igual que ya hace `Alineación`)
- **Tipo:** `EVIDENCIA`
- **Pantalla y fichero:** `apps/studio/components/admin/convocatoria/AdminConvocatoria.tsx` (líneas 293–305) frente a `apps/studio/components/admin/alineacion/AdminAlineacion.tsx` (líneas 177–203) y `GeneradorCartel.tsx` (líneas 215–238).
- **Diagnóstico:** tanto `AdminAlineacion.tsx:180` como `GeneradorCartel.tsx:220` detectan `navigator.canShare({ files: [archivo] })` y ofrecen el botón **«Compartir»** que en móvil abre directamente la hoja nativa de Android/iOS para enviar la imagen a WhatsApp o Instagram sin guardarla primero en el carrete. En cambio, `AdminConvocatoria.tsx:297` solo tiene un botón **«Descargar PNG»** (`<a download>`).
- **Qué cambiar:** añadir en `AdminConvocatoria.tsx` la misma función `compartirImagen()` con `navigator.share({ files: [archivo] })` que ya existe en `AdminAlineacion.tsx:177`.
- **Valor para el club:** enviar la imagen de la convocatoria al grupo de WhatsApp del equipo desde el móvil pasa de «descargar archivo → abrir WhatsApp → adjuntar de galería» a un solo toque en «Compartir».
- **Esfuerzo:** `S`

### 9.3. Previsualización del punto de interés (`focoX`, `focoY`) con marco 4:5 / 9:16 en fotos de partido
- **Tipo:** `IDEA`
- **Pantalla y fichero:** `apps/studio/components/admin/jornada/FotosPartido.tsx` y `apps/studio/components/admin/GeneradorCartel.tsx`.
- **Diagnóstico:** el esquema `fotos_partido` (`packages/db/src/schema/partido.ts:93–94`) ya guarda `focoX` y `focoY` (`0..1`) para recortar la foto en los carteles de `Resultado` y `O noso 11`. Mostrar sobre la miniatura un rectángulo sutil con la proporción `4:5` alrededor del punto tocado ayuda a anticipar exactamente qué caras saldrán en el cartel antes de renderizar el PNG.
- **Valor para el club:** evita tener que regenerar el cartel varias veces porque una cabeza o celebración quedó cortada en el borde.
- **Esfuerzo:** `S`

---

## Top 10 de Producto, Diseño y UX (Priorizado por Impacto / Esfuerzo)

| # | Prioridad | Propuesta | Ficheros principales | Tipo | Esfuerzo | Impacto para la UD Santiso |
| :-: | :-: | :--- | :--- | :-: | :-: | :--- |
| **1** | **P0** | **Acceso móvil a «Mi cuenta / Salir» y cajón «Menú» en la cabecera/barra móvil:** hoy `.sidebar` está oculta en `<=900 px` y un usuario `tecnico` no tiene forma de cerrar sesión ni cambiar su clave desde el móvil. | `components/studio/StudioShell.tsx`, `StudioShell.module.css`, `components/admin/inicio/AdminInicio.tsx` | `EVIDENCIA` | **S** | Desbloquea la gestión de sesión del míster en móvil y permite cambiar de sección sin pasar por `Inicio`. |
| **2** | **P0** | **Avisos de sancionados y apercibidos (4 amarillas) en `Jornada`, `Convocatoria` y `Alineación`:** cruzar el cálculo ya existente en `liga.ts` con la lista de jugadores al convocar y alinear. | `lib/server/acciones/liga.ts`, `components/admin/convocatoria/AdminConvocatoria.tsx`, `components/admin/alineacion/AdminAlineacion.tsx` | `EVIDENCIA` | **M** | Evita alineaciones indebidas y olvidos de sanciones federativas al hacer la lista del domingo. |
| **3** | **P1** | **Pre-cargar en `Alineación` los convocados del partido (`partido_convocados`):** cuando aún no hay once guardado, marcar automáticamente como `Suplente` a los citados en `Convocatoria` para elegir solo los 11 titulares. | `lib/server/acciones/alineacion.ts`, `components/admin/alineacion/AdminAlineacion.tsx` | `EVIDENCIA` | **S** | Ahorra 16–18 toques en el vestuario cada domingo y une los pasos de `Convocatoria` y `Alineación`. |
| **4** | **P1** | **Cálculo de minutos jugados reales y estadísticas de porteros (porterías a cero):** aprovechar los minutos de `cambio` y expulsiones que ya existen en `partido_eventos`. | `lib/server/acciones/estadisticas.ts`, `components/admin/estadisticas/AdminEstadisticas.tsx`, `FichaJugador.tsx` | `EVIDENCIA` | **S** | Da al cuerpo técnico los minutos reales de cada jugador y las porterías a cero sin meter un solo dato extra. |
| **5** | **P1** | **Sincronizar categoría (`Senior`/`Veteranos`) en `Importar` y unificar el selector en `StudioShell`:** que `ImportarFoto` e `ImportarCalendarioPdf` respeten la categoría activa del contexto. | `components/admin/importar/ImportarFoto.tsx`, `ImportarCalendarioPdf.tsx`, `components/studio/StudioShell.tsx` | `EVIDENCIA` | **S** | Evita importar por error una jornada de Veteranos en Senior (o viceversa). |
| **6** | **P1** | **Instalar como app en móvil (`app/manifest.ts`) y botón «Compartir» nativo en `Convocatoria`:** añadir Web App Manifest standalone y `navigator.share` para el PNG de convocatoria. | `app/manifest.ts`, `components/admin/convocatoria/AdminConvocatoria.tsx` | `EVIDENCIA` / `IDEA` | **S** | Se abre a pantalla completa en Android (ganando ~60 px verticales) y comparte la convocatoria por WhatsApp en 1 toque. |
| **7** | **P1** | **Corregir el hueco de la barra inferior en `Alineación`, el `window.confirm` nativo y `useUnsavedChanges` en `Multas`/`Importar`:** igualar `bottom: 56px`, usar `showConfirm` y proteger lecturas de Gemini sin guardar. | `components/admin/alineacion/Alineacion.module.css`, `AdminAlineacion.tsx`, `AdminConvocatoria.tsx`, `AdminMultas.tsx`, `ImportarFoto.tsx` | `EVIDENCIA` | **S** | Pulido inmediato en móvil y protección contra pérdidas accidentales de datos al tocar las pestañas inferiores. |
| **8** | **P2** | **Agilizar `Multas` en el vestuario:** mantener motivo al apuntar en serie, botón «Copiar resumen del bote para WhatsApp» y plegar cada fila de la pestaña `Normas` en `360 px`. | `components/admin/multas/AdminMultas.tsx`, `Multas.module.css` | `EVIDENCIA` | **S** | Apuntar multas a varios jugadores tarda segundos y el estado del bote se comparte en el grupo del equipo en 1 toque. |
| **9** | **P2** | **Ficha previa del rival en `Jornada` y panel de rendimiento colectivo en `Estadísticas`:** mostrar puesto, racha, máximo goleador y sancionados del rival del domingo usando `liga_eventos`, y goles por tramos de 15'. | `components/admin/jornada/TarjetaPartido.tsx`, `components/admin/estadisticas/AdminEstadisticas.tsx` | `IDEA` | **M** | Convierte los datos que ya se bajan de `futgal.es` en información táctica útil para preparar el partido. |
| **10** | **P2** | **Limpieza de `globals.css`, eliminación de `AdminUI.tsx` y unificación de controles y cabeceras `<h1>`/`<h2>`:** retirar las ~1.200 líneas de CSS heredado y los `<select>`/`<input>` sin `foundation`. | `app/globals.css`, `styles/tokens.module.css`, `components/ui/AdminUI.tsx`, `components/admin/**` | `EVIDENCIA` | **M** | Deja una única fuente de verdad visual (`tokens.module.css` + `foundation`) y recupera ~50 px verticales en escritorio. |
