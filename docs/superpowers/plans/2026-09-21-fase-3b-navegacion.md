# Fase 3B — Shell y navegación

**Objetivo:** navegar por rutas conservando contexto deportivo y borradores; integrar base visual 3A sin rehacer importadores de Claude.
**Base:** 686a326 integrado en codex/base-visual. Referencias: data/referencias/antes-fase-3 (checkout principal).
**Arquitectura:** layout persistente de /admin, catálogo tipado de secciones, proveedor de navegación y guardia, paneles existentes cargados bajo ruta dinámica validada. Componentes separados de acciones de datos.

## Límites de colaboración

No editar AdminCalendarioPdf, AdminJornadaImporter, AdminActaImporter/Batch, parsers, motor de carteles ni acciones de servidor. Toda prueba de escritura usa copia SQLite y media del worktree. No modificar checkout de Claude ni sus commits. React Compiler no se activa globalmente mientras los paneles heredados conserven styled-jsx; esa retirada necesita validación visual por componente y no se mezcla con este corte de navegación.

## Tareas

- [x] Modelo URL en lib/navigation: categoría exclusivamente Senior/Veteranos; plantilla de cartel validada; rutas por Calendario, Clasificación, Jugadores, Cuerpo técnico, Directiva, Carteles, Actas, Importar jornada, Equipos, Patrocinadores, Temporadas, Ajustes gráficos. Pruebas unitarias de valores inválidos y conservación de contexto.
- [x] StudioContext: navegación guardada, beforeunload y atrás/adelante, registro explícito de borradores, confirmaciones asíncronas, toasts persistentes. Nunca limpiar borrador por texto de toast.
- [x] StudioShell CSS Modules: menú por Competición/Plantilla/Producción/Catálogos/Ajustes, salto al contenido, menú móvil modal, categoría separada de Directiva, fuentes locales del shell sin retirar todavía fuentes literales del canvas.
- [x] Rutas y sección: /admin redirige a /admin/calendario; /admin/cartel conserva acceso al generador con redirección a /admin/carteles. Ruta desconocida devuelve 404. Recuperar contexto desde searchParams.
- [x] Integrar registro de borradores en jugadores, staff, sponsors, equipos, temporadas y calendario; conservar cambios tras errores y no confundir filtros con edición.
- [x] Temporada/competición/jornada en URL; consulta de temporada no activa otra en BD. Validar IDs antes de usar y conservar selección al recargar.
- [x] Adaptar e2e al menú nuevo. Pruebas de recarga, historial, Directiva→Calendario, borradores y móvil. Mantener pruebas de importadores existentes con cambios de navegación solamente.
- [x] pnpm check, e2e sobre copia aislada, build y revisión independiente. Registrar límites restantes para pantallas Fase6 y retirada de styled-jsx.

## Verificación y traspaso (2026-09-21)

- `pnpm check`: 60 suites, 458 pruebas correctas, una omitida; tipos, lint raíz y formato correctos.
- Playwright Chromium: 23 pruebas correctas, con copia SQLite/media del worktree y puerto 3110.
- `pnpm build`: correcto; 12 rutas de sección y 404 para secciones desconocidas.
- Revisión independiente: tres hallazgos corregidos y cubiertos por regresiones (normalización inicial, categoría del importador PDF, enlace a sección actual).
- Consulta nueva `lib/server/contexto-studio.ts`: solo lectura, incluye temporadas históricas sin activar ninguna. Las acciones existentes no se modificaron.
- Capturas del menú revisadas a 360 y 390 px en los resultados ignorados de Playwright.

## Pendiente fuera de este bloque

- Fase 6: rediseñar contenido interior de paneles sobre componentes 3A. Los paneles conservan estilos heredados; no se ha declarado accesibilidad completa de su contenido.
- Retirar styled-jsx y validar React Compiler por componente; todavía no se activa globalmente.
- Completar sustitución de Google Fonts para consumidores que usan nombres literales en canvas; el shell usa fuentes locales.
- Integrar registro de borradores en importadores, carteles y ajustes gráficos al trabajar sus pantallas con sus responsables. La guardia actual cubre jugadores, staff/directiva, patrocinadores, equipos, temporadas y calendario.
- Historial validado en Chromium con Navigation API. Fallback popstate necesita prueba específica en navegadores sin esa API.
- Guardado de partido conserva borradores y comunica fallos, pero las tres acciones existentes siguen siendo independientes; atomicidad corresponde a una futura acción transaccional coordinada con responsable de datos.
- Rama aislada: no se fusionó ni publicó; checkout principal y datos reales intactos.
