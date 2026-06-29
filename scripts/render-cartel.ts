/**
 * scripts/render-cartel.ts
 * Render headless de carteles para revisión visual (no entra en la app).
 * Uso: pnpm dlx tsx scripts/render-cartel.ts  → escribe PNGs en scripts/.out/
 */
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { W, H } from "../lib/cartel/constants";
import { drawBackground, drawTopLogos, drawSponsorBar } from "../lib/cartel/shared";
import { drawResumo, type ResumoForm } from "../lib/cartel/templates/resumo";

const here = dirname(fileURLToPath(import.meta.url));
const fontsDir = join(here, "fonts");
const outDir = join(here, ".out");
mkdirSync(outDir, { recursive: true });

for (const w of ["400", "600", "700", "800", "900"]) {
  GlobalFonts.registerFromPath(join(fontsDir, `Nunito-${w}.woff2`), "Nunito");
}

const cats: Array<{ cat: string; comp: string; rival: string }> = [
  { cat: "Senior", comp: "TERCEIRA GALICIA - SANTIAGO - FASE COPA - GRUPO 4", rival: 'Racing San Lorenzo "B"' },
  { cat: "Femenino", comp: "SEGUNDA DIVISIÓN GALEGA - GRUPO 2", rival: "U.D. Noia" },
  { cat: "Veteranos", comp: "DIVISIÓN DA HONRA - VETERANOS - SANTIAGO", rival: "Sporting Santiago" },
];

for (const { cat, comp, rival } of cats) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const form: ResumoForm = {
    categoria: cat,
    competicion: comp,
    jornada: "10",
    rivalNombre: rival,
    rivalEscudoUrl: "",
    fecha: "2026-05-10",
    hora: "18:00",
    lugar: "Santa Isabel",
    santisoSide: "right",
    golesLocal: "3",
    golesRival: "1",
    showCarouselIndicator: true,
  };

  drawBackground(ctx, cat);
  drawResumo(ctx, form, null, null);
  drawTopLogos(ctx, null, null, true);
  drawSponsorBar(ctx, []);

  const out = join(outDir, `resumo-${cat.toLowerCase()}.png`);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("escrito:", out);
}
