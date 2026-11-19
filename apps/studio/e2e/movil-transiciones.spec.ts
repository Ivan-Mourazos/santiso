import { expect, test } from "@playwright/test";

test("el marcador comparte la transición entre la fila y la hoja", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Chromium expone las animaciones de las capturas");
  await page.addInitScript(() => {
    const original = document.startViewTransition.bind(document);
    const capturas: string[][] = [];
    Object.assign(window, { capturas });
    document.startViewTransition = ((argumento: Parameters<Document["startViewTransition"]>[0]) => {
      const transicion = original(argumento);
      if (argumento && typeof argumento === "object" && argumento.types?.includes("partido")) {
        void transicion.ready.then(() => {
          capturas.push(
            document.getAnimations().flatMap(({ effect }) =>
              effect instanceof KeyframeEffect && effect.pseudoElement ? [effect.pseudoElement] : [],
            ),
          );
        }).catch(() => capturas.push([]));
      }
      return transicion;
    }) as Document["startViewTransition"];
  });
  await page.goto("/admin/partidos");
  const fila = page.locator("button[data-id-partido]").first();
  await fila.tap();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  const capturas = () =>
    page.evaluate(() => (window as Window & { capturas?: string[][] }).capturas ?? []);
  await expect.poll(capturas).toHaveLength(1);
  expect((await capturas())[0]).toEqual(expect.arrayContaining([
    "::view-transition-old(marcador-partido)",
    "::view-transition-new(marcador-partido)",
  ]));
  await page.waitForFunction(() => !(document as Document & { activeViewTransition?: unknown }).activeViewTransition);
  await dialogo.getByRole("button", { name: "Cerrar partido" }).tap();
  await expect(dialogo).toBeHidden();
  await expect.poll(capturas).toHaveLength(2);
  expect((await capturas())[1]).toEqual(expect.arrayContaining([
    "::view-transition-old(marcador-partido)",
    "::view-transition-new(marcador-partido)",
  ]));
});

test("la hoja, la pulsación y el plegable quedan instantáneos con movimiento reducido", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/admin/inicio");
  const tarjeta = page.locator("[data-destacada]");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta).toHaveCSS("transition-duration", "0s");
  await tarjeta.locator("[data-abrir-partido]").tap();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toHaveCSS("transition-duration", "0s");
  await expect(dialogo).toHaveCSS("animation-name", "none");
  await dialogo.getByRole("button", { name: "Cerrar partido" }).tap();
  await expect(dialogo).toBeHidden();
  await page.locator("button[data-id-partido]").first().tap();
  await expect(dialogo).toBeVisible();
  expect(await page.evaluate(
    () => Boolean((document as Document & { activeViewTransition?: unknown }).activeViewTransition),
  )).toBe(false);
  await page.goto("/admin/carteles?plantilla=despues");
  const resumen = page.locator("main details > summary").filter({ hasText: "Otro partido" }).first();
  const flecha = resumen.locator("svg");
  await expect(flecha).toHaveCSS("transition-duration", "0s");
  await resumen.tap();
  await expect(resumen.locator("..")).toHaveAttribute("open", "");
});

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
