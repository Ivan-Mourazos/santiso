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
  // Desde el 16/11/2026 el once se hace en el campo: se toca un hueco y se elige en la hoja.
  const campo = page.getByRole("region", { name: "Once en el campo" });
  const hoja = page.getByRole("dialog");
  const colocar = async (hueco: string, nombre: string) => {
    await campo.getByRole("button", { name: `${hueco}: vacío. Elegir jugador` }).first().click();
    await hoja.getByRole("button", { name: new RegExp(nombre) }).click();
    await expect(hoja).toBeHidden();
  };
  const enCampo = (nombre: string) =>
    campo.getByRole("button", { name: new RegExp(`: ${nombre}( \\(capitán\\))?\\. Cambiar$`) });
  await colocar("Portero", "Uno Aliñación Ficticio");
  await colocar("Defensa", "Dous");
  // El banquillo: un toque pone de suplente.
  const tres = page
    .getByRole("region", { name: "Banquillo" })
    .getByRole("button", { name: /^Suplente: Tres/ });
  await tres.click();
  await expect(tres).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("2 / 11 titulares")).toBeVisible();
  await expect(page.getByText("1 suplente", { exact: true })).toBeVisible();

  // El capitán de la plantilla (Dous) se propone solo al entrar en el once; se puede cambiar
  // tocando a otro colocado.
  await expect(enCampo("Dous")).toHaveAccessibleName(/\(capitán\)/);
  await enCampo("Uno Aliñación Ficticio").click();
  await hoja.getByRole("button", { name: "Hacer capitán" }).click();
  await expect(enCampo("Uno Aliñación Ficticio")).toHaveAccessibleName(/\(capitán\)/);
  await expect(enCampo("Dous")).not.toHaveAccessibleName(/\(capitán\)/);

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
  await expect(enCampo("Uno Aliñación Ficticio")).toHaveAccessibleName(/\(capitán\)/);
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
