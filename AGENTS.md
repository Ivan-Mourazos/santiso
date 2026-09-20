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
- `pnpm check` es la puerta de cada commit. `pnpm e2e` se ejecuta al cerrar cada tarea que cambie pantallas; necesita `data/santiso.db` y `DEV_AUTH_BYPASS=1` mientras exista el login.
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
