const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leer .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function formatName(str) {
  // Siglas que deben permanecer en mayúsculas
  const siglas = ['F.C.', 'S.D.', 'U.D.', 'C.D.', 'S.C.D.', 'C.U.D.', 'B&B'];
  
  // Convertir todo a minúsculas primero y separar por espacios
  let words = str.toLowerCase().split(' ');
  
  let formattedWords = words.map(word => {
    // Si la palabra (sin puntos) es una sigla conocida, la ponemos igual
    const upperWord = word.toUpperCase();
    if (siglas.includes(upperWord)) return upperWord;
    
    // Si es un "B" o similar entre comillas
    if (word === '"b"') return '"B"';
    if (word === 'b') return 'B';

    // Capitalizar la primera letra
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return formattedWords.join(' ');
}

async function normalize() {
  console.log('--- Iniciando Normalización Estética ---');
  
  const { data: equipos, error } = await supabase.from('equipos').select('*');
  
  if (error) {
    console.error('Error al leer equipos:', error.message);
    return;
  }

  console.log(`Encontrados ${equipos.length} equipos para normalizar...`);

  for (const eq of equipos) {
    const nuevoNombre = formatName(eq.nombre);
    
    if (nuevoNombre !== eq.nombre) {
      console.log(`Modificando: ${eq.nombre} -> ${nuevoNombre}`);
      await supabase.from('equipos')
        .update({ nombre: nuevoNombre })
        .eq('id', eq.id);
    }
  }

  console.log('\n--- Normalización Finalizada ---');
}

normalize();
