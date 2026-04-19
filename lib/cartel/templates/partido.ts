/**
 * lib/cartel/templates/partido.ts
 * Template 1: Cartel de Partido
 */

import { CX, CL, CR, CW, GOLD, GREEN_D } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawVsBadge, drawTeamName, drawCategoryBadge } from "../primitives";
import { drawCategoryTint, getSantisoName } from "../shared";

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

  // Category colour tint on background
  drawCategoryTint(ctx, categoria);

  // Competition subtitle
  ctx.fillStyle    = "#aaaaaa";
  ctx.font         = "700 25px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(competicion.toUpperCase(), CX, 169);

  // Category badge
  drawCategoryBadge(ctx, categoria, 195);

  // "XORNADA" label
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "XORNADA", CW * 0.86, 112, 60, "900");
  ctx.fillText("XORNADA", CX, 390);

  // Jornada number — with white stroke for depth
  fitFont(ctx, jornada, CW * 0.74, 182, 80, "900");
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth   = 6;
  ctx.lineJoin    = "round";
  ctx.strokeText(jornada, CX, 578);
  ctx.restore();
  ctx.fillText(jornada, CX, 578);

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

  // Team names
  const NY = SY + SS / 2 + 52;
  drawTeamName(ctx, leftName,  lCX, NY, 290, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 290, santisoSide === "right");

  // ── Info boxes ──────────────────────────────────────────────────────────────
  const BOX_Y = 946, BOX_H = 72, BOX_R = 20, GAP = 16;
  const HW    = (CW - GAP) / 2;

  // Date box
  ctx.fillStyle   = "rgba(0,0,0,0.65)";
  rr(ctx, CL, BOX_Y, HW, BOX_H, BOX_R); ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,0.2)"; ctx.lineWidth = 1;
  rr(ctx, CL, BOX_Y, HW, BOX_H, BOX_R); ctx.stroke();
  ctx.fillStyle    = "#fff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, fmtDate(fecha), HW - 20, 30, 18, "800");
  ctx.fillText(fmtDate(fecha), CL + HW / 2, BOX_Y + BOX_H / 2);

  // Time box (green background = brand accent)
  const rxX = CL + HW + GAP;
  ctx.fillStyle = GREEN_D;
  rr(ctx, rxX, BOX_Y, HW, BOX_H, BOX_R); ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,0.35)";
  rr(ctx, rxX, BOX_Y, HW, BOX_H, BOX_R); ctx.stroke();
  ctx.fillStyle    = GOLD;
  ctx.font         = "800 36px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hora ? `${hora}H` : "00:00H", rxX + HW / 2, BOX_Y + BOX_H / 2);

  // Venue box
  const VY = BOX_Y + BOX_H + 14;
  ctx.fillStyle   = "rgba(0,0,0,0.65)";
  rr(ctx, CL, VY, CW, BOX_H, BOX_R); ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,0.18)";
  rr(ctx, CL, VY, CW, BOX_H, BOX_R); ctx.stroke();
  const venTxt = lugar ? `🏟  ${lugar.toUpperCase()}` : "🏟  CAMPO A DEFINIR";
  ctx.fillStyle    = "#fff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, venTxt, CW - 48, 29, 16, "800");
  ctx.fillText(venTxt, CX, VY + BOX_H / 2);
}
