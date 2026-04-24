/**
 * lib/cartel/templates/proximos.ts
 * Template 4: Próximos Encontros
 */

import { CX, CL, CR, CW, GOLD } from "../constants";
import { rr, fitFont, drawShield, shieldPlaceholder, drawCategoryBadge, fmtDate } from "../primitives";
import type { NextMatch, CartelAssets } from "../types";
import { drawTopLogos, drawSponsorBar, drawCategoryTint, getSantisoName, drawWatermark } from "../shared";

export interface ProximosForm {
  categoriasText: string;  // e.g. "FEMININO – SÉNIOR – VETERANOS"
  matches:        NextMatch[];
  categoria:      string;
}

export function drawProximos(
  ctx: CanvasRenderingContext2D,
  f: ProximosForm,
  assets: CartelAssets,
  xuntaIsLeft: boolean,
  matchRivalImgs: (HTMLImageElement | null)[]
) {
  const { categoriasText, matches = [], categoria } = f;
  const imgSantiso = assets.santiso;

  // Global tint
  drawCategoryTint(ctx, categoria || "Sénior");

  // Institutional Header
  drawTopLogos(ctx, assets.xunta, assets.rfgf, xuntaIsLeft);
  drawSponsorBar(ctx, assets.sponsors);

  // 0. Background Watermark
  drawWatermark(ctx, assets.santiso);

  // ─ PRÓXIMOS ENCONTROS title ──────────────────────────────────
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "PRÓXIMOS", CW * 0.7, 86, 50, "900");
  ctx.fillText("PRÓXIMOS", CX, 290);
  fitFont(ctx, "ENCONTROS", CW * 0.75, 86, 50, "900");
  ctx.fillText("ENCONTROS", CX, 375);

  // ─ Match Rows (Dynamic Centering) ───────────────────────────
  const validIndices = matches.map((m, i) => m.rival ? i : -1).filter(i => i !== -1).slice(0, 3);
  const n = validIndices.length;
  
  const headerEnd = 450;
  const footerStart = 1150;
  const availableH = footerStart - headerEnd;
  const rowH = 230;
  const blockH = n * rowH;
  
  const startY = headerEnd + (availableH - blockH) / 2;

  validIndices.forEach((idx, i) => {
    const m = matches[idx];
    const imgRival = matchRivalImgs[idx];
    const y = startY + rowH * i;
    const padding = 15;
    const cardH = rowH - padding;

    // Card BG
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    rr(ctx, CL, y - 40, CW, cardH, 20);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Date + Category
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "900 18px 'Outfit'";
    ctx.textAlign = "center";
    const datePart = m.fecha ? fmtDate(m.fecha) : "";
    const timePart = (m.hora || "").trim();
    const dateTimePart = [datePart, timePart].filter(Boolean).join(" · ");
    const label = `${m.categoria} – ${dateTimePart}`.toUpperCase();
    ctx.fillText(label, CX, y - 5);

    // Shields config
    const ssX = m.santisoSide === "left" ? CX - 160 : CX + 160;
    const rivX = m.santisoSide === "left" ? CX + 160 : CX - 160;
    const sSize = 110;
    const shieldY = y + 75;

    // Santiso Shield
    if (imgSantiso) drawShield(ctx, imgSantiso, ssX, shieldY, sSize, true);
    
    // Rival Shield
    if (imgRival) drawShield(ctx, imgRival, rivX, shieldY, sSize, true);
    else shieldPlaceholder(ctx, rivX, shieldY, sSize / 2);

    // VS with more presence
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur  = 8;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "900 24px 'Outfit'";
    ctx.textAlign = "center";
    ctx.fillText("VS", CX, shieldY + 10);

    // Team Names (Small) with shadow
    ctx.font = "800 16px 'Outfit'";
    ctx.fillStyle = "#fff";
    const sName = getSantisoName(m.categoria || "").toUpperCase();
    ctx.fillText(sName, ssX, shieldY + sSize/2 + 30);
    const rName = (m.rival || "").toUpperCase();
    ctx.fillText(rName, rivX, shieldY + sSize/2 + 30);
    ctx.restore();
  });

  // ─ Sponsors ───────────────────────────────────────────────────
  drawSponsorBar(ctx, assets.sponsors);
}
