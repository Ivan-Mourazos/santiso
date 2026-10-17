# Auditoría técnica — UD Santiso Studio

Fecha: 17/10/2026. Revisión: `5098373693d1b9d3d8c41b7fe26a7fa38d7e2aed`. Alcance: código del repositorio, configuración y pruebas aisladas. No se auditó el despliegue de `santiso-estable` ni su configuración de Tailscale.

## Conclusión

Base técnica razonable para un club: dominio separado, restricciones SQL, transacciones en operaciones importantes, control de sesión central y pruebas abundantes. Prioridad inmediata: recuperar **BD y fotos**, cerrar carrera de creación del primer administrador, limitar red del renderizador y corregir guardado de actas con marcador vacío.

No se ha encontrado una escalada directa de un técnico autenticado a las acciones administrativas revisadas. Sí se ha reproducido una carrera de alta pública durante la inicialización y hay procesamiento de PDF sin sesión. La autorización de acceso funciona mejor que algunas validaciones de pertenencia a temporada/categoría.

Verificación: `e2e:acceso` **10/10**, `e2e:escritura` **55/55**. `pnpm check` **no pasa**: 4 fallos de Vitest en 3 archivos; esos archivos pasan después, **42/42**, ejecutados con un trabajador. No confundir esta repetición con un `check` completo en verde.

### Método y límites

- Leídos `AGENTS.md` y especificación `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`; esta última describe decisiones históricas, no sustituye al código vigente. La autenticación actual difiere de la retirada de login prevista originalmente.
- Descubrimiento con `codebase-memory-mcp`: arquitectura, símbolos, llamadas, complejidad y búsquedas. Contraste de evidencias y líneas con archivos actuales; grafo no tratado como prueba suficiente de vigencia.
- Inventariados los seis `route.ts`, acciones de `lib/server/acciones`, acción de contexto, esquema, migraciones, acceso, media, renderizador y programadores. Revisión por rutas de riesgo; no equivale a prueba exhaustiva de todas las combinaciones de entrada.
- **No se abrió, consultó ni modificó `data/` real.** Pruebas de escritura/acceso usaron carpetas temporales. Ensayos SQL adicionales usaron `:memory:`. No se inició `pnpm dev` ni se ejecutó `pnpm e2e` contra datos reales. No se hicieron peticiones a futgal.es ni a APIs del modelo.
- Se revisaron únicamente nombres de variables de `.env.local`, sin imprimir ni copiar sus valores. No se realizó análisis de CVE, auditoría de historial completo de secretos ni ensayo sobre Tailscale.
- No se modificó código, rama ni historial Git. Las verificaciones autorizadas generan cachés/salidas de prueba ignoradas. `debug.log` aparecía sin versionar en la primera observación de Git; se dejó intacto. Informe UX de otro trabajador también se dejó intacto.
- **VERIFICADO**: comprobado en código actual o mediante ensayo descrito. **HIPOTESIS**: consecuencia condicionada o escenario no reproducido. Un hallazgo verificado por lectura no implica explotación HTTP demostrada.
- Severidades: **crítica** exige compromiso grave demostrado; **alta**, pérdida de datos o capacidad sensible; **media**, integridad, disponibilidad o mantenimiento relevante; **baja**, coste limitado/endurecimiento. No se asignan críticas con la evidencia disponible. Esfuerzo: **S** cambio localizado; **M** varios módulos y regresiones; **L** rediseño por etapas.

## 1. Arquitectura y organización

| Capa | Responsabilidad y evidencia |
| --- | --- |
| `packages/domain` | Reglas puras, normalización, clasificación y estadísticas. Ejemplo: `packages/domain/src/normalizar.ts:130`. |
| `packages/db` | Esquema Drizzle, cliente libSQL, migraciones, rutas y copias. `packages/db/src/client.ts:20`, `packages/db/src/migraciones.ts:14`. |
| `packages/actas` | Lectura local de PDF y adaptadores federativos; reutilizado en acciones y sincronización. `apps/studio/lib/server/acciones/fichas.ts:3`. |
| `lib/server/consultas` | Lecturas y DTO para pantallas. `apps/studio/lib/server/consultas/estadisticas-jugadores.ts:33`. |
| `lib/server/acciones` | Frontera RPC de Next: validación, permisos y escrituras. SQL se ejecuta directamente aquí; ejemplo transaccional: `apps/studio/lib/server/acciones/actas.ts:131`. |
| App Router | Layout con sesión, APIs IA, exportación PNG, media. `apps/studio/app/admin/layout.tsx:13`, `apps/studio/app/api/carteles/png/route.ts:19`. |
| Cliente | Secciones dinámicas, estado contextual y formularios; motor `cartel2` compartido con página de captura. `apps/studio/components/studio/StudioSection.tsx:12`, `apps/studio/app/render/cartel/page.tsx:19`. |
| Tareas locales | `instrumentation` inicia programadores; `comoSistema` usa contexto asíncrono restringido a tareas internas. `apps/studio/instrumentation.ts:2`, `apps/studio/lib/server/db.ts:15`. |
| Migración histórica | Supabase queda en herramienta separada. Lectura de sus credenciales: `tools/migracion-supabase/src/supabase/cliente.ts:20`. |

Límites positivos comprobados: módulos de infraestructura usan `server-only`; sesión se comprueba al entregar BD; UI importa acciones, no credenciales; secciones pesadas se cargan con `dynamic`. OCR y HEIC tienen importación diferida (`apps/studio/components/admin/AdminActaImporter.tsx:528`, `apps/studio/lib/imagen-cliente.ts:15`). No se ha medido tamaño de bundles mediante build.

Para el tamaño actual no hace falta añadir un repositorio genérico encima de cada CRUD. Conviene extraer servicios concretos compartidos: guardado del acta, validación de participantes y cliente del modelo. El problema es repetición y volumen de responsabilidad, no ausencia de capas nominales.

## 2. Calidad y mantenibilidad

### H01 — Importación concentra demasiado estado y responsabilidades

**Media · VERIFICADO · Esfuerzo L.** Fuentes: `apps/studio/components/admin/AdminActaImporter.tsx:252`, `apps/studio/components/admin/AdminActaBatch.tsx:759`, `apps/studio/components/admin/importar/ImportarFoto.tsx:90`.

