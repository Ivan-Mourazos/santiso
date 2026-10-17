import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("guardar convocatoria, generar y guardar su cartel, y pasar convocados al once", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const ruta = "/admin/convocatoria?partido=convocatoria-e2e";
  await page.goto(ruta);
  await expect(page.getByText("3 convocados / 3")).toBeVisible({ timeout: 30000 });
  const plantilla = page.getByRole("list", { name: "Plantilla Senior" });
  await plantilla.getByRole("button", { name: "Convocar: Tres Aliñación Ficticio" }).click();
  await page.getByLabel("Hora de quedada", { exact: true }).fill("16:00");
  await page.getByLabel("Lugar de quedada", { exact: true }).fill("Campo Calendario");
  await page.getByLabel("Equipación", { exact: true }).fill("Amarela");
  await page.getByLabel("Nota", { exact: true }).fill("Puntualidade");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Convocatoria guardada", { exact: true })).toBeVisible();
  await page.goto(ruta);
  await expect(page.getByText("2 convocados / 3")).toBeVisible({ timeout: 30000 });
  await expect(page.getByLabel("Hora de quedada", { exact: true })).toHaveValue("16:00");
  await expect(page.getByLabel("Lugar de quedada", { exact: true })).toHaveValue(
    "Campo Calendario",
  );
  await expect(page.getByLabel("Equipación", { exact: true })).toHaveValue("Amarela");
  await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Puntualidade");
  // Generar guarda la convocatoria y el cartel; al volver sigue ahí, sin regenerar.
  const panel = page.getByRole("region", { name: "Convocatoria: carteles guardados" });
  await expect(panel.getByText("Todavía sin generar.")).toBeVisible();
  await panel.getByRole("button", { name: "Generar cartel", exact: true }).click();
  // Sin miniatura: «Ver» lo abre en grande.
  await panel.getByRole("button", { name: "Ver en grande: Publicación" }).click({ timeout: 60000 });
  const cartel = page.getByRole("dialog").getByRole("img", { name: "Convocatoria · Publicación" });
  await expect(cartel).toBeVisible();
  await expect(cartel).toHaveJSProperty("complete", true);
  expect(
    await cartel.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([2160, 2700]);
  await page.getByRole("button", { name: "Cerrar diálogo" }).click();
  await expect(
    panel.getByRole("button", { name: "Guardar o compartir: Publicación", exact: true }),
  ).toBeVisible();
  await page.goto(ruta);
  await expect(panel.getByText(/^✓ Generado/)).toBeVisible({ timeout: 30000 });
  await expect(panel.getByRole("button", { name: "Ver en grande: Publicación" })).toBeVisible();
  // Cambiar un dato que sale en el cartel lo deja desactualizado, pero se conserva el anterior.
  await page.getByLabel("Hora de quedada", { exact: true }).fill("16:30");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Convocatoria guardada", { exact: true })).toBeVisible();
  await page.goto(ruta);
  await expect(panel.getByText(/Han cambiado los datos/)).toBeVisible({ timeout: 30000 });
  await expect(panel.getByRole("button", { name: "Actualizar cartel", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Ver en grande: Publicación" })).toBeVisible();
  await page.getByRole("button", { name: "Pasar al once inicial", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/alineacion\?.*partido=convocatoria-e2e/);
  const ali = page.getByRole("list", { name: "Plantilla Senior" });
  await expect(ali.getByRole("button", { name: /^Uno Aliñación Ficticio:/ })).toBeVisible({
    timeout: 30000,
  });
  await expect(ali.getByRole("button", { name: /^Dous:/ })).toBeVisible();
  await expect(ali.getByRole("button", { name: /^Tres Aliñación Ficticio:/ })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("guardado pendiente no redirige tras abandonar convocatoria", async ({ page }) => {
  await page.goto("/admin/convocatoria?partido=convocatoria-e2e");
  const lista = page.getByRole("list", { name: "Plantilla Senior" });
  await expect(lista).toBeVisible({ timeout: 30000 });
  await lista.getByRole("button", { name: "Convocar: Tres Aliñación Ficticio" }).click();
  let anunciar!: () => void;
  let liberar!: () => void;
  let completar!: () => void;
  const recibida = new Promise<void>((r) => {
    anunciar = r;
  });
  const espera = new Promise<void>((r) => {
    liberar = r;
  });
  const entregada = new Promise<void>((r) => {
    completar = r;
  });
  await page.route("**/admin/convocatoria?**", async (route) => {
    if (route.request().method() !== "POST" || !route.request().headers()["next-action"])
      return route.continue();
    const respuesta = await route.fetch();
    anunciar();
    await espera;
    await route.fulfill({ response: respuesta });
    completar();
  });
  await page.getByRole("button", { name: "Guardar y pasar al once inicial", exact: true }).click();
  await recibida;
  page.once("dialog", (d) => d.accept());
  await page.getByRole("link", { name: "Jornada", exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/jornada/);
  liberar();
  await entregada;
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/admin\/jornada/);
});

test("avisa de expulsados y apercibidos al convocar y al alinear", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/admin/convocatoria?partido=convocatoria-e2e");
  const avisos = page.getByRole("region", { name: "Sanciones y apercibidos" });
  await expect(avisos).toBeVisible({ timeout: 30000 });
  await expect(avisos.getByText("ALIÑACIÓN FICTICIO, UNO")).toBeVisible();
  await expect(avisos.getByText("ALIÑACIÓN FICTICIO, TRES")).toBeVisible();
  // Los nombres de la federación se reconocen en la plantilla: la marca sale junto al jugador.
  const plantilla = page.getByRole("list", { name: "Plantilla Senior" });
  const uno = plantilla.getByRole("button", { name: "Convocar: Uno Aliñación Ficticio, expulsado" });
  await expect(uno).toContainText("Expulsado");
  await expect(
    plantilla.getByRole("button", { name: "Convocar: Tres Aliñación Ficticio, apercibido" }),
  ).toContainText("Apercibido");
  await expect(plantilla.getByRole("button", { name: "Convocar: Dous", exact: true })).toBeVisible();

  await page.goto("/admin/alineacion?partido=convocatoria-e2e");
  await expect(page.getByRole("region", { name: "Sanciones y apercibidos" })).toBeVisible({
    timeout: 30000,
  });
  await expect(
    page
      .getByRole("list", { name: "Plantilla Senior" })
      .getByRole("button", { name: /^Uno Aliñación Ficticio: .*, expulsado$/ }),
  ).toContainText("Expulsado");
  expect(errores).toEqual([]);
});
