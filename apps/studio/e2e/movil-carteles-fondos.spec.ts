import { expect, test } from "@playwright/test";

const foto = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#99bda0"/></svg>',
);
for (const pantalla of ["convocatoria", "alineacion"] as const) {
  test(`${pantalla}: capacidad explica dos láminas sin escribir en datos reales`, async ({
    page,
  }) => {
    await page.goto("/admin/" + pantalla);
    const boton = page.getByRole("button", {
      name: pantalla === "convocatoria" ? "Ver cartel" : "Ver historia",
      exact: true,
    });
    await expect(boton).toBeEnabled({ timeout: 30000 });
    const escrituras: string[] = [];
    // Barrera adicional: ni siquiera una regresión puede ejecutar una acción de servidor.
    await page.route("**/*", async (ruta) => {
      if (ruta.request().headers()["next-action"]) {
        escrituras.push(ruta.request().url());
        await ruta.abort();
      } else await ruta.fallback();
    });
    await page.route("**/api/carteles/png", (ruta) =>
      ruta.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "El contenido no cabe con letra legible. Reduce datos o prepara dos láminas.",
        }),
      }),
    );
    await boton.click();
    await expect(
      page.getByText(
        "El contenido no cabe con letra legible. Reduce datos o prepara dos láminas.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(escrituras).toEqual([]);
  });
}
for (const ancho of [360, 390]) {
  test(`alineación: foto de campo editable sin guardar jugadores a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto("/admin/alineacion");
    const control = page.locator("details").filter({ hasText: "Foto de campo · fondo del cartel" });
    await expect(control).toBeVisible({ timeout: 30000 });
    await control.locator("summary").tap();
    await page
      .getByLabel("Subir foto del campo", { exact: true })
      .setInputFiles({ name: "campo.svg", mimeType: "image/svg+xml", buffer: foto });
    await expect(
      control.getByRole("img", { name: "Foto de campo para el fondo completo" }),
    ).toBeVisible();
    await page.getByLabel("Encuadre horizontal", { exact: true }).fill("0.3");
    await page.getByLabel("Encuadre vertical", { exact: true }).fill("0.7");
    for (const campo of ["Subir foto del campo", "Encuadre horizontal", "Encuadre vertical"]) {
      const c = await page.getByLabel(campo, { exact: true }).boundingBox();
      expect(Math.round(c!.height)).toBeGreaterThanOrEqual(44);
    }
    await control.getByRole("button", { name: "Quitar foto de fondo", exact: true }).tap();
    await expect(control.getByRole("img")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    // No «Ver historia»: puede guardar la alineación. No generar ni guardar en base real.
  });
  test(`convocatoria: hora y lugar de quedada editables sin desplegar a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto("/admin/convocatoria");
    const hora = page.getByLabel("Hora de quedada", { exact: true });
    const lugar = page.getByLabel("Lugar de quedada", { exact: true });
    await expect(hora).toBeVisible({ timeout: 30000 });
    await expect(lugar).toBeVisible();
    await hora.fill("16:00");
    await lugar.fill("Entrada do campo");
    await expect(hora).toHaveValue("16:00");
    await expect(lugar).toHaveValue("Entrada do campo");
    expect(Math.round((await hora.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    expect(await hora.evaluate((n) => getComputedStyle(n).fontSize)).toBe("16px");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    // Solo edición del borrador: no Guardar, Ver cartel ni Pasar a alineación.
  });
}
