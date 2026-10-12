# Auditoría de diseño de UD Santiso Studio — 12/10/2026

## Dictamen

Studio ya resuelve trabajo real. La compactación funciona: hay listas densas, filtros que no ocupan media pantalla y acciones al alcance del pulgar. El salto pendiente no consiste en poner más efectos. Consiste en **dar protagonismo al partido y a las personas, reducir el ruido de controles y convertir el amarillo en una decisión, no en el estado por defecto de casi todo**.

Los carteles tienen más identidad que la herramienta: amarillo, negro, diagonales, Anton y Barlow Condensed forman una familia reconocible. La aplicación mezcla botones con relieve, pestañas subrayadas, tarjetas, tablas y filas con fuentes nativas. Android se ve contundente; WebKit, mucho más fino. Antes de rehacer la identidad, corregiría esa paridad.

Elegiría la dirección **«Vestiario»**, descrita abajo: superficies sobrias, tipografía más disciplinada, navegación por trabajo del día y fotografía real del club en las piezas que la admitan. No convertiría una herramienta para dos personas en una plataforma con cuentas, permisos y paneles nuevos.

## Alcance, evidencia y límites

- Rama auditada: `carteles-distintos`, commit `47c52a2`. Worktree: `santiso-auditoria`; rama del informe: `auditoria-diseno`.
- Playwright con Chrome instalado, perfil Pixel 7, **360 × 780**; WebKit, perfil iPhone 13, **390 × 844**. Capturas de pantalla a escala 1. Cinco vistas de escritorio en Chromium, **1280 × 800**.
- **155 PNG**, fuera de Git, en `data/informes/auditoria-diseno/`: pantallas iniciales, estados abiertos, controles complementarios, carga/error, carteles y 22 vistas de miniaturas a 120 y 320 px. Se inspeccionaron las imágenes individualmente; los hallazgos no proceden solo del CSS.
- Carteles finales: siete plantillas de Carteles en 4:5; Partido y Próximos también en 9:16; Convocatoria en 4:5 y Alineación en 9:16. Esos dos últimos son productores separados. No inventé formatos que la interfaz no ofrece.
- PNG exportados a ×2: **2160 × 2700** o **2160 × 3840**. Dimensiones comprobadas leyendo la cabecera PNG. La nitidez de exportación no equivale a legibilidad al reducir la pieza a 320–360 px.
- Datos: temporada 2026/27. Próximo Senior: Atlético Éter, 18/10, 17:00; Veteranos: S.D.C. Recesende, 17/10, 18:00. Resultado y cronología: C.D. Berres 8–3 Santiso, jornada 2. Clasificación: 14 equipos, Santiso 12.º. O noso 11 con foto utiliza los 11 titulares, cuatro suplentes y capitán de la alineación existente del próximo partido; se trasladaron al formulario en memoria. La foto procede de la ficha real de Ramos. El comunicado usa información del próximo encuentro, sin atribuir al club un anuncio publicado.
- El vacío de Estadísticas se obtuvo buscando un texto sin coincidencias. Su error se simuló abortando una consulta: **no prueba un fallo habitual del servidor**. Las capturas de carga son estados transitorios, no pantallas rotas.
- No se llamó a Gemini, no se pulsó «Comprobar ahora», no se cobraron multas ni se guardaron editores. **Hay una excepción accidental de lectura, documentada al final:** «Ver cartel» de Convocatoria guarda si aún no hay convocatoria. No se puede afirmar que la auditoría fue completamente de solo lectura.
- Emulación no sustituye iPhone/Android físicos: no comprobé teclado nativo, sol directo, notch real, gesto de volver ni la interfaz superpuesta de Instagram. Los valores de zona segura resultaron cero en emulación; la barra inferior midió 57 px, con 4 px de padding inferior. El inglés de algunos selectores de archivo iniciales depende del contexto del navegador; no lo clasifico como defecto de traducción del producto.
- La comparación adicional de Chrome a 390 y WebKit a 360 descarta que toda la diferencia tipográfica se deba al ancho. En filas de «Partidos del Santiso», la familia calculada fue **Arial** en Chrome y **MS Shell Dlg** en WebKit. La causa completa del distinto grosor de las fuentes locales queda por investigar.
- No se forzaron vacío, carga y error en cada pantalla: esas comprobaciones son representativas, no una auditoría exhaustiva de recuperación y validaciones. Todos los estados abiertos enumerados sí tienen captura en ambos anchos solicitados.
- `pnpm check`: verde, 103 ficheros de pruebas, **758 passed / 1 skipped**. Typecheck, lint y formato también verdes. No ejecuté e2e ni pruebas de escritura: no se cambió la aplicación. Log: `pnpm-check.log`, en la carpeta de evidencia. Servidor propio del puerto 3200 cerrado; no se intervino en 3100 ni en `santiso-estable`.

Como lista secundaria de comprobación se usó [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), especialmente foco, formularios, movimiento y áreas táctiles. Las decisiones visuales y prioridades siguientes proceden de estas capturas y del uso del club.

**Esfuerzo:** S, menos de una hora; M, aproximadamente medio día; L, más de medio día. Son estimaciones de implementación y comprobación, no presupuestos cerrados. Las direcciones completas incluyen rangos mayores. Impacto se refiere a calidad percibida y utilidad para delegado/entrenador.

## 1. Los diez cambios con mayor retorno

| Orden | Cambio                                                                                                                                            | Qué se gana                                                              | Qué cuesta / renuncia                                                                       | Esfuerzo | Impacto |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------- | ------- |
| 1     | Igualar fuentes entre motores y fijar una escala: cuerpo 16, secundario 13–14, título 20–24; 400/600/700, reservando 800 para cifras o titulares  | Una misma app en ambos móviles; nombres legibles sin que todo grite      | Revisar carga de fuentes, herencia y filas legadas; repetir capturas en dispositivos reales | M        | Alto    |
| 2     | Botón amarillo para una acción principal por contexto; estados seleccionados con borde/fondo discreto; quitar brillo y doble sombra generalizados | Se entiende qué hacer; datos ganan peso sobre controles                  | Menos aspecto de botón físico; cambiar componentes comunes y revisar estados                | M        | Alto    |
| 3     | Accesos directos según trabajo: entrenador con Convocatoria/Once/Multas; delegado con Jornada/Publicar/Importar                                   | Menos visitas al menú «Más»; recorridos más cortos                       | Aprendizaje inicial y una preferencia por dispositivo; no requiere cuentas nuevas           | L        | Alto    |
| 4     | Rehacer Jornada alrededor del próximo partido y de su siguiente tarea pendiente                                                                   | De panel de enlaces a mesa de trabajo: preparar, jugar, cerrar partido   | Repensar estados y orden de acciones; conservar acceso a todas las tareas                   | L        | Alto    |
| 5     | Editar filas al tocarlas; trasladar «Quitar», «Baja» y borrado al detalle con texto explícito                                                     | Más ancho para nombres y menos riesgo de pulsación equivocada            | Un toque adicional para acciones poco frecuentes                                            | M        | Alto    |
| 6     | Diseñar carteles a 320 px, con menos datos por lámina y tamaños mínimos editoriales                                                               | Piezas que se leen en Instagram, no solo al abrir el PNG grande          | Cronología y clasificación pueden necesitar dos láminas; más archivos                       | L        | Alto    |
| 7     | Unificar producción: Partido → plantilla → revisar → compartir; misma fuente de datos para Once y O noso 11                                       | Menos formularios distintos, menos dudas sobre qué once se publica       | Adaptar los productores existentes y sus pruebas; mantener edición manual como alternativa  | L        | Alto    |
| 8     | Normalizar fotos, escudos y logos; usar fotografías reales donde aporten identidad                                                                | El club aparece como personas y camiseta, no solo como halos y un escudo | Seleccionar mejores originales; una sesión sencilla de fotos y tratamiento consistente      | M        | Alto    |
| 9     | Un patrón de hoja de consulta/edición breve y otro de editor largo, con títulos, cierres y acciones coherentes                                    | Sensación de sistema cuidado; menos saltos de comportamiento             | Revisar cada diálogo; no todos deben ser hojas pequeñas                                     | M        | Medio   |
| 10    | Estados de carga/vacío/error y movimiento breve coordinados                                                                                       | La app explica qué está pasando y conserva orientación                   | Añadir esqueletos, mensajes específicos y transiciones con reducción de movimiento          | M        | Medio   |

