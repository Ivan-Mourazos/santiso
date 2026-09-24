/**
 * lib/cartel/templates/proximos.ts
 * Template 4: Próximos Encontros — dirección APPLE / REDONDEADO
 * Cada partido es un tile glass redondeado con el color de su categoría.
 */

import { CX, CL, CW, GOLD, FONT_DISPLAY, catAccent } from "../constants";
import { rr, fitFont, drawShield, shieldPlaceholder, fmtDate, drawGlassCard } from "../primitives";
import type { NextMatch, CartelAssets } from "../types";
import { drawSponsorBar, getSantisoName, drawWatermark } from "../shared";

export interface ProximosForm {
  categoriasText: string;
  matches:        NextMatch[];
  categoria:      string;
}

export function drawProximos(
  ctx: CanvasRenderingContext2D,
  f: ProximosForm,
  assets: CartelAssets,
  _xuntaIsLeft: boolean,
  matchRivalImgs: (HTMLImageElement | null)[]
) {
  const { matches = [] } = f;
  const imgSantiso = assets.santiso;

  drawWatermark(ctx, assets.santiso);

  // ── Título ──────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#94a3b8";
  ctx.font = `800 20px ${FONT_DISPLAY}`;
  ctx.fillText("AXENDA DA FIN DE SEMANA", CX, 230);

  ctx.fillStyle = GOLD;
  fitFont(ctx, "PRÓXIMOS ENCONTROS", CW - 40, 64, 38, "900", FONT_DISPLAY);
  ctx.fillText("PRÓXIMOS ENCONTROS", CX, 296);

  // ── Filas (tiles) con centrado dinámico ─────────────────────────────────────
  // Hasta 2 partidos (sénior y veteranos). Un hueco sin rival es una categoría que descansa y
  // no se dibuja; si ninguno tiene rival, se ven los huecos vacíos mientras se rellena.
  const conRival = matches.filter((m) => (m.rival || "").trim());
  const activeMatches = (conRival.length ? conRival : matches).slice(0, 2);
  const n = Math.max(activeMatches.length, 1);
  // Con menos partidos, tiles más grandes para ocupar el espacio.
  const s = n <= 2 ? 1.3 : 1;

  const headerEnd = 340;
  const footerStart = 1150;
  const availableH = footerStart - headerEnd;
  const rowH = Math.min(255 * s, availableH / n);
  const blockH = n * rowH;
  const startY = headerEnd + (availableH - blockH) / 2;

  activeMatches.forEach((m, idx) => {
    const imgRival = matchRivalImgs[idx];
    const accent = catAccent(m.categoria || "Senior");
    const gap = 16;
    const cardY = startY + rowH * idx + gap / 2;
    const cardH = rowH - gap;
    const midY = cardY + cardH / 2;

    // Modern Glass Tile
    drawGlassCard(ctx, CL, cardY, CW, cardH, 28, { borderAccent: accent, fillAlpha: 0.04 });

    // Barra de acento lateral
    ctx.fillStyle = accent;
    rr(ctx, CL, cardY + cardH * 0.2, 5, cardH * 0.6, 3); ctx.fill();

    // Etiqueta categoría · fecha · hora
    const catLabel = m.categoria === "Femenino" ? "FEMININO" : m.categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
    const datePart = m.fecha ? fmtDate(m.fecha) : "DATA POR DEFINIR";
    const timePart = (m.hora || "").trim();
    const meta = [catLabel, datePart, timePart ? `${timePart}H` : ""].filter(Boolean).join("   ·   ");
    ctx.fillStyle = accent;
    ctx.font = `800 ${Math.round(17 * s)}px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(meta, CX, cardY + 34 * s);

    // Escudos
    const ssX = m.santisoSide === "left" ? CX - 180 * s : CX + 180 * s;
    const rivX = m.santisoSide === "left" ? CX + 180 * s : CX - 180 * s;
    const sSize = Math.round(98 * s);
    const shieldY = midY + 16 * s;

    if (imgSantiso) drawShield(ctx, imgSantiso, ssX, shieldY, sSize, false, accent);
    else shieldPlaceholder(ctx, ssX, shieldY, sSize / 2);

    if (imgRival) drawShield(ctx, imgRival, rivX, shieldY, sSize, false);
    else shieldPlaceholder(ctx, rivX, shieldY, sSize / 2);

    // VS en cápsula moderna
    const vsW = 68 * s, vsH = 46 * s;
    ctx.fillStyle = accent;
    rr(ctx, CX - vsW / 2, shieldY - vsH / 2, vsW, vsH, 16 * s); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `900 ${Math.round(22 * s)}px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", CX, shieldY + 1);

    // Nombres
    ctx.textBaseline = "alphabetic";
    const nameSize = Math.round(16 * s);
    ctx.font = `800 ${nameSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = "#fff";
    const sName = getSantisoName(m.categoria || "").toUpperCase();
    const rName = (m.rival || "RIVAL").toUpperCase();
    fitFont(ctx, sName, 190 * s, nameSize, 12, "800", FONT_DISPLAY);
    ctx.fillText(sName, ssX, shieldY + sSize / 2 + 24 * s);
    fitFont(ctx, rName, 190 * s, nameSize, 12, "800", FONT_DISPLAY);
    ctx.fillText(rName, rivX, shieldY + sSize / 2 + 24 * s);
  });

  drawSponsorBar(ctx, assets.sponsors);
}
