/**
 * generar-pdf-senior.mjs
 * PDF estadisticas jugadores Senior U.D. Santiso F.C.
 * Uso: node generar-pdf-senior.mjs
 */

import { createClient } from "@supabase/supabase-js";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const SUPABASE_URL = "https://jqwzalcvujataysvanjy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impxd3phbGN2dWphdGF5c3Zhbmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM2NDIwNiwiZXhwIjoyMDkxOTQwMjA2fQ.hNZsxD0zLekPHZNauOxFxrV3iMyelnRipWAyrF_6z3c";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const CATEGORIA = "Senior";
const OUTPUT = path.resolve("estadisticas-senior.pdf");

const COMP_NOMBRES = {
  "a1000001-0001-4001-8001-000000000001": "Fase Previa",
  "a1000001-0002-4002-8002-000000000002": "Fase Copa",
  "59cfab5b-3aa9-44bd-9596-185345c87b7e": "Campeon Copa",
};

// ── 1. CARGA ────────────────────────────────────────────────────────────────

async function cargarDatos() {
  const { data: jugadores } = await sb
    .from("jugadores")
    .select("id,nombre,apodo,dorsal,posicion,capitan")
    .eq("categoria", CATEGORIA)
    .order("dorsal", { ascending: true });

  const { data: todosPartidos } = await sb
    .from("partidos_liga")
    .select("id,competicion_id,equipo_local:equipo_local_id(nombre),equipo_visitante:equipo_visitante_id(nombre)")
    .eq("categoria", CATEGORIA)
    .eq("estado", "finalizado");

  const santisoPartidos = (todosPartidos || []).filter((p) => {
    const l = p.equipo_local?.nombre?.toLowerCase() || "";
    const v = p.equipo_visitante?.nombre?.toLowerCase() || "";
    return l.includes("santiso") || v.includes("santiso");
  });

  const pIds = santisoPartidos.map((p) => p.id);

  const { data: stats } = await sb
    .from("jugador_partido_stats")
    .select("jugador_id,partido_id,titular,jugo,goles")
    .in("partido_id", pIds);

  const { data: eventos } = await sb
    .from("partido_eventos_santiso")
    .select("partido_id,tipo,minuto,jugador_id,jugador_relacionado_id,es_rival")
    .in("partido_id", pIds)
    .eq("es_rival", false);

  return {
    jugadores: jugadores || [],
    santisoPartidos,
    stats: stats || [],
    eventos: eventos || [],
  };
}

// ── 2. MINUTOS ──────────────────────────────────────────────────────────────

function calcularMinutos(jugadorId, statRow, eventosPartido) {
  if (!statRow?.jugo) return 0;
  const cambios = eventosPartido.filter((e) => e.tipo === "cambio");
  const sale = cambios.find((c) => c.jugador_relacionado_id === jugadorId);
  const entra = cambios.find((c) => c.jugador_id === jugadorId);
  if (statRow.titular) {
    return sale?.minuto != null ? sale.minuto : 90;
  } else {
    return entra?.minuto != null ? 90 - entra.minuto : 45;
  }
}

// ── 3. ESTADISTICAS ─────────────────────────────────────────────────────────

function calcularEstadisticas({ jugadores, santisoPartidos, stats, eventos }) {
  const partidoComp = new Map(santisoPartidos.map((p) => [p.id, p.competicion_id]));
  const compIds = [...new Set(santisoPartidos.map((p) => p.competicion_id))].sort();

  const totalPorComp = {};
  for (const compId of compIds) {
    totalPorComp[compId] = santisoPartidos.filter((p) => p.competicion_id === compId).length;
  }

  const eventosPorPartido = {};
  for (const ev of eventos) {
    if (!eventosPorPartido[ev.partido_id]) eventosPorPartido[ev.partido_id] = [];
    eventosPorPartido[ev.partido_id].push(ev);
  }

  const totalGlobalPartidos = Object.values(totalPorComp).reduce((a, c) => a + c, 0);

  const resultado = jugadores.map((j) => {
    const statsJugador = stats.filter((s) => s.jugador_id === j.id);

    const pj = statsJugador.filter((s) => s.jugo).length;
    const titular = statsJugador.filter((s) => s.titular && s.jugo).length;
    const suplente = pj - titular;
    const goles = statsJugador.reduce((acc, s) => acc + (s.goles || 0), 0);

    const tarjAm = eventos.filter(
      (e) => e.tipo === "tarjeta_amarilla" && e.jugador_id === j.id
    ).length;
    const tarjRo = eventos.filter(
      (e) => e.tipo === "tarjeta_roja" && e.jugador_id === j.id
    ).length;

    let minutos = 0;
    for (const s of statsJugador) {
      minutos += calcularMinutos(j.id, s, eventosPorPartido[s.partido_id] || []);
    }

    const mediaMin = pj > 0 ? Math.round(minutos / pj) : 0;
    const porcentaje = totalGlobalPartidos > 0
      ? Math.round((pj / totalGlobalPartidos) * 100)
      : 0;

    return {
      jugador: j,
      totales: { pj, titular, suplente, goles, tarjAm, tarjRo, minutos, mediaMin, porcentaje },
    };
  });

  resultado.sort((a, b) => b.totales.pj - a.totales.pj);

  return { resultado, compIds, totalPorComp, totalGlobalPartidos };
}

