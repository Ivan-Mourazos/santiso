# Fase 6D — Patrocinadores y logos: plan de implementación

> **Para agentes:** ejecutar por tareas con `superpowers:executing-plans` o
> `superpowers:subagent-driven-development`. Actualizar casillas y evidencias al cerrar
> cada tarea. Este documento permite continuar a Claude o Codex sin recuperar el chat.

**Objetivo:** gestionar todos los patrocinadores y logos de la barra inferior desde un
catálogo único, con inclusión explícita en carteles, sin sobrescrituras silenciosas.

**Arquitectura:** conservar la tabla `patrocinadores` y su DTO. Separar catálogo completo
de selección para carteles mediante consultas explícitas. `AdminSponsors` coordina listado,
filtros y diálogos; componentes pequeños reutilizan foundation y `FotoFormulario`.
Xunta/RFGF permanecen en `ajustes`. El generador sigue consumiendo la selección ordenada.

**Tecnología:** TypeScript, React, Next.js instalado, CSS Modules, Drizzle core, Vitest y
Playwright. Sin dependencias, campos ni migraciones nuevos.

**Especificación:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`
(Fase 6 y regla de unificación); `docs/audits/2026-09-13-ux-ui.md` (§5); propuesta y cuatro
precisiones facilitadas por el usuario el 22/09/2026, recogidas debajo.

**Base inspeccionada:** `main`, `1b1513e`, posterior al cierre de 6C e incluyendo su arreglo
de eliminación de competiciones. Árbol limpio al redactar. Antes de implementar verificar
de nuevo HEAD y cambios concurrentes. Rama prevista: `codex/fase-6d-patrocinadores-logos`.

## Restricciones globales

- Plan en un commit antes de T1. No integrar modificaciones ajenas en los commits de 6D.
- Solo pnpm. Leer documentación instalada de Next antes de cambiar código del framework.
- No modificar esquema, ejecutar migración, reimportar ni escribir en datos reales.
- No mostrar secretos, tocar `.env.local` ni versionar `data/`.
- Pruebas de escritura solo en BD temporal; reutilizar siembra y servidor 3111 existentes.
- `pnpm e2e` solo lectura. No ejecutar dos servidores Next simultáneos en este checkout.
- Reutilizar foundation, guardia de borradores, preparación de imágenes y FotoFormulario.
- Guardias activas durante peticiones; error conserva borrador, selección y archivo.
- `pnpm check` antes de cada commit. Lint y formato explícitos de Studio, excluidos de
  parte de las comprobaciones raíz; build y ambos e2e al cierre.
- Ningún cambio en Equipos, Plantilla, Staff, estadísticas o parser. Conservar las pruebas
  de guardia trasladadas a Calendario por 6C.

## Decisiones funcionales

1. Etiqueta visible **Patrocinadores y logos**. Conservar ID y URL `patrocinadores` para
   no romper enlaces. Catálogo global: no añadir selector de temporada ni categoría.
2. La lista incluye registros con y sin `en_carteles`. Primero los activados, en orden de
   cartel; después los no activados por nombre. Desempate estable por ID. Filtros: Todos,
   En carteles, Fuera de carteles y Sin logo, más búsqueda sin tildes/mayúsculas.
3. No inventar un tipo persistido. Una fila con `web_url` puede identificarse como
   patrocinador y mostrar su enlace; sin web usar lenguaje neutral «logo». No inferir
   entidad institucional, campaña o patrocinio de su nombre.
4. Editor: nombre, web opcional, logo, interruptor «Mostrar en carteles». Por defecto,
   alta desactivada. Al activar, añadir al final de la selección; no desplazar silenciosamente
   al primero. Desactivar conserva registro, web y archivo. No borrar archivos de media.
5. Mantener selección, IDs, imágenes y orden efectivo existentes al abrir la nueva pantalla.
   Los cinco logos antes ocultos pasarán a verse: comportamiento esperado, no duplicación.
6. Barra actual: `lib/cartel/shared.ts::drawSponsorBar` tiene cinco posiciones. Vista previa
   de selección con logo y orden, cinco posiciones y aviso de excedentes. Los registros sin
   logo no ocupan posición: el hook ya los filtra. Mostrar «Sin logo: no aparecerá» si están
   activados. No prometer preview exacta de una imagen que falle al cargar.
7. Reordenación accesible con botones subir/bajar; solo lista de activados, sin arrastre
   obligatorio. Fuera de carteles no tiene orden editable. No reordenar desde una lista
   filtrada incompleta: mostrar siempre la selección completa en el bloque de orden.
8. Nombre repetido: señalar registro existente antes de aplicar cambios y ofrecer
   **«Abrir registro existente»**. Confirmación explica que se descarta el alta pendiente;
   cargar nombre, web, imagen y activación existentes. El archivo recién elegido no se
   transfiere automáticamente. Sustituirlo exige elegir imagen en ese editor y Guardar.
   En edición, una colisión con otro ID no fusiona ni renombra ese otro registro.
9. Borrar permanece disponible. Diálogo nombra registro y alcance global; si `en_carteles`
   está activo, avisa «Está activado para carteles. Dejará de estar disponible al generar
   nuevos carteles». No afirmar que modifica PNG ya exportados. Ofrecer cancelar y usar
   interruptor si solo se pretende ocultarlo. Confirmación nunca llama primero a borrar.
10. Ajustes gráficos conserva escudo del club, Xunta, RFGF y orden de cabecera. Sustituir
    CRUD de logos inferiores por resumen y enlace al catálogo único. No mover Xunta/RFGF
    a `patrocinadores` ni cambiar sus claves o posición.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `apps/studio/lib/server/consultas/patrocinadores.ts` | Catálogo completo y selección ordenada |
| `apps/studio/lib/server/acciones/patrocinadores.ts` | Guardar explícitamente por ID, comprobar coincidencia, borrar y ordenar |
| `apps/studio/lib/server/acciones/ajustes-cartel.ts` | Solo ajustes y lectura de recursos; retirar CRUD duplicado al finalizar T4 |
| `apps/studio/lib/patrocinadores/modelo.ts` (nuevo) | Borrador, filtros, orden visual y selección para preview |
| `apps/studio/components/admin/AdminSponsors.tsx` | Carga, filtros, listado y coordinación |
| `apps/studio/components/admin/patrocinadores/EditorPatrocinador.tsx` (nuevo) | Edición, coincidencias y guardia |
| `apps/studio/components/admin/patrocinadores/EliminarPatrocinador.tsx` (nuevo) | Confirmación de borrado |
| `apps/studio/components/admin/patrocinadores/OrdenLogos.tsx` (nuevo) | Selección completa, orden y cinco posiciones |
| `apps/studio/components/admin/patrocinadores/Patrocinadores.module.css` (nuevo) | Tabla, tarjetas móviles y editor |
| `apps/studio/components/admin/AdminCartelAssets.tsx` | Ajustes institucionales y enlace al catálogo |
| `apps/studio/lib/navigation/contexto.ts` | Etiqueta nueva; mismo ID/ruta |
| `apps/studio/components/admin/cartel/useCartelAssets.ts` | Verificar selección y recarga al volver al generador |
| `apps/studio/e2e-escritura/sembrar.ts` | Fixtures ficticias adicionales |

## T1 — Catálogo completo y cierre de sobrescritura por nombre

**Modificar:** consultas/acciones de patrocinadores, acciones de ajustes-cartel y sus
`patrocinadores.test.ts` / `ajustes-cartel.test.ts` adyacentes.

**Contratos:** mantener `listarPatrocinadores(enCarteles: boolean)` para consumidores actuales;
añadir `listarCatalogoPatrocinadores(): Promise<PatrocinadorDto[]>` sin filtro de visibilidad.
`cargarPatrocinadores()` devuelve ese catálogo. Añadir
`buscarCoincidenciaPatrocinador(nombre: string, excluirId?: string): Promise<Resultado<PatrocinadorDto | null>>`.
Usar `claveNombre`, no comparar texto del error desde UI.

- [ ] Añadir prueba RED del catálogo incluyendo activados y desactivados; sustituir la
  prueba que exigía ocultar logos. Comprobar ambos IDs y campos, no solo recuento.
- [ ] Añadir regresión a `guardarLogoPatrocinador`: sembrar entidad con web, logo y flag
  false; subir mismo nombre normalizado con otro PNG; exigir fallo y todos los valores
  originales intactos. Detectar colisión **antes** de guardar imagen.

```ts
expect(resultado.ok).toBe(false);
expect(despues).toEqual(antes);
```

- [ ] Ejecutar `pnpm test apps/studio/lib/server/acciones/patrocinadores.test.ts
  apps/studio/lib/server/acciones/ajustes-cartel.test.ts`; registrar fallo pertinente.
- [ ] Implementar lectura completa y búsqueda de coincidencia excluyendo solo el ID
  editado. Mantener negativa del servidor en guardar si otro ID usa esa clave.
- [ ] Endurecer provisionalmente alta de ajustes: rechazar duplicado, sin actualización
  por clave. T4 eliminará esa acción al retirar su último consumidor.
- [ ] Probar nombres con tildes/mayúsculas, exclusión propia y ID ajeno. Error de lectura
  devuelve fallo; jamás coincidencia nula que permita continuar como si no existiera.
- [ ] `pnpm check`, lint/formato tocados y commit `fix(patrocinadores): impedir sobrescrituras por nombre`.

## T2 — Activación explícita y orden transaccional

**Modificar:** acciones de patrocinadores y tests. Crear modelo puro y
`apps/studio/lib/patrocinadores/modelo.test.ts`.

**Contratos de escritura:**

```ts
// FormData de guardarPatrocinador:
// id, nombre, webUrl, enCarteles: "true" | "false", logo?: File
// Si enCarteles falta en un consumidor antiguo: preservar valor al editar, false al crear.
guardarPatrocinador(formulario: FormData): Promise<Resultado<PatrocinadorDto>>;
moverPatrocinador(id: string, direccion: -1 | 1): Promise<Resultado<null>>;
```

**Modelo:** `FiltroPatrocinadores = "todos" | "en-carteles" | "fuera-carteles" | "sin-logo"`;
`BorradorPatrocinador = { nombre: string; webUrl: string; enCarteles: boolean; archivo: File | null }`.
`filtrarPatrocinadores(filas, texto, filtro)` devuelve copias ordenadas, nunca muta entrada;
`logosVisibles(filas)` filtra activados con logo, ordena y devuelve primeros cinco.
Ambas reciben `readonly PatrocinadorDto[]`; salida `PatrocinadorDto[]`.

- [ ] Tests RED: activar existente conserva ID/web/logo, desactivar conserva fila,
  reactivar añade al final, editar sin imagen conserva logo, flag inválido falla.
- [ ] Tests RED de orden: extremos, ID inexistente, desactivado, dirección inválida,
  órdenes iguales y rollback si falla una actualización. Dirección validada en servidor:
  TypeScript no valida una llamada externa.
- [ ] Implementar lectura del orden y escrituras en **la misma transacción**. Leer selección
  por `orden`, `nombre`, `id`; intercambiar vecinos en array y escribir posiciones únicas
  0..n-1. Esto resuelve empates que el swap antiguo no puede mover. No normalizar por abrir
  pantalla; solo como parte de una operación explícita de orden/activación.
- [ ] Validar web opcional mediante URL, solo `http:` y `https:`; nombre requerido y clave
  única. No exigir nueva imagen al editar. Validar existencia del ID, no convertir una
  edición obsoleta en alta. Capturar errores y devolver mensajes de campo recuperables.
- [ ] Probar filtros combinados, estabilidad, sin mutación y preview con 0/5/6 imágenes,
  incluyendo activado sin logo entre medias.

```ts
expect(logosVisibles(filas).map((fila) => fila.id)).toEqual([
  "logo-1", "logo-2", "logo-3", "logo-4", "logo-5",
]);
expect(filtrarPatrocinadores(filas, "cafe", "todos").map((f) => f.nombre))
  .toContain("Café Ficticio");
