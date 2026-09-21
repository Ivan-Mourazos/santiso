# Fase 6A — Temporadas

**Objetivo:** listado primero, activación explícita y alta compacta accesible.
**Arquitectura:** AdminTemporadas conserva acciones existentes y usa Button, Field y estados de foundation; CSS Module propio. Sin dependencias nuevas.
**Referencia:** auditoría UX/UI de 2026-09-13, apartado Temporadas.

## Diseño y límites

Paleta y fuentes de 3A: negro, superficies #171717, texto blanco, secundario #aaa, acento #facc15; Outfit para títulos y Nunito para contenido. Lista de temporadas a izquierda, alta compacta a derecha; una columna en móvil. La fila activa usa borde amarillo e insignia. Explicar consultar frente a activar, sin cambiar datos al navegar. No tocar acciones de servidor, importadores ni carteles.

## Ejecución

- [x] Prueba de confirmación cancelable y conservación de temporada activa ante error.
- [x] Sustituir estilos inline por AdminTemporadas.module.css y componentes accesibles.
- [x] Evitar doble envío; conservar formulario ante error y mostrar errores inline; cargar con reintento.
- [x] Verificar móvil, pruebas existentes, check, lint y build. Guardar commit aislado.

## Traspaso para Fase 2D

No modificar esquema jugadores/staff ni lib/server/acciones/jugadores.ts y staff.ts: inscripción por temporada pertenece a 2D. Pantallas actuales de jugadores/staff solo incorporan guardia de borradores; su rediseño interior no forma parte de 6A. Integrar 2D sobre esta rama tras la fusión coordinada.

Verificación: pnpm check (458 pruebas, una omitida), build y lint de pantalla correctos. Cuatro pruebas específicas cubren cancelación, fallo de activación, retención de nombre y móvil/escritorio. Revisión independiente sin hallazgos. Capturas revisadas a 390 y 1280 px.
