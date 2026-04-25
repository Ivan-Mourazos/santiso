/**
 * lib/cartel/templates/cronoloxia.ts
 * Template 3: Cronoloxía
 */

import { CX, CW, GREEN_TXT } from "../constants";
import {
  rr,
  fitFont,
  fmtDate,
  drawShield,
  shieldPlaceholder,
  drawEventIcon,
} from "../primitives";
import { getSantisoName, drawCategoryTint, drawWatermark } from "../shared";
import type { CronEvent } from "../types";

export interface CronoloxiaForm {
  categoria: string;
  rivalNombre: string;
  santisoSide: "left" | "right";
  fecha: string;
  estadio: string;
  golesLocal: string;
  golesRival: string;
  localSponsor: string; // sub-sponsor text under Santiso (e.g. "SOLAINA")
  rivalSponsor: string; // sub-sponsor text under rival (e.g. "HOSPEDAJE J.REY")
  events: CronEvent[];
}

export function drawCronoloxia(
  ctx: CanvasRenderingContext2D,
  f: CronoloxiaForm,
  imgRival: HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null,
) {
  const {
    categoria,
    rivalNombre,
    santisoSide,
    fecha,
    estadio,
    golesLocal,
    golesRival,
    localSponsor,
    rivalSponsor,
    events,
  } = f;

  // Category tint
  drawCategoryTint(ctx, categoria);

  // 0. Background Watermark
  drawWatermark(ctx, imgSantiso);

  // Stadium + Date header (Above the golden line, which is at ~173)
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const stadiumPart = estadio
    ? `${estadio.toUpperCase()}`
    : "ESTADIO A DEFINIR";
  const datePart = fmtDate(fecha, true);
  const headerTxt = `${stadiumPart}  ·  ${datePart}`;

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px 'Outfit', sans-serif";
  fitFont(ctx, headerTxt, CW - 40, 20, 14, "800");
  ctx.fillText(headerTxt, CX, 165);
  ctx.restore();

  // "CRONOLOXÍA" in green
  ctx.fillStyle = GREEN_TXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "CRONOLOXÍA", CW * 0.9, 118, 60, "900");
  ctx.fillText("CRONOLOXÍA", CX, 305);

  // Compact shield row
  const SY = 420,
    SS = 155,
    OFF = 215;
  const lCX = CX - OFF,
    rCX = CX + OFF;
  const leftImg = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival : imgSantiso;
  const leftTeam =
    santisoSide === "left" ? getSantisoName(categoria) : rivalNombre || "RIVAL";
  const rightTeam =
    santisoSide === "left" ? rivalNombre || "RIVAL" : getSantisoName(categoria);
  const leftSub = santisoSide === "left" ? localSponsor : rivalSponsor;
  const rightSub = santisoSide === "left" ? rivalSponsor : localSponsor;

  if (leftImg) drawShield(ctx, leftImg, lCX, SY, SS, santisoSide === "left");
  else shieldPlaceholder(ctx, lCX, SY, SS / 2);

  const score = `${golesLocal || "0"} — ${golesRival || "0"}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, score, 190, 62, 36, "900");
  ctx.fillText(score, CX, SY);

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Team names - both white, Santiso gold shadow
  const NY = SY + SS / 2 + 38;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  function drawTeamNameC(name: string, x: number, isSantiso: boolean) {
    fitFont(ctx, name, 260, 24, 14, "800");
    if (isSantiso) {
      ctx.save();
      ctx.shadowColor = "rgba(250,204,21,0.65)";
      ctx.shadowBlur = 16;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(name, x, NY);
    if (isSantiso) ctx.restore();
  }
  drawTeamNameC(leftTeam, lCX, santisoSide === "left");
  if (leftSub) {
    ctx.fillStyle = "#888";
    ctx.font = "700 18px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftSub.toUpperCase(), lCX, NY + 26);
  }
  drawTeamNameC(rightTeam, rCX, santisoSide === "right");
  if (rightSub) {
    ctx.fillStyle = "#888";
    ctx.font = "700 18px 'Outfit', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(rightSub.toUpperCase(), rCX, NY + 26);
  }

  // Vertical separator — drawn first so events render on top
  const SEP_TOP = 590,
    SEP_BOT = 1110;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(CX, SEP_TOP);
  ctx.lineTo(CX, SEP_BOT);
  ctx.stroke();
  ctx.lineWidth = 1; // reset

  // Events — swap columns based on santisoSide
  // "local" equipo always follows santisoSide (Santiso is always drawn on its side)
  const santisoEvts = events
    .filter((e) => e.equipo === "local")
    .sort((a, b) => +a.minuto - +b.minuto);
  const rivalEvts = events
    .filter((e) => e.equipo === "rival")
    .sort((a, b) => +a.minuto - +b.minuto);

  // Left column = Santiso if santisoSide==="left", otherwise Rival
  const leftEvts = santisoSide === "left" ? santisoEvts : rivalEvts;
  const rightEvts = santisoSide === "left" ? rivalEvts : santisoEvts;

  const maxRows = Math.max(leftEvts.length, rightEvts.length, 1);
  const EVT_H = Math.min(58, (SEP_BOT - SEP_TOP - 10) / maxRows);
  const ICON_SIZE = 28;
  const MARGIN = 22;

  // Column headers — always fixed: LOCAL left, RIVAL right
  ctx.fillStyle = "#555";
  ctx.font = "700 13px 'Outfit', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("LOCAL", CX - MARGIN - ICON_SIZE - 8, SEP_TOP - 8);
  ctx.textAlign = "left";
  ctx.fillText("RIVAL", CX + MARGIN + ICON_SIZE + 8, SEP_TOP - 8);

  function drawChangeCard(ev: CronEvent, anchorX: number, y: number, side: "left" | "right") {
    const cardW = Math.min(360, CW / 2 - 120);
    const cardH = Math.min(58, Math.max(48, EVT_H + 4));
    const cardX = side === "left" ? anchorX - cardW : anchorX;
    const cardY = y - cardH / 2;
    const padX = 14;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    rr(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.restore();

    const grad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    grad.addColorStop(0, "rgba(239,68,68,0.18)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.035)");
    grad.addColorStop(1, "rgba(34,197,94,0.18)");
    ctx.fillStyle = grad;
    rr(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1;
    rr(ctx, cardX, cardY, cardW, cardH, 14);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.moveTo(cardX + padX, y);
    ctx.lineTo(cardX + cardW - padX, y);
    ctx.stroke();

    const labelW = 56;
    const labelH = 18;
    const labelX = cardX + padX;
    const outY = cardY + cardH * 0.29;
    const inY = cardY + cardH * 0.72;
    // Sale = quien cede (jugador); Entra = jugadorEntra (cambio en DB)
    const sale = (ev.jugador || "").toUpperCase();
    const entra = (ev.jugadorEntra || "").toUpperCase();

    function drawSubLine(label: string, color: string, name: string, lineY: number) {
      ctx.fillStyle = color;
      rr(ctx, labelX, lineY - labelH / 2, labelW, labelH, 9);
      ctx.fill();

      ctx.fillStyle = "#050505";
      ctx.font = "900 10px 'Outfit', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, labelX + labelW / 2, lineY + 0.5);

      const nameX = labelX + labelW + 12;
      const maxNameW = cardW - padX * 2 - labelW - 14;
      ctx.fillStyle = "#fff";
      ctx.font = "850 15px 'Outfit', sans-serif";
      ctx.textAlign = "left";
      fitFont(ctx, name || "—", maxNameW, 15, 10, "850");
      ctx.fillText(name || "—", nameX, lineY + 0.5);
    }

    drawSubLine("SALE", "#ef4444", sale, outY);
    drawSubLine("ENTRA", "#22c55e", entra, inY);
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