Evidencia: archivos de 1.236, 1.118 y 524 líneas, respectivamente, contando línea final vacía. Individual reúne selección de competición, lectura, OCR, borrador, revisión y guardado; lote incorpora además cola y modal. Grafo atribuye a `AdminActaImporter` complejidad ciclomática 52 y cognitiva 70; son métricas orientativas, no defectos funcionales por sí mismas.

Arreglo: extraer adaptadores de lectura, máquina de estados de importación, revisión del borrador y guardado común; conservar pruebas de sustituciones, propia puerta y lote. Hacerlo por flujo, sin reescribir simultáneamente toda la pantalla.

### H02 — Orquestación Gemini duplicada y acoplada a prompts

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/app/api/admin/jornada-gemini/route.ts:51`, `apps/studio/app/api/admin/jornada-gemini/route.ts:163`, `apps/studio/app/api/admin/acta-gemini/route.ts:479`, `apps/studio/app/api/admin/acta-detect/route.ts:68`.

Evidencia: listado/selección de modelos, peticiones, fallback y tratamiento de errores se repiten; detección mantiene otra lista. `acta-gemini/route.ts` tiene 572 líneas. Jornada consulta modelos disponibles antes de intentar los preferidos y sus `fetch` no tienen `AbortSignal`; una llamada lenta puede retener toda la operación.

Arreglo: cliente servidor común con timeout total y por intento, lista de modelos acotada/cacheada, errores saneados y política única de reintento; separar prompts y esquemas de cada tarea. No reintentar indefinidamente errores de contenido o cuota.

## 3. Datos y base de datos

Fortalezas verificadas: `foreign_keys=ON`, WAL y espera de bloqueo de 5 segundos (`packages/db/src/client.ts:27`). Unicidad parcial para una sola temporada activa (`packages/db/src/schema/competicion.ts:24`), marcador completo/no negativo/finalizado (`packages/db/src/schema/calendario.ts:89`), FK y cascadas explícitas. Actas, convocatoria y alineación sustituyen datos en transacción. Estadísticas usan transacción de lectura explícita (`apps/studio/lib/server/consultas/estadisticas-jugadores.ts:156`). Las 20 migraciones SQL se aplicaron también a una BD en memoria durante esta auditoría; no se comparó esquema de BD real.

### H03 — Un partido no garantiza pertenencia ni exclusividad por jornada

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `packages/db/src/schema/calendario.ts:64`, `packages/db/src/schema/calendario.ts:84`, `apps/studio/lib/server/acciones/calendario.ts:145`, `apps/studio/lib/server/acciones/calendario.ts:244`, `apps/studio/lib/server/acciones/equipos.ts:155`.

Evidencia: FK comprueba existencia de equipos, no inscripción en competición ni categoría. Único `(jornada, local, visitante)` impide duplicar un cruce exacto, pero no que un equipo tenga dos rivales. `crearPartido` consulta ocupados antes de insertar, fuera de transacción; importación de jornada no tiene esa comprobación. Inscribir un equipo tampoco contrasta categoría.

Reproducción: 20 migraciones, `PRAGMA foreign_keys=ON`, competición Senior; SQLite aceptó Senior–Veteranos y otro partido del mismo Senior en esa jornada. Control con equipo inexistente fue rechazado por FK. Esto demuestra hueco del esquema; no demuestra que UI normal lo produzca espontáneamente.

Arreglo: servicio transaccional que valide inscripción/categoría y ocupación también para importaciones. Si regla es universal, reforzar exclusividad con tabla de participantes de partido y único `(jornada_id,equipo_id)` o disparadores documentados. Definir antes excepciones legítimas.

### H04 — Alineación y acta aceptan jugadores existentes de otro ámbito

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/acciones/alineacion.ts:47`, `apps/studio/lib/server/acciones/actas.ts:115`, `apps/studio/lib/server/acciones/actas.ts:147`, `packages/db/src/schema/partido.ts:22`.

Evidencia: alineación consulta `jugadores`, no su inscripción; acta comprueba que partido exista y FK comprueba jugador, sin cruzar temporada/categoría. Un ID válido ajeno al ámbito supera esas comprobaciones. En cambio convocatoria ya valida el vínculo correcto (`apps/studio/lib/server/acciones/convocatoria.ts:52`). No es una escalada de rol: es integridad deportiva insuficiente en operaciones permitidas.

Arreglo: reutilizar validación de convocatoria y verificar que partido pertenece al club. Para actas históricas, admitir explícitamente inscripción en temporada del partido o un flujo documentado de alta, evitando rechazar historial legítimo.

### H05 — Normalización incompleta en nuevas escrituras

