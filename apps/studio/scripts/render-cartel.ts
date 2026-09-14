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
import { drawPartido, type PartidoForm } from "../lib/cartel/templates/partido";
import { drawProximos, type ProximosForm } from "../lib/cartel/templates/proximos";
import type { CartelAssets, NextMatch } from "../lib/cartel/types";

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

// ── Partido (previa) — Senior ───────────────────────────────────────────────
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const form: PartidoForm = {
    categoria: "Senior",
    competicion: "TERCEIRA GALICIA - SANTIAGO - FASE COPA - GRUPO 4",
    jornada: "12",
    rivalNombre: "Sporting Santiago",
    rivalEscudoUrl: "",
    fecha: "2026-05-17",
    hora: "17:00",
    lugar: "Campo Municipal de Santiso",
    santisoSide: "right",
  };
  drawBackground(ctx, form.categoria);
  drawPartido(ctx, form, null, null);
  drawTopLogos(ctx, null, null, true);
  drawSponsorBar(ctx, []);
  const out = join(outDir, `partido-senior.png`);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("escrito:", out);
}

// ── Próximos Encontros ──────────────────────────────────────────────────────
{
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  const assets: CartelAssets = { xunta: null, rfgf: null, santiso: null, sponsors: [] };
  const matches: NextMatch[] = [
    { rival: "Sporting Santiago", rivalEscudoUrl: "", fecha: "2026-05-16", categoria: "Senior", hora: "17:00", santisoSide: "right" },
    { rival: "U.D. Noia", rivalEscudoUrl: "", fecha: "2026-05-17", categoria: "Femenino", hora: "12:00", santisoSide: "left" },
    { rival: "C.F. Camporrapado", rivalEscudoUrl: "", fecha: "2026-05-17", categoria: "Veteranos", hora: "18:00", santisoSide: "right" },
  ];
  const form: ProximosForm = { categoriasText: "FEMININO – SÉNIOR – VETERANOS", matches, categoria: "Senior" };
  drawBackground(ctx, "Senior");
  drawProximos(ctx, form, assets, true, [null, null, null]);
  drawTopLogos(ctx, null, null, true);
  const out = join(outDir, `proximos.png`);
  writeFileSync(out, canvas.toBuffer("image/png"));
  console.log("escrito:", out);
}
