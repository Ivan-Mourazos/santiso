/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada — dirección APPLE / REDONDEADO
 * Tarjeta-widget del marcador, cápsula de resultado, pills y mucho aire.
 */

import { CX, CL, CW, FONT_DISPLAY, catAccent } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, hexToRgba, drawGlassCard } from "../primitives";
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

  // ── Kicker & Competición ───────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = `900 40px ${FONT_DISPLAY}`;
  ctx.fillText("RESUMO DA XORNADA", CX, 226);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 20px ${FONT_DISPLAY}`;
  fitFont(ctx, (competicion || "COMPETICIÓN OFICIAL").toUpperCase(), CW - 60, 20, 13, "700", FONT_DISPLAY);
  ctx.fillText((competicion || "COMPETICIÓN OFICIAL").toUpperCase(), CX, 260);

  // Meta pill: categoría · jornada
  const catLabel = categoria === "Femenino" ? "FEMININO" : categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
  pill(`${catLabel}   ·   XORNADA ${jornada}`, 310, `800 18px ${FONT_DISPLAY}`, 24, 42,
       hexToRgba(accent, 0.14), accent, hexToRgba(accent, 0.4));

  // ── Tarjeta-widget del marcador ─────────────────────────────────────────────
  const tileY = 368, tileH = 376;
  drawGlassCard(ctx, CL, tileY, CW, tileH, 38, { borderAccent: accent, fillAlpha: 0.04 });

  const SY = tileY + 154, SS = 192, OFF = 295;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg) {
    drawShield(ctx, leftImg, lCX, SY, SS, false, santisoSide === "left" ? accent : undefined);
  } else {
    shieldPlaceholder(ctx, lCX, SY, SS / 2);
  }

  if (rightImg) {
    drawShield(ctx, rightImg, rCX, SY, SS, false, santisoSide === "right" ? accent : undefined);
  } else {
    shieldPlaceholder(ctx, rCX, SY, SS / 2);
  }

  // Marcador central masivo
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur  = 20;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = `900 176px ${FONT_DISPLAY}`;
  ctx.fillStyle    = "#ffffff";
  ctx.fillText(golesLocal || "0", CX - 100, SY);
  ctx.fillText(golesRival || "0", CX + 100, SY);
  ctx.fillStyle    = accent;
  ctx.font         = `900 80px ${FONT_DISPLAY}`;
  ctx.fillText("–", CX, SY - 8);
  ctx.restore();

  // Nombres dentro del tile
  const NY = SY + SS / 2 + 56;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 12;
  drawTeamName(ctx, leftName,  lCX, NY, 310, santisoSide === "left", accent);
  drawTeamName(ctx, rightName, rCX, NY, 310, santisoSide === "right", accent);
  ctx.restore();

  // ── Cápsula de resultado ────────────────────────────────────────────────────
  const resBg = resultado === "VITORIA" ? "#10B981" : resultado === "DERROTA" ? "#EF4444" : accent;
  const resFg = resultado === "DERROTA" ? "#FFFFFF" : "#000000";
  pill(resultado, 816, `900 48px ${FONT_DISPLAY}`, 64, 94, resBg, resFg);

  // ── Fecha / sede ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 24px ${FONT_DISPLAY}`;
  ctx.fillText(fmtDate(fecha, true), CX, 948);

  const venue = lugar ? lugar.toUpperCase() : "CAMPO A DEFINIR";
  const venueLine = hora ? `📍 ${venue}  ·  ${hora}H` : `📍 ${venue}`;
  pill(venueLine, 990, `800 19px ${FONT_DISPLAY}`, 28, 48, "rgba(255,255,255,0.05)", "#ffffff", "rgba(255,255,255,0.1)");

  // ── Carrusel indicador ──────────────────────────────────────────────────────
  if (showCarouselIndicator) {
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `700 18px ${FONT_DISPLAY}`;
    ctx.fillText("DESLIZA PARA VER O 11 E A CRONOLOXÍA  👉", CX, 1060);
  }
}
