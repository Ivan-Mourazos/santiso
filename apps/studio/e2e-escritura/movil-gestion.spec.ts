import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

test.use({ viewport: { width: 360, height: 844 }, hasTouch: true, isMobile: true });
let PNG: Buffer;
test.beforeAll(async () => {
  PNG = await sharp({
    create: { width: 40, height: 40, channels: 4, background: { r: 245, g: 197, b: 24, alpha: 1 } },
  })
    .png()
    .toBuffer();
});

async function comprobarAncho(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  const main = page.locator("main");
  expect(await main.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
}

test("equipo móvil guarda escudo y color y cancela otro borrador", async ({ page }) => {
  await page.goto("/admin/equipos?categoria=Veteranos");
  await page.getByRole("button", { name: "Biblioteca de Veteranos", exact: true }).click();
  const nombre = "Rival de Consulta Móbil Con Nome Moi Longo";
  const fila = page
    .getByRole("table", { name: "Equipos Veteranos" })
    .getByRole("row")
    .filter({ hasText: /Rival de Consulta Móbil con Nome Moi Longo/i });
  await fila.getByRole("button", { name: /^Editar a / }).click();
  const editor = page.getByRole("dialog");
  const archivo = editor.locator('input[type="file"]');
  await expect(archivo).toHaveAttribute("accept", "image/*");
  await archivo.setInputFiles({
    name: "escudo-de-equipo-con-nombre-muy-largo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await editor.getByLabel("Color del equipo en los carteles", { exact: true }).check();
  await editor.getByLabel("Color del equipo", { exact: true }).fill("#f5c518");
  await comprobarFormulario(page, editor);
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await page.getByRole("button", { name: "Biblioteca de Veteranos", exact: true }).click();
  const src = await fila.locator("img").getAttribute("src");
  expect(src).toMatch(/^\/media\//);
  await fila.getByRole("button", { name: `Editar a ${nombre}`, exact: true }).click();
  await expect(editor.getByLabel("Color del equipo", { exact: true })).toHaveValue("#f5c518");
  await editor.getByLabel("Nombre del equipo").fill("Descartar equipo");
  page.once("dialog", (dialogo) => dialogo.accept());
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Biblioteca de Veteranos", exact: true }).click();
  await expect(fila.locator("img")).toHaveAttribute("src", src!);
  await comprobarAncho(page);
});

test("patrocinador móvil conserva URL larga, logo y orden tras recargar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/patrocinadores");
  await page.getByRole("button", { name: "Añadir patrocinador o logo", exact: true }).click();
  const editor = page.getByRole("dialog");
  const nombre = "Patrocinador Móbil de Proba con Nome Moi Longo";
  const url = `https://example.com/${"ruta-muy-larga".repeat(10)}`;
  await editor.getByLabel("Nombre", { exact: true }).fill(nombre);
  await editor.getByLabel("Web", { exact: true }).fill(url);
  const archivo = editor.locator('input[type="file"]');
  await expect(archivo).toHaveAttribute("accept", "image/*");
  await archivo.setInputFiles({
    name: "logo-patrocinador-movil.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await editor.getByLabel("Mostrar en carteles", { exact: true }).check();
  await comprobarFormulario(page, editor);
  await editor.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  const fila = page
    .getByRole("table", { name: "Patrocinadores y logos" })
    .getByRole("row")
    .filter({ hasText: nombre });
  await expect(fila.getByRole("link")).toHaveAttribute("href", url);
  await expect(fila.locator("img")).toHaveAttribute("src", /^\/media\//);
  await comprobarAncho(page);
  const orden = page.getByRole("list", { name: "Orden de los logos" });
  const nombres = () =>
    orden
      .locator("li")
      .evaluateAll((filas) =>
        filas.map((li) => li.querySelectorAll(":scope > span")[1]?.textContent?.trim()),
      );
  const antes = await nombres();
  const subir = orden.getByRole("button", { name: `Subir ${nombre}`, exact: true });
  await expect(subir).toBeEnabled();
  await subir.click();
  await expect.poll(nombres).not.toEqual(antes);
  await page.reload();
  expect(await nombres()).not.toEqual(antes);
  await fila.getByRole("button", { name: `Editar ${nombre}`, exact: true }).click();
  await editor.getByLabel("Web", { exact: true }).fill("https://descartar.example");
  page.once("dialog", (dialogo) => dialogo.accept());
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  await expect(fila.getByRole("link")).toHaveAttribute("href", url);
  // Retirar solo de la barra deja intacto el orden de los dos logos sembrados.
  await fila.getByRole("button", { name: `Editar ${nombre}`, exact: true }).click();
  await editor.getByLabel("Mostrar en carteles", { exact: true }).uncheck();
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  await comprobarAncho(page);
  await page.getByLabel("Buscar", { exact: true }).fill("zzz-sin-coincidencias");
  await expect(page.getByLabel("Buscar", { exact: true })).toBeVisible();
});

async function abrirPasada(page: Page, seccion: string) {
  await page.goto(`/admin/${seccion}?categoria=Veteranos`);
  const temporada = page.getByLabel("Temporada", { exact: true });
  await expect(temporada).toBeVisible();
  await temporada.selectOption({ label: "2025/26" });
  await page.waitForLoadState("networkidle");
}

async function comprobarFormulario(page: Page, dialogo: Locator) {
  const rect = (await dialogo.boundingBox())!;
  expect(rect.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 24);
  expect(rect.height).toBeGreaterThanOrEqual(page.viewportSize()!.height - 24);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y + rect.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  for (const control of await dialogo
    .locator(
      'input:visible:not([type="checkbox"]), select:visible, textarea:visible, button:visible',
    )
    .all()) {
    const box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    if (await control.evaluate((el) => el.matches("input, select, textarea"))) {
      expect(
        await control.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
  }
}

test("jugador móvil conserva foto/borrador ante fallo, guarda y cancela nueva selección", async ({
  page,
}) => {
  const nombre = "Xoán Xogador de Proba Móbil con Nome Moi Longo";
  await abrirPasada(page, "jugadores");
  const fila = page.getByRole("row").filter({ has: page.getByText(nombre, { exact: true }) });
  await fila.getByRole("button", { name: /^Editar a / }).click();
  const editor = page.getByRole("dialog");
  const archivo = editor.locator('input[type="file"]');
  await expect(archivo).toHaveAttribute("accept", "image/*");
  await archivo.setInputFiles({
    name: "fotografia-con-un-nombre-muy-largo-desde-galeria-del-movil.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await comprobarFormulario(page, editor);
  await page.setViewportSize({ width: 360, height: 500 });
  await comprobarFormulario(page, editor);
  await page.route("**/admin/jugadores**", (route) =>
    route.request().method() === "POST" ? route.abort() : route.continue(),
  );
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeVisible();
  await expect(editor.getByLabel("Nombre completo")).toHaveValue(nombre);
  await expect(editor.locator("img")).toHaveAttribute("src", /^blob:/);
  await page.unroute("**/admin/jugadores**");
  await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
  await expect(editor).toBeHidden();
  await page.reload();
  const src = await fila.locator("img").getAttribute("src");
  expect(src).toMatch(/^\/media\//);
  await fila.getByRole("button", { name: /^Editar a / }).click();
  await archivo.setInputFiles({ name: "descartar.png", mimeType: "image/png", buffer: PNG });
  page.once("dialog", (dialogo) => dialogo.accept());
  await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  await expect(fila.locator("img")).toHaveAttribute("src", src!);
});

for (const seccion of ["tecnicos", "directiva"]) {
  test(`${seccion}: alta y edición móvil con foto y nombre largo`, async ({ page }) => {
    await abrirPasada(page, seccion);
    await page.getByRole("button", { name: "Añadir", exact: true }).click();
    const editor = page.getByRole("dialog");
    const nombre = `Persoa de Proba Móbil para ${seccion} con Nome Longo`;
    await editor.getByLabel("Nombre completo").fill(nombre);
    await editor.getByLabel("Cargo", { exact: true }).fill("Responsable de proba móbil");
    const archivo = editor.locator('input[type="file"]');
    await expect(archivo).toHaveAttribute("accept", "image/*");
    await archivo.setInputFiles({ name: `${seccion}.png`, mimeType: "image/png", buffer: PNG });
    await comprobarFormulario(page, editor);
    await editor.getByRole("button", { name: "Añadir", exact: true }).click();
    await expect(editor).toBeHidden();
    await page.reload();
    const fila = page.getByRole("row").filter({ hasText: "Responsable de proba móbil" });
    await expect(fila.locator("img")).toHaveAttribute("src", /^\/media\//);
    await fila.getByRole("button", { name: /^Editar a / }).click();
    await editor.getByLabel("Cargo", { exact: true }).fill("Responsable actualizado");
    await editor.getByRole("button", { name: "Guardar cambios", exact: true }).click();
    await expect(editor).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole("row").filter({ hasText: "Responsable actualizado" }),
    ).toBeVisible();
  });
}

test("temporada móvil valida borrador, crea y activa con confirmación", async ({ page }) => {
  await page.goto("/admin/temporadas");
  const entrada = page.getByLabel("Nombre de temporada", { exact: true });
  const invalido = "Temporada de Proba Móbil con Nome Moi Longo";
  await entrada.fill(invalido);
  await page.getByRole("button", { name: "Crear temporada", exact: true }).click();
  await expect(
    page.getByText("El nombre debe tener la forma 2025/26.", { exact: true }),
  ).toBeVisible();
  await expect(entrada).toHaveValue(invalido);
  await comprobarAncho(page);
  await entrada.fill("2027/28");
  await page.getByRole("button", { name: "Crear temporada", exact: true }).click();
  const nueva = page.locator("main li").filter({ hasText: "2027/28" });
  await expect(nueva).toBeVisible();
  await nueva
    .getByRole("button", { name: "Usar 2027/28 como temporada activa", exact: true })
    .click();
  const confirmacion = page.getByRole("dialog", { name: "Confirmar acción" });
  await comprobarFormulario(page, confirmacion);
  await confirmacion.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(nueva.getByText("Activa", { exact: true })).toBeVisible();
  await page.reload();
  await expect(nueva.getByText("Activa", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Usar 2026/27 como temporada activa", exact: true })
    .click();
  await confirmacion.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.locator("main li").filter({ hasText: "2026/27" }).getByText("Activa", { exact: true }),
  ).toBeVisible();
  await comprobarAncho(page);
});

test("ajustes móviles descartan selección y guardan imagen grande explícitamente", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/ajustes-graficos");
  const logo = page.getByRole("region", { name: "Xunta de Galicia" });
  await expect(logo).toBeVisible();
  const anterior = (await logo.locator("img").count())
    ? await logo.locator("img").getAttribute("src")
    : null;
  const archivo = logo.locator('input[type="file"]');
  await expect(archivo).toHaveAttribute("accept", "image/*");
  await expect(archivo).not.toHaveAttribute("capture");
  const buffer = await sharp({
    create: {
      width: 2048,
      height: 1536,
      channels: 4,
      background: { r: 245, g: 197, b: 24, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const foto = {
    name: "fotografia-grande-con-nombre-muy-largo-desde-galeria-del-movil.png",
    mimeType: "image/png",
    buffer,
  };
  await archivo.setInputFiles(foto);
  await expect(logo.getByRole("status")).toContainText("todavía no se ha guardado");
  for (const boton of await logo.getByRole("button").all()) {
    expect((await boton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await logo.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.reload();
  if (anterior) await expect(logo.locator("img")).toHaveAttribute("src", anterior);
  else await expect(logo.getByText("Sin imagen")).toBeVisible();
  await archivo.setInputFiles(foto);
  await comprobarAncho(page);
  await logo.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(logo.locator("img")).toHaveAttribute("src", /^\/media\/cartel\/.+\.webp$/);
  await expect(logo.getByRole("status")).toBeHidden();
  const guardada = await logo.locator("img").getAttribute("src");
  await page.reload();
  await expect(logo.locator("img")).toHaveAttribute("src", guardada!);
  const orden = page.getByRole("group", { name: "Qué logo va a la izquierda" });
  const rfgf = orden.getByRole("button", { name: "RFGF a la izquierda", exact: true });
  await rfgf.click();
  await expect(rfgf).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(rfgf).toHaveAttribute("aria-pressed", "true");
  await comprobarAncho(page);
});
