import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

const SECCIONES_CON_IMAGEN = ["Equipos", "Plantilla", "Sponsors"];

for (const seccion of SECCIONES_CON_IMAGEN) {
  test(`${seccion} carga sin errores y sirve sus imágenes desde /media`, async ({ page }) => {
    const errores: string[] = [];
    const rotas: string[] = [];
    page.on("pageerror", (error) => errores.push(error.message));
    page.on("response", (respuesta) => {
      const url = respuesta.url();
      if (url.includes("/media/") && !respuesta.ok()) rotas.push(`${respuesta.status()} ${url}`);
    });

    await page.goto("/admin");
    await page.getByText(seccion, { exact: true }).first().click();
    await page.waitForTimeout(1500);

    expect(errores).toEqual([]);
    expect(rotas).toEqual([]);
  });
}

test("las secciones migradas no salen a internet", async ({ page }) => {
  const externas = vigilarSalidasAInternet(page);

  await page.goto("/admin");
  for (const seccion of SECCIONES_CON_IMAGEN) {
    await page.getByText(seccion, { exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  expect(externas).toEqual([]);
});
