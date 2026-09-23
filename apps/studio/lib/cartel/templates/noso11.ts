/**
 * lib/cartel/templates/noso11.ts
 * Template 5: O Noso 11
 */

import { W, H, BAR_W, CX, FONT_DISPLAY, catAccent } from "../constants";
import { fmtDate, fitFont, rr, drawPhotoEnvironment, hexToRgba } from "../primitives";
import type { Player, CartelAssets } from "../types";
import { drawWatermark } from "../shared";

export interface Noso11Form {
  categoria: string;
  fecha: string;
  estadio: string;
  titulares: Player[];
  suplentes: Player[];
  jugadorFotoUrl: string;
  jugadorXOffset: number;
  jugadorYOffset: number;
  jugadorZoom: number;
  noso11Flip?: boolean;
}

export function drawNoso11(
  ctx: CanvasRenderingContext2D,
  f: Noso11Form,
  imgJugador: HTMLImageElement | null,
  assets: CartelAssets,
  // Se conserva por firma: la cabecera con los logos la pinta ya el generador.
  _xuntaIsLeft: boolean,
) {
  const { categoria, fecha, estadio, titulares, suplentes } = f;
  const accent = catAccent(categoria);

  // Overlay completo estilizado obsidiana
  ctx.fillStyle = "#07080b";
  ctx.fillRect(0, 0, W, H);

  // Foco de iluminación atmosférica según categoría
  const glow = ctx.createRadialGradient(CX, 300, 50, CX, 350, 600);
  glow.addColorStop(0, hexToRgba(accent, 0.12));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Layout Proportions ──────────────────────────────────────────────────
  const GAP = 16;
  const PHOTO_W = CX - BAR_W - GAP; // 464
  const LIST_X_BASE = CX + GAP;
  const LIST_W = W - BAR_W - LIST_X_BASE; // 464

  const PHOTO_X = f.noso11Flip ? LIST_X_BASE : BAR_W;
  const LIST_X = f.noso11Flip ? BAR_W : LIST_X_BASE;

  drawWatermark(ctx, assets.santiso);

  if (imgJugador) {
    const zoom = f.jugadorZoom || 1.0;
    const iAR = imgJugador.naturalWidth / imgJugador.naturalHeight;
    const PHOTO_START_Y = 180;
    const tAR = PHOTO_W / (H - PHOTO_START_Y);

    let sw_base, sh_base;
    if (iAR > tAR) {
      sh_base = imgJugador.naturalHeight;
      sw_base = sh_base * tAR;
    } else {
      sw_base = imgJugador.naturalWidth;
      sh_base = sw_base / tAR;
    }

    const sw = sw_base / zoom;
    const sh = sh_base / zoom;

    const xOff = 1 - (f.jugadorXOffset ?? 0.5);
    const yOff = f.jugadorYOffset ?? 0.5;

    const sx = (imgJugador.naturalWidth - sw) * xOff;
    const sy = (imgJugador.naturalHeight - sh) * yOff;

    // STRICT CLIPPING
    const CLIP_W = PHOTO_W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO_X, 0, CLIP_W, H);
    ctx.clip();
    ctx.drawImage(imgJugador, sx, sy, sw, sh, PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y);
    ctx.restore();

    drawPhotoEnvironment(ctx, PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y, {
      innerSide: f.noso11Flip ? "left" : "right",
    });
  }

  // Unified Header: Stadium · Date
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const venuePart = estadio ? `${estadio.toUpperCase()}` : "ESTADIO A DEFINIR";
  const dateStr = fmtDate(fecha, true);
  const headerTxt = `${venuePart}  ·  ${dateStr}`;

  ctx.fillStyle = "#94a3b8";
  ctx.font = `800 17px ${FONT_DISPLAY}`;
  fitFont(ctx, headerTxt, W - 140, 17, 13, "800", FONT_DISPLAY);
  ctx.fillText(headerTxt, W / 2, 162);
  ctx.restore();

  // "O NOSO 11"
  const titleX = LIST_X + 16;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 52px ${FONT_DISPLAY}`;
  ctx.fillText("O NOSO", titleX, 240);
  ctx.fillStyle = accent;
  ctx.font = `900 78px ${FONT_DISPLAY}`;
  ctx.fillText("11", titleX + 210, 240);

  // Titulares
  const START_Y = 270;
  const ROW_H = Math.min(56, (850 - START_Y) / Math.max(titulares.length, 1));

  titulares.forEach((p, i) => {
    const y = START_Y + i * ROW_H;
    const midY = y + ROW_H / 2;

    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      rr(ctx, LIST_X - 6, y, LIST_W + 6, ROW_H - 2, 8);
      ctx.fill();
    }

    // Dorsal
    ctx.fillStyle = accent;
    ctx.font = `900 22px ${FONT_DISPLAY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.dorsal.padStart(2, " "), LIST_X + 4, midY);

    // Captain badge
    const nameX = LIST_X + 54;
    if (p.eCapitan) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(nameX - 12, midY, 9, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.fillStyle = "#000";
      ctx.font = `900 11px ${FONT_DISPLAY}`;
      ctx.textAlign = "center";
      ctx.fillText("C", nameX - 12, midY + 4);
      ctx.restore();
    }

    // Name
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 20px ${FONT_DISPLAY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    fitFont(ctx, p.nome.toUpperCase(), LIST_W - 70, 20, 13, "800", FONT_DISPLAY);
    ctx.fillText(p.nome.toUpperCase(), nameX, midY);
    ctx.restore();
  });

  // "NO BANCO" (Suplentes)
  const BANCO_Y = Math.max(START_Y + titulares.length * ROW_H + 16, 885);
  ctx.fillStyle = accent;
  ctx.font = `900 16px ${FONT_DISPLAY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("NO BANCO  (SUPLENTES)", LIST_X + 4, BANCO_Y);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LIST_X, BANCO_Y + 6);
  ctx.lineTo(LIST_X + LIST_W - 20, BANCO_Y + 6);
  ctx.stroke();

  const SUP_MAX_Y = 1140;
  const SUP_START = BANCO_Y + 18;
  const SUP_AVAIL = Math.max(SUP_MAX_Y - SUP_START, 40);
  const SUP_ROW_H = Math.min(44, SUP_AVAIL / Math.max(suplentes.length, 1));

  suplentes.forEach((p, i) => {
    const y = SUP_START + i * SUP_ROW_H;
    const midY = y + SUP_ROW_H / 2;

    ctx.fillStyle = hexToRgba(accent, 0.85);
    ctx.font = `900 18px ${FONT_DISPLAY}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.dorsal.padStart(2, " "), LIST_X + 4, midY);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 18px ${FONT_DISPLAY}`;
    fitFont(ctx, p.nome.toUpperCase(), LIST_W - 60, 18, 12, "700", FONT_DISPLAY);
    ctx.fillText(p.nome.toUpperCase(), LIST_X + 48, midY);
  });
}
