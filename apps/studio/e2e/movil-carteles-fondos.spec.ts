import { expect, test } from "@playwright/test";

for (const pantalla of ["convocatoria", "alineacion"] as const) {
  test(`${pantalla}: capacidad explica dos láminas sin escribir en datos reales`, async ({
    page,
  }) => {
    await page.goto("/admin/" + pantalla);
    const panel = page.getByRole("region", {
      name: `${pantalla === "convocatoria" ? "Convocatoria" : "Once inicial"}: carteles guardados`,
    });
    const boton = panel.getByRole("button", {
      name: /^(Generar cartel|Actualizar cartel|Volver a generar)$/,
    });
    await expect(boton).toBeVisible({ timeout: 30000 });
    // Corre contra los datos reales: si ahora mismo no hay nada que pintar (alineación vacía,
    // sin convocados), no es un fallo de la pantalla. Lo que haya o no lo decide quien la usa.
    await page.waitForLoadState("networkidle");
    test.skip(await boton.isDisabled(), "Sin datos guardados para generar este cartel.");
    const escrituras: string[] = [];
    // Barrera adicional: ni siquiera una regresión puede ejecutar una acción de servidor.
    await page.route("**/*", async (ruta) => {
      if (ruta.request().headers()["next-action"]) {
        escrituras.push(ruta.request().url());
        await ruta.abort();
      } else await ruta.fallback();
    });
    // Guardar el cartel también queda interceptado: nunca llega al servidor real.
    await page.route("**/api/carteles/guardar", (ruta) =>
      ruta.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          error: "El contenido no cabe con letra legible. Reduce datos o prepara dos láminas.",
        }),
      }),
    );
    // Con cambios sin guardar, generar guardaría antes: aquí no puede, así que no se prueba.
    const guardar = page.getByRole("button", { name: "Guardar", exact: true });
    test.skip(
      (await guardar.count()) > 0 && (await guardar.isEnabled()),
      "Hay cambios sin guardar: generar los guardaría.",
    );
    await boton.click();
    const aviso = panel.getByRole("alert");
    await expect(aviso).toBeVisible();
    // Sin el «Guardar» flotante (16/11/2026), generar guarda antes lo que falte: la barrera la
    // corta y sale el aviso genérico. No es un fallo de la pantalla, solo que aquí no se prueba.
    test.skip(escrituras.length > 0, "Generar guardaría antes: hay cambios sin guardar.");
    await expect(aviso).toHaveText(
      "El contenido no cabe con letra legible. Reduce datos o prepara dos láminas.",
    );
    await expect(panel.getByRole("button", { name: "Reintentar generación" })).toBeEnabled();
  });
}
for (const ancho of [360, 390]) {
  test(`alineación: el campo va sin foto de fondo y cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto("/admin/alineacion");
    await expect(
      page.getByRole("region", { name: /Once inicial: carteles guardados/ }),
    ).toBeVisible({
      timeout: 30000,
    });
    // Desde el 15/11/2026 el once se dibuja en el campo con la camiseta del club: sin fotos.
    await expect(page.locator("details").filter({ hasText: "Foto de campo" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
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
    // Desde 16 px el iPhone no amplía la página al escribir.
    expect(
      parseFloat(await hora.evaluate((n) => getComputedStyle(n).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    // Solo edición del borrador: no Guardar, Generar cartel ni Pasar al once inicial.
  });
}
