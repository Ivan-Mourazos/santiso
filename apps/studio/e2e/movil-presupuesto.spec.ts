import { expect, test, type Page } from "@playwright/test";

/**
 * Presupuestos de pantalla en móvil: en un teléfono no puede hacer falta un scroll interminable.
 * Solo lectura. Las medidas no dependen de cuántos datos haya: se mira lo que ocupa cada fila y
 * que el primer dato quepa en la primera pantalla, no el alto total de la página.
 */

interface Presupuesto {
  seccion: string;
  /** Primera fila de datos de la pantalla. */
  fila: string;
  /** Alto máximo de una fila, en px. */
  altoFila: number;
  /** Pendiente de compactar: se quita al cerrar su pantalla en la Fase 3 del plan. */
  pendiente?: boolean;
}

const PRESUPUESTOS: Presupuesto[] = [
  { seccion: "clasificacion", fila: "main tbody tr", altoFila: 72 },
  { seccion: "estadisticas", fila: "main tbody tr", altoFila: 56 },
  { seccion: "jugadores", fila: "main tbody tr", altoFila: 64 },
  { seccion: "tecnicos", fila: "main tbody tr", altoFila: 64 },
  { seccion: "directiva", fila: "main tbody tr", altoFila: 64 },
  { seccion: "equipos", fila: "main tbody tr", altoFila: 64 },
];

const SECCIONES = [
  "jornada",
  "calendario",
  "clasificacion",
  "estadisticas",
  "jugadores",
  "tecnicos",
  "directiva",
  "multas",
  "alineacion",
  "carteles",
  "importar",
  "actas",
  "importar-jornada",
  "equipos",
  "patrocinadores",
  "temporadas",
  "ajustes-graficos",
];

async function abrir(page: Page, seccion: string) {
  await page.goto(`/admin/${seccion}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Preparando sección|Cargando sección)…$/)).toBeHidden();
  await page.waitForLoadState("networkidle");
}

for (const seccion of SECCIONES) {
  test(`${seccion}: cabecera de una fila y pestañas a un toque`, async ({ page }) => {
    await abrir(page, seccion);
    const cabecera = (await page.locator("header").first().boundingBox())!;
    expect(cabecera.height).toBeLessThanOrEqual(60);
    const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
    for (const nombre of ["Jornada", "Importar", "Carteles"]) {
      const caja = (await pestanas.getByRole("link", { name: nombre }).boundingBox())!;
      expect(caja.height).toBeGreaterThanOrEqual(44);
    }
    expect(
      (await pestanas.getByRole("button", { name: "Más" }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
  });
}

for (const { seccion, fila, altoFila, pendiente } of PRESUPUESTOS) {
  test(`${seccion}: el primer dato cabe en la primera pantalla y las filas son compactas`, async ({
    page,
  }) => {
    test.fixme(Boolean(pendiente), "Pendiente de compactar (Fase 3 del plan móvil).");
    await abrir(page, seccion);
    const filas = page.locator(fila);
    await expect(filas.first()).toBeVisible();
    const alto = page.viewportSize()!.height;
    const primera = (await filas.first().boundingBox())!;
    expect(primera.y + primera.height).toBeLessThanOrEqual(alto);
    const altos = await filas.evaluateAll((elementos) =>
      elementos.map((elemento) => elemento.getBoundingClientRect().height),
    );
    expect(Math.max(...altos)).toBeLessThanOrEqual(altoFila);
  });
}
