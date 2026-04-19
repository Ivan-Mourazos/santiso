/**
 * lib/cartel/templates/noso11.ts
 * Template 5: O Noso 11
 */

import { W, H, BAR_W, GOLD, GREEN_TXT } from "../constants";
import { fmtDate, drawShield, fitFont } from "../primitives";
import type { Player } from "../types";

export interface Noso11Form {
  categoria:  string;
  fecha:      string;
  estadio:    string;
  titulares:  Player[];
  suplentes:  Player[];
  jugadorFotoUrl: string;
}

export function drawNoso11(
  ctx: CanvasRenderingContext2D,
  f: Noso11Form,
  imgJugador: HTMLImageElement | null
) {
  const { categoria, fecha, estadio, titulares, suplentes } = f;

  // ── Left photo column ─────────────────────────────────────────────────────
  const PHOTO_W = 430;
  const PHOTO_X = BAR_W;

  if (imgJugador) {
    // Dark strip so PNG transparent pixels don't show background texture too much
    ctx.fillStyle = "#080808";
    ctx.fillRect(PHOTO_X, 0, PHOTO_W, H);

    const iAR = imgJugador.naturalWidth / imgJugador.naturalHeight;
    const tAR = PHOTO_W / (H - 80);
    let sx, sy, sw, sh;
    if (iAR > tAR) { sh = imgJugador.naturalHeight; sw = sh * tAR; sx = (imgJugador.naturalWidth - sw) / 2; sy = 0; }
    else            { sw = imgJugador.naturalWidth;  sh = sw / tAR; sx = 0; sy = 0; }
    ctx.drawImage(imgJugador, sx, sy, sw, sh, PHOTO_X, 60, PHOTO_W, H - 80);

    // Fades
    const fadeR = ctx.createLinearGradient(PHOTO_X + PHOTO_W * 0.55, 0, PHOTO_X + PHOTO_W, 0);
    fadeR.addColorStop(0, "rgba(0,0,0,0)");
    fadeR.addColorStop(1, "rgba(0,0,0,0.97)");
    ctx.fillStyle = fadeR;
    ctx.fillRect(PHOTO_X, 60, PHOTO_W, H - 80);

    const fadeB = ctx.createLinearGradient(0, H * 0.72, 0, H - 80);
    fadeB.addColorStop(0, "rgba(0,0,0,0)");
    fadeB.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = fadeB;
    ctx.fillRect(PHOTO_X, 60, PHOTO_W, H - 80);
  } else {
    const emptyG = ctx.createLinearGradient(PHOTO_X, 0, PHOTO_X + PHOTO_W, 0);
    emptyG.addColorStop(0, "rgba(0,0,0,0.65)");
    emptyG.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = emptyG;
    ctx.fillRect(PHOTO_X, 0, PHOTO_W, H);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle   = "#ffffff";
    ctx.font        = "900 120px 'Outfit'";
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("👤", PHOTO_X + PHOTO_W / 2, H / 2);
    ctx.restore();
  }

  // ── Right side: player list ───────────────────────────────────────────────
  const LIST_X = BAR_W + PHOTO_W + 18;
  const LIST_W = W - LIST_X - BAR_W - 10;

  // Venue + Date header
  const infoText = estadio ? `${estadio.toUpperCase()}   ${fmtDate(fecha, true)}` : fmtDate(fecha, true);
  ctx.fillStyle    = "#888";
  ctx.font         = "700 18px 'Outfit'";
  ctx.textAlign    = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(infoText, LIST_X, 152);

  // "O NOSO 11"
  ctx.fillStyle = GREEN_TXT;
  ctx.font      = "900 80px 'Outfit'";
  ctx.fillText("O NOSO", LIST_X, 262);
  ctx.fillText("11", LIST_X, 348);

  // Titulares with alternating backgrounds (Recommended Improvement)
  const START_Y = 385;
  const ROW_H   = Math.min(66, (870 - START_Y) / Math.max(titulares.length, 1));

  titulares.forEach((p, i) => {
    const y = START_Y + i * ROW_H;
    const midY = y + ROW_H / 2;

    // Alternating row highlighting
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(LIST_X - 10, y, LIST_W + 10, ROW_H);
    }

    // Dorsal
    ctx.fillStyle    = GOLD;
    ctx.font         = "900 24px 'Outfit'";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.dorsal.padStart(2, " "), LIST_X, midY);

    // Captain icon
    const nameX = LIST_X + 60;
    if (p.eCapitan) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(nameX - 14, midY, 10, 0, Math.PI * 2);
      ctx.fillStyle = "#4aa8d8";
      ctx.fill();
      ctx.fillStyle    = "#fff";
      ctx.font         = "900 12px 'Outfit'";
      ctx.textAlign    = "center";
      ctx.fillText("C", nameX - 14, midY);
      ctx.restore();
    }

    // Name
    ctx.fillStyle    = "#ffffff";
    ctx.font         = "800 24px 'Outfit'";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.nome.toUpperCase(), nameX, midY);
  });

  // "NO BANCO" separator
  const BANCO_Y = Math.max(START_Y + titulares.length * ROW_H + 18, 900);
  ctx.fillStyle = GOLD;
  ctx.font      = "800 20px 'Outfit'";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("NO BANCO", LIST_X, BANCO_Y);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(LIST_X, BANCO_Y + 6);
  ctx.lineTo(LIST_X + LIST_W, BANCO_Y + 6);
  ctx.stroke();

  // Suplentes
  const SUP_START  = BANCO_Y + 28;
  const SUP_ROW_H  = Math.min(56, (1230 - SUP_START) / Math.max(suplentes.length, 1));
  suplentes.forEach((p, i) => {
    const y = SUP_START + i * SUP_ROW_H;
    const midY = y + SUP_ROW_H / 2;

    if (i % 2 === 1) {
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      ctx.fillRect(LIST_X - 10, y, LIST_W + 10, SUP_ROW_H);
    }

    ctx.fillStyle    = GOLD;
    ctx.font         = "900 20px 'Outfit'";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.dorsal.padStart(2, " "), LIST_X, midY);

    ctx.fillStyle    = "#cccccc";
    ctx.font         = "700 20px 'Outfit'";
    ctx.fillText(p.nome.toUpperCase(), LIST_X + 52, midY);
  });
}