**Media · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acciones/jugadores.ts:59`, `apps/studio/lib/server/acciones/jugadores.ts:92`, `apps/studio/lib/server/acciones/staff.ts:44`, `apps/studio/lib/server/acciones/competiciones.ts:35`; reglas: `packages/domain/src/normalizar.ts:172`, `packages/domain/src/normalizar.ts:178`.

Evidencia: personas y competiciones guardan `trim()` sin `normalizarNombrePersona`/`normalizarNombreCompeticion`. Una competición con «Gr. 3» puede convivir con variante «Grupo 3» porque único usa nombre literal. Equipos, campos y temporadas sí aplican sus normalizadores (`acciones/equipos.ts:71`, `acciones/campos.ts:26`, `acciones/temporadas.ts:21`).

Arreglo: normalizar en frontera servidor antes de buscar e insertar/actualizar. Añadir casos mayúsculas, espacios y «Gr.»; tratar posibles duplicados existentes mediante herramienta revisable, sin limpieza automática de datos reales.

### H06 — Faltan índices auxiliares; no hay prueba de lentitud actual

**Baja · VERIFICADO · Esfuerzo S.** Fuentes: `packages/db/src/schema/partido.ts:54`, `packages/db/src/schema/partido.ts:61`, `packages/db/src/schema/calendario.ts:78`, `packages/db/src/schema/acceso.ts:40`, `apps/studio/lib/server/acceso/sesion.ts:88`.

Evidencia: `EXPLAIN QUERY PLAN` sobre esquema migrado en memoria devuelve `SCAN partido_eventos` para `jugador_id`, `SCAN partidos` para `campo_id` y `SCAN sesiones` al eliminar caducadas. Eventos solo indexan `(partido,minuto)`; sesión indexa usuario. No toda FK exige índice para este volumen, y la consulta principal de estadísticas filtra por partidos, no solamente jugador.

Arreglo: valorar índices sobre `partido_eventos(jugador_id)`, `jugador_sale_id`, `partidos(campo_id)` y `sesiones(expira_en)` cuando se utilicen esos accesos o crezca el volumen. Medir con datos sintéticos representativos antes de añadir todos; prioridad inferior a integridad.

## 4. Validación de entradas y ficheros

Path traversal clásico está defendido: `resolverRutaMedia` rechaza segmentos vacíos, `.`/`..`, separadores, unidad Windows y nulo, y comprueba ruta relativa (`apps/studio/lib/server/media.ts:39`). MIME servido tiene lista cerrada y excluye SVG (`media.ts:12`, `media.ts:51`). Subidas persistidas usan UUID y sharp; imágenes de formulario comprueban tipo y 15 MiB (`media.ts:219`). No se ha demostrado escape mediante enlaces simbólicos; requeriría control previo del disco, fuera del alcance remoto observado.

### H07 — Lectura de PDF antes de autenticar

**Media · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acciones/fichas.ts:34`, `apps/studio/lib/server/acciones/calendario-pdf.ts:82`, `apps/studio/lib/server/acciones/calendario-pdf.ts:94`, `apps/studio/proxy.ts:11`.

Evidencia: `leerFichaPdf` nunca llama a `exigirSesion` ni toca BD; procesa hasta 15 MiB. Calendario parsea primero y solo después consulta BD. Cookie arbitraria supera comprobación superficial de proxy; además `/entrar` está permitido. Las acciones son entradas independientes según documentación Next instalada. No se ha efectuado ataque HTTP ni prueba de agotamiento.

Arreglo: `await exigirSesion()` como primer paso de ambas acciones, antes de leer bytes o ejecutar parser. Añadir prueba con acceso activo y sesión ausente/inventada que confirme que parser no llega a ejecutarse. No hay evidencia aquí de lectura de información privada ni escritura sin sesión.

### H08 — APIs IA no validan completamente multipart ni JSON entrante

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/app/api/admin/acta-gemini/route.ts:502`, `apps/studio/app/api/admin/acta-gemini/route.ts:515`, `apps/studio/app/api/admin/jornada-gemini/route.ts:221`, `apps/studio/app/api/admin/jornada-gemini/route.ts:232`, `apps/studio/app/api/admin/acta-detect/route.ts:21`.

Evidencia: seleccionan `File` y recortan con `slice`, sin límite explícito por archivo/tamaño total ni lista de MIME en estos handlers. Convierten archivos a base64 en paralelo. `JSON.parse` de `match/jugadores/campos/equipos` queda fuera del bloque que devuelve error controlado; `as Tipo` no valida ejecución. El límite de Server Actions de 16 MB no es un validador de estos route handlers; proxy tiene otro límite de buffer de 64 MB (`apps/studio/next.config.ts:15`). No se midió límite HTTP efectivo completo.

Reproducción aislada del handler de jornada, sesión simulada y clave ficticia: `equipos="{"` genera excepción no capturada `SyntaxError: JSON Parse error: Expected '}'`, antes de cualquier `fetch`.

Arreglo: analizar multipart con errores 400/413, rechazar exceso de capturas en vez de descartarlas silenciosamente, validar tamaños/MIME y esquemas Zod de metadatos, y limitar concurrencia. No devolver detalle interno del proveedor sin saneado.

### H09 — Respuestas de IA se aceptan por cast y tolerancia parcial

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/app/api/admin/acta-detect/route.ts:113`, `apps/studio/app/api/admin/jornada-gemini/route.ts:266`, `apps/studio/app/api/admin/acta-gemini/route.ts:556`.

Evidencia: JSON del modelo pasa por `JSON.parse` y casts; no por esquema completo de respuesta. Jornada solo comprueba si `partidos` es array antes de deduplicar. Un JSON sintácticamente correcto puede incumplir tipos/estructura; éxito del proveedor no garantiza borrador útil. El guardado posterior tiene validaciones parciales, pero no sustituye validar esta frontera.

Arreglo: esquemas independientes para detección, jornada y acta; límites de filas/texto y rechazo de campos esenciales incoherentes. Conservar revisión humana y probar respuestas vacías, tipos incorrectos y estructuras inesperadas con `fetch` simulado.

### H10 — Plan de calendario del cliente es autoridad de escritura

**Media · VERIFICADO · Esfuerzo M.** Fuente: `apps/studio/lib/server/acciones/calendario-pdf.ts:150`.

Evidencia: acción recibe `PlanImportacion` ya calculado y usa directamente `jornadasNuevas` e IDs de cruces; no analiza esquema ni vuelve a contrastar participantes con competición. Un cliente puede modificar el plan. FK impide IDs inexistentes, pero no inconsistencias descritas en H03. Se valida la sesión al abrir BD; no es escritura anónima.

Arreglo: esquema acotado de petición y recálculo/validación servidor dentro de transacción. El estado «nuevo» debe derivarse del estado actual de BD, no de etiqueta enviada por navegador. Revisar categoría/inscripción de todos los IDs.

## 5. Seguridad y permisos

### Controles comprobados

