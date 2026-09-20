# Parser aislado de fichas PDF: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Extraer las dos fichas oficiales de veteranos como borradores revisables, sin escribir en BD.
**Architecture:** Adaptador PDF a fragmentos con coordenadas normalizadas; parser puro por columnas y secciones; contrato propio sin identificadores de BD. La app consumirá el contrato en otra entrega.
**Tech Stack:** TypeScript estricto, unpdf 1.8.1, Vitest.
**Spec:** ../specs/2026-09-13-santiso-studio-local-first.md, sección 7.2. Alcance autorizado en conversación: parser aislado en paralelo con 2A/2B.

## Global Constraints
- Sin acceso a Supabase, red para documentos ni escrituras en datos.
- PDF originales fuera de Git. Fixtures solo anonimizadas.
- No inferir minutos, participación de suplentes ni penaltis. Tarjetas sin tipo cuando el texto no lo indica.
- Rechazar formatos no reconocidos y marcadores inconsistentes; nunca presentarlos como extracción correcta.
- HTML, otras categorías, lectura del color de tarjetas y edición manual quedan fuera de esta primera entrega y requieren muestras/pruebas propias.

## Task 1: Contrato y parser puro
- [x] Crear `packages/actas/src/ficha.ts`: fragmentos, borrador y `parsearFicha(fragmentos)`.
- [x] Probar ambas fixtures con `pnpm exec vitest run packages/actas/src/ficha.test.ts`: jornadas, 11 titulares por lado, suplentes 9/6 y 6/4, marcadores 3–2 y 5–2, cinco/siete goles, dos tarjetas, tipos desconocidos y sin minutos inferidos.
- [x] Probar rechazo de texto vacío, pérdida de goles, marcador alterado, dorsal repetido y sustituciones no soportadas. Aceptar 0–0 sin goles y minutos de descuento.
- [x] Ordenar por coordenadas y agrupar filas con tolerancia pequeña; anclar secciones y equipos al encabezado. Validar incrementos de marcador y conservar autor y equipo beneficiario separados.

## Task 2: Adaptador PDF y pruebas
- [x] Crear `packages/actas/src/pdf.ts`: `parsearFichaPdf(bytes: Uint8Array): Promise<Ficha>`; máximo 15 MiB y una página para esta plantilla. Copiar bytes antes de PDF.js y liberar loadingTask en finally.
- [x] Probar PDF inválido, límite de bytes y documento sintético con textos anonimizados extraídos; ejecutar lectura de los dos PDF originales manualmente sin registrar nombres.
- [x] Exportar desde `src/index.ts`; documentar límites en README del paquete. Ejecutar typecheck, lint, formato y pruebas del paquete, después suite del monorepo.

## Aceptación
Las dos muestras reales deben producir los marcadores y cantidades verificados. Cada valor desconocido permanece explícito. No hay UI ni guardado automático. Entrega aislada pendiente de integración coordinada con 2B/5.

## Verificación de esta entrega

- `pnpm check`: correcto, 136 tests en 28 archivos (18 del paquete nuevo).
- Dos PDF originales leídos mediante el adaptador, sin copiar al repositorio: jornada 1, 3–2, titulares 11/11, suplentes 9/6, 5 goles y 2 tarjetas; jornada 2, 5–2, titulares 11/11, suplentes 6/4, 7 goles y 2 tarjetas.
- Pruebas de límite de bytes, bytes inválidos, documento sin texto, rotado y multipágina; fixtures sintéticas anonimizadas y origen conservado en README.
- Integración pendiente: añadir `@santiso/actas` como dependencia del consumidor, convertir el contrato Ficha a DTO de revisión y resolver jugadores/equipos en servidor. No guardar tipos desconocidos como normales ni como amarillas. Guardado requiere confirmación y transacción del importador.
- Se conserva la separación de responsabilidades con la Fase 2A. Ningún cambio en archivos de Studio, DB o migración.

Revisión independiente: corregida anonimización de campos/localidades, con regresión para ambos documentos. PDF marcados como binarios para conservar bytes.
