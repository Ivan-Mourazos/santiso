<!-- BEGIN:tooling-env -->
# Tooling & environment

- **Package manager:** `pnpm` only (`pnpm install`, `pnpm run dev`, `pnpm run build`, …). Do not use `npm`/`yarn` in this repo unless the user explicitly asks.
- **Env vars:** Next.js reads **`.env.local`** (and other `.env*` files). That file is usually gitignored, so agent file search may not list it; it can still exist on disk and is what `next build` uses locally.
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
