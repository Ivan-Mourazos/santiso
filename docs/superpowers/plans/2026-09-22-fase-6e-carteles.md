# Fase 6E — Carteles: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** dejar la pantalla de Carteles como el resto del panel —componentes de la Fase 3A, CSS con tokens, sin styled-jsx— sin cambiar ni un píxel del cartel que se descarga.

**Arquitectura:** `GeneradorCartel` pasa a ser solo el cuerpo que monta `StudioSection`: formulario a la izquierda, previsualización a la derecha. El dibujo (`lib/cartel-draw`, `lib/cartel/templates/*`) no se toca en toda la fase: es la garantía de que el resultado es idéntico.

**Tecnología:** Next 16, React Compiler, CSS Modules, componentes `components/ui/foundation/*`, Playwright.

**Especificación:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`, Fase 3 (rediseño) aplicada a la última pantalla que quedaba sin hacer.

## Restricciones

- **No tocar el dibujo:** `lib/cartel-draw.ts`, `lib/cartel/templates/**`, `lib/cartel/shared.ts` ni `lib/cartel/instagram.ts`. Si una tarea parece exigirlo, parar.
- No tocar `components/admin/patrocinadores/**`, `AdminSponsors`, `lib/patrocinadores/**` ni las acciones de patrocinadores: son de la 6D, recién cerrada.
- `packages/**` no entra: esta fase es solo `apps/studio`.
- Sin migraciones, sin acciones de servidor nuevas, sin dependencias nuevas.
- `pnpm check` antes de cada commit. `apps/studio` está en `.prettierignore`: pasar ESLint y Prettier a mano sobre los ficheros tocados.
- `pnpm e2e` (solo lectura, base real) al cerrar cada tarea que cambie pantalla.

## Estado de partida

- `/admin/cartel` (`app/admin/cartel/page.tsx`) solo hace `redirect` a `/admin/carteles`. Por tanto **nadie monta `GeneradorCartel` con `hideLayout` falso**: la cabecera propia, los chips de plantilla, el enlace «Volver al Panel», el modal «Configurar Activos» y el toast propio son código muerto.
- El selector de plantilla vive en `StudioShell` (`params.plantilla`); el de activos, en Ajustes gráficos y en el catálogo de la 6D.
- `GeneradorCartel.tsx` son 491 líneas con estilos en línea y `<style jsx>`; `cartel/Common.tsx` tiene los widgets compartidos, también en línea.
- No hay ninguna prueba e2e de Carteles.

---

## T1 — Red de seguridad y poda del camino muerto

**Ficheros:**

- Crear: `apps/studio/e2e/carteles.spec.ts`
- Modificar: `apps/studio/components/admin/GeneradorCartel.tsx`
- Borrar: `apps/studio/app/admin/cartel/page.tsx`

- [ ] **Paso 1:** escribir `e2e/carteles.spec.ts` (solo lectura) antes de tocar nada: la sección monta, el lienzo existe con `width=2160`, cambiar de plantilla en el selector del shell cambia el formulario, «Descargar JPG» y «Limpiar datos» están visibles, y el panel de texto de Instagram aparece en `proximos`. Que pase **antes** del cambio: es la referencia.
- [ ] **Paso 2:** `pnpm e2e -- carteles` y comprobar que pasa en verde con el código actual.
- [ ] **Paso 3:** guardar la referencia de píxeles: con `pnpm dev` levantado, exportar los 7 carteles con datos fijos y guardar los ficheros en el scratchpad. Son la referencia de bytes de toda la fase.
- [ ] **Paso 4:** borrar `app/admin/cartel/page.tsx` y comprobar que ningún enlace apunta a `/admin/cartel` (`grep -rn "admin/cartel\b" apps/studio --include=*.tsx --include=*.ts`, ignorando `.next`).
- [ ] **Paso 5:** en `GeneradorCartel.tsx`, quitar la prop `hideLayout` y todo su bloque: `<main>` con altura de pantalla, `container`, cabecera, enlace de vuelta, chips de plantilla y botón «Configurar Activos». El componente empieza ya en el layout de dos columnas.
- [ ] **Paso 6:** quitar el modal de activos (`showAssets`, `AdminCartelAssets`, `.modal-overlay`) y dejar en su lugar, junto a la previsualización, una línea con enlace a `/admin/ajustes-graficos` y a `/admin/patrocinadores`. `assetRefreshKey` desaparece con él: `useCartelAssets` se recarga al montar.
- [ ] **Paso 7:** sustituir el toast propio por el `showToast` de `StudioContext` (pasarlo como prop desde `StudioSection`, como el resto de secciones). Quitar `toast`, `.toast-container` y `.toast-content`.
- [ ] **Paso 8:** `pnpm check`, ESLint y Prettier de los ficheros tocados, `pnpm e2e`, y volver a exportar los 7 carteles: **bytes idénticos** a la referencia del paso 3.
- [ ] **Paso 9:** commit `refactor(carteles): retirar el camino muerto de la pantalla suelta`.

---

## T2 — Estilos con tokens, sin styled-jsx

**Ficheros:**

- Crear: `apps/studio/components/admin/cartel/Cartel.module.css`
- Modificar: `apps/studio/components/admin/GeneradorCartel.tsx`
- Modificar: `apps/studio/e2e/carteles.spec.ts`

- [ ] **Paso 1:** pasar `.gen-layout`, `.gen-form` y `.gen-preview` al módulo CSS con tokens `--ui-*`, y borrar el bloque `<style jsx>` entero (incluida la animación `scale-in`, que se va con el modal).
- [ ] **Paso 2:** llevar los estilos en línea del cuerpo —panel de descarga, panel de texto de Instagram, cabecera de la previsualización, pie— a clases del módulo. Los `style` que quedan solo pueden ser los que calculan algo en tiempo de ejecución.
- [ ] **Paso 3:** botones a `Button` del foundation: «Descargar JPG» primario, «Limpiar datos» secundario, «Copiar» secundario con su estado copiado. Nada de `<button>` con estilos propios.
- [ ] **Paso 4:** móvil: a 360 px la previsualización va arriba y el formulario debajo, sin scroll horizontal. A 1280 px la previsualización se queda pegajosa como ahora.
- [ ] **Paso 5:** añadir a `e2e/carteles.spec.ts` la comprobación de ancho a 360 y 1280 (`document.documentElement.scrollWidth <= clientWidth`), como en `plantilla.spec.ts`.
- [ ] **Paso 6:** `pnpm check`, ESLint y Prettier, `pnpm e2e`, y exportar de nuevo los 7 carteles: bytes idénticos.
- [ ] **Paso 7:** commit `refactor(carteles): estilos con tokens y sin styled-jsx`.

---

## T3 — Widgets compartidos de los formularios

**Ficheros:**

- Modificar: `apps/studio/components/admin/cartel/Common.tsx`
- Modificar: `apps/studio/components/admin/cartel/FormPartido.tsx` y los demás `Form*.tsx` solo donde usan esos widgets
- Crear: `apps/studio/components/admin/cartel/Formularios.module.css`

- [ ] **Paso 1:** `SectionLabel`, `CategorySelector`, `Toggle` y `MatchSelector` pasan a usar `Field`, `Select` y `Button` del foundation más clases del módulo. Mismos textos y mismo comportamiento: esta tarea no cambia lo que hace ningún formulario.
- [ ] **Paso 2:** tipar los `any` que cruzan estos widgets: `dbMatches: SelectorMatch[]` y `loadMatchFromDb: (m: SelectorMatch) => void` en los `Form*` que los reciben. Solo esos; el resto de `any` de la pantalla se queda para otra fase.
- [ ] **Paso 3:** revisar a mano las 7 plantillas en el navegador: cada formulario carga, autocompletar desde la liga sigue funcionando y el lienzo se redibuja.
- [ ] **Paso 4:** `pnpm check`, ESLint y Prettier, `pnpm e2e`, exportar los 7 carteles y comparar bytes.
- [ ] **Paso 5:** commit `refactor(carteles): formularios con los componentes comunes`.

---

## Cierre

- [ ] `pnpm check`, `pnpm build`, `pnpm e2e` y `pnpm e2e:escritura` en verde.
- [ ] Los 7 carteles exportados coinciden byte a byte con la referencia del inicio de la fase.
- [ ] `grep` de `style jsx` en `apps/studio/components/admin/cartel` y en `GeneradorCartel.tsx`: sin resultados.
- [ ] Fusionar a `main` y empujar.