Los defectos del apartado siguiente son previos al pulido: no conviene pintar encima de ellos.

## 2. Defectos observados, separados de las mejoras

| ID  | Defecto y evidencia                                                                                                                                                                                                                                             | Reproducción / propuesta                                                                                                                                                   | Esfuerzo | Impacto |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| D1  | Paridad tipográfica rota: la misma lista propia usa Arial frente a MS Shell Dlg; WebKit presenta trazos mucho más finos en toda la herramienta. `calendario-santiso-390-chrome.png` y `calendario-santiso-360-webkit.png`                                       | Heredar explícitamente familia en controles legados y comprobar los pesos de las fuentes locales. Confirmar en Safari físico antes de atribuir toda diferencia al producto | M        | Alto    |
| D2  | «MULTAS» se parte como «MULT / AS» y «PAGADO» como «PAGA / DO»; varios importes separan número y €. `multas-bote-360-abierto.png`, también a 390                                                                                                                | Cabeceras «N.º», «Debe», «Pagado», importes indivisibles y ancho prioritario para persona. Si no cabe, fila de dos líneas, no palabras partidas                            | S        | Alto    |
| D3  | Casillas de Normas: etiqueta y objetivo asociado de **21 px de alto**, tanto en Chrome como en WebKit. `multas-normas-360-abierto.png`; medida en `comprobaciones.json`                                                                                         | Hacer táctil toda etiqueta con altura mínima 44 px; separar activación de Guardar. No basta con que el botón de guardado sea grande                                        | S        | Alto    |
| D4  | Ficha de Miky: «CONVOCADO» corta la última letra a otra línea en Android. `estadisticas-ficha-360-abierto.png`                                                                                                                                                  | «Conv.» o «Convocado» sin mayúsculas espaciadas, y etiqueta que no rompa dentro de palabra                                                                                 | S        | Medio   |
| D5  | Historia de Próximos dice «HOXE XOGAMOS» pero incluye sábado 17 y domingo 18: no pueden ser ambos hoy. `cartel-proximos-1080-historia.png`                                                                                                                      | Si mezcla fechas, «Esta fin de semana»; «Hoxe» solo para encuentros del día, o una historia por fecha                                                                      | S        | Alto    |
| D6  | Exportación inicial de O noso 11 sin foto recorta contenido por derecha: cabecera y parte del bloque de suplentes. La previa posterior entra en su caja. `cartel-noso11-1080-sin-foto-exportacion-inicial.png` frente a `carteles-noso11-vista-360-abierto.png` | Verificar igualdad de medidas/fuentes entre previa y exportación y cajas antes de permitir descargar. La causa no quedó cerrada; no atribuirlo sin prueba a un único CSS   | M        | Alto    |
| D7  | En Anuncio, los saltos de línea escritos en el formulario se convierten en texto corrido: rival, fecha y campo quedan pegados. `cartel-multiusos-1080-publicacion.png`                                                                                          | Respetar párrafos/saltos o explicar que el campo admite solo un párrafo. Para comunicados, preferir bloques reales                                                         | S        | Medio   |
| D8  | «Ver cartel» puede guardar una convocatoria sin avisar en ese botón; «Pasar a alineación» también incluye guardado. El guardado automático se observó durante la auditoría                                                                                      | Separar previsualizar de persistir, o rotular «Guardar y ver cartel» cuando corresponda. No poner un efecto de escritura detrás de una etiqueta de consulta                | M        | Alto    |

No observé desbordamiento horizontal del documento en las 46 capturas iniciales móviles. Sí hay muchos truncados dentro de cajas. **Un truncado no es automáticamente un fallo:** en una fila compacta puede ser correcto si el toque abre el nombre completo. Hoy demasiadas filas ceden espacio a botones y obligan a truncar el dato principal.

El escudo negro de Atlético Éter se pierde sobre negro en listados y en varias piezas. Lo trataría como problema de contraste de medios: colocar un fondo neutro discreto y ajustar halo según luminancia, conservando el escudo original. **M / alto**. No cambiaría arbitrariamente su color.

## 3. Problemas transversales y propuesta común

### 3.1. Todo parece primario

En Android, título, nombres, cantidades, «Editar», «Quitar» y controles comparten mucho peso. En Multas hay una columna completa de «Cobrar» amarillos. En Equipos, arriba compiten «Añadir a competición», la pestaña activa y el selector de categoría. El brillo y la sombra exterior aparecen también en acciones secundarias.

**Propuesta — M / alto:** amarillo sólido para avanzar o ejecutar la tarea principal; secundario de superficie plana con borde; navegación activa con marca lateral/subrayado; selección con fondo tenue y marca de estado. Datos principales en 600/700, metadatos en 400. Se gana jerarquía; se pierde el relieve llamativo que ahora proporciona carácter a cada botón.

### 3.2. Compactar no debe significar amputar nombres

En Jugadores, Miguel Pampín Vizcaíno queda cortado mientras lápiz y X consumen 92 px. En Equipos hay tres acciones por fila y «A.C.U.D. Camporrapado» pierde media identidad. Estadísticas tiene una columna de nombre estrecha junto a cuatro contadores.

**Propuesta — M / alto:** tocar la fila abre ficha o editor; nombre habitual/apodo como primera línea y nombre completo como secundario donde haga falta; una acción contextual visible como máximo. En estadísticas, priorizar nombre y la métrica elegida, con el resto en detalle. Se gana reconocimiento; editar/borrar deja de estar disponible en una sola pulsación desde la lista.

### 3.3. Unificar los controles que representan lo mismo

Hay pestañas subrayadas en Multas, botones segmentados en Calendario, toggles amarillos en Carteles y enlaces subrayados «Más filtros» / «Más opciones». La categoría aparece como dos botones en cabecera, pero como select dentro de Carteles.

**Propuesta — M / medio:** pestañas para cambiar contenido; selector segmentado para una decisión corta; hoja para filtros; disclosure para contenido adicional. Misma categoría en todas las pantallas de producción. Se gana aprendizaje reutilizable; requiere pasar por formularios legados, no solo cambiar tokens.

### 3.4. Paleta y superficies

Negro y amarillo son del club y conviene mantenerlos. Lo que sobra es la acumulación: negro puro, paneles con degradado, bordes múltiples, botones con brillo y amarillos distintos. En Jornadas hay una tarjeta dentro de otra dentro de otra.

**Propuesta — M / alto:** fondo grafito `#111318`, superficie `#1D2024`, texto `#F4F5F6`, secundario `#ADB4BE`, amarillo del kit `#F5C518`; verde/rojo solo para estados deportivos o de operación y siempre acompañados de texto/símbolo. Radios orientativos 10 px en controles y 14–16 en paneles, separación de 4/8/12/16/24. Son valores de propuesta, no una obligación de adoptar otro tema entero.

Se gana profundidad sin ruido. Cuesta revisar contraste real y conservar diferencia entre seleccionado, habilitado, pendiente y deshabilitado. No daría por suficiente una comprobación de contraste calculada si las letras siguen demasiado finas.

### 3.5. Fotos y logos

Cuadrados vacíos repetidos en Directiva y Jugadores; fotos con fondos y encuadres distintos; escudos negros casi invisibles; logos institucionales ocupando más presencia que el nombre del club en algunos carteles.

**Propuesta — M / alto:** avatar de iniciales cuando falta foto, recorte coherente y fondo de escudo que preserve contraste. Logos originales limpios, sin imponer relieve a todos. En carteles, una firma constante «UD SANTISO» y una zona estable para institucionales/patrocinadores. Gana pertenencia y coherencia; cuesta preparar recursos y pactar cuánto espacio necesitan los colaboradores.

### 3.6. Hojas, foco y movimiento

