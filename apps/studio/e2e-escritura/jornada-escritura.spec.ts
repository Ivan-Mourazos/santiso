import { expect, test } from "@playwright/test";

/**
 * `sembrar.ts` deja en la copa «Vestiario» un partido en cada punto del recorrido. Cada uno
 * cae en su propia semana. Antes del partido, lo primero es el cartel de partido; sin carteles
 * guardados, es lo que pide cada uno.
 */
const RECORRIDO = [
  ["sin-nada", "2099-06-07", "Preparar cartel de partido"],
  ["convocado", "2099-06-14", "Preparar cartel de partido"],
  ["once", "2099-06-21", "Preparar cartel de partido"],
  // La copa está enlazada con la federación: el marcador lo trae ella.
  ["jugado", "2001-06-03", "Esperando a la federación · Traer ahora"],
  ["resultado", "2099-07-05", "Completar acta"],
  ["acta", "2099-07-12", "Hacer cartel de resultado"],
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
  await expect(page.getByText("11 convocados · Sin cartel", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("11/11 · Sin cartel", { exact: true })).toBeVisible();

  await page.goto(ruta("acta"));
  await expect(page.getByText("Guardada", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Empate 0–0", { exact: true })).toBeVisible();
  await page.getByText("Más tareas del partido", { exact: true }).click();
  for (const nombre of ["Resultado", "Cronoloxía", "O noso 11"])
    await expect(page.getByRole("link", { name: nombre, exact: false }).last()).toBeVisible();
});

test("jornada: con el cartel de partido guardado, lo siguiente es la convocatoria", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto(ruta("convocado"));
  const mesa = page.locator("[data-mesa-partido]");
  await expect(mesa.locator("[data-accion-principal]")).toHaveText(
    "Preparar cartel de partido→",
    { timeout: 30000 },
  );
  await mesa.locator("[data-accion-principal]").click();
  await expect(page).toHaveURL(/plantilla=partido&partido=vestiario-convocado/);
  const panel = page.getByRole("region", { name: "Cartel de partido: carteles guardados" });
  await panel.getByRole("button", { name: "Generar cartel", exact: true }).click({
    timeout: 30000,
  });
  // El cartel de partido se guarda en sus dos formatos a la vez.
  await expect(panel.getByRole("button", { name: "Ver en grande: Publicación" })).toBeVisible({
    timeout: 60000,
  });
  await expect(panel.getByRole("button", { name: "Ver en grande: Historia" })).toBeVisible();
  await page.goto(ruta("convocado"));
  await expect(mesa.getByText("Cartel guardado", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(mesa.locator("[data-accion-principal]")).toHaveText("Preparar convocatoria→");
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
