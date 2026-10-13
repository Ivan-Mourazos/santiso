import path from "node:path";
import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

// Playwright transpila estos ficheros a CommonJS: aquí no hay `import.meta`.
const CALENDARIO = path.resolve(__dirname, "../../../packages/actas/src/fixtures/jornada-1.pdf");

test("el calendario PDF enseña el plan antes de escribir nada", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  // Se entra por «Importar»: el calendario en PDF es uno de sus enlaces de ordenador.
  await page.goto("/admin");
  await page.getByText("Importar", { exact: true }).first().click();
  await page.getByRole("link", { name: "calendario completo" }).click();

  const competicion = page.locator("#cal-competicion");
  await expect(competicion).toBeVisible();
  // La competición es obligatoria: sin ella no se puede leer nada.
  await expect(page.getByRole("button", { name: "Leer calendario (sin IA)" })).toBeDisabled();

  // Sin PDF también se puede: lo baja el Studio con el enlace de la competición. No se pulsa
  // aquí, que saldría a la red.
  await expect(page.getByRole("button", { name: "Traer de la federación" })).toBeVisible();

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
