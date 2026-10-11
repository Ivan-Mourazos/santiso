# Axenda: carrusel, portada y partido

Rama `carteles-axenda`, creada desde `convocatoria` (`f2cafb9`) en `../santiso-carteles`. Diseño aprobado por usuario. Sin fusión ni push.

## Cambios

- Próximos incorpora «Preparar carrusel Axenda»: portada y una lámina por encuentro, hasta cuatro. Detecta todos los encuentros propios de la semana del primero pendiente, incluidos varios de una misma categoría. Conserva rellenado y edición manual.
- PNG ordenados `axenda-1.png`, `axenda-2.png`… Descarga conjunta, descargas individuales de respaldo y compartición de todos los archivos desde un único gesto cuando `navigator.canShare` los admite. Un texto de Instagram editable para todo el carrusel.
- Portada adaptable a uno, dos, tres o cuatro encuentros: categoría, casa/fuera, rival, escudo con color de equipo, día y hora. Sin campo ni competición.
- Partido conserva Diagonal, Enfrentados y lado del Santiso. Rival prioritario; fecha ausente discreta. Añade campo, localidad, competición, jornada, puesto y hasta cinco resultados V/E/D, de antiguo a reciente. Sin bloque deportivo cuando faltan datos; admite datos parciales.
- Publicación 1080×1350 e historia 1080×1920 reutilizan `medidasDe` y margen existente de 250 px arriba/abajo. «Hoxe xogamos» en historia. Exportación real a ×2: 2160×2700 y 2160×3840. Conservada excepción ×1 preexistente de convocatoria, fuera de alcance.
- Consulta Drizzle core de solo lectura, separada por competición y anterior al encuentro. Usa fecha cuando ambas están disponibles y número de jornada como respaldo; con fechas incompletas ordena secuencia por jornada. No inventa puestos en copa o sin resultados. Localidad manual, incluso vacía, manda sobre catálogo. Rechazo de transporte permite reintentar previa.

## Validación

- `pnpm check`: 95 archivos de pruebas, 711 pruebas correctas y una omitida; typecheck, lint y formato correctos.
- `axenda-render.spec.ts`: 8 portadas (1–4 encuentros × publicación/historia), 12 láminas (dos composiciones × dos formatos × contexto completo/parcial/ausente). Nombres largos C.D. Compañía de María y A.C.U.D. Camporrapado. Comprueba por código límites de cada nodo de texto, cajas, lienzo y zonas seguras; verifica ocupación de portada. API PNG real comprueba doble resolución en ambos formatos y plantillas. Tres pruebas correctas.
- Nuevo `movil-axenda.spec.ts`: 360/390 px en WebKit y Android, preparación de tres PNG simulados, orden, caption editable, compartición conjunta, descarga individual, invalidación tras editar, controles ≥44 px y ausencia de desbordamiento. Regresión adicional de fallo de transporte y reintento en ambos motores. Seis pruebas correctas en ejecuciones dirigidas.
- Regresiones unitarias: paquete y esquema hasta cuatro partidos, formato, rachas, corte por fecha/jornada, equipos local/visitante, separación de copa, localidad manual y selección de varios encuentros por categoría. BD sembrada solo en carpeta temporal.
- Puerta `pnpm e2e`: 241/241 correctas en 11,4 minutos, contra BD real de solo lectura con `STUDIO_E2E_URL=http://127.0.0.1:3300`. Incluye Chromium, WebKit móvil y Android. Pruebas móviles existentes siguen válidas tras rediseño, sin cambios.
- Puerta `pnpm e2e:escritura`: 52/52 correctas en 2,6 minutos. Puerto 3111 comprobado libre antes de arrancar; BD de juguete sembrada en carpeta temporal compartida. Sin servidores dev simultáneos en este worktree.

## Muestras y revisión visual

Fuera de Git, en `data/informes/` del worktree:

- `axenda-portada-2.png` — dos encuentros, 2160×2700.
- `axenda-partido-completo.png` — lámina Diagonal completa, 2160×2700.
- `axenda-historia.png` — lámina historia, 2160×3840.

Exportadas por API real e inspeccionadas. Usan escudos del catálogo y datos de demostración; puestos y rachas de muestras son ficticios. No representan una convocatoria ni clasificación publicada. Las veinte variantes se inspeccionaron también en `revision-portada.png`, `revision-partido-diagonal.png` y `revision-partido-enfrentados.png`, con textos contenidos y composición adaptada a cantidad y ausencia de datos.

## Límites y alcance

Compartición del sistema comprobada con `navigator.share` simulado; no comprobada físicamente en Instagram ni hoja nativa de un teléfono. Descarga múltiple puede depender de permisos del navegador; cada archivo dispone de botón individual.

Sin llamadas a Gemini en pruebas ni escritura en BD real. Sin cambios en archivos reservados a Claude, otras pantallas o plantillas protegidas. No se modificaron ni borraron pruebas móviles existentes. Servidores propios cerrados; verificados puertos 3200, 3300 y 3111 sin escucha al terminar. No se tocó 3100 ni `../santiso-estable`.

## Commits

- `63dbaba` Añade paquete Axenda y contexto deportivo de solo lectura.
- `23b267f` Rediseña portada y partido con formato historia y validación visual.
- `674fa9a` Integra carrusel Axenda con descarga conjunta y previa recuperable.

Revisión independiente: tres hallazgos P2 corregidos; segunda revisión de correcciones sin nuevos hallazgos accionables.
