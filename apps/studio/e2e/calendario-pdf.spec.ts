import path from "node:path";
import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

// Playwright transpila estos ficheros a CommonJS: aquí no hay `import.meta`.
const CALENDARIO = path.resolve(__dirname, "../../../packages/actas/src/fixtures/jornada-1.pdf");

test("el calendario PDF enseña el plan antes de escribir nada", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");
  await page.getByText("Jornada", { exact: true }).first().click();
  await page.getByRole("button", { name: "Calendario completo (PDF)" }).click();

  const competicion = page.locator("#cal-competicion");
  await expect(competicion).toBeVisible();
  // La competición es obligatoria: sin ella no se puede leer nada.
  await expect(page.getByRole("button", { name: "Leer calendario (sin IA)" })).toBeDisabled();

  await page.locator("#cal-file").setInputFiles(CALENDARIO);
  await competicion.selectOption({ index: 1 });

  const leer = page.getByRole("button", { name: "Leer calendario (sin IA)" });
  await expect(leer).toBeEnabled();
  await leer.click();

  // `jornada-1.pdf` es una ficha de partido, no un calendario: el parser tiene que rechazarla
  // y decirlo, en vez de escribir a medias.
  await expect(page.getByText(/No se pudo leer el calendario/)).toBeVisible({ timeout: 15000 });

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});
