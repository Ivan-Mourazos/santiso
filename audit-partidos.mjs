/**
 * audit-partidos.mjs
 * Muestra partidos del Santiso con estado=finalizado pero sin stats de jugadores.
 * Uso: node audit-partidos.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jqwzalcvujataysvanjy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxd3phbGN2dWphdGF5c3Zhbmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NDIwNiwiZXhwIjoyMDkxOTQwMjA2fQ.hNZsxD0zLekPHZNauOxFxrV3iMyelnRipWAyrF_6z3c";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORIAS = ["Senior", "Femenino", "Veteranos"];

async function main() {
  console.log("🔍 Audit: partidos finalizados sin jugador_partido_stats\n");

  // 1. Todos los partidos finalizados con Santiso
  const { data: partidos, error } = await supabase
    .from("partidos_liga")
    .select(
      "id, categoria, estado, fecha, goles_local, goles_visitante, " +
        "equipo_local:equipo_local_id(nombre), equipo_visitante:equipo_visitante_id(nombre), " +
        "jornada:jornada_id(numero)"
    )
    .eq("estado", "finalizado")
    .order("categoria")
    .order("fecha", { ascending: true });

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  // Filtrar solo partidos del Santiso
  const santisoPartidos = (partidos || []).filter((p) => {
    const local = p.equipo_local?.nombre?.toLowerCase() || "";
    const vis = p.equipo_visitante?.nombre?.toLowerCase() || "";
    return local.includes("santiso") || vis.includes("santiso");
  });

  // 2. IDs con stats existentes
  const ids = santisoPartidos.map((p) => p.id);
  let idsConStats = new Set();

  if (ids.length > 0) {
    const { data: stats } = await supabase
      .from("jugador_partido_stats")
      .select("partido_id")
      .in("partido_id", ids);

    idsConStats = new Set((stats || []).map((s) => s.partido_id));
  }

  // 3. Agrupar por categoría
  const sinStats = santisoPartidos.filter((p) => !idsConStats.has(p.id));
  const conStats = santisoPartidos.filter((p) => idsConStats.has(p.id));

  console.log(`📊 Total partidos finalizados Santiso: ${santisoPartidos.length}`);
  console.log(`✅ Con stats: ${conStats.length}`);
  console.log(`❌ Sin stats: ${sinStats.length}\n`);

  if (sinStats.length === 0) {
    console.log("✅ ¡Todos los partidos tienen eventos! Listo para el PDF.");
    return;
  }

  // Agrupar por categoría
  for (const cat of CATEGORIAS) {
    const grupo = sinStats.filter((p) => p.categoria === cat);
    if (grupo.length === 0) continue;

    console.log(`\n━━━ ${cat.toUpperCase()} (${grupo.length} partidos sin stats) ━━━`);
    for (const p of grupo) {
      const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString("es-ES") : "sin fecha";
      const j = p.jornada?.numero ? `J${p.jornada.numero}` : "J?";
      const local = p.equipo_local?.nombre || "?";
      const vis = p.equipo_visitante?.nombre || "?";
      const marcador =
        p.goles_local !== null && p.goles_visitante !== null
          ? `${p.goles_local}-${p.goles_visitante}`
          : "sin marcador";
      console.log(`  ${j} | ${fecha} | ${local} vs ${vis} | ${marcador}`);
    }
  }

  console.log(`\n💡 Abre el admin → Actas y añade los eventos de estos ${sinStats.length} partidos.`);
}

main();
