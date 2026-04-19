
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCategories() {
  const { data, error } = await supabase
    .from('equipos')
    .select('categoria')
    .limit(100);

  if (error) {
    console.error("Error fetching categories:", error);
    return;
  }

  const distinct = [...new Set(data.map(d => d.categoria))];
  console.log("Distinct Categories in 'equipos':", distinct);
}

checkCategories();
