import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = fs.readFileSync(resolve(__dirname, '.env.local'), 'utf-8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/^['"](.*)['"]$/, '$1');
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Se requiere SUPABASE_SERVICE_ROLE_KEY para que no falle por RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const OLD_NAME = "Terceira Galicia - Santiago - Grupo 4";
const NEW_NAME = "Terceira Galicia - Santiago - Fase Previa - Grupo 4";

async function renameCompetition() {
  console.log(`Iniciando renombrado de: "${OLD_NAME}" a "${NEW_NAME}"...`);

  // 1. Actualizar jornadas
  console.log("Actualizando jornadas...");
  const { error: errJornadas, count: countJornadas } = await supabase
    .from('jornadas')
    .update({ competicion: NEW_NAME })
    .eq('competicion', OLD_NAME);
  
  if (errJornadas) console.error("Error jornadas:", errJornadas.message);
  else console.log(`Jornadas actualizadas correctamente.`);

  // 2. Actualizar partidos_liga
  console.log("Actualizando partidos_liga...");
  const { error: errPartidos, count: countPartidos } = await supabase
    .from('partidos_liga')
    .update({ competicion: NEW_NAME })
    .eq('competicion', OLD_NAME);

  if (errPartidos) console.error("Error partidos:", errPartidos.message);
  else console.log(`Partidos actualizados correctamente.`);

  // 3. Actualizar equipo_competiciones
  console.log("Actualizando equipo_competiciones...");
  const { error: errEquipos, count: countEquipos } = await supabase
    .from('equipo_competiciones')
    .update({ competicion: NEW_NAME })
    .eq('competicion', OLD_NAME);

  if (errEquipos) console.error("Error equipo_competiciones:", errEquipos.message);
  else console.log(`Relaciones de equipo actualizadas correctamente.`);

  console.log("¡Renombrado completado! NOTA: Si ha habido errores de permisos, debes añadir SUPABASE_SERVICE_ROLE_KEY en tu .env.local y volver a ejecutar el script.");
}

renameCompetition();
