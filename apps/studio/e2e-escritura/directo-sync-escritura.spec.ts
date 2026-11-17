import { expect, test, type Page } from "@playwright/test";

const RUTA = "/admin/directo?partido=directo-sync-e2e";

async function abrir(page: Page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto(RUTA);
  await expect(page.getByLabel("Marcador")).toBeVisible({ timeout: 30000 });
}

async function golDeUno(page: Page, minuto: string) {
  await page.getByRole("button", { name: "Gol", exact: true }).click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: /Marca: #1 Uno/ }).click();
  await hoja.getByLabel("Minuto").fill(minuto);
  await hoja.getByRole("button", { name: "Guardar", exact: true }).click();
}

test("dos móviles: se ve lo del otro sin recargar y avisa del repetido", async ({ browser }) => {
  // Dos móviles y varias vueltas de sincronización: no cabe en los 30 s por defecto.
  test.setTimeout(90_000);
  const delegado = await (await browser.newContext()).newPage();
  const mister = await (await browser.newContext()).newPage();
  await abrir(delegado);
  await abrir(mister);

  // El míster apunta; al delegado le aparece solo, sin recargar.
  await golDeUno(mister, "12");
  const listaDelegado = delegado.getByRole("list", { name: "Lo apuntado" });
  await expect(listaDelegado.getByRole("listitem")).toHaveCount(1, { timeout: 20000 });
  await expect(delegado.getByLabel("Marcador")).toContainText("1 – 0");

  // El delegado apunta el mismo gol: le avisa antes de guardar.
  await golDeUno(delegado, "13");
  await expect(delegado.getByText(/Parece que ya está apuntado/)).toBeVisible();
  await expect(delegado.getByText(/12' .*Gol.*#1 Uno/)).toBeVisible();
  await delegado.getByRole("button", { name: "Confirmar" }).click();
  await expect(listaDelegado.getByRole("listitem")).toHaveCount(2);
  await expect(listaDelegado.getByText("¿Repetido?")).toHaveCount(2);

  // Al míster le llegan los dos marcados; borra uno y desaparece la marca en ambos.
  const listaMister = mister.getByRole("list", { name: "Lo apuntado" });
  await expect(listaMister.getByText("¿Repetido?")).toHaveCount(2, { timeout: 20000 });
  await listaMister.getByRole("button", { name: /13'/ }).click();
  await mister.getByRole("dialog").getByRole("button", { name: "Borrar", exact: true }).click();
  await mister.getByRole("button", { name: "Confirmar" }).click();
  await expect(listaMister.getByRole("listitem")).toHaveCount(1);
  await expect(listaMister.getByText("¿Repetido?")).toHaveCount(0);
  await expect(listaDelegado.getByRole("listitem")).toHaveCount(1, { timeout: 20000 });
  await expect(listaDelegado.getByText("¿Repetido?")).toHaveCount(0);
  await expect(delegado.getByLabel("Marcador")).toContainText("1 – 0");
});
