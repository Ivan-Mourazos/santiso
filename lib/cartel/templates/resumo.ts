/**
 * lib/cartel/templates/resumo.ts
 * Template 2: Resumo da Xornada
 */

import { CX, CW, GOLD, GREEN_TXT } from "../constants";
import { fitFont, fmtDate, drawShield, shieldPlaceholder, drawTeamName, drawCategoryBadge } from "../primitives";
import { drawCategoryTint, getSantisoName } from "../shared";
import type { PartidoForm } from "./partido";

export interface ResumoForm extends PartidoForm {
  golesLocal: string;
  golesRival: string;
}

export function drawResumo(
  ctx: CanvasRenderingContext2D,
  f: ResumoForm,
  imgRival:   HTMLImageElement | null,
  imgSantiso: HTMLImageElement | null
) {
  const { categoria, competicion, jornada, rivalNombre, fecha, santisoSide, golesLocal, golesRival } = f;
  const santisoName = getSantisoName(categoria);

  // Category tint
  drawCategoryTint(ctx, categoria);

  // Competition subtitle
  ctx.fillStyle    = "#aaaaaa";
  ctx.font         = "700 25px 'Outfit', sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(competicion.toUpperCase(), CX, 169);

  drawCategoryBadge(ctx, categoria, 195);

  // "RESUMO DA XORNADA"
  ctx.fillStyle    = GOLD;
  ctx.textAlign    = "center";
  ctx.textBaseline = "alphabetic";
  fitFont(ctx, "RESUMO DA", CW * 0.84, 96, 50, "900");
  ctx.fillText("RESUMO DA", CX, 394);
  fitFont(ctx, "XORNADA", CW * 0.88, 102, 50, "900");
  ctx.fillText("XORNADA", CX, 492);

  ctx.fillStyle = "#cccccc";
  ctx.font      = "700 26px 'Outfit', sans-serif";
  ctx.fillText(fmtDate(fecha, true), CX, 534);
  ctx.fillStyle = GOLD;
  ctx.font      = "800 28px 'Outfit', sans-serif";
  ctx.fillText(`XORNADA ${jornada}`, CX, 568);

  // Shields
  const SY = 700, SS = 198, OFF = 238;
  const lCX = CX - OFF, rCX = CX + OFF;
  const leftImg  = santisoSide === "left" ? imgSantiso : imgRival;
  const rightImg = santisoSide === "left" ? imgRival   : imgSantiso;
  const leftName = santisoSide === "left" ? santisoName : (rivalNombre || "Rival");
  const rightName= santisoSide === "left" ? (rivalNombre || "Rival") : santisoName;

  if (leftImg)  drawShield(ctx, leftImg,  lCX, SY, SS, santisoSide === "left");
  else          shieldPlaceholder(ctx, lCX, SY, SS / 2);

  // Score — white text centred between shields
  const score = `${golesLocal || "0"} — ${golesRival || "0"}`;
  ctx.fillStyle    = "#ffffff";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, score, 200, 72, 40, "900");
  ctx.fillText(score, CX, SY);

  if (rightImg) drawShield(ctx, rightImg, rCX, SY, SS, santisoSide === "right");
  else          shieldPlaceholder(ctx, rCX, SY, SS / 2);

  // Team names
  const NY = SY + SS / 2 + 50;
  drawTeamName(ctx, leftName,  lCX, NY, 290, santisoSide === "left");
  drawTeamName(ctx, rightName, rCX, NY, 290, santisoSide === "right");

  // Thanks line
  ctx.fillStyle = GREEN_TXT;
  ctx.font      = "800 38px 'Outfit', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("GRAZAS POLO VOSO APOIO", CX, 1226);
}
