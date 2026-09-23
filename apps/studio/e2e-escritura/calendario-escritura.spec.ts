import { expect, test, type Page } from "@playwright/test";

/**
 * Calendario escribiendo de verdad sobre la base de juguete de `sembrar.ts`, en su propia
 * competición («Copa Calendario», Veteranos) para no mover los recuentos de otras pruebas.
 * Van en orden y comparten estado: es un recorrido por todo lo que la pantalla guarda.
 */
test.describe.configure({ mode: "serial" });

const partido = (page: Page, local: string, visitante: string) =>
  page.getByRole("region", { name: `${local} - ${visitante}` });
const opciones = async (page: Page, etiqueta: string) =>
  page.getByLabel(etiqueta, { exact: true }).locator("option").allTextContents();

async function confirmar(page: Page) {
  await page
    .getByRole("dialog", { name: "Confirmar acción" })
    .getByRole("button", { name: "Confirmar" })
    .click();
}

async function abrir(page: Page, jornada = "Jornada 1") {
  await page.goto("/admin/calendario?categoria=Veteranos");
  const competicion = page.getByLabel("Competición", { exact: true });
  await expect(competicion).toBeVisible({ timeout: 30000 });
  await competicion.selectOption({ label: "Copa Calendario" });
  const selector = page.getByLabel("Jornada", { exact: true });
  await expect(selector.locator("option", { hasText: jornada })).toHaveCount(1, {
    timeout: 30000,
  });
  await selector.selectOption({ label: jornada });
  await expect(page).toHaveURL(/jornada=/);
}

test("la jornada sembrada enseña su partido y la selección sobrevive a recargar", async ({
  page,
}) => {
  await abrir(page);
  await expect(partido(page, "Norte Calendario", "Sur Calendario")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Competición", { exact: true })).toHaveValue(/.+/, {
    timeout: 30000,
  });
  await expect(
    page.getByLabel("Competición", { exact: true }).locator("option:checked"),
  ).toHaveText("Copa Calendario");
  await expect(partido(page, "Norte Calendario", "Sur Calendario")).toBeVisible();
});

test("añadir partido no ofrece equipos que ya juegan y guarda el nuevo", async ({ page }) => {
  await abrir(page);
  // Norte y Sur ya juegan en la jornada 1: ni siquiera se ofrecen.
  for (const lado of ["Local", "Visitante"]) {
    const nombres = await opciones(page, lado);
    expect(nombres.join()).not.toMatch(/Norte Calendario|Sur Calendario/);
  }

  const alta = page.getByRole("region", { name: "Añadir partido" });
  await alta.getByLabel("Local", { exact: true }).selectOption({ label: "Leste Calendario" });
  // Elegido el local, no se ofrece como visitante: un equipo no juega contra sí mismo.
  expect((await opciones(page, "Visitante")).join()).not.toContain("Leste Calendario");
  await alta.getByLabel("Visitante", { exact: true }).selectOption({ label: "Oeste Calendario" });
  await alta.getByLabel("Campo", { exact: true }).selectOption({ label: /Campo Calendario/ });
  await alta.getByRole("button", { name: "Añadir partido" }).click();
  await expect(partido(page, "Leste Calendario", "Oeste Calendario")).toBeVisible();

  await abrir(page);
  await expect(partido(page, "Leste Calendario", "Oeste Calendario")).toBeVisible();
});

test("editar marcador y estado se guarda", async ({ page }) => {
  await abrir(page);
  const fila = partido(page, "Norte Calendario", "Sur Calendario");
  await fila.getByLabel("Goles de Norte Calendario").fill("2");
  await fila.getByLabel("Goles de Sur Calendario").fill("1");
  await fila.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await fila.getByLabel("Estado", { exact: true }).selectOption("finalizado");

  await abrir(page);
  const recargada = partido(page, "Norte Calendario", "Sur Calendario");
  await expect(recargada.getByLabel("Goles de Norte Calendario")).toHaveValue("2");
  await expect(recargada.getByLabel("Goles de Sur Calendario")).toHaveValue("1");
  await expect(recargada.getByLabel("Estado", { exact: true })).toHaveValue("finalizado");
});

