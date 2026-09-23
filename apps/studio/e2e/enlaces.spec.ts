import { expect, test } from "@playwright/test";

/**
 * Enlaces con el partido o la jornada ya elegidos, que usa la pantalla «Jornada». Contra la base
 * real y **solo lectura**: los identificadores se sacan de las propias pantallas.
 */

test("Carteles abre con el partido de la URL ya cargado", async ({ page }) => {
  // La lista de Actas trae todos los partidos del Santiso, con su id y «Jx - Local vs Visitante».
  await page.goto("/admin/actas");
  const partido = page.getByLabel("Partido", { exact: true });
  // Además del hueco vacío, al menos un partido de verdad.
  await expect.poll(() => partido.locator("option").count(), { timeout: 30000 }).toBeGreaterThan(1);
  const opcion = partido.locator("option").last();
  const id = await opcion.getAttribute("value");
  const texto = (await opcion.textContent()) ?? "";
  expect(id).toBeTruthy();

  await page.goto(`/admin/carteles?plantilla=partido&partido=${id}`);
  // El rival del partido queda en el formulario sin tocar nada.
  const rival = page.getByLabel("Rival", { exact: true });
  await expect(rival).not.toHaveValue("", { timeout: 30000 });
  expect(texto).toContain(await rival.inputValue());
});

test("Actas abre con categoría, competición y partido de la URL", async ({ page }) => {
  await page.goto("/admin/actas");
  const partido = page.getByLabel("Partido", { exact: true });
  // Además del hueco vacío, al menos un partido de verdad.
  await expect.poll(() => partido.locator("option").count(), { timeout: 30000 }).toBeGreaterThan(1);
  const categoria = await page.getByLabel("Categoría", { exact: true }).inputValue();
  const competicion = await page.getByLabel("Competición", { exact: true }).inputValue();
  const opciones = partido.locator("option");
  const ultima = opciones.nth((await opciones.count()) - 1);
  const id = await ultima.getAttribute("value");
  expect(id).toBeTruthy();

  await page.goto(`/admin/actas?categoria=${categoria}&competicion=${competicion}&partido=${id}`);
  await expect(page.getByLabel("Partido", { exact: true })).toHaveValue(id!, { timeout: 30000 });
});

test("Importar jornada abre con la jornada de destino de la URL", async ({ page }) => {
  await page.goto("/admin/importar-jornada?origen=foto");
  const jornada = page.getByLabel("Jornada de destino", { exact: true });
  await expect(jornada.locator("option")).not.toHaveCount(1, { timeout: 30000 });
  const competicion = await page.getByLabel("Competición", { exact: true }).inputValue();
  const categoria = await page.getByLabel("Categoría", { exact: true }).inputValue();
  const id = await jornada.locator("option").nth(1).getAttribute("value");
  expect(id).toBeTruthy();

  await page.goto(
    `/admin/importar-jornada?origen=foto&categoria=${categoria}&competicion=${competicion}&jornada=${id}`,
  );
  await expect(page.getByLabel("Jornada de destino", { exact: true })).toHaveValue(id!, {
    timeout: 30000,
  });
});
