# Fase 6C — Equipos: plan de implementación

> **Para agentes:** ejecutar por tareas con `superpowers:executing-plans` o
> `superpowers:subagent-driven-development`. Mantener este documento actualizado con resultados
> y comandos para que Claude o Codex puedan continuar sin reconstruir la conversación.

**Objetivo:** localizar, editar e incorporar equipos con contexto suficiente, distinguir
claramente desvinculación y eliminación, y resolver los escudos pendientes desde un listado.

**Arquitectura:** `AdminEquipos` coordina contexto, carga, filtros y diálogos pequeños.
Se reutilizan componentes foundation y `plantilla/FotoFormulario`. Una consulta de lectura
agrupa las inscripciones de cada equipo con competición y temporada; las mutaciones existentes
se conservan salvo un defecto demostrable que impida cumplir la aceptación.

**Tecnología:** TypeScript, React, Next.js instalado, CSS Modules, Drizzle core, Vitest y Playwright.
Sin dependencias nuevas ni cambios de esquema.

**Base verificada:** `3413ecd`, Fase 6B integrada en main. Antes de implementar comprobar rama,
árbol y cambios de otros agentes. Rama propuesta `codex/fase-6c-equipos` en el checkout actual;
no copiar ni migrar datos reales para este rediseño.

**Especificación:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`, Fase 6;
`docs/audits/2026-09-13-ux-ui.md`, §3; ajustes expresamente aprobados por el usuario el 22/09/2026,
recogidos en este documento. El alcance es exclusivamente Equipos. Patrocinadores/en_carteles
pertenece a 6D y queda fuera.

## Restricciones globales

- Solo pnpm. Leer las guías instaladas de Next antes de modificar código del framework.
- No cambiar `packages/db/src/schema`, generar migraciones ni tocar la BD real.
- No modificar `.env.local`, mostrar claves ni añadir `data/` al repositorio.
- `pnpm e2e` solo lee datos reales. Escrituras exclusivamente en `e2e-escritura`, ampliando
  su siembra existente; puerto 3111 y carpeta temporal única ya resueltos por 6B.
- No arrancar dos servidores Next en la misma carpeta. Cerrar únicamente servidores propios.
- Reutilizar Dialog, Button, Fields, States y FotoFormulario; no introducir otro sistema visual.
- Escribir y probar estados de error, no sustituir errores por listas vacías.
- Mantener las dos pruebas de guardia de Equipos trasladándolas a Calendario.
- `pnpm check` antes de cada commit; al cerrar, build, e2e de lectura y escritura, y lint
  explícito de Studio, que no forma parte de `pnpm check`.
- El formato raíz excluye Studio: comprobar explícitamente los archivos tocados.
- Confirmación de borrado expresa alcance; nunca transformar automáticamente eliminar en quitar.

## Diseño funcional aprobado

### Pantalla

1. Contexto: competición y categoría actual visibles, respetando `?temporada=` de la URL. No permitir operaciones
   hasta resolver el contexto. Mantener creación/eliminación de competición existentes con sus
   confirmaciones, validaciones y restricciones de temporada; su rediseño funcional no es 6C.
2. Listado primero: búsqueda por nombre sin distinguir tildes/mayúsculas, filtro «Sin escudo»,
   contador visible/total. Dos vistas explícitas: «Esta competición» y «Biblioteca de Senior»
   (o categoría actual). Sin competición, ofrecer biblioteca y explicar por qué no se puede inscribir.
3. Acciones: «Añadir a competición» primaria, «Crear equipo» secundaria. En biblioteca sin
   competición solo crear/editar/eliminar; deshabilitar incorporación con explicación.
4. Estados diferenciados: cargando, error con reintento, biblioteca vacía, competición vacía,
   búsqueda sin resultados. No ocultar toda la pantalla por un fallo de candidatos.
5. Filas con escudo, nombre, categoría, competiciones con temporada y acciones accesibles con
   nombre del equipo. Tabla en escritorio y tarjetas móviles sin duplicar fuente de datos.
6. No fijar contadores de escudos faltantes a 6/14: son una observación de los datos actuales,
   no una constante ni una expectativa estable para pruebas.

### Incorporar

Diálogo buscable de equipos existentes. Mostrar siempre categoría y todas sus competiciones
con temporada, o «Sin competiciones». Por defecto la categoría del destino; si se muestran otras
categorías para distinguir homónimos, señalarlas y deshabilitar su incorporación a un destino
incompatible. Nunca cambiar de categoría a una entidad existente para reutilizarla.
Los ya inscritos se identifican y no se ofrecen como nuevas altas. Confirmar un equipo concreto
por ID; búsqueda, selección y errores permanecen visibles si falla la acción.

### Editar y crear

Diálogo único con nombre, categoría fija, preview de escudo mediante FotoFormulario y aviso:
«El nombre y el escudo pertenecen al equipo y cambian en todas sus competiciones».
La competición de destino queda fija durante la apertura. Alta en biblioteca no inscribe;
alta desde competición usa el contrato actual `competicionId`.

Guardar: validación local de nombre vacío; bloqueo síncrono con ref; campos deshabilitados
mientras se procesa imagen/acción; error inline con borrador conservado; cancelar/Escape con
confirmación de descarte; `useUnsavedChanges` para recarga/cierre. Sin autosubida de escudos.
Tras guardar, recargar los datos sin anunciar éxito si la acción ha devuelto error.

### Quitar y eliminar

- «Quitar de esta competición»: elimina únicamente la relación. Explica que equipo y partidos
  permanecen. Confirmación identificando equipo y competición.
- «Eliminar de biblioteca»: explica alcance global y requiere confirmación independiente.
- Si `numeroPartidos > 0`, explicar que el equipo tiene partidos y no se puede eliminar
  dentro del diálogo. Si está inscrito en la competición seleccionada, ofrecer explícitamente
  «Quitar de esta competición» y pedir su confirmación antes de llamar a la otra acción.
- Si no hay una competición seleccionada donde esté inscrito, explicar que debe seleccionarla;
  no mostrar una alternativa imposible ni llamar a quitar con un ID vacío.
- Un error inesperado se muestra con reintento; no se interpreta como el caso de partidos.

## Archivos y responsabilidades

| Archivo | Responsabilidad |
| --- | --- |
| `apps/studio/lib/equipos/modelo.ts` | Tipos de lectura enriquecida, filtros, borrador y FormData puros |
| `apps/studio/lib/equipos/modelo.test.ts` | Búsqueda, filtros, campos enviados y detección de cambios |
| `apps/studio/lib/server/consultas/equipos.ts` | Lectura de biblioteca e inscripciones con temporada |
| `apps/studio/lib/server/acciones/equipos.ts` | Solo envoltorio/ampliación de lectura necesaria |
| `apps/studio/lib/server/acciones/equipos.test.ts` | Contrato de lectura enriquecida y conservación de mutaciones |
| `apps/studio/components/admin/equipos/EditorEquipo.tsx` | Alta/edición y escudo |
| `apps/studio/components/admin/equipos/IncorporarEquipo.tsx` | Búsqueda y selección de existentes |
| `apps/studio/components/admin/equipos/EliminarEquipo.tsx` | Confirmación, error por partidos y alternativa de quitar |
| `apps/studio/components/admin/equipos/Equipos.module.css` | Distribución adaptativa con tokens existentes |
| `apps/studio/components/admin/AdminEquipos.tsx` | Orquestación y controles existentes de competición |
| `apps/studio/e2e/navegacion.spec.ts` | Traslado de dos pruebas y adaptación de carga de contexto |
| `apps/studio/e2e/equipos.spec.ts` | Lectura, filtros, descarte, anchuras y errores sin escrituras |
| `apps/studio/e2e-escritura/sembrar.ts` | Equipos ficticios, relaciones y partido protegido |
| `apps/studio/e2e-escritura/equipos-escritura.spec.ts` | CRUD, incorporación y distinción quitar/eliminar |

## T1 — Modelo y lectura con contexto

**Entrega:** equipos distinguibles por categoría, competición y temporada, sin consulta por fila.

Interfaces nuevas en `lib/equipos/modelo.ts`:

```ts
import type { EquipoDto } from '@/lib/dto';
export interface InscripcionEquipo {
  id: string; // competición
  nombre: string;
  temporadaId: string;
  temporadaNombre: string;
}
export interface EquipoCatalogo extends EquipoDto {
  competiciones: InscripcionEquipo[];
  numeroPartidos: number; // todas las temporadas y competiciones, sin duplicar partidos
}
export interface FiltroEquipos { texto: string; soloSinEscudo: boolean }
export interface BorradorEquipo { id: string; nombre: string }
// filtrarEquipos(lista: EquipoCatalogo[], filtro: FiltroEquipos): EquipoCatalogo[]
// borradorDeEquipo(equipo: EquipoDto | null): BorradorEquipo
// formularioDeEquipo(borrador, destino: { categoria: string; competicionId?: string }, escudo: Blob | null): FormData
```

- [x] Escribir pruebas: «Águias» coincide con «aguias»; sin escudo excluye URL no vacía;
      combinar filtros; blanco devuelve todo; entidades homónimas conservan IDs distintos.
- [x] Probar que FormData de edición envía ID y nombre aunque solo cambie el escudo;
      no envía competición vacía ni borra un escudo al no seleccionar archivo.
- [x] Ejecutar pruebas nuevas en rojo y después implementar con `claveNombre`, sin React.

```ts
expect(filtrarEquipos(equipos, { texto: 'aguias', soloSinEscudo: true })
  .map(e => e.id)).toEqual(['senior-sin-escudo']);
