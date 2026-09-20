# @santiso/actas

Lectura local y determinista de fichas de partido y calendarios RFGF. No usa OCR, IA ni BD. Los resultados son borradores para revisión y confirmación antes de guardar.

```ts
import { parsearFichaPdf, parsearCalendarioPdf } from "@santiso/actas";
const ficha = await parsearFichaPdf(bytesFicha);
const calendario = await parsearCalendarioPdf(bytesCalendario);
```

## Fichas de partido (contrato versión 2)

Plantilla de una página, validada con dos fichas de veteranos 2026/27 y tres de Tercera Futgal 2025/26. Máximo 15 MiB. No es un parser universal de cualquier documento federativo.

- Columnas separadas por coordenadas. Fecha y hora literales, sin conversión de zona horaria. Minutos de descuento normalizados: `45'+1` → `45+1`.
- Titulares y suplentes de ambos equipos; los suplentes no se consideran participantes automáticamente.
- Goles con autor, equipo del autor cuando la coincidencia es única, beneficiario y marcador acumulado. El gol en propia se identifica cruzando autor y plantilla contraria al beneficiario; se avisa para confirmación. Homónimos entre equipos dejan el tipo desconocido.
- Los PDF examinados NO distinguen penaltis: nunca se clasifican como gol normal por omisión. Añadir penalti fallado o modificar el tipo de gol corresponde a la revisión manual futura.
- Tarjetas amarilla, roja y doble amarilla mediante iconos incrustados de paleta y dimensiones verificadas. Iconos desconocidos mantienen tipo desconocido, incluido reconocimiento parcial de una doble amarilla. Iconos sin texto asociado o con asociación ambigua provocan rechazo explícito. Una doble amarilla se representa como un único evento `doble_amarilla`; el consumidor debe interpretar la segunda amonestación y expulsión sin duplicar el evento.
- Destinatario de tarjeta: jugador, técnico o desconocido. Sanciones al técnico no se suman a estadísticas de jugadores. Tarjetas repetidas se conservan y generan aviso, nunca se convierten automáticamente en roja.
- Sustituciones con jugador que entra/sale, equipo y minuto. Valida dorsal/nombre contra convocatoria y, cuando están disponibles, dirección de flechas. Vacío significa `no_registradas`, también por equipo en `coberturaSustituciones`; no se calculan minutos jugados.
- No vincula nombres con UUID de BD. No acepta marcador incoherente, goles incompletos, dorsales duplicados, fechas imposibles, secciones ausentes o cambio incompleto.
- PDF girado, multipágina o sin texto: rechazo explícito. HTML, escaneos y otros formatos quedan fuera.

## Calendarios

Devuelve competición, temporada, equipos/códigos federativos y jornadas con partidos local/visitante. `fechaNominal` es la fecha de jornada publicada; NO es la fecha/hora confirmada de cada partido.

Resuelve nombres contra el catálogo de la primera página para conservar guiones internos y líneas partidas. Valida integridad de jornadas, equipos y cruces ida/vuelta. No devuelve contactos, teléfonos ni direcciones de las páginas informativas. Las pruebas cubren los calendarios suministrados de 14 y 16 equipos, ambos de doble vuelta.

## Alineación aportada

El PDF de alineación identifica portero `(P)` y capitán `(C)` y repite la convocatoria. Sus casillas de tarjetas están vacías: no prueba ausencia de sanciones ni minutos jugados. No se importa en esta entrega; queda como posible fuente complementaria de portero/capitán al diseñar revisión de alineaciones.

## Pruebas y privacidad

`pnpm exec vitest run packages/actas/src` desde la raíz. Fixtures JSON anonimizadas conservan estructura/coordenadas; PDF sintéticos regenerados con ReportLab (Helvetica 5, A4, origen inferior izquierdo). Los únicos gráficos tomados de las fichas son los pequeños iconos de tarjeta/flecha, sin datos personales. Los originales permanecen fuera de Git.

La aplicación todavía no consume estos parsers. Integración posterior: cargar archivo, mostrar borrador y avisos, resolver destino e identidades, confirmar y guardar transaccionalmente. No sobrescribir correcciones manuales al reimportar sin revisión explícita.