Filtros y Nueva multa utilizan una hoja inferior razonable. Jugadores, Técnicos, Directiva, Equipos y ficha estadística ocupan pantalla completa. El detalle propio de Calendario es hoja, pero el detalle por jornada se abre dentro de la lista. En WebKit aparece un rectángulo amarillo alrededor del título de la hoja al abrirla.

El foco retorna correctamente al botón de Filtros al cerrar en los cuatro controles de motor/ancho. La hoja medida no tiene animación ni transición: `none / 0s`.

**Propuesta — M / medio:** consulta breve en hoja, edición larga en editor completo; cierre de 44 px y acciones al pie; título corto, objeto en una línea secundaria. Transición de 160–200 ms en transform/opacity, respetando movimiento reducido; disclosure breve sin empujar toda la lista bruscamente. Mantener foco visible, evitar que el foco programático del título parezca una selección de texto. Gana continuidad; cuesta probar teclado y gesto de volver sin ocultar cambios pendientes.

### 3.7. Estado y vocabulario

«BD», «Sin BD», «Visibilidad de activos», «heroica» y explicaciones sobre temporadas se interponen entre usuario y tarea. Un campo o un error a menudo explican cómo funciona el sistema, no lo que necesita saber la persona.

**Propuesta — S / medio:** «Desde la liga» / «Escribir tabla», «Logos del cartel», «Foto protagonista». UI en castellano y piezas en gallego es una convención posible; evitar mezcla accidental dentro de una misma tarea. Mantener los nombres deportivos reconocibles. Se gana confianza; revisar textos lleva menos que rediseñar pantallas, pero requiere una lista común.

## 4. Pantallas: qué conservar y qué cambiar

Las referencias de esta sección usan **N = 360 y 390** para parejas de archivos existentes. El inventario final expande los nombres principales; todos están en la carpeta indicada.

### Jornada

**Evidencia:** `jornada-N-inicial.png`, `jornada-1280-inicial.png`.

Funciona la separación Senior/Veteranos y el acceso desde el partido a producción. Fallan la jerarquía y la respiración: semana, navegación y botón «Próximos encuentros» ocupan un panel completo; después llegan varias capas de paneles y botones. En móvil, Veteranos queda lejos de la primera pantalla. En escritorio, dos tarjetas muestran muchos controles deshabilitados «Tras el partido».

**Propuesta — L / alto:** próximo partido con categoría, rival, fecha y estado de preparación; debajo, una acción principal y tres accesos discretos. Las tareas posteriores aparecen cuando el partido se juega. Selector Senior/Veteranos o resumen visible de ambos antes del detalle. Gana orientación en dos segundos y menos scroll para el otro equipo; cuesta modelar correctamente los estados y no esconder trabajo excepcional.

### Calendario — por jornada

**Evidencia:** `calendario-N-inicial.png`, `calendario-filtros-N-abierto.png`, `calendario-fila-N-abierto.png`, escritorio a 1280.

Filtro compacto y siete partidos legibles. La flecha alta permite desplegar sin tocar marcador. Pero cada marcador es un input incluso para consultar; el desplegable termina con Guardar y X, y el selector de jornada comienza en la primera, no en el contexto semanal de Jornada.

**Propuesta — M / alto:** filas de consulta con marcador estático; tocar abre edición en hoja, compartiendo patrón con «Partidos del Santiso». Mantener modo de edición múltiple en escritorio si el delegado lo necesita. Gana calma y reduce cambios involuntarios; cuesta un toque extra para correcciones rápidas y adaptar el recorrido de importación.

### Calendario — Partidos del Santiso

**Evidencia:** `calendario-santiso-N-inicial.png`, `calendario-santiso-detalle-N-abierto.png`, `calendario-santiso-anteriores-N-abierto.png`.

Funciona muy bien la fila de 64 px y el histórico plegado: quedan último jugado y futuros. Sobran la explicación sobre guardar cada fila y la duplicación de nombre/jornada/fecha al abrir. El marcador de un partido futuro aparece como una sucesión de guiones. La familia nativa rompe el sistema.

**Propuesta — S / medio:** sustituir la ayuda por una acción contextual o tooltip, mostrar «18 oct · 17:00» en futuros y una etiqueta «Fuera»/«Casa»; nombre completo en detalle. Gana lectura de agenda; cuesta decidir prioridad entre campo y fecha en la segunda línea. Corregir D1 aparte.

### Clasificación

**Evidencia:** `clasificacion-N-inicial.png`, `clasificacion-detalle-N-abierto.png`, `clasificacion-zonas-N-abierto.png`, escritorio a 1280.

Cinco columnas en móvil y expansión para GF/GC resuelven bien densidad. En Android, Camporrapado ocupa dos líneas mientras otros equipos una; Santiso no se ve en la primera pantalla. «Zonas de la clasificación» parece la acción principal aunque se usa poco. Su diálogo vacío ocupa casi toda pantalla.

**Propuesta — M / alto:** resumen fijo y breve «Santiso 12.º · 0 pts», tabla y gestión de zonas en menú. Marcar Santiso con franja discreta, no hacer amarillas todas las cifras. Zonas en hoja compacta hasta que haya varias. Gana foco deportivo; cuesta añadir contexto sin inventar comparaciones de temporadas ausentes.

### Estadísticas y ficha de jugador

**Evidencia:** `estadisticas-N-inicial.png`, `estadisticas-filtros-N-abierto.png`, `estadisticas-ficha-N-abierto.png`; vacío/error y carga en inventario.

Lista rápida, ordenación accesible y ficha con partidos reales. Fallan «22 jugad…», nombres truncados y casi el mismo peso en columnas secundarias. La ficha reparte seis cifras en cajas iguales aunque no todas importan por igual; «CONVOCADO» se rompe. Carga: una caja «Cargando ficha…» sobre mucho espacio vacío. Error: título y cuerpo repiten la misma frase.

**Propuesta — M / alto:** métrica elegida visible junto al nombre; portada de ficha con foto, dorsal/apodo y dos cifras principales; resto en rejilla secundaria. Esqueleto de ficha, error con causa útil/acción y sin frase duplicada. Gana reconocimiento y comprensión; cuesta revisar qué métrica es principal para portero, jugador de campo y periodo seleccionado.

### Jugadores

**Evidencia:** `jugadores-N-inicial.png`, `jugadores-editor-N-abierto.png`, `jugadores-filtros-N-abierto.png`.

La lista cabe, tiene búsqueda y posición en secundario. Fotos reales aportan mucho. Lápiz y X aprietan los nombres; los cuadros vacíos no ayudan. Editor presenta explicación del modelo Persona/Temporada y un área de historial grande antes de dorsal y posición.

**Propuesta — M / alto:** apodo deportivo + nombre completo recuperable; toque en fila para editar; quitar en menú. Editor abre con nombre/apodo/dorsal/posición; historial e información transversal plegados. Gana rapidez para altas y convocatorias; cuesta reordenar campos sin confundir datos globales con temporada.

### Cuerpo técnico

**Evidencia:** `tecnicos-N-inicial.png`, `tecnicos-editor-N-abierto.png`.

Dos personas son fáciles de encontrar. El cargo del delegado ya se lee en una línea. Botones de quitar y editar compiten con fotos y nombres; el editor dedica dos explicaciones a solo nombre/cargo/foto.

**Propuesta — S / medio:** filas con foto de 40–44 px, nombre y cargo, detalle al tocar; una ayuda breve sobre temporada dentro del editor, no dos bloques. Gana humanidad y espacio; no necesita llenar el vacío inferior con estadísticas inventadas.

### Directiva

**Evidencia:** `directiva-N-inicial.png`, `directiva-editor-N-abierto.png`.

Seis miembros y cargos escaneables. Todas las fotos vacías parecen elementos pendientes de cargar; Teresa se trunca en Android. El editor repite estructura extensa de Técnicos.

**Propuesta — S / medio:** iniciales cuando falta foto, cargos en secundario y acciones dentro de la ficha. Gana acabado con los datos que ya existen; cuesta diseñar un placeholder coherente y respetar nombres completos.

### Multas — registro

