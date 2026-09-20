# Fixtures de calendario

- `calendario-senior.json`: 14 equipos, 26 jornadas, 182 partidos; 3 páginas útiles.
- `calendario-veteranos.json`: 16 equipos, 30 jornadas, 240 partidos; 4 páginas útiles.

Contienen fragmentos de texto y coordenadas normalizadas. Se conservan geometría,
orden de extracción, longitudes de nombres, puntuación, guiones internos y saltos
multilínea de las grillas de referencia. Todas las letras de nombres de equipos se
sustituyeron por secuencias sintéticas, y todos los códigos por códigos ficticios
con ceros iniciales. Competición y rótulos institucionales también son sintéticos.
No contienen personas, contactos ni nombres de clubes reales. Solo se extrajeron
páginas de catálogo y jornadas; los anexos quedaron fuera de las fixtures.

Los tests construyen PDFs sintéticos en memoria a partir de estas coordenadas;
no necesitan PDFs originales. Cubren también la fusión de separador y visitante
que puede efectuar PDF.js.

La comprobación privada es opt-in mediante `CALENDARIO_PDFS_PRIVADOS`, un array
JSON de dos rutas locales (sénior y veteranos, en ese orden). Solo comunica
cantidades. No copia originales al repositorio ni guarda su texto.

## Contrato y límites

`parsearCalendarioPdf(Uint8Array)` y `parsearCalendario(paginas)` devuelven
`{ competicion, temporada, equipos, jornadas }`. Cada equipo tiene `nombre` y
`codigoFederativo` textual. Cada jornada tiene `numero`, `fechaNominal`
(`YYYY-MM-DD`) y `partidos` con `local` y `visitante`, ambos objetos de equipo.
**La fecha nominal no es la fecha exacta de cada partido. No se devuelve hora.**

Plantilla soportada: catálogo numerado en primera página y liga a doble vuelta
con primera vuelta en columna izquierda y segunda en derecha. Requiere texto
extraíble, páginas sin girar, 2–40 equipos (cantidad par, sin descansos), 2–20
páginas y como máximo 15 MiB. El pie ocupa el 5% inferior de cada página. No usa
OCR ni intenta recuperar calendarios incompletos. Se detiene antes de anexos
cuando ya tiene todas las jornadas. Los errores no incluyen texto del documento.
