import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("guardar convocatoria, reabrir, exportar PNG y pasar convocados a alineación", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const ruta = "/admin/convocatoria?categoria=Veteranos&partido=convocatoria-e2e";
  await page.goto(ruta);
  await expect(page.getByText("3 convocados / 3")).toBeVisible({ timeout: 30000 });
  const plantilla = page.getByRole("list", { name: "Plantilla Veteranos" });
  await plantilla.getByRole("button", { name: "Convocar: Tres Aliñación Ficticio" }).click();
  await page.getByText("Datos de la quedada", { exact: true }).click();
  await page.getByLabel("Hora de quedada", { exact: true }).fill("16:00");
  await page.getByLabel("Lugar de quedada", { exact: true }).fill("Campo Calendario");
  await page.getByLabel("Equipación", { exact: true }).fill("Amarela");
  await page.getByLabel("Nota", { exact: true }).fill("Puntualidade");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Convocatoria guardada", { exact: true })).toBeVisible();
  await page.goto(ruta);
  await expect(page.getByText("2 convocados / 3")).toBeVisible({ timeout: 30000 });
  await page.getByText("Datos de la quedada", { exact: true }).click();
  await expect(page.getByLabel("Hora de quedada", { exact: true })).toHaveValue("16:00");
  await expect(page.getByLabel("Lugar de quedada", { exact: true })).toHaveValue(
    "Campo Calendario",
  );
  await expect(page.getByLabel("Equipación", { exact: true })).toHaveValue("Amarela");
  await expect(page.getByLabel("Nota", { exact: true })).toHaveValue("Puntualidade");
  await page.getByRole("button", { name: "Ver cartel", exact: true }).click();
  const cartel = page.getByRole("img", { name: "Cartel de convocatoria" });
  await expect(cartel).toBeVisible({ timeout: 60000 });
  expect(
    await cartel.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight]),
  ).toEqual([2160, 2700]);
  await expect(page.getByRole("button", { name: "Compartir", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await page.getByRole("button", { name: "Pasar a alineación", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/alineacion\?.*partido=convocatoria-e2e/);
  const ali = page.getByRole("list", { name: "Plantilla Veteranos" });
  await expect(ali.getByRole("button", { name: /^Uno Aliñación Ficticio:/ })).toBeVisible({
    timeout: 30000,
  });
  await expect(ali.getByRole("button", { name: /^Dous:/ })).toBeVisible();
  await expect(ali.getByRole("button", { name: /^Tres Aliñación Ficticio:/ })).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("guardado pendiente no redirige tras abandonar convocatoria", async ({ page }) => {
  await page.goto("/admin/convocatoria?categoria=Veteranos&partido=convocatoria-e2e");
  const lista = page.getByRole("list", { name: "Plantilla Veteranos" });
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
  await page.getByRole("button", { name: "Pasar a alineación", exact: true }).click();
  await recibida;
  page.once("dialog", (d) => d.accept());
  await page.getByRole("link", { name: "Jornada", exact: true }).first().click();
  await expect(page).toHaveURL(/\/admin\/jornada/);
  liberar();
  await entregada;
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/admin\/jornada/);
});
