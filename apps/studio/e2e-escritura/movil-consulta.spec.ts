import { expect, test, type Locator, type Page } from "@playwright/test";

// Todas las interacciones de escritura usan la base temporal de la configuración escritura.
const LOCAL = "U.D. Santiso de Proba Móbil con Nome Moi Longo";
const VISITANTE = "Rival de Consulta Móbil con Nome Moi Longo";
test.use({
  viewport: { width: 390, height: 844 },
  timezoneId: "Europe/Madrid",
  hasTouch: true,
  isMobile: true,
});

async function abrirConsulta(page: Page, seccion: string) {
  await page.goto(`/admin/${seccion}?categoria=Veteranos`);
  await page.getByLabel("Temporada", { exact: true }).selectOption({ label: "2025/26" });
  const competicion = page.getByLabel("Competición", { exact: true });
  await expect(competicion.locator("option", { hasText: "Copa Móvil Consulta" })).toHaveCount(1);
  await competicion.selectOption({ label: "Copa Móvil Consulta" });
}

async function comprobarControles(page: Page, contenedor: Locator) {
  for (const control of await contenedor
    .locator("input:visible, select:visible, button:visible")
    .all()) {
    const rect = (await control.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44);
    expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    if (await control.evaluate((el) => el.matches("input, select"))) {
      expect(
        await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
}

test("calendario móvil guarda marcador, campo y fecha y mantiene tarjeta con contexto", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 844 });
  await abrirConsulta(page, "calendario");
  const tarjeta = page.getByRole("region", { name: `${LOCAL} - ${VISITANTE}`, exact: true });
  await expect(tarjeta).toBeVisible();
  await comprobarControles(page, tarjeta);
  const goles = tarjeta.getByLabel(`Goles de ${LOCAL}`);
  const originales = await goles.inputValue();
  const nuevos = originales === "2" ? "3" : "2";
  await goles.fill(nuevos);
  await tarjeta
    .getByLabel("Campo", { exact: true })
    .selectOption({ label: "Campo de Consulta Móbil con Nome Moi Longo" });
  await tarjeta.getByLabel("Fecha y hora", { exact: true }).fill("2025-11-02T17:30");
  await tarjeta.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados", { exact: true })).toBeVisible();
  await page.reload();
  await expect(goles).toHaveValue(nuevos);
  await expect(tarjeta.getByLabel("Fecha y hora", { exact: true })).toHaveValue("2025-11-02T17:30");
  await expect(tarjeta.getByLabel("Campo", { exact: true }).locator("option:checked")).toHaveText(
    "Campo de Consulta Móbil con Nome Moi Longo",
  );
  await page.getByRole("button", { name: "Partidos del Santiso", exact: true }).click();
  await expect(tarjeta.getByText("Jornada 1", { exact: true })).toBeVisible();
  await comprobarControles(page, tarjeta);
});
