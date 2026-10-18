import { expect, test, type Page } from "@playwright/test";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);

async function abrir(page: Page) {
  await page.goto("/admin/carteles?plantilla=partido");
  await expect(page.getByRole("heading", { level: 1, name: "Cartel de partido" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  // El cartel de partido abre con el próximo cargado. Estas pruebas son del cartel a mano (sin
  // partido, sin guardar): se limpia y se abren los campos sueltos, que van plegados.
  await expect(page.getByRole("region", { name: "Partido del cartel" })).toBeVisible({
    timeout: 20000,
  });
  await page.locator("summary").filter({ hasText: "Más opciones" }).tap();
  await page.getByRole("button", { name: "Limpiar datos", exact: true }).tap();
  await page.locator("summary").filter({ hasText: "Otro partido o un amistoso, a mano" }).tap();
}

/** Sin pestañas: datos y vista previa van en la misma pantalla, uno debajo del otro. */
async function vista(page: Page) {
  await page.locator("[data-vista-cartel]").scrollIntoViewIfNeeded();
  await expect(page.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
}

for (const ancho of [360, 390]) {
  test(`carteles: datos y vista previa juntos, las plantillas caben a ${ancho}px`, async ({
    page,
  }) => {
    test.setTimeout(200000);
    await page.setViewportSize({ width: ancho, height: 844 });
    await abrir(page);
    await expect(page.getByLabel("Rival", { exact: true })).toBeVisible();
    await page.getByLabel("Rival", { exact: true }).fill("Rival móvil de prueba");
    await vista(page);
    // Ya no hay pestañas: los datos siguen ahí mientras se ve el cartel.
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(page.getByLabel("Rival", { exact: true })).toHaveValue("Rival móvil de prueba");
    // Cada cartel se abre desde el catálogo, con filas de toque cómodo.
    for (const [plantilla, nombre] of [
      ["partido", "Cartel de partido"],
      ["resumo", "Resultado"],
      ["cronoloxia", "Cronoloxía"],
      ["proximos", "Próximos partidos"],
      ["noso11", "O Noso 11"],
      ["multiusos", "Celebraciones y despedidas"],
      ["clasificacion", "Clasificación"],
      ["fichaxe", "Fichajes y renovaciones"],
      ["comunicado", "Comunicados y avisos"],
    ]) {
      await page.goto("/admin/carteles");
      const fila = page.getByRole("main").getByRole("link", { name: new RegExp(`^${nombre}`) });
      expect(Math.round((await fila.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
      await fila.tap();
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
      // En Android la densidad de píxeles es fraccionaria: 44 px salen como 43,99999.
      expect(Math.round(Math.min(...altos))).toBeGreaterThanOrEqual(44);
      if (plantilla === "cronoloxia")
        await page.getByRole("button", { name: "+ Evento", exact: true }).tap();
      if (plantilla === "clasificacion") await page.getByRole("button", { name: /Manual/ }).tap();
      // Las opciones móviles están plegadas; se revisan también sus controles al abrirlas.
      // Se abren solo los cerrados, de uno en uno: al abrir uno aparecen los que lleva dentro,
      // y tocar uno ya abierto lo cerraría.
      for (let intento = 0; intento < 20; intento++) {
        const cerrado = page.locator("main details:not([open]) > summary:visible").first();
        if ((await cerrado.count()) === 0) break;
        await cerrado.tap();
      }
      const fuentes = await page
        .locator(
          'main input:visible:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), main textarea:visible, main select:visible',
        )
        .evaluateAll((campos) => campos.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      expect(Math.min(...fuentes)).toBeGreaterThanOrEqual(16);
      const controlesDatos = await page
        .locator(
          'main button:visible, main summary:visible, main input:visible:not([type="checkbox"]):not([type="radio"]):not([type="file"]), main select:visible, main .file-input-label:visible',
        )
        .evaluateAll((campos) =>
          campos.map((el) => ({
            // Medida de maqueta: el botón recién tocado aún puede estar encogido al pulsarlo.
            alto: (el as HTMLElement).offsetHeight,
            ancho: (el as HTMLElement).offsetWidth,
          })),
        );
      expect(Math.round(Math.min(...controlesDatos.map((x) => x.alto)))).toBeGreaterThanOrEqual(44);
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
    // Sin tocar nada: el PNG se prepara solo y el botón ya es el de guardar.
    const compartir = page.getByRole("button", { name: "Guardar o compartir", exact: true });
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
    await page.getByLabel("Rival", { exact: true }).fill("PNG nuevo necesario");
    await vista(page);
    // Con datos nuevos el PNG anterior ya no vale: se prepara otro, también solo.
    await expect(compartir).toBeEnabled();
    expect(peticiones).toBe(2);
  });
}

test("carteles: copia texto retocado sin zoom y conserva la edición al ver el cartel", async ({
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
  await page.locator("summary").filter({ hasText: "Texto para Instagram" }).tap();
  const texto = page.getByRole("textbox", { name: "Texto para Instagram", exact: true });
  await expect(texto).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(
    await texto.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await texto.fill("Texto móvil retocado 📸");
  const copiar = page.getByRole("button", { name: "Copiar", exact: true });
  expect(Math.round((await copiar.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
  await copiar.tap();
  await expect(page.locator("html")).toHaveAttribute("data-copiado", "Texto móvil retocado 📸");
  await vista(page);
  await expect(texto).toHaveValue("Texto móvil retocado 📸");
});

test("carteles: PNG móvil real conserva medidas de exportación", async ({ page }) => {
  test.setTimeout(120000);
  await abrir(page);
  await vista(page);
  await expect(page.getByRole("button", { name: "Guardar o compartir", exact: true })).toBeEnabled({
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
  const soltar: (() => void)[] = [];
  let peticiones = 0;
  await page.route("**/api/carteles/png", async (route) => {
    peticiones++;
    await new Promise<void>((resolve) => soltar.push(resolve));
    await route.fulfill({ contentType: "image/png", body: PNG });
  });
  await abrir(page);
  await vista(page);
  // La primera preparación (automática) queda en el aire mientras se cambian los datos.
  await expect.poll(() => peticiones).toBe(1);
  await page.getByLabel("Rival", { exact: true }).fill("Rival cambiado durante exportación");
  await vista(page);
  soltar[0]!();
  // Llega el PNG de los datos viejos: no vale, y se pide otro con los nuevos.
  const compartir = page.getByRole("button", { name: "Guardar o compartir", exact: true });
  await expect.poll(() => peticiones, { timeout: 15000 }).toBe(2);
  await expect(compartir).toBeHidden();
  soltar[1]!();
  await expect(compartir).toBeEnabled();
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
  // La preparación automática falla: se avisa y no se reintenta sola, queda el botón.
  const preparar = page.getByRole("button", { name: "Preparar PNG", exact: true });
  await expect(
    page.getByText("No se pudo generar el PNG. Vuelve a intentarlo.", { exact: true }),
  ).toBeVisible();
  await expect(preparar).toBeEnabled();
  await page.waitForTimeout(2500);
  expect(peticiones).toBe(1);
  await preparar.tap();
  await expect(
    page.getByRole("button", { name: "Guardar o compartir", exact: true }),
  ).toBeEnabled();
});
