/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada — dirección EDITORIAL TIPOGRÁFICO
 * Composición asimétrica: headline gigante a la izquierda, índice de jornada
 * como elemento gráfico, barra de acento lateral y marcador limpio.
 */

import { CX, CL, CR, CW, catAccent } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, hexToRgba } from "../primitives";
import { getSantisoName, drawWatermark } from "../shared";
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
  const accent = catAccent(categoria);
  const LX = CL; // margen izquierdo editorial

  // Escudo watermark sutil (sello)
  drawWatermark(ctx, imgSantiso);

  // ── Barra de acento lateral ────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = accent;
  rr(ctx, 44, 252, 6, 372, 3);
  ctx.fill();
  ctx.restore();

  // ── Fila superior: competición (izq) + índice de xornada (der) ──────────────
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9aa0a6";
  ctx.textAlign = "left";
  fitFont(ctx, competicion.toUpperCase(), CW - 230, 23, 15, "700");
  ctx.fillText(competicion.toUpperCase(), LX, 266);

  // Índice de jornada (elemento gráfico, derecha)
  ctx.textAlign = "right";
  ctx.fillStyle = "#777777";
  ctx.font = "800 21px 'Outfit', sans-serif";
  ctx.fillText("XORNADA", CR, 252);
  ctx.fillStyle = accent;
  ctx.font = "900 92px 'Outfit', sans-serif";
  ctx.fillText(jornada || "—", CR, 338);

  // ── Pill de categoría (izquierda) ───────────────────────────────────────────
  ctx.textAlign = "left";
  const catLabel = categoria === "Femenino"  ? "EQUIPO FEMININO"
                 : categoria === "Veteranos" ? "EQUIPO VETERANO"
                 : "EQUIPO SÉNIORS";
  ctx.font = "800 22px 'Outfit', sans-serif";
  const plW = ctx.measureText(catLabel).width + 46;
  const plH = 46, plY = 300;
  ctx.fillStyle = hexToRgba(accent, 0.14);
  rr(ctx, LX, plY, plW, plH, 23); ctx.fill();
  ctx.strokeStyle = hexToRgba(accent, 0.5);
  ctx.lineWidth = 1.5;
  rr(ctx, LX, plY, plW, plH, 23); ctx.stroke();
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(catLabel, LX + 23, plY + plH / 2 + 1);
  ctx.textBaseline = "alphabetic";

  // ── Headline gigante, izquierda, dos líneas ─────────────────────────────────
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur  = 12;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, "RESUMO DA", CW, 118, 70, "900");
  ctx.fillText("RESUMO DA", LX, 488);
  ctx.fillStyle = accent;
  fitFont(ctx, "XORNADA", CW, 118, 70, "900");
  ctx.fillText("XORNADA", LX, 606);
  ctx.restore();

  // ── Regla divisoria ─────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LX, 664);
  ctx.lineTo(CR, 664);
  ctx.stroke();

  // ── Marcador (escudos + score limpio) ───────────────────────────────────────
  const SY = 815, SS = 208, OFF = 252;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Score grande y limpio (sin placa), guion en color de categoría
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 14;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = "900 132px 'Outfit', sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.fillText(golesLocal || "0", CX - 78, SY - 6);
  ctx.fillText(golesRival || "0", CX + 78, SY - 6);
  ctx.fillStyle    = accent;
  ctx.font         = "900 70px 'Outfit', sans-serif";
  ctx.fillText("–", CX, SY - 10);
  ctx.restore();

  // Nombres de equipo
  const NY = SY + SS / 2 + 56;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 10;
  drawTeamName(ctx, leftName,  lCX, NY, 320, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 320, santisoSide === "right");
  ctx.restore();

  // ── Línea de fecha / sede (izquierda, editorial) ────────────────────────────
  const infoY = 1028;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  // marcador cuadrado de acento
  ctx.fillStyle = accent;
  rr(ctx, LX, infoY - 7, 14, 14, 3); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 24px 'Outfit', sans-serif";
  ctx.fillText(fmtDate(fecha, true), LX + 28, infoY);

  const venue = lugar ? lugar.toUpperCase() : "CAMPO A DEFINIR";
  const venueLine = hora ? `${venue}  ·  ${hora}H` : venue;
  ctx.fillStyle = hexToRgba(accent, 0.95);
  ctx.font = "800 20px 'Outfit', sans-serif";
  fitFont(ctx, venueLine, CW - 40, 20, 14, "800");
  ctx.fillText(venueLine, LX + 28, infoY + 34);

  // ── Indicador de carrusel ───────────────────────────────────────────────────
  if (showCarouselIndicator) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.font = "700 21px 'Outfit', sans-serif";
    ctx.fillText("DESPRAZA PARA O 11 E A CRONOLOXÍA  ➡️", LX, 1112);
  }
}
