import { expect, test } from "@playwright/test";

for (const ancho of [360, 1280]) {
  test(`archivo ordenado a ${ancho} px: trayectoria, temporadas y detalle`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: ancho, height: 780 });
    // Ninguna petición del navegador sale del servidor de prueba.
    await page.route("**/*", (route) =>
      new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort(),
    );
    await page.goto("/admin/archivo?categoria=Senior");
    // Sin resumen arriba: las temporadas plegables ya lo cuentan todo.
    await expect(page.getByRole("region", { name: "Trayectoria", exact: true })).toHaveCount(0);
    const temporada = page
      .locator("details")
      .filter({ has: page.locator(":scope > summary", { hasText: "2023-2024" }) });
    const anterior = page
      .locator("details")
      .filter({ has: page.locator(":scope > summary", { hasText: "2022-2023" }) });
    await expect(temporada).toHaveAttribute("open", "");
    await expect(anterior).not.toHaveAttribute("open");
    await expect(temporada).toContainText("La federación no publica clasificación");
    await expect(temporada).not.toContainText("jugadores con cifras");
    await expect(temporada).not.toContainText("Todos traídos");
    const detalles = temporada.locator("details");
    await expect(detalles.last().locator("summary")).toContainText("Copa do Sar");
    await expect(detalles.nth(2).locator("summary")).toContainText("Liga sin tabla");
    const liga = detalles.filter({ hasText: "Grupo ficticio 1" });
    await expect(liga.locator("summary")).toContainText(
      "6.º · 34 puntos · PJ 26 · G 10 · E 4 · P 12 · GF 31 · GC 35",
    );
    await liga.locator("summary").click();
    const tabla = liga.getByRole("table");
    await expect(tabla).toBeVisible();
    await expect(tabla.locator("tbody tr")).toHaveCount(12);
    await expect(tabla.getByRole("columnheader")).toHaveText(
      ancho < 600
        ? ["Pos", "Equipo", "Pts", "PJ", "DG"]
        : ["Pos", "Equipo", "Pts", "PJ", "DG", "G", "E", "P", "GF", "GC"],
    );
    await expect(tabla.locator('tr[data-propio="true"] td').nth(3)).toHaveText("-4");
    const caja = liga.getByRole("region", { name: /^Tabla final/ });
    expect(await caja.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(tabla.locator('tr[data-propio="true"]')).toContainText("U.D. Santiso");
    await expect(liga.getByText("U.D. Santiso – Antigo Rival Ficticio")).toBeVisible();
    await expect(liga.getByRole("button", { name: /^Traer/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await page.screenshot({
      path: testInfo.outputPath(`archivo-detalle-${ancho}.png`),
      fullPage: true,
    });
    await liga.locator("summary").click();
    const copa = detalles.filter({ hasText: "Copa do Sar" });
    await expect(copa.locator("summary")).toContainText("Llegó a Octavos");
    await expect(copa.getByRole("button")).not.toBeVisible();
    await copa.locator("summary").click();
    await expect(
      copa.getByRole("button", { name: "Traer los partidos de esta temporada", exact: true }),
    ).toHaveCount(1);
    await expect(copa.getByRole("button")).toBeVisible();
    await copa.locator("summary").click();
    await temporada.locator(":scope > summary").click();
    await expect(detalles.first().locator("summary")).not.toBeVisible();
    await temporada.locator(":scope > summary").click();
    await anterior.locator(":scope > summary").click();
    await anterior.locator("details > summary").click();
    await expect(
      anterior.getByRole("button", { name: "Traer los partidos de esta temporada", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
    await anterior.locator(":scope > summary").click();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.screenshot({ path: testInfo.outputPath(`archivo-${ancho}.png`), fullPage: true });
    await page.goto("/admin/archivo?categoria=Veteranos");
    // Cada categoría, sus temporadas: Veteranos no enseña la copa del Senior.
    await expect(page.getByText("Liga Veterana Ficticia").first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Copa do Sar")).toHaveCount(0);
  });
}
