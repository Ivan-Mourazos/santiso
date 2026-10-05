import { expect, test, type Page } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);

async function abrir(page: Page) {
  await page.goto("/admin/carteles");
  await expect(page.getByRole("tab", { name: "Datos", exact: true })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function vista(page: Page) {
  const tab = page.getByRole("tab", { name: "Vista previa", exact: true });
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.tap();
  await expect(page.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
}

for (const ancho of [360, 390]) {
  test(`carteles: pestañas conservan datos y siete plantillas caben a ${ancho}px`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page);
    await expect(page.getByLabel("Rival", { exact: true })).toBeVisible();
    await page.getByLabel("Rival", { exact: true }).fill("Rival móvil de prueba");
    await vista(page);
    await expect(page.getByLabel("Rival", { exact: true })).toBeHidden();
    await page.getByRole("tab", { name: "Datos", exact: true }).tap();
    await expect(page.getByLabel("Rival", { exact: true })).toHaveValue("Rival móvil de prueba");
    const selector = page.getByLabel("Plantilla de cartel", { exact: true });
    expect((await selector.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(
      await selector.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    for (const plantilla of [
      "partido",
      "resumo",
      "cronoloxia",
      "proximos",
      "noso11",
      "multiusos",
      "clasificacion",
    ]) {
      await selector.selectOption(plantilla);
      await expect(page).toHaveURL(new RegExp(`plantilla=${plantilla}`));
      await page.waitForLoadState("networkidle");
      await vista(page);
      const cartel = (await page.locator("[data-vista-cartel]").boundingBox())!;
      expect(cartel.width).toBeGreaterThan(200);
      expect(cartel.x + cartel.width).toBeLessThanOrEqual(ancho + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        ancho,
      );
      const altos = await page
        .locator("main button:visible, main select:visible")
        .evaluateAll((controles) => controles.map((el) => el.getBoundingClientRect().height));
      expect(Math.min(...altos)).toBeGreaterThanOrEqual(44);
      await page.getByRole("tab", { name: "Datos", exact: true }).tap();
      if (plantilla === "cronoloxia")
        await page.getByRole("button", { name: "+ Evento", exact: true }).tap();
      if (plantilla === "clasificacion") await page.getByRole("button", { name: /Manual/ }).tap();
      const fuentes = await page
        .locator(
          'main input:visible:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), main textarea:visible, main select:visible',
        )
        .evaluateAll((campos) => campos.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      expect(Math.min(...fuentes)).toBeGreaterThanOrEqual(16);
      const controlesDatos = await page
        .locator(
          'main button:visible, main input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]), main select:visible, main .file-input-label:visible',
        )
        .evaluateAll((campos) =>
          campos.map((el) => ({
            alto: el.getBoundingClientRect().height,
            ancho: el.getBoundingClientRect().width,
          })),
        );
      expect(Math.min(...controlesDatos.map((x) => x.alto))).toBeGreaterThanOrEqual(44);
      expect(Math.min(...controlesDatos.map((x) => x.ancho))).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        ancho,
      );
    }
  });
}

for (const modo of ["compartir", "sin-api", "no-admite", "cancelar", "error"] as const) {
  test(`carteles: PNG preparado, ${modo}, sin nueva petición al compartir`, async ({ page }) => {
    let peticiones = 0;
    await page.route("**/api/carteles/png", async (route) => {
      peticiones++;
      await route.fulfill({ contentType: "image/png", body: PNG });
    });
    await page.addInitScript((modo) => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => modo !== "no-admite",
      });
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value:
          modo === "sin-api"
            ? undefined
            : async (datos: ShareData) => {
                document.documentElement.dataset.compartido = JSON.stringify(
                  datos.files?.map((f) => ({ nombre: f.name, tipo: f.type, bytes: f.size })),
                );
                if (modo === "cancelar") throw new DOMException("Cancelado", "AbortError");
                if (modo === "error") throw new DOMException("Falló", "DataError");
              },
      });
    }, modo);
    await abrir(page);
    await vista(page);
    await page.getByRole("button", { name: "Preparar PNG", exact: true }).tap();
    const compartir = page.getByRole("button", { name: "Compartir", exact: true });
    await expect(compartir).toBeEnabled();
    const descargas: string[] = [];
    page.on("download", (d) => descargas.push(d.suggestedFilename()));
    if (["sin-api", "no-admite", "error"].includes(modo)) {
      const descarga = page.waitForEvent("download");
      await compartir.tap();
      expect((await descarga).suggestedFilename()).toMatch(/^partido-.*\.png$/);
    } else {
      await compartir.tap();
      await expect(page.locator("html")).toHaveAttribute("data-compartido", /"tipo":"image\/png"/);
      expect(descargas).toEqual([]);
    }
    expect(peticiones).toBe(1);
    await page.getByRole("tab", { name: "Datos", exact: true }).tap();
    await page.getByLabel("Rival", { exact: true }).fill("PNG nuevo necesario");
    await vista(page);
    await expect(compartir).toBeHidden();
    await expect(page.getByRole("button", { name: "Preparar PNG", exact: true })).toBeVisible();
  });
}

