import { expect, test } from "@playwright/test";

test("cuando la lectura falla, la pantalla lo dice en vez de inventarse datos", async ({
  page,
}) => {
  // Las Server Actions son POST a la propia ruta. Cortarlas simula la base de datos caída.
  await page.route("**/admin**", async (ruta) => {
    if (ruta.request().method() === "POST") return ruta.abort();
    return ruta.fallback();
  });

  await page.goto("/admin");
  await page.getByText("Equipos", { exact: true }).first().click();

  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("alert").first()).toContainText("No se pudieron cargar");

  // Y lo que importa: ni rastro del catálogo inventado que había hasta la 2C.
  await expect(page.getByText("Tercera Futgal - Gr. 3")).toHaveCount(0);
});
