import { expect, test, type Locator, type Page } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Importar jornada contra la base de datos real. **Solo lectura y sin IA**: la ruta de Gemini
 * se simula siempre, y tras la carga inicial se cortan las Server Actions, así que ni un
 * «Guardar» pulsado por error llegaría a escribir.
 */

// PNG válido de 1x1: la pantalla solo lo manda a la ruta simulada.
const CAPTURA = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=",
  "base64",
);

async function etiquetasAsociadas(contenedor: Locator) {
  const sinEtiqueta = await contenedor.locator("input, select, textarea").evaluateAll((campos) =>
    campos
      .filter((campo) => {
        const control = campo as HTMLInputElement;
        return control.type !== "hidden" && !control.labels?.length;
      })
      .map((campo) => campo.outerHTML.slice(0, 160)),
  );
  expect(sinEtiqueta).toEqual([]);
}

async function abrirFoto(page: Page) {
  await page.goto("/admin/importar-jornada?origen=foto");
  await expect(page.getByRole("heading", { name: "Importar jornada desde imagen" })).toBeVisible({
    timeout: 30000,
  });
  // Destino visible desde el principio, con la competición ya elegida y sus jornadas cargadas.
  await expect(page.getByLabel("Competición", { exact: true })).not.toHaveValue("", {
    timeout: 30000,
  });
  await expect(
    page.getByLabel("Jornada de destino", { exact: true }).locator("option"),
  ).not.toHaveCount(1, { timeout: 30000 });
}

for (const ancho of [360, 1280]) {
  test(`foto de jornada: revisar lo detectado sin guardar a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const errores: string[] = [];
    const externas = vigilarSalidasAInternet(page);
    page.on("pageerror", (error) => errores.push(error.message));
    await abrirFoto(page);

    const competicion = await page
      .getByLabel("Competición", { exact: true })
      .locator("option:checked")
      .textContent();
    let acciones = 0;
    await page.route("**/admin/importar-jornada**", (route) => {
      if (route.request().method() === "POST") {
        acciones++;
        return route.abort();
      }
      return route.continue();
    });
    await page.route("**/api/admin/jornada-gemini", (route) =>
      route.fulfill({
        json: {
          model: "simulado",
          data: {
            competicion: competicion ?? "",
            jornada: "1",
            partidos: [
              {
                localNombre: "S.D. Bandeira",
                visitanteNombre: "C.D. Berres",
                golesLocal: "",
                golesVisitante: "",
                confidence: "alta",
              },
              {
                localNombre: "U.D. Santiso F.C.",
                visitanteNombre: "",
                golesLocal: "",
                golesVisitante: "",
                descansa: true,
                confidence: "media",
              },
            ],
            warnings: ["Captura simulada: no guardar"],
          },
        },
      }),
    );

    await page
      .getByLabel("Captura de la jornada")
      .setInputFiles({ name: "jornada.png", mimeType: "image/png", buffer: CAPTURA });
    await page.getByRole("button", { name: "Analizar con Gemini" }).click();

    const fila = page.getByRole("region", { name: "Fila 1: S.D. Bandeira - C.D. Berres" });
    await expect(fila).toBeVisible({ timeout: 15000 });
    // Los equipos detectados quedan enlazados con los del catálogo.
    await expect(fila.getByLabel("Local de la fila 1")).not.toHaveValue("");
    await expect(fila.getByLabel("Visitante de la fila 1")).not.toHaveValue("");
    await expect(page.getByText("Captura simulada: no guardar")).toBeVisible();
    // El que descansa no se puede guardar como partido.
    const descansa = page.getByRole("region", { name: /Fila 2: U\.D\. Santiso F\.C\./ });
    await expect(descansa.getByText("Descansa")).toBeVisible();
    await expect(descansa.getByRole("checkbox")).toHaveCount(0);

    await etiquetasAsociadas(page.getByRole("main"));
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(ancho);
    expect(acciones).toBe(0);
    expect(errores).toEqual([]);
    expect(externas).toEqual([]);
  });
}

test("calendario PDF: los campos tienen su etiqueta", async ({ page }) => {
  await page.goto("/admin/importar-jornada?origen=calendario");
  await expect(page.locator("#cal-competicion")).toBeVisible({ timeout: 30000 });
  await etiquetasAsociadas(page.getByRole("main"));
});
