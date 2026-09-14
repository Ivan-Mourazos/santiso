/**
 * lib/cartel/templates/multiusos.ts
 * Template 6: Multiusos / Anuncio
 */

import { CX, CW, CL, CR, GOLD, H } from "../constants";
import { rr, fitFont } from "../primitives";
import { drawWatermark, drawCategoryTint, drawTopLogos, drawSponsorBar } from "../shared";
import type { CartelAssets } from "../types";

export interface MultiusosForm {
  categoria: string;
  multiusosTema: string;
  multiusosTitulo: string;
  multiusosTexto: string;
  jugadorXOffset?: number;
  jugadorYOffset?: number;
  jugadorZoom?: number;
  showAssets?: boolean;
}

const THEME_STYLES: Record<string, { accent: string; titleColor: string; bgGlow: string; icon: string; labelText: string }> = {
  celebracion: { accent: GOLD, titleColor: GOLD, bgGlow: "rgba(250, 204, 21, 0.08)", icon: "🏆", labelText: "CELEBRACIÓN OFICIAL" },
  medico: { accent: "#ef4444", titleColor: "#ef4444", bgGlow: "rgba(239, 68, 68, 0.08)", icon: "🏥", labelText: "PARTE MÉDICO" },
  fichaje: { accent: "#3b82f6", titleColor: "#60a5fa", bgGlow: "rgba(59, 130, 246, 0.08)", icon: "✍️", labelText: "NOVA INCORPORACIÓN" },
  despedida: { accent: "#a1a1aa", titleColor: "#ffffff", bgGlow: "rgba(161, 161, 170, 0.08)", icon: "👋", labelText: "COMUNICADO OFICIAL" },
  formal: { accent: GOLD, titleColor: "#ffffff", bgGlow: "rgba(255, 255, 255, 0.05)", icon: "📢", labelText: "COMUNICADO OFICIAL" },
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxW) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

function wrapMultilineText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const rawLines = text.split(/\r?\n/);
  const result: string[] = [];
  for (const raw of rawLines) {
    if (!raw.trim()) {
      result.push("");
      continue;
    }
    // Set font before measuring
    const wrapped = wrapText(ctx, raw, maxW);
    result.push(...wrapped);
  }
  return result;
}

function drawContainedImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const r = img.naturalWidth / img.naturalHeight;
  const boxR = w / h;
  let iw = w, ih = h;
  if (r > boxR) {
    ih = w / r;
  } else {
    iw = h * r;
  }
  const ix = x + (w - iw) / 2;
  const iy = y + (h - ih) / 2;
  ctx.drawImage(img, ix, iy, iw, ih);
}

function drawImageFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  ctx.save();
  // Outer Premium Glass Shadow
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 25;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "rgba(8,8,8,0.82)";
  rr(ctx, x, y, w, h, 20);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Clip content inside rounded rect
  ctx.save();
  rr(ctx, x, y, w, h, 20);
  ctx.clip();
  
  // Draw contained image centered
  drawContainedImage(ctx, img, x, y, w, h);
  ctx.restore();

  // Subtle inner border highlight
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  rr(ctx, x, y, w, h, 20);
  ctx.stroke();
  ctx.restore();
}