```

- [ ] Ejecutar tests dirigidos, `pnpm check`, lint/formato y commit
  `feat(patrocinadores): gestionar selección y orden de carteles`.

## T3 — Pantalla unificada y diálogos

**Modificar/crear:** AdminSponsors, cuatro componentes nuevos indicados, CSS Module,
contexto de navegación. Reutilizar `plantilla/FotoFormulario.tsx` sin alterar su contrato.

- [ ] Crear prueba e2e de lectura `apps/studio/e2e/patrocinadores.spec.ts`: título, búsqueda
  imposible, limpiar, filtros y abrir/cerrar editor sin guardar. No fijar número real de filas.
- [ ] Construir listado primero; CTA «Añadir patrocinador o logo». Contador visible/total,
  columnas logo/nombre/web/estado/acciones; tarjetas a 360px. Estados carga/error/reintento,
  catálogo vacío y filtro vacío distintos. Ignorar respuestas obsoletas tras desmontar.
- [ ] Editor mediante Dialog, fieldset deshabilitado y bloqueo síncrono con ref durante
  preparación y petición. Mantener `useUnsavedChanges(sucio)` incluso mientras se guarda.
  Escape/cancelar confirma descarte; error inline conserva borrador y archivo seleccionado.

```tsx
<FotoFormulario
  actual={registro?.logo_url ?? null}
  archivo={borrador.archivo}
  onCambiar={(archivo) => setBorrador((actual) => ({ ...actual, archivo }))}
  etiqueta="Logo"
  deshabilitado={pendiente}