test("crear una jornada y marcar y quitar un descanso", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Jornadas…" }).click();
  const dialogo = page.getByRole("dialog", { name: "Jornadas" });
  await dialogo.getByLabel("Número de jornada").fill("2");
  await dialogo.getByRole("button", { name: "Crear jornada" }).click();
  await expect(page.getByText("Jornada creada")).toBeVisible();
  await dialogo.getByRole("button", { name: "Cerrar" }).click();

  await abrir(page, "Jornada 2");
  const descansos = page.getByRole("region", { name: "Descansos" });
  await descansos
    .getByLabel("Equipo que descansa", { exact: true })
    .selectOption({ label: "Norte Calendario" });
  await descansos.getByRole("button", { name: "Marcar descanso" }).click();
  await expect(descansos.getByText("Norte Calendario")).toBeVisible();
  // Quien descansa no se ofrece para jugar.
  expect((await opciones(page, "Local")).join()).not.toContain("Norte Calendario");

  await descansos.getByRole("button", { name: "Quitar descanso de Norte Calendario" }).click();
  await confirmar(page);
  await expect(page.getByText("Descanso eliminado")).toBeVisible();
  await abrir(page, "Jornada 2");
  await expect(
    page.getByRole("region", { name: "Descansos" }).getByText("Norte Calendario"),
  ).toHaveCount(0);
});

test("crear en lote las jornadas que faltan", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Jornadas…" }).click();
  const dialogo = page.getByRole("dialog", { name: "Jornadas" });
  await dialogo.getByLabel("Crear hasta la jornada").fill("4");
  await dialogo.getByRole("button", { name: "Crear las que falten" }).click();
  await expect(page.getByText("Generadas 2 jornadas faltantes")).toBeVisible();

  await abrir(page);
  expect(await opciones(page, "Jornada")).toEqual([
    expect.stringContaining("Jornada 1"),
    expect.stringContaining("Jornada 2"),
    expect.stringContaining("Jornada 3"),
    expect.stringContaining("Jornada 4"),
  ]);
});

test("borrar un partido y borrar una jornada piden confirmación", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Borrar Leste Calendario - Oeste Calendario" }).click();
  await confirmar(page);
  await expect(page.getByText("Partido eliminado")).toBeVisible();
  await abrir(page);
  await expect(partido(page, "Leste Calendario", "Oeste Calendario")).toHaveCount(0);

  await abrir(page, "Jornada 4");
  await page.getByRole("button", { name: "Borrar jornada" }).click();
  await confirmar(page);
  await expect(page.getByText("Jornada borrada")).toBeVisible();
  await abrir(page);
  expect((await opciones(page, "Jornada")).join()).not.toContain("Jornada 4");
});

test("las zonas de la clasificación se guardan y las pinta Clasificación", async ({ page }) => {
  await abrir(page);
  await page.getByRole("button", { name: "Zonas de la clasificación" }).click();
  const dialogo = page.getByRole("dialog", { name: "Zonas de la clasificación" });
  await dialogo.getByLabel("Nombre de la zona").fill("Ascenso ficticio");
  await dialogo.getByLabel("Puestos").fill("1, 2");
  await dialogo.getByRole("button", { name: "Añadir zona" }).click();
  await dialogo.getByRole("button", { name: "Guardar zonas" }).click();
  await expect(page.getByText("Reglas de liga guardadas")).toBeVisible();

  await page.goto("/admin/clasificacion?categoria=Veteranos");
  await page.getByLabel("Competición", { exact: true }).selectOption({ label: "Copa Calendario" });
  await expect(
    page.getByRole("list", { name: "Zonas de la clasificación" }).getByText(/Ascenso ficticio/),
  ).toBeVisible({ timeout: 30000 });
});

test("los accesos a temporadas y competiciones llevan a su pantalla", async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole("link", { name: "Gestionar temporadas" })).toHaveAttribute(
    "href",
    /\/admin\/temporadas/,
  );
  await expect(page.getByRole("link", { name: "Gestionar competiciones" })).toHaveAttribute(
    "href",
    /\/admin\/equipos/,
  );
});
