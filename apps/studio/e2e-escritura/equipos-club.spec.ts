import { expect, test } from "@playwright/test";

/** Un equipo con dos clubes posibles en la federación: se elige uno y deja de preguntarse. */
test("equipos: elegir el club de la federación de un equipo dudoso", async ({ page }) => {
  await page.goto("/admin/equipos?categoria=Senior");
  const dudosos = page.getByRole("region", { name: "Equipos por enlazar con la federación" });
  await expect(dudosos).toBeVisible({ timeout: 30000 });
  await dudosos.getByText(/por enlazar con su club/).click();
  await expect(dudosos.getByText("Rival Ficticio", { exact: true })).toBeVisible();
  await dudosos
    .getByRole("button", { name: "Enlazar Rival Ficticio con S.D. Rival Ficticio" })
    .click();
  await expect(page.getByText("Rival Ficticio enlazado con su club.")).toBeVisible();
  await expect(dudosos.getByText("Rival Ficticio", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Equipos por enlazar con la federación" }),
  ).toHaveCount(0);
});