| Control | Resultado observado |
| --- | --- |
| Contraseñas | scrypt asíncrono, sal aleatoria de 16 bytes, derivada de 64, comparación `timingSafeEqual`; nunca contraseña en tabla. `apps/studio/lib/acceso/claves.ts:7`. |
| Sesiones | Token aleatorio de 32 bytes, SHA-256 en BD, 30 días, usuario activo y expiración comprobados por consulta. `claves.ts:33`, `apps/studio/lib/server/acceso/sesion.ts:23`, `sesion.ts:43`. |
| Cookies | `httpOnly`, `sameSite=lax`, caducidad; `secure` depende de cabecera de proxy. `sesion.ts:93`. |
| BD | `obtenerDb` pasa por sesión; `obtenerDbSinControl` se usa en acceso y pantalla de entrada. `apps/studio/lib/server/db.ts:31`, `db.ts:51`. No se encontró otro acceso directo a libSQL desde acciones de usuario revisadas. |
| Sistema | `comoSistema` usa `AsyncLocalStorage`; llamadas de producción observadas en programadores de copia y RFGF, no envolviendo acciones de usuario. `db.ts:21`, `apps/studio/lib/server/rfgf/programador.ts:29`. |
| APIs/media | Los seis handlers inventariados comprueban `respuestaSinSesion`; estado y media verifican cookie real, no solo presencia. `apps/studio/app/api/estado/route.ts:7`, `apps/studio/app/media/[...clave]/route.ts:22`. |
| Administrador | Usuarios usan `exigirAdmin`; temporadas, competiciones/reglas, ajustes gráficos, borrar equipo, enlace RFGF y ciclo de amarillas usan `soloAdmin`. `acciones/acceso.ts:95`, `acciones/temporadas.ts:17`, `acciones/competiciones.ts:33`, `acciones/ajustes-cartel.ts:51`, `acciones/equipos.ts:194`, `acciones/rfgf.ts:121`, `acciones/liga.ts:21`. |
| Técnico | Actas, multas, carteles, plantilla y gestión diaria permitidos; ocultar menú no se considera control suficiente. Acciones administrativas anteriores tienen comprobación propia. `packages/db/src/schema/acceso.ts:5`. |
| CSRF en acciones | Documentación local Next 16.3.5 describe POST y contraste Origin/Host o X-Forwarded-Host; no hay `allowedOrigins` amplio en configuración. `apps/studio/node_modules/next/dist/docs/01-app/02-guides/server-actions.md:78`, `apps/studio/next.config.ts:11`. No se añade un falso hallazgo de «falta token CSRF». No se ensayó proxy real. |

`proxy.ts` es barrera superficial por diseño y no autentica cookie inventada. Layout, acceso a BD y handlers proporcionan la barrera efectiva. Su ausencia en parser de PDF es H07. En las acciones administrativas inventariadas no se encontró una omisión concreta de `soloAdmin/exigirAdmin`; esto no certifica autorización de cada futura acción ni equivale a una matriz exhaustiva de pruebas.

### H11 — Dos primeros administradores mediante carrera pública

**Alta · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acciones/acceso.ts:72`, `apps/studio/lib/server/acciones/acceso.ts:79`, `apps/studio/lib/server/acceso/usuarios.ts:35`, `apps/studio/lib/server/acceso/usuarios.ts:58`.

Evidencia: `hayUsuarios` y creación no están en la misma transacción. Dos solicitudes con nombres diferentes pueden leer cero antes de insertar; único de nombre no impide dos administradores.

Reproducción: código actual transpilado en proceso aislado, Drizzle y scrypt reales, 20 migraciones en `:memory:`; conexión sustituida por esa BD y `abrirSesion` simulado para evitar Next/cookies. `Promise.all` con `adminuno` y `admindos` devolvió dos éxitos y tabla contenía ambos con rol `admin`. No se accedió al servidor estable. **Precondición:** BD sin usuarios; con usuarios existentes comprobación sí bloquea y hay prueba de ello. No implica que hoy se pueda registrar otro administrador sobre instalación ya inicializada.

Arreglo: calcular hash fuera del bloqueo; comprobar ausencia e insertar dentro de transacción de escritura que serialice el arranque, o usar una fila única de inicialización. Crear primer administrador antes de exponer acceso compartido y cubrir dos solicitudes concurrentes.

### H12 — Chromium puede cargar URLs arbitrarias de imágenes

**Alta · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/cartel2/esquema.ts:16`, `apps/studio/lib/cartel2/esquema.ts:29`, `apps/studio/components/cartel2/Base.tsx:48`, `apps/studio/components/cartel2/Escudo.tsx:92`, `apps/studio/lib/server/cartel2/render.ts:39`.

Evidencia: imagen es una cadena con límite de longitud, no una URL permitida; logos también son texto. Componentes usan valores en `img`/`Image`. Contexto Playwright no intercepta ni bloquea destinos externos. Ensayo de `leerPeticion` con `escudo="http://127.0.0.1:1/probe"` devolvió petición válida, sin abrir navegador ni realizar esa conexión.

Consecuencia inferida del flujo: usuario autenticado —incluido técnico— puede hacer que navegador ejecutado en PC intente GET a red interna/externa. Es superficie de SSRF (petición desde servidor), no ejecución JavaScript demostrada ni lectura arbitraria de cualquier respuesta; CORS no impide intentar cargar una imagen. No se ensayó extracción de información ni servicios internos.

Arreglo: validar solo `/media/` y recursos locales previstos, más `data:` de imágenes con tipos/límites expresos; rechazar protocolos/hosts arbitrarios. Añadir defensa en contexto Playwright que permita exclusivamente origen local y recursos de imagen admitidos, incluida redirección. Fijar origen del render desde configuración local, sin confiar en Host entrante cuando no exista `PORT` (`apps/studio/app/api/carteles/png/route.ts:13`).

### H13 — Freno de login limitado por usuario, sin barrido global ni reserva concurrente

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/acceso/intentos.ts:16`, `apps/studio/lib/acceso/intentos.ts:28`, `apps/studio/lib/server/acciones/acceso.ts:46`.

Evidencia: cinco fallos por nombre durante 15 minutos; mapa vive en memoria. Caducados solo se borran al volver a usar esa misma clave. Nombres arbitrarios generan registros ilimitados, y varios intentos simultáneos pueden consultar espera antes de que terminen comprobaciones scrypt. Reiniciar borra el freno; comportamiento documentado en código.

Arreglo: límite global y por identidad/origen de confianza, tamaño máximo y barrido de mapa, reserva de intentos antes de trabajo caro; acotar usuario y contraseña antes de scrypt. Mantener mensajes genéricos y proteger contra bloqueo malicioso de un usuario conocido. No se ejecutó prueba de carga.

### H14 — Cambio de contraseña y revocación no son atómicos

**Media · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acceso/usuarios.ts:97`, `apps/studio/lib/server/acceso/usuarios.ts:103`, `apps/studio/lib/server/acceso/usuarios.ts:119`.