**Evidencia:** `multas-N-inicial.png`, `multas-1280-inicial.png`.

Pestañas claras, fila compacta, importe destacado y filtro de persona. Problema: todos los cobros son amarillos, la X se confunde con cerrar, nombre y motivo pierden espacio. El resumen de deuda está en otra pestaña.

**Propuesta — M / alto:** cabecera con «25,00 € pendientes» y Nueva multa como principal; fila nombre/motivo/importe con cobro secundario o acción al abrir. Borrado con texto y separado del cobro. Gana lectura del estado del bote y menos toques peligrosos; cuesta un paso adicional para cobros individuales.

### Multas — Bote

**Evidencia:** `multas-bote-N-abierto.png`.

Las dos cifras 0,00 € cobrado y 25,00 € pendiente explican estado inmediatamente. Tabla rompe encabezados y símbolo €; algunas personas ocupan dos líneas y las cifras pierden alineación.

**Propuesta — S / alto:** corregir D2; «N.º / Debe / Pagado», cifras tabulares sin salto y un total más visible. Si el nombre es largo, fila con nombre arriba y las tres cifras abajo. Gana lectura económica; cuesta abandonar la tabla estricta en 360 px.

### Multas — Normas

**Evidencia:** `multas-normas-N-abierto.png`.

Agrupación Adestramentos/Partidos útil y aviso sobre multas existentes acertado. Pero es una pantalla de edición permanente con muchos Guardar deshabilitados; «por unidad» y «en uso» tienen objetivos de 21 px.

**Propuesta — M / medio:** reglas como lista «Chegar tarde · 0,50 € · Activa», editor breve al tocar; añadir una regla al final de cada grupo. Gana seguridad y calma; editar deja de ser inmediato. La ampliación táctil D3 sí es urgente.

### Multas — Nueva multa

**Evidencia:** `multas-nueva-N-abierto.png`.

Hoja inferior, campos a la par y acción final grande: uno de los mejores patrones. El selector de persona mezcla jugadores y técnicos de ambas categorías en una lista extensa. «Poner multa» podría ser más explícito sobre importe y persona una vez elegidos.

**Propuesta — M / medio:** buscar persona dentro de la hoja y mostrar categoría/cargo en opciones; motivos frecuentes primero; confirmación de la operación en el texto del botón o resumen previo. Gana rapidez y menos errores de destinatario; cuesta un selector buscable y probar teclado físico.

### Convocatoria

**Evidencia:** `convocatoria-N-inicial.png`, `convocatoria-vista-N-abierto.png`, `convocatoria-360-carga.png`.

Dos columnas permiten revisar jugadores y la barra fija facilita terminar. «22 convocados / 22» es claro. Todos seleccionados tienen el mismo amarillo tenue: cuesta distinguir una revisión pendiente de una convocatoria lista. Guardar y Ver cartel ocultan comportamiento diferente; ver D8.

**Propuesta — M / alto:** selección con check explícito, estado «Borrador/Guardada» y barra que diga qué falta. Hora/lugar de quedada con resumen visible antes de compartir. Previsualizar no debe guardar a escondidas. Gana confianza del entrenador; cuesta definir estado editorial sin convertirlo en burocracia.

### Alineación

**Evidencia:** `alineacion-N-inicial.png`, `alineacion-vista-N-abierto.png`, `alineacion-360-carga.png`.

11/11 en verde y cuatro suplentes ayudan; capitán separado y acciones al pulgar. Cada fila muestra «Titular» repetido y otra C con el mismo tamaño que el contenido. Manuel Vázquez Novas provoca una fila muy alta en WebKit. Guardar y Ver historia más barra de navegación consumen parte importante del alto.

**Propuesta — M / alto:** grupos Titulares/Suplentes/Fuera, fila de selección con rol contextual y un único capitán marcado; tocar cambia papel con opciones claras, no depender solo de ciclos. En modo edición, barra de tarea puede sustituir temporalmente navegación general. Gana espacio y menos repetición; cuesta comprobar selección rápida de 22 personas sin perder rendimiento.

### Carteles — pantalla común

**Evidencia:** `carteles-partido-N-inicial.png`, `carteles-partido-manual-N-abierto.png`, todas las vistas previas y escritorio de Partido.

Datos/Vista previa fija es una decisión buena. Plegar Instagram, escudo y limpiar evita formulario interminable. Pero el usuario ve una lista de tipos y un formulario antes de ver qué va a publicar; «Preparar PNG» es un detalle técnico. Se alternan ayudas, encabezados y toggles de activos con nombres internos.

**Propuesta — L / alto:** galería pequeña con miniaturas y tareas «Anunciar partido / Publicar resultado / Convocar / Once / Comunicado»; elegir partido una vez, vista inmediata y botón «Preparar para compartir». Datos manuales secundarios. Gana confianza visual y un flujo de producción; cuesta coordinar productores actuales y conservar borradores.

### Carteles — Partido

**Evidencia:** `carteles-partido-N-inicial.png`, manual y vista previa a ambos anchos.

Carga del próximo partido delante y datos manuales plegados funcionan. Formato, categoría, carga, otro partido y lado del Santiso son cinco decisiones antes de la imagen. Elegir lado es una decisión de composición, no un dato del encuentro.

**Propuesta — S / medio:** partido primero; formato y lado en «Diseño» junto a previa. Gana secuencia lógica; puede añadir un toque para usuarios que cambian de formato constantemente.

### Carteles — Resumo

**Evidencia:** `carteles-resumo-N-inicial.png`, `carteles-resumo-vista-N-abierto.png`.

Autocompletar y fecha/hora a la par ayudan. Campos de competición, jornada, estadio y rival todavía parecen obligatorios pese a poder recuperarse del partido.

**Propuesta — M / alto:** selector de resultado → imagen → «Corregir datos». Mostrar que es 8–3 contra Berres antes de abrir edición. Gana velocidad y menos duplicación; exige que el origen de goleadores sea visible y el usuario sepa qué cambia solo en el cartel.

### Carteles — Cronoloxía

**Evidencia:** `carteles-cronoloxia-N-inicial.png`, `carteles-cronoloxia-vista-N-abierto.png`.

Par de marcadores claro, pero «+ Evento» y vacío ocupan espacio sin explicar si existe un acta que cargar. La pieza resultante tiene muchos más eventos que los que caben legibles.

**Propuesta — M / alto:** lista de eventos recuperados con selector «Todos / Goles / Goles y cambios» y aviso de densidad antes de exportar. Gana control editorial; cuesta decidir qué eventos se omiten sin alterar el acta.

### Carteles — Próximos

**Evidencia:** `carteles-proximos-N-inicial.png`, `carteles-proximos-fila-N-abierto.png`, `carteles-proximos-vista-N-abierto.png`.

Dos botones relevantes están sin scroll y los partidos plegados funcionan. «Preparar carrusel Axenda» y «Rellenar» parecen dos principales equivalentes; campos como «Escudo del part…» se recortan al abrir. El resumen vacío presenta 18:00 junto a «Sin fecha», que puede parecer dato real.

**Propuesta — M / alto:** principal «Crear axenda de esta semana» que rellena y lleva a revisión; secundario «Editar partidos». Resumen vacío «Sin partido elegido», hora solo cuando existe dato válido. Gana claridad de una acción; cuesta resolver preparación/errores parciales sin perder edición manual.

### Carteles — O noso 11

**Evidencia:** `carteles-noso11-N-inicial.png`, `carteles-noso11-vista-N-abierto.png`.

Fila de dorsal/nombre compacta, foto y suplentes plegados. Pero tres botones C/▲/▼ por titular restan espacio y se repiten once veces. Convive con Alineación, que ya tiene esos datos.

**Propuesta — L / alto:** elegir la alineación existente como origen; manual en alternativa, con reordenación en detalle o modo explícito. Gana una única verdad para el once y nombres más anchos; cuesta mantener actas históricas y borradores de alineación como fuentes distintas.

### Carteles — Multiusos / Anuncio

**Evidencia:** `carteles-multiusos-N-inicial.png`, `carteles-multiusos-vista-N-abierto.png`.

