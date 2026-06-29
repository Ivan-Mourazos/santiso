/**
 * lib/cartel/templates/proximos.ts
 * Template 4: Próximos Encontros — dirección APPLE / REDONDEADO
 * Cada partido es un tile glass redondeado con el color de su categoría.
 */

import { CX, CL, CW, GOLD, catAccent } from "../constants";
import { rr, fitFont, drawShield, shieldPlaceholder, fmtDate, hexToRgba } from "../primitives";
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
  ctx.fillStyle = "#8b9097";
  ctx.font = "800 22px 'Nunito', sans-serif";
  ctx.fillText("AXENDA DA FIN DE SEMANA", CX, 234);

  ctx.fillStyle = GOLD;
  fitFont(ctx, "PRÓXIMOS ENCONTROS", CW, 70, 42, "900");
  ctx.fillText("PRÓXIMOS ENCONTROS", CX, 302);

  // ── Filas (tiles) con centrado dinámico ─────────────────────────────────────
  const validIndices = matches.map((m, i) => (m.rival ? i : -1)).filter((i) => i !== -1).slice(0, 3);
  const n = validIndices.length;

  const headerEnd = 360;
  const footerStart = 1140;
  const availableH = footerStart - headerEnd;
  const rowH = Math.min(250, availableH / Math.max(n, 1));
  const blockH = n * rowH;
  const startY = headerEnd + (availableH - blockH) / 2;

  validIndices.forEach((idx, i) => {
    const m = matches[idx];
    const imgRival = matchRivalImgs[idx];
    const accent = catAccent(m.categoria || "Senior");
    const gap = 16;
    const cardY = startY + rowH * i + gap / 2;
    const cardH = rowH - gap;
    const midY = cardY + cardH / 2;

    // Tile
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    rr(ctx, CL, cardY, CW, cardH, 30); ctx.fill();
    ctx.strokeStyle = hexToRgba(accent, 0.28);
    ctx.lineWidth = 1.5;
    rr(ctx, CL, cardY, CW, cardH, 30); ctx.stroke();
    // Barra de acento a la izquierda del tile
    ctx.fillStyle = accent;
    rr(ctx, CL, cardY + cardH * 0.22, 5, cardH * 0.56, 3); ctx.fill();

    // Etiqueta categoría · fecha · hora
    const catLabel = m.categoria === "Femenino" ? "FEMININO" : m.categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
    const datePart = m.fecha ? fmtDate(m.fecha) : "";
    const timePart = (m.hora || "").trim();
    const meta = [catLabel, datePart, timePart ? `${timePart}H` : ""].filter(Boolean).join("   ·   ");
    ctx.fillStyle = accent;
    ctx.font = "900 18px 'Nunito', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(meta, CX, cardY + 36);

    // Escudos
    const ssX = m.santisoSide === "left" ? CX - 175 : CX + 175;
    const rivX = m.santisoSide === "left" ? CX + 175 : CX - 175;
    const sSize = 104;
    const shieldY = midY + 16;

    if (imgSantiso) drawShield(ctx, imgSantiso, ssX, shieldY, sSize, true);
    else shieldPlaceholder(ctx, ssX, shieldY, sSize / 2);
    if (imgRival) drawShield(ctx, imgRival, rivX, shieldY, sSize, false);
    else shieldPlaceholder(ctx, rivX, shieldY, sSize / 2);

    // VS en cápsula de acento
    const vsW = 70, vsH = 50;
    ctx.fillStyle = accent;
    rr(ctx, CX - vsW / 2, shieldY - vsH / 2, vsW, vsH, vsH / 2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "900 24px 'Nunito', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VS", CX, shieldY + 1);

    // Nombres
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 16px 'Nunito', sans-serif";
    ctx.fillStyle = "#fff";
    const sName = getSantisoName(m.categoria || "").toUpperCase();
    const rName = (m.rival || "").toUpperCase();
    ctx.fillText(sName, ssX, shieldY + sSize / 2 + 28);
    ctx.fillText(rName, rivX, shieldY + sSize / 2 + 28);
  });

  drawSponsorBar(ctx, assets.sponsors);
}
