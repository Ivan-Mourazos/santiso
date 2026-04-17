const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente para evitar dependencias externas
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: No se han encontrado las variables de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('--- Iniciando Carga de Datos Senior ---');

  const equipos = [
    { nombre: 'U.D. SANTISO F.C.', pts: 16, pj: 6, pg: 5, pe: 1, pp: 0, gf: 30, gc: 14, categoria: 'Senior' },
    { nombre: 'Vilatuxe F.C.', pts: 13, pj: 6, pg: 4, pe: 1, pp: 1, gf: 27, gc: 18, categoria: 'Senior' },
    { nombre: 'S.D. Bandeira', pts: 12, pj: 6, pg: 4, pe: 0, pp: 2, gf: 31, gc: 20, categoria: 'Senior' },
    { nombre: 'Racing San Lorenzo "B"', pts: 9, pj: 6, pg: 3, pe: 0, pp: 3, gf: 17, gc: 10, categoria: 'Senior' },
    { nombre: 'Milladoiro S.D. "B"', pts: 3, pj: 6, pg: 1, pe: 0, pp: 5, gf: 13, gc: 29, categoria: 'Senior' },
    { nombre: 'Club Arenal', pts: 0, pj: 6, pg: 0, pe: 0, pp: 6, gf: 12, gc: 39, categoria: 'Senior' }
  ];

  console.log('Sincronizando equipos...');
  for (const eq of equipos) {
    // Primero intentamos actualizar
    const { error: uError, data } = await supabase.from('equipos')
      .update({ pts: eq.pts, pj: eq.pj, pg: eq.pg, pe: eq.pe, pp: eq.pp, gf: eq.gf, gc: eq.gc })
      .eq('nombre', eq.nombre)
      .eq('categoria', eq.categoria);

    if (uError) {
      console.log(`⚠️ Error actualizando ${eq.nombre}: ${uError.message}`);
    } else {
      console.log(`✓ ${eq.nombre} sincronizado.`);
    }
  }

  console.log('\n--- Sincronización Finalizada ---');
}

seed();