Título y texto sencillos, imágenes plegadas. «Visibilidad de activos» y selector con emojis cambian de registro respecto al resto. Predeterminado «¡CAMPIÓNS DA COPA!» puede confundirse con contenido real si se comparte sin editar.

**Propuesta — M / medio:** «Comunicado», ejemplos dentro del placeholder y tres intenciones claras: noticia, aviso y persona. Previa vacía con instrucción, no un triunfo escrito. Gana seguridad editorial; cuesta perder la gratificación instantánea del ejemplo ya lleno.

### Carteles — Clasificación / Copa

**Evidencia:** `carteles-clasificacion-N-inicial.png`, `carteles-clasificacion-vista-N-abierto.png`.

Carga automática de 14 equipos y destaque Santiso correctos. «Automático (BD) / Manual (Sin BD)» y «Se cargaron 14 equipos» cuentan implementación. Selector de lado del Santiso resulta ajeno a una tabla.

**Propuesta — S / medio:** «Desde la liga / Escribir tabla», resumen «Tercera · 14 equipos · Santiso 12.º» y quitar controles sin efecto editorial claro. Gana lenguaje comprensible; requiere confirmar qué opciones afectan realmente a esta plantilla.

### Importar

**Evidencia:** `importar-N-inicial.png`.

Una entrada para acta o jornada y hasta ocho capturas es mejor que bifurcar antes de saber contenido. Pero el control nativo se recorta («Ning…nado»), el recuadro punteado parece escritorio y el secundario «Acta a mano o corregir una guardada» es largo.

**Propuesta — M / alto:** área táctil «Añadir capturas» con cámara/galería y contador «0 de 8», miniaturas tras elegir y texto breve «¿Sin captura? Introducir a mano». Gana aspecto móvil y recorrido evidente; cuesta un control de archivos propio sin romper el selector nativo. No se auditó reconocimiento ni resultado de Gemini.

### Equipos y editor

**Evidencia:** `equipos-N-inicial.png`, `equipos-editor-N-abierto.png`.

Biblioteca/competición y búsqueda resuelven catálogo. Tres iconos por fila dejan nombres muy cortos; lápiz, − y X no explican relación con temporada/competición. «Escudo ya en 3D» es una explicación del motor gráfico. El editor tiene mucho espacio vacío.

**Propuesta — M / alto:** fila escudo/nombre + «En esta competición»; detalle con acciones «Editar equipo», «Quitar de competición», «Revisar baja». En editor, miniatura de un cartel con «Colores del rival» y opciones avanzadas de tratamiento plegadas. Gana semántica y revisión visual; cuesta un pequeño preview reutilizable y conservar advertencias sobre alcance global.

### Patrocinadores y logos

**Evidencia:** `patrocinadores-N-inicial.png`, `patrocinadores-editor-N-abierto.png`.

Lista única y orden real de la barra son útiles. «Sí/No» aislado no dice qué responde; lista y orden se presentan como dos bloques diferentes, con flechas y muchas cajas. El logo grande del editor no anticipa su tamaño pequeño en Instagram.

**Propuesta — M / medio:** estado «En cartel» visible, edición al tocar y una tira real de cinco logos para revisar orden/contraste. Mantener botones de subir/bajar como alternativa a arrastrar. Gana correspondencia con lo publicado; cuesta una representación fiel del footer, no solo miniaturas sueltas.

### Temporadas

**Evidencia:** `temporadas-N-inicial.png`.

Temporada activa se entiende; creación deshabilitada hasta completar dato es clara. Pero el alta está siempre delante y hay explicación extensa para una acción anual. El bloque oscuro/amarillo ocupa mucho para una sola temporada.

**Propuesta — S / bajo:** temporada activa, archivo si existe y «Crear temporada» como acción que abre hoja. Gana sencillez; cuesta un toque en la operación anual. No fingir historial que la base real ya no contiene.

### Ajustes gráficos

**Evidencia:** `ajustes-graficos-N-inicial.png`.

Origen de escudo en Equipos y aviso sobre exportaciones antiguas son información útil. Hay título repetido y mucha explicación, y cada logo ocupa una tarjeta muy alta antes de ver su efecto.

**Propuesta — M / medio:** miniatura del cartel arriba, lista corta «Cabecera / Pie / Escudo» y edición de cada recurso en hoja. Gana relación causa–resultado; cuesta reutilizar preview y probar variantes de formato. No convertir un cambio de logo en un constructor gráfico general.

### Menú Más y navegación

**Evidencia:** `menu-mas-N-abierto.png`.

Agrupación temática y destinos con texto son mejores que una parrilla de iconos sin etiquetas. Estado activo se reconoce. Pero convocatoria y alineación, tareas centrales del entrenador, viven bajo «Más», mientras Carteles ocupa un acceso fijo para todos. Las dos columnas con distinto número de elementos exigen recorrer varias zonas visuales.

**Propuesta — L / alto:** accesos frecuentes configurados por dispositivo y menú con tareas prioritarias primero, administración al final. Unificar «Jugadores/Cuerpo técnico/Directiva» bajo un bloque Plantilla sin esconder sus destinos. Gana alcance con pulgar; cuesta transición de navegación y conservar enlaces directos.

### Escritorio

Las cinco referencias de 1280 × 800 muestran que la coherencia no debe limitarse al móvil. Clasificación aprovecha bien columnas; Calendario conserva un modo eficiente de corrección, aunque bastante denso. Multas pone el formulario de alta antes del registro y retrasa lectura. Carteles puede mantener editor y previa en paralelo, con menos paneles anidados. Jornada tiene espacio para una mesa de trabajo excelente.

**Propuesta — M / medio:** aplicar misma jerarquía, tipografía y estados, con detalle lateral en escritorio; no estirar una hoja móvil sobre 1280 px. Se gana un sistema coherente; cuesta validar ambas composiciones, no copiar una sobre otra.

## 5. Carteles como piezas de Instagram

### Criterio común

La familia se reconoce: diagonales, negro, amarillo, titulares Anton y texto Barlow Condensed. El Santiso mantiene luz amarilla aunque el escudo lleve verde: acertado. Los fondos del rival ayudan a diferenciar encuentros.

Lo que rebajaría: halos muy amplios, escudos siempre con relieve, institucionales grandes al principio y demasiadas mayúsculas inclinadas en datos pequeños. La lectura no debe depender de ampliar la imagen. **Propuesta común — M / alto:** firma estable del club, una diagonal amarilla reconocible, máximo dos niveles de titulares y datos secundarios más sobrios; escudos con contraste según original, no un efecto uniforme. Mantener patrocinadores legibles y en zona fija.

Se capturó cada exportación final a 320 px de ancho y en miniatura de 120 px, mediante Playwright sobre la imagen, sin acceder a la aplicación. En miniatura basta reconocer tipo de pieza/club; a 320 deben leerse rival, fecha/hora o resultado y nombres relevantes. Resultado y Axenda conservan lo esencial; cronología y clasificación pierden mucho detalle. No exigiría leer toda una tabla a 120 px.

### Partido — publicación y historia

**Archivos:** `cartel-partido-1080-publicacion.png`, `cartel-partido-1080-historia.png`.

Funciona rival amarillo, hora fuerte, campo/localidad, puesto y forma reciente. Ya aporta más que la portada de Axenda. Fallan dos cosas: mucho espacio entre cabecera y nombres, y el escudo negro de Éter se pierde; «Tercera Futgal» y logos ocupan antes más atención que el rival. Los dos módulos de forma quedan pequeños a 320.

**Propuesta — M / alto:** rival y día/hora suben un nivel, cabecera institucional se compacta y escudos van en placas de contraste. Clasificación/forma en un bloque inferior de lectura tranquila, con etiqueta que explique V/E/D. Se gana impacto en feed; cuesta rebalancear ambas proporciones sin encoger todo en historia. Reservar zonas superior/inferior y comprobarlas con Instagram real.

### Próximos / Axenda — publicación e historia

**Archivos:** `cartel-proximos-1080-publicacion.png`, `cartel-proximos-1080-historia.png`.

