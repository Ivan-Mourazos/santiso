# Traspaso — Fase 3A: cimientos del sistema de diseño

**Para:** el agente que va a ejecutar esta mitad (Astra), sin contexto previo de la sesión.
**De:** la sesión que acaba de cerrar la Fase 2B.
**Fecha:** 21/09/2026.

Este documento define **el alcance exacto** de la mitad de la Fase 3 que puede empezar ya, los
ficheros que puedes tocar y los que no, y tres trampas concretas del repo que rompen cosas en
silencio. No es un plan paso a paso: el plan lo escribes tú, con
`superpowers:writing-plans`, en `docs/superpowers/plans/`.

Lee antes: [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](../specs/2026-09-13-santiso-studio-local-first.md),
§ «Fase 3 — Sistema de diseño, shell y navegación», y `AGENTS.md` en la raíz.

## Por qué la fase va partida

La Fase 3 completa reescribe el shell del panel: menú reagrupado, rutas por sección y
`AdminShield`. La **Fase 2C** —que va en paralelo, en la otra sesión— retira el login y con él
`app/login/`, `proxy.ts`, el `signOut` de `AdminShield.tsx`, `lib/supabase*.ts` y las
dependencias `@supabase/*`. Son los mismos ficheros. Si los dos trabajos entran a la vez, el
conflicto no es de git: es de diseño, porque uno de los dos rehace lo que el otro está borrando.

Así que la Fase 3 se parte en dos:

- **3A (tuya, ahora):** todo lo que son ficheros nuevos que aún no consume nadie.
- **3B (después de la 2C):** shell, menú, rutas, guardia de cambios sin guardar.

La 2C es una sesión de trabajo. El bloqueo es corto.

## Tu alcance: Fase 3A

1. **Tokens de diseño.** Color, tipografía, espaciado, radios, sombras, duraciones. Como
   custom properties CSS en un único fichero. La paleta actual, por frecuencia de uso real en
   el código: `#facc15` (amarillo de marca, también el `theme-color` de
   [`app/layout.tsx`](../../../apps/studio/app/layout.tsx)), fondo negro, texto `#fff`, grises
   `#888`/`#666`/`#555`/`#444`, `#ef4444` y `#f87171` para error, `#4ade80` y `#10b981` para
   éxito, `#f59e0b` para aviso. **No inventes una paleta nueva**: esto es un inventario de lo
   que ya hay, para nombrarlo. Rediseñar el color es Fase 3B, con las capturas nuevas delante.

2. **Fuentes locales** con `next/font/local`. Lee la trampa nº 1 antes de tocar nada aquí.

3. **Componentes base**, como ficheros nuevos que nadie importa todavía: Button, Field (con
   `<label>` asociado de verdad), Select, Textarea, Dialog, ConfirmDialog, Toast, DataTable,
   Tabs/Segmented, PageHeader, y los estados vacío / cargando / error.

4. **`prefers-reduced-motion`** respetado en todo lo que animes.

5. **Pruebas** de los componentes que tengan lógica (foco, teclado, estados). Vitest.

Lo que **no** entra en 3A, aunque esté en la Fase 3 del spec: migrar pantallas existentes a los
componentes nuevos, quitar `styled-jsx`, activar React Compiler, rutas por sección, menú
reagrupado, guardia de cambios sin guardar.

## Límites de ficheros

| | Ruta | Nota |
| --- | --- | --- |
| ✅ Crear libremente | `apps/studio/components/ui/**` | hoy solo existe `AdminUI.tsx`; **no lo modifiques**, es el viejo |
| ✅ Crear libremente | `apps/studio/styles/**` | no existe todavía; los tokens van aquí |
| ✅ Crear libremente | `apps/studio/app/fonts/**` o donde decidas alojar los `.woff2` | |
| ✅ Crear libremente | `docs/superpowers/plans/2026-09-2*-fase-3a-*.md` | tu plan |
| ⚠️ Con cuidado | `apps/studio/app/layout.tsx` | solo para enganchar las fuentes; no toques el `<head>` ni los metadatos |
| ⚠️ Con cuidado | `apps/studio/app/globals.css` | **solo** la línea 1 (el `@import` de Google Fonts), y solo cuando las fuentes locales estén listas. Las otras 1701 líneas son de la 3B |
| ⛔ No tocar | `apps/studio/components/admin/**` | 9 de estos ficheros llevan `styled-jsx`; son de la 3B |
| ⛔ No tocar | `apps/studio/app/admin/**`, `app/login/**`, `proxy.ts` | la 2C está dentro |
| ⛔ No tocar | `apps/studio/lib/supabase*.ts` | la 2C los borra |
| ⛔ No tocar | `apps/studio/next.config.ts` | React Compiler es 3B, y la 2C quita `images.remotePatterns` |
| ⛔ No tocar | `apps/studio/lib/cartel/**`, `apps/studio/scripts/render-cartel.ts` | trampa nº 1 |
| ⛔ No tocar | `apps/studio/e2e/**` | trampa nº 2 |
| ⛔ No tocar | `packages/**`, `tools/**`, `data/**` | nada de la Fase 3 vive ahí |

## Tres trampas del repo

### 1. Las fuentes las usa el motor de carteles, por su nombre literal

Esta es la importante. El generador de carteles dibuja sobre `<canvas>` y fija la tipografía
así:

