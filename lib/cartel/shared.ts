/**
 * lib/cartel/shared.ts
 * Shared drawing layers used by all poster templates.
 */

import { W, H, CX, CL, CR, CW, BAR_W, BAR_CLR, GOLD, CAT_TINT } from "./constants";
import { rr } from "./primitives";


// ─── Background ───────────────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  fondo: HTMLImageElement | null
) {
  if (fondo) {
    const canvasAR = W / H;
    const imgAR    = fondo.naturalWidth / fondo.naturalHeight;
    let sx, sy, sw, sh;
    if (imgAR > canvasAR) {
      sh = fondo.naturalHeight; sw = sh * canvasAR;
      sx = (fondo.naturalWidth - sw) / 2; sy = 0;
    } else {
      sw = fondo.naturalWidth; sh = sw / canvasAR;
      sx = 0; sy = (fondo.naturalHeight - sh) / 2;
    }
    ctx.drawImage(fondo, sx, sy, sw, sh, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(0, 0, W, H);
  }

  // 1. Radial vignette — darkens corners, spotlights centre (Enhanced for depth)
  const vig = ctx.createRadialGradient(CX, H * 0.48, H * 0.15, CX, H * 0.48, H * 0.9);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.7, "rgba(0,0,0,0.4)");
  vig.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 2. Trading Card Foil / Metallic Diagonal Shine Overlay
  ctx.save();
  const foilGrad = ctx.createLinearGradient(0, 0, W, H);
  foilGrad.addColorStop(0.0, "rgba(255, 255, 255, 0.0)");
  foilGrad.addColorStop(0.4, "rgba(250, 204, 21, 0.05)"); // gold tint
  foilGrad.addColorStop(0.45, "rgba(255, 255, 255, 0.18)"); // sharp bright shine
  foilGrad.addColorStop(0.5, "rgba(250, 204, 21, 0.12)"); // gold reflection
  foilGrad.addColorStop(0.55, "rgba(255, 255, 255, 0.08)"); // secondary shine
  foilGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.15)"); // shadow contrast
  foilGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.4)");
  
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = foilGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 3. Premium Inner Frame (Double subtle border)
  ctx.save();
  const bm = 18; // border margin
  
  // Outer subtle gold
  ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bm, bm, W - bm * 2, H - bm * 2);

  // Inner subtle white/silver
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bm + 5, bm + 5, W - (bm + 5) * 2, H - (bm + 5) * 2);
  
  // Corner accents
  const cx = 8; // corner line length
  ctx.beginPath();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.8)";
  ctx.lineWidth = 2.5;
  
  // Top Left
  ctx.moveTo(bm, bm + cx); ctx.lineTo(bm, bm); ctx.lineTo(bm + cx, bm);
  // Top Right
  ctx.moveTo(W - bm - cx, bm); ctx.lineTo(W - bm, bm); ctx.lineTo(W - bm, bm + cx);
  // Bottom Right
  ctx.moveTo(W - bm, H - bm - cx); ctx.lineTo(W - bm, H - bm); ctx.lineTo(W - bm - cx, H - bm);
  // Bottom Left
  ctx.moveTo(bm + cx, H - bm); ctx.lineTo(bm, H - bm); ctx.lineTo(bm, H - bm - cx);
  ctx.stroke();
  
  ctx.restore();
}

/** Giant subtle club shield texture */
export function drawWatermark(ctx: CanvasRenderingContext2D, imgSantiso: HTMLImageElement | null) {
  if (!imgSantiso) return;
  ctx.save();
  ctx.globalAlpha = 0.025; // More subtle for better contrast
  const wSize = 920;
  // Positioned slightly off-center vertically to sit behind the main content area
  ctx.drawImage(imgSantiso, CX - wSize / 2, 760 - wSize / 2, wSize, wSize);
  ctx.restore();
}

/** Category-specific semi-transparent colour overlay. Disabled. */
export function drawCategoryTint(_ctx: CanvasRenderingContext2D, _categoria: string) {
  // Disabled per user request
}

// ─── Bars ─────────────────────────────────────────────────────────────────────

export function drawBars(ctx: CanvasRenderingContext2D, _textoLateral: string) {
  ctx.fillStyle = BAR_CLR;
  ctx.fillRect(0, 0, 10, H);
  ctx.fillRect(W - 10, 0, 10, H);

  const gL = ctx.createLinearGradient(10, 0, 56, 0);
  gL.addColorStop(0, "rgba(201,164,32,0.16)");
  gL.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gL;
  ctx.fillRect(10, 0, 50, H);

  const gR = ctx.createLinearGradient(W - 56, 0, W - 10, 0);
  gR.addColorStop(0, "rgba(0,0,0,0)");
  gR.addColorStop(1, "rgba(201,164,32,0.16)");
  ctx.fillStyle = gR;
  ctx.fillRect(W - 60, 0, 50, H);
}

