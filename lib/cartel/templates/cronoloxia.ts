/**
 * lib/cartel/templates/cronoloxia.ts
 * Template 3: Cronoloxía
 */

import { CX, CW, GREEN_TXT } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawEventIcon } from "../primitives";
import { getSantisoName, drawCategoryTint, drawWatermark } from "../shared";
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

  // 0. Background Watermark
  drawWatermark(ctx, imgSantiso);

  // Stadium + Date header (Above the golden line, which is at ~173)
  ctx.save();
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  const stadiumPart = estadio ? `${estadio.toUpperCase()}` : "ESTADIO A DEFINIR";
  const datePart = fmtDate(fecha, true);
  const headerTxt = `${stadiumPart}  ·  ${datePart}`;
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px 'Outfit', sans-serif";
  fitFont(ctx, headerTxt, CW - 40, 20, 14, "800");
  ctx.fillText(headerTxt, CX, 165);
  ctx.restore();

  // "CRONOLOXÍA" in green
  ctx.fillStyle    = GREEN_TXT;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "CRONOLOXÍA", CW * 0.9, 118, 60, "900");
  ctx.fillText("CRONOLOXÍA", CX, 305);

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
  const SEP_TOP = 590, SEP_BOT = 1110;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX, SEP_TOP);
  ctx.lineTo(CX, SEP_BOT);
  ctx.stroke();
  ctx.lineWidth = 1;   // reset

  // Events — swap columns based on santisoSide
  // "local" equipo always follows santisoSide (Santiso is always drawn on its side)
  const santisoEvts = events.filter(e => e.equipo === "local")
                            .sort((a, b) => +a.minuto - +b.minuto);
  const rivalEvts   = events.filter(e => e.equipo === "rival")
                            .sort((a, b) => +a.minuto - +b.minuto);

  // Left column = Santiso if santisoSide==="left", otherwise Rival
  const leftEvts  = santisoSide === "left" ? santisoEvts : rivalEvts;
  const rightEvts = santisoSide === "left" ? rivalEvts   : santisoEvts;

  const maxRows    = Math.max(leftEvts.length, rightEvts.length, 1);
  const EVT_H      = Math.min(58, (SEP_BOT - SEP_TOP - 10) / maxRows);
  const ICON_SIZE  = 28;
  const MARGIN     = 22;

  // Column headers — always fixed: LOCAL left, RIVAL right
  ctx.fillStyle    = "#555";
  ctx.font         = "700 13px 'Outfit', sans-serif";
  ctx.textAlign    = "right";
  ctx.fillText("LOCAL", CX - MARGIN - ICON_SIZE - 8, SEP_TOP - 8);
  ctx.textAlign = "left";
  ctx.fillText("RIVAL", CX + MARGIN + ICON_SIZE + 8, SEP_TOP - 8);

  function drawChangeCard(ev: CronEvent, anchorX: number, y: number, side: "left" | "right") {
    const sale = (ev.jugador || "").toUpperCase();
    const entra = (ev.jugadorEntra || "").toUpperCase();

    const isLeft = side === "left";

    // Typography
    const nameFont = "850 16px 'Outfit', sans-serif";
    const tagFont = "900 10px 'Outfit', sans-serif";
    const slashFont = "700 16px 'Outfit', sans-serif";
    
    ctx.font = nameFont;
    const saleW = ctx.measureText(sale).width;
    const entraW = ctx.measureText(entra).width;

    ctx.font = slashFont;
    const slashStr = "  /  ";
    const slashW = ctx.measureText(slashStr).width;

    const tagW = 48; // Wider tag
    const tagH = 20;
    const tagGap = 10; // Breathing room
    const padX = 18; // Outer padding

    const contentW = tagW + tagGap + saleW + slashW + tagW + tagGap + entraW;
    const cardW = contentW + padX * 2;
    const cardH = 38; // Slightly taller for more breath
    const cardX = isLeft ? anchorX - cardW : anchorX;
    const cardY = y - cardH / 2;

    // Draw pill background
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    rr(ctx, cardX, cardY, cardW, cardH, cardH / 2);
    ctx.fill();
    ctx.restore();

    // Outline
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    rr(ctx, cardX, cardY, cardW, cardH, cardH / 2);
    ctx.stroke();

    let curX = cardX + padX;

    // Helper to draw tag
    function drawTag(label: string, color: string, cx: number) {
      ctx.fillStyle = color;
      rr(ctx, cx, y - tagH / 2, tagW, tagH, tagH / 2);
      ctx.fill();
      ctx.fillStyle = "#050505";
      ctx.font = tagFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx + tagW / 2, y + 0.5);
    }

    // SALE tag
    drawTag("SALE", "#ef4444", curX);
    curX += tagW + tagGap;

    // SALE name
    ctx.fillStyle = "#fff";
    ctx.font = nameFont;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(sale, curX, y + 0.5);
    curX += saleW;

    // Slash
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = slashFont;
    ctx.textAlign = "left";
    ctx.fillText(slashStr, curX, y + 0.5);
    curX += slashW;

    // ENTRA tag
    drawTag("ENTRA", "#22c55e", curX);
    curX += tagW + tagGap;

    // ENTRA name
    ctx.fillStyle = "#fff";
    ctx.font = nameFont;
    ctx.textAlign = "left"; // FIXED: Was inheriting center from drawTag
    ctx.fillText(entra, curX, y + 0.5);
  }

  function drawTimelineEvent(ev: CronEvent, y: number, side: "left" | "right") {
    const isLeft = side === "left";
    const iconX = isLeft ? CX - MARGIN - ICON_SIZE / 2 : CX + MARGIN + ICON_SIZE / 2;
    const minuteX = isLeft ? CX - MARGIN - ICON_SIZE - 8 : CX + MARGIN + ICON_SIZE + 8;
    const textX = isLeft ? CX - MARGIN - ICON_SIZE - 40 : CX + MARGIN + ICON_SIZE + 40;
    const textAlign: CanvasTextAlign = isLeft ? "right" : "left";
    const nameMaxW = CW / 2 - MARGIN - ICON_SIZE - 30;

    if (ev.tipo === "cambio") {
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.arc(iconX, y, ICON_SIZE / 2 + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(34,197,94,0.5)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#22c55e";
      ctx.font = "900 18px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("↕", iconX, y - 1);
      ctx.restore();

      ctx.fillStyle = "#aaa";
      ctx.font = "700 17px 'Outfit', sans-serif";
      ctx.textAlign = textAlign;
      ctx.textBaseline = "middle";
      ctx.fillText(`${ev.minuto}'`, minuteX, y);
      drawChangeCard(ev, textX, y, side);
      return;
    }

    drawEventIcon(ctx, ev.tipo, iconX, y, ICON_SIZE);
    ctx.fillStyle = "#aaa";
    ctx.font = "700 17px 'Outfit', sans-serif";
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";
    ctx.fillText(`${ev.minuto}'`, minuteX, y);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 20px 'Outfit', sans-serif";
    ctx.textAlign = textAlign;
    const name = (ev.jugador || "").toUpperCase();
    fitFont(ctx, name, nameMaxW, 20, 12, "800");
    ctx.fillText(name, textX, y);
    ctx.restore();
  }

  // Draw left events (right-aligned toward center)
  leftEvts.forEach((ev, i) => {
    const y = SEP_TOP + i * EVT_H + EVT_H / 2;
    drawTimelineEvent(ev, y, "left");
  });

  // Draw right events (left-aligned from center)
  rightEvts.forEach((ev, i) => {
    const y = SEP_TOP + i * EVT_H + EVT_H / 2;
    drawTimelineEvent(ev, y, "right");
  });
}
