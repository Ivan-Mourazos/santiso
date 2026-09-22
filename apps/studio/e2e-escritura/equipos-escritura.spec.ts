import { expect, test, type Page } from "@playwright/test";

const fila = (page: Page, nombre: string) =>
  page.getByRole("row").filter({ has: page.getByText(nombre, { exact: true }) });
async function abrir(page: Page) {
  await page.goto("/admin/equipos?categoria=Senior");
  await expect(page.getByLabel("Competición", { exact: true })).toHaveValue(/.+/);
  await expect(page.getByRole("table", { name: "Equipos Senior" })).toBeVisible();
}

test("crear, editar, quitar, reincorporar y eliminar sin duplicar el equipo", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Crear equipo", exact: true }).click();
  let editor = page.getByRole("dialog", { name: "Crear equipo" });
  await editor.getByLabel("Nombre del equipo").fill("Nuevo Ficticio");
  await editor.getByRole("button", { name: "Crear equipo", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Nuevo Ficticio")).toHaveCount(1);
  await page.getByRole("button", { name: "Editar a Nuevo Ficticio", exact: true }).click();
  editor = page.getByRole("dialog", { name: "Editar a Nuevo Ficticio" });
  await editor.getByLabel("Nombre del equipo").fill("Nuevo Corregido");
  await editor.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(editor).toBeHidden();
  await page
    .getByRole("button", { name: "Quitar Nuevo Corregido de Liga 26/27", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar quitar" }).click();
  await expect(fila(page, "Nuevo Corregido")).toHaveCount(0);
  await page.getByRole("button", { name: "Añadir a competición", exact: true }).click();
  const incorporar = page.getByRole("dialog", { name: "Añadir a Liga 26/27" });
  await incorporar.getByLabel("Buscar equipo existente").fill("Nuevo Corregido");
  await incorporar.getByRole("radio", { name: /Nuevo Corregido/ }).check();
  await incorporar.getByRole("button", { name: "Añadir equipo", exact: true }).click();
  await expect(incorporar).toBeHidden();
  await expect(fila(page, "Nuevo Corregido")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Eliminar Nuevo Corregido de biblioteca", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar eliminar" }).click();
  await page.getByRole("button", { name: "Biblioteca de Senior", exact: true }).click();
  await expect(fila(page, "Nuevo Corregido")).toHaveCount(0);
});

test("homónimos muestran categoría y competiciones antes de incorporar", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Añadir a competición", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Añadir a Liga 26/27" });
  await dialogo.getByLabel("Buscar equipo existente").fill("rio");
  const senior = dialogo.getByRole("radio", { name: /Río Ficticio · Senior/ });
  const veterano = dialogo.getByRole("radio", { name: /Río Ficticio · Veteranos/ });
  await expect(senior).toBeEnabled();
  await expect(veterano).toBeDisabled();
  await expect(dialogo).toContainText("Liga 25/26 · 2025/26");
  await expect(dialogo).toContainText("Liga Veteranos · 2026/27");
  await senior.check();
  await dialogo.getByRole("button", { name: "Añadir equipo", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(fila(page, "Río Ficticio")).toHaveCount(1);
});

test("un equipo con partidos ofrece quitar y conserva el historial", async ({ page }) => {
  await abrir(page);
  await page
    .getByRole("button", { name: "Revisar baja de Histórico Ficticio", exact: true })
    .click();
  const dialogo = page.getByRole("dialog", { name: "Equipo con partidos" });
  await expect(dialogo).toContainText("1 partido");
  await expect(dialogo.getByRole("button", { name: "Confirmar eliminar" })).toHaveCount(0);
  await dialogo.getByRole("button", { name: "Quitar de esta competición" }).click();
  await expect(page.getByRole("dialog")).toContainText("El equipo y sus partidos se conservan");
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();
  await expect(fila(page, "Histórico Ficticio")).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar baja de Histórico Ficticio", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Quitar de esta competición" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar quitar" }).click();
  await expect(fila(page, "Histórico Ficticio")).toHaveCount(0);
  await page.getByRole("button", { name: "Biblioteca de Senior", exact: true }).click();
  await expect(fila(page, "Histórico Ficticio")).toContainText("1 partido");
});

test("fallo de guardado conserva nombre y escudo y permite reintentar", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Crear equipo", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Crear equipo" });
  await editor.getByRole("button", { name: "Crear equipo", exact: true }).click();
  await expect(editor.getByText("El nombre es obligatorio.")).toBeVisible();
  await editor.getByLabel("Nombre del equipo").fill("Escudo Ficticio");
  const sharp = (await import("sharp")).default;
  const imagen = await sharp({
    create: { width: 30, height: 30, channels: 4, background: "#facc15" },
  })
    .png()
    .toBuffer();
  await editor
    .getByLabel("Escudo del equipo")
    .setInputFiles({ name: "escudo.png", mimeType: "image/png", buffer: imagen });
  await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/equipos**", async (route) => {
    if (!route.request().headers()["next-action"]) return route.continue();
    await gate;
    await route.abort();
  });
  try {
    await editor.getByRole("button", { name: "Crear equipo", exact: true }).click();
    await expect(editor.getByLabel("Nombre del equipo")).toBeDisabled();
    await expect(editor.getByLabel("Escudo del equipo")).toBeDisabled();
    await expect(editor.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  } finally {
    release();
  }
  await expect(editor.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(editor.getByLabel("Nombre del equipo")).toHaveValue("Escudo Ficticio");
  await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);
  await page.unroute("**/admin/equipos**");
  await editor.getByRole("button", { name: "Crear equipo", exact: true }).click();
  await expect(editor).toBeHidden();
  await expect(fila(page, "Escudo Ficticio")).toHaveCount(1);
  await expect(fila(page, "Escudo Ficticio").getByRole("img")).toHaveAttribute("src", /^\/media\//);
});

