/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada
 */

import { CX, CW, GOLD } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, drawCategoryBadge } from "../primitives";
import { drawCategoryTint, getSantisoName, drawWatermark } from "../shared";
import type { PartidoForm } from "./partido";

export interface ResumoForm extends PartidoForm {
  golesLocal: string;
  golesRival: string;
  showCarouselIndicator?: boolean;
}

export function drawResumo(
  ctx: CanvasRenderingContext2D,
  f: ResumoForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, competicion, jornada, rivalNombre, fecha, hora, lugar, santisoSide, golesLocal, golesRival, showCarouselIndicator } = f;
  const santisoName = getSantisoName(categoria);

  // 1. Background Watermark (UD Santiso Shield)
  drawWatermark(ctx, imgSantiso);

  // Category tint
  drawCategoryTint(ctx, categoria);

  // Competition subtitle
  ctx.fillStyle    = "#aaaaaa";
  ctx.font         = "700 25px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(competicion.toUpperCase(), CX, 169);

  drawCategoryBadge(ctx, categoria, 195);

  // ─── Headers ───────────────────────────────────────────────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 8;

  // "RESUMO DA XORNADA"
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "RESUMO DA", CW * 0.84, 96, 50, "900");
  ctx.fillText("RESUMO DA", CX, 394);
  fitFont(ctx, "XORNADA", CW * 0.88, 102, 50, "900");
  ctx.fillText("XORNADA", CX, 492);

  // ── Info Section (REDESIGNED: GLASS PREMIUM) ──────────────────────────────────
  const BOX_H = 82, BOX_R = 18, GAP = 15;
  const MY = 525; // Base Y for info section
  
  function drawGlassBox(x: number, y: number, w: number, h: number, isAccent = false) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur  = 15;
    ctx.fillStyle = isAccent ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.72)";
    rr(ctx, x, y, w, h, BOX_R);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.2;
    rr(ctx, x, y, w, h, BOX_R);
    ctx.stroke();
    ctx.restore();
  }

  // Draw Date & Venue/Time block
  const boxW = CW * 0.94;
  const boxX = CX - boxW / 2;
  drawGlassBox(boxX, MY, boxW, BOX_H);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 6;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  // Date (Left-ish)
  ctx.fillStyle = "#ffffff";
  const dateStr = fmtDate(fecha, true);
  ctx.font = "900 24px 'Outfit', sans-serif";
  
  // Stadium & Time (Right-ish) - Separated by a yellow dot
  const stadiumStr = lugar ? lugar.toUpperCase() : "CAMPO A DEFINIR";
  const timeStr = hora ? `${hora}H` : "";
  const sep = "  •  ";
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 21px 'Outfit', sans-serif";
  const venueText = `🏟  ${stadiumStr}${timeStr ? `${sep}${timeStr}` : ""}`;
  
  // We draw them stacked slightly or inline if fits
  // Let's do a two-line approach within the box for maximum clarity
  ctx.fillText(dateStr, CX, MY + 25);
  ctx.fillStyle = GOLD;
  ctx.font = "800 19px 'Outfit', sans-serif";
  ctx.fillText(venueText, CX, MY + 56);
  ctx.restore();

  ctx.fillStyle = GOLD;
  ctx.font      = "900 32px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.fillText(`XORNADA ${jornada}`, CX, MY + BOX_H + 55);
  ctx.restore();

  // ─── Match Main Data ────────────────────────────────────────────────────────
  const SY = 780, SS = 260, OFF = 250;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);

  // Score — ENLARGED centred between shields with strong shadow
  const score = `${golesLocal || "0"} — ${golesRival || "0"}`;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 12;
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, score, 220, 92, 50, "900");
  ctx.fillText(score, CX, SY);
  ctx.restore();

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Team names — Pushed down with shadow
  const NY = SY + SS / 2 + 55;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 10;
  drawTeamName(ctx, leftName,  lCX, NY, 310, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 310, santisoSide === "right");
  ctx.restore();

  // Carousel indicator (X = CX, Y = near footer)
  if (showCarouselIndicator) {
    const IY = 1115;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Subtle separator line
    ctx.strokeStyle = "rgba(250,204,21,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(CX - 120, IY);
    ctx.lineTo(CX + 120, IY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "700 22px 'Outfit', sans-serif";
    ctx.fillText("DESPRAZA PARA O 11 E A CRONOLOXÍA  ➡️", CX, IY - 32);
  }
}
