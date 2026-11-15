import { expect, test } from "@playwright/test";

/**
 * Federación sobre la base de juguete de `sembrar.ts`. Solo la copa de Jornada está enlazada
 * con futgal.es, y aquí no se pulsa ningún «Traer»: la prueba nunca sale a la red.
 */
test("federación: jornadas y partidos de cada competición, sin traer nada sin enlace", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/admin/federacion?categoria=Senior");
  // La copa de Jornada sí está enlazada: ofrece traer. No se pulsa nada.
  const traer = page.getByRole("region", { name: "Volver a traer" });
  await expect(traer).toBeVisible({ timeout: 30000 });
  // Todo a la vista, de lo grande a lo pequeño; para jornada, partido y jugador, su selector.
  for (const boton of ["Ponerse al día", "Traer calendario", "Traer horarios", "Comparar", "Traer cifras"])
    await expect(traer.getByRole("button", { name: boton, exact: true })).toBeVisible();
  await expect(traer.getByRole("button", { name: /^Traer jornada \d+$/ })).toBeVisible();
  await traer.getByLabel("Partido", { exact: true }).selectOption({ index: 1 });
  await expect(traer.getByRole("button", { name: "Traer partido", exact: true })).toBeVisible();
  await expect(traer.getByLabel("Jugador", { exact: true })).toBeVisible();
  await page
    .getByLabel("Competición", { exact: true })
    .selectOption({ label: "Copa Convocatoria" });
  // Sin enlace no hay botones de traer: el campo para pegarlo está a la vista.
  await expect(page.getByText(/Sin enlazar con la federación/)).toBeVisible();
  await expect(page.getByLabel("Enlace de Copa Convocatoria")).toBeVisible();
  await expect(page.getByRole("button", { name: "Traer calendario" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Volver a traer" })).toHaveCount(0);
  const jornadas = page.getByRole("region", { name: "Jornadas", exact: true });
  // «Qué hay traído» sale plegado: es para consultar.
  await jornadas.locator("summary").first().click();
  const primera = jornadas.locator("details[data-estado]").first();
  await expect(primera).toContainText("J1");
  await primera.locator("summary").click();
  await expect(primera.getByText("Norte Convocatoria – Sur Convocatoria")).toBeVisible();
  await expect(primera.getByRole("button", { name: /^Traer/ })).toHaveCount(0);
  // La jornada 2 ya se jugó (1–1) y no tiene acta de la federación.
  const segunda = jornadas.locator("details[data-estado]").nth(1);
  await segunda.locator("summary").click();
  await expect(segunda.getByText("1–1", { exact: true })).toBeVisible();
  await expect(segunda.getByText("Sin acta", { exact: true })).toBeVisible();
  await expect(
    page.locator("summary").filter({ hasText: "Enlaces con la federación" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(errores).toEqual([]);
});

test("federación: partidos de temporadas pasadas, archivados y a pedir", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/admin/federacion?categoria=Senior");
  const pasadas = page.getByRole("region", { name: "Temporadas pasadas" });
  await expect(pasadas).toBeVisible({ timeout: 30000 });
  // Plegado por defecto: se abre para ver las temporadas.
  await pasadas.locator("summary").first().click();
  // La de 2023-24 ya está traída: se despliega sin salir a la red.
  await expect(pasadas.getByText("Partidos del Santiso: Todos traídos")).toBeVisible();
  await pasadas.locator("summary").filter({ hasText: "Ver partidos" }).click();
  await expect(pasadas.getByText("U.D. Santiso 2–1 Antigo Rival Ficticio")).toBeVisible();
  await expect(pasadas.getByText(/⚽ VELLO GOLEADOR, XAN 23'/)).toBeVisible();
  await expect(pasadas.getByText(/🟨 RIVAL AMONESTADO, PEPE 40'/)).toBeVisible();
  // La de 2022-23 está sin pedir: pedirla solo la pone en cola, no descarga nada.
  const pedir = pasadas.getByRole("button", {
    name: "Traer partidos: 2022-2023 · TERCEIRA FICTICIA",
  });
  await pedir.click();
  await expect(page.getByText(/Se irán trayendo poco a poco/)).toBeVisible();
  await expect(
    pasadas.getByText("Partidos del Santiso: Pedidos, llegarán poco a poco"),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
