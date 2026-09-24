import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Pantalla «Jornada» contra la base de datos real. **Solo lectura**: no tiene nada que guarde;
 * aquí se comprueba que carga, que cambia de semana y que sus enlaces llevan el partido.
 */
test("abre en la semana de hoy con una columna por categoría", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  // `/admin` lleva a la Jornada: es la pantalla de entrada.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/jornada/);
  await expect(page.getByRole("heading", { name: /^Semana del/ })).toBeVisible({ timeout: 30000 });
  for (const categoria of ["Senior", "Veteranos"]) {
    await expect(page.getByRole("region", { name: categoria, exact: true })).toBeVisible();
  }
  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("las semanas se recorren y quedan en la URL", async ({ page }) => {
  await page.goto("/admin/jornada?semana=2026-09-23");
  const titulo = page.getByRole("heading", { name: /^Semana del/ });
  await expect(titulo).toHaveText("Semana del 21 al 27 de septiembre", { timeout: 30000 });
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await expect(titulo).toHaveText("Semana del 28 de septiembre al 4 de octubre");
  await expect(page).toHaveURL(/semana=2026-09-28/);
  await page.getByRole("button", { name: "← Anterior" }).click();
  // Cada clic calcula desde la semana de la URL: esperar a que cambie antes del siguiente.
  await expect(titulo).toHaveText("Semana del 21 al 27 de septiembre");
  await page.getByRole("button", { name: "← Anterior" }).click();
  await expect(titulo).toHaveText("Semana del 14 al 20 de septiembre");
});

test("cada partido enlaza sus pantallas con el partido ya elegido", async ({ page }) => {
  await page.goto("/admin/jornada?semana=2026-09-23");
  const senior = page.getByRole("region", { name: "Senior", exact: true });
  const partido = senior.getByRole("article").first();
  await expect(partido).toBeVisible({ timeout: 30000 });
  // La hora se corrige en Calendario, con la jornada del partido ya elegida.
  await expect(partido.getByRole("link", { name: "Cambiar fecha, hora o campo" })).toHaveAttribute(
    "href",
    /\/admin\/calendario\?categoria=Senior&competicion=[\w-]+&jornada=[\w-]+/,
  );
  const cartel = partido.getByRole("link", { name: "Cartel de partido" });
  const href = (await cartel.getAttribute("href")) ?? "";
  expect(href).toMatch(/\/admin\/carteles\?plantilla=partido&partido=[\w-]+/);

  // Y el enlace hace su trabajo: Carteles se abre con el rival del partido ya puesto.
  const rivalEsperado = (await partido.getAttribute("aria-label"))!
    .split(" - ")
    .find((nombre) => !/santiso/i.test(nombre));
  await cartel.click();
  await expect(page).toHaveURL(/\/admin\/carteles/);
  await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(rivalEsperado!, {
    timeout: 30000,
  });
});

test("lo que depende de haber jugado está deshabilitado antes y dice por qué", async ({ page }) => {
  // Último partido Senior de la temporada (09/05/2027): sin jugar durante mucho tiempo, así la
  // prueba no cambia de resultado cuando se importe el acta de la primera jornada.
  await page.goto("/admin/jornada?semana=2027-05-05");
  const partido = page
    .getByRole("region", { name: "Senior", exact: true })
    .getByRole("article")
    .first();
  await expect(partido).toBeVisible({ timeout: 30000 });
  const cronoloxia = partido.getByRole("button", { name: "Cronoloxía" });
  await expect(cronoloxia).toBeDisabled();
  await expect(cronoloxia).toHaveAttribute("title", /acta/);
});

for (const ancho of [360, 1280]) {
  test(`la jornada cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/jornada?semana=2026-09-23");
    await expect(page.getByRole("region", { name: "Senior", exact: true })).toBeVisible({
      timeout: 30000,
    });
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}
