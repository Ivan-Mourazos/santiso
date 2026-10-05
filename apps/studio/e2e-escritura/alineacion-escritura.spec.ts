import { expect, test } from "@playwright/test";

/**
 * Alineación antes del partido, sobre la base de juguete de `sembrar.ts`: el Norte – Sur de
 * «Copa Calendario» (Veteranos) y tres jugadores sembrados para esto. Va antes que las pruebas
 * de Calendario (orden alfabético), que borran ese partido.
 */
test("elegir titulares, suplente y capitán, generar la historia y recuperarla al volver", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/alineacion?categoria=Veteranos");
  await expect(page.getByRole("heading", { name: /Norte Calendario – Sur Calendario/ })).toBeVisible(
    { timeout: 30000 },
  );
  const plantilla = page.getByRole("list", { name: "Plantilla Veteranos" });
  const jugador = (nombre: string) => plantilla.getByRole("button", { name: new RegExp(`^${nombre}:`) });

  // Un toque: titular. Dos: suplente.
  await jugador("Uno Aliñación Ficticio").click();
  await jugador("Dous").click();
  await jugador("Tres Aliñación Ficticio").click();
  await jugador("Tres Aliñación Ficticio").click();
  await expect(page.getByText("2 / 11 titulares")).toBeVisible();
  await expect(page.getByText("1 suplente", { exact: true })).toBeVisible();
  await expect(jugador("Tres Aliñación Ficticio")).toHaveAccessibleName(/Suplente$/);

  // El capitán de la plantilla (Dous) se propone solo al entrar en el once; se puede cambiar.
  await expect(plantilla.getByRole("button", { name: "Capitán: Dous" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await plantilla.getByRole("button", { name: "Capitán: Uno Aliñación Ficticio" }).click();
  await expect(plantilla.getByRole("button", { name: "Capitán: Dous" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // «Ver historia» guarda y enseña el PNG 9:16 con sus acciones.
  await page.getByRole("button", { name: "Ver historia" }).click();
  const historia = page.getByRole("img", { name: "Historia con la alineación" });
  await expect(historia).toBeVisible({ timeout: 60000 });
  const medidas = await historia.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(medidas).toEqual([2160, 3840]);
  await expect(page.getByRole("button", { name: "Compartir" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar" })).toBeVisible();

  // Al volver a entrar sigue ahí: se guardó con el partido.
  await page.goto("/admin/alineacion?categoria=Veteranos");
  await expect(page.getByText("2 / 11 titulares")).toBeVisible({ timeout: 30000 });
  await expect(
    page
      .getByRole("list", { name: "Plantilla Veteranos" })
      .getByRole("button", { name: "Capitán: Uno Aliñación Ficticio" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errores).toEqual([]);
});
