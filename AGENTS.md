<!-- BEGIN:tooling-env -->

# Tooling & environment

- **Monorepo pnpm:** `apps/studio` (Next.js), `packages/*` (domain, db), `tools/*` (migración). Solo `pnpm`; nunca `npm`/`yarn`.
- **Comandos raíz:** `pnpm dev`, `pnpm build`, `pnpm check` (typecheck + lint + formato + tests), `pnpm test`.
- **Versiones:** compartidas con `catalog:` en `pnpm-workspace.yaml`.
- **Entorno:** `apps/studio/.env.local` (ignorado por git; puede existir aunque la búsqueda de ficheros no lo muestre).
- **Datos locales:** `data/` (ignorado): `santiso.db`, `media/`, `snapshots/`, `backups/`, `informes/`.
- **Arquitectura y hoja de ruta:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`.
- **Base de datos:** Drizzle 0.45 (solo query builder core, nunca `db.query`) sobre libSQL. Cambios de esquema: editar `packages/db/src/schema`, `pnpm db:generate --name <cambio>`, pruebas en `packages/db/src/schema.test.ts`.
- **libSQL en Windows:** no libera el fichero hasta que termina el proceso. Para mover o borrar ficheros de BD, hazlo desde otro proceso y con `pnpm dev` parado.
- **Supabase:** solo lectura y solo desde `tools/migracion-supabase` hasta su retirada en la Fase 2.
- `pnpm check` es la puerta de cada commit. `pnpm e2e` se ejecuta al cerrar cada tarea que cambie pantallas; necesita `data/santiso.db` y **solo lee**: corre contra los datos reales.
- Las pruebas que **escriben** van en `apps/studio/e2e-escritura/` y se lanzan con `pnpm e2e:escritura`: siembran una base de datos de juguete en una carpeta temporal y arrancan su propio servidor en el 3111. Ninguna prueba debe escribir en `data/`. Con `pnpm dev` abierto no arrancan (Next no admite dos `next dev` en la misma carpeta).
- **Acceso con usuario y contraseña:** solo se enciende con `STUDIO_ACCESO=1` (lo lleva la copia de uso diario, la que sale por Tailscale); en desarrollo y en el resto de pruebas está apagado y todo se hace como administrador. Con él encendido, `obtenerDb()` no entrega la base sin sesión válida: es la barrera real, `proxy.ts` solo mira que haya cookie. Lo que no pasa por la base (rutas de `app/api` y `app/media`, guardar ficheros) comprueba la sesión por su cuenta (`respuestaSinSesion`, `exigirSesion`). Las tareas del propio servidor van dentro de `comoSistema`. Lo reservado al administrador empieza con `soloAdmin()`. Sus pruebas: `pnpm e2e:acceso` (servidor propio en el 3112, base de juguete).
- **Federación (futgal.es):** solo la copia de uso diario sale a la red (`STUDIO_RFGF_AUTO=1`). De cada jornada se baja su PDF (marcadores, árbitro y, de lo que queda por jugar, día, hora y campo) y el acta de cada partido (goles y tarjetas de todos los equipos, en `liga_eventos`). Lo que publique la federación manda siempre sobre lo del Studio. Nunca se leen los marcadores del HTML. Pocas peticiones y con pausa: tras una ráfaga de unas decenas seguidas la web deja de devolver PDF. Los ensayos, siempre sobre una copia de la base y sin repetir pasadas seguidas.
- **Copia diaria:** con `STUDIO_COPIA_DIARIA=1`, una al día en `data/backups/diarias/` (se guardan 14).
- La base real solo guarda la temporada activa (2025/26 se retiró el 28/09/2026 con `pnpm db:limpiar-temporada`; archivo en `data/backups/`). Las pruebas de solo lectura no pueden contar con temporadas pasadas ni con actas: lo que necesite historial va en `e2e-escritura/`, con datos sembrados en `sembrar.ts`.
- Textos de equipos, campos, competiciones y personas: reglas en `@santiso/domain` (`normalizar*`). Lo que se guarde nuevo debe pasar por ellas.
- **Escritorio y móvil** (decisión del usuario, 05/10/2026): la web se diseña y se prueba en escritorio desde 1280×720 y en móvil desde 360 px de ancho. Actas e Importar jornada funcionan en móvil desde el 06/10/2026: admiten varias capturas de la app de la federación, que el modelo lee juntas. Desde el 13/10/2026 no queda nada reservado a escritorio: el usuario quiere poder hacerlo todo desde el móvil, también el calendario completo (`?origen=calendario`, de la federación o en PDF). Los carteles se piensan para verse en el móvil (Instagram).
- Las capturas de `data/referencias/antes-fase-2/` son la referencia visual para validar las Fases 2B y 2C. Cubren las 9 secciones del panel (escritorio y móvil) y 3 de las 7 plantillas de cartel: partido, proximos y resumo.

<!-- END:tooling-env -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:caveman-rules -->

# Modo Cavernícola (Full) - Español

- Ser breve.
- Ahorrar token.
- Sin charla. Sin relleno.
- Sin artículos ("el", "la") si no necesario.
- Solo técnico. Solo acción.
- Estilo: "[cosa] [acción]. [resultado]. [próximo]."

<!-- END:caveman-rules -->
