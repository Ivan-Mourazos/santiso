import { expect, test } from "@playwright/test";

/**
 * `sembrar.ts` deja en la copa «Vestiario» un partido en cada punto del recorrido. Cada uno
 * cae en su propia semana.
 */
const RECORRIDO = [
  ["sin-nada", "Preparar convocatoria"],
  ["convocado", "Completar once"],
  ["once", "Preparar cartel de partido"],
  ["jugado", "Anotar resultado"],
  ["resultado", "Completar acta"],
  ["acta", "Preparar publicaciones"],
] as const;

const ruta = (indice: number, paso: string) => {
  // «jugado» va en el pasado: su hora ya pasó y no tiene marcador.
  const semana =
    paso === "jugado" ? "2001-06-03" : `2099-06-${String(7 + indice * 7).padStart(2, "0")}`;
  return `/admin/jornada?categoria=Senior&semana=${semana}&partido=vestiario-${paso}`;
};

test("jornada: la acción principal sigue lo que hay guardado de cada partido", async ({ page }) => {
  for (const [indice, [paso, accion]] of RECORRIDO.entries()) {
    await page.goto(ruta(indice, paso));
    const principal = page.locator("[data-accion-principal]");
    await expect(principal).toHaveText(`${accion}→`, { timeout: 30000 });
    await expect(principal).toHaveCount(1);
  }
});

test("jornada: los pasos enseñan su estado y tras el acta se abren las publicaciones", async ({
  page,
}) => {
  await page.goto(ruta(2, "once"));
  await expect(page.getByText("11 guardados", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("11/11", { exact: true })).toBeVisible();

  await page.goto(ruta(5, "acta"));
  await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Empate 0–0", { exact: true })).toBeVisible();
  await page.getByText("Más tareas del partido", { exact: true }).click();
  for (const nombre of ["Resultado", "Cronoloxía", "O noso 11"])
    await expect(page.getByRole("link", { name: nombre, exact: false }).last()).toBeVisible();
});
