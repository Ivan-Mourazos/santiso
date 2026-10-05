import { expect, test } from "@playwright/test";

/**
 * Multas del club sobre la base de juguete: las normas se cargan solas la primera vez y la
 * gente sale de la plantilla sembrada («Aliñación Ficticio», Veteranos).
 */
test("poner una multa por prendas, cobrarla y verla en el bote", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/multas");
  const alta = page.getByRole("form", { name: "Nueva multa" });
  await expect(alta).toBeVisible({ timeout: 30000 });

  await alta.getByLabel("A quién").selectOption({ label: "Uno Aliñación Ficticio · Veteranos · 1" });
  await alta.getByLabel("Motivo", { exact: true }).selectOption({
    label: "Non traer material — 1,00 €",
  });
  // Las prendas se marcan; cada una suma su importe.
  await alta.getByRole("button", { name: "Peto", exact: true }).click();
  await alta.getByRole("button", { name: "Medias 1ª", exact: true }).click();
  await expect(alta.getByLabel("Importe (€)")).toHaveValue("2,00");
  await alta.getByRole("button", { name: "Poner multa" }).click();
  await expect(page.getByText("Multa apuntada")).toBeVisible();

  const multas = page.getByRole("list", { name: "Multas" });
  const fila = multas.getByRole("listitem").filter({ hasText: "Uno Aliñación Ficticio" });
  await expect(fila).toContainText("Non traer material: Peto, Medias 1ª");
  await expect(fila).toContainText("2,00 €");

  // Cobrada: sale de «Pendientes» y entra en el bote.
  await fila.getByRole("button", { name: /^Cobrar a/ }).click();
  await expect(multas).toHaveCount(0);
  await page.getByRole("tab", { name: "Bote" }).click();
  await expect(page.getByText("en el bote (cobrado)").locator("..")).toContainText("2,00 €");
  await expect(page.getByRole("table", { name: "Multas por persona" })).toContainText(
    "Uno Aliñación Ficticio",
  );

  // Un motivo que no está en las normas: se escribe, con su importe.
  await page.getByRole("tab", { name: "Multas", exact: true }).click();
  await alta.getByLabel("A quién").selectOption({ label: "Dous Aliñación Ficticio (Dous) · Veteranos · 2" });
  await alta.getByLabel("Motivo", { exact: true }).selectOption({ label: "Otro motivo (escribirlo)…" });
  await alta.getByLabel("Motivo de la multa").fill("Non poñer bote no bar");
  await alta.getByLabel("Importe (€)").fill("2,5");
  await alta.getByRole("button", { name: "Poner multa" }).click();
  await expect(
    page.getByRole("list", { name: "Multas" }).getByRole("listitem").filter({ hasText: "Dous" }),
  ).toContainText("Non poñer bote no bar");

  // Las normas del club están cargadas y se pueden ampliar.
  await page.getByRole("tab", { name: "Normas" }).click();
  await expect(page.getByLabel("Nombre: Non ir no bus")).toHaveValue("Non ir no bus");
  expect(errores).toEqual([]);
});