// ─── Top logos ────────────────────────────────────────────────────────────────

export function drawTopLogos(
  ctx: CanvasRenderingContext2D,
  xunta: HTMLImageElement | null,
  rfgf:  HTMLImageElement | null,
  xuntaIsLeft: boolean,
  logoY = 30, logoH = 125
) {
  const leftImg  = xuntaIsLeft ? xunta : rfgf;
  const rightImg = xuntaIsLeft ? rfgf  : xunta;

  function place(img: HTMLImageElement | null, edgeX: number, side: "left" | "right", label: string, height: number) {
    if (img) {
      const r    = img.naturalWidth / img.naturalHeight;
      const rawW = height * r;
      const w    = Math.max(Math.min(rawW, 280), 80);
      const h    = w / r;
      const dy   = logoY + (logoH - h) / 2;
      const dx   = side === "left" ? edgeX : edgeX - w;
      ctx.drawImage(img, dx, dy, w, h);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      const bw = 140;
      const bx = side === "left" ? edgeX : edgeX - bw;
      rr(ctx, bx, logoY, bw, logoH, 8);
      ctx.fill();
      ctx.fillStyle    = "rgba(255,255,255,0.3)";
      ctx.font         = "700 13px 'Outfit'";
      ctx.textAlign    = side;
      ctx.textBaseline = "middle";
      const tx = side === "left" ? edgeX + 10 : edgeX - 10;
      ctx.fillText(label, tx, logoY + logoH / 2);
    }
  }

  const hXunta = 135;
  const hRFGF  = 90;

  place(leftImg,  CL, "left",  xuntaIsLeft ? "XUNTA"  : "RFGF",  xuntaIsLeft ? hXunta : hRFGF);
  place(rightImg, CR, "right", xuntaIsLeft ? "RFGF"   : "XUNTA", xuntaIsLeft ? hRFGF  : hXunta);

  // Golden separator — 28px below logo bottom
  const sepY = logoY + logoH + 28;
  const sepGrad = ctx.createLinearGradient(CL, 0, CR, 0);
  sepGrad.addColorStop(0,   "rgba(201,164,32,0)");
  sepGrad.addColorStop(0.2, "rgba(201,164,32,0.55)");
  sepGrad.addColorStop(0.8, "rgba(201,164,32,0.55)");
  sepGrad.addColorStop(1,   "rgba(201,164,32,0)");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(CL, sepY);
  ctx.lineTo(CR, sepY);
  ctx.stroke();
}

// ─── Sponsor bar ──────────────────────────────────────────────────────────────

export function drawSponsorBar(ctx: CanvasRenderingContext2D, sponsors: HTMLImageElement[]) {
  const SP_Y  = 1160;
  const SP_H  = 160;
  const SLOTS = 5;
  const slotW = CW / SLOTS;

  // Golden separator
  const sepY = SP_Y - 12;
  const sepGrad = ctx.createLinearGradient(CL, 0, CR, 0);
  sepGrad.addColorStop(0,   "rgba(201,164,32,0)");
  sepGrad.addColorStop(0.2, "rgba(201,164,32,0.55)");
  sepGrad.addColorStop(0.8, "rgba(201,164,32,0.55)");
  sepGrad.addColorStop(1,   "rgba(201,164,32,0)");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(CL, sepY);
  ctx.lineTo(CR, sepY);
  ctx.stroke();

  for (let i = 0; i < SLOTS; i++) {
    const img    = sponsors[i];
    const slotCX = CL + slotW * i + slotW / 2;
    const slotX  = CL + slotW * i;

    if (img) {
      const ratio = img.naturalWidth / img.naturalHeight;
      const maxW  = slotW - 20;
      let ih = SP_H - 20, iw = ih * ratio;
      if (iw > maxW) { iw = maxW; ih = iw / ratio; }
      const minH = (SP_H - 20) * 0.7;
      if (ih < minH) { ih = minH; iw = ih * ratio; if (iw > maxW) { iw = maxW; ih = iw / ratio; } }
      ctx.globalAlpha = 0.92;
      ctx.drawImage(img, slotCX - iw / 2, SP_Y + (SP_H - ih) / 2, iw, ih);
      ctx.globalAlpha = 1;
    }
  }
}

// ─── Club name by category ────────────────────────────────────────────────────

export function getSantisoName(categoria: string): string {
  return categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";
}
