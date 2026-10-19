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

test("si Inicio no puede leer la semana, lo dice y deja reintentar", async ({ page }) => {
  let cortar = true;
  await page.route("**/admin**", async (ruta) => {
    if (cortar && ruta.request().method() === "POST") return ruta.abort();
    return ruta.fallback();
  });
  await page.goto("/admin/inicio");
  const aviso = page.getByRole("alert").filter({ hasText: "partidos de la semana" });
  await expect(aviso).toBeVisible({ timeout: 15000 });
  cortar = false;
  await aviso.getByRole("button", { name: "Reintentar" }).click();
  await expect(aviso).toBeHidden();
  await expect(
    page.locator("[data-partido-inicio]").or(page.getByText("Sin partidos esta semana")).first(),
  ).toBeVisible({ timeout: 15000 });
});
