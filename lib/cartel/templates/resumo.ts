/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada — dirección BROADCAST BOLD
 * Marcador como héroe, banda de color full-bleed con el resultado y título kicker.
 */

import { W, CX, CL, CR, CW, catAccent } from "../constants";
import { rr, fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, hexToRgba } from "../primitives";
import { getSantisoName, drawWatermark } from "../shared";
import type { PartidoForm } from "./partido";

export interface ResumoForm extends PartidoForm {
  golesLocal: string;
  golesRival: string;
  showCarouselIndicator?: boolean;
}

export function drawResumo(
  ctx: CanvasRenderingContext2D,
  f: ResumoForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, competicion, jornada, rivalNombre, fecha, hora, lugar, santisoSide, golesLocal, golesRival, showCarouselIndicator } = f;
  const santisoName = getSantisoName(categoria);
  const accent = catAccent(categoria);

  // Resultado desde el punto de vista de Santiso
  const isLocalSantiso = santisoSide === "left";
  const sScore = parseInt((isLocalSantiso ? golesLocal : golesRival) || "0");
  const rScore = parseInt((isLocalSantiso ? golesRival : golesLocal) || "0");
  const resultado = sScore > rScore ? "VITORIA" : sScore < rScore ? "DERROTA" : "EMPATE";

  drawWatermark(ctx, imgSantiso);

  // ── Número de jornada GIGANTE fantasma (textura, recortado a la zona alta) ───
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 150, W, 280);
  ctx.clip();
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.font = "900 420px 'Outfit', sans-serif";
  ctx.fillStyle = hexToRgba(accent, 0.07);
  ctx.fillText(jornada || "", CR + 50, 470);
  ctx.restore();

  // ── Kicker: título + jornada ────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = "900 38px 'Outfit', sans-serif";
  ctx.fillText("RESUMO DA XORNADA", CX, 232);

  ctx.fillStyle = "#8b9097";
  ctx.font = "700 22px 'Outfit', sans-serif";
  fitFont(ctx, competicion.toUpperCase(), CW - 60, 22, 14, "700");
  ctx.fillText(competicion.toUpperCase(), CX, 270);

  // Categoría · Xornada (mini meta)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 20px 'Outfit', sans-serif";
  const catLabel = categoria === "Femenino" ? "FEMININO" : categoria === "Veteranos" ? "VETERANOS" : "SÉNIOR";
  ctx.fillText(`${catLabel}   ·   XORNADA ${jornada}`, CX, 308);

  // ── Marcador HÉROE ──────────────────────────────────────────────────────────
  const SY = 500, SS = 200, OFF = 360;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);
  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 18;
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = "900 220px 'Outfit', sans-serif";
  ctx.fillStyle    = "#ffffff";
  ctx.fillText(golesLocal || "0", CX - 118, SY);
  ctx.fillText(golesRival || "0", CX + 118, SY);
  ctx.fillStyle    = accent;
  ctx.font         = "900 110px 'Outfit', sans-serif";
  ctx.fillText("–", CX, SY - 14);
  ctx.restore();

  // Nombres
  const NY = SY + SS / 2 + 58;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur  = 10;
  drawTeamName(ctx, leftName,  lCX, NY, 330, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 330, santisoSide === "right");
  ctx.restore();

  // ── Banda de resultado FULL-BLEED ───────────────────────────────────────────
  const bandY = 770, bandH = 122;
  ctx.fillStyle = accent;
  ctx.fillRect(0, bandY, W, bandH);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 80px 'Outfit', sans-serif";
  ctx.fillText(resultado, CX, bandY + bandH / 2 + 2);

  // ── Fecha / sede ────────────────────────────────────────────────────────────
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "800 26px 'Outfit', sans-serif";
  ctx.fillText(fmtDate(fecha, true), CX, 970);

  const venue = lugar ? lugar.toUpperCase() : "CAMPO A DEFINIR";
  ctx.fillStyle = hexToRgba(accent, 0.95);
  ctx.font = "800 22px 'Outfit', sans-serif";
  const venueLine = hora ? `${venue}  ·  ${hora}H` : venue;
  fitFont(ctx, venueLine, CW - 40, 22, 14, "800");
  ctx.fillText(venueLine, CX, 1006);

  // ── Carrusel ────────────────────────────────────────────────────────────────
  if (showCarouselIndicator) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "700 20px 'Outfit', sans-serif";
    ctx.fillText("DESPRAZA PARA O 11 E A CRONOLOXÍA", CX, 1066);
  }
}
