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
    for (const nombre of ["Jornada", "Carteles", "Multas"]) {
      const caja = (await pestanas.getByRole("link", { name: nombre }).boundingBox())!;
      expect(Math.round(caja.height)).toBeGreaterThanOrEqual(44);
    }
    expect(
      Math.round((await pestanas.getByRole("button", { name: "Más" }).boundingBox())!.height),
    ).toBeGreaterThanOrEqual(44);
  });
}

const PLANTILLAS_CARTEL = [
  "partido",
  "resumo",
  "cronoloxia",
  "proximos",
  "noso11",
  "multiusos",
  "clasificacion",
];
for (const ancho of [360, 390]) {
  for (const plantilla of PLANTILLAS_CARTEL) {
    test(`carteles ${plantilla}: presupuesto de formulario y vista a un toque a ${ancho}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 664 });
      await abrir(page, `carteles?plantilla=${plantilla}`);
      const datos = page.getByRole("tabpanel", { name: "Datos", exact: true });
      const primero = datos
        .locator("input:visible, select:visible, summary:visible, button:visible")
        .first();
      const caja = (await primero.boundingBox())!;
      expect(caja.y + caja.height).toBeLessThanOrEqual(600);
      // Presupuesto por bloque de edición: depende de campos, no de filas de una temporada.
      expect((await datos.boundingBox())!.height).toBeLessThanOrEqual(1100);
      if (plantilla === "proximos") {
        for (const nombre of [
          "Preparar carrusel Axenda",
          "Rellenar con los partidos de esta jornada",
        ]) {
          const accion = (await page
            .getByRole("button", { name: nombre, exact: true })
            .boundingBox())!;
          expect(accion.y + accion.height).toBeLessThanOrEqual(600);
        }
        const filas = datos.locator("[data-partido-plegado] > summary");
        await expect(filas.first()).toBeVisible();
        const altos = await filas.evaluateAll((ns) =>
          ns.map((n) => n.getBoundingClientRect().height),
        );
        expect(Math.max(...altos)).toBeLessThanOrEqual(64);
        await filas.first().tap();
        expect((await datos.boundingBox())!.height).toBeLessThanOrEqual(1100);
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const vista = page.getByRole("tab", { name: "Vista previa", exact: true });
      const tab = (await vista.boundingBox())!;
      expect(tab.y).toBeGreaterThanOrEqual(0);
      expect(tab.y + tab.height).toBeLessThanOrEqual(600);
      await vista.tap();
      await expect(page.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        ancho,
      );
    });
  }
  test(`calendario propio: primera fila compacta y anteriores plegados a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 664 });
    await abrir(page, "calendario?vista=santiso");
    const lista = page.getByRole("region", { name: "Partidos del Santiso", exact: true });
    const filas = lista.locator("[data-contexto=true][data-cambios]");
    await expect(filas.first()).toBeVisible();
    const caja = (await filas.first().boundingBox())!;
    expect(caja.y + caja.height).toBeLessThanOrEqual(600);
    expect(
      Math.max(
        ...(await filas.evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height))),
      ),
    ).toBeLessThanOrEqual(72);
    const detalle = filas.first().getByRole("button");
    await detalle.tap();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();
    await expect(hoja.getByLabel("Fecha y hora", { exact: true })).toBeVisible();
    await expect(hoja.getByLabel("Campo", { exact: true })).toBeVisible();
    await expect(hoja.getByLabel("Estado", { exact: true })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
    await hoja.getByRole("button", { name: "Cerrar diálogo", exact: true }).tap();
    await expect(hoja).toBeHidden();
    await expect(detalle).toBeFocused();
    const anteriores = lista.getByRole("button", { name: /^Ver anteriores/ });
    if (await anteriores.count()) {
      const antes = await filas.count();
      await expect(anteriores).toHaveAttribute("aria-expanded", "false");
      await anteriores.tap();
      expect(await filas.count()).toBeGreaterThan(antes);
      await lista.getByRole("button", { name: "Ocultar anteriores", exact: true }).tap();
      await expect(filas).toHaveCount(antes);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
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
