# Archivo de partidos históricos

**Objetivo:** guardar partidos solicitados del Santiso en un archivo independiente, sin alimentar calendario ni estadísticas.

**Arquitectura:** tablas propias para partidos y eventos; cola persistida en grupos históricos. `avanzarHistorico` mantiene el candado y reparte sus dos páginas entre cifras y archivo, alternando prioridad cada diez minutos. Cada descarga es un paso persistente, incluidos los fallos.

**Restricciones:** sin red durante este encargo, sin cambios de pantalla, pnpm, bases temporales, ninguna escritura en `data/`, sin merge ni push.

- [x] Añadir pruebas de esquema, claves, estados y cascada; comprobar fallo inicial.
- [x] Añadir esquema y generar migración con `pnpm db:generate --name historico-partidos`.
- [x] Añadir pruebas con descargador simulado y actas PDF existentes: cola, presupuesto, fallos, estados, eventos y aislamiento.
- [x] Implementar descubrimiento por calendario, códigos por HTML y lectura de actas; PDF de jornada solo cuando falte resultado.
- [x] Integrar avance y lecturas en histórico; acciones con `soloAdmin`.
- [x] Comprobar formatos incompatibles, grupos concurrentes y candado ocupado.
- [x] Ejecutar pruebas dirigidas y `pnpm check`; documentar contrato, estimación y salida final real.
- [x] Revisar diff y preparar commit en rama actual; comunicar resultado por Orca al cerrar.

Decisiones: conservar fecha nominal separada de fecha efectiva; no inferir marcador desde HTML; un formato incompatible deja aviso y no inventa eventos; fallos de transporte rotan y se reintentan en otro tic. Acta accesible mediante su código y enlace oficial; este archivo no incorpora personas a la plantilla.
