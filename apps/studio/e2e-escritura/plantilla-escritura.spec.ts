import { expect, test, type Page } from "@playwright/test";

/**
 * Alta, incorporación, edición y baja de verdad, en el navegador, sobre la base de datos de
 * juguete que siembra `sembrar.ts`. Las pruebas van en orden y comparten estado: es un recorrido.
 */
test.describe.configure({ mode: "serial" });

async function elegirTemporada(page: Page, etiqueta: string) {
  const selector = page.getByLabel("Temporada", { exact: true });
  await expect(selector).toBeVisible({ timeout: 30000 });
  await selector.selectOption({ label: etiqueta });
}

const fila = (page: Page, nombre: string) =>
  page.getByRole("row").filter({ has: page.getByText(nombre, { exact: true }) });

test("2026/27 se construye trayendo de 2025/26 con dorsal nuevo, sin tocar 2025/26", async ({
  page,
}) => {
  await page.goto("/admin/jugadores?categoria=Senior");
  await elegirTemporada(page, "2026/27 (activa)");
  await expect(page.getByText("Todavía no hay jugadores en Senior 2026/27.")).toBeVisible();

  await page.getByRole("button", { name: "Añadir de 2025/26" }).click();
  const dialogo = page.getByRole("dialog", { name: "Añadir de 2025/26" });
  await dialogo.getByRole("checkbox", { name: /Brais Rei Ficticio/ }).check();
  const dorsal = dialogo.getByLabel("Dorsal de Brais Rei Ficticio");
  await expect(dorsal).toHaveValue("9");
  await dorsal.fill("10");
  await dialogo.getByRole("button", { name: "Añadir 1" }).click();
  await expect(dialogo).toBeHidden();

  await expect(fila(page, "Brais Rei Ficticio")).toContainText("10");
  // El otro sigue siendo candidato: no se ha traído.
  await expect(fila(page, "Iago Porteiro Ficticio")).toHaveCount(0);

  // El año anterior no se ha tocado.
  await elegirTemporada(page, "2025/26");
  await expect(fila(page, "Brais Rei Ficticio")).toContainText("9");
});

test("alta, aviso de duplicado, edición y baja de un jugador", async ({ page }) => {
  await page.goto("/admin/jugadores?categoria=Senior");
  await elegirTemporada(page, "2026/27 (activa)");
  await expect(fila(page, "Brais Rei Ficticio")).toBeVisible();

  // Alta de alguien nuevo.
  await page.getByRole("button", { name: "Añadir jugador" }).click();
  let editor = page.getByRole("dialog", { name: /Nuevo jugador/ });
  await editor.getByLabel("Nombre completo").fill("Xan Novo Ficticio");
  await editor.getByLabel("Dorsal").fill("7");
  await editor.getByRole("button", { name: "Añadir jugador" }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Xan Novo Ficticio")).toContainText("7");

  // Alguien que ya existe: avisa antes de duplicarlo, y cancelar no crea nada.
  await page.getByRole("button", { name: "Añadir jugador" }).click();
  editor = page.getByRole("dialog", { name: /Nuevo jugador/ });
  await editor.getByLabel("Nombre completo").fill("Iago Porteiro Ficticio");
  await editor.getByRole("button", { name: "Añadir jugador" }).click();
  await expect(editor.getByText(/Ya existe «Iago Porteiro Ficticio» \(2025\/26\)/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await editor.getByRole("button", { name: "Cancelar" }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Iago Porteiro Ficticio")).toHaveCount(0);

  // Edición: el dorsal cambia solo en esta temporada.
  await page.getByRole("button", { name: "Editar a Xan Novo Ficticio" }).click();
  editor = page.getByRole("dialog", { name: "Editar a Xan Novo Ficticio" });
  await editor.getByLabel("Dorsal").fill("8");
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Xan Novo Ficticio")).toContainText("8");

  // Baja de la temporada.
  await page.getByRole("button", { name: "Quitar a Xan Novo Ficticio de 2026/27" }).click();
  await page
    .getByRole("dialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(fila(page, "Xan Novo Ficticio")).toHaveCount(0);
});

test("el cuerpo técnico nuevo se da de alta y se corrige el cargo", async ({ page }) => {
  await page.goto("/admin/tecnicos?categoria=Senior");
  await elegirTemporada(page, "2026/27 (activa)");
  await expect(page.getByText(/No hay técnicos en Senior en 2026\/27/)).toBeVisible();

  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  let editor = page.getByRole("dialog", { name: /^Nuevo/ });
  await editor.getByLabel("Nombre completo").fill("Pepe Novo Ficticio");
  await editor.getByLabel("Cargo").fill("Entrenador");
  await editor.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Pepe Novo Ficticio")).toContainText("Entrenador");

  await page.getByRole("button", { name: "Editar a Pepe Novo Ficticio (Entrenador)" }).click();
  editor = page.getByRole("dialog", { name: "Editar a Pepe Novo Ficticio" });
  await editor.getByLabel("Cargo").fill("Primer entrenador");
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Pepe Novo Ficticio")).toContainText("Primer entrenador");

  // El entrenador del año pasado sigue en su temporada.
  await elegirTemporada(page, "2025/26");
  await expect(fila(page, "Manuel Adestrador Ficticio")).toContainText("Entrenador");
});

test("un fallo al guardar conserva el borrador y bloquea cambios durante el envío", async ({
  page,
}) => {
  await page.goto("/admin/tecnicos?categoria=Senior");
  await elegirTemporada(page, "2026/27 (activa)");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  const editor = page.getByRole("dialog", { name: /^Nuevo/ });
  await editor.getByLabel("Nombre completo").fill("Borrador Ficticio");
  await editor.getByLabel("Cargo").fill("Delegado");
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route("**/admin/**", async (route) => {
    if (!route.request().headers()["next-action"]) return route.continue();
    await espera;
    await route.abort();
  });
  try {
    await editor.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(editor.getByLabel("Nombre completo")).toBeDisabled();
    await expect(editor.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  } finally {
    liberar();
  }
  await expect(editor.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(editor.getByLabel("Nombre completo")).toHaveValue("Borrador Ficticio");
  await expect(editor.getByLabel("Cargo")).toHaveValue("Delegado");
  await expect(editor.getByRole("button", { name: "Añadir", exact: true })).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await editor.getByRole("button", { name: "Cancelar" }).click();
});