Evidencia: actualización de hash y borrado de sesiones son sentencias separadas sin transacción. Activación comprueba otros administradores, actualiza y borra sesiones también en pasos separados. **Consecuencia HIPOTESIS no inyectada:** error entre hash y revocación deja sesiones anteriores válidas; dos administradores desactivándose mutuamente podrían superar comprobación de «queda otro».

Arreglo: una transacción para actualización y revocación; comprobación del último administrador dentro de transacción de escritura. Mantener excepción explícita para sesión propia conservada. Probar fallo intermedio y concurrencia.

### H15 — Confianza en cabeceras de proxy y endurecimiento no comprobados en despliegue

**Baja · HIPOTESIS · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acceso/sesion.ts:93`, `apps/studio/proxy.ts:22`, `apps/studio/next.config.ts:3`.

Evidencia de código: cookie `secure` depende de `x-forwarded-proto`; redirección usa `x-forwarded-host`/protocolo. Configuración Next no declara CSP, `frame-ancestors` ni política de referencia. Se desconoce qué añade o sanea Tailscale; no hay explotación demostrada y escucha en loopback reduce exposición directa.

Arreglo: comprobar en copia estable qué cabeceras fija el proxy y documentar esa frontera; usar origen configurado si se necesita redirección externa. Añadir cabeceras compatibles con render, fuentes y `data:`; no introducir CSP a ciegas que rompa carteles. Verificar cookie `Secure` por acceso HTTPS real.

### H16 — Variable de privilegio Supabase permanece en entorno de Studio

**Baja · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/.env.local:7`, `apps/studio/.env.example:15`, `tools/migracion-supabase/src/supabase/cliente.ts:20`.

Evidencia: `.env.local` declara `SUPABASE_SERVICE_ROLE_KEY`; solo se inspeccionó nombre de variable, no vigencia/validez del valor. Uso de credencial en código observado queda en herramienta migradora; modelo usa `GEMINI_API_KEY` solo en rutas servidor. `.env.local` no está versionado y `.gitignore` excluye entornos. No se halló una clave del modelo exportada al cliente en referencias examinadas.

Arreglo: si migración terminó, retirar credencial antigua del entorno habitual y revocarla donde corresponda; si sigue siendo necesaria, aislarla en entorno de herramienta. No hay evidencia para afirmar filtración, ni se auditó historial de Git completo.

## 6. Errores funcionales probables o reproducidos

### H17 — Vaciar marcador de acta finaliza partido como 0–0

**Alta · VERIFICADO · Esfuerzo S.** Fuentes: `apps/studio/lib/server/acciones/actas.ts:95`, `apps/studio/lib/server/acciones/actas.ts:134`, `apps/studio/components/admin/AdminActaImporter.tsx:855`, `apps/studio/components/admin/AdminActaImporter.tsx:676`.

Evidencia: `Number("")` y `Number(" ")` son cero y superan validación de entero no negativo. Campos de edición pueden quedar vacíos; guardado envía borrador sin comprobación equivalente de presencia. Después se finaliza partido y se sustituyen participaciones/eventos.

Reproducción aislada de acción y transformaciones actuales, con persistencia espía: marcadores `""`, titulares/suplentes/eventos vacíos devolvieron `{ok:true,datos:null}` y actualización `{golesLocal:0,golesVisitante:0,estado:"finalizado"}`. Ensayo verifica lógica de acción, no interfaz HTTP ni una escritura SQL real.

Arreglo: exigir texto no vacío y formato de entero antes de convertir, con máximo razonable; definir si un acta sin participantes puede finalizar partido. Rechazar entrada sin modificar marcador ni acta anterior; cubrir cadena vacía, espacios y un solo marcador.

### H18 — Importación informa inserciones que pudieron ser conflictos

**Baja · VERIFICADO · Esfuerzo S.** Fuente: `apps/studio/lib/server/acciones/calendario-pdf.ts:197`.

Evidencia: inserta con `onConflictDoNothing` y devuelve `partidos: filas.length`. Jornadas se cuentan por existencia final, no por inserción en esa ejecución. Reenviar un mismo plan antiguo puede informar altas aunque índices hayan impedido todas. Las pruebas recalculan plan en caso normal y comprueban conservación de resultados, pero no exigen contador real tras plan obsoleto (`apps/studio/lib/server/acciones/calendario-pdf.test.ts:158`).

Arreglo: usar `returning` y contar filas realmente insertadas, distinguiendo creadas/existentes/omitidas. Mantener idempotencia y mensaje exacto en reintentos.

### H19 — Ediciones simultáneas pueden pisarse sin aviso

**Media · HIPOTESIS · Esfuerzo M.** Fuentes: `apps/studio/lib/server/acciones/jugadores.ts:53`, `apps/studio/lib/server/acciones/jugadores.ts:100`, `apps/studio/lib/server/acciones/actas.ts:142`, `packages/db/src/schema/comunes.ts:15`.

Evidencia de código: formularios reenvían filas completas; actualización filtra por ID, sin versión o `actualizadoEn` esperado. Transacción hace atómica una sustitución, pero no detecta que otro usuario guardó después de abrir el formulario. No se reprodujo interacción simultánea.

Arreglo: control optimista en fichas y actas con versión/fecha esperada, mensaje de conflicto y recarga del borrador. Priorizar pantallas con edición larga sobre cambios simples de estado. No añadir bloqueos permanentes de pantalla.

## 7. Rendimiento

