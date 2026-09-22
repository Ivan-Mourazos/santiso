import { expect, test, type Page } from "@playwright/test";

/**
 * Catálogo único de patrocinadores y logos (6D), escribiendo de verdad sobre la base de datos
 * de juguete de `sembrar.ts`. Las pruebas van en orden y comparten estado: es un recorrido.
 */
test.describe.configure({ mode: "serial" });

const fila = (page: Page, nombre: string) =>
  page.getByRole("row").filter({ has: page.getByText(nombre, { exact: true }) });

const barra = (page: Page) => page.getByRole("list", { name: "Orden de los logos" });

async function abrir(page: Page) {
  await page.goto("/admin/patrocinadores");
  await expect(page.getByRole("table", { name: "Patrocinadores y logos" })).toBeVisible({
    timeout: 30000,
  });
}

test("alta nueva y nombre repetido que no pisa la ficha existente", async ({ page }) => {
  await abrir(page);

  await page.getByRole("button", { name: "Añadir patrocinador o logo" }).click();
  const alta = page.getByRole("dialog", { name: "Nuevo patrocinador o logo" });
  await alta.getByLabel("Nombre").fill("Talleres Ficticio");
  await alta.getByLabel("Web").fill("https://example.test/talleres");
  await alta.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(alta).toBeHidden();
  await expect(fila(page, "Talleres Ficticio")).toContainText("No");

  // Mismo nombre que otra ficha, con otras mayúsculas: se avisa y no se escribe nada.
  await page.getByRole("button", { name: "Añadir patrocinador o logo" }).click();
  const repetido = page.getByRole("dialog", { name: "Nuevo patrocinador o logo" });
  await repetido.getByLabel("Nombre").fill("AUTOBUSES FICTICIO");
  await repetido.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(repetido.getByRole("alert")).toContainText("Ya existe «Autobuses Ficticio»");

  page.once("dialog", (dialogo) => void dialogo.accept());
  await repetido.getByRole("button", { name: "Abrir «Autobuses Ficticio»" }).click();

  const existente = page.getByRole("dialog", { name: "Editar «Autobuses Ficticio»" });
  await expect(existente.getByLabel("Web")).toHaveValue("https://example.test/autobuses");
  await existente.getByRole("button", { name: "Cancelar" }).click();
  await expect(existente).toBeHidden();
  await expect(fila(page, "Autobuses Ficticio")).toContainText("No");
});

test("activar mete el logo al final de la barra y las flechas lo colocan", async ({ page }) => {
  await abrir(page);
  await expect(barra(page).getByRole("listitem")).toHaveText([
    /Concello Ficticio/,
    /Deporte Ficticio/,
  ]);

  await page.getByRole("button", { name: "Editar Autobuses Ficticio" }).click();
  const editor = page.getByRole("dialog", { name: "Editar «Autobuses Ficticio»" });
  await editor.getByRole("checkbox", { name: "Mostrar en carteles" }).check();
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editor).toBeHidden();

  await expect(fila(page, "Autobuses Ficticio")).toContainText("Sí");
  await expect(barra(page).getByRole("listitem")).toHaveText([
    /Concello Ficticio/,
    /Deporte Ficticio/,
    /Autobuses Ficticio/,
  ]);

  await page.getByRole("button", { name: "Subir Autobuses Ficticio" }).click();
  await expect(barra(page).getByRole("listitem")).toHaveText([
    /Concello Ficticio/,
    /Autobuses Ficticio/,
    /Deporte Ficticio/,
  ]);
});

test("quitar del cartel conserva la ficha; eliminar la borra entera", async ({ page }) => {
  await abrir(page);

  await page.getByRole("button", { name: "Eliminar Concello Ficticio" }).click();
  const aviso = page.getByRole("dialog", { name: "Eliminar «Concello Ficticio»" });
  await aviso.getByRole("button", { name: "Quitar del cartel sin borrar" }).click();
  await page
    .getByRole("dialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Confirmar" })
    .click();

  await expect(fila(page, "Concello Ficticio")).toContainText("No");
  await expect(barra(page).getByRole("listitem")).toHaveText([
    /Autobuses Ficticio/,
    /Deporte Ficticio/,
  ]);

  await page.getByRole("button", { name: "Eliminar Talleres Ficticio" }).click();
  const borrado = page.getByRole("dialog", { name: "Eliminar «Talleres Ficticio»" });
  await borrado.getByRole("button", { name: "Eliminar del catálogo" }).click();
  await expect(borrado).toBeHidden();
  await expect(fila(page, "Talleres Ficticio")).toHaveCount(0);
});
