# Auditoría integral — UD Santiso Studio (17/10/2026)

Informe conjunto. Fuentes detalladas:

- Técnica (Codex, GPT-6.1-Sol, esfuerzo alto): [`2026-10-17-auditoria-tecnica.md`](2026-10-17-auditoria-tecnica.md) — 30 hallazgos H01–H30.
- Producto y UX (Antigravity, Gemini 4 Argon, esfuerzo medio): [`2026-10-17-auditoria-producto-ux.md`](2026-10-17-auditoria-producto-ux.md).
- Supervisión, verificación cruzada y síntesis: Claude (Opus 5.5).

Revisión auditada: `5098373`. Nadie modificó código ni `data/`. Ninguna petición a futgal.es ni a la API del modelo.

## 1. Estado actual

Herramienta madura para un club amateur: ~48.000 líneas TypeScript, 467 commits, monorepo `pnpm` (Next.js 16 + Drizzle/libSQL), 25 tablas, 20 migraciones, ~170 ficheros de prueba. Corre en el PC de Iván; móvil y míster entran por Tailscale con usuario/contraseña (roles admin/técnico). Sincroniza resultados, actas, horarios e históricos desde futgal.es.

Diagnóstico: **base sólida, sin escaladas de permisos encontradas**. Los riesgos reales son de **recuperación** (copias sin fotos), **integridad puntual** (acta con marcador vacío = 0–0 finalizado) y **una puerta de calidad que hoy falla** (`pnpm check`). En producto, lo que más valor añadiría es **cruzar datos que ya existen** (sanciones, minutos, convocados) y un módulo nuevo de **disponibilidad/asistencia**.

## 2. Funcionalidades existentes (verificadas en código)

| Grupo | Secciones |
| --- | --- |
| Competición | Inicio, Jornada (tarjeta de partido con pasos antes/después, avisos RFGF, sanciones y apercibidos), Calendario (+ importación PDF), Clasificación, Estadísticas (tabla ordenable + ficha con cifras oficiales RFGF e historial 5 temporadas), Goleadores y tarjetas (ciclos de amarillas) |
| Plantilla | Jugadores, Cuerpo técnico, Directiva, Multas (apuntar, registro, bote, normas) |
| Producción | Convocatoria (texto WhatsApp, imagen, compartir nativo), Alineación (historia 9:16, compartir), Carteles (motor `cartel2`, 4:5), Importar (capturas/acta leídas por Gemini, lote, calendario completo) |
| Catálogos/Ajustes | Equipos, Patrocinadores y logos, Temporadas, Ajustes gráficos, Usuarios, Mi cuenta |
| Transversal | Login + roles, PWA instalable (`app/manifest.ts`, standalone), sincronización futgal.es automática, copia diaria de BD (14), barra inferior móvil |

**No existen**: entrenamientos/asistencia, disponibilidad o lesiones, minutos jugados (solo titular/jugó), estadísticas de porteros, vista de rendimiento colectivo (rachas, casa/fuera, tramos), informes exportables.

## 3. Lo que conviene conservar

- Separación `domain` / `db` / acciones / consultas; reglas `normalizar*`.
- Barrera de acceso en `obtenerDb()` + `soloAdmin` / `exigirAdmin`; contraseñas scrypt, sesiones con hash, cookies `httpOnly`.
- Restricciones SQL (FK, checks de marcador, una temporada activa) y transacciones en actas, convocatoria y alineación.
- Defensa de rutas de media (path traversal, MIME cerrado sin SVG).
- Scraping prudente de futgal.es: lista de hosts, pausas, timeouts, «la federación manda».
- `TarjetaPartido` como eje del día de partido; Alineación que ya parte de los convocados.
- Suites separadas: lectura / escritura con BD de juguete / acceso. `e2e:acceso` 10/10 y `e2e:escritura` 55/55 hoy.

## 4. Errores y problemas técnicos confirmados

Verificados por Codex y revisados por Claude en el código.

