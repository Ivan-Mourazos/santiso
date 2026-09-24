import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

test("el calendario carga jornadas y partidos desde la base de datos local", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");
  await page.getByText("Calendario", { exact: true }).first().click();
  await page.waitForTimeout(2500);

  // La pantalla llega hasta pintar la tabla de partidos de una jornada.
  await expect(page.getByRole("button", { name: "Guardar", exact: true }).first()).toBeVisible();
  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("«Partidos del Santiso» junta los del club de toda la temporada con su hora", async ({
  page,
}) => {
  await page.goto("/admin/calendario?categoria=Senior&vista=santiso");
  const lista = page.getByRole("region", { name: "Partidos del Santiso" });
  await expect(lista.getByLabel("Fecha y hora", { exact: true }).first()).toBeVisible({
    timeout: 30000,
  });
  // Cada fila dice su jornada y todas son del Santiso.
  const filas = lista.getByRole("region");
  const n = await filas.count();
  expect(n).toBeGreaterThan(1);
  for (let i = 0; i < n; i++) {
    await expect(filas.nth(i)).toHaveAccessibleName(/Santiso/i);
    await expect(filas.nth(i).getByText(/^Jornada \d+/)).toBeVisible();
  }
  // Sin selector de jornada en esta vista.
  await expect(page.getByLabel("Jornada", { exact: true })).toHaveCount(0);
});