Dos encuentros ocupan bien el alto; fecha y hora se leen antes que lo accesorio; Recesende y Éter tienen fondos distintos. «Próximos encontros» podría dejar paso a la marca corta «Axenda». La hora domina más que el rival, y no aparece un emblema propio del Santiso en la portada: se reconoce por estilo, no por una firma explícita. Historia tiene el error de «Hoxe» con dos días.

**Propuesta — M / alto:** título «AXENDA · 17–18 OUT», pequeña firma del club y categoría/rival/fecha como unidad compacta. Mantener hora grande. Para historias, separar sábado/domingo o titular «Esta fin de semana». Gana pertenencia y precisión; cuesta preparar otra lámina y controlar día de publicación.

### Resumo da Xornada / resultado

**Archivo:** `cartel-resumo-1080-publicacion.png`.

8–3 es inequívoco; gol del Santiso en amarillo y nombres del rival separados funcionan. El gran «XORNADA 2» dedica protagonismo a un número administrativo; los goleadores largos terminan en «GARCIA REY, ALEJA…» mientras hay bastante aire debajo. La fecha/campo al pie se vuelven minúsculos.

**Propuesta — M / alto:** «RESULTADO» como tipo, jornada pequeña; conservar marcador grande y dar nombres cortos revisables para publicación, sin perder identificación. Repartir mejor altura entre marcador, goleadores y pie. Gana lectura emocional/deportiva; cuesta revisar cómo abreviar personas del rival sin inventar apodos.

### Cronoloxía

**Archivo:** `cartel-cronoloxia-1080-publicacion.png`.

Línea central y minutos amarillos organizan bien hechos; goles, tarjetas y cambios se distinguen al ampliar. A ancho móvil, nombres y símbolos de cambios son muy pequeños; minutos repetidos producen una columna tupida. Una acta completa no es automáticamente una buena pieza social.

**Propuesta — L / alto:** primera lámina con resultado y goles; segunda con cambios/tarjetas o tramos del partido, con máximo de filas legibles por diseño. Mantener «Cronoloxía completa» como alternativa. Gana lectura y narrativa; cuesta un carrusel adicional y una regla editorial transparente sobre qué sale.

### O noso 11

**Archivos:** `cartel-noso11-1080-publicacion.png`, `cartel-noso11-1080-sin-foto-exportacion-inicial.png`.

La foto real de Ramos y la camiseta amarilla/negra aportan más identidad que cualquier degradado. Lista de titulares ordenada y capitán reconocible, pero a 320 px los nombres quedan demasiado pequeños frente a foto y dorsales. La foto disponible tiene resolución limitada al ampliarse y compite algo con institucionales; el nombre largo de Nicolás en suplentes deja «López» solo en otra línea. La alternativa de un escudo gigante ocupa mucho sin ofrecer información nueva. Ver recorte de exportación D6.

**Propuesta — M / alto:** plantilla con retrato de mayor resolución y corte limpio; nombres con un tamaño de partida de 42–48 px nominales, no solo dorsales grandes; suplentes en dos filas equilibradas. Si no hay foto, composición tipográfica de ancho completo con escudo pequeño, no el mismo hueco rellenado por un emblema enorme. Gana calidad con y sin recursos; cuesta preparar fotografía y dos composiciones verdaderas.

### Multiusos / comunicado

**Archivo:** `cartel-multiusos-1080-publicacion.png`. Las previas de pantalla muestran además el ejemplo predeterminado de celebración.

Título grande tiene fuerza. Pero el cuerpo queda muy pequeño para el espacio disponible, se pierden saltos de línea y «COMUNICADO OFICIAL» añade solemnidad a un simple próximo encuentro. El mismo molde puede sonar igual para un aviso médico y una celebración.

**Propuesta — M / alto:** comunicado con texto a 42–48 px nominales, párrafos claros y título menos enorme si hay contenido; celebración con foto; persona con retrato. En 320 px, el cuerpo resultaría alrededor de 12,5–14 px, punto de partida a validar. Gana adecuación al mensaje; cuesta tres variantes editorialmente distintas y límites de texto.

### Clasificación / Copa

**Archivo:** `cartel-clasificacion-1080-publicacion.png`.

Santiso amarillo se localiza de inmediato, todos los equipos y escudos caben y datos coinciden con la pantalla. Pero 14 filas × seis métricas producen una tabla que se reconoce más de lo que se lee en un móvil. Los puntos, pese a ser lo decisivo, quedan al extremo derecho.

**Propuesta — L / alto:** en pieza principal, posición/equipo/puntos y pocos datos; contexto del Santiso visible arriba. Tabla completa en segunda lámina o alternativa de detalle. Gana lectura; cuesta una exportación más y mantener la clasificación completa disponible para quien la quiere.

### Alineación — historia

**Archivo:** `cartel-alineacion-1080-historia.png`.

Lista vertical legible, capitán marcado, dorsal amarillo y espacio superior/inferior prudente. «ONCE INICIAL» ocupa bastante; un VS enorme compite con los jugadores. Los suplentes están en una sola línea mucho menor y el escudo de Éter casi desaparece.

**Propuesta — M / alto:** once primero, partido en cabecera menor, suplentes en dos líneas del mismo sistema y placa de escudos. Ganaría claridad inmediata; cuesta redistribuir la zona central manteniendo once nombres largos. Si se añade foto, no encoger la lista para acomodarla.

### Convocatoria — publicación

**Archivo:** `cartel-convocatoria-1080-publicacion.png`.

Dos columnas para 22 jugadores equilibran bien cantidad; dorsal y nombre son fáciles de asociar. La convocatoria parece de la misma familia que el once. A 320 px, nombres completos como Aitor Cuesta Loureiro y Nicolás Carbajales López se leen con dificultad. Fecha/campo tienen menos peso que el título, y no diferencia claramente cartel público de información privada de la quedada.

**Propuesta — M / alto:** versión pública con partido/lista y otra privada, elegida conscientemente, con hora/lugar/equipación. Permitir nombres de cartel revisados y dos líneas para nombres largos; con listas muy extensas, ofrecer dos láminas antes de reducir más letra. No trasladar automáticamente notas internas a Instagram. Gana lectura y claridad de destino; cuesta una decisión de publicación y comprobar cada dato incluido. No hace falta cambiar la identidad de la pieza.

## 6. Tres direcciones para pasar de correcta a espectacular

### A. Vestiario — herramienta rápida, identidad de camiseta

**Elección recomendada.** Grafito mate, amarillo del kit, tipografía local con pesos controlados; una diagonal corta como firma, no en cada panel. La app se organiza alrededor del partido y su preparación. Fotos reales en publicaciones seleccionadas; el resto puede funcionar perfectamente sin ellas.

**Qué implica:** tokens comunes, lista/ficha/hoja coherentes, accesos por dispositivo y rediseño de Jornada. Carteles con el mismo gesto de diagonal y menos efectos de relieve. **L, aproximadamente 6–9 jornadas de trabajo / impacto alto.**

**Ganancia:** calidad visible sin infraestructura nueva. **Riesgo/coste:** transición de navegación y resistencia de quien disfruta botones con mucho relieve; requiere probar el trabajo real de ambas personas.

Boceto conceptual de pantalla:

```text
┌─────────────────────────────────┐
│ SANTISO                  Senior │
│ Esta semana                     │
├──╱──────────────────────────────┤
│ Domingo 18 oct           17:00   │
│ Santiso · Atlético Éter         │
│ Municipal de Santiso · Casa     │
│                                 │
│ [ Preparar partido             ]│
│ Convocatoria  · revisar         │
│ Once          · 11/11           │
│ Cartel        · ver y compartir │
├─────────────────────────────────┤
│ Último: Berres 8–3 Santiso       │
│ Acta y publicaciones        ›   │
├─────────────────────────────────┤
│ Jornada   Convocar  Once   Más  │
└─────────────────────────────────┘
```

Boceto de cartel, texto en gallego:

