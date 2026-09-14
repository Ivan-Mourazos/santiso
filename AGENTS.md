<!-- BEGIN:tooling-env -->
# Tooling & environment

- **Monorepo pnpm:** `apps/studio` (Next.js), `packages/*` (domain, db), `tools/*` (migración). Solo `pnpm`; nunca `npm`/`yarn`.
- **Comandos raíz:** `pnpm dev`, `pnpm build`, `pnpm check` (typecheck + lint + formato + tests), `pnpm test`.
- **Versiones:** compartidas con `catalog:` en `pnpm-workspace.yaml`.
- **Entorno:** `apps/studio/.env.local` (ignorado por git; puede existir aunque la búsqueda de ficheros no lo muestre).
- **Datos locales:** `data/` (ignorado): `santiso.db`, `media/`, `snapshots/`, `backups/`, `informes/`.
- **Arquitectura y hoja de ruta:** `docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`.
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
