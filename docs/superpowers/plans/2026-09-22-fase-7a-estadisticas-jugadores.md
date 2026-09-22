# Fase 7A — Estadísticas de jugadores: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans, registrar resultados y commits. Solo datos, sin pantallas.

**Objetivo:** obtener estadísticas por jugador, temporada, competición y categoría a partir de participaciones y eventos existentes, conservando dorsal y foto de la inscripción correspondiente.

**Arquitectura:** cálculo puro en packages/domain; consulta Drizzle en Studio que selecciona el ámbito y enriquece resultados con jugadores_temporada. Pruebas sintéticas en BD temporal y auditoría explícita de solo lectura contra BD real.

**Tecnología:** TypeScript estricto, Drizzle core, libSQL, Vitest, tsx. Sin dependencias nuevas, cambios de esquema ni migraciones.

**Especificación:** docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md, Fase 7; encargo 7A facilitado por el usuario el 22/09/2026.

**Base:** commit solicitado 742e659. main local sigue en 1b1513e; 742e659 pertenece a fase-6d. Worktree aislado fase-7a-estadisticas, rama codex/fase-7a-estadisticas. No cambiar ni incorporar archivos sin commit de Claude.

## Restricciones

- Plan en commit antes de implementar T1.
- No tocar AdminSponsors, admin/patrocinadores/**, AdminCartelAssets, lib/patrocinadores/**, acciones/consultas/patrocinadores, acciones/ajustes-cartel, useCartelAssets, navigation/contexto, e2e/humo.spec.ts, e2e/media.spec.ts ni e2e-escritura/sembrar.ts.
- No pantallas, endpoints, escrituras en datos reales, migraciones, claves ni cambios de configuración privada.
- Solo pnpm, Drizzle core; leer guías Next instaladas antes de cambios de framework.
- Consulta sin N+1; no unir eventos y participaciones directamente multiplicando filas.
- No atribuir dorsal/foto actuales a temporadas antiguas. No filtrar estadísticas usando categoría actual de persona.
- pnpm check antes de commits; lint/formato explícitos de archivos Studio tocados.

## Reglas y límites comprobados

1. Cada participación única partido/jugador cuenta una convocatoria; titular y jugo proceden de sus flags. Un suplente convocado sin jugar no suma partido jugado. No inferir participación a partir de tarjetas o cambios, ni inventar sustituciones de veteranos.
2. Contar eventos una vez por ID. Gol normal: tipo gol, lado propio, propia false y jugadorId no nulo. Gol propio del Santiso: tipo gol, lado rival, propia true y jugadorId no nulo; suma golesPropia y nunca goles.
3. Los demás eventos del rival no suman a ningún jugador, incluso si una entrada defectuosa incluye jugadorId. Gol en propia del rival (lado propio, propia true) no corresponde a nuestro goleador.
4. Amarillas/rojas: solo lado propio y jugador identificado; sumar tipos tal como están almacenados. Doble amarilla ya se representa como roja: no convertir dos amarillas en otra roja.
5. El esquema actual no almacena penalti. Devolver golesPenalti: null con disponibilidad explícita false. No devolver cero ni separar goles normales de penaltis por heurísticas; ambos forman goles. Sin ampliar esquema en 7A.
6. Filtros de temporada y categoría obligatorios en la consulta, competición opcional. Validar que competición pertenece a ambas; un filtro incompatible falla explícitamente, no devuelve estadísticas de otra temporada.
7. Contar datos registrados en partidos del ámbito sin filtro implícito de estado: el encargo exige reconciliación con todos los eventos guardados. No reconstruir datos a partir del marcador.
8. Plantilla inscrita sin participaciones aparece con ceros. Jugadores con estadísticas pero sin inscripción correspondiente permanecen en resultado con dorsal/foto null y aviso de inscripción ausente; nunca ocultar goles para hacer un inner join.
9. Balance: goles del lado propio = goles atribuidos + goles en propia del rival + goles propios sin autor. Publicar recuentos de estas excepciones en auditoría. La suma de goles de jugadores debe igualar los eventos propios no-propia con autor; además comprobar el balance completo.
10. Si aparecen datos incoherentes, informar y no corregir BD real. Datos personales no deben aparecer en el informe: identificadores técnicos y recuentos bastan.

## T1 — Cálculo puro

Archivos nuevos: packages/domain/src/estadisticas-jugadores.ts y .test.ts. Exportar desde packages/domain/src/index.ts.

Contratos:

```ts
interface ParticipacionEstadistica {
  partidoId: string; jugadorId: string; titular: boolean; jugo: boolean;
}
interface EventoEstadistica {
  id: string; partidoId: string; jugadorId: string | null;
  tipo: TipoEvento; lado: LadoEvento; propia: boolean;
}
interface EstadisticaJugador {
  jugadorId: string; convocados: number; titularidades: number;
  partidosJugados: number; goles: number; golesPropia: number;
  amarillas: number; rojas: number; golesPenalti: null;
}
// Importar TipoEvento/LadoEvento del catálogo del dominio.
// Entradas ya delimitadas por consulta; sin acceso a BD, reloj ni variables globales.
function calcularEstadisticasJugadores(
  participaciones: readonly ParticipacionEstadistica[],
  eventos: readonly EventoEstadistica[],
): EstadisticaJugador[];
```

- [ ] Escribir tests RED: suplente sin jugar, titular, suplente que jugó, dos partidos del mismo jugador, duplicado de participación, evento repetido por ID, dos goles distintos en mismo minuto, evento sin participación, entradas vacías e inmutabilidad.
- [ ] Tests de reglas: gol normal, propia de cada lado, evento rival con ID propio, autor null, amarilla y roja sin doble conversión, cambio no suma estadística, penalti null.
- [ ] Ejecutar pnpm test packages/domain/src/estadisticas-jugadores.test.ts y comprobar fallos pertinentes.
- [ ] Implementar Map por jugador y Sets de identidades; duplicados idénticos no inflan totales. Orden estable por jugadorId. No deduplicar goles por minuto.
- [ ] Ejecutar tests, pnpm check y commit feat(estadisticas): calcular estadísticas puras de jugadores.

## T2 — Consulta por ámbito e inscripción anual

Archivos nuevos: apps/studio/lib/server/consultas/estadisticas-jugadores.ts y .test.ts. No modificar consulta de jugadores compartida.

Contrato: listarEstadisticasJugadores({ temporadaId: string, categoria: Categoria, competicionId?: string }): Promise<EstadisticasTemporada>. Importar Categoria del dominio. Resultado con filas, ámbito y disponibilidadPenaltis:false. Cada fila extiende EstadisticaJugador con nombre, apodo, dorsal, fotoUrl e inscripcionAusente. Dorsal/foto null si falta inscripción.

- [ ] Crear fixture temporal propia usando utilidades existentes de db, sin tocar siembra e2e. Dos temporadas, dos categorías, competiciones, jugador compartido con dorsal/foto diferentes, jugador inscrito sin partidos y jugador con evento sin inscripción.
- [ ] Tests RED: filtro no mezcla años/categorías/competiciones; foto/dorsal correctos; ceros para plantilla inactiva; no desaparece autor sin inscripción; competición incompatible rechazada.
- [ ] Leer competición/temporada; seleccionar participaciones y eventos mediante joins partidos -> jornadas -> competiciones, en consultas independientes. Aplicar mismos predicados de ámbito a ambas.
- [ ] Leer inscripciones por temporada/categoría y personas necesarias. Agrupar con cálculo puro; completar ceros de inscritos y conservar autores sin inscripción. Convertir foto anual mediante urlMedia. Orden por dorsal (null al final), nombre e ID.
- [ ] Probar que múltiples eventos no multiplican convocatorias y dos inscripciones no duplican jugador en una categoría. Manejar inexistencia de temporada explícitamente con error legible.
- [ ] Tests dirigidos, pnpm check, ESLint/Prettier explícitos y commit feat(estadisticas): consultar resultados con inscripción de temporada.

## T3 — Reconciliación real de solo lectura

Archivo nuevo: apps/studio/scripts/verificar-estadisticas.ts. Pruebas sintéticas del balance en un archivo .test.ts del dominio o de consultas; script real fuera de suite ordinaria.

- [ ] Script recibe ruta absoluta de BD por argumento obligatorio; abrir conexión libSQL modo read, sin abrirDb (puede configurar WAL), sin migrar, sin seed, sin escribir informe en data. Comprobar existencia antes para no crear archivo vacío.
- [ ] Ejecutar lectura consistente en transacción read. Recorrer ámbitos temporada/categoría y cada competición; SQL independiente cuenta eventos y participaciones. Comparar resultados del cálculo y enriquecimiento, sin reutilizar el mismo algoritmo para producir lo esperado.
- [ ] Invariantes: suma convocados = filas de participación; titularidades/jugados = sumas flags; goles = propios no-propia con autor; propias = rival propia con autor; amarillas/rojas = tipos propios con autor; balance completo según regla 9.
- [ ] Verificar asignación de cada jugador además de totales globales; un intercambio de goleadores no debe pasar. Incluir comprobación de cobertura de inscripciones y fotos/dorsales, sin imprimir nombres o rutas de media.
- [ ] Ejecutar contra data/santiso.db original con conexión estrictamente de lectura. Imprimir ámbito y recuentos, anomalías y exit 1 si hay discrepancia. No arreglar datos para lograr resultado verde.
- [ ] Añadir prueba con inconsistencia deliberada que falle reconciliación, y casos propios de rival/sin autor que satisfagan balance explicado.
- [ ] Registrar comandos/resultados agregados aquí, pnpm check, lint/formato y commit test(estadisticas): reconciliar cálculos con eventos y participaciones.

## Cierre

- [ ] Revisar diff contra 742e659: solo archivos de 7A, sin esquema/pantallas ni archivos reservados de 6D.
- [ ] Registrar resultados unitarios, integración y auditoría real; no afirmar desglose de penalti disponible.
- [ ] Dejar rama lista para revisión/integración, sin fusionar sobre trabajo activo de Claude.

Estado inicial: plan redactado; T1–T3 pendientes. Al continuar, comprobar cambios del repositorio principal antes de compartir o fusionar. No copiar data ni .env.local al worktree.