### H20 — Exportaciones PNG sin cola ni límite concurrente

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/cartel2/render.ts:12`, `apps/studio/lib/server/cartel2/render.ts:39`, `apps/studio/lib/server/cartel2/render.ts:53`.

Evidencia: reutiliza Chromium correctamente y cierra cada contexto en `finally`, pero cada petición crea otro contexto de resolución doble sin semáforo. Esperas de 30 segundos no acotan cantidad concurrente. Fallo/desconexión del navegador se recupera en siguiente exportación. No se midieron memoria ni latencia bajo carga.

Arreglo: cola de una o dos exportaciones, límite de espera/cancelación y métricas sencillas de duración/fallos. Compartir navegador sigue siendo adecuado; no hace falta servicio distribuido para este club.

### H21 — Normalizar imagen materializa RGBA completo y recorre píxeles en JavaScript

**Media · VERIFICADO · Esfuerzo M.** Fuente: `apps/studio/lib/server/media.ts:66`.

Evidencia: antes de reducir a 1200/2400 se convierte imagen original a raw y recorre ancho × alto con dos bucles síncronos. Límite de 15 MiB comprimidos no equivale a límite pequeño de píxeles/memoria; se depende además del límite predeterminado de sharp. Ese bucle ocupa hilo principal. No se ejecutó imagen de agotamiento ni benchmark.

Arreglo: límite explícito de dimensiones/píxeles antes de raw, concurrencia pequeña y recorte nativo o procesamiento fuera del hilo principal si sigue siendo costoso. Preservar umbral alfa, margen y transparencia mediante regresiones existentes.

### H22 — Variantes de media se recalculan en cada petición

**Baja · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/app/media/[...clave]/route.ts:29`, `apps/studio/app/media/[...clave]/route.ts:33`, `apps/studio/lib/server/media.ts:203`.

Evidencia: ruta lee fichero entero, transforma `?ancho`/`?recorte` con sharp y responde `no-cache`; no hay ETag propio ni caché de variantes en esta implementación. Anchos sí están acotados a 480/1080/2160. Con fotos repetidas entre vista previa y carteles aumenta trabajo; coste no medido.

Arreglo: variantes por clave UUID y transformación, con caché acotada/limpiable; respuesta privada y revalidación compatible con revocar sesión. No convertir media autenticada en caché pública para ganar rendimiento.

### H23 — Previa de varios carteles repite consultas por partido

**Baja · VERIFICADO · Esfuerzo S.** Fuente: `apps/studio/lib/server/consultas/previa-cartel.ts:41`.

Evidencia: una consulta inicial más dos consultas por partido propio: anteriores de su competición e inscritos (`previa-cartel.ts:44`, `previa-cartel.ts:77`). Se recalcula clasificación aunque varios elegidos compartan competición. Es patrón N+1 comprobado; no evidencia de lentitud perceptible con dos equipos.

Arreglo: agrupar consultas por competición en esa petición, cargar una vez y calcular corte temporal por encuentro. Evitar caché global sin invalidación. Jornada ya agrupa parte de sus lecturas por IDs y deduplica competiciones (`apps/studio/lib/server/consultas/jornada.ts:132`, `jornada.ts:214`).

Bundles: secciones, Tesseract y conversor HEIC diferidos son decisiones positivas. No hay medición para afirmar bundle excesivo ni motivo para eliminar `<img>` del motor de captura: allí sirve al render exacto. Programador RFGF se evalúa en apartado 9.

## 8. Pruebas y verificación ejecutada

### Cobertura observada

| Suite | Qué cubre según código y ejecución |
| --- | --- |
| Vitest | 118 archivos: dominio (10), BD (8), parsers (12), lógica/servidor Studio (69), rutas (2), migración (17). Expande casos parametrizados: 867 casos en `check`. Cubre FK, migraciones, normalización, rollback de acta con jugador inexistente, CRUD, convocatoria, sincronización con descargador simulado, sesiones y claves. |
| `e2e` | 31 archivos de solo lectura; pantallas, navegación, carteles, estadísticas, calendario y móvil. Chromium escritorio, WebKit móvil y Chromium Android configurados. Inspeccionada, **no ejecutada** por restricción de datos reales. `apps/studio/playwright.config.ts:13`. |
| `e2e:escritura` | 14 archivos; 55 casos ejecutados sobre BD temporal: CRUD, calendario/importación, convocatorias/alineación, multas, patrocinadores, historial y gestión móvil. Servidor propio 3111. `apps/studio/playwright.escritura.config.ts:21`. |
| `e2e:acceso` | 10 casos ejecutados: sin sesión, cookie inventada, primer administrador, alta de técnico, secciones/menús por rol, móvil, PNG con sesión de técnico, cambio de contraseña/salida, revocación y freno de login. Servidor propio 3112. `apps/studio/e2e-acceso/acceso.spec.ts:27`. |

No se calculó porcentaje de cobertura de líneas/ramas; número de pruebas no prueba completitud.

### H24 — Puerta `pnpm check` presenta fallos por tiempo y contaminación posterior

**Media · VERIFICADO · Esfuerzo S.** Fuentes: `vitest.config.ts:13`, `apps/studio/lib/server/acceso/sesion.test.ts:70`, `apps/studio/lib/server/acciones/calendario.test.ts:68`, `apps/studio/lib/server/rfgf/sincronizar.test.ts:181`.

Evidencia real: tres casos excedieron 5000 ms; caso posterior de sesión obtuvo cookie `"inventada"` en lugar de `undefined`. Ese valor se asigna al final del caso anterior (`sesion.test.ts:83`). Los tres archivos pasan completos con `--maxWorkers=1`. **HIPOTESIS de causa:** saturación en ejecución paralela más continuación asíncrona de caso que ya agotó timeout; no se demostró un fallo real de autenticación de producto.

Arreglo: ajustar concurrencia al PC/CI y separar preparación costosa del tiempo del caso; aislar estado de navegador/conexión entre pruebas y no dejar tareas vivas al fallar. No subir timeout global sin investigar ni declarar verde una puerta que falló.

