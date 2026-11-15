import { expect, test } from "@playwright/test";

/**
 * Enlaces con el partido ya elegido. Contra la base real y **solo lectura**: el identificador se
 * saca de la hoja del partido en Liga → Partidos.
 */

test("Carteles abre con el partido de la URL ya cargado", async ({ page }) => {
  // Nuestro partido de la jornada: su hoja lleva a Directo con el id en el enlace.
  await page.goto("/admin/partidos?categoria=Senior");
  const nuestro = page.locator("button[data-propio]").first();
  await expect(nuestro).toBeVisible({ timeout: 30000 });
  const texto = (await nuestro.getAttribute("aria-label")) ?? "";
  await nuestro.click();
  const directo = page.getByRole("dialog").getByRole("link", { name: "Directo", exact: true });
  const id = new URL((await directo.getAttribute("href"))!, page.url()).searchParams.get("partido");
  expect(id).toBeTruthy();

  await page.goto(`/admin/carteles?plantilla=partido&partido=${id}`);
  // El rival del partido queda en el formulario sin tocar nada.
  const rival = page.getByLabel("Rival", { exact: true });
  await expect(rival).not.toHaveValue("", { timeout: 30000 });
  expect(texto).toContain(await rival.inputValue());
});
