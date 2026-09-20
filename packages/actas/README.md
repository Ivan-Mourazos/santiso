# @santiso/actas

Parser aislado de la ficha PDF de veteranos RFGF. No accede a BD, Supabase ni servicios de IA. Devuelve un borrador que debe revisarse antes de cualquier guardado.

```ts
import { parsearFichaPdf } from "@santiso/actas";
const ficha = await parsearFichaPdf(bytes);
```

## Contrato y límites

- Plantilla de una página validada con dos fichas de veteranos de 2026/27. Máximo 15 MiB. Otros formatos se rechazan; no hay garantía universal para documentos de la federación.
- Columnas local, central y visitante separadas por coordenadas relativas. Fecha y hora literales, sin conversión de zona horaria.
- Goles: autor textual, minuto (incluido descuento), equipo beneficiario y marcador acumulado. Tipo desconocido: no se deducen penaltis ni goles en propia puerta.
- Tarjetas: autor, minuto y equipo. Tipo desconocido porque el texto no codifica el color. Revisión visual/manual necesaria.
- Sustituciones vacías: `no_registradas`. No se calculan minutos ni se presume participación de suplentes. Si hay sustituciones escritas, esta versión rechaza la ficha.
- No asigna UUID ni vincula nombres con jugadores de la BD. Ese adaptador corresponde a la integración posterior.
- Rechaza marcadores inconsistentes, goles incompletos, dorsales duplicados, fechas imposibles y secciones ausentes. Los avisos forman parte obligatoria de la revisión.
- HTML, imágenes, escaneos, lectura de colores y edición manual quedan fuera de esta entrega.

## Pruebas

`pnpm exec vitest run packages/actas/src` desde la raíz. Las fixtures JSON preservan coordenadas de las muestras, con personas y equipos reemplazados. Los PDF son reconstrucciones sintéticas de esos fragmentos (ReportLab Helvetica 5, A4, origen inferior izquierdo al generar). No son originales ni prueban extracción de iconos.

Los PDF originales permanecen fuera del repositorio. Las verificaciones manuales no deben imprimir nombres ni copiar documentos a rutas versionadas.
