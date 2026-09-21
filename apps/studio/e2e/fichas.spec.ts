import path from "node:path";
import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

// Playwright transpila estos ficheros a CommonJS: aquí no hay `import.meta`.
const FICHA = path.resolve(__dirname, "../../../packages/actas/src/fixtures/senior-1.pdf");

test("la ficha PDF rellena el acta sin salir del ordenador", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  const aLaNube: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  // Las rutas /api/admin/acta-* son las de Gemini: leer un PDF no debe llamarlas.
  page.on("request", (peticion) => {
    if (peticion.url().includes("/api/admin/acta-")) aLaNube.push(peticion.url());
  });

  await page.goto("/admin");
  await page.getByText("Actas", { exact: true }).first().click();

  // Hace falta un partido elegido: el lector necesita saber de qué lado juega el Santiso.
  const partidos = page
    .locator("select")
    .filter({ has: page.locator("option", { hasText: " vs " }) })
    .first();
  await expect(partidos).toBeVisible({ timeout: 20000 });
  await partidos.selectOption({ index: 0 });

  await page.locator("#acta-file-input").setInputFiles(FICHA);
  const leer = page.getByRole("button", { name: "Leer ficha PDF (sin IA)" });
  await expect(leer).toBeEnabled({ timeout: 10000 });
  await leer.click();

  // El bloque de revisión solo aparece cuando el acta trae datos.
  await expect(page.getByText("Datos del partido")).toBeVisible({ timeout: 20000 });
  const golesLocal = page.locator("label", { hasText: "Goles local" }).locator("input");
  await expect(golesLocal).toHaveValue(/^\d+$/);

  // Y el texto en crudo es la ficha leída, no una plantilla vacía ni la respuesta de la IA:
  // el contrato de `@santiso/actas` es la versión 2.
  const crudo = page.locator("textarea").first();
  await expect(crudo).toHaveValue(/"version": 2/);
  await expect(crudo).toHaveValue(/"titulares"/);

  expect(errores).toEqual([]);
  expect(aLaNube).toEqual([]);
  expect(externas).toEqual([]);
});