### H25 — Huecos de pruebas en fronteras de mayor riesgo

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/acceso/sesion.test.ts:128`, `apps/studio/e2e-acceso/acceso.spec.ts:104`, `apps/studio/lib/server/acciones/actas.test.ts:235`, `apps/studio/lib/server/acciones/fichas.test.ts:23`, `vitest.config.ts:17`.

Evidencia: pruebas de acceso comprueban muestra de acciones administrativas y menú, no matriz completa de todas ellas; altas iniciales se prueban secuencialmente. Prueba de marcador rechaza «dos», no vacío. Fichas prueba lectura/error/formulario sin contexto autenticado. Solo estado y media tienen `route.test.ts`; las tres APIs IA no tienen suite de ruta equivalente en inventario.

Arreglo prioritario: primera alta concurrente; cada acción administrativa con técnico/cookie inventada; PDFs sin sesión antes del parser; marcadores vacíos conservando datos previos; jugadores/equipos de otro ámbito; JSON/MIME/tamaño y respuesta IA malformada; bloqueo de URLs del render; fallo entre hash y revocación; restauración de BD y media. Todo con datos sintéticos y proveedor/red simulados.

### H26 — Aislamiento de banderas incompleto en configuración de E2E

**Media · HIPOTESIS · Esfuerzo S.** Fuentes: `apps/studio/playwright.escritura.config.ts:26`, `apps/studio/playwright.config.ts:40`, `apps/studio/instrumentation.ts:5`, `apps/studio/lib/server/rfgf/programador.ts:25`.

Evidencia de código: suite de acceso fuerza sincronización/copias apagadas; escritura solo fuerza directorios de datos y suite de lectura no fuerza esas banderas. Si se hereda `STUDIO_RFGF_AUTO=1`, servidor de pruebas podría sincronizar; suite de lectura podría escribir indirectamente en BD real. Con acceso heredado activo, suite de escritura puede fallar por pantalla de login. No se reprodujo ese escenario ni se ejecutó suite real.

Arreglo: fijar explícitamente acceso y tareas de fondo en cada configuración según finalidad, sin depender de shell/`.env.local`; rechazar directorio real en suites que escriben. En esta auditoría las banderas se apagaron expresamente en entorno de los comandos.

### Comandos y resultados reales

| Comando/ensayo | Resultado |
| --- | --- |
| `git rev-parse HEAD`, `git status --short`, inventario/búsquedas locales | Revisión indicada; sin cambios a código. Informe UX y `debug.log` ajenos a edición de esta auditoría. |
| Inspección `Get-CimInstance Win32_Process` antes de E2E | Sin otro `next dev`. Proceso estable observado: `next start` en carpeta `santiso-estable`, puerto 3100; no se detuvo ni se consultó su BD. |
| `pnpm check` | **Código 1**, 124,820 s totales. Superó typecheck, lint y formato porque cadena llegó a Vitest. Vitest: **3 archivos fallidos, 115 pasados; 4 casos fallidos, 862 pasados, 1 omitido**, 26,94 s. |
| `pnpm exec vitest run apps/studio/lib/server/acceso/sesion.test.ts apps/studio/lib/server/acciones/calendario.test.ts apps/studio/lib/server/rfgf/sincronizar.test.ts --maxWorkers=1` | **Código 0**, **3 archivos / 42 casos pasados**, 10,10 s de Vitest; 11,036 s de comando. |
| `pnpm e2e:acceso` | **Código 0**, **10 pasados**, 1,1 min; 71,412 s de comando. Entorno de comando: `STUDIO_RFGF_AUTO=''`, `STUDIO_COPIA_DIARIA=''`; config fija acceso y directorio temporal. |
| `pnpm e2e:escritura` | **Código 0**, **55 pasados**, 3,1 min; 189,189 s de comando. Entorno de comando: `STUDIO_ACCESO=''`, `STUDIO_RFGF_AUTO=''`, `STUDIO_COPIA_DIARIA=''`; directorio temporal de config. |
| SQL libSQL en `:memory:` | Aplicadas 20 migraciones; FK activada y control negativo rechazado; aceptados cruces incompatibles de H03. `EXPLAIN` produjo los tres `SCAN` de H06. No se escribió fichero de BD. |
| Acción de primer administrador, código transpilado + Drizzle/scrypt en memoria | Dos éxitos y dos filas `admin`; conexión y cookie sustituidas por dobles descritos en H11. |
| Acción de acta, código transpilado + persistencia espía | Marcadores vacíos aceptados como 0–0 finalizado; H17. |
| Handler de jornada IA, sesión simulada y clave ficticia | JSON inválido lanzó excepción antes de red; H08. |
| Esquema Zod de cartel actual | URL de imagen `http://127.0.0.1:1/probe` aceptada; **no se visitó**; H12. |

Errores de `check`, literalmente:

```text
FAIL apps/studio/lib/server/acceso/sesion.test.ts:70
Error: Test timed out in 5000ms.
FAIL apps/studio/lib/server/acceso/sesion.test.ts:93
AssertionError: expected 'inventada' to be undefined
FAIL apps/studio/lib/server/acciones/calendario.test.ts:68
Error: Test timed out in 5000ms.
FAIL apps/studio/lib/server/rfgf/sincronizar.test.ts:181
Error: Test timed out in 5000ms.
```

El caso omitido requiere originales privados mediante `CALENDARIO_PDFS_PRIVADOS` (`packages/actas/src/calendario.test.ts:253`); no se activó. También aparecieron avisos `Warning: Indexing all PDF objects` en pruebas que rechazan PDFs inválidos. Primer intento de loader sintético de autenticación no resolvió `@libsql/client` desde paquete Studio; repetido con resolución del paquete DB, produjo resultado H11. Primer intento de consulta Orca desde sandbox no leyó metadatos; consulta local con permisos adecuados funcionó. Dos intentos de `pnpm exec prettier --check docs/audits/2026-10-17-auditoria-tecnica.md` desde shell directo terminaron en código 1: `"node" no se reconoce como un comando interno o externo`; ese entorno difiere del que ejecutó las suites. Ninguno de esos intentos se contabiliza como prueba superada.

La repetición de comprobación de formato desde entorno de pruebas terminó en código 0, pero `docs` está en `.prettierignore`: ese éxito no valida estilo del informe. Un script de aceptación comprobó los nueve apartados, los 30 hallazgos con severidad/estado/esfuerzo/fuente y 143 referencias completas a ficheros y líneas existentes; además se revisaron manualmente tablas y cierre con top 10.

## 9. Escalabilidad y mantenimiento operativo

### H27 — Copia diaria y manual de BD no incluyen media

