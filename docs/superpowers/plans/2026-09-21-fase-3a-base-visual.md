# Fase 3A — Base visual aislada

> Ejecución: componentes independientes con revisión e integración en esta sesión.

**Objetivo:** preparar componentes accesibles reutilizables, sin cambiar el panel actual.
**Arquitectura:** CSS Modules y tokens bajo un contenedor explícito. Fuentes locales solo en la galería de pruebas; consumidores actuales intactos. Interacciones cliente separadas de presentación.
**Stack:** React y Next instalados, TypeScript, Playwright existente; sin nuevas dependencias.
**Spec:** ../specs/2026-09-13-santiso-studio-local-first.md; límites en ../traspasos/2026-09-21-fase-3a-astra.md.

## Restricciones

No modificar admin, rutas actuales, globals, layout, configuración compartida, catálogos, lockfile, DB ni render de carteles. Mantener amarillo #facc15 y paleta existente. No importar la base en producción hasta 3B. Fuentes locales no sustituyen todavía familias literales del canvas. Sin datos personales ni secretos en pruebas.

## Entregables y validación

- [x] `styles/tokens.module.css`: variables de marca, superficies, texto, tamaño, espaciado, radios y movimiento, limitadas a `.theme`.
- [x] `styles/fonts.ts` y `app/fonts/`: Outfit y Nunito locales con licencias, variables CSS; sin conexión al layout actual.
- [x] `components/ui/foundation/Button.tsx`, `Fields.tsx`, `DataTable.tsx`, `PageHeader.tsx`, `States.tsx`: controles nativos, label/id y descripción/error enlazados, botón pendiente bloqueado, tabla con caption y scroll local.
- [x] `Dialog.tsx`, `ConfirmDialog.tsx`, `Tabs.tsx`, `Toast.tsx`: modal nativo, Escape y retorno de foco, confirmación segura, pestañas por teclado, avisos persistentes accesibles.
- [x] Galería independiente en `test/ui/fixture`, sin rutas ni acceso a datos de producción. Pruebas en `test/ui/*.spec.ts` y configuración específica.
- [x] Probar asociación de etiquetas y errores, bloqueo durante guardado, foco de diálogo, confirmaciones, selección de pestañas y movilidad a 360/390 px. Ejecutar pruebas de navegador antes y después de implementar; comprobar fallos por ausencia de funcionalidad.
- [x] Ejecutar `pnpm check`, ESLint sobre archivos nuevos y Playwright específico. Revisar capturas de galería. Documentar límites y comandos de integración.

## Criterios de aceptación

Controles utilizables por teclado; foco visible; mensajes de error asociados; confirmaciones no duplicadas; sin scroll horizontal de página; movimiento reducido; ninguna importación desde producción. No se declara Fase 3 completa: shell, navegación, React Compiler y guardia de borradores pertenecen a 3B.

## Resultado — 21/09/2026

Base entregada en `codex/base-visual`, partiendo de `77910a9`. Solo archivos nuevos. No integra todavía fuentes, tokens ni componentes en producción.

- `pnpm check`: 433 pruebas correctas, 1 privada omitida; tipos, lint y formato correctos.
- Playwright aislado: 16/16. axe sin infracciones en galería, diálogo y confirmación.
- Build de producción de la galería: correcto.
- Capturas escritorio y 360/390 px revisadas: sin desbordamiento de página; tabla con desplazamiento propio.
- Revisión independiente: corregido soporte de ref en controles; error de tipos reproducido antes de la corrección.
- Regresión de foco detectada y corregida: Tab/Shift+Tab permanecen dentro del diálogo.
- Fuentes WOFF2 latinas, 71.420 bytes entre ambas, con licencias OFL.

Las pruebas de interacción usan Playwright ya instalado en vez de introducir un DOM simulado para Vitest: comprueban showModal, foco y CSS en navegador real. Los archivos generados por Next en la galería no son componentes del producto. No se ejecuta e2e de pantallas porque ninguna pantalla existente cambia. El siguiente bloque es 3B sobre main con 2C fusionada y capturas `antes-fase-3`.

### Corrección de revisión final

El atrapado de foco usa límites al principio y final del diálogo, conservando la navegación nativa dentro de campos de fecha. Regresión reproducida (Tab abandonaba el campo prematuramente) y corregida; prueba de segmentos añadida.

Una ejecución general tuvo siete timeouts de inicialización en pruebas existentes de acciones. Sus 111 pruebas pasaron con un worker; la repetición completa de `pnpm check` pasó (433 correctas, 1 omitida), sin modificar configuración ni ampliar timeouts.
