# Fase 6H — Importar jornada: plan de implementación

> Para agentes: ejecutar por tareas con superpowers:executing-plans. Los pasos van con `- [ ]`.

**Objetivo:** pasar las dos pantallas de «Importar jornada» —foto con Gemini (`AdminJornadaImporter`, 1.013 líneas, 270 de ellas `<style jsx>`) y calendario PDF (`AdminCalendarioPdf`, 277)— a los componentes de la Fase 3A, sin cambiar qué se detecta ni cómo se guarda. Son las últimas pantallas con estilos viejos.

**Arquitectura:** misma receta que la 8A y la 6G. La lógica (emparejado de equipos y campos, detección de competición y jornada, `saveSelected`) se conserva; cambia el marcado. Carpeta `components/admin/importar/`.

## Restricciones

- No tocar `app/api/admin/jornada-gemini/**`, `lib/server/acciones/calendario*.ts` ni `packages/actas/**`.
- **Ninguna prueba llama a Gemini:** la ruta `/api/admin/jornada-gemini` se simula siempre con `page.route`.
- `pnpm e2e` solo lee; guardar partidos se prueba en `e2e-escritura/`, sobre «Copa Calendario».
- `pnpm check` antes de cada commit; ESLint y Prettier explícitos en `apps/studio`.

## Defectos de partida

- `saveSelected` apaga el estado ocupado fuera de un `finally`: si la red falla al guardar, la pantalla se queda en «Guardando partidos…» para siempre.
- Categoría, competición y jornada de destino solo aparecen después de analizar; antes no se ve dónde se va a guardar.
- Etiquetas sueltas (`input-group`), un campo de archivo oculto con `display: none` y botones sin nombre distintivo por fila.
- La fecha de cada fila es un texto libre con formato `YYYY-MM-DDTHH:MM`. **Se queda como texto:** Gemini a veces devuelve solo el día, y un `datetime-local` lo dejaría en blanco. Se le pone etiqueta y el formato como ayuda.

## T1 — Pruebas

- [ ] `e2e/importar-jornada.spec.ts` (solo lectura): etiquetas asociadas en las dos pantallas; con Gemini simulado y las Server Actions bloqueadas tras la carga, analizar una captura enseña filas revisables con sus equipos enlazados, y descansa se marca aparte; nada se guarda; 360 y 1280 sin desbordes.
- [ ] `e2e-escritura/importar-jornada-escritura.spec.ts`: Gemini simulado devuelve «Copa Calendario», jornada 7 y un partido. La pantalla detecta competición, ofrece crear la jornada 7, la crea, guarda el partido tras confirmar, y Calendario lo enseña en la jornada 7 con su marcador.
- [ ] Una prueba del fallo al guardar: con la acción cortada, la pantalla lo dice y deja reintentar.

## T2 — Pantallas

- [ ] Importador de foto: `Field`/`Select`/`Button`, módulo CSS, tarjetas de revisión con etiquetas por fila («Local de la fila 1»…), destino (categoría, competición, jornada) visible desde el principio, `finally` en el guardado.
- [ ] Calendario PDF: mismo tratamiento. Conservar los `id` `#cal-competicion` y `#cal-file`, que usa su prueba.
- [ ] Cero `style={{`, `style jsx` e `input-group` en los dos ficheros.

## Cierre

- [ ] `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm e2e:escritura`. Fusionar y empujar.
