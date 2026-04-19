/**
 * lib/cartel/templates/partido.ts
 * Template 1: Cartel de Partido
 */

import { CX, CL, CR, CW, GOLD, GREEN_D } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawVsBadge, drawTeamName, drawCategoryBadge } from "../primitives";
import { drawCategoryTint, getSantisoName, drawWatermark } from "../shared";

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

  // 0. Background Watermark
  drawWatermark(ctx, imgSantiso);

  // Category colour tint on background
  drawCategoryTint(ctx, categoria);

  // 1. Headers — Competition and Match Day
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 8;
  ctx.fillStyle    = "#aaaaaa";
  ctx.font         = "700 25px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(competicion.toUpperCase(), CX, 169);

  drawCategoryBadge(ctx, categoria, 195);
  ctx.restore();

  // "XORNADA" label with shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur  = 10;
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "XORNADA", CW * 0.86, 112, 60, "900");
  ctx.fillText("XORNADA", CX, 390);

  // Jornada number — with white stroke for depth & shadow
  fitFont(ctx, jornada, CW * 0.74, 182, 80, "900");
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth   = 6;
  ctx.lineJoin    = "round";
  ctx.strokeText(jornada, CX, 578);
  ctx.fillText(jornada, CX, 578);
  ctx.restore();

  // Shields
  const SY = 730, SS = 215, OFF = 242;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);

  drawVsBadge(ctx, CX, SY);

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Team names with shadow
  const NY = SY + SS / 2 + 52;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 12;
  drawTeamName(ctx, leftName,  lCX, NY, 310, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 310, santisoSide === "right");
  ctx.restore();

  // ── Info boxes (REDESIGNED: GLASS PREMIUM) ──────────────────────────────────
  const BOX_Y = 920, BOX_H = 92, BOX_R = 24, GAP = 18;
  const HW    = (CW - GAP) / 2;

  function drawGlassBox(x: number, y: number, w: number, h: number, isAccent = false) {
    ctx.save();
    // Soft outer glow/shadow
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur  = 20;
    
    // Gradient or semi-trans black
    ctx.fillStyle = isAccent ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.78)";
    rr(ctx, x, y, w, h, BOX_R);
    ctx.fill();

    // Top edge highlight (Glass effect)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, BOX_R);
    ctx.stroke();
    ctx.restore();
  }

  // Row 1: Date & Time
  drawGlassBox(CL, BOX_Y, HW, BOX_H);
  drawGlassBox(CL + HW + GAP, BOX_Y, HW, BOX_H, true); // Subtle accent for time

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur  = 6;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";

  // Date Text
  ctx.fillStyle = "#ffffff";
  fitFont(ctx, fmtDate(fecha), HW - 30, 30, 20, "800");
  ctx.fillText(fmtDate(fecha), CL + HW / 2, BOX_Y + BOX_H / 2);

  // Time Text
  ctx.fillStyle = GOLD;
  ctx.font = "900 38px 'Outfit', sans-serif";
  ctx.fillText(hora ? `${hora}H` : "00:00H", CL + HW + GAP + HW / 2, BOX_Y + BOX_H / 2);
  ctx.restore();

  // Row 2: Venue
  const VY = BOX_Y + BOX_H + 20;
  drawGlassBox(CL, VY, CW, BOX_H);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur  = 6;
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  const venTxt = lugar ? `🏟  ${lugar.toUpperCase()}` : "🏟  CAMPO A DEFINIR";
  fitFont(ctx, venTxt, CW - 60, 32, 18, "800");
  ctx.fillText(venTxt, CX, VY + BOX_H / 2);
  ctx.restore();
}
