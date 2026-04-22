import { supabase } from "./lib/supabase";

async function checkCampos() {
  const { data, error } = await supabase.from("campos_futbol").select("*");
  if (error) {
    console.error("Error fetching campos:", error);
  } else {
    console.log("Campos found:", data?.length || 0);
    console.log("Sample:", data?.[0]);
  }
}

checkCampos();
