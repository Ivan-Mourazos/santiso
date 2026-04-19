/**
 * lib/cartel/templates/proximos.ts
 * Template 4: Próximos Encontros
 */

import { CX, CL, CR, CW, GOLD } from "../constants";
import { rr, fitFont, drawShield, shieldPlaceholder, drawCategoryBadge, fmtDate } from "../primitives";
import type { NextMatch } from "../types";

export interface ProximosForm {
  categoriasText: string;  // e.g. "FEMININO – SÉNIOR – VETERANOS"
  matches:        NextMatch[];
}

export function drawProximos(
  ctx: CanvasRenderingContext2D,
  f: ProximosForm,
  imgSantiso: HTMLImageElement | null
) {
  const { categoriasText, matches = [] } = f;

  // ─ Club name + season at the top ───────────────────────────────
  ctx.fillStyle    = "rgba(255,255,255,0.15)";
  ctx.font         = "800 26px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("UD SANTISO FC", CX, 150);

  // Subtle golden divider lines framing the season
  const dY = 160;
  const dW = 130;
  [[CX - dW - 8, CX - 90], [CX + 90, CX + dW + 8]].forEach(([x1, x2]) => {
    ctx.strokeStyle = "rgba(201,164,32,0.5)";
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(x1, dY); ctx.lineTo(x2, dY); ctx.stroke();
  });
  ctx.fillStyle    = GOLD;
  ctx.font         = "700 20px 'Outfit', sans-serif";
  ctx.fillText("TEMPADA 2024/25", CX, 190);

  // ─ Golden halo behind shield ───────────────────────────────────
  const SY = 460, SS = 340;
  const halo = ctx.createRadialGradient(CX, SY, SS * 0.3, CX, SY, SS * 0.82);
  halo.addColorStop(0, "rgba(201,164,32,0.18)");
  halo.addColorStop(0.6, "rgba(201,164,32,0.06)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(CL, SY - SS, CW, SS * 2);

  // Shield
  if (imgSantiso) drawShield(ctx, imgSantiso, CX, SY, SS, true);
  else shieldPlaceholder(ctx, CX, SY, SS / 2);

  // Categories badge
  const badgeText = categoriasText || "FEMININO \u2013 S\u00c9NIOR \u2013 VETERANOS";
  drawCategoryBadge(ctx, badgeText, SY + SS / 2 + 30);

  // ─ Match Cards (Recommended Improvement) ────────────────────────
  if (matches.length > 0) {
    const cardH   = 100;
    const cardGap = 15;
    const startY  = 780;

    matches.slice(0, 3).forEach((m, i) => {
      const y = startY + (cardH + cardGap) * i;
      const rx = CL, width = CW;

      // Card Background
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      rr(ctx, rx, y, width, cardH, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      rr(ctx, rx, y, width, cardH, 12);
      ctx.stroke();

      // Date/Time
      ctx.fillStyle = GOLD;
      ctx.font = "800 20px 'Outfit', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(fmtDate(m.fecha), rx + 20, y + cardH * 0.3);
      ctx.fillStyle = "#fff";
      ctx.font = "700 16px 'Outfit', sans-serif";
      ctx.fillText(m.hora || "00:00H", rx + 20, y + cardH * 0.7);

      // Rival
      ctx.textAlign = "center";
      ctx.font = "900 24px 'Outfit', sans-serif";
      ctx.fillText(`VS   ${m.rival.toUpperCase()}`, CX, y + cardH / 2);

      // Category
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "700 16px 'Outfit', sans-serif";
      ctx.fillText(m.categoria.toUpperCase(), rx + width - 20, y + cardH / 2);
    });
  }

  // "PR\u00d3XIMOS ENCONTROS" big title
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "PR\u00d3XIMOS", CW * 0.88, 112, 60, "900");
  ctx.fillText("PR\u00d3XIMOS", CX, 1060);
  fitFont(ctx, "ENCONTROS", CW * 0.9, 112, 60, "900");
  ctx.fillText("ENCONTROS", CX, 1178);
}
