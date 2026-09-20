# Santiso Studio

Herramienta local de UD Santiso para carteles, calendario, actas y estadísticas de jugadores. Uso personal en local: no se despliega.

> **Estado (Fase 1):** los datos ya están migrados a SQLite en `data/santiso.db`, pero la app todavía lee y escribe en Supabase hasta la Fase 2. Hoja de ruta: [`docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md`](docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md).

## Requisitos

- Node.js 22.12 o superior
- pnpm 10.33.2 (`corepack enable`)

## Puesta en marcha

```bash
pnpm install
pnpm dev          # http://127.0.0.1:3000/admin (solo accesible desde este equipo)
```

La app lee los datos de `SANTISO_DATA_DIR` (ruta absoluta a `data/`), definida en `apps/studio/.env.local`. Comprueba la conexión con `http://127.0.0.1:3000/api/estado`.

## Estructura

| Ruta | Contenido |
| --- | --- |
| `apps/studio` | App Next.js (panel, carteles, importadores) |
| `packages/domain` | Reglas de negocio puras (categorías, fechas, nombres, temporadas, ajustes) |
| `packages/db` | Esquema Drizzle, migraciones SQL, cliente libSQL y copias |
| `tools/migracion-supabase` | Migración única Supabase → SQLite |
| `data/` | Datos locales (ignorado por git) |
| `docs/` | Especificación, planes y auditorías |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` / `pnpm build` | Arranca o compila la app |
| `pnpm check` | Tipos, lint, formato y pruebas: obligatorio antes de cada commit |
| `pnpm test` | Pruebas (Vitest) |
| `pnpm db:generate --name <nombre>` | Genera una migración tras cambiar el esquema |
| `pnpm db:migrate` | Aplica las migraciones a `data/santiso.db` |
| `pnpm db:backup` | Copia consistente de la BD en `data/backups/` |
| `pnpm db:studio` | Explorador visual de la BD |
| `pnpm migracion:exportar` | Vuelca Supabase a `data/snapshots/` (solo lectura) |
| `pnpm migracion:importar [snapshot]` | Construye `data/santiso.db` desde el último snapshot (hace copia de la anterior) |
| `pnpm migracion:verificar [snapshot]` | Compara la BD con el snapshot |

## Datos y copias de seguridad

- `data/` contiene datos personales (nombres, fechas de nacimiento, fotos): **nunca** se sube a git.
- Haz `pnpm db:backup` con frecuencia y sincroniza `data/backups/` con una carpeta en la nube.
- **Restaurar una copia:** para `pnpm dev`, mueve `data/santiso.db`, `data/santiso.db-wal` y `data/santiso.db-shm` (los que existan) juntos a otro sitio y copia el fichero de `data/backups/` como `data/santiso.db`.
- Importar o restaurar exige la app parada: en Windows, libSQL bloquea el fichero mientras el proceso vive.

## Documentación

- [Arquitectura y hoja de ruta](docs/superpowers/specs/2026-09-13-santiso-studio-local-first.md)
- [Plan de la Fase 1](docs/superpowers/plans/2026-09-13-fase-1-fundacion-datos.md)
- [Auditoría UX/UI](docs/audits/2026-09-13-ux-ui.md)
