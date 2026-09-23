# Fase 8A — Rediseño de Actas

> Ejecutar por tareas y registrar pruebas/commits. Alcance aprobado expresamente por el usuario: presentación de Actas individual y lote. Rama aislada codex/fase-8a-actas desde main 8a62181. No fusionar a main.

## Objetivo y límites

Reutilizar foundation y tokens --ui-* en AdminActaImporter y AdminActaBatch. Sustituir styled-jsx, estilos en línea, controles sin etiqueta y clases globales antiguas por componentes accesibles y CSS Modules. Mantener lectura PDF, Gemini, OCR y guardado existentes: la retirada de OCR y cambios de comportamiento no pertenecen a este encargo visual.

No tocar packages/actas/**, lib/actas/**, acciones de servidor de actas, lib/cartel*, components/admin/cartel/**, components/admin/estadisticas/**, lib/estadisticas/** ni lib/server/consultas/estadisticas-jugadores.ts. No esquema, rutas/API nuevas, migraciones ni escrituras en datos reales. Conservar props públicas y contratos.

## Diseño

- Encabezados, secciones y acciones coherentes con 6B/6D/6E; colores, tipografía, espaciado y bordes con tokens --ui-*.
- Field/Select/Textarea para todos los campos, incluidas alineaciones y eventos dinámicos. Nombre accesible distintivo por jugador/evento; un campo por etiqueta. Botones foundation con texto o aria-label inequívoco.
- Selección de archivo accesible por teclado y con etiqueta asociada; conservar aceptar PDF/imágenes y comportamiento de detección. Caída de archivos si ya existía.
- Categoría, competición y partido conservan sus estados y handlers. No implementar selector de temporada ni alterar correspondencias.
- Mantener edición de marcadores, campo/población, titulares/suplentes, tipo/minuto/equipo de evento, cambios, propia y texto OCR.
- Revisión del lote mediante Dialog foundation, con foco atrapado, Escape/cierre y bloqueo mientras guarda. Tamaño responsive mediante clase del diálogo si API lo permite, sin cambiar foundation compartido salvo bloqueo demostrado.
- Lista de lote: estado textual por archivo, progreso mediante elemento progress o clases estáticas, acciones procesar/detener/revisar conservadas. No cambiar reglas de guardado automático ni reintento en 8A. Aclarar texto de detener según conducta existente.
- Diseño 360px sin overflow; filas complejas se apilan. No ocultar controles esenciales en móvil. prefers-reduced-motion respetado por CSS.
- Mantener avisos y confirmaciones existentes. Mejoras estrictamente visuales de estados cargando/error permitidas sin cambiar contratos de servidor.

## Archivos

- Modificar apps/studio/components/admin/AdminActaImporter.tsx.
- Modificar apps/studio/components/admin/AdminActaBatch.tsx.
- Crear apps/studio/components/admin/actas/ActaImporter.module.css y ActaBatch.module.css: módulos separados por pantalla para evitar dependencias accidentales. Mismo sistema de tokens, sin duplicar primitives foundation.
- Crear apps/studio/e2e/actas.spec.ts para comprobaciones de lectura y accesibilidad.
- Actualizar expectativas de e2e existentes solo si cambian nombres accesibles; nunca eliminar pruebas para lograr verde.
- Este plan y registro de cierre.

## T1 — Importación individual

- [ ] Leer APIs foundation Button, Fields, Dialog, States, PageHeader y tokens. Leer guía Next local pertinente.
- [ ] Sustituir JSX de presentación conservando hooks, transformaciones y handlers. Extraer estilos a módulo; eliminar todos los bloques style jsx y atributos style.
- [ ] Migrar campos a Field/Select/Textarea; ningún label suelto, input-group, btn-primary/btn-secondary ni card glass en el archivo.
- [ ] Dar etiquetas a controles de LineupEditor y EventEditor y nombres a eliminar/toggle. Mantener opción de propia y selección de jugador que entra/sale.
- [ ] Revisar responsividad y estados deshabilitados. Sin cambios de parser/acciones.
- [ ] Typecheck, ESLint/Prettier dirigidos. Commit después de check y e2e correspondientes.

## T2 — Lote y revisión

- [ ] Migrar listado, archivo múltiple, estados, contadores y acciones a foundation/CSS Module.
- [ ] Migrar ReviewPanel a Dialog, preservando destino, borrador y funciones de guardado. No cerrar mientras saving; foco vuelve al botón revisar.
- [ ] Migrar LineupEditor/EventEditor y controles de datos a foundation. Evitar etiquetas duplicadas dentro de una misma fila.
- [ ] Sustituir colores dinámicos inline por data-status/data-side o clases estáticas, barra inline por progress nativo.
- [ ] Mantener callDetect/callAnalyze, correspondencias y processAll. No cambiar orden de eventos o semántica de guardado.
- [ ] Typecheck, ESLint/Prettier dirigidos. Commit después de check y e2e correspondientes.

## T3 — Verificación y entrega

- [ ] E2E solo lectura: abrir Actas, categoría/competición/partido etiquetados; alternar individual/lote; seleccionar partido disponible, abrir edición manual, añadir/quitar titular/suplente/evento sin guardar; controles asociados.
- [ ] Comprobar 360 y 1280px sin desbordamiento, tabulación y captures de ambas pantallas. No activar Gemini ni guardar en BD real. Para panel de revisión del lote, fixture de respuesta de lectura ficticia o prueba en BD temporal, nunca dejar guardado automático alcanzar datos reales.
- [ ] Auditar fuentes con búsqueda: cero styled-jsx, style={...}, input-group y labels sueltos en dos pantallas. Revisar diff de lógica antes/después.
- [ ] pnpm check. ESLint/Prettier explícitos de cada TSX/CSS/test de Studio tocado.
- [ ] pnpm e2e contra base real en solo lectura, apuntando SANTISO_DATA_DIR al data original sin copiar .env.local ni datos. Servidor propio, nunca matar procesos de Claude/usuario.
- [ ] Si resulta necesaria escritura, usar e2e-escritura y BD temporal; sin datos reales.
- [ ] Registrar resultados, commits y limitaciones aquí. Rama limpia, sin merge a main ni despliegue.

## Registro

Plan previo a implementación. T1–T3 pendientes. Base 8a62181. No cambiar requisitos de negocio a partir del rediseño.
