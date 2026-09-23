import { expect, test, type Locator, type Page } from "@playwright/test";

async function abrirIndividual(page: Page) {
  await page.goto("/admin/actas");
  await expect(page.getByLabel("Categoría", { exact: true })).toHaveValue("Veteranos");
  const partido = page.getByLabel("Partido", { exact: true });
  await expect(partido).not.toHaveValue("");
  await expect(page.getByRole("button", { name: /Rellenar manualmente/ })).toBeEnabled();
  return partido;
}

async function etiquetasAsociadas(contenedor: Locator) {
  const sinEtiqueta = await contenedor.locator("input, select, textarea").evaluateAll((campos) =>
    campos
      .filter((campo) => {
        if (!(
          campo instanceof HTMLInputElement ||
          campo instanceof HTMLSelectElement ||
          campo instanceof HTMLTextAreaElement
        ))
          return false;
        return campo.type !== "hidden" && !campo.labels?.length;
      })
      .map((campo) => campo.outerHTML.slice(0, 180)),
  );
  expect(sinEtiqueta).toEqual([]);
}

for (const ancho of [360, 1280]) {
  test(`Acta individual: campos asociados y edición local a ${ancho}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await abrirIndividual(page);
    // Tras cargar lecturas, bloquear cualquier acción de servidor: esta prueba nunca guarda.
    await page.route("**/admin/actas**", (route) =>
      route.request().method() === "POST" ? route.abort() : route.continue(),
    );
    await page.getByRole("button", { name: /Rellenar manualmente/ }).click();
    await page.getByRole("button", { name: "Añadir titular", exact: true }).click();
    await page.getByRole("button", { name: "Añadir suplente", exact: true }).click();
    await page.getByRole("button", { name: "Añadir evento", exact: true }).click();
    const main = page.getByRole("main");
    await etiquetasAsociadas(main);
    await expect(page.getByLabel("Goles local", { exact: true })).toHaveValue("0");
    await page.getByLabel("Goles local", { exact: true }).fill("2");
    await expect(page.getByLabel("Goles local", { exact: true })).toHaveValue("2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page.screenshot({
      path: testInfo.outputPath(`acta-individual-${ancho}.png`),
      fullPage: true,
    });
  });

  test(`Lote: revisión accesible, cierre y foco a ${ancho}px sin escribir`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    const partido = await abrirIndividual(page);
    const seleccion = await partido.locator("option:checked").textContent();
    const partes = seleccion?.match(/^J(\d+) - (.+) vs (.+)$/);
    if (!partes) throw new Error("La prueba requiere un partido legible del catálogo real");
    await page.getByLabel("Modo de importación de actas").selectOption("lote");
    // Esperar al lote de verdad: justo al cambiar, el campo de archivo que hay en pantalla aún es
    // el de la importación individual.
    await expect(page.getByRole("heading", { name: "Importar actas en lote" })).toBeVisible({
      timeout: 30000,
    });
    // El lote carga plantillas y campos con Server Actions, que también son POST: hay que dejar
    // que terminen antes de bloquearlas, o la carga se queda colgada y «Procesar» no se habilita.
    await expect(page.getByText("Cargando datos del lote...")).toBeHidden({ timeout: 30000 });
    const archivo = page.locator('input[type="file"]');
    await expect(archivo).toHaveCount(1);
    // Nunca invocar servicios externos ni mutaciones: fixture de análisis con incidencia
    // obliga a revisión, y cualquier POST de Server Action queda bloqueado adicionalmente.
    let accionesBloqueadas = 0;
    await page.route("**/admin/actas**", (route) => {
      if (route.request().method() === "POST") {
        accionesBloqueadas++;
        return route.abort();
      }
      return route.continue();
    });
    await page.route("**/api/admin/acta-detect", (route) =>
      route.fulfill({
        json: {
          jornada: Number(partes[1]),
          localTeam: partes[2],
          visitorTeam: partes[3],
          categoria: "Veteranos",
        },
      }),
    );
    await page.route("**/api/admin/acta-gemini", (route) =>
      route.fulfill({
        json: {
          acta: {
            marcadorLocal: "0",
            marcadorVisitante: "0",
            campoNombre: "",
            campoPoblacion: "",
            titulares: [
              { id: "ficticio", dorsal: "999", rawName: "Persona ficticia no vinculada" },
            ],
            suplentes: [],
            eventos: [{ id: "e1", tipo: "gol", minuto: "12", isRival: false, confidence: "baja" }],
            warnings: ["Los goles no coinciden: fixture de revisión"],
            rawText: "Fixture visual, no guardar",
          },
        },
      }),
    );
    await archivo.setInputFiles({
      name: "acta-ficticia.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jM1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page.getByRole("button", { name: /^Procesar 1/ }).click();
    const revisar = page.getByRole("button", { name: /Revisar/ }).first();
    await expect(revisar).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`acta-lote-${ancho}.png`), fullPage: true });
    await revisar.click();
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toBeVisible();
    await etiquetasAsociadas(dialogo);
    expect(await dialogo.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page.keyboard.press("Tab");
    expect(await dialogo.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`acta-revision-${ancho}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialogo).toBeHidden();
    await expect(revisar).toBeFocused();
    expect(accionesBloqueadas).toBe(0);
  });
}

test("si la carga del lote falla se dice y se puede reintentar", async ({ page }) => {
  await abrirIndividual(page);
  // Toda Server Action falla mientras se prepara el lote: no escribe nada, solo corta la lectura.
  const cortar = (route: import("@playwright/test").Route) =>
    route.request().method() === "POST" ? route.abort() : route.continue();
  await page.route("**/admin/actas**", cortar);
  await page.getByLabel("Modo de importación de actas").selectOption("lote");

  await expect(page.getByText("No se pudo preparar el lote")).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Cargando datos del lote...")).toHaveCount(0);

  await page.unroute("**/admin/actas**", cortar);
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("No se pudo preparar el lote")).toBeHidden({ timeout: 30000 });
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});
