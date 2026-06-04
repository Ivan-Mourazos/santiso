/**
 * lib/cartel/templates/noso11.ts
 * Template 5: O Noso 11
 */

import { W, H, BAR_W, CX, GOLD, GREEN_TXT, CL, CR } from "../constants";
import { fmtDate, drawShield, fitFont, rr, drawPhotoEnvironment } from "../primitives";
import type { Player, CartelAssets } from "../types";
import { drawTopLogos, drawSponsorBar, drawCategoryTint, drawWatermark, drawStadiumGrass } from "../shared";

export interface Noso11Form {
  categoria:  string;
  fecha:      string;
  estadio:    string;
  titulares:      Player[];
  suplentes:      Player[];
  jugadorFotoUrl: string;
  jugadorXOffset: number;
  jugadorYOffset: number;
  jugadorZoom:    number;
  noso11Flip?:    boolean;
}

export function drawNoso11(
  ctx: CanvasRenderingContext2D,
  f: Noso11Form,
  imgJugador: HTMLImageElement | null,
  assets: CartelAssets,
  xuntaIsLeft: boolean
) {
  const { categoria, fecha, estadio, titulares, suplentes } = f;

  // Overlay completo — suprime fondo, vignette y foil diagonal de drawBackground
  ctx.fillStyle = "rgba(0,0,0,0.95)";
  ctx.fillRect(0, 0, W, H);

  // ── Layout Proportions ──────────────────────────────────────────────────
  // Photo stops 16px before center (invisible breathing gap)
  const GAP      = 16;
  const PHOTO_W  = CX - BAR_W - GAP;  // 464: stops before center
  const LIST_X_BASE = CX + GAP;        // starts 16px after center
  const LIST_W   = W - BAR_W - LIST_X_BASE; // 464

  const PHOTO_X = f.noso11Flip ? LIST_X_BASE : BAR_W;
  const LIST_X  = f.noso11Flip ? BAR_W : LIST_X_BASE;

  // Watermark — antes de la foto y del overlay de columna para que quede uniforme en ambas mitades
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
    
    // STRICT CLIPPING - Cut exactly at the column edge
    const CLIP_W = PHOTO_W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO_X, 0, CLIP_W, H); 
    ctx.clip();
    ctx.drawImage(imgJugador, sx, sy, sw, sh, PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y);
    ctx.restore();

    // Blend the photo into the dark poster (seam fade, vignette, tint, accent)
    drawPhotoEnvironment(ctx, PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y, {
      innerSide: f.noso11Flip ? "left" : "right",
    });

    // Líneas doradas horizontales — arriba (coincide con el golden separator) y abajo (antes de sponsors)
    const LINE_TOP_Y    = 183;
    const LINE_BOTTOM_Y = 1148;
    const lineX1 = PHOTO_X + 14;
    const lineX2 = PHOTO_X + PHOTO_W - 14;

    const lineGrad = (y: number) => {
      const g = ctx.createLinearGradient(lineX1, y, lineX2, y);
      g.addColorStop(0,   "rgba(201,164,32,0)");
      g.addColorStop(0.1, "rgba(201,164,32,0.55)");
      g.addColorStop(0.9, "rgba(201,164,32,0.55)");
      g.addColorStop(1,   "rgba(201,164,32,0)");
      return g;
    };

    ctx.save();
    ctx.lineWidth = 1.5;
    [LINE_TOP_Y, LINE_BOTTOM_Y].forEach(y => {
      ctx.beginPath();
      ctx.strokeStyle = lineGrad(y);
      ctx.moveTo(lineX1, y);
      ctx.lineTo(lineX2, y);
      ctx.stroke();
    });

    ctx.restore();
  }



  // Unified Header: Stadium · Date (Above the golden line, centered)
  ctx.save();
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  const venuePart = estadio ? `${estadio.toUpperCase()}` : "ESTADIO A DEFINIR";
  const dateStr = fmtDate(fecha, true);
  const headerTxt = `${venuePart}  ·  ${dateStr}`;
  
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 18px 'Outfit', sans-serif";
  fitFont(ctx, headerTxt, W - 140, 18, 14, "800");
  ctx.fillText(headerTxt, W / 2, 165);
  ctx.restore();

  // "O NOSO 11"
  ctx.fillStyle = GREEN_TXT;
  ctx.font      = "900 80px 'Outfit'";
  ctx.textAlign = "left";
  const titleX = LIST_X + 20; // Add small padding from the edge/split
  ctx.fillText("O NOSO", titleX, 262);
  ctx.fillText("11", titleX, 348);

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
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur  = 6;
    ctx.fillStyle    = "#ffffff";
    ctx.font         = "800 24px 'Outfit'";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(p.nome.toUpperCase(), nameX, midY);
    ctx.restore();
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

  // Suplentes — must not cross sponsor bar golden line (starts at ~1148)
  const SUP_MAX_Y  = 1140;
  const SUP_START  = BANCO_Y + 28;
  const SUP_AVAIL  = Math.max(SUP_MAX_Y - SUP_START, 40);
  const SUP_ROW_H  = Math.min(52, SUP_AVAIL / Math.max(suplentes.length, 1));
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

  drawCategoryTint(ctx, categoria);
}
