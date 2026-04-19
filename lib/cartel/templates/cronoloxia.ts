/**
 * lib/cartel/templates/cronoloxia.ts
 * Template 3: Cronoloxía
 */

import { CX, CW, GREEN_TXT, GOLD } from "../constants";
import { fitFont, fmtDate, drawShield, shieldPlaceholder, drawEventIcon } from "../primitives";
import { getSantisoName, drawCategoryTint } from "../shared";
import type { CronEvent } from "../types";

export interface CronoloxiaForm {
  categoria:     string;
  rivalNombre:   string;
  santisoSide:   "left" | "right";
  fecha:         string;
  estadio:       string;
  golesLocal:    string;
  golesRival:    string;
  localSponsor:  string;   // sub-sponsor text under Santiso (e.g. "SOLAINA")
  rivalSponsor:  string;   // sub-sponsor text under rival (e.g. "HOSPEDAJE J.REY")
  events:        CronEvent[];
}

export function drawCronoloxia(
  ctx: CanvasRenderingContext2D,
  f: CronoloxiaForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, rivalNombre, santisoSide, fecha, estadio,
          golesLocal, golesRival, localSponsor, rivalSponsor, events } = f;

  // Category tint
  drawCategoryTint(ctx, categoria);

  // Stadium + Date header
  ctx.fillStyle    = "#cccccc";
  ctx.font         = "700 22px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  const headerTxt = estadio
    ? `${estadio.toUpperCase()}   ·   ${fmtDate(fecha, true)}`
    : fmtDate(fecha, true);
  fitFont(ctx, headerTxt, CW - 20, 22, 14, "700");
  ctx.fillStyle = "#aaaaaa";
  ctx.fillText(headerTxt, CX, 152);

  // "CRONOLOXÍA" in green
  ctx.fillStyle    = GREEN_TXT;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "CRONOLOXÍA", CW * 0.9, 118, 60, "900");
  ctx.fillText("CRONOLOXÍA", CX, 300);

  // Compact shield row
  const SY = 420, SS = 155, OFF = 215;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg   = santisoSide === "left" ? imgSantiso  : imgRival;
  const rightImg  = santisoSide === "left" ? imgRival    : imgSantiso;
  const leftTeam  = santisoSide === "left" ? getSantisoName(categoria) : (rivalNombre || "RIVAL");
  const rightTeam = santisoSide === "left" ? (rivalNombre || "RIVAL") : getSantisoName(categoria);
  const leftSub   = santisoSide === "left" ? localSponsor : rivalSponsor;
  const rightSub  = santisoSide === "left" ? rivalSponsor : localSponsor;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else shieldPlaceholder(ctx, lCX, SY, SS / 2);

  const score = `${golesLocal || "0"} — ${golesRival || "0"}`;
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, score, 190, 62, 36, "900");
  ctx.fillText(score, CX, SY);

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Team names - both white, Santiso gold shadow
  const NY = SY + SS / 2 + 38;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign    = "center";

  function drawTeamNameC(name: string, x: number, isSantiso: boolean) {
    fitFont(ctx, name, 260, 24, 14, "800");
    if (isSantiso) { ctx.save(); ctx.shadowColor = "rgba(250,204,21,0.65)"; ctx.shadowBlur = 16; }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, x, NY);
    if (isSantiso) ctx.restore();
  }
  drawTeamNameC(leftTeam,  lCX, santisoSide === "left");
  if (leftSub) {
    ctx.fillStyle = "#888"; ctx.font = "700 18px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftSub.toUpperCase(), lCX, NY + 26);
  }
  drawTeamNameC(rightTeam, rCX, santisoSide === "right");
  if (rightSub) {
    ctx.fillStyle = "#888"; ctx.font = "700 18px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rightSub.toUpperCase(), rCX, NY + 26);
  }

  // Vertical separator — drawn first so events render on top
  const SEP_TOP = 615, SEP_BOT = 1230;
  ctx.strokeStyle = "rgba(220,180,40,0.45)";
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(CX, SEP_TOP);
  ctx.lineTo(CX, SEP_BOT);
  ctx.stroke();
  ctx.lineWidth = 1;   // reset

  // Events
  const localEvts  = events.filter(e => e.equipo === "local")
                            .sort((a, b) => +a.minuto - +b.minuto);
  const rivalEvts  = events.filter(e => e.equipo === "rival")
                            .sort((a, b) => +a.minuto - +b.minuto);
  const maxRows    = Math.max(localEvts.length, rivalEvts.length, 1);
  const EVT_H      = Math.min(58, (SEP_BOT - SEP_TOP - 10) / maxRows);
  const ICON_SIZE  = 28;
  const MARGIN     = 22;

  // Column headers
  ctx.fillStyle    = "#555";
  ctx.font         = "700 13px 'Outfit', sans-serif";
  ctx.textAlign    = "right";
  ctx.fillText("LOCAL", CX - MARGIN - ICON_SIZE - 8, SEP_TOP - 8);
  ctx.textAlign = "left";
  ctx.fillText("RIVAL", CX + MARGIN + ICON_SIZE + 8, SEP_TOP - 8);

  // Draw left events (local, right-aligned to center)
  localEvts.forEach((ev, i) => {
    const y = SEP_TOP + i * EVT_H + EVT_H / 2;
    drawEventIcon(ctx, ev.tipo, CX - MARGIN - ICON_SIZE / 2, y, ICON_SIZE);
    ctx.fillStyle    = "#aaa";
    ctx.font         = "700 17px 'Outfit', sans-serif";
    ctx.textAlign    = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(`${ev.minuto}'`, CX - MARGIN - ICON_SIZE - 8, y);
    ctx.fillStyle    = "#ffffff";
    ctx.font         = "800 20px 'Outfit', sans-serif";
    ctx.textAlign    = "right";
    const maxW = CW / 2 - MARGIN - ICON_SIZE - 30;
    fitFont(ctx, ev.jugador.toUpperCase(), maxW, 20, 12, "800");
    ctx.fillText(ev.jugador.toUpperCase(), CX - MARGIN - ICON_SIZE - 40, y);
  });

  // Draw right events (rival, left-aligned from center)
  rivalEvts.forEach((ev, i) => {
    const y = SEP_TOP + i * EVT_H + EVT_H / 2;
    drawEventIcon(ctx, ev.tipo, CX + MARGIN + ICON_SIZE / 2, y, ICON_SIZE);
    ctx.fillStyle    = "#aaa";
    ctx.font         = "700 17px 'Outfit', sans-serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${ev.minuto}'`, CX + MARGIN + ICON_SIZE + 8, y);
    ctx.fillStyle    = "#ffffff";
    ctx.font         = "800 20px 'Outfit', sans-serif";
    ctx.textAlign    = "left";
    const maxW = CW / 2 - MARGIN - ICON_SIZE - 30;
    fitFont(ctx, ev.jugador.toUpperCase(), maxW, 20, 12, "800");
    ctx.fillText(ev.jugador.toUpperCase(), CX + MARGIN + ICON_SIZE + 40, y);
  });
}