test("conserva crear y eliminar competición, y rechaza borrar una con jornadas", async ({
  page,
}) => {
  await abrir(page);
  await page.getByRole("button", { name: "Crear competición", exact: true }).click();
  let dialogo = page.getByRole("dialog", { name: "Crear competición" });
  await dialogo.getByLabel("Nombre de la competición").fill("Copa Ficticia");
  await dialogo.getByLabel("Formato").selectOption("eliminatoria");
  await dialogo.getByRole("button", { name: "Crear competición", exact: true }).click();
  await expect(dialogo).toBeHidden();
  await expect(
    page.getByLabel("Competición", { exact: true }).locator("option:checked"),
  ).toHaveText("Copa Ficticia");
  await page.getByLabel("Competición", { exact: true }).selectOption({ label: "Liga 26/27" });
  await page.getByRole("button", { name: "Eliminar competición", exact: true }).click();
  dialogo = page.getByRole("dialog", { name: "Eliminar competición" });
  await dialogo.getByRole("button", { name: "Confirmar eliminar competición" }).click();
  await expect(dialogo.getByRole("alert")).toContainText("tiene jornadas");
  await dialogo.getByRole("button", { name: "Cancelar" }).click();
  await page.getByLabel("Competición", { exact: true }).selectOption({ label: "Copa Ficticia" });
  await page.getByRole("button", { name: "Eliminar competición", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Confirmar eliminar competición" })
    .click();
  await expect(
    page.getByLabel("Competición", { exact: true }).locator("option:checked"),
  ).toHaveText("Liga 26/27");
  await expect(page.getByLabel("Competición", { exact: true }).locator("option")).toHaveCount(1);
});

test("crear competición protege el borrador incluso durante una petición pendiente", async ({
  page,
}) => {
  await page.goto("/admin/temporadas");
  await abrir(page);
  await page.getByRole("button", { name: "Crear competición", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Crear competición" });
  await dialogo.getByLabel("Nombre de la competición").fill("Borrador competición");
  let liberar!: () => void;
  const espera = new Promise<void>((resolve) => {
    liberar = resolve;
  });
  await page.route("**/admin/equipos**", async (route) => {
    if (!route.request().headers()["next-action"]) return route.continue();
    await espera;
    await route.abort();
  });
  try {
    await dialogo.getByRole("button", { name: "Crear competición", exact: true }).click();
    await expect(dialogo.getByLabel("Nombre de la competición")).toBeDisabled();
    let avisos = 0;
    page.on("dialog", async (aviso) => {
      avisos++;
      await aviso.dismiss();
    });
    await page.evaluate(() => window.history.back());
    await expect.poll(() => avisos).toBe(1);
    await expect(dialogo).toBeVisible();
  } finally {
    liberar();
  }
  await expect(dialogo.getByRole("alert")).toContainText("No se pudo completar");
  await expect(dialogo.getByLabel("Nombre de la competición")).toHaveValue("Borrador competición");
});
