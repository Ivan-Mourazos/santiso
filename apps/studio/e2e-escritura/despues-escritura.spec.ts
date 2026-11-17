import { expect, test, type Page } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 844 },
  hasTouch: true,
  isMobile: true,
  actionTimeout: 15000,
});

async function activar(page: Page, temporada: string) {
  await page.goto("/admin/temporadas");
  const fila = page.locator("main li").filter({ hasText: temporada });
  if (await fila.getByText("Activa", { exact: true }).count()) return;
  await fila
    .getByRole("button", { name: `Usar ${temporada} como temporada activa`, exact: true })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(fila.getByText("Activa", { exact: true })).toBeVisible();
}

/**
 * Lo de después del partido se publica junto: un partido jugado de juguete (2025/26, con acta)
 * genera de una vez el Resultado y O Noso 11, colocado en el campo, y se recupera al volver.
 */
test("después del partido: resultado y O Noso 11 juntos, con el once en el campo", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await activar(page, "2025/26");
  try {
    await page.goto("/admin/carteles?plantilla=despues");
    const elegir = page.getByRole("region", { name: "Elige el partido" });
    await elegir.getByRole("group", { name: "Categoría" }).getByRole("button", { name: "Senior" }).tap();
    const jornada = elegir.getByLabel("Jornada", { exact: true });
    const id = await jornada
      .locator("option", { hasText: /Rival Uno Ficticio/i })
      .first()
      .getAttribute("value");
    expect(id).toBeTruthy();
    await page.goto(`/admin/carteles?plantilla=despues&partido=${id}`);

    // Desde el 16/11/2026 el carrusel y el campo van plegados: «Carteles» y, dentro, «Cambiar
    // el once».
    const abrirPlegables = async () => {
      await page.locator("main details > summary").filter({ hasText: /^\s*Carteles\s*$/ }).click();
      await page.locator("main details > summary").filter({ hasText: "Cambiar el once" }).click();
    };
    await abrirPlegables();
    // Los dos titulares del acta ya salen colocados en el campo.
    const campo = page.getByRole("region", { name: "Once en el campo" });
    await expect(campo).toBeVisible({ timeout: 30000 });
    await expect(campo.getByRole("button", { name: /Brais Rei\. Cambiar$/ })).toBeVisible();
    await campo.getByLabel("Sistema").selectOption("4-3-3");

    const carrusel = page.getByRole("region", { name: "Después del partido: carrusel" });
    await carrusel.getByRole("button", { name: "Generar carrusel", exact: true }).tap();
    await expect(carrusel.getByRole("button", { name: "Ver en grande: Resultado" })).toBeVisible({
      timeout: 120000,
    });
    await expect(carrusel.getByRole("button", { name: "Ver en grande: O Noso 11" })).toBeVisible();
    await expect(carrusel.getByRole("button", { name: "Guardar o compartir" })).toBeVisible();

    // Al volver: el carrusel sigue guardado y la colocación de después también.
    await page.reload();
    await abrirPlegables();
    await expect(carrusel.getByText(/Carrusel generado/)).toBeVisible({ timeout: 30000 });
    await expect(campo.getByLabel("Sistema")).toHaveValue("4-3-3");
    expect(errores).toEqual([]);
  } finally {
    await activar(page, "2026/27");
  }
});
