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

  // Radial vignette — darkens corners, spotlights centre
  const vig = ctx.createRadialGradient(CX, H * 0.48, H * 0.22, CX, H * 0.48, H * 0.82);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.52)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
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
