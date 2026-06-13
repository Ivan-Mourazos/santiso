/**
 * audit-competiciones.mjs
 * Muestra todas las competiciones y partidos Santiso por competición.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jqwzalcvujataysvanjy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxd3phbGN2dWphdGF5c3Zhbmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NDIwNiwiZXhwIjoyMDkxOTQwMjA2fQ.hNZsxD0zLekPHZNauOxFxrV3iMyelnRipWAyrF_6z3c";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // 1. Todas las competiciones
  const { data: comps } = await supabase
    .from("competiciones")
    .select("id, nombre, categoria, activa")
    .order("categoria")
    .order("nombre");

  console.log("🏆 COMPETICIONES EN BD:");
  for (const c of comps || []) {
    console.log(`  [${c.categoria}] ${c.nombre} (activa=${c.activa}) — id: ${c.id}`);
  }

  // 2. Todos los partidos Santiso agrupados por competicion_id + estado
  const { data: todos } = await supabase
    .from("partidos_liga")
    .select(
      "id, categoria, estado, competicion_id, " +
        "equipo_local:equipo_local_id(nombre), equipo_visitante:equipo_visitante_id(nombre), " +
        "jornada:jornada_id(numero, competicion_id)"
    )
    .order("categoria")
    .order("competicion_id");

  const santisoTodos = (todos || []).filter((p) => {
    const local = p.equipo_local?.nombre?.toLowerCase() || "";
    const vis = p.equipo_visitante?.nombre?.toLowerCase() || "";
    return local.includes("santiso") || vis.includes("santiso");
  });

  // Stats existentes
  const ids = santisoTodos.map((p) => p.id);
  let idsConStats = new Set();
  if (ids.length > 0) {
    const { data: stats } = await supabase
      .from("jugador_partido_stats")
      .select("partido_id")
      .in("partido_id", ids);
    idsConStats = new Set((stats || []).map((s) => s.partido_id));
  }

  // Agrupar por competicion_id
  const compMap = new Map((comps || []).map((c) => [c.id, c.nombre]));
  const grupos = {};
  for (const p of santisoTodos) {
    const compId = p.competicion_id || p.jornada?.competicion_id || "sin-competicion";
    const compNombre = compMap.get(compId) || compId;
    const key = `[${p.categoria}] ${compNombre}`;
    if (!grupos[key]) grupos[key] = { total: 0, finalizados: 0, sinStats: 0, programados: 0 };
    grupos[key].total++;
    if (p.estado === "finalizado") {
      grupos[key].finalizados++;
      if (!idsConStats.has(p.id)) grupos[key].sinStats++;
    } else {
      grupos[key].programados++;
    }
  }

  console.log("\n📊 PARTIDOS SANTISO POR COMPETICIÓN:");
  console.log("─".repeat(70));
  for (const [key, g] of Object.entries(grupos).sort()) {
    const ok = g.finalizados - g.sinStats;
    const warn = g.sinStats > 0 ? ` ⚠️  ${g.sinStats} sin stats` : " ✅";
    console.log(`${key}`);
    console.log(`   Total: ${g.total} | Finalizados: ${g.finalizados} (${ok} OK${warn}) | Programados: ${g.programados}`);
  }

  console.log("\n");
}

main();