```ts
// lib/cartel/constants.ts
export const FONT_DISPLAY = "'Outfit', sans-serif";
export const FONT_BODY    = "'Outfit', 'Nunito', sans-serif";
// …y 31 usos literales de 'Nunito' / 'Outfit' repartidos por lib/cartel/**
ctx.font = "800 27px 'Nunito', sans-serif";
```

Esas familias llegan al navegador **solo** por el `@import` de Google Fonts que hay en la
**línea 1 de `globals.css`**. `next/font/local` no publica la familia con su nombre legible:
genera uno propio (del estilo `__outfit_a1b2c3`) y lo expone por variable CSS. Si sustituyes el
`@import` sin más, `ctx.font` deja de encontrar `'Nunito'`, cae a `sans-serif` **sin dar ningún
error**, y **los siete carteles cambian de aspecto**. Es una regresión silenciosa en la función
principal de la herramienta.

Tienes dos salidas; las dos valen:

- Declarar las fuentes con `@font-face` propios en `globals.css`, manteniendo los nombres
  `Outfit` y `Nunito`, y apuntando a los `.woff2` locales. Es lo menos invasivo y `lib/cartel`
  no se entera.
- Usar `next/font/local` y, **en el mismo cambio**, actualizar `lib/cartel/**` para que lea la
  familia de la variable CSS. Esto sale de tus límites de ficheros: si eliges este camino,
  dilo antes y se te amplía el alcance.

**Verificación obligatoria en ambos casos**, porque hay referencias byte a byte:

```bash
pnpm dlx tsx apps/studio/scripts/render-cartel.ts
# compara la salida de apps/studio/scripts/.out/ con data/referencias/antes-fase-2/
# partido-senior.png, proximos.png, resumo-senior.png, resumo-femenino.png, resumo-veteranos.png
```

Deben salir **idénticos**. Ojo: ese script dibuja con datos fijos escritos dentro del propio
script, así que prueba el motor de dibujo, no el camino de datos. Para lo que necesitas aquí
—que las fuentes no hayan cambiado— es exactamente la prueba correcta.

Dato útil: en `apps/studio/scripts/fonts/` ya están los `.woff2` de Nunito 400–900, que usa el
render por Node. **Outfit no está**: hay que traerlo.

### 2. Las 12 pruebas e2e navegan por las etiquetas del menú

`page.getByText("Calendario")`, `"Ligas"`, `"Actas"`, `"Temporadas"`… La Fase 3B reagrupa el
menú en Competición / Plantilla / Producción / Catálogos / Ajustes, y ese día **la suite entera
se rompe**. No es daño colateral: actualizar las pruebas es parte del trabajo de quien cambie el
menú. En la 3A no las toques, pero tenlo presente al diseñar los grupos.

### 3. React Compiler está apagado a propósito

[`next.config.ts`](../../../apps/studio/next.config.ts) lo explica en un comentario: rompe
`styled-jsx` con un *hydration mismatch* en el que el cliente pierde las clases con ámbito. Se
reactiva cuando el panel ya no use `styled-jsx`, es decir, al final de la 3B. No lo enciendas
«a ver qué pasa»: el fallo aparece en tiempo de ejecución, no en el build.

## Qué tiene que cumplir lo que entregues

Del spec, § Fase 3, lo que aplica a componentes sueltos:

- Diálogos con **foco atrapado**, cierre con **Escape** y **devolución del foco** al elemento
  que los abrió.
- Cada campo con su `<label>` asociado (`htmlFor` / `id`), no un texto suelto al lado.
- **Sin scroll horizontal de página a 360 y 390 px** de ancho.
- **axe sin violaciones críticas** en lo que entregues.
- `prefers-reduced-motion: reduce` respetado.

## Reglas del repo

- Monorepo **pnpm**. Nunca `npm` ni `yarn`. Versiones compartidas con `catalog:` en
  `pnpm-workspace.yaml`.
- **`pnpm check`** (typecheck + lint + formato + pruebas) en verde antes de cada commit. Aviso:
  el código de salida de una tubería es el del último comando, así que `pnpm check | tail` **no**
  corta un `&&`; mira el resultado o usa `${PIPESTATUS[0]}`.
- **Prettier y ESLint solo sobre los ficheros que crees.** Pasarlos por directorios enteros
  reformatea código heredado y ensucia el diff; ya ha pasado dos veces. La línea base de ESLint
  no debe subir: hoy está en **78 problemas**.
- Esta versión de Next tiene cambios incompatibles con lo que sabes. Antes de usar una API suya,
  lee su guía en `apps/studio/node_modules/next/dist/docs/`.
- Dominio y nombres en **español**. Sin `any`. `as` solo con un comentario que lo justifique.
  Sin `catch` vacíos.
- **Rama propia** (`fase-3a`), nunca commits directos en `main`. Conventional Commits en
  español.
- `data/` no entra en git jamás. `apps/studio/.env.local` es secreto: no lo imprimas ni lo
  commitees.

## Cuándo se desbloquea la 3B

Cuando la 2C esté fusionada en `main`. Entonces:

- `AdminShield.tsx` ya no tendrá `signOut` y podrás rehacerlo entero.
- `app/login/` y `proxy.ts` ya no existirán.
- Se sacará una **tanda nueva de capturas de referencia** del panel, que pasará a ser el patrón
  «antes de Fase 3». Las de `data/referencias/antes-fase-2/` (18 del panel, 9 secciones en
  escritorio y móvil) dejan de valer en cuanto cambie el aspecto.

Hasta entonces, la 3A no depende de nada de eso.
