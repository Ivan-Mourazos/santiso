import { expect, test, type Page } from "@playwright/test";

/**
 * Temporadas pasadas, sobre la base de juguete de `sembrar.ts`: la real solo guarda la activa.
 * Estas pruebas **no escriben** (el POST de activar se corta), pero necesitan un historial que la
 * base real ya no tiene. 2025/26: «Liga Histórica» terminada (Santiso 4 pts, Uno 3, Dos 1) y
 * «Copa Histórica»; goles del Santiso: Brais 3, Iago 1.
 */

async function elegirTemporadaPasada(page: Page) {
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 30000 });
  await temporada.selectOption({ label: "2025/26" });
}

test("la temporada pasada trae su clasificación final, ordenada por puntos", async ({ page }) => {
  await page.goto("/admin/clasificacion?categoria=Senior");
  await elegirTemporadaPasada(page);
  // Clasificación lleva la temporada en la URL; Estadísticas, en su estado.
  await expect(page).toHaveURL(/temporada=/);
  const competicion = page.getByLabel("Competición", { exact: true });
  await expect(competicion.locator("option", { hasText: "Liga Histórica" })).toHaveCount(1, {
    timeout: 30000,
  });
  await competicion.selectOption({ label: "Liga Histórica" });

  const filas = page.getByRole("table", { name: /Clasificación/ }).locator("tbody tr");
  await expect(filas.first()).toContainText("U.D. Santiso Ficticio", { timeout: 30000 });
  await expect(filas).toHaveCount(3);
  const posiciones = await filas.locator("td:nth-child(1)").allTextContents();
  expect(posiciones.map(Number)).toEqual([1, 2, 3]);
  const puntos = (await filas.locator("td:nth-child(4)").allTextContents()).map(Number);
  expect(puntos).toEqual([4, 3, 1]);
});

test.describe("estadísticas de la temporada pasada", () => {
  const tabla = (page: Page) => page.getByRole("table", { name: /Estadísticas/ });
  const totalGoles = (page: Page, n: number) =>
    page.locator("p", { hasText: new RegExp(`^${n}goles$`) });

  async function abrir(page: Page) {
    await page.goto("/admin/estadisticas?categoria=Senior");
    await elegirTemporadaPasada(page);
    await expect(totalGoles(page, 4)).toBeVisible({ timeout: 30000 });
  }

  test("trae la plantilla con sus totales", async ({ page }) => {
    await abrir(page);
    await expect(tabla(page).locator("tbody tr")).toHaveCount(2);
    // Se dice lo que la base no guarda, en vez de enseñar un cero.
    await expect(page.getByText(/no distingue los goles de penalti/)).toBeVisible();
  });

  test("ordenar por goles pone al máximo goleador primero y lo dice", async ({ page }) => {
    await abrir(page);
    const cabecera = page.getByRole("columnheader", { name: "Ordenar por goles" });
    await page.getByRole("button", { name: "Ordenar por goles" }).click();
    await expect(cabecera).toHaveAttribute("aria-sort", "descending");
    await expect(tabla(page).locator("tbody tr").first()).toContainText("Brais");
    await page.getByRole("button", { name: "Ordenar por goles" }).click();
    await expect(cabecera).toHaveAttribute("aria-sort", "ascending");
    await expect(tabla(page).locator("tbody tr").first()).toContainText("Iago");
  });

  test("filtrar por competición reduce los totales y «Todas» los recupera", async ({ page }) => {
    await abrir(page);
    const competicion = page.getByLabel("Competición", { exact: true });
    expect((await competicion.locator("option").allTextContents())[0]).toBe("Todas");
    await competicion.selectOption({ label: "Copa Histórica" });
    await expect(totalGoles(page, 1)).toBeVisible();
    await competicion.selectOption("");
    await expect(totalGoles(page, 4)).toBeVisible();
  });

  test("el buscador filtra por nombre sin tocar nada", async ({ page }) => {
    await abrir(page);
    await page.getByLabel("Buscar", { exact: true }).fill("zzz-nadie");
    await expect(page.getByText("Ningún jugador coincide con la búsqueda.")).toBeVisible();
    await page.getByRole("button", { name: "Quitar la búsqueda" }).click();
    await expect(tabla(page).locator("tbody tr")).toHaveCount(2);
  });

  for (const ancho of [360, 1280]) {
    test(`cabe a ${ancho}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page);
      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborda).toBe(false);
    });
  }
});

test("activar temporada exige confirmación y conserva la activa ante fallo", async ({ page }) => {
  await page.goto("/admin/temporadas");
  const active = page.getByText("Activa", { exact: true });
  await expect(active).toHaveCount(1, { timeout: 30000 });
  const current = (await active.locator("..").textContent()) ?? "";
  const activate = page.getByRole("button", { name: /Usar .* como temporada activa/ }).first();
  await activate.click();
  const dialog = page.getByRole("dialog", { name: "Confirmar acción" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(active.locator("..")).toHaveText(current);
  await activate.click();
  await page.route("**/admin/temporadas**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("No se pudo activar la temporada. Vuelve a intentarlo.", { exact: true }),
  ).toBeVisible();
  await expect(active.locator("..")).toHaveText(current);
});
