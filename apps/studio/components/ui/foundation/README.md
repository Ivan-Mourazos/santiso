# Componentes base de Studio — Fase 3A

Base aislada, todavía no importada por las pantallas actuales. No sustituye `AdminUI.tsx`.

## Uso

En el futuro layout del panel, aplicar `theme.theme` de `styles/tokens.module.css` y las variables de `styles/fonts.ts` al ancestro común. Importar cada componente desde su archivo, para conservar separados los límites de cliente/servidor.

```tsx
import { Field } from "@/components/ui/foundation/Fields";
import { Button } from "@/components/ui/foundation/Button";

<Field label="Nombre" name="nombre" hint="Nombre completo del equipo." />
<Button type="submit" pending={guardando}>Guardar equipo</Button>
```

- `Button`: variantes primary/secondary/danger. `type="button"` por defecto; pending bloquea interacciones y muestra pendingLabel. Admite ref de React 19.
- `Field`, `Select`, `Textarea`: etiqueta obligatoria; id automático o explícito, hint/error asociados, descripción externa preservada y ref nativo. El formulario controla valores y validación.
- `Dialog`: open/onClose controlados; title obligatorio, description y footer opcionales, initialFocusRef opcional. Modal nativo, Escape y retorno del foco. pending impide cierre durante operación. No utilizar formularios method="dialog" dentro: el estado lo controla el consumidor.
- `ConfirmDialog`: empieza en Cancelar. El consumidor activa pending síncronamente en onConfirm, maneja error y cierra tras éxito. No realiza escrituras ni captura errores de negocio.
- `Tabs`: value/onValueChange controlados, items con valores únicos y paneles. Elegir un value válido habilitado. Flechas, Inicio y Fin; paneles ocultos permanecen montados para conservar borradores. No usarlo como navegación entre rutas.
- `Toast`: región viva persistente. Mantener montado, message=null oculta contenido; onDismiss lo limpia. Sin temporizador que oculte errores antes de leerlos.
- `DataTable<T>`: caption, columnas, rows y rowKey estable. Columna rowHeader para identificar cada fila; numeric alinea cifras. Scroll horizontal solo dentro de tabla. Sin ordenación, edición ni virtualización implícitas.
- `PageHeader`: un h1 por página; eyebrow/contexto, descripción y acciones opcionales.
- `EmptyState`, `LoadingState`, `ErrorState`: mensajes y acciones definidos por pantalla. No inventan datos ni reintentos.

## Comprobación independiente

Desde la raíz:

```powershell
pnpm --filter @santiso/studio exec playwright test -c test/ui/playwright.config.ts
pnpm --filter @santiso/studio exec next dev test/ui/fixture -H 127.0.0.1 -p 3107
```

Segundo comando abre galería en http://127.0.0.1:3107. No necesita `.env.local`, SQLite ni datos reales. Primer comando arranca y detiene su servidor; no ejecutarlos a la vez. Las pruebas cubren navegador, axe, móviles 360/390 px, foco, errores y operación pendiente. axe se resuelve desde eslint-plugin-jsx-a11y ya instalado; no se añade dependencia compartida. Si esa dependencia se retira en el futuro, declarar axe-core directamente antes de actualizar el arnés.

El test de confirmación mantiene la operación pendiente deliberadamente. Recargar reinicia el ejemplo. Capturas y trazas quedan en `apps/studio/test-results/ui/` (ignoradas).

## Integración pendiente — 3B

Aplicar tokens y fuentes al shell, navegación por URL, menú agrupado, guardia de borradores, eliminar styled-jsx y activar React Compiler. Actualizar e2e de pantallas en el mismo cambio. Referencia: `data/referencias/antes-fase-3/`.

Las fuentes locales usan nombres internos generados por Next. El canvas sigue usando `Outfit` y `Nunito` literales: no retirar el Google Fonts actual sin resolver ese contrato y comparar carteles. Esta entrega no modifica fuentes ni aspecto de carteles activos.
