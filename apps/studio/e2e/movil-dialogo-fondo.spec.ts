import { expect, test } from "@playwright/test";

/**
 * Con un diálogo o una hoja abiertos, la página de detrás no se desplaza ni salta. En Safari no
 * bastaba con bloquear el `body` (`html` lleva `overflow-x: clip`) y bloquear `html` colgaba
 * WebKit en plena transición: el diálogo corta la rueda y el arrastre que moverían el fondo
 * (19/11/2026). Al cerrar, todo vuelve a como estaba y en el mismo sitio. Solo abre y cierra:
 * no guarda nada.
 */
test("el fondo queda quieto con el diálogo abierto y vuelve al cerrarlo", async ({ page }) => {
  await page.goto("/admin/multas");
  const nueva = page.getByRole("button", { name: "Nueva multa", exact: true });
  await expect(nueva).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const antes = await page.evaluate(() => window.scrollY);

  // Una rueda sobre el fondo o sobre lo que no se desplaza del diálogo queda cancelada.
  const cancelada = (selector: string) =>
    page.evaluate((s) => {
      const evento = new WheelEvent("wheel", { deltaY: 400, bubbles: true, cancelable: true });
      document.querySelector(s)!.dispatchEvent(evento);
      return evento.defaultPrevented;
    }, selector);

  await nueva.tap();
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  expect(await cancelada("main")).toBe(true);
  expect(await cancelada("dialog[open] h2")).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);

  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  expect(await cancelada("main")).toBe(false);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
});

test("abrir la ficha de un equipo a media tabla no manda el fondo arriba", async ({ page }) => {
  await page.goto("/admin/clasificacion");
  const filas = page.locator("main button").filter({ hasText: /C\.D\.|S\.D\.|U\.D\./ });
  await expect(filas.first()).toBeVisible({ timeout: 30000 });
  await page.evaluate(() => window.scrollTo(0, 200));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const antes = await page.evaluate(() => window.scrollY);
  // Sin `tap`: Playwright desplazaría hasta la fila antes de tocarla y movería la medida.
  await filas.nth(4).dispatchEvent("click");
  const ficha = page.getByRole("dialog");
  await expect(ficha).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
  await page.keyboard.press("Escape");
  await expect(ficha).toBeHidden();
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
});