export function drawMultiusos(
  ctx: CanvasRenderingContext2D,
  f: MultiusosForm,
  assets: CartelAssets,
  img1: HTMLImageElement | null,
  img2: HTMLImageElement | null,
  imgJugador: HTMLImageElement | null = null,
  xuntaIsLeft: boolean = true
) {
  const { categoria, multiusosTema, multiusosTitulo, multiusosTexto, showAssets = true } = f;
  const theme = THEME_STYLES[multiusosTema] || THEME_STYLES.formal;

  // 1. Background Watermark & specific glow tint
  drawWatermark(ctx, assets.santiso);
  drawCategoryTint(ctx, categoria);

  ctx.save();
  ctx.fillStyle = theme.bgGlow;
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.restore();

  // 2. Theme Top Pill Badge
  // Posicionamiento ajustado para ser consistente con otros carteles (pegado a la línea dorada si existe)
  const badgeY = showAssets ? 122 : 80;
  const badgeText = `${theme.icon}  ${theme.labelText}`;
  ctx.save();
  ctx.font = "800 22px 'Nunito', sans-serif";
  const bW = ctx.measureText(badgeText).width + 60;
  const bH = 46;
  const bX = CX - bW / 2;

  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  rr(ctx, bX, badgeY, bW, bH, 23);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 1.5;
  rr(ctx, bX, badgeY, bW, bH, 23);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, CX, badgeY + bH / 2);
  ctx.restore();

  // 3. Main Title
  const titleY = showAssets ? 310 : 260;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = theme.titleColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, multiusosTitulo || "COMUNICADO", CW * 0.95, 68, 36, "900");
  ctx.fillText((multiusosTitulo || "COMUNICADO").toUpperCase(), CX, titleY);
  ctx.restore();

  // 4. Layout Area Distribution
  const hasImages = img1 || img2;
  const hasPlayer = !!imgJugador;

  if (hasPlayer) {
    // Si hay un jugador, lo pintamos a la izquierda y el texto a la derecha
    const PHOTO_W = CW * 0.45;
    const PHOTO_X = CL;
    const PHOTO_START_Y = 320;
    
    // Sombra trasera para que destaque
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(PHOTO_X, PHOTO_START_Y - 20, PHOTO_W, H - PHOTO_START_Y + 20);

    const zoom = f.jugadorZoom || 1.0;
    const iAR = imgJugador.naturalWidth / imgJugador.naturalHeight;
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
    
    ctx.save();
    ctx.beginPath();
    ctx.rect(PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y); 
    ctx.clip();
    ctx.drawImage(imgJugador, sx, sy, sw, sh, PHOTO_X, PHOTO_START_Y, PHOTO_W, H - PHOTO_START_Y); 
    ctx.restore();

    // Dibujar texto a la derecha
    const textStartX = PHOTO_X + PHOTO_W + 30;
    const maxTextW = CW - PHOTO_W - 30;
    
    ctx.save();
    ctx.font = `600 28px 'Nunito', sans-serif`;
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 8;

    const lines = wrapMultilineText(ctx, multiusosTexto || "", maxTextW);
    const lineHeight = 28 * 1.35;
    const totalTextH = lines.length * lineHeight;
    
    const textStartY = PHOTO_START_Y + ((H - PHOTO_START_Y) - totalTextH) / 2;
    lines.forEach((line, idx) => {
      ctx.fillText(line, textStartX + maxTextW / 2, textStartY + idx * lineHeight);
    });
    ctx.restore();
    return; // Terminamos, ya está todo dibujado para este modo
  }

  // Si no hay jugador, layout normal centrado
  const maxTextW = CW * 0.92;
  
  // Set text configuration
  ctx.save();
  const fontSize = hasImages ? 30 : 36;
  ctx.font = `600 ${fontSize}px 'Nunito', sans-serif`;
  ctx.fillStyle = "#f4f4f5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 8;

  const lines = wrapMultilineText(ctx, multiusosTexto || "", maxTextW);
  const lineHeight = fontSize * 1.35;
  const totalTextH = lines.length * lineHeight;

  if (hasImages) {
    // Top text, bottom images
    const textStartY = 370;
    lines.forEach((line, idx) => {
      ctx.fillText(line, CX, textStartY + idx * lineHeight);
    });
    ctx.restore();

    // Draw Premium Image Frames below
    // Available image space: Y=370 + totalTextH + 30 down to 1130
    const imgAreaTop = Math.max(textStartY + totalTextH + 20, 420);
    const imgAreaBottom = 1120;
    const imgAreaH = imgAreaBottom - imgAreaTop;

    if (img1 && img2) {
      // Split side-by-side frames
      const frameW = (CW - 40) / 2;
      const frameH = Math.min(imgAreaH, 540);
      const startY = imgAreaTop + (imgAreaH - frameH) / 2;
      
      drawImageFrame(ctx, img1, CL, startY, frameW, frameH);
      drawImageFrame(ctx, img2, CR - frameW, startY, frameW, frameH);
    } else {
      // Single centered large frame
      const singleImg = img1 || img2;
      if (singleImg) {
        const frameW = CW * 0.92;
        const frameH = Math.min(imgAreaH, 580);
        const startX = CX - frameW / 2;
        const startY = imgAreaTop + (imgAreaH - frameH) / 2;
        drawImageFrame(ctx, singleImg, startX, startY, frameW, frameH);
      }
    }
  } else {
    // Vertically center text in the huge empty space
    const emptySpaceTop = 350;
    const emptySpaceBottom = 1100;
    const emptySpaceH = emptySpaceBottom - emptySpaceTop;
    const textStartY = emptySpaceTop + (emptySpaceH - totalTextH) / 2 + lineHeight / 2;

    lines.forEach((line, idx) => {
      ctx.fillText(line, CX, textStartY + idx * lineHeight);
    });
    ctx.restore();
  }
}
