const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local manualmente
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function seed() {
  console.log('--- Iniciando Carga Femenino y Veteranos ---');

  const femenino = [
    { nombre: 'C.D. VALLADARES', pts: 66, pj: 22, pg: 22, pe: 0, pp: 0, gf: 116, gc: 8, categoria: 'Femenino' },
    { nombre: 'ATLETICO AROUSANA', pts: 59, pj: 23, pg: 19, pe: 2, pp: 2, gf: 105, gc: 20, categoria: 'Femenino' },
    { nombre: 'S.D. TOURO', pts: 57, pj: 23, pg: 18, pe: 3, pp: 2, gf: 73, gc: 26, categoria: 'Femenino' },
    { nombre: 'S.C.D. PONTE CALDELAS', pts: 47, pj: 22, pg: 15, pe: 2, pp: 5, gf: 71, gc: 38, categoria: 'Femenino' },
    { nombre: 'U.D. MOS', pts: 37, pj: 23, pg: 11, pe: 4, pp: 8, gf: 56, gc: 43, categoria: 'Femenino' },
    { nombre: 'CELTIGA F.C. FEMINAS', pts: 36, pj: 22, pg: 11, pe: 3, pp: 8, gf: 55, gc: 44, categoria: 'Femenino' },
    { nombre: 'VICTORIA F.C. "C"', pts: 27, pj: 23, pg: 8, pe: 3, pp: 12, gf: 38, gc: 54, categoria: 'Femenino' },
    { nombre: 'JUVENTUD CAMBADOS', pts: 26, pj: 22, pg: 7, pe: 5, pp: 10, gf: 35, gc: 38, categoria: 'Femenino' },
    { nombre: 'C.F. NOIA', pts: 26, pj: 22, pg: 7, pe: 5, pp: 10, gf: 43, gc: 48, categoria: 'Femenino' },
    { nombre: 'C.F. CAÑIZA', pts: 25, pj: 22, pg: 6, pe: 7, pp: 9, gf: 28, gc: 37, categoria: 'Femenino' },
    { nombre: 'C.U.D. UNION GUARDESA', pts: 22, pj: 22, pg: 7, pe: 1, pp: 14, gf: 45, gc: 92, categoria: 'Femenino' },
    { nombre: 'SPORTING CLUB SAN MATEO', pts: 21, pj: 23, pg: 6, pe: 3, pp: 14, gf: 31, gc: 63, categoria: 'Femenino' },
    { nombre: 'U.D. SANTISO F.C.', pts: 19, pj: 23, pg: 6, pe: 1, pp: 16, gf: 35, gc: 77, categoria: 'Femenino' },
    { nombre: 'PORRIÑO INDUSTRIAL F.C.', pts: 8, pj: 22, pg: 2, pe: 2, pp: 18, gf: 28, gc: 79, categoria: 'Femenino' },
    { nombre: 'S.C.D. SALCEDO', pts: 7, pj: 22, pg: 2, pe: 1, pp: 19, gf: 28, gc: 120, categoria: 'Femenino' }
  ];

  const veteranos = [
    { nombre: 'SOCIEDADE DEPORTIVA O PINO', pts: 56, pj: 25, pg: 17, pe: 5, pp: 3, gf: 65, gc: 27, categoria: 'Veteranos' },
    { nombre: 'CD BOIRO VETERANOS', pts: 56, pj: 25, pg: 18, pe: 2, pp: 5, gf: 66, gc: 36, categoria: 'Veteranos' },
    { nombre: 'BAR NOVAIS PORTOMOURO', pts: 50, pj: 25, pg: 15, pe: 5, pp: 5, gf: 55, gc: 34, categoria: 'Veteranos' },
    { nombre: 'SIGÜEIRO F.C.', pts: 48, pj: 25, pg: 15, pe: 3, pp: 7, gf: 59, gc: 30, categoria: 'Veteranos' },
    { nombre: 'C.F. VETERANOS CAMPORRAPADO', pts: 42, pj: 25, pg: 12, pe: 6, pp: 7, gf: 47, gc: 37, categoria: 'Veteranos' },
    { nombre: 'NEGREIRA VETERANOS', pts: 40, pj: 25, pg: 12, pe: 4, pp: 9, gf: 51, gc: 39, categoria: 'Veteranos' },
    { nombre: 'B&B FISIOTERAPIA', pts: 37, pj: 25, pg: 11, pe: 4, pp: 10, gf: 52, gc: 46, categoria: 'Veteranos' },
    { nombre: 'C.D.OASIS F.V. BOIRO - PUB GAVA', pts: 37, pj: 25, pg: 10, pe: 7, pp: 8, gf: 46, gc: 42, categoria: 'Veteranos' },
    { nombre: 'VETERANOS ORDENES', pts: 29, pj: 25, pg: 9, pe: 2, pp: 14, gf: 30, gc: 43, categoria: 'Veteranos' },
    { nombre: 'AMIO S.D. HOSPEDAJE JOSE REY', pts: 28, pj: 25, pg: 8, pe: 4, pp: 13, gf: 52, gc: 57, categoria: 'Veteranos' },
    { nombre: 'TERRAS DE TOURO - PREVEDIÑOS S.D.', pts: 28, pj: 25, pg: 8, pe: 4, pp: 13, gf: 35, gc: 52, categoria: 'Veteranos' },
    { nombre: 'C.F. NOIA VETERANOS', pts: 26, pj: 25, pg: 8, pe: 2, pp: 15, gf: 45, gc: 73, categoria: 'Veteranos' },
    { nombre: 'PREFABRICADOS FARO RODEIRO VETERANS', pts: 26, pj: 25, pg: 6, pe: 8, pp: 11, gf: 50, gc: 70, categoria: 'Veteranos' },
    { nombre: 'CARREIRA C.F.', pts: 25, pj: 25, pg: 7, pe: 4, pp: 14, gf: 51, gc: 62, categoria: 'Veteranos' },
    { nombre: 'U.D. SANTISO F.C. SOLAINA', pts: 21, pj: 25, pg: 6, pe: 3, pp: 16, gf: 47, gc: 69, categoria: 'Veteranos' },
    { nombre: 'C.D. BELVIS', pts: 19, pj: 25, pg: 6, pe: 1, pp: 18, gf: 46, gc: 80, categoria: 'Veteranos' }
  ];

  console.log('Insertando Femenino...');
  const { error: fErr } = await supabase.from('equipos').insert(femenino);
  if (fErr) console.error('Error Femenino:', fErr.message);
  else console.log('✓ Femenino insertado.');

  console.log('Insertando Veteranos...');
  const { error: vErr } = await supabase.from('equipos').insert(veteranos);
  if (vErr) console.error('Error Veteranos:', vErr.message);
  else console.log('✓ Veteranos insertado.');

  console.log('\n--- Carga Finalizada ---');
}

seed();
