import { expect, test, type Page } from "@playwright/test";

/**
 * «Importar» en móvil: una sola entrada para actas y jornadas. Solo lectura y sin IA: la lectura
 * de la cabecera se responde aquí y nunca se pulsa nada que guarde.
 */

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=",
  "base64",
);
const capturas = (nombres: string[]) =>
  nombres.map((name) => ({ name, mimeType: "image/png", buffer: PIXEL }));

async function abrir(page: Page, deteccion: Record<string, unknown>) {
  await page.route("**/api/admin/acta-detect", (route) => route.fulfill({ json: deteccion }));
  await page.goto("/admin/importar");
  await expect(page.locator("#importar-file-input")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function sinDesbordar(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const ancho of [360, 390]) {
  test(`importar: las capturas de un acta van a la revisión del acta a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, {
      tipo: "acta",
      jornada: 1,
      localTeam: "Equipo A",
      visitorTeam: "Equipo B",
      categoria: "Senior",
    });
    await page.locator("#importar-file-input").setInputFiles(capturas(["a.png", "b.png"]));
    await expect(page.getByRole("status").filter({ hasText: "el acta de un partido" })).toBeVisible();
    // Las capturas llegan ya elegidas a la pantalla del acta.
    await expect(
      page.getByRole("list", { name: "Capturas elegidas" }).getByRole("listitem"),
    ).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Analizar con Gemini" })).toBeVisible();
    await sinDesbordar(page);
  });

  test(`importar: la lista de una jornada va a la revisión de jornada a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, { tipo: "jornada", jornada: 3 });
    await page.locator("#importar-file-input").setInputFiles(capturas(["j1.png", "j2.png"]));
    await expect(
      page.getByRole("status").filter({ hasText: "los partidos de una jornada" }),
    ).toBeVisible();
    await expect(page.getByText("2 capturas")).toBeVisible();
    await expect(page.locator("#jornada-file-input")).toBeVisible();
    // Si la app se equivoca, se corrige con un toque y las capturas no se pierden.
    await page.getByRole("button", { name: "No, es el acta de un partido" }).click();
    await expect(
      page.getByRole("list", { name: "Capturas elegidas" }).getByRole("listitem"),
    ).toHaveCount(2);
    await sinDesbordar(page);
  });

  test(`importar: si no se sabe qué son, pregunta a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page, { tipo: "otro" });
    await page.locator("#importar-file-input").setInputFiles(capturas(["x.png"]));
    const pregunta = page.getByRole("alert").filter({ hasText: "¿Qué has subido?" });
    await expect(pregunta).toBeVisible();
    for (const boton of await pregunta.getByRole("button").all()) {
      expect(Math.round((await boton.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    }
    await pregunta.getByRole("button", { name: "Los partidos de una jornada" }).click();
    await expect(page.locator("#jornada-file-input")).toBeVisible();
    await sinDesbordar(page);
  });
}

test("importar: sin capturas se puede abrir el acta a mano", async ({ page }) => {
  await abrir(page, {});
  await page.getByRole("button", { name: "Acta a mano o corregir una guardada" }).click();
  await expect(page.getByRole("button", { name: /Rellenar manualmente/ })).toBeVisible();
  await page.getByRole("button", { name: "Empezar de nuevo" }).click();
  await expect(page.locator("#importar-file-input")).toBeVisible();
});
