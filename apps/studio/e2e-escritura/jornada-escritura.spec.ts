import { expect, test } from "@playwright/test";

/**
 * `sembrar.ts` deja en la copa «Vestiario» un partido en cada punto del recorrido. Cada uno
 * cae en su propia semana.
 */
const RECORRIDO = [
  ["sin-nada", "2099-06-07", "Preparar convocatoria"],
  ["convocado", "2099-06-14", "Completar once"],
  ["once", "2099-06-21", "Preparar cartel de partido"],
  ["jugado", "2001-06-03", "Anotar resultado"],
  ["resultado", "2099-07-05", "Completar acta"],
  ["acta", "2099-07-12", "Preparar publicaciones"],
] as const;

const ruta = (paso: string) => {
  const semana = RECORRIDO.find(([nombre]) => nombre === paso)![1];
  return `/admin/jornada?categoria=Senior&semana=${semana}&partido=vestiario-${paso}`;
};

test("jornada: la acción principal sigue lo que hay guardado de cada partido", async ({ page }) => {
  for (const [paso, , accion] of RECORRIDO) {
    await page.goto(ruta(paso));
    const principal = page.locator("[data-accion-principal]");
    await expect(principal).toHaveText(`${accion}→`, { timeout: 30000 });
    await expect(principal).toHaveCount(1);
  }
});

test("jornada: los pasos enseñan su estado y tras el acta se abren las publicaciones", async ({
  page,
}) => {
  await page.goto(ruta("once"));
  await expect(page.getByText("11 guardados", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("11/11", { exact: true })).toBeVisible();

  await page.goto(ruta("acta"));
  await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Empate 0–0", { exact: true })).toBeVisible();
  await page.getByText("Más tareas del partido", { exact: true }).click();
  for (const nombre of ["Resultado", "Cronoloxía", "O noso 11"])
    await expect(page.getByRole("link", { name: nombre, exact: false }).last()).toBeVisible();
});

test("jornada: antes del partido avisa de sanciones del rival y de cambios de la federación", async ({
  page,
}) => {
  await page.goto(ruta("sin-nada"));
  const mesa = page.locator("[data-mesa-partido]");
  await expect(mesa.getByText("La federación cambió este partido:")).toBeVisible({ timeout: 30000 });
  await expect(mesa.getByText("07/06 17:00", { exact: false }).first()).toBeVisible();
  const sanciones = mesa.getByRole("region", { name: "Sanciones y apercibidos" });
  await expect(sanciones.getByText("Xan Apercibido Ficticio", { exact: false })).toBeVisible();
  await expect(sanciones.getByText(/4 amarillas: con la siguiente/)).toBeVisible();
  await expect(sanciones.getByText("Brais Expulsado Ficticio", { exact: false })).toBeVisible();
  await expect(sanciones.getByText(/al menos 1 partido/)).toBeVisible();

  // En un partido ya jugado no pinta nada de eso.
  await page.goto(ruta("acta"));
  await expect(page.locator("[data-mesa-partido]")).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("region", { name: "Sanciones y apercibidos" })).toHaveCount(0);
});