| Id | Severidad | Problema | Fichero |
| --- | --- | --- | --- |
| H27 | Alta | Copias (diaria y manual) solo guardan la BD con `VACUUM INTO`; **fotos y escudos de `media/` no se copian** | `packages/db/src/backup.ts:14`, `lib/server/copias.ts` |
| H17 | Alta | Acta con marcador vacío: `Number("")` = 0 pasa la validación → partido **finalizado 0–0** y eventos sustituidos | `lib/server/acciones/actas.ts:95` |
| H12 | Alta | Imágenes de cartel aceptan cualquier cadena; Chromium del PC puede pedir URLs arbitrarias (SSRF limitado) | `lib/cartel2/esquema.ts:16` |
| H24 | Media | **`pnpm check` falla hoy**: 4 tests (3 timeouts + 1 contaminación) en paralelo; pasan con 1 worker | `vitest.config.ts:13`, `sesion.test.ts:70` |
| H07 | Media | Lectura de PDF (ficha, calendario) se ejecuta antes de comprobar sesión | `lib/server/acciones/fichas.ts:34` |
| H03/H04/H10 | Media | Partidos, alineación, acta e importación de calendario no validan categoría/temporada/inscripción | `acciones/calendario.ts`, `alineacion.ts:47`, `calendario-pdf.ts:150` |
| H08/H09 | Media | APIs Gemini: sin límites de tamaño/MIME, `JSON.parse` sin capturar, respuestas aceptadas por cast | `app/api/admin/*-gemini/route.ts` |
| H29 | Media | Pasada RFGF con errores cuenta como comprobada y gasta la cadencia diaria | `lib/server/rfgf/sincronizar.ts:627` |
| H14 / H13 | Media | Cambio de clave + revocación no atómicos; freno de login solo por usuario y en memoria | `lib/server/acceso/usuarios.ts:97`, `lib/acceso/intentos.ts` |
| H05 | Media | Personas y competiciones se guardan sin `normalizar*` | `acciones/jugadores.ts:59`, `competiciones.ts:35` |
| H11 | Alta en abstracto, **baja en la práctica** | Carrera al crear el primer admin; solo con BD sin usuarios (la tuya ya los tiene) | `acciones/acceso.ts:72` |
| UX | Media | Sin protección de cambios sin guardar en Multas e Importar (lectura de Gemini se pierde con un toque) | `AdminMultas.tsx`, `ImportarFoto.tsx` |
| UX | Baja | Importar calendario PDF arranca en «Senior» ignorando la categoría activa | `ImportarCalendarioPdf.tsx:45` |
| UX | Baja | Barra de acciones de Alineación a 68 px en vez de 56 (hueco de 12 px) | `Alineacion.module.css:213` |

Resto (rendimiento H20–H23, mantenibilidad H01–H02, media huérfana H30): reales pero de baja urgencia con dos usuarios.

### Afirmaciones de Argon descartadas por falsas

| Afirmación | Realidad |
| --- | --- |
| P0: el técnico no puede llegar a «Mi cuenta» ni cerrar sesión en móvil | Inicio → Ajustes → Mi cuenta → Cerrar sesión existe para técnico (`AdminInicio.tsx:113,146`, `MiCuenta.tsx:96`) |
| No hay `manifest.ts` (PWA) | Existe, `display: standalone` |
| Convocatoria no tiene «Compartir» | Usa `navigator.share` (`AdminConvocatoria.tsx:165`) |
| Alineación muestra toda la plantilla sin convocar | Sin once guardado, filtra a los convocados (`consultas/alineacion.ts:183`) |
| Jornada no cruza sanciones | `TarjetaPartido.tsx:142` las muestra (lo que falta es Convocatoria y Alineación) |
| Ruta `/api/admin/convocatoria-png` | No existe |
| «Toda la app usa `showConfirm`» | `window.confirm` sigue en 10 sitios: es un patrón, no una excepción |

## 5. Diseño, navegación y UX (filtrado)

Mantenidas (verificadas, coste S salvo indicación):

1. **Sancionados/apercibidos en Convocatoria y Alineación** (insignia junto al nombre) — el cálculo ya existe en `acciones/liga.ts`. M.
2. **Multas en serie**: conservar motivo y fecha tras apuntar, o selección de varias personas; «Copiar resumen del bote» para WhatsApp; tocar deudor → registro filtrado.
3. **Normas de Multas plegadas** en 360 px (una línea por norma, edición al tocar).
4. **Tras guardar en Importar**: tarjeta con «Ver jornada» y «Hacer cartel de resultado» en vez de formulario vacío.
5. `useUnsavedChanges` en Multas e Importar; categoría de `ImportarCalendarioPdf` desde el contexto; hueco de 12 px en Alineación.
6. **Convocatoria agrupada por demarcación** (POR/DEF/MED/DEL) con recuento.
7. Cartel de convocatoria: botón «Rellenar desde la convocatoria guardada» en `GeneradorCartel`.
8. Legibilidad a pleno sol: suelo de 12 px en tablas móviles (Estadísticas, Calendario) con abreviaturas `PJ`, `TIT`, `GOL`.
9. Unificar amarillo (`#f5c518` frente a `#facc15`) y retirar `components/ui/AdminUI.tsx` (0 usos). Limpieza de `globals.css` heredado: M, hacerla al tocar cada pantalla, no de golpe.
10. Accesibilidad barata: `aria-current="page"` en navegación; `role="tablist"` en Multas e Importar; `inputMode="numeric"` en goles y dorsales.

Descartadas o aplazadas: reconstruir `DataTable` y unificar todas las tablas (M, poco valor percibido); reestructurar todos los `h1/h3` (cosmético); acceso rápido a «Salir» (3 toques es aceptable).

## 6. Nuevas funcionalidades recomendadas

