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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COMPETICION = "Terceira Galicia - Santiago - Fase Previa - Grupo 4";

async function auditGlobal() {
  const { data: jornadas } = await supabase
    .from('jornadas')
    .select('id, numero')
    .eq('competicion', COMPETICION);

  const jIds = jornadas.map(j => j.id);
  
  const { data: partidos } = await supabase
    .from('partidos_liga')
    .select(`
      id, 
      jornada_id, 
      equipo_local:equipos!equipo_local_id(id, nombre), 
      equipo_visitante:equipos!equipo_visitante_id(id, nombre)
    `)
    .in('jornada_id', jIds);

  const teamStats = {};
  const globalMatches = new Set();
  let errors = false;

  partidos.forEach(p => {
    const l = p.equipo_local?.nombre;
    const v = p.equipo_visitante?.nombre;
    
    if (!l || !v) return;

    if (!teamStats[l]) teamStats[l] = { local: 0, visitante: 0, total: 0 };
    if (!teamStats[v]) teamStats[v] = { local: 0, visitante: 0, total: 0 };

    teamStats[l].local++;
    teamStats[l].total++;
    teamStats[v].visitante++;
    teamStats[v].total++;

    const matchHash = `${l} vs ${v}`;
    if (globalMatches.has(matchHash)) {
      console.log(`[!] DUPLICADO GLOBAL: El partido ${matchHash} ocurre más de una vez en la liga.`);
      errors = true;
    }
    globalMatches.add(matchHash);
  });

  console.log("\\n--- Estadísticas por Equipo ---");
  for (const [team, stats] of Object.entries(teamStats)) {
    if (stats.total !== 18 || stats.local !== 9 || stats.visitante !== 9) {
      console.log(`[!] ANOMALÍA: ${team} -> Total: ${stats.total} | Local: ${stats.local} | Visitante: ${stats.visitante}`);
      errors = true;
    } else {
      console.log(`[OK] ${team} -> 18 partidos (9 L / 9 V)`);
    }
  }

  if (!errors) {
    console.log("\\nTodo parece correcto a nivel global: cada equipo juega 18 partidos (9 local, 9 visitante) y no hay partidos idénticos repetidos.");
  }
}

auditGlobal();
