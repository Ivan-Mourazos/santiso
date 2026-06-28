/**
 * lib/cartel/templates/clasificacion.ts
 * Template: Clasificación Nativa
 */

import { W, H, CX, CW, BAR_W, GOLD, CL, CR } from "../constants";
import { rr, fitFont } from "../primitives";
import type { CartelAssets } from "../types";
import { drawWatermark, drawTopLogos, drawSponsorBar, drawCategoryTint } from "../shared";

export interface ClasificacionForm {
  categoria: string;
  clasificacionTipo: "liga" | "copa";
  clasificacionNombre: string;
  clasificacionData: any; // El array de equipos ordenado
  showAssets?: boolean;
}

export async function drawClasificacion(
  ctx: CanvasRenderingContext2D,
  f: ClasificacionForm,
  assets: CartelAssets,
  xuntaIsLeft: boolean,
  loadImg: (url: string) => Promise<HTMLImageElement | null>
) {
  const { categoria, clasificacionTipo, clasificacionData } = f;

  // 1. Fondo base y marcas de agua
  drawWatermark(ctx, assets.santiso);
  drawCategoryTint(ctx, categoria);

  const { showAssets = true } = f;

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // Título principal (CLASIFICACIÓN / COPA)
  const titleY = showAssets ? 275 : 220;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = GOLD;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const titulo = clasificacionTipo === "liga" ? "CLASIFICACIÓN OFICIAL" : "CUADRANTE DE COPA";
  fitFont(ctx, titulo, CW * 0.85, 56, 36, "900");
  ctx.fillText(titulo, CX, titleY);

  // Nombre de la competición (arriba de la línea o centrado arriba)
  if (f.clasificacionNombre) {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#fff";
    if (showAssets) {
      // Estilo similar a 'competición' en otros carteles: encima de la línea dorada
      ctx.font = "800 18px 'Nunito', sans-serif";
      fitFont(ctx, f.clasificacionNombre.toUpperCase(), W - 140, 18, 14, "800");
      ctx.fillText(f.clasificacionNombre.toUpperCase(), W / 2, 165);
    } else {
      ctx.font = "600 30px 'Nunito', sans-serif";
      ctx.fillText(f.clasificacionNombre.toUpperCase(), CX, titleY - 60);
    }
  }
  ctx.restore();

  // Si no hay datos
  if (!clasificacionData || clasificacionData.length === 0) {
    ctx.save();
    ctx.font = "600 30px 'Nunito', sans-serif";
    ctx.fillStyle = "#888";
    ctx.textAlign = "center";
    ctx.fillText("Sin datos de competición", CX, H / 2);
    ctx.restore();
    return;
  }

  // LIGA: DIBUJAR TABLA
  if (clasificacionTipo === "liga") {
    const tableTop = showAssets ? 375 : 335;
    const tableBottom = showAssets ? 1130 : 1210;
    const teamCount = clasificacionData.length;
    const availableH = tableBottom - tableTop;
    const rowH = Math.max(34, Math.min(64, Math.floor(availableH / Math.max(teamCount, 1))));
    const headerSize = Math.max(12, Math.min(18, Math.floor(rowH * 0.3)));
    const posSize = Math.max(16, Math.min(24, Math.floor(rowH * 0.38)));
    const nameSize = Math.max(15, Math.min(24, Math.floor(rowH * 0.38)));
    const statSize = Math.max(14, Math.min(22, Math.floor(rowH * 0.34)));
    const ptsSize = Math.max(17, Math.min(26, Math.floor(rowH * 0.42)));
    const shieldSize = Math.max(24, Math.min(36, Math.floor(rowH * 0.58)));
    
    // Cargar escudos de forma síncrona aquí si es necesario, o asíncrona pero bloqueando (el GeneradorCartel ya lo envuelve en un efecto asíncrono)
    // Para simplificar, pintamos la tabla. Los escudos requieren await loadImg().
    // Lo haremos iterando:
    const teamsToDraw = clasificacionData;

    const cols = {
      pos: CL + 20,
      escudo: CL + 78,
      nombre: CL + 128,
      pj: CR - 360,
      pg: CR - 290,
      pe: CR - 220,
      pp: CR - 150,
      gf: CR - 80, // o DG
      pts: CR - 20
    };

    // Header
    ctx.save();
    ctx.font = `800 ${headerSize}px 'Nunito', sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const headerY = tableTop - Math.max(16, Math.floor(rowH * 0.42));
    ctx.fillText("POS", cols.pos, headerY);
    ctx.textAlign = "left";
    ctx.fillText("EQUIPO", cols.nombre, headerY);
    ctx.textAlign = "center";
    ctx.fillText("PJ", cols.pj, headerY);
    ctx.fillText("PG", cols.pg, headerY);
    ctx.fillText("PE", cols.pe, headerY);
    ctx.fillText("PP", cols.pp, headerY);
    ctx.fillText("GF", cols.gf, headerY);
    ctx.fillStyle = GOLD;
    ctx.fillText("PTS", cols.pts, headerY);
    ctx.restore();

    for (let i = 0; i < teamsToDraw.length; i++) {
      const t = teamsToDraw[i];
      const rowY = tableTop + i * rowH;
      const isSantiso = t.nombre.toLowerCase().includes("santiso");

      ctx.save();
      // Fondo fila alterno
      ctx.fillStyle = isSantiso ? "rgba(250, 204, 21, 0.15)" : (i % 2 === 0 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.0)");
      rr(ctx, CL, rowY, CW, rowH, Math.min(8, rowH / 4));
      ctx.fill();

      // Borde si es santiso
      if (isSantiso) {
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const cy = rowY + rowH / 2;

      // POS
      ctx.font = `800 ${posSize}px 'Nunito', sans-serif`;
      ctx.fillStyle = isSantiso ? GOLD : "#fff";
      ctx.fillText((i + 1).toString(), cols.pos, cy);

      // ESCUDO
      if (t.escudo_url) {
        const img = await loadImg(t.escudo_url);
        if (img) {
          const sW = shieldSize;
          const sH = shieldSize;
          ctx.drawImage(img, cols.escudo - sW / 2, cy - sH / 2, sW, sH);
        }
      }

      // NOMBRE
      ctx.textAlign = "left";
      fitFont(ctx, t.nombre, cols.pj - cols.nombre - 28, nameSize, 12, isSantiso ? "800" : "600");
      ctx.fillText(t.nombre, cols.nombre, cy);

      // STATS
      ctx.textAlign = "center";
      ctx.font = `500 ${statSize}px 'Nunito', sans-serif`;
      ctx.fillStyle = "#ccc";
      ctx.fillText(t.pj.toString(), cols.pj, cy);
      ctx.fillStyle = "rgba(74, 222, 128, 0.8)";
      ctx.fillText(t.pg.toString(), cols.pg, cy);
      ctx.fillStyle = "rgba(156, 163, 175, 0.8)";
      ctx.fillText(t.pe.toString(), cols.pe, cy);
      ctx.fillStyle = "rgba(248, 113, 113, 0.8)";
      ctx.fillText(t.pp.toString(), cols.pp, cy);
      ctx.fillStyle = "#ccc";
      ctx.fillText(t.gf.toString(), cols.gf, cy);

      // PTS
      ctx.font = `900 ${ptsSize}px 'Nunito', sans-serif`;
      ctx.fillStyle = isSantiso ? GOLD : "#fff";
      ctx.fillText(t.pts.toString(), cols.pts, cy);

      ctx.restore();
    }
  } else {
    // COPA: DIBUJAR BRACKET
    const rounds = clasificacionData; // Asumimos que es el array de rondas
    if (!rounds || rounds.length === 0) return;

    const numRounds = rounds.length;
    const startY = showAssets ? 400 : 320;
    const endY = 1150;
    const workH = endY - startY;
    const workW = CW * 0.9;
    const startX = CX - workW / 2;

    const colWidth = workW / numRounds;
    const boxW = Math.min(220, colWidth * 0.85);
    const boxH = 64;

    // Calculamos las coordenadas (x, y) de cada partido para dibujar las líneas
    // Estructura para guardar el punto de salida (derecha) de cada caja
    const outPoints: { [roundIdx: number]: { [matchIdx: number]: { x: number, y: number } } } = {};

    ctx.save();
    for (let r = 0; r < numRounds; r++) {
      const round = rounds[r];
      const matches = round.partidos || [];
      const numMatches = matches.length || 1; // para que no divida por 0
      
      const xCenter = startX + r * colWidth + colWidth / 2;
      
      outPoints[r] = {};

      // Etiqueta de la ronda
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "800 20px 'Nunito', sans-serif";
      ctx.fillStyle = GOLD;
      ctx.fillText(round.nombre.toUpperCase(), xCenter, startY - 20);

      // Distribuir partidos en la columna
      // Para un bracket ideal, la Y del partido debe estar exactamente entre sus dos "hijos" de la ronda anterior
      // Pero por simplicidad, hacemos distribución uniforme
      for (let m = 0; m < numMatches; m++) {
        // En una distribución clásica de bracket, la distancia se dobla cada ronda, 
        // pero para no liarla con IDs raros, distribución equitativa es safe si está bien estructurado.
        // Mejor: calcular la posición ideal si conocemos los cruces. 
        // Vamos a usar distribución geométrica estándar: 
        // La ronda 'r' tiene `2^(numRounds - 1 - r)` partidos (idealmente).
        // Así que usamos `matches.length` para la separación.
        
        const spacingY = workH / numMatches;
        const cy = startY + spacingY * m + spacingY / 2;
        const cx = xCenter;

        const bx = cx - boxW / 2;
        const by = cy - boxH / 2;

        outPoints[r][m] = { x: bx + boxW, y: cy };

        // Dibujar Conectores DESDE la ronda anterior HACIA esta
        if (r > 0) {
          // Cada partido de esta ronda recibe 2 de la anterior
          const m1 = m * 2;
          const m2 = m * 2 + 1;
          const prevPoints = outPoints[r - 1];

          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 2;

          if (prevPoints[m1]) {
            ctx.beginPath();
            ctx.moveTo(prevPoints[m1].x, prevPoints[m1].y);
            ctx.lineTo(prevPoints[m1].x + (colWidth - boxW) / 2, prevPoints[m1].y);
            ctx.lineTo(prevPoints[m1].x + (colWidth - boxW) / 2, cy);
            ctx.lineTo(bx, cy);
            ctx.stroke();
          }
          if (prevPoints[m2]) {
            ctx.beginPath();
            ctx.moveTo(prevPoints[m2].x, prevPoints[m2].y);
            ctx.lineTo(prevPoints[m2].x + (colWidth - boxW) / 2, prevPoints[m2].y);
            ctx.lineTo(prevPoints[m2].x + (colWidth - boxW) / 2, cy);
            ctx.lineTo(bx, cy);
            ctx.stroke();
          }
        }

        // Dibujar caja del partido
        const p = matches[m];
        if (!p) continue; // Por si hay "byes"

        // Fondo caja
        const isSantiso = (p.equipo_local?.nombre || "").toLowerCase().includes("santiso") || 
                          (p.equipo_visitante?.nombre || "").toLowerCase().includes("santiso");
        
        ctx.fillStyle = isSantiso ? "rgba(250, 204, 21, 0.15)" : "rgba(255,255,255,0.05)";
        rr(ctx, bx, by, boxW, boxH, 8);
        ctx.fill();
        if (isSantiso) {
          ctx.strokeStyle = GOLD;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Línea separadora
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx, cy);
        ctx.lineTo(bx + boxW, cy);
        ctx.stroke();

        // Nombres equipos
        ctx.font = "600 13px 'Nunito', sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Equipo 1
        ctx.fillStyle = "#fff";
        let localName = p.equipo_local?.nombre || "TBD";
        if (localName.length > 18) localName = localName.substring(0, 16) + "...";
        ctx.fillText(localName, bx + 10, by + boxH / 4);

        // Equipo 2
        let visName = p.equipo_visitante?.nombre || "TBD";
        if (visName.length > 18) visName = visName.substring(0, 16) + "...";
        ctx.fillText(visName, bx + 10, by + boxH * 0.75);

        // Resultados
        if (p.estado === "finalizado") {
          ctx.textAlign = "right";
          ctx.font = "800 14px 'Nunito', sans-serif";
          
          const gl = p.goles_local ?? 0;
          const gv = p.goles_visitante ?? 0;
          
          ctx.fillStyle = gl > gv ? GOLD : (gl === gv ? "#aaa" : "#fff");
          ctx.fillText(gl.toString(), bx + boxW - 10, by + boxH / 4);

          ctx.fillStyle = gv > gl ? GOLD : (gl === gv ? "#aaa" : "#fff");
          ctx.fillText(gv.toString(), bx + boxW - 10, by + boxH * 0.75);
        }
      }
    }
    ctx.restore();
  }
}