test("carteles: copia texto retocado sin zoom y conserva edición al cambiar de pestaña", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (texto: string) => {
          document.documentElement.dataset.copiado = texto;
        },
      },
    });
  });
  await page.goto("/admin/carteles?plantilla=clasificacion");
  const texto = page.getByRole("textbox", { name: "Texto para Instagram", exact: true });
  await expect(texto).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await texto.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await texto.fill("Texto móvil retocado 📸");
  const copiar = page.getByRole("button", { name: "Copiar", exact: true });
  expect((await copiar.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await copiar.tap();
  await expect(page.locator("html")).toHaveAttribute("data-copiado", "Texto móvil retocado 📸");
  await vista(page);
  await page.getByRole("tab", { name: "Datos", exact: true }).tap();
  await expect(texto).toHaveValue("Texto móvil retocado 📸");
});

test("carteles: PNG móvil real conserva medidas de exportación", async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page);
  await vista(page);
  await page.getByRole("button", { name: "Preparar PNG", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Compartir", exact: true })).toBeEnabled({
    timeout: 90000,
  });
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PNG", exact: true }).tap();
  const flujo = await (await descarga).createReadStream();
  const trozos: Buffer[] = [];
  for await (const trozo of flujo) trozos.push(trozo as Buffer);
  const png = Buffer.concat(trozos);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2160, 2700]);
});

test("carteles: respuesta PNG tardía no habilita compartir datos antiguos", async ({ page }) => {
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  let peticiones = 0;
  await page.route("**/api/carteles/png", async (route) => {
    peticiones++;
    if (peticiones === 1) await espera;
    await route.fulfill({ contentType: "image/png", body: PNG });
  });
  await abrir(page);
  await vista(page);
  await page.getByRole("button", { name: "Preparar PNG", exact: true }).tap();
  await expect.poll(() => peticiones).toBe(1);
  await page.getByRole("tab", { name: "Datos", exact: true }).tap();
  await page.getByLabel("Rival", { exact: true }).fill("Rival cambiado durante exportación");
  await vista(page);
  liberar();
  const preparar = page.getByRole("button", { name: "Preparar PNG", exact: true });
  await expect(preparar).toBeEnabled();
  await expect(page.getByRole("button", { name: "Compartir", exact: true })).toBeHidden();
  await preparar.tap();
  await expect(page.getByRole("button", { name: "Compartir", exact: true })).toBeEnabled();
  expect(peticiones).toBe(2);
});

test("carteles: exportación fallida permite reintentar", async ({ page }) => {
  let peticiones = 0;
  await page.route("**/api/carteles/png", async (route) => {
    peticiones++;
    await route.fulfill(
      peticiones === 1 ? { status: 500 } : { contentType: "image/png", body: PNG },
    );
  });
  await abrir(page);
  await vista(page);
  const preparar = page.getByRole("button", { name: "Preparar PNG", exact: true });
  await preparar.tap();
  await expect(
    page.getByText("No se pudo generar el PNG. Vuelve a intentarlo.", { exact: true }),
  ).toBeVisible();
  await expect(preparar).toBeEnabled();
  await preparar.tap();
  await expect(page.getByRole("button", { name: "Compartir", exact: true })).toBeEnabled();
});
