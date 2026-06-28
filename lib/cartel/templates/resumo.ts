/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada — dirección APPLE / REDONDEADO
 * Tarjeta-widget del marcador, cápsula de resultado, pills y mucho aire.
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

  // Resultado desde el punto de vista de Santiso
  const isLocalSantiso = santisoSide === "left";
  const sScore = parseInt((isLocalSantiso ? golesLocal : golesRival) || "0");
  const rScore = parseInt((isLocalSantiso ? golesRival : golesLocal) || "0");
  const resultado = sScore > rScore ? "VITORIA" : sScore < rScore ? "DERROTA" : "EMPATE";

  drawWatermark(ctx, imgSantiso);

  // Helper: pill / cápsula
  const pill = (text: string, cy: number, font: string, padX: number, h: number, fill: string, fg: string, stroke?: string) => {
    ctx.font = font;
    const w = ctx.measureText(text).width + padX * 2;
    const x = CX - w / 2, y = cy - h / 2;
    ctx.fillStyle = fill;
    rr(ctx, x, y, w, h, h / 2); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, h / 2); ctx.stroke(); }
    ctx.fillStyle = fg;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, CX, cy + 1);
  };

  // ── Kicker ──────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = "900 36px 'Nunito', sans-serif";
  ctx.fillText("RESUMO DA XORNADA", CX, 228);

  ctx.fillStyle = "#8b9097";
  ctx.font = "700 21px 'Nunito', sans-serif";
  fitFont(ctx, competicion.toUpperCase(), CW - 60, 21, 13, "700");
  ctx.fillText(competicion.toUpperCase(), CX, 262);

  // Meta pill: categoría · jornada
  const catLabel = categoria === "Femenino" ? "FEMININO" : categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
  pill(`${catLabel}   ·   XORNADA ${jornada}`, 312, "800 19px 'Nunito', sans-serif", 26, 44,
       hexToRgba(accent, 0.14), accent, hexToRgba(accent, 0.45));

  // ── Tarjeta-widget del marcador ─────────────────────────────────────────────
  const tileY = 372, tileH = 372;
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  rr(ctx, CL, tileY, CW, tileH, 46); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.5;
  rr(ctx, CL, tileY, CW, tileH, 46); ctx.stroke();

  const SY = tileY + 150, SS = 188, OFF = 300;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);
  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur  = 16;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = "900 196px 'Nunito', sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.fillText(golesLocal || "0", CX - 104, SY);
  ctx.fillText(golesRival || "0", CX + 104, SY);
  ctx.fillStyle    = accent;
  ctx.font         = "900 96px 'Nunito', sans-serif";
  ctx.fillText("–", CX, SY - 10);
  ctx.restore();

  // Nombres dentro del tile
  const NY = SY + SS / 2 + 56;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 8;
  drawTeamName(ctx, leftName,  lCX, NY, 320, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 320, santisoSide === "right");
  ctx.restore();

  // ── Cápsula de resultado ────────────────────────────────────────────────────
  pill(resultado, 818, "900 54px 'Nunito', sans-serif", 70, 104, accent, "#000000");

  // ── Fecha / sede ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "800 26px 'Nunito', sans-serif";
  ctx.fillText(fmtDate(fecha, true), CX, 948);

  const venue = lugar ? lugar.toUpperCase() : "CAMPO A DEFINIR";
  ctx.fillStyle = hexToRgba(accent, 0.95);
  ctx.font = "800 22px 'Nunito', sans-serif";
  const venueLine = hora ? `${venue}  ·  ${hora}H` : venue;
  fitFont(ctx, venueLine, CW - 40, 22, 14, "800");
  ctx.fillText(venueLine, CX, 984);

  // ── Carrusel ────────────────────────────────────────────────────────────────
  if (showCarouselIndicator) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "700 20px 'Nunito', sans-serif";
    ctx.fillText("DESPRAZA PARA O 11 E A CRONOLOXÍA", CX, 1044);
  }
}