const form = formularioDeEquipo({ id: 'equipo-1', nombre: 'Águias' },
  { categoria: 'Senior' }, null);
expect(form.get('id')).toBe('equipo-1');
expect(form.has('escudo')).toBe(false);
expect(form.has('competicionId')).toBe(false);
```

- [x] Ampliar lectura mediante consulta agrupada: equipos + relaciones `competicionEquipos`
      unidas con competiciones y temporadas. Agrupar por equipoId, ordenar por temporada/nombre,
      incluir equipos sin relaciones; no cargar por fila desde el navegador.
      En la misma consulta agrupada obtener `count(distinct partidos.id)` para partidos como
      local o visitante. Evitar multiplicar el recuento al unir varias inscripciones.
- [x] Mantener compatibles `cargarEquiposDeCategoria`, `cargarEquiposPorIds` y
      `cargarEquiposDeCompeticion`, usados fuera de esta pantalla.
- [x] Preferir nueva lectura `cargarCatalogoEquipos(): Promise<EquipoCatalogo[]>` para el diálogo
      de homónimos; la pantalla filtra su categoría y relación seleccionadas en memoria.
      Esta adición justifica tocar el archivo de acciones, sin cambiar sus mutaciones.
- [x] Probar con BD temporal dos equipos del mismo nombre en categorías distintas, equipo sin
      competiciones y un equipo en dos temporadas. Verificar ninguna inscripción desaparece.
      Probar recuentos 0, local y visitante, sin duplicación por varias inscripciones.
- [x] Ejecutar `pnpm test -- apps/studio/lib/equipos/modelo.test.ts apps/studio/lib/server/acciones/equipos.test.ts`.
- [x] `pnpm check`; commit `feat(equipos): consultar catálogo con categoría y competiciones`.

## T2 — Editor y preview reutilizados

**Entrega:** `EditorEquipo` montado solo al abrir, con `key` por apertura, y callbacks
`onCerrar(): void`, `onGuardado(equipo: EquipoDto): void`. Recibe equipo opcional y destino fijo.

- [ ] Implementar el patrón de `plantilla/EditorStaff.tsx`: estado inicial, ref de operación,
      error general y error de nombre. Reutilizar `plantilla/FotoFormulario` sin copiarlo.
- [ ] Nombre obligatorio con `Field` asociado; categoría y alcance global como texto visible.
- [ ] Preparar imagen con `prepararImagen`, llamar a `guardarEquipo`, capturar excepciones
      y liberar bloqueo en `finally`. No cerrar ante `Resultado.ok === false`.

```ts
if (guardando.current) return;
if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
guardando.current = true;
setPendiente(true);
try {
  const imagen = foto ? await prepararImagen(foto) : null;
  const resultado = await guardarEquipo(formularioDeEquipo(borrador, destino, imagen));
  if (!resultado.ok) { setError(resultado.error); return; }
  onGuardado(resultado.datos);
} catch {
  setError('No se pudo guardar. Tus cambios siguen aquí.');
} finally {
  guardando.current = false;
  setPendiente(false);
}
```

- [ ] Bloquear fieldset y cierre durante guardado. Cancelar sin cambios cierra directamente;
      con nombre o foto modificados pide descarte. Conservar foto tras error.
- [ ] Verificar en T5 apertura, validación, descarte rechazado/aceptado, fallo y reintento.
- [ ] Revisar lint explícito y typecheck; `pnpm check` antes del commit de integración T3.

## T3 — Listado, búsqueda e incorporación

**Entrega:** pantalla de Equipos con listado primero e incorporación contextual.

- [ ] Sustituir estado duplicado y casts `as Equipo[]` por catálogo tipado; derivar inscritos,
      biblioteca y candidatos con IDs y `useMemo` cuando resulte útil.
- [ ] Conservar `useCompeticiones(categoria, true)` y el montaje por contexto de StudioSection.
      Mostrar LoadingState hasta `contextoListo`; error de contexto con reintento.
- [ ] Implementar recarga con contador de generación y descarte de respuestas tardías, incluido
      desmontaje. Error de carga no se confunde con cero equipos.
- [ ] No añadir selector de temporada. La biblioteca es global y la competición respeta
      `?temporada=` mediante el hook. Mantener creación/eliminación y sus restricciones.
- [ ] Montar buscador, checkbox «Sin escudo», visible/total y conmutador competición/biblioteca.
      Usar `EmptyState` con «Quitar filtros» cuando haya datos pero no coincidencias.
- [ ] Tabla/tarjetas con botones «Editar a [nombre]», «Quitar [nombre] de [competición]» y
      «Eliminar [nombre] de biblioteca». Escudo visible con placeholder consistente.
- [ ] `IncorporarEquipo`: búsqueda por nombre, categoría visible y lista de competiciones con
      año; etiquetas «Ya inscrito», «Otra categoría», «Sin competiciones» según corresponda.
      Selección por ID y confirmación del destino. Guardado sin doble envío ni cierre ante error.
- [ ] La tabla y el diálogo no dependen de números concretos de equipos reales.
- [ ] No retirar creación/eliminación de competiciones por simplificar el componente. Si requiere
      extraer esos controles, hacerlo en `equipos/ControlesCompeticion.tsx` conservando contratos.
- [ ] Comprobar nombres largos y acciones a 360/1280 px; foco devuelto al botón de apertura.
- [ ] `pnpm check`; commit `feat(equipos): rediseñar listado y edición con contexto`.

## T4 — Eliminación con alternativa explícita

**Entrega:** distinción de alcance visible y comportamiento verificable con partidos existentes.

- [ ] Diálogo de quitar menciona competición y conservación de equipo/partidos.
- [ ] Diálogo de eliminar llama a `borrarEquipo` únicamente tras confirmación. Mantenerlo
      abierto cuando falla, con mensaje original; no ocultar la causa en un toast efímero.
- [ ] Antes de borrar, decidir con `numeroPartidos > 0`, nunca comparando textos de error.
      Explicar el bloqueo y ofrecer la alternativa solo si el catálogo indica
      inscripción en `selectedCompetitionId`. Pulsarla cambia a confirmación de desvinculación.
- [ ] Quitar requiere segunda confirmación explícita; cancelarla no llama a ninguna mutación.
- [ ] Bloquear doble operación y cierre mientras está pendiente. Recargar tras éxito; si la
      recarga falla, explicar que la operación terminó pero no se pudo actualizar la vista.
- [ ] Conservar la negativa de `borrarEquipo` como red de seguridad ante datos desactualizados.
      Mostrar cualquier error del servidor sin interpretarlo por su texto; recargar el catálogo.
      No ampliar su alcance ni eliminar partidos para permitir borrar.
- [ ] Tests temporales existentes de acciones permanecen verdes; ampliar T6 con la alternativa.

## T5 — Guardias y navegador de solo lectura

**Entrega:** cobertura previa conservada y nuevos editores comprobados sin mutar datos reales.

- [ ] Mover `borrador bloquea sección, categoría y atrás sin perder texto` a Calendario: entrar
      desde Temporadas, esperar jornada resuelta, editar primer marcador y rechazar navegación.
      Elegir un número distinto del original para garantizar borrador sucio.
- [ ] Mover `pulsar la sección actual conserva la guardia` a Calendario: editar marcador,
      pulsar Calendario sin disparar confirmación, después Jugadores y rechazarla. Contar 0/1.
- [ ] Mantener intacta la prueba existente de fallo al guardar marcador, que intercepta POST.
- [ ] Adaptar `Equipos espera a resolver contexto antes de permitir edición`: mientras la lectura
      está retenida no hay botón operativo; tras resolver, abrir editor y probar su descarte.
      Liberar rutas retenidas en `finally` para no colgar el servidor si falla una aserción.

```ts
const marcador = page.locator('input[type="number"]').first();
const nuevo = (await marcador.inputValue()) === '17' ? '18' : '17';
await marcador.fill(nuevo);
page.on('dialog', dialog => dialog.dismiss());
await page.getByRole('link', { name: 'Jugadores', exact: true }).click();
await expect(page).toHaveURL(/calendario/);
await expect(marcador).toHaveValue(nuevo);
```

- [ ] Añadir `equipos.spec.ts`: búsqueda imposible + limpiar; filtro sin escudo según catálogo
      mostrado; abrir/cancelar edición; descartar rechazar/aceptar; carga fallida con reintento.
- [ ] Capturas y aserciones sin desbordamiento a 360/1280; revisar captura, no solo generarla.
- [ ] Nunca pulsar Guardar real en esta suite. Fallos simulados interceptan toda Server Action
      antes de enviar la petición; escrituras exitosas se reservan para T6.
- [ ] `pnpm e2e` con servidor propio cerrado antes y después.

## T6 — Recorridos de escritura y cierre

**Entrega:** CRUD y protección del historial demostrados en el entorno existente.

- [ ] Ampliar `e2e-escritura/sembrar.ts`, conservando los datos de jugadores/staff existentes:
      Liga 26/27 Senior, otra competición Senior y una Veteranos; homónimos «Río Ficticio»
      de ambas categorías; un equipo Senior sin inscripción; un equipo con partido.
      Usar IDs devueltos por insert y claves normalizadas con `claveNombre`.
- [ ] Sembrar el partido con campos exigidos por el esquema instalado; usar exclusivamente la
      BD apuntada por `DIR_ESCRITURA`. No leer IDs ni filas de `data/santiso.db`.
- [ ] Añadir `equipos-escritura.spec.ts`: crear equipo, editar nombre, comprobar ausencia de
      duplicados, incorporar existente y comprobar categoría/competiciones que lo distinguen.
- [ ] Quitar de competición y recuperar el equipo desde biblioteca; incorporarlo de nuevo sin
      crear otra entidad. Eliminar equipo sin partidos y comprobar que desaparece de biblioteca.
- [ ] Intentar eliminar equipo con partido: rechazo visible y alternativa de quitar; cancelar
      conserva relación; confirmar quita relación, mantiene biblioteca y partido.
- [ ] Probar error de guardado reteniendo/abortando petición: campos bloqueados durante envío,
      borrador conservado al fallar y botón reactivado. Reutilizar patrón de la suite 6B.
- [ ] Ejecutar `pnpm e2e:escritura`; conservar los cuatro recorridos de Plantilla/Staff.
- [ ] Ejecutar `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura` secuencialmente
      para los comandos que usan Next. ESLint y formato explícitos sobre archivos modificados.
- [ ] Revisar `git diff --check`, contratos de acciones, ámbito de borrados y ausencia de datos
      privados. No declarar finalizadas tareas con verificaciones pendientes.
- [ ] Actualizar este plan con resultados reales, limitaciones y commits; integrar en main
      conservando cambios ajenos. No fusionar el antiguo worktree base-visual desactualizado.
- [ ] Commit final `test(equipos): verificar gestión y protección del historial`.

## Revisión de cobertura

| Requisito | Tarea |
| --- | --- |
| Homónimos con categoría/competiciones/temporada | T1, T3, T6 |
| Dos guardias trasladadas, no borradas | T5 |
| Motivo del rechazo y alternativa de quitar | T4, T6 |
| Reutilizar FotoFormulario y siembra 6B | T2, T6 |
| Sin escudo y contador | T1, T3, T5 |
| Esquema intacto, acciones limitadas a necesidad | T1, T4, revisión T6 |
| Competición existente sin pérdida de funciones | T3 |
| Patrocinadores fuera | Restricciones globales |

## Límite conocido aprobado

Equipos no muestra Femenino: `categoriaDe` solo devuelve Senior/Veteranos. No se corrige en 6C.
La lectura de catálogo puede contener Femenino para distinguir homónimos; eso no habilita
su gestión desde esta pantalla ni permite inscribirlo en una categoría incompatible.

## Estado de traspaso

Plan commiteado antes de implementar: `0e403f5`.
T1 completada en `codex/fase-6c-equipos`: modelo puro y catálogo en una consulta agrupada.
Validación: 16 pruebas específicas; `pnpm check` con 495 correctas y 1 omitida existente;
ESLint de archivos modificados sin errores. Esquema y mutaciones sin cambios.
Pendientes T2–T6; no se han modificado pantallas todavía.
Primero comprobar árbol y rama; después T1 → T2/T3 → T4 → T5/T6. T2 y T3 comparten contratos:
no asignarlas a agentes que editen simultáneamente AdminEquipos. Las mutaciones de equipos
no se cambian por estética ni para adaptar sus nombres al nuevo componente.