// ── 4. PDF ───────────────────────────────────────────────────────────────────

function generarPDF({ resultado, compIds, totalPorComp, totalGlobalPartidos }) {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 40, bottom: 40, left: 40, right: 40 },
  });

  const stream = fs.createWriteStream(OUTPUT);
  doc.pipe(stream);

  const C_PRIMARY    = "#1a1a2e";
  const C_ACCENT     = "#facc15";
  const C_ROW_ALT    = "#eef2ff";
  const C_HEADER     = "#16213e";
  const C_TEXT       = "#111111";
  const C_MUTED      = "#666666";
  const C_WHITE      = "#ffffff";

  const PAGE_W     = doc.page.width;
  const PAGE_H     = doc.page.height;
  const M          = 40;
  const CW         = PAGE_W - M * 2;
  const SAFE_BOT   = PAGE_H - 50;

  // Columnas
  const COLS = [
    { key: "nombre",     label: "Jugador",  w: 160, align: "left"   },
    { key: "dorsal",     label: "#",        w: 28,  align: "center" },
    { key: "posicion",   label: "POS",      w: 36,  align: "center" },
    { key: "pj",         label: "PJ",       w: 30,  align: "center" },
    { key: "titular",    label: "TIT",      w: 30,  align: "center" },
    { key: "suplente",   label: "SUP",      w: 30,  align: "center" },
    { key: "minutos",    label: "MIN",      w: 42,  align: "center" },
    { key: "mediaMin",   label: "X\u0304MIN",   w: 42,  align: "center" },
    { key: "goles",      label: "GOL",      w: 34,  align: "center" },
    { key: "tarjAm",     label: "AM",       w: 30,  align: "center" },
    { key: "tarjRo",     label: "RO",       w: 30,  align: "center" },
    { key: "porcentaje", label: "%PJ",      w: 38,  align: "center" },
  ];
  // x acumulado
  let cx = M;
  for (const col of COLS) { col.x = cx; cx += col.w; }

  const HDR_H = 20;
  const ROW_H = 15;

  function drawHeader(yPos) {
    doc.rect(M, yPos, CW, HDR_H).fill(C_HEADER);
    doc.fillColor(C_WHITE).fontSize(7).font("Helvetica-Bold");
    for (const col of COLS) {
      doc.text(col.label, col.x + 2, yPos + 6, { width: col.w - 4, align: col.align, lineBreak: false });
    }
    return yPos + HDR_H;
  }

  function drawFooter() {
    doc.rect(0, PAGE_H - 26, PAGE_W, 26).fill(C_PRIMARY);
    doc.fillColor(C_MUTED).fontSize(7)
      .text("U.D. Santiso F.C. - Estadisticas internas 2025/26", M, PAGE_H - 14,
        { align: "center", width: CW, lineBreak: false });
  }

  // ─ Pagina 1 cabecera ─
  doc.rect(0, 0, PAGE_W, 44).fill(C_PRIMARY);
  doc.fillColor(C_ACCENT).fontSize(16).font("Helvetica-Bold")
    .text("U.D. SANTISO F.C.", M, 10, { align: "left", lineBreak: false });
  doc.fillColor(C_WHITE).fontSize(9).font("Helvetica")
    .text("Estadisticas Temporada 2025/26 - Senior", M, 30, { align: "left", lineBreak: false });
  const fecha = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  doc.fillColor(C_MUTED).fontSize(7)
    .text(fecha, 0, 33, { align: "right", width: PAGE_W - M, lineBreak: false });

  // ─ Resumen partidos ─
  let y = 50;
  let px = M;
  for (const compId of compIds) {
    const nombre = COMP_NOMBRES[compId] || compId;
    const total = totalPorComp[compId];
    const pill = `${nombre}: ${total}`;
    const pw = doc.widthOfString(pill) + 16;
    doc.roundedRect(px, y - 1, pw, 13, 3).fill("#dbeafe");
    doc.fillColor("#1e40af").fontSize(6.5).font("Helvetica-Bold")
      .text(pill, px + 8, y + 1, { lineBreak: false });
    px += pw + 5;
  }
  const pillT = `Total: ${totalGlobalPartidos} partidos`;
  const ptw = doc.widthOfString(pillT) + 16;
  doc.roundedRect(px, y - 1, ptw, 13, 3).fill("#fef3c7");
  doc.fillColor("#78350f").fontSize(6.5).font("Helvetica-Bold")
    .text(pillT, px + 8, y + 1, { lineBreak: false });
  y += 18;

  // ─ Cabecera tabla ─
  y = drawHeader(y);

  // ─ Filas ─
  resultado.forEach((r, i) => {
    const { jugador, totales } = r;

    if (y + ROW_H > SAFE_BOT) {
      // No deberia ocurrir — todo cabe en una pagina
      // Si pasa, continua igualmente sin saltar pagina
    }

    doc.rect(M, y, CW, ROW_H).fill(i % 2 === 1 ? C_ROW_ALT : C_WHITE);

    // Borde capitan
    if (jugador.capitan > 0) {
      doc.rect(M, y, 4, ROW_H).fill(C_ACCENT);
    }

    const vals = {
      nombre:     jugador.nombre,
      dorsal:     jugador.dorsal != null ? String(jugador.dorsal) : "-",
      posicion:   jugador.posicion || "-",
      pj:         String(totales.pj),
      titular:    String(totales.titular),
      suplente:   String(totales.suplente),
      minutos:    String(totales.minutos),
      mediaMin:   totales.pj > 0 ? String(totales.mediaMin) : "-",
      goles:      totales.goles > 0 ? String(totales.goles) : "-",
      tarjAm:     totales.tarjAm > 0 ? String(totales.tarjAm) : "-",
      tarjRo:     totales.tarjRo > 0 ? String(totales.tarjRo) : "-",
      porcentaje: totales.porcentaje + "%",
    };

    for (const col of COLS) {
      const v = String(vals[col.key] ?? "-");
      let color = C_TEXT;
      if (col.key === "tarjAm"     && totales.tarjAm > 0)       color = "#92400e";
      if (col.key === "tarjRo"     && totales.tarjRo > 0)       color = "#991b1b";
      if (col.key === "porcentaje" && totales.porcentaje >= 80)  color = "#15803d";
      if (col.key === "goles"      && totales.goles > 0)         color = "#1d4ed8";
      const bold = col.key === "nombre";
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fillColor(color)
        .text(v, col.x + (bold ? 6 : 2), y + 4,
          { width: col.w - (bold ? 10 : 4), align: col.align, lineBreak: false });
    }

    doc.moveTo(M, y + ROW_H).lineTo(M + CW, y + ROW_H)
      .strokeColor("#e5e7eb").lineWidth(0.3).stroke();

    y += ROW_H;
  });

  // ─ Leyenda ─
  y += 8;
  doc.fillColor(C_MUTED).fontSize(5.5).font("Helvetica");
  doc.text(
    "PJ=Partidos jugados  TIT=Titular  SUP=Suplente  MIN=Minutos totales  X\u0304MIN=Media min/partido  GOL=Goles  AM=Amarillas  RO=Rojas  %PJ=% partidos sobre el total de la temporada  |  Minutos calculados desde eventos de cambio (suplente sin evento = 45min estimado). Borde dorado = capitan.",
    M, y, { width: CW, lineBreak: false }
  );

  drawFooter();
  doc.end();
  return new Promise((resolve) => stream.on("finish", resolve));
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Cargando datos...");
  const datos = await cargarDatos();
  console.log(`  Jugadores: ${datos.jugadores.length}`);
  console.log(`  Partidos Santiso: ${datos.santisoPartidos.length}`);
  console.log(`  Stats rows: ${datos.stats.length}`);
  console.log(`  Eventos: ${datos.eventos.length}`);

  console.log("Calculando estadisticas...");
  const calc = calcularEstadisticas(datos);

  console.log("Generando PDF...");
  await generarPDF(calc);

  console.log(`PDF generado: ${OUTPUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
