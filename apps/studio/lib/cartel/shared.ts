/**
 * lib/cartel/shared.ts
 * Shared drawing layers used by all poster templates.
 */

import { W, H, CX, CL, CR, CW, BAR_CLR, catAccent } from "./constants";
import { rr, hexToRgba } from "./primitives";


// ─── Background ───────────────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  categoria = "Senior"
) {
  const accent = catAccent(categoria);

  // 1. Base obsidiana profunda con gradiente suave
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#0a0c10");
  base.addColorStop(0.4, "#06070a");
  base.addColorStop(1, "#030406");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // 2. Foco central de estadio (Lighting bloom con el color de la categoría)
  const spot = ctx.createRadialGradient(CX, 460, 40, CX, 500, 720);
  spot.addColorStop(0, hexToRgba(accent, 0.16));
  spot.addColorStop(0.45, hexToRgba(accent, 0.05));
  spot.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // 3. Foco ambiental superior
  const topGlow = ctx.createRadialGradient(CX, 0, 20, CX, 0, 520);
  topGlow.addColorStop(0, hexToRgba(accent, 0.1));
  topGlow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, W, H);

  // 4. Viñeta perimetral suave
  const vig = ctx.createRadialGradient(CX, H * 0.48, H * 0.25, CX, H * 0.5, H * 0.85);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.65)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 5. Marco perimetral ultra-fino y elegante estilo editorial (sin doble marco)
  ctx.save();
  const bm = 22, R = 44;
  rr(ctx, bm, bm, W - bm * 2, H - bm * 2, R);
  const borderGrad = ctx.createLinearGradient(bm, bm, W - bm, H - bm);
  borderGrad.addColorStop(0, hexToRgba(accent, 0.35));
  borderGrad.addColorStop(0.3, "rgba(255,255,255,0.1)");
  borderGrad.addColorStop(0.7, "rgba(255,255,255,0.03)");
  borderGrad.addColorStop(1, hexToRgba(accent, 0.15));
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Césped de estadio — franjas horizontales casi imperceptibles */
export function drawStadiumGrass(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const stripeH = 60;
  const stripes = Math.ceil(H / stripeH);
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0
      ? "rgba(10, 40, 10, 0.18)"
      : "rgba(15, 55, 12, 0.18)";
    ctx.fillRect(0, i * stripeH, W, stripeH);
  }
  ctx.restore();
}

/** Giant subtle club shield texture */
export function drawWatermark(ctx: CanvasRenderingContext2D, imgSantiso: HTMLImageElement | null) {
  if (!imgSantiso) return;
  ctx.save();
  ctx.globalAlpha = 0.045;
  const wSize = 1180;
  ctx.drawImage(imgSantiso, CX - wSize / 2, H / 2 - wSize / 2, wSize, wSize);
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
  logoY = 32, logoH = 110
) {
  const leftImg  = xuntaIsLeft ? xunta : rfgf;
  const rightImg = xuntaIsLeft ? rfgf  : xunta;

  function place(img: HTMLImageElement | null, edgeX: number, side: "left" | "right", label: string, height: number) {
    if (img) {
      const r    = img.naturalWidth / img.naturalHeight;
      const rawW = height * r;
      const w    = Math.max(Math.min(rawW, 260), 80);
      const h    = w / r;
      const dy   = logoY + (logoH - h) / 2;
      const dx   = side === "left" ? edgeX : edgeX - w;
      ctx.drawImage(img, dx, dy, w, h);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      const bw = 130;
      const bx = side === "left" ? edgeX : edgeX - bw;
      rr(ctx, bx, logoY, bw, logoH, 8);
      ctx.fill();
      ctx.fillStyle    = "rgba(255,255,255,0.25)";
      ctx.font         = "700 13px 'Outfit', sans-serif";
      ctx.textAlign    = side;
      ctx.textBaseline = "middle";
      const tx = side === "left" ? edgeX + 10 : edgeX - 10;
      ctx.fillText(label, tx, logoY + logoH / 2);
    }
  }

  const hXunta = 120;
  const hRFGF  = 82;

  place(leftImg,  CL, "left",  xuntaIsLeft ? "XUNTA"  : "RFGF",  xuntaIsLeft ? hXunta : hRFGF);
  place(rightImg, CR, "right", xuntaIsLeft ? "RFGF"   : "XUNTA", xuntaIsLeft ? hRFGF  : hXunta);

  // Divisor sutil y elegante de luz
  const sepY = logoY + logoH + 20;
  const sepGrad = ctx.createLinearGradient(CL, 0, CR, 0);
  sepGrad.addColorStop(0,   "rgba(255,255,255,0)");
  sepGrad.addColorStop(0.2, "rgba(255,255,255,0.12)");
  sepGrad.addColorStop(0.5, "rgba(255,255,255,0.22)");
  sepGrad.addColorStop(0.8, "rgba(255,255,255,0.12)");
  sepGrad.addColorStop(1,   "rgba(255,255,255,0)");
  ctx.strokeStyle = sepGrad;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(CL, sepY);
  ctx.lineTo(CR, sepY);
  ctx.stroke();
}

// ─── Sponsor bar ──────────────────────────────────────────────────────────────

export function drawSponsorBar(ctx: CanvasRenderingContext2D, sponsors: HTMLImageElement[]) {
  const SP_Y  = 1175;
  const SP_H  = 140;
  const SLOTS = 5;
  const slotW = CW / SLOTS;

  // Dock contenedor de patrocinadores en cristal esmerilado moderno
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
  rr(ctx, CL, SP_Y, CW, SP_H, 24);
  ctx.fill();

  const dockBorder = ctx.createLinearGradient(CL, SP_Y, CR, SP_Y + SP_H);
  dockBorder.addColorStop(0, "rgba(255,255,255,0.12)");
  dockBorder.addColorStop(0.5, "rgba(255,255,255,0.05)");
  dockBorder.addColorStop(1, "rgba(255,255,255,0.02)");
  ctx.strokeStyle = dockBorder;
  ctx.lineWidth = 1;
  rr(ctx, CL, SP_Y, CW, SP_H, 24);
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i < SLOTS; i++) {
    const img    = sponsors[i];
    const slotCX = CL + slotW * i + slotW / 2;

    if (img) {
      const ratio = img.naturalWidth / img.naturalHeight;
      const maxW  = slotW - 24;
      let ih = SP_H - 30, iw = ih * ratio;
      if (iw > maxW) { iw = maxW; ih = iw / ratio; }
      const minH = (SP_H - 30) * 0.7;
      if (ih < minH) { ih = minH; iw = ih * ratio; if (iw > maxW) { iw = maxW; ih = iw / ratio; } }
      ctx.globalAlpha = 0.95;
      ctx.drawImage(img, slotCX - iw / 2, SP_Y + (SP_H - ih) / 2, iw, ih);
      ctx.globalAlpha = 1;
    }
  }
}

// ─── Club name by category ────────────────────────────────────────────────────

export function getSantisoName(categoria: string): string {
  return categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";
}
