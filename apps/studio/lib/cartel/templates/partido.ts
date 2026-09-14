/**
 * lib/cartel/templates/partido.ts
 * Template 1: Cartel de Partido (previa) — dirección APPLE / REDONDEADO
 * Consistente con Resumo: kicker, pill de categoría, tile del enfrentamiento y cápsula.
 */

import { CX, CL, CW, FONT_DISPLAY, catAccent } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, hexToRgba, drawGlassCard, drawVsBadge } from "../primitives";
import { getSantisoName, drawWatermark } from "../shared";

export interface PartidoForm {
  categoria:    string;
  competicion:  string;
  jornada:      string;
  rivalNombre:  string;
  rivalEscudoUrl: string;
  fecha:        string;
  hora:         string;
  lugar:        string;
  santisoSide:  "left" | "right";
}

export function drawPartido(
  ctx: CanvasRenderingContext2D,
  f: PartidoForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, competicion, jornada, rivalNombre, fecha, hora, lugar, santisoSide } = f;
  const santisoName = getSantisoName(categoria);
  const accent = catAccent(categoria);

  drawWatermark(ctx, imgSantiso);

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
  ctx.fillText("DÍA DE PARTIDO", CX, 226);

  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 20px ${FONT_DISPLAY}`;
  fitFont(ctx, (competicion || "COMPETICIÓN OFICIAL").toUpperCase(), CW - 60, 20, 13, "700", FONT_DISPLAY);
  ctx.fillText((competicion || "COMPETICIÓN OFICIAL").toUpperCase(), CX, 260);

  const catLabel = categoria === "Femenino" ? "FEMININO" : categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
  pill(`${catLabel}   ·   XORNADA ${jornada}`, 310, `800 18px ${FONT_DISPLAY}`, 24, 42,
       hexToRgba(accent, 0.14), accent, hexToRgba(accent, 0.4));

  // ── Tarjeta Glass del enfrentamiento ────────────────────────────────────────
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

  // VS Badge central
  drawVsBadge(ctx, CX, SY, accent);

  const NY = SY + SS / 2 + 56;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 12;
  drawTeamName(ctx, leftName,  lCX, NY, 310, santisoSide === "left", accent);
  drawTeamName(ctx, rightName, rCX, NY, 310, santisoSide === "right", accent);
  ctx.restore();

  // ── Cápsula fecha · hora ────────────────────────────────────────────────────
  const dateLine = `${fmtDate(fecha, true)}${hora ? `   ·   ${hora}H` : ""}`;
  pill(dateLine, 816, `900 28px ${FONT_DISPLAY}`, 48, 90, accent, "#000000");

  // ── Sede en cápsula moderna ─────────────────────────────────────────────────
  const venue = lugar ? `📍 ${lugar.toUpperCase()}` : "📍 CAMPO A DEFINIR";
  pill(venue, 946, `800 20px ${FONT_DISPLAY}`, 32, 54, "rgba(255,255,255,0.05)", "#ffffff", "rgba(255,255,255,0.12)");
}
