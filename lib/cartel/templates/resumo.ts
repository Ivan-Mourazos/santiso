/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada
 */

import { CX, CW, GOLD, GREEN_TXT } from "../constants";
import { fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, drawCategoryBadge } from "../primitives";
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

  ctx.fillStyle = "#ffffff"; // Brighter white for date
  ctx.font      = "700 26px 'Outfit', sans-serif";
  ctx.fillText(fmtDate(fecha, true), CX, 534);

  // Estadio + Hora — Switched to WHITE for better contrast
  const infoTxt = `${lugar ? `🏟  ${lugar.toUpperCase()}` : "🏟  CAMPO A DEFINIR"}${hora ? `   ·   ${hora}H` : ""}`;
  ctx.font      = "800 20px 'Outfit', sans-serif";
  ctx.fillText(infoTxt, CX, 568);

  ctx.fillStyle = GOLD;
  ctx.font      = "800 28px 'Outfit', sans-serif";
  ctx.fillText(`XORNADA ${jornada}`, CX, 608);
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
