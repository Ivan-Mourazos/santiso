import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
});

test("Directo conserva el marcador justo bajo la cabecera al desplazar", async ({ page }) => {
  await page.goto("/admin/partidos");
  const nuestro = page.locator("main button[data-propio]").first();
  await expect(nuestro).toBeVisible();
  await nuestro.click();
  await page.getByRole("dialog").getByRole("link", { name: "Directo", exact: true }).click();
  const marcador = page.getByLabel("Marcador", { exact: true });
  await expect(marcador).toBeVisible();
  // Simula una cronología larga sin apuntar sucesos en el partido real.
  await marcador.evaluate((el) => {
    const final = document.createElement("div");
    final.style.height = "120vh";
    el.closest("header")!.parentElement!.append(final);
    window.scrollTo(0, 350);
  });
  await expect.poll(async () => {
    const cabecera = (await page.getByRole("banner").boundingBox())!;
    const pegajosa = (await marcador.locator("..").boundingBox())!;
    return Math.abs(pegajosa.y - (cabecera.y + cabecera.height));
  }).toBeLessThanOrEqual(1);
});

test("Directo descarta el borrador con Escape pero conserva la edición al pulsar fuera", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/admin/partidos");
  await page.locator("main button[data-propio]").first().click();
  await page.getByRole("dialog").getByRole("link", { name: "Directo", exact: true }).click();
  const gol = page.getByRole("button", { name: /Gol$/ });
  await gol.click();
  const editor = page.getByRole("dialog", { name: "Gol", exact: true });
  await editor.getByRole("button", { name: "Rival", exact: true }).click();
  const dorsal = editor.getByRole("spinbutton", { name: /dorsal del rival/ });
  await expect(dorsal).toHaveAccessibleDescription("Déjalo vacío si no conoces el dorsal.");
  await dorsal.fill("12");
  await page.mouse.click(5, 5);
  await expect(dorsal).toHaveValue("12");
  await page.keyboard.press("Escape");
  await expect(editor).toBeHidden();
});

test("Once inicial mantiene el último foco y el pie visibles con borrador", async ({ page }) => {
  await page.goto("/admin/alineacion");
  const suplente = page.getByRole("region", { name: "Banquillo" })
    .getByRole("button", { name: /^Suplente:/ }).last();
  await expect(suplente).toBeEnabled();
  const marcado = await suplente.getAttribute("aria-pressed");
  await suplente.click();
  await expect(suplente).toHaveAttribute("aria-pressed", marcado === "true" ? "false" : "true");
  const guardar = page.getByRole("button", { name: "Guardar", exact: true });
  await expect(guardar).toBeVisible();
  await suplente.evaluate((el) => {
    el.focus();
    el.scrollIntoView({ block: "end" });
  });
  const foco = (await suplente.boundingBox())!;
  const barra = (await guardar.boundingBox())!;
  expect(barra.y).toBeGreaterThanOrEqual(foco.y + foco.height);
  const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
  expect(foco.y + foco.height).toBeLessThanOrEqual((await pestanas.boundingBox())!.y + 1);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const cartel = (await page.getByRole("region", { name: "Once inicial: carteles guardados" }).boundingBox())!;
  expect(cartel.y + cartel.height).toBeLessThanOrEqual((await pestanas.boundingBox())!.y + 1);
});

test("Adestramentos deja espacio entre Crear entrenamiento y el listado", async ({ page }) => {
  await page.goto("/admin/adestramentos");
  const crear = page.getByRole("button", { name: "Crear entrenamiento" });
  const lista = page.getByRole("list", { name: "Entrenamientos" });
  await expect(crear).toBeVisible();
  await expect(lista).toBeAttached();
  const boton = (await crear.boundingBox())!;
  expect(boton.height).toBeGreaterThanOrEqual(44);
  expect((await lista.boundingBox())!.y - (boton.y + boton.height)).toBeGreaterThanOrEqual(8);
});

test("Resultado y O Noso 11 muestran sus previsualizaciones y estados en orden", async ({ page }) => {
  await page.goto("/admin/carteles?plantilla=despues");
  const jornadas = page.getByRole("combobox", { name: "Jornada", exact: true });
  await expect(jornadas).toBeVisible();
  const jugada = jornadas.locator("option:not([value=''])").filter({ hasText: /J\d+/ }).first();
  await expect(jugada).toBeAttached();
  await jornadas.selectOption((await jugada.getAttribute("value"))!);
  await page.locator("summary").filter({ hasText: /^Carteles$/ }).click();
  const piezas = page.getByRole("list", { name: "Imágenes del carrusel" }).locator(":scope > li");
  await expect(piezas).toHaveCount(2);
  for (const [i, nombre] of ["1 · Resultado", "2 · O Noso 11"].entries()) {
    const pieza = piezas.nth(i);
    await expect(pieza.getByRole("heading", { name: nombre })).toBeVisible();
    await expect(pieza.getByRole("status")).toHaveText(/^(Falta|Lista|Hay cambios)$/);
    await expect(pieza.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
  }
});
