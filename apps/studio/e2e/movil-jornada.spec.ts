import { expect, test } from "@playwright/test";

for (const ancho of [360, 390]) {
  test(`jornada: una tarea visible y contexto de ambos equipos a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: ancho === 360 ? 780 : 844 });
    await page.goto("/admin/jornada");
    const mesa = page.locator("[data-mesa-partido]");
    await expect(mesa).toBeVisible({ timeout: 30000 });
    const principal = page.locator("[data-accion-principal]");
    await expect(principal).toHaveCount(1);
    const caja = (await principal.boundingBox())!;
    expect(caja.y + caja.height).toBeLessThanOrEqual(650);
    await page.getByRole("button", { name: "Veteranos", exact: true }).tap();
    await expect(page.getByRole("region", { name: "Veteranos", exact: true })).toBeVisible();
    await expect(principal).toHaveCount(1);
    await mesa.getByText("Más tareas del partido", { exact: true }).tap();
    const medidas = await page
      .locator("main a:visible, main button:visible, main summary:visible")
      .evaluateAll((ns) =>
        ns.map((n) => ({
          nombre: n.textContent,
          alto: Math.round(n.getBoundingClientRect().height),
        })),
      );
    expect(medidas.filter((m) => m.alto < 44)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
  test(`jornada: cierre del último y panel Federación caben a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 780 });
    await page.goto("/admin/jornada");
    const ultimo = page.getByRole("region", { name: "Último partido", exact: true });
    await expect(ultimo).toBeVisible({ timeout: 30000 });
    await ultimo.getByRole("button", { name: "Acta y publicaciones" }).tap();
    await expect(page.locator("[data-mesa-partido]")).toHaveAttribute("data-fase", "despues");
    await expect(page.locator("[data-accion-principal]")).toHaveCount(1);
    // La federación en Jornada solo avisa y lleva a su sección; no se trae nada desde aquí.
    const federacion = page.getByRole("region", { name: "Federación", exact: true });
    if ((await federacion.count()) > 0) {
      await expect(federacion.getByRole("button", { name: "Comprobar ahora" })).toHaveCount(0);
      await expect(
        federacion.getByRole("link", { name: "Ver qué hay traído y traer lo que falte" }),
      ).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
}
