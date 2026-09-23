import { expect, test, type Page } from "@playwright/test";

/**
 * Importar jornada escribiendo sobre la base de juguete, en «Copa Calendario» (Veteranos).
 * Gemini se simula: nunca se llama. Van en orden y comparten estado.
 */
test.describe.configure({ mode: "serial" });

const CAPTURA = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=",
  "base64",
);

async function simularGemini(page: Page) {
  await page.route("**/api/admin/jornada-gemini", (route) =>
    route.fulfill({
      json: {
        model: "simulado",
        data: {
          competicion: "Copa Calendario",
          jornada: "7",
          partidos: [
            {
              localNombre: "NORTE CALENDARIO",
              visitanteNombre: "Leste Calendario",
              golesLocal: "3",
              golesVisitante: "1",
              fecha: "2026-11-08",
              hora: "17:00",
              confidence: "alta",
            },
          ],
        },
      },
    }),
  );
}

async function analizar(page: Page) {
  await page.goto("/admin/importar-jornada?origen=foto");
  await expect(page.getByLabel("Competición", { exact: true })).not.toHaveValue("", {
    timeout: 30000,
  });
  await simularGemini(page);
  await page
    .getByLabel("Captura de la jornada")
    .setInputFiles({ name: "jornada.png", mimeType: "image/png", buffer: CAPTURA });
  await page.getByRole("button", { name: "Analizar con Gemini" }).click();
  await expect(
    page.getByRole("region", { name: "Fila 1: NORTE CALENDARIO - Leste Calendario" }),
  ).toBeVisible({ timeout: 15000 });
}

test("un fallo al guardar se dice y deja la revisión para reintentar", async ({ page }) => {
  await analizar(page);
  // Detecta la competición por su nombre y cambia a ella.
  await expect(
    page.getByLabel("Competición", { exact: true }).locator("option:checked"),
  ).toHaveText("Copa Calendario");
  await page.getByRole("button", { name: "Crear jornada 7" }).click();
  await expect(page.getByText("Jornada 7 creada correctamente")).toBeVisible();

  // Con las Server Actions cortadas, guardar falla: la pantalla no se queda colgada.
  const cortar = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.route("**/admin/importar-jornada**", cortar);
  await page.getByRole("button", { name: /^Guardar 1 partido/ }).click();
  await page
    .getByRole("dialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(page.getByText(/No se pudieron guardar los partidos/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("button", { name: /^Guardar 1 partido/ })).toBeEnabled();
  await page.unroute("**/admin/importar-jornada**", cortar);
});

test("guardar lo revisado lo deja en el calendario", async ({ page }) => {
  await analizar(page);
  const fila = page.getByRole("region", { name: "Fila 1: NORTE CALENDARIO - Leste Calendario" });
  await expect(fila.getByLabel("Local de la fila 1").locator("option:checked")).toHaveText(
    "Norte Calendario",
  );
  await expect(page.getByLabel("Jornada de destino", { exact: true })).toHaveValue(/.+/);
  await expect(
    page.getByLabel("Jornada de destino", { exact: true }).locator("option:checked"),
  ).toHaveText("Jornada 7");

  await page.getByRole("button", { name: /^Guardar 1 partido/ }).click();
  await page
    .getByRole("dialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(page.getByText("1 partido(s) guardados correctamente")).toBeVisible();

  await page.goto("/admin/calendario?categoria=Veteranos");
  await page.getByLabel("Competición", { exact: true }).selectOption({ label: "Copa Calendario" });
  // Cambiar de competición vuelve a montar la sección: esperar a su lista de jornadas.
  const jornada = page.getByLabel("Jornada", { exact: true });
  await expect(jornada.locator("option", { hasText: "Jornada 7" })).toHaveCount(1, {
    timeout: 30000,
  });
  await jornada.selectOption({ label: "Jornada 7" });
  await expect(page).toHaveURL(/jornada=/);
  const partido = page.getByRole("region", { name: "Norte Calendario - Leste Calendario" });
  await expect(partido.getByLabel("Goles de Norte Calendario")).toHaveValue("3", {
    timeout: 30000,
  });
  await expect(partido.getByLabel("Goles de Leste Calendario")).toHaveValue("1");
});