```text
╱ UD SANTISO                logos
─────────────────────────────────
        ATLÉTICO ÉTER
       DOMINGO 18 OUT
           17:00
   [escudo S]     [escudo rival]
 NA CASA · MUNICIPAL DE SANTISO
─────────────────────────────────
  Xornada 3 · Tercera Futgal
  12.º / DD             11.º / DE
─────────────────────────────────
 [barra común de patrocinadores]
```

### B. Pizarra de campo — máxima lectura a plena luz

Fondo blanco deportivo `#F3F6FA`, tinta `#14202D`, amarillo `#F5C518`; geometría de ficha de partido y pizarra del entrenador. No una web corporativa blanca con tarjetas decorativas: el gesto propio es la banda amarilla que marca partido, dorsal o tarea activa. Mantener Outfit/Nunito en la app, Anton/Barlow en piezas.

**Qué implica:** escoger tema claro como principal para consulta y edición, probar campos a sol directo, jerarquía de agenda/ficha y tablas más limpias. Carteles pueden seguir negros; deben compartir marca, bandas y orden, no obligatoriamente fondo. **L, 8–12 jornadas / impacto alto.**

**Ganancia:** números, nombre y estado se leen con menos esfuerzo; más proximidad al cuaderno de trabajo del delegado. **Riesgo/coste:** puede perder carácter si se limpia demasiado; conservar un único tema dominante evita doblar todos los estados y pruebas en dos semanas.

Pantalla:

```text
┌─────────────────────────────────┐
│ ▌SANTISO · PLAN DE PARTIDO       │
│ 18 OCT · 17:00 · SENIOR          │
├─────────────────────────────────┤
│ Atlético Éter       Na casa     │
│ Municipal de Santiso            │
├─────────────────────────────────┤
│ PREPARACIÓN                     │
│ □ Revisar convocatoria      ›   │
│ ✓ Once inicial · 11         ›   │
│ □ Revisar cartel            ›   │
│                                 │
│ [ Continuar preparación       ] │
├─────────────────────────────────┤
│ Calendario · Club · Publicar · + │
└─────────────────────────────────┘
```

Cartel:

```text
┌─────────────────────────────────┐
│ ▌UD SANTISO              logos  │
│                                 │
│         18 OUTUBRO              │
│           17:00                 │
│                                 │
│ SANTISO       vs  ATLÉTICO ÉTER  │
│ [escudo]             [escudo]   │
│                                 │
│ MUNICIPAL DE SANTISO · NA CASA   │
│ ╱╱ banda de camiseta amarilla   │
├─────────────────────────────────┤
│ [patrocinadores]                │
└─────────────────────────────────┘
```

### C. Xente de fútbol — el club, no la plantilla, es protagonista

La foto de Ramos demuestra el camino: camiseta, persona, campo real. Una portada de Jornada con fotografía del Municipal y una tarjeta de partido sobria debajo; publicaciones con retratos o foto de grupo real, sin inventar escenas ni convertir cada alta en un fichaje épico.

**Qué implica:** seleccionar retratos coherentes, una sesión de equipo/campo, reglas de encuadre y fallback tipográfico que sea bonito cuando falte foto. Navegación por partido, plantilla y publicaciones. **L, 7–12 jornadas más una tarde de fotografía / impacto alto en identidad.**

**Ganancia:** Santiso se reconoce por su gente y su entorno, algo que una plantilla genérica no tiene. **Riesgo/coste:** originales actuales pequeños o inconsistentes; no debe exigir que el delegado sea fotógrafo cada semana. La herramienta debe seguir siendo útil sin una imagen nueva.

Pantalla:

```text
┌─────────────────────────────────┐
│ SANTISO                         │
│ ┌─────────────────────────────┐ │
│ │ foto real del Municipal     │ │
│ │ Domingo · 17:00 · Senior    │ │
│ └─────────────────────────────┘ │
│ Santiso — Atlético Éter         │
│ [ Preparar este partido       ] │
│                                 │
│ PLANTILLA                       │
│ [foto] Ramos     [foto] Iago SR  │
│ Convocatoria · Once · Multas    │
├─────────────────────────────────┤
│ Partido   Plantilla  Crear  Más │
└─────────────────────────────────┘
```

Cartel:

```text
┌─────────────────────────────────┐
│ UD SANTISO                logos │
│ ┌─────────────────┐             │
│ │ retrato real    │  O NOSO 11   │
│ │ camiseta       │  18 OUT      │
│ │ amarilla/negra │  17:00       │
│ │                │  vs ÉTER     │
│ └─────────────────┘             │
│ 2 Ramos · 3 Fury · 4 Iago SR C   │
│ ... lista sin reducir nombres   │
│ Suplentes en dos líneas         │
├─────────────────────────────────┤
│ [patrocinadores]                │
└─────────────────────────────────┘
```

No mezclaría las tres direcciones enteras. Escogería A, tomaría de B la claridad de tablas y de C una política realista de fotografía.

## 7. Si fuera mío: plan de dos semanas

Una persona implementando; delegado y entrenador revisan 15–20 minutos en días 2, 5 y 10. No es tiempo suficiente para rehacer las 20 pantallas y nueve productores a la vez.

| Día | Trabajo                                                                         | Entregable y criterio de aceptación                                                                                                     |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | D1 y D8: fuentes/herencia, revisión de guardados implícitos y de exportación D6 | Capturas de control con misma jerarquía en ambos motores; previsualizar no altera convocatoria sin intención clara                      |
| 2   | D2/D3/D4/D5/D7 y botones comunes                                                | Euros y etiquetas sin cortes; casillas 44 px; historia no llama hoy a dos fechas; texto conserva párrafos                               |
| 3   | Escala tipográfica, superficies y estados comunes de A                          | Jornada, Multas y Jugadores como muestra; una acción amarilla por contexto, selección reconocible sin color solo                        |
| 4   | Filas de personas/equipos y acciones peligrosas en detalle                      | Nombres completos recuperables; editar/quitar con significado visible; foto ausente con iniciales                                       |
| 5   | Prototipo funcional de Jornada y accesos del entrenador                         | Los dos usuarios completan preparación del próximo partido sin explicarles el menú; conservar rutas actuales                            |
| 6   | Cartel Partido y portada Axenda                                                 | Rival/fecha legibles a 320 px; firma del club; escudo negro contrastado; ambas proporciones revisadas                                   |
| 7   | Resultado y cronología editorial                                                | 8–3 y goleadores legibles; una variante de carrusel para muchos eventos; acta intacta                                                   |
| 8   | Alineación/O noso 11: fuente común, suplentes y foto real                       | Un mismo once produce publicación/historia; nombres largos sin recorte; alternativa sin foto bien compuesta                             |
| 9   | Hojas, estados y transiciones; seleccionar recursos gráficos                    | Foco retorna, acciones no quedan bajo barras/teclado; movimiento reducido respetado; previews de logos a tamaño real                    |
| 10  | Prueba física Android/iPhone, recorrido delegado/entrenador y cierre            | Sin defectos abiertos de lectura/guardado; validar Instagram sin publicar por accidente; medidas comparadas y pruebas apropiadas verdes |

**Dejaría para después:** tema claro completo, ficha visual de todas las personas, tabla social de clasificación en carrusel, perfiles de navegación más elaborados, renovación completa de Temporadas/Ajustes. Evitaría gastar el primer día en cambiar iconos o fabricar otro logo.

Criterios de éxito: una persona identifica tarea del día en dos segundos; toca controles sin precisión especial; lee nombres y dinero; sabe si guardó; la previa coincide con PNG; las piezas se reconocen como Santiso y se leen a ancho de móvil.

## 8. Inventario de evidencia

Carpeta: `data/informes/auditoria-diseno/`. En las filas siguientes, los estados con **N** tienen ambos archivos, con `360` y `390`. `inventario.json` guarda texto/medidas iniciales; `estados.json` recoge estados; `comprobaciones.json` contiene familias, áreas táctiles, movimiento y retorno de foco. Scripts de reproducción también están fuera de Git.

