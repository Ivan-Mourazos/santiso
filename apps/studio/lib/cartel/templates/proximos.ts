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
  // Mostramos los slots configurados (hasta 3)
  const activeMatches = matches.slice(0, 3);
  const n = Math.max(activeMatches.length, 1);

  const headerEnd = 340;
  const footerStart = 1150;
  const availableH = footerStart - headerEnd;
  const rowH = Math.min(255, availableH / n);
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
    ctx.font = `800 17px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(meta, CX, cardY + 34);

    // Escudos
    const ssX = m.santisoSide === "left" ? CX - 180 : CX + 180;
    const rivX = m.santisoSide === "left" ? CX + 180 : CX - 180;
    const sSize = 98;
    const shieldY = midY + 16;

    if (imgSantiso) drawShield(ctx, imgSantiso, ssX, shieldY, sSize, false, accent);
    else shieldPlaceholder(ctx, ssX, shieldY, sSize / 2);

    if (imgRival) drawShield(ctx, imgRival, rivX, shieldY, sSize, false);
    else shieldPlaceholder(ctx, rivX, shieldY, sSize / 2);

    // VS en cápsula moderna
    const vsW = 68, vsH = 46;
    ctx.fillStyle = accent;
    rr(ctx, CX - vsW / 2, shieldY - vsH / 2, vsW, vsH, 16); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = `900 22px ${FONT_DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", CX, shieldY + 1);

    // Nombres
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 16px ${FONT_DISPLAY}`;
    ctx.fillStyle = "#fff";
    const sName = getSantisoName(m.categoria || "").toUpperCase();
    const rName = (m.rival || "RIVAL").toUpperCase();
    fitFont(ctx, sName, 190, 16, 12, "800", FONT_DISPLAY);
    ctx.fillText(sName, ssX, shieldY + sSize / 2 + 24);
    fitFont(ctx, rName, 190, 16, 12, "800", FONT_DISPLAY);
    ctx.fillText(rName, rivX, shieldY + sSize / 2 + 24);
  });

  drawSponsorBar(ctx, assets.sponsors);
}
