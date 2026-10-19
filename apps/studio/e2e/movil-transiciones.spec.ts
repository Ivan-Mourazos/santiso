import { expect, test } from "@playwright/test";

test("entrar desliza hacia delante y volver, hacia atrás, también con el atrás del navegador", async ({
  page,
}) => {
  // Se apuntan los tipos de cada transición de vista que se pide.
  await page.addInitScript(() => {
    const original = document.startViewTransition?.bind(document);
    if (!original) return;
    const tipos: string[][] = [];
    (window as Window & { tiposTransicion?: string[][] }).tiposTransicion = tipos;
    document.startViewTransition = ((arg: unknown) => {
      if (arg && typeof arg === "object" && "types" in arg)
        tipos.push([...((arg as { types?: Iterable<string> }).types ?? [])]);
      return original(arg as never);
    }) as typeof document.startViewTransition;
  });
  const ultimo = async () =>
    (
      await page.evaluate(
        () => (window as Window & { tiposTransicion?: string[][] }).tiposTransicion ?? [],
      )
    ).at(-1) ?? [];
  const cuantos = () =>
    page.evaluate(
      () => (window as Window & { tiposTransicion?: string[][] }).tiposTransicion?.length ?? 0,
    );
  // Antes de cada paso del historial, que acabe la transición anterior: si no, la nueva no anima.
  const sinTransicion = () =>
    page.waitForFunction(
      () => !(document as Document & { activeViewTransition?: unknown }).activeViewTransition,
    );
  await page.goto("/admin/carteles");
  await page.waitForLoadState("networkidle");
  // Del catálogo a un cartel: misma ruta, pero también desliza.
  await page.getByRole("main").getByRole("link", { name: /Cartel de partido/ }).tap();
  await expect(page.getByRole("heading", { level: 1, name: "Cartel de partido" })).toBeVisible();
  await expect.poll(ultimo).toContain("nav-forward");
  let antes = await cuantos();
  await sinTransicion();
  await page.getByRole("button", { name: "Atrás", exact: true }).tap();
  await expect(page.getByRole("heading", { level: 1, name: "Carteles" })).toBeVisible();
  await expect.poll(cuantos).toBeGreaterThan(antes);
  expect(await ultimo()).toContain("recorrido-atras");
  antes = await cuantos();
  await sinTransicion();
  await page.goForward();
  await expect(page.getByRole("heading", { level: 1, name: "Cartel de partido" })).toBeVisible({
    timeout: 10_000,
  });
  await expect.poll(cuantos).toBeGreaterThan(antes);
  expect(await ultimo()).toContain("recorrido-adelante");
  antes = await cuantos();
  await sinTransicion();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Carteles" })).toBeVisible();
  await expect.poll(cuantos).toBeGreaterThan(antes);
  expect(await ultimo()).toContain("recorrido-atras");
  // Tras animar, la pantalla sigue respondiendo: se vuelve a entrar en un cartel.
  await page.getByRole("main").getByRole("link", { name: /Resultado/ }).tap();
  await expect(
    page.getByRole("banner").getByRole("heading", { level: 1, name: "Resultado" }),
  ).toBeVisible();
});
