# Fase 6F — Clasificación y Ajustes gráficos: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** pasar Clasificación y Ajustes gráficos a los componentes de la Fase 3A, corrigiendo de paso los defectos que tienen hoy, sin cambiar cálculos ni lo que se pinta en los carteles.

**Arquitectura:** cada pantalla pasa a su carpeta (`components/admin/clasificacion/`, `components/admin/ajustes/`) con su módulo CSS. Ajustes gráficos deja de ser dos componentes que cargan lo mismo por separado y pasa a ser uno con una sola carga.

**Tecnología:** Next 16, `components/ui/foundation/*`, CSS Modules con tokens, Playwright.

## Restricciones

- No tocar el cálculo de la clasificación (`packages/domain/src/clasificacion.ts`) ni sus acciones de servidor.
- No tocar `lib/cartel-draw.ts`, `lib/cartel/**` ni `useCartelAssets`: los carteles no pueden cambiar.
- No tocar lo que Codex tiene abierto en la 8A: `AdminActaImporter.tsx`, `AdminActaBatch.tsx`, `packages/actas/**`, `lib/actas/**` y sus acciones.
- `pnpm e2e` solo lee de la base real: las subidas de imágenes se prueban en `e2e-escritura/`.
- `pnpm check` antes de cada commit; ESLint y Prettier explícitos en `apps/studio`.

## Defectos de partida

**Clasificación (`AdminLeague.tsx`):**

- `rule.puestos.sort(...)` ordena en el render el array que vive en el estado: lo muta.
- Sin estado vacío ni de error: sin competiciones, una tabla con cabecera y nada más.
- `<style jsx>`, una `input-group` con `<label>` suelto y 14 estilos en línea.

**Ajustes gráficos (`AdminShield.tsx` + `AdminCartelAssets.tsx`):**

- Las dos piezas llaman cada una a `cargarAjustesCartel`: dos viajes en serie para la misma respuesta.
- El modo `compact` de `AdminShield` no lo monta nadie, y la clase `shield-preview-container` no tiene CSS.
- La vista previa del escudo crea una URL de objeto que nunca se libera, y no se puede cancelar.
- El texto dice que el escudo «sale en el Navbar y en tu marcador local»: hoy sale en los carteles.
- Xunta y RFGF se suben sin vista previa ni confirmación, al contrario que el escudo.

---

## T1 — Clasificación

**Ficheros:** crear `components/admin/clasificacion/AdminClasificacion.tsx` y `Clasificacion.module.css`; crear `e2e/clasificacion.spec.ts`; modificar `components/studio/StudioSection.tsx`; borrar `components/admin/AdminLeague.tsx`.

- [ ] **Paso 1:** e2e de solo lectura antes de cambiar nada: la sección monta, el selector de competición está asociado a su etiqueta, la tabla tiene filas y las columnas PTS/PJ/DG están. Que pase con el código actual, salvo la etiqueta (hoy suelta).
- [ ] **Paso 2:** nueva pantalla con `Select`, `EmptyState` y `ErrorState` con reintentar. Las reglas se ordenan sobre una copia.
- [ ] **Paso 3:** el color de cada regla es un dato: va por variable CSS (`--color-regla`) en la fila, no por estilos en línea sueltos.
- [ ] **Paso 4:** responsive: la tabla se desplaza dentro de su caja a 360 px, sin empujar la página.
- [ ] **Paso 5:** `pnpm check`, ESLint y Prettier, e2e, commit `refactor(clasificacion): pantalla con los componentes del panel`.

## T2 — Ajustes gráficos

**Ficheros:** crear `components/admin/ajustes/AjustesGraficos.tsx`, `ImagenAjuste.tsx` y `Ajustes.module.css`; crear `e2e/ajustes-graficos.spec.ts` y `e2e-escritura/ajustes-escritura.spec.ts`; modificar `StudioSection.tsx`; borrar `AdminShield.tsx` y `AdminCartelAssets.tsx`.

- [ ] **Paso 1:** `ImagenAjuste`: una imagen apuntada desde un ajuste, con vista previa, «Guardar» y «Cancelar», URL de objeto liberada al cambiar o desmontar, y bloqueo durante el envío. Sirve para escudo, Xunta y RFGF.
- [ ] **Paso 2:** `AjustesGraficos` carga una sola vez y reparte: escudo del club, logos de cabecera con su orden, y barra de patrocinadores en solo lectura con enlace al catálogo.
- [ ] **Paso 3:** textos que digan la verdad: dónde sale cada imagen hoy.
- [ ] **Paso 4:** e2e de solo lectura: las tres imágenes con su etiqueta, el orden de cabecera con `aria-pressed`, la barra con enlace a Patrocinadores y logos.
- [ ] **Paso 5:** e2e de escritura sobre la base de juguete: subir un escudo, ver la vista previa, cancelar sin cambios, subir y guardar; y cambiar el orden de cabecera.
- [ ] **Paso 6:** `pnpm check`, ESLint y Prettier, ambas suites, commit `refactor(ajustes): una pantalla y una carga para los ajustes gráficos`.

## Cierre

- [ ] `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura` en verde.
- [ ] Fusionar a `main` y empujar.
