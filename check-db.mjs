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
// Using Service Role key to bypass RLS and potentially query information_schema if needed, 
// though we'll just try to query pg_catalog using a standard SQL if possible.
// Wait, we can't run raw SQL from supabase-js unless we use RPC.
// So let's just try to insert a dummy record that we know would violate (temporada_id, categoria, numero)
// but with a different competicion, and see if it throws unique_jornada_per_season.

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Find a temporada
  const { data: temp } = await supabase.from('temporadas').select('id').eq('activa', true).single();
  if (!temp) return console.log("No active temporada");

  // Get an existing jornada
  const { data: jor } = await supabase.from('jornadas').select('*').eq('temporada_id', temp.id).limit(1).single();
  if (!jor) return console.log("No jornadas found");

  console.log("Found existing jornada:", jor);

  // Try to insert same season, same category, same number, DIFFERENT competicion
  const res = await supabase.from('jornadas').insert([{
    temporada_id: temp.id,
    categoria: jor.categoria,
    numero: jor.numero,
    competicion: jor.competicion + "_TEST_DUMMY"
  }]);

  console.log("Insert result:", JSON.stringify(res, null, 2));
}

check();
