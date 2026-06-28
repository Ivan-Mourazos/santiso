/**
 * Corrige resultados de Veteranos - Division de Honor.
 *
 * Uso:
 *   node scripts/fix-veteranos-division-honor-resultados.mjs
 *   node scripts/fix-veteranos-division-honor-resultados.mjs --apply
 *   node scripts/fix-veteranos-division-honor-resultados.mjs --competicion-id=<uuid> --apply
 *
 * Por defecto solo valida y muestra cambios. Con --apply actualiza:
 * goles_local, goles_visitante, estado="finalizado".
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const APPLY = process.argv.includes("--apply");
const INSERT_MISSING = process.argv.includes("--insert-missing");
const ARCHIVE_EXTRAS = process.argv.includes("--archive-extras");
const competicionArg = process.argv.find((arg) => arg.startsWith("--competicion-id="));
const COMPETICION_ID = competicionArg?.split("=")[1]?.trim();
const listJornadaArg = process.argv.find((arg) => arg.startsWith("--list-jornada="));
const LIST_JORNADA = listJornadaArg ? Number(listJornadaArg.split("=")[1]) : null;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const RESULTS = [
  {
    jornada: 1,
    matches: [
      ["CD BOIRO VETERANOS", 0, 3, "SOCIEDADE DEPORTIVA O PINO"],
      ["VETERANOS ORDENES", 0, 2, "CARREIRA C.F."],
      ["NEGREIRA VETERANOS", 2, 0, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["C.F. VETERANOS CAMPORRAPADO", 1, 0, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["C.D. BELVIS", 1, 1, "B&B FISIOTERAPIA"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 1, 1, "SIGUEIRO F.C."],
      ["BAR NOVAIS PORTOMOURO", 1, 0, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["U.D. SANTISO F.C. SOLAINA", 2, 4, "C.F. NOIA VETERANOS"],
    ],
  },
  {
    jornada: 2,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 3, 2, "U.D. SANTISO F.C. SOLAINA"],
      ["SIGUEIRO F.C.", 3, 2, "C.D. BELVIS"],
      ["CARREIRA C.F.", 0, 1, "C.F. VETERANOS CAMPORRAPADO"],
      ["SOCIEDADE DEPORTIVA O PINO", 3, 3, "NEGREIRA VETERANOS"],
      ["B&B FISIOTERAPIA", 2, 1, "VETERANOS ORDENES"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 0, "BAR NOVAIS PORTOMOURO"],
      ["C.F. NOIA VETERANOS", 0, 4, "CD BOIRO VETERANOS"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 1, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
    ],
  },
  {
    jornada: 3,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 0, 3, "CARREIRA C.F."],
      ["C.F. VETERANOS CAMPORRAPADO", 2, 1, "B&B FISIOTERAPIA"],
      ["NEGREIRA VETERANOS", 3, 1, "C.F. NOIA VETERANOS"],
      ["BAR NOVAIS PORTOMOURO", 1, 2, "SOCIEDADE DEPORTIVA O PINO"],
      ["U.D. SANTISO F.C. SOLAINA", 0, 2, "CD BOIRO VETERANOS"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 3, 3, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["VETERANOS ORDENES", 0, 4, "SIGUEIRO F.C."],
      ["C.D. BELVIS", 4, 6, "AMIO S.D. HOSPEDAJE JOSE REY"],
    ],
  },
  {
    jornada: 4,
    matches: [
      ["CARREIRA C.F.", 0, 3, "U.D. SANTISO F.C. SOLAINA"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 4, 1, "C.D. BELVIS"],
      ["SOCIEDADE DEPORTIVA O PINO", 2, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["CD BOIRO VETERANOS", 3, 1, "NEGREIRA VETERANOS"],
      ["SIGUEIRO F.C.", 2, 3, "C.F. VETERANOS CAMPORRAPADO"],
      ["C.F. NOIA VETERANOS", 2, 4, "BAR NOVAIS PORTOMOURO"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 3, 1, "VETERANOS ORDENES"],
      ["B&B FISIOTERAPIA", 4, 1, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
    ],
  },
  {
    jornada: 5,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 2, 3, "SIGUEIRO F.C."],
      ["CARREIRA C.F.", 3, 2, "B&B FISIOTERAPIA"],
      ["VETERANOS ORDENES", 4, 1, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 3, 1, "C.F. NOIA VETERANOS"],
      ["C.F. VETERANOS CAMPORRAPADO", 2, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["BAR NOVAIS PORTOMOURO", 4, 3, "CD BOIRO VETERANOS"],
      ["C.D. BELVIS", 2, 3, "SOCIEDADE DEPORTIVA O PINO"],
      ["U.D. SANTISO F.C. SOLAINA", 2, 4, "NEGREIRA VETERANOS"],
    ],
  },
  {
    jornada: 6,
    matches: [
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 1, "C.F. VETERANOS CAMPORRAPADO"],
      ["SOCIEDADE DEPORTIVA O PINO", 3, 1, "VETERANOS ORDENES"],
      ["NEGREIRA VETERANOS", 0, 2, "BAR NOVAIS PORTOMOURO"],
      ["B&B FISIOTERAPIA", 6, 1, "U.D. SANTISO F.C. SOLAINA"],
      ["SIGUEIRO F.C.", 2, 1, "CARREIRA C.F."],
      ["CD BOIRO VETERANOS", 4, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["C.F. NOIA VETERANOS", 0, 2, "C.D. BELVIS"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 1, 1, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
    ],
  },
  {
    jornada: 7,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 0, 1, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["CARREIRA C.F.", 3, 2, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["VETERANOS ORDENES", 0, 3, "C.F. NOIA VETERANOS"],
      ["C.F. VETERANOS CAMPORRAPADO", 2, 2, "SOCIEDADE DEPORTIVA O PINO"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 1, 1, "NEGREIRA VETERANOS"],
      ["B&B FISIOTERAPIA", 1, 1, "SIGUEIRO F.C."],
      ["U.D. SANTISO F.C. SOLAINA", 1, 2, "BAR NOVAIS PORTOMOURO"],
      ["C.D. BELVIS", 1, 6, "CD BOIRO VETERANOS"],
    ],
  },
  {
    jornada: 8,
    matches: [
      ["SOCIEDADE DEPORTIVA O PINO", 4, 0, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["NEGREIRA VETERANOS", 7, 1, "C.D. BELVIS"],
      ["BAR NOVAIS PORTOMOURO", 3, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 1, 1, "CARREIRA C.F."],
      ["CD BOIRO VETERANOS", 2, 0, "VETERANOS ORDENES"],
      ["SIGUEIRO F.C.", 3, 3, "U.D. SANTISO F.C. SOLAINA"],
      ["C.F. NOIA VETERANOS", 5, 1, "C.F. VETERANOS CAMPORRAPADO"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 2, 3, "B&B FISIOTERAPIA"],
    ],
  },
  {
    jornada: 9,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 3, 2, "C.F. NOIA VETERANOS"],
      ["C.F. VETERANOS CAMPORRAPADO", 2, 2, "CD BOIRO VETERANOS"],
      ["U.D. SANTISO F.C. SOLAINA", 7, 3, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["CARREIRA C.F.", 1, 4, "SOCIEDADE DEPORTIVA O PINO"],
      ["B&B FISIOTERAPIA", 2, 0, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["C.D. BELVIS", 1, 5, "BAR NOVAIS PORTOMOURO"],
      ["SIGUEIRO F.C.", 3, 0, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["VETERANOS ORDENES", 2, 0, "NEGREIRA VETERANOS"],
    ],
  },
  {
    jornada: 10,
    matches: [
      ["CD BOIRO VETERANOS", 4, 2, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["NEGREIRA VETERANOS", 1, 0, "C.F. VETERANOS CAMPORRAPADO"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 5, 3, "C.D. BELVIS"],
      ["BAR NOVAIS PORTOMOURO", 2, 0, "VETERANOS ORDENES"],
      ["C.F. NOIA VETERANOS", 2, 0, "CARREIRA C.F."],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 2, "SIGUEIRO F.C."],
      ["SOCIEDADE DEPORTIVA O PINO", 3, 0, "B&B FISIOTERAPIA"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 5, 2, "U.D. SANTISO F.C. SOLAINA"],
    ],
  },
  {
    jornada: 11,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 1, 0, "NEGREIRA VETERANOS"],
      ["C.F. VETERANOS CAMPORRAPADO", 2, 2, "BAR NOVAIS PORTOMOURO"],
      ["CARREIRA C.F.", 0, 2, "CD BOIRO VETERANOS"],
      ["VETERANOS ORDENES", 0, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["U.D. SANTISO F.C. SOLAINA", 0, 3, "C.D. BELVIS"],
      ["SIGUEIRO F.C.", 0, 1, "SOCIEDADE DEPORTIVA O PINO"],
      ["B&B FISIOTERAPIA", 1, 1, "C.F. NOIA VETERANOS"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 4, 0, "TERRAS DE TOURO - PREVEDINOS S.D."],
    ],
  },
  {
    jornada: 12,
    matches: [
      ["PREFABRICADOS FARO RODEIRO VETERANS", 1, 2, "C.F. VETERANOS CAMPORRAPADO"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 2, 1, "U.D. SANTISO F.C. SOLAINA"],
      ["SOCIEDADE DEPORTIVA O PINO", 4, 0, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["C.F. NOIA VETERANOS", 0, 3, "SIGUEIRO F.C."],
      ["NEGREIRA VETERANOS", 0, 2, "CARREIRA C.F."],
      ["CD BOIRO VETERANOS", 3, 1, "B&B FISIOTERAPIA"],
      ["BAR NOVAIS PORTOMOURO", 2, 2, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["C.D. BELVIS", 2, 3, "VETERANOS ORDENES"],
    ],
  },
  {
    jornada: 13,
    matches: [
      ["CARREIRA C.F.", 1, 1, "BAR NOVAIS PORTOMOURO"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 2, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["U.D. SANTISO F.C. SOLAINA", 2, 3, "VETERANOS ORDENES"],
      ["C.F. VETERANOS CAMPORRAPADO", 0, 1, "C.D. BELVIS"],
      ["SIGUEIRO F.C.", 1, 2, "CD BOIRO VETERANOS"],
      ["B&B FISIOTERAPIA", 1, 1, "NEGREIRA VETERANOS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 3, "SOCIEDADE DEPORTIVA O PINO"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 3, 0, "C.F. NOIA VETERANOS"],
    ],
  },
  {
    jornada: 14,
    matches: [
      ["PREFABRICADOS FARO RODEIRO VETERANS", 5, 5, "CARREIRA C.F."],
      ["NEGREIRA VETERANOS", 2, 1, "SIGUEIRO F.C."],
      ["C.F. NOIA VETERANOS", 2, 1, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["U.D. SANTISO F.C. SOLAINA", 1, 1, "SOCIEDADE DEPORTIVA O PINO"],
      ["CD BOIRO VETERANOS", 3, 2, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["VETERANOS ORDENES", 0, 1, "C.F. VETERANOS CAMPORRAPADO"],
      ["BAR NOVAIS PORTOMOURO", 3, 2, "B&B FISIOTERAPIA"],
      ["C.D. BELVIS", 2, 3, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
    ],
  },
  {
    jornada: 15,
    matches: [
      ["SOCIEDADE DEPORTIVA O PINO", 6, 1, "C.F. NOIA VETERANOS"],
      ["B&B FISIOTERAPIA", 6, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 3, "CD BOIRO VETERANOS"],
      ["CARREIRA C.F.", 4, 1, "C.D. BELVIS"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 5, 0, "VETERANOS ORDENES"],
      ["C.F. VETERANOS CAMPORRAPADO", 1, 1, "U.D. SANTISO F.C. SOLAINA"],
      ["SIGUEIRO F.C.", 5, 1, "BAR NOVAIS PORTOMOURO"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 4, 3, "NEGREIRA VETERANOS"],
    ],
  },
  {
    jornada: 16,
    matches: [
      ["C.F. NOIA VETERANOS", 5, 3, "U.D. SANTISO F.C. SOLAINA"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 0, 0, "C.F. VETERANOS CAMPORRAPADO"],
      ["SIGUEIRO F.C.", 3, 0, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 3, "NEGREIRA VETERANOS"],
      ["B&B FISIOTERAPIA", 4, 1, "C.D. BELVIS"],
      ["CARREIRA C.F.", 0, 0, "VETERANOS ORDENES"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 1, 3, "BAR NOVAIS PORTOMOURO"],
      ["SOCIEDADE DEPORTIVA O PINO", 1, 2, "CD BOIRO VETERANOS"],
    ],
  },
  {
    jornada: 17,
    matches: [
      ["C.F. VETERANOS CAMPORRAPADO", 4, 1, "CARREIRA C.F."],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 3, 2, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["VETERANOS ORDENES", 2, 0, "B&B FISIOTERAPIA"],
      ["U.D. SANTISO F.C. SOLAINA", 1, 2, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["BAR NOVAIS PORTOMOURO", 4, 1, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["CD BOIRO VETERANOS", 4, 2, "C.F. NOIA VETERANOS"],
      ["NEGREIRA VETERANOS", 0, 3, "SOCIEDADE DEPORTIVA O PINO"],
      ["C.D. BELVIS", 0, 3, "SIGUEIRO F.C."],
    ],
  },
  {
    jornada: 18,
    matches: [
      ["B&B FISIOTERAPIA", 1, 5, "C.F. VETERANOS CAMPORRAPADO"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 3, 3, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["SOCIEDADE DEPORTIVA O PINO", 0, 1, "BAR NOVAIS PORTOMOURO"],
      ["CD BOIRO VETERANOS", 3, 1, "U.D. SANTISO F.C. SOLAINA"],
      ["SIGUEIRO F.C.", 2, 0, "VETERANOS ORDENES"],
      ["C.F. NOIA VETERANOS", 2, 1, "NEGREIRA VETERANOS"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 4, 2, "C.D. BELVIS"],
      ["CARREIRA C.F.", 2, 7, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
    ],
  },
  {
    jornada: 19,
    matches: [
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 2, 0, "B&B FISIOTERAPIA"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 1, 0, "SOCIEDADE DEPORTIVA O PINO"],
      ["U.D. SANTISO F.C. SOLAINA", 4, 1, "CARREIRA C.F."],
      ["NEGREIRA VETERANOS", 2, 0, "CD BOIRO VETERANOS"],
      ["VETERANOS ORDENES", 2, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["BAR NOVAIS PORTOMOURO", 2, 1, "C.F. NOIA VETERANOS"],
      ["C.F. VETERANOS CAMPORRAPADO", 1, 3, "SIGUEIRO F.C."],
      ["C.D. BELVIS", 4, 2, "TERRAS DE TOURO - PREVEDINOS S.D."],
    ],
  },
  {
    jornada: 20,
    matches: [
      ["SIGUEIRO F.C.", 1, 2, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["CD BOIRO VETERANOS", 2, 1, "BAR NOVAIS PORTOMOURO"],
      ["NEGREIRA VETERANOS", 1, 4, "U.D. SANTISO F.C. SOLAINA"],
      ["B&B FISIOTERAPIA", 3, 1, "CARREIRA C.F."],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 0, 2, "VETERANOS ORDENES"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 3, 3, "C.F. VETERANOS CAMPORRAPADO"],
      ["SOCIEDADE DEPORTIVA O PINO", 4, 2, "C.D. BELVIS"],
      ["C.F. NOIA VETERANOS", 5, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
    ],
  },
  {
    jornada: 21,
    matches: [
      ["CARREIRA C.F.", 2, 3, "SIGUEIRO F.C."],
      ["C.F. VETERANOS CAMPORRAPADO", 1, 2, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 1, 3, "CD BOIRO VETERANOS"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 1, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["BAR NOVAIS PORTOMOURO", 2, 2, "NEGREIRA VETERANOS"],
      ["VETERANOS ORDENES", 0, 1, "SOCIEDADE DEPORTIVA O PINO"],
      ["C.D. BELVIS", 4, 1, "C.F. NOIA VETERANOS"],
      ["U.D. SANTISO F.C. SOLAINA", 0, 2, "B&B FISIOTERAPIA"],
    ],
  },
  {
    jornada: 22,
    matches: [
      ["BAR NOVAIS PORTOMOURO", 6, 0, "U.D. SANTISO F.C. SOLAINA"],
      ["NEGREIRA VETERANOS", 5, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 3, 1, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["SIGUEIRO F.C.", 1, 3, "B&B FISIOTERAPIA"],
      ["SOCIEDADE DEPORTIVA O PINO", 3, 2, "C.F. VETERANOS CAMPORRAPADO"],
      ["C.F. NOIA VETERANOS", 3, 3, "VETERANOS ORDENES"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 4, 3, "CARREIRA C.F."],
      ["CD BOIRO VETERANOS", 5, 1, "C.D. BELVIS"],
    ],
  },
  {
    jornada: 23,
    matches: [
      ["CARREIRA C.F.", 3, 5, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 0, 0, "SOCIEDADE DEPORTIVA O PINO"],
      ["U.D. SANTISO F.C. SOLAINA", 1, 4, "SIGUEIRO F.C."],
      ["VETERANOS ORDENES", 4, 1, "CD BOIRO VETERANOS"],
      ["B&B FISIOTERAPIA", 3, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 2, 1, "BAR NOVAIS PORTOMOURO"],
      ["C.F. VETERANOS CAMPORRAPADO", 6, 0, "C.F. NOIA VETERANOS"],
      ["C.D. BELVIS", 0, 3, "NEGREIRA VETERANOS"],
    ],
  },
  {
    jornada: 24,
    matches: [
      ["SOCIEDADE DEPORTIVA O PINO", 5, 3, "CARREIRA C.F."],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 2, 3, "U.D. SANTISO F.C. SOLAINA"],
      ["NEGREIRA VETERANOS", 2, 1, "VETERANOS ORDENES"],
      ["BAR NOVAIS PORTOMOURO", 2, 1, "C.D. BELVIS"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 4, 1, "B&B FISIOTERAPIA"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 0, 4, "SIGUEIRO F.C."],
      ["C.F. NOIA VETERANOS", 1, 4, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["CD BOIRO VETERANOS", 1, 2, "C.F. VETERANOS CAMPORRAPADO"],
    ],
  },
  {
    jornada: 25,
    matches: [
      ["C.F. VETERANOS CAMPORRAPADO", 2, 4, "NEGREIRA VETERANOS"],
      ["SIGUEIRO F.C.", 1, 2, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 2, 2, "CD BOIRO VETERANOS"],
      ["VETERANOS ORDENES", 1, 0, "BAR NOVAIS PORTOMOURO"],
      ["U.D. SANTISO F.C. SOLAINA", 2, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["CARREIRA C.F.", 9, 1, "C.F. NOIA VETERANOS"],
      ["C.D. BELVIS", 4, 2, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["B&B FISIOTERAPIA", 2, 4, "SOCIEDADE DEPORTIVA O PINO"],
    ],
  },
  {
    jornada: 26,
    matches: [
      ["SOCIEDADE DEPORTIVA O PINO", 1, 1, "SIGUEIRO F.C."],
      ["BAR NOVAIS PORTOMOURO", 2, 2, "C.F. VETERANOS CAMPORRAPADO"],
      ["CD BOIRO VETERANOS", 3, 1, "CARREIRA C.F."],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 0, 1, "VETERANOS ORDENES"],
      ["NEGREIRA VETERANOS", 2, 2, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 2, 1, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["C.F. NOIA VETERANOS", 2, 0, "B&B FISIOTERAPIA"],
      ["C.D. BELVIS", 2, 4, "U.D. SANTISO F.C. SOLAINA"],
    ],
  },
  {
    jornada: 27,
    matches: [
      ["CARREIRA C.F.", 1, 1, "NEGREIRA VETERANOS"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 2, 3, "BAR NOVAIS PORTOMOURO"],
      ["C.F. VETERANOS CAMPORRAPADO", 3, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["B&B FISIOTERAPIA", 1, 6, "CD BOIRO VETERANOS"],
      ["SIGUEIRO F.C.", 5, 0, "C.F. NOIA VETERANOS"],
      ["VETERANOS ORDENES", 3, 1, "C.D. BELVIS"],
      ["U.D. SANTISO F.C. SOLAINA", 1, 2, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 3, 4, "SOCIEDADE DEPORTIVA O PINO"],
    ],
  },
  {
    jornada: 28,
    matches: [
      ["NEGREIRA VETERANOS", 0, 0, "B&B FISIOTERAPIA"],
      ["BAR NOVAIS PORTOMOURO", 5, 2, "CARREIRA C.F."],
      ["SOCIEDADE DEPORTIVA O PINO", 0, 2, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["CD BOIRO VETERANOS", 3, 0, "SIGUEIRO F.C."],
      ["VETERANOS ORDENES", 2, 1, "U.D. SANTISO F.C. SOLAINA"],
      ["C.F. NOIA VETERANOS", 3, 2, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["C.D. BELVIS", 1, 6, "C.F. VETERANOS CAMPORRAPADO"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 4, 7, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
    ],
  },
  {
    jornada: 29,
    matches: [
      ["CARREIRA C.F.", 3, 1, "PREFABRICADOS FARO RODEIRO VETERANS"],
      ["C.D. OASIS F.V. BOIRO - PUB GAVA", 7, 1, "C.D. BELVIS"],
      ["C.F. VETERANOS CAMPORRAPADO", 4, 1, "VETERANOS ORDENES"],
      ["SOCIEDADE DEPORTIVA O PINO", 4, 3, "U.D. SANTISO F.C. SOLAINA"],
      ["TERRAS DE TOURO - PREVEDINOS S.D.", 5, 1, "C.F. NOIA VETERANOS"],
      ["B&B FISIOTERAPIA", 1, 1, "BAR NOVAIS PORTOMOURO"],
      ["SIGUEIRO F.C.", 0, 3, "NEGREIRA VETERANOS"],
      ["AMIO S.D. HOSPEDAJE JOSE REY", 3, 4, "CD BOIRO VETERANOS"],
    ],
  },
  {
    jornada: 30,
    matches: [
      ["NEGREIRA VETERANOS", 4, 4, "AMIO S.D. HOSPEDAJE JOSE REY"],
      ["VETERANOS ORDENES", 0, 3, "C.D. OASIS F.V. BOIRO - PUB GAVA"],
      ["PREFABRICADOS FARO RODEIRO VETERANS", 3, 3, "B&B FISIOTERAPIA"],
      ["C.F. NOIA VETERANOS", 0, 2, "SOCIEDADE DEPORTIVA O PINO"],
      ["CD BOIRO VETERANOS", 1, 0, "TERRAS DE TOURO - PREVEDINOS S.D."],
      ["BAR NOVAIS PORTOMOURO", 0, 4, "SIGUEIRO F.C."],
      ["U.D. SANTISO F.C. SOLAINA", 4, 3, "C.F. VETERANOS CAMPORRAPADO"],
      ["C.D. BELVIS", 1, 8, "CARREIRA C.F."],
    ],
  },
];

function normalize(value) {
  const key = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/&/g, "Y")
    .replace(/[^A-Z0-9]/g, "");

  const aliases = new Map([
    ["SOCIEDADEDEPORTIVAOPINO", "SDOPINO"],
    ["SDOPINO", "SDOPINO"],
    ["CFVETERANOSCAMPORRAPADO", "CFCAMPORRAPADO"],
    ["CFCAMPORRAPADO", "CFCAMPORRAPADO"],
    ["PREFABRICADOSFARORODEIROVETERANS", "PREFABRICADOSFARORODEIRO"],
    ["PREFABRICADOSFARORODEIRO", "PREFABRICADOSFARORODEIRO"],
    ["CDBOIROVETERANOS", "CDBOIROVETERANOS"],
    ["CDBOIRO", "CDBOIROVETERANOS"],
    ["CDOASISFVBOIROPUBGAVA", "CDOASISFVBOIROPUBGAVA"],
    ["TERRASDETOUROPREVEDINOSSD", "TERRASDETOUROPREVEDINOSSD"],
    ["SIGUEIROFC", "SIGUEIROFC"],
    ["AMIOSDHOSPEDAJEJOSEREY", "AMIOSDHOSPEDAJEJOSEREY"],
    ["UDSANTISOFCSOLAINA", "UDSANTISOFCSOLAINA"],
    ["CFNOIAVETERANOS", "CFNOIAVETERANOS"],
    ["VETERANOSORDENES", "VETERANOSORDENES"],
    ["CARREIRACF", "CARREIRACF"],
    ["CDBELVIS", "CDBELVIS"],
    ["BYBFISIOTERAPIA", "BYBFISIOTERAPIA"],
    ["NEGREIRAVETERANOS", "NEGREIRAVETERANOS"],
    ["BARNOVAISPORTOMOURO", "BARNOVAISPORTOMOURO"],
  ]);

  return aliases.get(key) || key;
}

function matchKey(jornada, local, visitante) {
  return `${jornada}|${normalize(local)}|${normalize(visitante)}`;
}

function validateSourceData() {
  const jornadas = new Set();
  const keys = new Set();
  let total = 0;

  for (const block of RESULTS) {
    jornadas.add(block.jornada);
    if (block.matches.length !== 8) {
      throw new Error(`Jornada ${block.jornada}: tiene ${block.matches.length} partidos, esperado 8`);
    }

    for (const [local, gl, gv, visitante] of block.matches) {
      total += 1;
      const key = matchKey(block.jornada, local, visitante);
      if (keys.has(key)) throw new Error(`Partido duplicado en datos: J${block.jornada} ${local} vs ${visitante}`);
      keys.add(key);
      if (!Number.isInteger(gl) || !Number.isInteger(gv)) {
        throw new Error(`Marcador invalido: J${block.jornada} ${local} ${gl}-${gv} ${visitante}`);
      }
    }
  }

  if (jornadas.size !== 30 || total !== 240) {
    throw new Error(`Datos incompletos: ${jornadas.size} jornadas, ${total} partidos`);
  }
}

async function getCompetition() {
  if (COMPETICION_ID) {
    const { data, error } = await supabase
      .from("competiciones")
      .select("id,nombre,categoria")
      .eq("id", COMPETICION_ID)
      .single();
    if (error || !data) throw new Error(`Competicion no encontrada: ${COMPETICION_ID}`);
    return data;
  }

  const { data, error } = await supabase
    .from("competiciones")
    .select("id,nombre,categoria")
    .eq("categoria", "Veteranos")
    .order("orden", { ascending: true });

  if (error) throw new Error(error.message);

  const candidates = (data || []).filter((row) => {
    const name = normalize(row.nombre);
    return name.includes("HONOR") || name.includes("HONRA");
  });

  if (candidates.length !== 1) {
    console.log("Competiciones Veteranos encontradas:");
    for (const row of data || []) console.log(`  ${row.id} | ${row.nombre}`);
    throw new Error("No pude elegir una competicion unica. Usa --competicion-id=<uuid>");
  }

  return candidates[0];
}

async function fetchDbMatches(competitionId) {
  const { data, error } = await supabase
    .from("partidos_liga")
    .select(
      "id,estado,goles_local,goles_visitante,competicion_id," +
        "equipo_local:equipo_local_id(id,nombre)," +
        "equipo_visitante:equipo_visitante_id(id,nombre)," +
        "jornada:jornada_id(id,numero,competicion_id)"
    )
    .eq("categoria", "Veteranos")
    .eq("competicion_id", competitionId)
    .order("fecha", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchTeams() {
  const { data, error } = await supabase
    .from("equipos")
    .select("id,nombre,categoria")
    .eq("categoria", "Veteranos");

  if (error) throw new Error(error.message);

  const byKey = new Map();
  for (const team of data || []) byKey.set(normalize(team.nombre), team);
  return byKey;
}

async function fetchJornadas(competitionId) {
  const { data, error } = await supabase
    .from("jornadas")
    .select("id,numero,fecha_inicio,competicion,competicion_id")
    .eq("categoria", "Veteranos")
    .eq("competicion_id", competitionId);

  if (error) throw new Error(error.message);

  const byNumber = new Map();
  for (const jornada of data || []) byNumber.set(Number(jornada.numero), jornada);
  return byNumber;
}

function indexDbMatches(dbMatches) {
  const byKey = new Map();
  const duplicates = [];

  for (const match of dbMatches) {
    const jornada = Number(match.jornada?.numero);
    const local = match.equipo_local?.nombre || "";
    const visitante = match.equipo_visitante?.nombre || "";
    const key = matchKey(jornada, local, visitante);
    if (byKey.has(key)) duplicates.push(`${jornada}: ${local} vs ${visitante}`);
    byKey.set(key, match);
  }

  if (duplicates.length > 0) {
    throw new Error(`Partidos duplicados en BD:\n${duplicates.join("\n")}`);
  }

  return byKey;
}

function findDbMatch(dbByKey, item) {
  const forward = dbByKey.get(matchKey(item.jornada, item.local, item.visitante));
  if (forward) {
    return {
      dbMatch: forward,
      goalsLocal: item.gl,
      goalsVisitante: item.gv,
      orientation: "directo",
    };
  }

  const reversed = dbByKey.get(matchKey(item.jornada, item.visitante, item.local));
  if (reversed) {
    return {
      dbMatch: reversed,
      goalsLocal: item.gv,
      goalsVisitante: item.gl,
      orientation: "invertido",
    };
  }

  return null;
}

function getTeamOrThrow(teamsByKey, name) {
  const team = teamsByKey.get(normalize(name));
  if (!team) throw new Error(`Equipo no encontrado en BD: ${name}`);
  return team;
}

function expectedPairKeys(expected) {
  const keys = new Set();
  for (const item of expected) {
    keys.add(matchKey(item.jornada, item.local, item.visitante));
    keys.add(matchKey(item.jornada, item.visitante, item.local));
  }
  return keys;
}

async function main() {
  validateSourceData();

  const competition = await getCompetition();
  console.log(`Competicion: ${competition.nombre} (${competition.id})`);
  console.log(APPLY ? "Modo: APPLY" : "Modo: DRY-RUN");
  if (INSERT_MISSING) console.log("Insertar ausentes: SI");
  if (ARCHIVE_EXTRAS) console.log("Cancelar extras: SI");

  const dbMatches = await fetchDbMatches(competition.id);

  if (LIST_JORNADA) {
    const rows = dbMatches
      .filter((match) => Number(match.jornada?.numero) === LIST_JORNADA)
      .sort((a, b) => (a.equipo_local?.nombre || "").localeCompare(b.equipo_local?.nombre || "", "es"));
    console.log(`\nBD Jornada ${LIST_JORNADA}:`);
    for (const match of rows) {
      console.log(
        `  ${match.equipo_local?.nombre || "Local"} | ${match.goles_local ?? "?"}-${match.goles_visitante ?? "?"} | ${match.equipo_visitante?.nombre || "Visitante"}`
      );
    }
    return;
  }

  const dbByKey = indexDbMatches(dbMatches);
  const expected = RESULTS.flatMap((block) =>
    block.matches.map(([local, gl, gv, visitante]) => ({
      jornada: block.jornada,
      local,
      visitante,
      gl,
      gv,
    }))
  );

  const missing = [];
  const changes = [];
  const unchanged = [];

  for (const item of expected) {
    const found = findDbMatch(dbByKey, item);
    if (!found) {
      missing.push(item);
      continue;
    }

    const { dbMatch, goalsLocal, goalsVisitante, orientation } = found;
    const needsChange =
      dbMatch.goles_local !== goalsLocal ||
      dbMatch.goles_visitante !== goalsVisitante ||
      dbMatch.estado !== "finalizado";

    if (!needsChange) {
      unchanged.push({ item, dbMatch, goalsLocal, goalsVisitante, orientation });
      continue;
    }

    changes.push({ item, dbMatch, goalsLocal, goalsVisitante, orientation });
  }

  console.log(`BD partidos competicion: ${dbMatches.length}`);
  console.log(`Esperados: ${expected.length}`);
  console.log(`Ya OK: ${unchanged.length}`);
  console.log(`Cambios: ${changes.length}`);
  console.log(`No encontrados: ${missing.length}`);

  const sourcePairKeys = expectedPairKeys(expected);
  const extras = dbMatches.filter((match) => {
    const jornada = Number(match.jornada?.numero);
    if (jornada < 1 || jornada > 30) return false;
    const key = matchKey(
      jornada,
      match.equipo_local?.nombre || "",
      match.equipo_visitante?.nombre || ""
    );
    return !sourcePairKeys.has(key) && match.estado !== "cancelado";
  });
  console.log(`Extras BD no oficiales: ${extras.length}`);

  if (missing.length > 0) {
    console.log("\nNo encontrados:");
    for (const item of missing) {
      console.log(`  J${item.jornada} | ${item.local} ${item.gl}-${item.gv} ${item.visitante}`);
    }
    if (!INSERT_MISSING) {
      console.log("\nNo se aplica nada hasta resolver no encontrados o usar --insert-missing.");
      process.exit(1);
    }
  }

  if (changes.length > 0) {
    console.log("\nCambios detectados:");
    for (const { item, dbMatch, goalsLocal, goalsVisitante, orientation } of changes) {
      const before = `${dbMatch.goles_local ?? "?"}-${dbMatch.goles_visitante ?? "?"} ${dbMatch.estado || "sin_estado"}`;
      const after = `${goalsLocal}-${goalsVisitante} finalizado`;
      const dbLabel = `${dbMatch.equipo_local?.nombre || "Local"} vs ${dbMatch.equipo_visitante?.nombre || "Visitante"}`;
      console.log(`  J${item.jornada} | ${dbLabel} | ${before} -> ${after} (${orientation})`);
    }
  }

  if (!APPLY) {
    if (extras.length > 0) {
      console.log("\nExtras BD no oficiales:");
      for (const match of extras) {
        console.log(
          `  J${match.jornada?.numero} | ${match.equipo_local?.nombre || "Local"} ${match.goles_local ?? "?"}-${match.goles_visitante ?? "?"} ${match.equipo_visitante?.nombre || "Visitante"} | ${match.estado || "sin_estado"}`
        );
      }
    }
    console.log("\nDry-run terminado. Ejecuta con --apply para actualizar BD.");
    console.log("Opcional: --insert-missing crea partidos ausentes; --archive-extras cancela partidos no oficiales.");
    return;
  }

  for (const { item, dbMatch, goalsLocal, goalsVisitante } of changes) {
    const { error } = await supabase
      .from("partidos_liga")
      .update({
        goles_local: goalsLocal,
        goles_visitante: goalsVisitante,
        estado: "finalizado",
      })
      .eq("id", dbMatch.id);

    if (error) {
      throw new Error(`Error actualizando J${item.jornada} ${item.local} vs ${item.visitante}: ${error.message}`);
    }
  }

  if (missing.length > 0 && INSERT_MISSING) {
    const teamsByKey = await fetchTeams();
    const jornadasByNumber = await fetchJornadas(competition.id);
    const inserts = [];

    for (const item of missing) {
      const jornada = jornadasByNumber.get(item.jornada);
      if (!jornada) throw new Error(`Jornada no encontrada en BD: ${item.jornada}`);
      const local = getTeamOrThrow(teamsByKey, item.local);
      const visitante = getTeamOrThrow(teamsByKey, item.visitante);
      inserts.push({
        jornada_id: jornada.id,
        categoria: "Veteranos",
        competicion_id: competition.id,
        competicion: competition.nombre,
        equipo_local_id: local.id,
        equipo_visitante_id: visitante.id,
        goles_local: item.gl,
        goles_visitante: item.gv,
        estado: "finalizado",
        fecha: jornada.fecha_inicio || null,
      });
    }

    const { error } = await supabase.from("partidos_liga").insert(inserts);
    if (error) throw new Error(`Error insertando partidos ausentes: ${error.message}`);
    console.log(`Insertados ausentes: ${inserts.length}`);
  }

  if (extras.length > 0 && ARCHIVE_EXTRAS) {
    const ids = extras.map((match) => match.id);
    const { error } = await supabase
      .from("partidos_liga")
      .update({
        goles_local: null,
        goles_visitante: null,
        estado: "cancelado",
      })
      .in("id", ids);

    if (error) throw new Error(`Error cancelando extras: ${error.message}`);
    console.log(`Cancelados extras: ${ids.length}`);
  }

  console.log(`\nActualizados: ${changes.length}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