| Funcionalidad | Por qué | Datos | Esfuerzo |
| --- | --- | --- | --- |
| **Minutos jugados** en Estadísticas y ficha | Reparto real de minutos; 88' ≠ 90' | Ya están: `partido_eventos` (cambio con minuto, entra/sale, rojas) + titulares | S–M |
| **Porteros**: porterías a cero, goles encajados en el campo | Iván es portero; reconoce el puesto | Ya están: marcador + minutos de goles + cambios | S |
| **Disponibilidad no médica** por jugador y jornada (disponible / duda / baja / ausente) + nota corta «no anotar datos médicos» | Pregunta de cada viernes; Convocatoria la muestra | Tabla nueva pequeña; nada de diagnósticos (RGPD art. 9) | M |
| **Entrenamientos y asistencia** (todos «asiste», un toque cambia) + «x/2 esta semana» en Convocatoria + pasar faltas/retrasos a Multas | Conecta semana, convocatoria y bote | 2 tablas nuevas; la multa «Non asistencia» ya existe | M |
| **Rendimiento colectivo**: racha 5 partidos, casa/fuera, goles por tramos de 15' | Lectura táctica sin teclear nada | Ya están | M |
| **Previa del rival** en la tarjeta de Jornada: puesto, racha, máximo goleador, sancionados | Scouting gratis con lo que ya baja de futgal.es | `liga_eventos`, clasificación | M |
| **Hitos del jugador** (50/100 partidos con el club) → cartel de homenaje | Contenido para Instagram | `rfgf_historico` + temporada actual | S |
| *(Claude)* **Estado del sistema en Inicio**: última copia válida, última sincronización RFGF correcta/fallida, espacio de `media/` | La app depende de un PC; hoy un fallo pasa inadvertido (H28, H29) | Ya están | S |
| *(Claude)* **Recordatorio de domingo**: si el partido acabó y falta acta/resultado a las X h, aviso en Inicio | Automatiza el cierre de jornada | Ya están | S |

No recomiendo: historial médico de lesiones, GPS/métricas físicas, app nativa, servidor de pago. No encajan en un club amateur ni en la decisión de coste cero.

## 7. Riesgos de seguridad, privacidad y rendimiento

- **Pérdida de datos**: copias en el mismo PC y sin `media/` (H27, H28). Riesgo principal del proyecto.
- **Red**: render de carteles puede hacer peticiones a destinos elegidos por un usuario autenticado (H12). Exposición limitada: solo usuarios de Tailscale.
- **Acceso**: barrera bien diseñada. Quedan endurecimientos: PDF antes de sesión (H07), atomicidad de clave (H14), freno de login (H13), cabeceras sin verificar en la copia estable (H15).
- **Privacidad**: si se añade disponibilidad, nada de datos de salud; solo estados operativos. Retirar `SUPABASE_SERVICE_ROLE_KEY` de `.env.local` si la migración terminó (H16).
- **Dependencias externas**: Gemini sin timeouts ni validación (H02, H08, H09); scraping frágil ante cambios de futgal.es (mitigado con fixtures).
- **Rendimiento**: suficiente para 2 usuarios. Sin cola de render ni límite de píxeles (H20, H21); actuar solo si se nota.

## 8. Top 10 por prioridad

| # | Mejora | Tipo | Origen | Esfuerzo |
| --- | --- | --- | --- | --- |
| 1 | Copia completa BD + `media/` con restauración probada en carpeta temporal y copia fuera del PC | Datos | Codex H27/H28 | M |
| 2 | Rechazar marcador vacío en actas sin tocar datos previos | Bug | Codex H17 | S |
| 3 | Arreglar `pnpm check` (concurrencia de Vitest y aislamiento de `sesion.test.ts`) | Calidad | Codex H24 | S |
| 4 | Sancionados y apercibidos en Convocatoria y Alineación | Deportivo | Argon (corregido) | M |
| 5 | Imágenes de cartel solo `/media/` o `data:`, y bloqueo de red en Playwright | Seguridad | Codex H12 | M |
| 6 | Sesión antes de parsear PDF, clave + revocación en transacción, alta inicial serializada | Seguridad | Codex H07/H14/H11 | S |
| 7 | Minutos jugados y estadísticas de porteros | Deportivo | Argon (verificado) | S–M |
| 8 | Protección de cambios sin guardar en Multas e Importar + multas en serie + resumen del bote | UX móvil | Argon (verificado) | S |
| 9 | Disponibilidad no médica + entrenamientos y asistencia enlazados a Convocatoria y Multas | Nuevo módulo | Argon + Claude | M |
| 10 | Estado del sistema en Inicio (copia, RFGF, avisos de acta pendiente) | Operación | Claude | S |

Después: validación de ámbito categoría/temporada (H03/H04/H10), esquemas Zod para Gemini (H08/H09), normalizar personas/competiciones (H05), reintentos RFGF (H29), rendimiento colectivo, previa del rival, limpieza de CSS.

## 9. Dificultad orientativa

| Escala | Significado | Ejemplos |
| --- | --- | --- |
| S | Menos de 1 día, cambio localizado con su prueba | #2, #3, #6, #8, #10, porteros |
| M | 1–3 días, varios módulos y e2e de escritura | #1, #4, #5, #7, #9 (cada submódulo) |
| L | Más de una semana, por etapas | Partir `AdminActaImporter`/`AdminActaBatch` (H01) |

Bloque recomendado: **#1–#3 primero** (≈ 2–3 días: protegen los datos y desbloquean la puerta de commits). Luego **#4–#8** (≈ 1 semana). **#9–#10** cuando lo apruebe Iván, porque añaden tablas y pantallas nuevas.
