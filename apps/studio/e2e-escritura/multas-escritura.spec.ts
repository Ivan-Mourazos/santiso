import { expect, test } from "@playwright/test";

/**
 * Multas del club sobre la base de juguete: las normas se cargan solas la primera vez y la
 * gente sale de la plantilla sembrada («Aliñación Ficticio», Senior).
 */
test.use({ viewport: { width: 360, height: 800 } });

test("poner una multa, cobrarla y gestionar gastos del bote a 360 px", async ({
  page,
}, testInfo) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/multas");
  await page.getByRole("button", { name: "Nueva multa", exact: true }).click();
  const alta = page.getByRole("form", { name: "Nueva multa" });
  await expect(alta).toBeVisible({ timeout: 30000 });

  await alta.getByLabel("A quién").selectOption({ label: "Uno Aliñación Ficticio · Senior · 1" });
  await alta.getByLabel("Motivo", { exact: true }).selectOption({
    label: "Non traer material — 1,00 €",
  });
  // Las prendas se marcan; cada una suma su importe.
  await alta.getByRole("button", { name: "Peto", exact: true }).click();
  await alta.getByRole("button", { name: "Medias 1ª", exact: true }).click();
  await expect(alta.getByLabel("Importe (€)")).toHaveValue("2,00");
  await alta.getByRole("button", { name: "Poner multa" }).click();
  await expect(page.getByText("Multa apuntada")).toBeVisible();

  await page.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
  const multas = page.getByRole("list", { name: "Multas" });
  const fila = multas.getByRole("listitem").filter({ hasText: "Uno Aliñación Ficticio" });
  await expect(fila).toContainText("Non traer material: Peto, Medias 1ª");
  await expect(fila).toContainText("2,00 €");

  // Cobrada: sale de «Pendientes» y entra en el bote.
  await fila.getByRole("button", { name: /^Cobrar a/ }).click();
  await expect(multas).toHaveCount(0);
  await page.getByRole("tab", { name: "Bote" }).click();
  const caja = page.getByText("En caja", { exact: true }).locator("..");
  await expect(caja).toContainText("2,00 €");
  await page.getByRole("button", { name: "Anotar gasto", exact: true }).click();
  const gasto = page.getByRole("form", { name: "Gasto del bote" });
  await gasto.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(gasto.getByRole("alert")).toContainText("motivo");
  await gasto.getByLabel("Motivo", { exact: true }).fill("Material para entrenar");
  await gasto.getByLabel("Importe (€)").fill("0");
  await gasto.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(gasto.getByRole("alert")).toContainText("importe");
  await gasto.getByLabel("Importe (€)").fill("1,50");
  await gasto.getByLabel("Nota (opcional)").fill("Compra de petos");
  await gasto.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(caja).toContainText("0,50 €");
  const movimientos = page.getByRole("list", { name: "Movimientos" });
  await expect(movimientos).toContainText("-1,50 €");
  await expect(movimientos).toContainText("+2,00 €");
  await page.getByRole("button", { name: "Editar gasto: Material para entrenar" }).click();
  await gasto.getByLabel("Importe (€)").fill("3");
  await gasto.getByRole("button", { name: "Guardar gasto" }).click();
  await expect(caja).toContainText("-1,00 €");
  await expect(page.getByText("Se ha gastado más de lo cobrado")).toBeVisible();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    for (const elemento of document.querySelectorAll("*")) {
      if (elemento.scrollTop) elemento.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByText("Gasto guardado", { exact: true })).toBeHidden({ timeout: 10000 });
  await page.setViewportSize({ width: 360, height: 1100 });
  await page.screenshot({ path: testInfo.outputPath("bote-360.png"), fullPage: true });
  await page.getByRole("button", { name: "Borrar gasto: Material para entrenar" }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(caja).toContainText("-1,00 €");
  await page.getByRole("button", { name: "Borrar gasto: Material para entrenar" }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(caja).toContainText("2,00 €");
  await expect(movimientos.getByText("Material para entrenar")).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Multas por persona" })).toContainText(
    "Uno Aliñación Ficticio",
  );

  // Un motivo que no está en las normas: se escribe, con su importe.
  await page.getByRole("tab", { name: "Multas", exact: true }).click();
  await page.getByRole("button", { name: "Nueva multa", exact: true }).click();
  await alta
    .getByLabel("A quién")
    .selectOption({ label: "Dous Aliñación Ficticio (Dous) · Senior · 2" });
  await alta
    .getByLabel("Motivo", { exact: true })
    .selectOption({ label: "Otro motivo (escribirlo)…" });
  await alta.getByLabel("Motivo de la multa").fill("Non poñer bote no bar");
  await alta.getByLabel("Importe (€)").fill("2,5");
  await alta.getByRole("button", { name: "Poner multa" }).click();
  await page.getByRole("button", { name: "Cerrar diálogo", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Multas" }).getByRole("listitem").filter({ hasText: "Dous" }),
  ).toContainText("Non poñer bote no bar");

  // Las normas del club están cargadas y se pueden ampliar.
  await page.getByRole("tab", { name: "Normas" }).click();
  await expect(page.getByLabel("Nombre: Non ir no bus")).toHaveValue("Non ir no bus");
  expect(errores).toEqual([]);
});

test("bote y formulario de gasto en escritorio desde 1280 × 720", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin/multas");
  await page.getByRole("tab", { name: "Bote" }).click();
  await expect(page.getByText("En caja", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Movimientos" })).toContainText("+2,00 €");
  await page.getByRole("button", { name: "Anotar gasto", exact: true }).click();
  await expect(page.getByRole("form", { name: "Gasto del bote" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