| Pantalla             | Primera pantalla Android               | Primera pantalla WebKit                | Estados adicionales                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jornada              | jornada-360-inicial.png                | jornada-390-inicial.png                | jornada-1280-inicial.png                                                                                                                                                                                                                                 |
| Calendario           | calendario-360-inicial.png             | calendario-390-inicial.png             | calendario-filtros-N-abierto.png; calendario-fila-N-abierto.png; calendario-1280-inicial.png                                                                                                                                                             |
| Calendario propio    | calendario-santiso-360-inicial.png     | calendario-santiso-390-inicial.png     | calendario-santiso-detalle-N-abierto.png; calendario-santiso-anteriores-N-abierto.png; calendario-santiso-390-chrome.png; calendario-santiso-360-webkit.png; controles adicionales calendario-santiso-360-chrome.png y calendario-santiso-390-webkit.png |
| Clasificación        | clasificacion-360-inicial.png          | clasificacion-390-inicial.png          | clasificacion-detalle-N-abierto.png; clasificacion-zonas-N-abierto.png; clasificacion-1280-inicial.png                                                                                                                                                   |
| Estadísticas         | estadisticas-360-inicial.png           | estadisticas-390-inicial.png           | estadisticas-filtros-N-abierto.png; estadisticas-ficha-N-abierto.png; estadisticas-N-vacio.png; estadisticas-N-error-simulado.png; estadisticas-ficha-360-carga.png                                                                                      |
| Jugadores            | jugadores-360-inicial.png              | jugadores-390-inicial.png              | jugadores-editor-N-abierto.png; jugadores-filtros-N-abierto.png                                                                                                                                                                                          |
| Técnicos             | tecnicos-360-inicial.png               | tecnicos-390-inicial.png               | tecnicos-editor-N-abierto.png                                                                                                                                                                                                                            |
| Directiva            | directiva-360-inicial.png              | directiva-390-inicial.png              | directiva-editor-N-abierto.png                                                                                                                                                                                                                           |
| Multas               | multas-360-inicial.png                 | multas-390-inicial.png                 | multas-bote-N-abierto.png; multas-normas-N-abierto.png; multas-nueva-N-abierto.png; multas-1280-inicial.png                                                                                                                                              |
| Convocatoria         | convocatoria-360-inicial.png           | convocatoria-390-inicial.png           | convocatoria-vista-N-abierto.png; convocatoria-360-carga.png                                                                                                                                                                                             |
| Alineación           | alineacion-360-inicial.png             | alineacion-390-inicial.png             | alineacion-vista-N-abierto.png; alineacion-360-carga.png                                                                                                                                                                                                 |
| Cartel Partido       | carteles-partido-360-inicial.png       | carteles-partido-390-inicial.png       | carteles-partido-manual-N-abierto.png; carteles-partido-vista-N-abierto.png; carteles-partido-1280-inicial.png                                                                                                                                           |
| Cartel Resumo        | carteles-resumo-360-inicial.png        | carteles-resumo-390-inicial.png        | carteles-resumo-vista-N-abierto.png                                                                                                                                                                                                                      |
| Cartel Cronoloxía    | carteles-cronoloxia-360-inicial.png    | carteles-cronoloxia-390-inicial.png    | carteles-cronoloxia-vista-N-abierto.png                                                                                                                                                                                                                  |
| Cartel Próximos      | carteles-proximos-360-inicial.png      | carteles-proximos-390-inicial.png      | carteles-proximos-fila-N-abierto.png; carteles-proximos-vista-N-abierto.png                                                                                                                                                                              |
| Cartel O noso 11     | carteles-noso11-360-inicial.png        | carteles-noso11-390-inicial.png        | carteles-noso11-vista-N-abierto.png                                                                                                                                                                                                                      |
| Cartel Anuncio       | carteles-multiusos-360-inicial.png     | carteles-multiusos-390-inicial.png     | carteles-multiusos-vista-N-abierto.png                                                                                                                                                                                                                   |
| Cartel Clasificación | carteles-clasificacion-360-inicial.png | carteles-clasificacion-390-inicial.png | carteles-clasificacion-vista-N-abierto.png                                                                                                                                                                                                               |
| Importar             | importar-360-inicial.png               | importar-390-inicial.png               | No se procesaron archivos ni se activó Gemini                                                                                                                                                                                                            |
| Equipos              | equipos-360-inicial.png                | equipos-390-inicial.png                | equipos-editor-N-abierto.png                                                                                                                                                                                                                             |
| Patrocinadores       | patrocinadores-360-inicial.png         | patrocinadores-390-inicial.png         | patrocinadores-editor-N-abierto.png                                                                                                                                                                                                                      |
| Temporadas           | temporadas-360-inicial.png             | temporadas-390-inicial.png             | No se creó temporada                                                                                                                                                                                                                                     |
| Ajustes gráficos     | ajustes-graficos-360-inicial.png       | ajustes-graficos-390-inicial.png       | No se cambiaron imágenes                                                                                                                                                                                                                                 |
| Más                  | —                                      | —                                      | menu-mas-360-abierto.png; menu-mas-390-abierto.png                                                                                                                                                                                                       |

| Pieza         | Publicación 4:5                           | Historia 9:16                                         |
| ------------- | ----------------------------------------- | ----------------------------------------------------- |
| Partido       | cartel-partido-1080-publicacion.png       | cartel-partido-1080-historia.png                      |
| Próximos      | cartel-proximos-1080-publicacion.png      | cartel-proximos-1080-historia.png                     |
| Resumo        | cartel-resumo-1080-publicacion.png        | No disponible en este productor                       |
| Cronoloxía    | cartel-cronoloxia-1080-publicacion.png    | No disponible                                         |
| O noso 11     | cartel-noso11-1080-publicacion.png        | No disponible; Alineación es el productor de historia |
| Anuncio       | cartel-multiusos-1080-publicacion.png     | No disponible                                         |
| Clasificación | cartel-clasificacion-1080-publicacion.png | No disponible                                         |
| Convocatoria  | cartel-convocatoria-1080-publicacion.png  | No disponible                                         |
| Alineación    | No disponible                             | cartel-alineacion-1080-historia.png                   |

Muestras adicionales: `cartel-noso11-1080-sin-foto-exportacion-inicial.png` y `cartel-clasificacion-1080-exportacion-inicial.png`. La segunda conserva un control de exportación inicial, no constituye por sí sola un defecto. Datos de la muestra con foto: `noso11-datos-reales.json`; foto original utilizada: `recurso-noso11-foto.webp`.

Cada archivo final de la tabla de piezas tiene dos capturas adicionales: se sustituye `1080` por `120` o `320` y se añade `-miniatura` antes de `.png`. Por ejemplo: `cartel-partido-120-publicacion-miniatura.png`, `cartel-partido-320-publicacion-miniatura.png`, `cartel-alineacion-120-historia-miniatura.png` y `cartel-alineacion-320-historia-miniatura.png`. Las once piezas/formato cuentan con ambas vistas; son los 22 PNG adicionales.

### Incidencia de solo lectura

A las **01:47:48 del 12/10/2026, hora de Madrid**, el botón «Ver cartel» creó una convocatoria del Senior contra Atlético Éter porque la página tenía `persistida=false`. La UI inicial mostraba los 22 jugadores seleccionados; no se editaron quedada, equipación ni nota. Fue un error del procedimiento de auditoría: debí comprobar el efecto del botón antes de pulsarlo.

La fila afectada es `partido_convocatorias.partido_id = 18b787a2-f5b5-4889-a35c-9fc3a67b323a`, con 22 asociaciones en `partido_convocados`. Creación y actualización coinciden: `2026-10-11T23:47:48.293Z`; campos de quedada/equipación/nota vacíos. La comprobación final de lectura confirmó que esa marca de actualización no cambió después.

Se detuvo el recorrido y las siguientes previsualizaciones de Convocatoria/Alineación se condicionaron a que Guardar estuviera deshabilitado, evitando nuevos guardados implícitos. **No borré ni restauré esa fila**, para no realizar otra modificación de datos sin una instrucción de corrección. La incidencia se comunicó durante el trabajo. El informe no debe utilizarse como certificación de una ejecución completamente de solo lectura.

No se modificó código de la aplicación. El único archivo que entra en el commit es este informe.
