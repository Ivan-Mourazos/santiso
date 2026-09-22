import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Catálogo único de patrocinadores y logos, contra la base de datos real. **Solo lectura**:
 * abre el editor y lo cierra sin guardar. Las escrituras van en `e2e-escritura`.
 */
test("el catálogo reúne patrocinadores y logos, con búsqueda y filtros", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/patrocinadores");
  const tabla = page.getByRole("table", { name: "Patrocinadores y logos" });
  await expect(tabla).toBeVisible({ timeout: 20000 });

  // Los logos de cartel ya no viven en una pantalla aparte: están en esta lista.
  const contador = page.getByRole("status").filter({ hasText: "fichas" }).first();
  const total = await contador.textContent();
  await page.getByLabel("Mostrar", { exact: true }).selectOption("en-carteles");
  await expect(contador).not.toHaveText(total ?? "");
  const enCarteles = await tabla.getByRole("row").count();
  expect(enCarteles).toBeGreaterThan(1);

  await page.getByLabel("Buscar", { exact: true }).fill("zzzz-nadie");
  await expect(page.getByText("Ninguna ficha coincide con la búsqueda.")).toBeVisible();
  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await expect(contador).toHaveText(total ?? "");

  // La barra del cartel dice qué se va a ver y en qué orden.
  await expect(page.getByRole("heading", { name: "Barra del cartel" })).toBeVisible();

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("el editor avisa antes de pisar una ficha con el mismo nombre", async ({ page }) => {
  await page.goto("/admin/patrocinadores");
  const tabla = page.getByRole("table", { name: "Patrocinadores y logos" });
  await expect(tabla).toBeVisible({ timeout: 20000 });
  const existente = (await tabla.getByRole("row").nth(1).getByRole("cell").nth(1).innerText())
    .split("\n")[0]!
    .trim();

  await page.getByRole("button", { name: "Añadir patrocinador o logo" }).click();
  const editor = page.getByRole("dialog", { name: "Nuevo patrocinador o logo" });
  await editor.getByLabel("Nombre", { exact: true }).fill(existente.toUpperCase());
  await editor.getByRole("button", { name: "Añadir", exact: true }).click();

  await expect(editor.getByRole("alert")).toContainText("Ya existe");
  await expect(editor.getByRole("alert")).toContainText("siguen como estaban");

  page.once("dialog", (d) => d.accept());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(editor).toBeHidden();
});
