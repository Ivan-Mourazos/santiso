import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/**
 * Ajustes gráficos contra la base de datos real. **Solo lectura**: no se sube ninguna imagen ni
 * se cambia el orden. Las subidas se prueban en `e2e-escritura/ajustes-escritura.spec.ts`.
 */
test("una sola pantalla con escudo, cabecera y barra de patrocinadores", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/ajustes-graficos");
  for (const titulo of ["Escudo del club", "Xunta de Galicia", "RFGF"]) {
    await expect(page.getByRole("region", { name: titulo })).toBeVisible({ timeout: 30000 });
  }

  // El orden de la cabecera dice cuál está elegido.
  const orden = page.getByRole("group", { name: "Qué logo va a la izquierda" });
  const pulsados = orden.getByRole("button", { pressed: true });
  await expect(pulsados).toHaveCount(1);

  // La barra se enseña, pero se gestiona en el catálogo.
  const enlace = page.getByRole("link", { name: "Patrocinadores y logos" }).last();
  await expect(enlace).toHaveAttribute("href", "/admin/patrocinadores");
  await expect(page.getByRole("list", { name: "Logos de la barra, en orden" })).toBeVisible();

  // Nada de vista previa sin haber elegido un archivo.
  await expect(page.getByText("Vista previa: todavía no se ha guardado.")).toHaveCount(0);

  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("los ajustes se piden una sola vez al abrir", async ({ page }) => {
  let peticiones = 0;
  page.on("request", (peticion) => {
    if (peticion.method() === "POST" && peticion.headers()["next-action"]) peticiones++;
  });
  await page.goto("/admin/ajustes-graficos");
  await expect(page.getByRole("region", { name: "Escudo del club" })).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(1000);
  expect(peticiones).toBe(1);
});

for (const ancho of [360, 1280]) {
  test(`ajustes gráficos caben a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.goto("/admin/ajustes-graficos");
    await expect(page.getByRole("region", { name: "Escudo del club" })).toBeVisible({
      timeout: 30000,
    });
    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
}
