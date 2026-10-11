import { expect, test } from "@playwright/test";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=",
  "base64",
);
test("Partido: recupera la previa después de un fallo de transporte", async ({ page }) => {
  await page.goto("/admin/carteles?plantilla=partido");
  const cargar = page.getByRole("button", { name: "Cargar próximo partido", exact: true });
  await expect(cargar).toBeVisible();
  await expect(page.getByLabel("Competición", { exact: true })).not.toHaveValue("");
  await page.waitForLoadState("networkidle");
  let fallar = true;
  await page.route("**/admin/carteles*", async (ruta) => {
    if (
      fallar &&
      ruta.request().headers()["next-action"] &&
      ruta.request().postData()?.startsWith("[[")
    ) {
      fallar = false;
      await ruta.abort("failed");
    } else await ruta.continue();
  });
  await cargar.tap();
  await page.getByRole("tab", { name: "Vista previa", exact: true }).tap();
  await expect(
    page.getByRole("alert").filter({ hasText: "No se pudo cargar la previa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar previa", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Preparar PNG", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Reintentar previa", exact: true })).toBeHidden();
});
for (const ancho of [360, 390]) {
  test(`Axenda: prepara tres PNG, comparte juntos y permite descargar a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
      Object.defineProperty(navigator, "share", {
        value: async (datos: ShareData) => {
          (window as unknown as { axendaCompartida: unknown }).axendaCompartida = {
            nombres: datos.files?.map((f) => f.name),
            texto: datos.text,
          };
        },
        configurable: true,
      });
    });
    const peticiones: { plantilla: string; formato?: string; datos: { partidos?: unknown[] } }[] =
      [];
    await page.route("**/api/carteles/png", async (ruta) => {
      peticiones.push(ruta.request().postDataJSON());
      await ruta.fulfill({ status: 200, contentType: "image/png", body: PNG });
    });
    await page.goto("/admin/carteles?plantilla=proximos");
    const tarjetas = page.locator("[data-partido-plegado] > summary");
    await tarjetas.nth(0).tap();
    await expect(page.getByLabel("Rival del partido 1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Rival del partido 1").fill("C.D. Compañía de María");
    await tarjetas.nth(1).tap();
    await expect(page.getByLabel("Rival del partido 1")).toBeHidden();
    await page.getByLabel("Rival del partido 2").fill("A.C.U.D. Camporrapado");
    await page.getByLabel("Formato de cartel").selectOption("historia");
    await page.getByRole("button", { name: "Preparar carrusel Axenda", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Compartir carrusel", exact: true }),
    ).toBeVisible();
    expect(peticiones.map((p) => p.plantilla)).toEqual(["proximos", "partido", "partido"]);
    expect(peticiones.every((p) => p.formato === "historia")).toBe(true);
    const caption = page.getByRole("textbox", { name: "Texto para Instagram", exact: true });
    const opcionesTexto = page.locator("summary").filter({ hasText: "Texto para Instagram" });
    // Desplaza la opción al centro: las barras fijas no cuentan para scrollIntoViewIfNeeded.
    await opcionesTexto.evaluate((n) => n.scrollIntoView({ block: "center" }));
    await opcionesTexto.tap();
    await caption.fill("Axenda editada 💛🖤");
    await page.getByRole("button", { name: "Compartir carrusel", exact: true }).tap();
    expect(
      await page.evaluate(
        () => (window as unknown as { axendaCompartida: unknown }).axendaCompartida,
      ),
    ).toEqual({
      nombres: ["axenda-1.png", "axenda-2.png", "axenda-3.png"],
      texto: "Axenda editada 💛🖤",
    });
    const descarga = page.waitForEvent("download");
    await page.getByRole("button", { name: "axenda-2.png", exact: true }).tap();
    expect((await descarga).suggestedFilename()).toBe("axenda-2.png");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    const altos = await page
      .locator("main button:visible, main select:visible")
      .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height));
    expect(Math.round(Math.min(...altos))).toBeGreaterThanOrEqual(44);
    await tarjetas.nth(0).tap();
    await page.getByLabel("Rival del partido 1").fill("Outro rival");
    await expect(
      page.getByRole("button", { name: "Compartir carrusel", exact: true }),
    ).toBeHidden();
    await page.getByRole("tab", { name: "Vista previa", exact: true }).tap();
    await expect(page.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
    const medidas = await page.locator("[data-vista-cartel] [data-cartel]").evaluate((n) => ({
      w: parseFloat(getComputedStyle(n).width),
      h: parseFloat(getComputedStyle(n).height),
    }));
    expect(medidas).toEqual({ w: 1080, h: 1920 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
}
