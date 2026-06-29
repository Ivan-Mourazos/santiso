/**
 * lib/cartel/shared.ts
 * Shared drawing layers used by all poster templates.
 */

import { W, H, CX, CL, CR, CW, BAR_W, BAR_CLR, GOLD, CAT_TINT, catAccent } from "./constants";
import { rr, hexToRgba } from "./primitives";


// ─── Background ───────────────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  categoria = "Senior"
) {
  const accent = catAccent(categoria);

  // Base negra limpia (radial muy sutil para dar profundidad). La identidad la
  // ponen el escudo watermark + el acento de categoría (sin imagen de fondo).
  const base = ctx.createRadialGradient(CX, H * 0.4, 0, CX, H * 0.5, H * 0.95);
  base.addColorStop(0, "#111111");
  base.addColorStop(1, "#000000");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // 1. Vertical legibility gradient — sutil arriba, fuerte abajo (texto + sponsors)
  const vGrad = ctx.createLinearGradient(0, 0, 0, H);
  vGrad.addColorStop(0, "rgba(0,0,0,0.55)");
  vGrad.addColorStop(0.32, "rgba(0,0,0,0.22)");
  vGrad.addColorStop(0.62, "rgba(0,0,0,0.42)");
  vGrad.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. Radial vignette — foco al centro, suave (menos recargado que antes)
  const vig = ctx.createRadialGradient(CX, H * 0.46, H * 0.2, CX, H * 0.5, H * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 3. Ambient de categoría superior-derecha + inferior-izquierda — guiño de marca
  const glow = ctx.createRadialGradient(W * 0.82, H * 0.12, 0, W * 0.82, H * 0.12, W * 0.72);
  glow.addColorStop(0, hexToRgba(accent, 0.12));
  glow.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(W * 0.15, H * 0.9, 0, W * 0.15, H * 0.9, W * 0.6);
  glow2.addColorStop(0, hexToRgba(accent, 0.07));
  glow2.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 4. Marco redondeado estilo Apple: tarjeta con borde suave (sin esquinas duras)
  ctx.save();
  const bm = 26, R = 58;
  rr(ctx, bm, bm, W - bm * 2, H - bm * 2, R);
  ctx.strokeStyle = hexToRgba(accent, 0.18);
  ctx.lineWidth = 2;
  ctx.stroke();
  rr(ctx, bm + 3, bm + 3, W - (bm + 3) * 2, H - (bm + 3) * 2, R - 3);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
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
  // Premium: tamaño grande, opacidad sutil pero visible sobre negro limpio
  ctx.globalAlpha = 0.05;
  const wSize = 1150;
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
      ctx.font         = "700 13px 'Nunito'";
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
