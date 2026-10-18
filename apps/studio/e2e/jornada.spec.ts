import { expect, test } from "@playwright/test";
import { vigilarSalidasAInternet } from "./red";

/** Datos reales, solo lectura: enlaces, cambios de contexto y estados guardados. */
test("jornada: entrada centrada en un partido y una sola acción principal", async ({ page }) => {
  const errores: string[] = [];
  const externas = vigilarSalidasAInternet(page);
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/admin/jornada");
  await expect(page).toHaveURL(/\/admin\/jornada/);
  await expect(page.locator("[data-mesa-partido]")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-accion-principal]")).toHaveCount(1);
  await expect(page.getByRole("group", { name: "Equipo" })).toBeVisible();
  await page.getByRole("button", { name: "Veteranos", exact: true }).click();
  await expect(page.getByRole("region", { name: "Veteranos", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/categoria=Veteranos/);
  await expect(page.locator("[data-accion-principal]")).toHaveCount(1);
  expect(errores).toEqual([]);
  expect(externas).toEqual([]);
});

test("jornada: conserva semanas en URL y vuelve a la mesa actual", async ({ page }) => {
  await page.goto("/admin/jornada?semana=2026-09-23");
  const titulo = page.getByRole("heading", { name: /^Semana del/ });
  await expect(titulo).toHaveText("Semana del 21 al 27 de septiembre", { timeout: 30000 });
  await page.getByRole("button", { name: "Siguiente →" }).click();
  await expect(titulo).toHaveText("Semana del 28 de septiembre al 4 de octubre");
  await expect(page).toHaveURL(/semana=2026-09-28/);
  await page.getByRole("button", { name: "← Anterior" }).click();
  await expect(titulo).toHaveText("Semana del 21 al 27 de septiembre");
  await page.getByRole("button", { name: "Volver al próximo partido" }).click();
  await expect(page).not.toHaveURL(/semana=/);
  await expect(page.locator("[data-mesa-partido]")).toBeVisible();
});

test("jornada: conserva destinos del partido, fotos y federación", async ({ page }) => {
  await page.goto("/admin/jornada?semana=2026-09-23");
  const partido = page.locator("[data-mesa-partido]");
  await expect(partido).toBeVisible({ timeout: 30000 });
  await partido.getByText("Más tareas del partido", { exact: true }).click();
  for (const [nombre, destino] of [
    ["Convocatoria", "/admin/convocatoria?"],
    ["Once inicial", "/admin/alineacion?"],
    ["Cartel de partido", "/admin/carteles?plantilla=partido&"],
    ["Cambiar fecha, hora o campo", "/admin/calendario?"],
    ["Ver clasificación", "/admin/clasificacion?"],
    ["Cartel de clasificación", "/admin/carteles?plantilla=clasificacion"],
  ]) {
    const href = await partido
      .getByRole("link", { name: nombre, exact: false })
      .last()
      .getAttribute("href");
    expect(href).toContain(destino);
    if (
      nombre !== "Cartel de clasificación" &&
      nombre !== "Ver clasificación" &&
      nombre !== "Cambiar fecha, hora o campo"
    )
      expect(href).toContain("partido=");
  }
  await expect(partido.getByRole("button", { name: "Fotos del partido" })).toBeVisible();
  await page.getByText("Otras semanas", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Próximos encuentros" })).toHaveAttribute(
    "href",
    "/admin/carteles?plantilla=proximos&rellenar=1",
  );
  // La federación en Jornada solo avisa y lleva a su sección.
  await expect(
    page.getByRole("link", { name: "Ver qué hay traído y traer lo que falte" }),
  ).toHaveAttribute("href", "/admin/federacion");
  // Abrir Carteles solo rellena el editor; nunca generar ni guardar en datos reales.
  const rival = await partido.getByRole("heading", { level: 2 }).textContent();
  await partido.getByRole("link", { name: "Cartel de partido", exact: false }).click();
  await expect(page.getByLabel("Rival", { exact: true })).toHaveValue(rival!, { timeout: 30000 });
});

test("jornada: antes de jugar muestra preparación y explica publicaciones indisponibles", async ({
  page,
}) => {
  await page.goto("/admin/jornada?semana=2027-05-05");
  const partido = page.locator("[data-mesa-partido]");
  await expect(partido).toHaveAttribute("data-fase", "antes", { timeout: 30000 });
  await expect(partido.getByRole("list", { name: "Preparación del partido" })).toBeVisible();
  await expect(partido.getByRole("list", { name: "Cierre del partido" })).toHaveCount(0);
  await partido.getByText("Más tareas del partido", { exact: true }).click();
  await expect(partido.getByText("Cronoloxía", { exact: true })).toBeVisible();
  await expect(partido.getByText("Necesita acta", { exact: true })).toHaveCount(2);
  await expect(partido.getByRole("link", { name: "Cronoloxía" })).toHaveCount(0);
});

test("jornada: último partido permite cerrar y regresar al próximo sin guardar", async ({
  page,
}) => {
  await page.goto("/admin/jornada");
  // Recién jugado sin sus carteles: la mesa ya está en él y no hay «Último partido» aparte.
  await expect(page.locator("[data-mesa-partido]")).toBeVisible({ timeout: 30000 });
  test.skip(
    (await page.locator("[data-mesa-partido]").getAttribute("data-fase")) === "despues",
    "La mesa ya enseña el partido recién jugado",
  );
  const ultimo = page.getByRole("region", { name: "Último partido", exact: true });
  await expect(ultimo).toBeVisible({ timeout: 30000 });
  await ultimo.getByRole("button", { name: "Acta y publicaciones" }).click();
  await expect(page.locator("[data-mesa-partido]")).toHaveAttribute("data-fase", "despues");
  await expect(page.getByRole("list", { name: "Cierre del partido" })).toBeVisible();
  await expect(page.locator("[data-accion-principal]")).toHaveCount(1);
  await page.getByRole("button", { name: "Preparar siguiente", exact: false }).click();
  await expect(page.locator("[data-mesa-partido]")).toHaveAttribute("data-fase", "antes");
});

for (const ancho of [360, 1280]) {
  test(`jornada: cabe a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 720 });
    await page.goto("/admin/jornada");
    await expect(page.locator("[data-mesa-partido]")).toBeVisible({ timeout: 30000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
}
