/**
 * lib/cartel/primitives.ts
 * Low-level canvas utilities and atomic drawing helpers.
 */

import { W, H, CX, GOLD, GREEN_TXT } from "./constants";
import type { CronEvent } from "./types";

// ─── Image loading ────────────────────────────────────────────────────────────

/** Load HTMLImageElement from URL. External URLs get crossOrigin=anonymous. */
export function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    if (src.startsWith("http://") || src.startsWith("https://")) {
      img.crossOrigin = "anonymous";
    }
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// ─── Photo environment (blend a clipped photo into the dark poster) ───────────

/**
 * Softens how an inserted photo meets the dark poster: brand tint for cohesion,
 * internal vignette, a fade on the inner seam (toward the text/list panel),
 * top + bottom fades, and a thin gold accent line at the seam.
 * Call AFTER drawing the photo. Coordinates are the photo's destination rect.
 */
export function drawPhotoEnvironment(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  opts: { innerSide: "left" | "right"; tint?: string } = { innerSide: "right" }
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Fade inferior — transición suave hacia los sponsors
  const bF = Math.min(180, h * 0.2);
  const gb = ctx.createLinearGradient(0, y + h - bF, 0, y + h);
  gb.addColorStop(0, "rgba(0,0,0,0)");
  gb.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = gb;
  ctx.fillRect(x, y, w, h);

  ctx.restore();

}

// ─── Canvas path helpers ──────────────────────────────────────────────────────

/** Draw rounded-rect path (no fill/stroke — caller does that). */
export function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/** Reduce font size until text fits maxW (modifies ctx.font). */
export function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string, maxW: number,
  startSize: number, minSize: number,
  weight: string
): number {
  let sz = startSize;
  ctx.font = `${weight} ${sz}px 'Outfit', sans-serif`;
  while (ctx.measureText(text).width > maxW && sz > minSize) {
    sz--;
    ctx.font = `${weight} ${sz}px 'Outfit', sans-serif`;
  }
  return sz;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

const MESES = ["","XANEIRO","FEBREIRO","MARZO","ABRIL","MAIO","XUÑO",
               "XULLO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DECEMBRO"];

/** Format YYYY-MM-DD → DD / MM / YYYY (or long Galician form). */
export function fmtDate(s: string, long = false): string {
  if (!s) return long ? "DD DE MES DE AAAA" : "DD / MM / AAAA";
  const [y, m, d] = s.split("-");
  if (long) return `${parseInt(d)} DE ${MESES[parseInt(m)] ?? m} DE ${y}`;
  return `${d} / ${m} / ${y}`;
}

// ─── Shield drawing ───────────────────────────────────────────────────────────

/** Draw team shield with drop shadow. glowGold=true for Santiso. */
export function drawShield(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number, cy: number, size: number,
  glowGold = false
) {
  ctx.save();
  if (glowGold) {
    ctx.shadowColor = "rgba(250,204,21,0.45)";
    ctx.shadowBlur  = 32;
  } else {
    ctx.shadowColor   = "rgba(0,0,0,0.75)";
    ctx.shadowBlur    = 28;
    ctx.shadowOffsetY = 10;
  }
  ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  ctx.restore();
}

/** Dashed circle placeholder for missing shields. */
export function shieldPlaceholder(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number
) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── VS Badge ─────────────────────────────────────────────────────────────────

/** Draw an impactful golden VS badge (replaces plain text). */
export function drawVsBadge(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const vsW = 120, vsH = 72;
  ctx.save();
  ctx.shadowColor = "rgba(250,204,21,0.55)";
  ctx.shadowBlur  = 24;
  ctx.fillStyle   = GOLD;
  rr(ctx, cx - vsW / 2, cy - vsH / 2, vsW, vsH, 36);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle    = "#000000";
  ctx.font         = "900 48px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("VS", cx, cy);
}

// ─── Team name with gold glow for Santiso ─────────────────────────────────────

export function drawTeamName(
  ctx: CanvasRenderingContext2D,
  name: string, x: number, y: number,
  maxW: number, isSantiso: boolean
) {
  fitFont(ctx, name, maxW, 28, 14, "800");
  if (isSantiso) {
    ctx.save();
    ctx.shadowColor = "rgba(250,204,21,0.65)";
    ctx.shadowBlur  = 18;
  }
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(name, x, y);
  if (isSantiso) ctx.restore();
}

// ─── Event icon ───────────────────────────────────────────────────────────────

/** Draw a small event icon (goal ball or card). */
export function drawEventIcon(
  ctx: CanvasRenderingContext2D,
  tipo: CronEvent["tipo"],
  cx: number, cy: number,
  size = 28
) {
  ctx.save();
  const r = size / 2;

  if (tipo === "gol" || tipo === "penalti" || tipo === "propia") {
    if (tipo === "penalti") {
      // Dibujar porteria de fondo para penalti (un poco más grande)
      ctx.font = `${size * 1.1}px 'Outfit', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.8;
      ctx.fillText("🥅", cx, cy - 2);
      ctx.globalAlpha = 1.0;
      // Balon encima (mucho más pequeño para que se vea la porteria)
      ctx.font = `${size * 0.45}px 'Outfit', sans-serif`;
      ctx.fillText("⚽", cx, cy + 5);
    } else if (tipo === "propia") {
      // Balon rojo para propia
      ctx.fillStyle = "#e53535"; // Rojo
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
      // Dibujar lineas de balon en blanco para que destaque sobre el rojo
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      const pr = r * 0.4;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const ang = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        ctx.lineTo(cx + pr * Math.cos(ang), cy + pr * Math.sin(ang));
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      // Gol normal
      ctx.font = `${size * 0.9}px 'Outfit', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("⚽", cx, cy);
    }
  } else if (tipo === "amarela") {
    ctx.fillStyle = "#FFD700";
    const cw = size * 0.72, ch = size * 0.92;
    rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 4);
    ctx.fill();
  } else if (tipo === "vermella") {
    ctx.fillStyle = "#e53535";
    const cw = size * 0.72, ch = size * 0.92;
    rr(ctx, cx - cw / 2, cy - ch / 2, cw, ch, 4);
    ctx.fill();
  } else if (tipo === "doble_amarela") {
    // Dos amarillas solapadas
    const cw = size * 0.6, ch = size * 0.8;
    ctx.fillStyle = "#FFD700";
    // Primera (atras)
    rr(ctx, cx - cw / 2 + 3, cy - ch / 2 - 3, cw, ch, 4);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.stroke();
    // Segunda (adelante)
    rr(ctx, cx - cw / 2 - 3, cy - ch / 2 + 3, cw, ch, 4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Category badge ───────────────────────────────────────────────────────────

/** Draw the category pill badge. Returns the badge bottom Y. */
export function drawCategoryBadge(
  ctx: CanvasRenderingContext2D,
  categoria: string,
  y: number
): number {
  const label = categoria === "Femenino"  ? "EQUIPO FEMININO"
              : categoria === "Veteranos" ? "EQUIPO VETERANO"
              : "EQUIPO SÉNIORS";
  ctx.font = "800 27px 'Outfit', sans-serif";
  const BW = ctx.measureText(label).width + 70;
  const BH = 55;
  const BX = CX - BW / 2;

  ctx.fillStyle   = "rgba(0,0,0,0.55)";
  rr(ctx, BX, y, BW, BH, 28);
  ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,0.35)";
  ctx.lineWidth   = 1.5;
  rr(ctx, BX, y, BW, BH, 28);
  ctx.stroke();
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, CX, y + BH / 2);
  return y + BH;
}
