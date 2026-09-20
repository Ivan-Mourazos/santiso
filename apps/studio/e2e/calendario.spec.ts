import { expect, test } from "@playwright/test";

test("el calendario carga jornadas y partidos desde la base de datos local", async ({ page }) => {
  const errores: string[] = [];
  const aSupabase: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  page.on("response", (respuesta) => {
    if (respuesta.url().includes("supabase.co")) aSupabase.push(respuesta.url());
  });

  await page.goto("/admin");
  await page.getByText("Calendario", { exact: true }).first().click();
  await page.waitForTimeout(2500);

  // La pantalla llega hasta pintar la tabla de partidos de una jornada.
  await expect(page.getByRole("button", { name: "Guardar", exact: true }).first()).toBeVisible();
  expect(errores).toEqual([]);
  expect(aSupabase).toEqual([]);
});