**Alta · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/copias.ts:18`, `packages/db/src/backup.ts:7`, `packages/db/src/cli/backup.ts:11`.

Evidencia: ambos flujos llaman a `VACUUM INTO` y conservan fichero `.db`; no copian `media/`. Copia diaria conserva 14 y evita repetir día. Restaurar únicamente estas copias devuelve referencias a fotos/escudos que pueden haberse perdido. No se ha borrado nada ni se ha ensayado restauración sobre datos reales. Especificación ya preveía ampliar copia a media (`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md:184`).

Arreglo: paquete de recuperación con BD consistente, media referenciada y manifiesto/versiones; verificación en carpeta temporal y retención. Priorizar ensayo de restauración completo frente a añadir más frecuencia de copias incompletas. Copia externa con protección de datos personales y credenciales separadas.

### H28 — Recuperación ante pérdida del PC no acreditada

**Media · HIPOTESIS · Esfuerzo M.** Fuentes: `packages/db/src/rutas.ts:23`, `apps/studio/lib/server/programador-copias.ts:18`, `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md:185`.

Evidencia: destino predeterminado es carpeta del mismo conjunto de datos; programador solo funciona mientras servidor está activo y bandera habilitada. No se inspeccionó si usuario sincroniza fuera del PC ni si hay tarea del sistema que supervise proceso. No se afirma que falte copia externa existente.

Arreglo: acreditar recuperación en otro directorio/equipo, documentar arranque, migración, navegador Playwright, variables y secretos; registrar última copia válida y avisar de antigüedad. Mantener modelo local; no se justifica migrar a nube solo por crecer de uno a dos usuarios. Una BD sigue siendo adecuada; varios procesos escritores/programadores requieren coordinación adicional.

### H29 — Pasada fallida se registra como comprobada para cadencia diaria

**Media · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/rfgf/sincronizar.ts:534`, `apps/studio/lib/server/rfgf/sincronizar.ts:574`, `apps/studio/lib/server/rfgf/sincronizar.ts:627`, `apps/studio/lib/server/rfgf/programador.ts:29`.

Evidencia: errores se acumulan por jornada, pero al final se actualizan `comprobadoEn` y, si procede, `horariosEn`; programador decide con última comprobación global. Así un intento con errores puede consumir cadencia como si se hubiera completado. Una competición recién enlazada también comparte referencia global. No se hicieron solicitudes reales ni se observó una pérdida concreta de datos.

Arreglo: separar `ultimoIntento` de `ultimoExito` y programar por competición/tipo de trabajo; reintento limitado con pausa creciente, conservando avisos. El objetivo es no dejar información antigua un día por un fallo transitorio, sin aumentar ráfagas.

Controles positivos de scraping: lista de hosts HTTPS futgal.es y redirecciones manuales revalidadas; pausa 1,5 s, timeout 25 s y máximo de seis saltos (`apps/studio/lib/server/rfgf/descargador.ts:12`). Límite de respuesta de 15 MiB se comprueba **después** de materializar cuerpo (`descargador.ts:58`), por lo que no es límite preventivo de memoria. Sincronización usa exclusión en módulo (`sincronizar.ts:587`), no bloqueo entre procesos; histórico se ejecuta aparte (`programador.ts:49`). Si se amplía a más procesos o trabajos simultáneos, compartir cola/cadencia y limitar lectura de respuesta en streaming. La fragilidad frente a cambios de HTML/PDF permanece; conservar fixtures anonimizadas y pruebas de contrato sin sondeo intensivo del sitio.

### H30 — Media sin referencias crece y complica recuperación

**Baja · VERIFICADO · Esfuerzo M.** Fuentes: `apps/studio/lib/server/media.ts:124`, `apps/studio/lib/server/acciones/jugadores.ts:86`, `apps/studio/lib/server/acciones/fotos-partido.ts:82`, `apps/studio/lib/server/acciones/fotos-partido.ts:116`.

Evidencia: se guarda fichero antes del commit de ficha/foto; fallo de BD deja archivo sin referencia. Sustituir foto deja anterior y quitar foto de partido borra fila pero conserva fichero deliberadamente. No se midieron archivos huérfanos porque `data/` quedó fuera de lectura.

Arreglo: manifiesto de referencias y limpieza con periodo de gracia, modo simulación e informe, después de disponer de copia completa. Compensar archivos nuevos cuando transacción falla. No borrar inmediatamente imágenes antiguas: pueden pertenecer a copias históricas o carteles.

## Top 10 técnico priorizado

| Orden | Entrega concreta | Motivo | Hallazgos | Esfuerzo |
| --- | --- | --- | --- | --- |
| 1 | Copia recuperable de BD + media y restauración sintética documentada | Evitar pérdida definitiva del trabajo del club | H27, H28 | M |
| 2 | Serializar creación del primer administrador y probar dos altas concurrentes | Carrera pública reproducida, condicionada a instalación vacía | H11 | S |
| 3 | Permitir solo imágenes locales/data válidas y bloquear red arbitraria de Chromium | Navegador del PC acepta destinos elegidos por cliente | H12 | M |
| 4 | Rechazar marcadores de acta vacíos conservando datos anteriores | Corrupción silenciosa reproducida: 0–0 finalizado | H17 | S |
| 5 | Validación transaccional común de categoría, temporada, inscripción y ocupación | FK actuales no expresan estas reglas deportivas | H03, H04, H10 | M |
| 6 | Exigir sesión antes de parsear PDFs | Cerrar operación costosa que evita barrera central | H07 | S |
| 7 | Esquemas de entradas/salidas IA, tamaños y timeout total compartido | Errores controlados y disponibilidad con proveedor variable | H02, H08, H09 | M |
| 8 | Transacción en cambio de clave/revocación y límites globales de login | Evitar estados de acceso parciales y trabajo caro sin cota | H13, H14 | M |
| 9 | Estabilizar puerta de pruebas y ampliar regresiones de seguridad | `check` falló; E2E verdes no cubren carreras ni entradas hostiles | H24, H25, H26 | M |
| 10 | Aplicar normalizadores en personas y competiciones al guardar | Corrección localizada que previene divergencia y duplicados | H05 | S |

Después: cola de render y límite de píxeles (H20–H21), separación gradual de importadores (H01), recuperación/reintentos federativos (H29), caché de variantes y agrupación de lecturas (H22–H23). Prioridad de estas optimizaciones debe confirmarse con medidas locales, sin pruebas de carga contra futgal.es ni BD real.
