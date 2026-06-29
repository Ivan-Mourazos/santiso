/**
 * lib/cartel/templates/partido.ts
 * Template 1: Cartel de Partido (previa) — dirección APPLE / REDONDEADO
 * Consistente con Resumo: kicker, pill de categoría, tile del enfrentamiento y cápsula.
 */

import { CX, CL, CW, catAccent } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, hexToRgba } from "../primitives";
import { getSantisoName, drawWatermark } from "../shared";

export interface PartidoForm {
  categoria:    string;
  competicion:  string;
  jornada:      string;
  rivalNombre:  string;
  rivalEscudoUrl: string;
  fecha:        string;
  hora:         string;
  lugar:        string;
  santisoSide:  "left" | "right";
}

export function drawPartido(
  ctx: CanvasRenderingContext2D,
  f: PartidoForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, competicion, jornada, rivalNombre, fecha, hora, lugar, santisoSide } = f;
  const santisoName = getSantisoName(categoria);
  const accent = catAccent(categoria);

  drawWatermark(ctx, imgSantiso);

  const pill = (text: string, cy: number, font: string, padX: number, h: number, fill: string, fg: string, stroke?: string) => {
    ctx.font = font;
    const w = ctx.measureText(text).width + padX * 2;
    const x = CX - w / 2, y = cy - h / 2;
    ctx.fillStyle = fill;
    rr(ctx, x, y, w, h, h / 2); ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, h / 2); ctx.stroke(); }
    ctx.fillStyle = fg;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, CX, cy + 1);
  };

  // ── Kicker ──────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = "900 36px 'Nunito', sans-serif";
  ctx.fillText("PRÓXIMO PARTIDO", CX, 228);

  ctx.fillStyle = "#8b9097";
  ctx.font = "700 21px 'Nunito', sans-serif";
  fitFont(ctx, competicion.toUpperCase(), CW - 60, 21, 13, "700");
  ctx.fillText(competicion.toUpperCase(), CX, 262);

  const catLabel = categoria === "Femenino" ? "FEMININO" : categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
  pill(`${catLabel}   ·   XORNADA ${jornada}`, 312, "800 19px 'Nunito', sans-serif", 26, 44,
       hexToRgba(accent, 0.14), accent, hexToRgba(accent, 0.45));

  // ── Tile del enfrentamiento ─────────────────────────────────────────────────
  const tileY = 372, tileH = 372;
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  rr(ctx, CL, tileY, CW, tileH, 46); ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.5;
  rr(ctx, CL, tileY, CW, tileH, 46); ctx.stroke();

  const SY = tileY + 150, SS = 188, OFF = 300;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);
  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // VS en cápsula de acento
  pill("VS", SY, "900 46px 'Nunito', sans-serif", 26, 78, accent, "#000000");

  const NY = SY + SS / 2 + 56;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 8;
  drawTeamName(ctx, leftName,  lCX, NY, 320, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 320, santisoSide === "right");
  ctx.restore();

  // ── Cápsula fecha · hora ────────────────────────────────────────────────────
  const dateLine = `${fmtDate(fecha, true)}${hora ? `   ·   ${hora}H` : ""}`;
  pill(dateLine, 818, "900 30px 'Nunito', sans-serif", 50, 96, accent, "#000000");

  // ── Sede ────────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 24px 'Nunito', sans-serif";
  const venue = lugar ? `📍 ${lugar.toUpperCase()}` : "📍 CAMPO A DEFINIR";
  fitFont(ctx, venue, CW - 80, 24, 15, "800");
  ctx.fillText(venue, CX, 948);
}