/>
```

- [ ] Antes de guardar, consultar coincidencia con el nombre y el ID original. Si aparece
  otro registro: mostrar nombre, logo y estado; no enviar mutación. «Abrir registro existente»
  confirma descarte y abre su ID. Cancelar mantiene alta completa. Un conflicto aparecido
  después de comprobar sigue rechazado por la mutación; recargar coincidencia para explicar
  situación, no reintentar con el ID ajeno automáticamente.
- [ ] Borrado: diálogo explícito para ambos estados, indicador de uso en carteles aunque
  la fila esté más allá de las cinco posiciones; ref/pending evita doble petición. Error
  mantiene diálogo. No borrar media ni alterar ajustes institucionales.
- [ ] OrdenLogos muestra selección completa independientemente del filtro principal,
  botones con nombre accesible («Subir logo X»), posición, aviso sin logo y excedentes.
  Deshabilitar botones hasta terminar mutación; recargar tras éxito. Si recarga falla,
  explicar que cambio guardado pero listado no actualizado y ofrecer reintentar.
- [ ] Cambiar etiqueta en navegación y expectativas de `e2e/humo.spec.ts` y
  `e2e/media.spec.ts`; no renombrar URL ni identificadores internos.
- [ ] Ejecutar e2e de lectura y revisar capturas 360/1280: sin desbordamiento, foco al
  abrir/cerrar, teclado y mensajes legibles. `pnpm check`, lint/formato y commit
  `feat(patrocinadores): unificar catálogo y editor de logos`.

## T4 — Retirar gestión duplicada de Ajustes gráficos

**Modificar:** AdminCartelAssets, acciones/tests ajustes-cartel; hook solo si la comprobación
de navegación muestra falta de recarga. No tocar renderer salvo defecto demostrado.

- [ ] Prueba: Ajustes gráficos conserva escudo, Xunta, RFGF y controles de orden de cabecera;
  enlace «Gestionar patrocinadores y logos» abre `/admin/patrocinadores` preservando contexto
  mediante navegación existente. No construir otro router ni saltarse guardia de borradores.
- [ ] Reemplazar altas, bajas y flechas de logos inferiores por resumen de selección y enlace.
  Retirar prompt de nombre y upload duplicados. Mantener funciones institucionales intactas.
- [ ] Eliminar `guardarLogoPatrocinador`, `borrarLogoPatrocinador` y `moverLogoPatrocinador`
  cuando no queden consumidores. Trasladar cobertura útil a acciones únicas; la regresión
  permanente de duplicados verifica `guardarPatrocinador`, único punto de guardado final.
- [ ] `cargarAjustesCartel` continúa usando selección true ordenada. Comprobar que entrar al
  generador tras cambiar catálogo recarga recursos; si componente se mantiene montado,
  conectar invalidación por mecanismos existentes y cubrirla, sin event bus nuevo.
- [ ] Verificar con fixture que desactivar un logo cambia selección de barra sin perderlo
  del catálogo; Xunta/RFGF y orden de cabecera idénticos antes/después.
- [ ] Buscar referencias remanentes a acciones retiradas y textos que describen dos catálogos.
  Tests dirigidos, `pnpm check`, lint/formato y commit
  `refactor(carteles): centralizar gestión de patrocinadores y logos`.

## T5 — Escrituras, regresiones y cierre

**Modificar:** siembra existente; crear
`apps/studio/e2e-escritura/patrocinadores-escritura.spec.ts`; actualizar documentación de
uso y este registro. Fixtures sin datos personales: Patrocinador Ficticio con web y flag false,
seis logos ficticios activos con imágenes generadas y órdenes conocidos, uno sin logo.
Sembrar también ajustes de Xunta/RFGF para demostrar aislamiento.

- [ ] Alta, edición, activación, desactivación y borrado. Verificar persistencia al recargar,
  misma identidad y ausencia de filas duplicadas; inspección de BD temporal si hace falta.
- [ ] Duplicado normalizado con archivo nuevo: aviso identifica registro; cancelar preserva
  borrador; abrir existente requiere confirmación y conserva foto/web/flag originales;
  reemplazo posterior explícito guarda solo ese ID.
- [ ] Borrado activo avisa del efecto en futuros carteles; cancelar no escribe. Confirmar
  retira catálogo y selección. Desactivar mantiene catálogo, ID e imagen.
- [ ] Subir/bajar cruza posiciones quinta/sexta y cambia cinco logos de preview. Volver al
  generador observa nueva selección. Cambios no modifican Xunta/RFGF.
- [ ] Abortar POST de guardado: editor conserva datos e imagen, muestra error y permite
  reintento. Con petición retenida: campos bloqueados y guardia de navegación activa.
- [ ] Ejecutar en secuencia, registrando resultados reales:

```powershell
pnpm check
pnpm build
pnpm e2e
pnpm e2e:escritura
git diff --check
```

- [ ] Ejecutar ESLint y Prettier explícitos sobre archivos Studio tocados. Detener únicamente
  servidores iniciados para las pruebas; no cerrar procesos de Claude ni del usuario.
- [ ] Revisión final: lectura completa sin filtro accidental false; sin update por nombre;
  no tocar datos al renderizar; no mensajes de éxito ante fallo; guardias y rollback de orden;
  recursos institucionales intactos. Revisar diff completo y capturas desktop/móvil.
- [ ] Documentar uso: un catálogo, interruptor, límite de cinco, orden, duplicados y eliminación.
  Actualizar estado de 6D en hoja de ruta sin marcar completas fases ajenas.
- [ ] `pnpm check` y commit `test(patrocinadores): cubrir catálogo unificado y protección de logos`.

## Entrega y continuidad

Plan listo para ejecución. T1–T5 pendientes; no se han cambiado pantalla, acciones ni datos.
No inferir progreso de esta frase: el agente actualiza casillas, commits, pruebas y bloqueos
con evidencia al terminar cada tarea. No publicar ni desplegar la herramienta.

| Tarea | Commit | Evidencia |
| --- | --- | --- |
| Plan | Consultar historial de este archivo | Revisión de contratos y alcance aprobado |
| T1–T5 | Sin ejecutar | Pendiente de implementación |
