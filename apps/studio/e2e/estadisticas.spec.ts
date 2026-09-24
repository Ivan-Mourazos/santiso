import { expect, test, type Page } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Estadísticas contra la base de datos real. **Solo lectura**: la pantalla no escribe nada.
 * Los totales se comparan con lo que dio la auditoría de la 7A sobre esta misma base.
 */
const tabla = (page: Page) => page.getByRole("table", { name: /Estadísticas/ });

async function abrir(page: Page, categoria = "Senior") {
  await page.goto(`/admin/estadisticas?categoria=${categoria}`);
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible({ timeout: 30000 });
  await temporada.selectOption({ label: "2025/26" });
  await expect(tabla(page)).toBeVisible({ timeout: 30000 });
}

test("la temporada jugada trae la plantilla con sus totales", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await abrir(page);
  // 22 jugadores y 123 goles: lo mismo que cuenta la auditoría de la 7A en este ámbito.
  await expect(page.getByText("22", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("123", { exact: true })).toBeVisible();
  expect(await tabla(page).getByRole("row").count()).toBeGreaterThan(20);

  // Se dice lo que la base no guarda, en vez de enseñar un cero.
  await expect(page.getByText(/no distingue los goles de penalti/)).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("ordenar por goles pone al máximo goleador primero y lo dice", async ({ page }) => {
  await abrir(page);
  // El nombre accesible de la cabecera lo pone su botón de ordenar.
  const cabecera = page.getByRole("columnheader", { name: "Ordenar por goles" });
  await expect(cabecera).not.toHaveAttribute("aria-sort", /.+/);

  await page.getByRole("button", { name: "Ordenar por goles" }).click();
  await expect(cabecera).toHaveAttribute("aria-sort", "descending");
  const goles = await tabla(page).locator("tbody tr td:nth-child(6)").allTextContents();
  const numeros = goles.map(Number);
  expect(numeros).toEqual([...numeros].sort((a, b) => b - a));

  // Pulsar otra vez lo da la vuelta.
  await page.getByRole("button", { name: "Ordenar por goles" }).click();
  await expect(cabecera).toHaveAttribute("aria-sort", "ascending");
});

test("filtrar por competición reduce los totales y «Todas» los recupera", async ({ page }) => {
  await abrir(page);
  const goles = page.locator("p", { hasText: /^123goles$/ });
  await expect(goles).toBeVisible();

  const competicion = page.getByLabel("Competición", { exact: true });
  const opciones = await competicion.locator("option").allTextContents();
  expect(opciones[0]).toBe("Todas");
  await competicion.selectOption({ index: 1 });
  await expect(goles).toBeHidden();

  await competicion.selectOption("");
  await expect(goles).toBeVisible();
});

test("el buscador filtra por nombre sin tocar nada", async ({ page }) => {
  await abrir(page);
  const filas = tabla(page).locator("tbody tr");
  // Contar cuando la tabla ya no cambia: al elegir temporada se ve un momento la anterior.
  let total = -1;
  await expect
    .poll(
      async () => {
        const n = await filas.count();
        const estable = n > 0 && n === total;
        total = n;
        return estable;
      },
      { intervals: [700], timeout: 30000 },
    )
    .toBe(true);
  await page.getByLabel("Buscar", { exact: true }).fill("zzz-nadie");
  await expect(page.getByText("Ningún jugador coincide con la búsqueda.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar la búsqueda" }).click();
  await expect(filas).toHaveCount(total);
});

test("la categoría de la cabecera incluye Femenino y cambia los datos", async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole("button", { name: "Femenino" })).toBeVisible();
  await page.getByRole("button", { name: "Femenino" }).click();
  await expect(page.getByRole("heading", { name: "Estadísticas de Femenino" })).toBeVisible({
    timeout: 30000,
  });
});

for (const ancho of [360, 1280]) {
  test(`la pantalla de estadísticas cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await abrir(page);
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}
