import { expect, test } from "@playwright/test";

/**
 * Alineación antes del partido, sobre la base de juguete de `sembrar.ts`: el Norte – Sur de
 * «Copa Convocatoria» (Senior) y tres jugadores sembrados para esto. Veteranos no alinea: aunque
 * la dirección lo pida, la pantalla es la del Senior y no ofrece elegir categoría.
 */
test("elegir titulares, suplente y capitán, generar la historia y recuperarla al volver", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin/alineacion?categoria=Veteranos&partido=alineacion-e2e");
  await expect(
    page.getByRole("heading", { name: /Norte Convocatoria – Sur Convocatoria/ }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("group", { name: "Categoría deportiva" })).toHaveCount(0);
  const plantilla = page.getByRole("list", { name: "Plantilla Senior" });
  const jugador = (nombre: string) => plantilla.getByRole("button", { name: new RegExp(`^${nombre}:`) });

  // Un toque: titular. Dos: suplente.
  await jugador("Uno Aliñación Ficticio").click();
  await jugador("Dous").click();
  await jugador("Tres Aliñación Ficticio").click();
  await jugador("Tres Aliñación Ficticio").click();
  await expect(page.getByText("2 / 11 titulares")).toBeVisible();
  await expect(page.getByText("1 suplente", { exact: true })).toBeVisible();
  await expect(jugador("Tres Aliñación Ficticio")).toHaveAccessibleName(/: Suplente(, apercibido)?$/);

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

  // «Generar cartel» guarda la alineación y la historia 9:16, que queda guardada con el partido.
  const panel = page.getByRole("region", { name: "Once inicial: carteles guardados" });
  await panel.getByRole("button", { name: "Generar cartel", exact: true }).click();
  await panel.getByRole("button", { name: "Ver en grande: Historia" }).click({ timeout: 60000 });
  const historia = page.getByRole("dialog").getByRole("img", { name: "Once inicial · Historia" });
  await expect(historia).toBeVisible();
  await expect(historia).toHaveJSProperty("complete", true);
  const medidas = await historia.evaluate((img: HTMLImageElement) => [
    img.naturalWidth,
    img.naturalHeight,
  ]);
  expect(medidas).toEqual([2160, 3840]);
  await page.getByRole("button", { name: "Cerrar diálogo" }).click();
  await expect(panel.getByRole("button", { name: "Guardar o compartir: Historia" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Descargar: Historia" })).toBeVisible();

  // Al volver a entrar siguen ahí la alineación y su historia.
  await page.goto("/admin/alineacion?partido=alineacion-e2e");
  await expect(panel.getByRole("button", { name: "Ver en grande: Historia" })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("2 / 11 titulares")).toBeVisible({ timeout: 30000 });
  await expect(
    page
      .getByRole("list", { name: "Plantilla Senior" })
      .getByRole("button", { name: "Capitán: Uno Aliñación Ficticio" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errores).toEqual([]);
});

test("colocar el once en el campo: sistema, meter a un suplente en un hueco y recuperarlo", async ({
  page,
}) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));
  await page.setViewportSize({ width: 360, height: 740 });

  // Parte de la prueba anterior: Uno y Dous titulares, Tres suplente.
  await page.goto("/admin/alineacion?partido=alineacion-e2e");
  const campo = page.getByRole("region", { name: "Once en el campo" });
  await expect(campo).toBeVisible({ timeout: 30000 });
  await campo.getByLabel("Sistema").selectOption("4-3-3");

  // Un hueco vacío: se elige al suplente, que entra de titular.
  await campo.getByRole("button", { name: "Delantero: vacío. Elegir jugador" }).first().click();
  const hoja = page.getByRole("dialog");
  await hoja.getByRole("button", { name: /Tres Aliñación Ficticio/ }).click();
  await expect(campo.getByRole("button", { name: "Delantero: Tres Aliñación Ficticio. Cambiar" })).toBeVisible();
  await expect(page.getByText("3 / 11 titulares")).toBeVisible();

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Alineación guardada")).toBeVisible();

  await page.reload();
  await expect(campo.getByLabel("Sistema")).toHaveValue("4-3-3", { timeout: 30000 });
  await expect(
    campo.getByRole("button", { name: "Delantero: Tres Aliñación Ficticio. Cambiar" }),
  ).toBeVisible();

  // Quitar del campo lo devuelve al banco.
  await campo.getByRole("button", { name: "Delantero: Tres Aliñación Ficticio. Cambiar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Quitar del campo" }).click();
  await expect(page.getByText("2 / 11 titulares")).toBeVisible();
  expect(errores).toEqual([]);
});
