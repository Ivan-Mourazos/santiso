import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const RUTA = "/admin/directo?partido=directo-e2e";

async function abrir(page: Page) {
  await page.goto(RUTA);
  await expect(page.getByLabel("Marcador")).toBeVisible({ timeout: 30000 });
}

/** Apunta un evento desde su botón grande. */
async function apuntar(
  page: Page,
  tipo: "Gol" | "Amarilla" | "Roja" | "Cambio",
  opciones: { rival?: boolean; jugador?: RegExp; sale?: RegExp; dorsal?: string; minuto?: string },
) {
  await page.getByRole("button", { name: tipo, exact: true }).click();
  const hoja = page.getByRole("dialog");
  if (opciones.rival) await hoja.getByRole("button", { name: "Rival", exact: true }).click();
  if (opciones.jugador) await hoja.getByRole("button", { name: opciones.jugador }).click();
  if (opciones.sale) await hoja.getByRole("button", { name: opciones.sale }).click();
  if (opciones.dorsal) await hoja.getByLabel(/dorsal del rival/).first().fill(opciones.dorsal);
  if (opciones.minuto) await hoja.getByLabel("Minuto").fill(opciones.minuto);
  await hoja.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(hoja).toBeHidden();
}

test("apunta en móvil, edita, borra y lo conserva al recargar", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.setViewportSize({ width: 360, height: 740 });
  await abrir(page);
  await expect(page.getByLabel("Marcador")).toContainText("0 – 0");

  await apuntar(page, "Gol", { jugador: /Marca: #1 Uno/, minuto: "12" });
  await apuntar(page, "Amarilla", { rival: true, dorsal: "7", minuto: "30" });
  await apuntar(page, "Cambio", { jugador: /Entra: #3 Tres/, sale: /Sale: #2 Dous/, minuto: "47" });
  // Somos visitantes: Sur 0 – 1 Norte.
  await expect(page.getByLabel("Marcador")).toContainText("0 – 1");
  const lista = page.getByRole("list", { name: "Lo apuntado" });
  await expect(lista.getByRole("listitem")).toHaveCount(3);
  await expect(lista).toContainText("#3 Tres Aliñación Ficticio entra · #2 Dous sale");
  await expect(lista).toContainText("Rival Amarilla · #7");
  // Sin reloj en marcha, 47 en la 1ª parte es descuento.
  await expect(lista).toContainText("45+2");

  // Editar el minuto del gol y borrar la amarilla.
  await lista.getByRole("button", { name: /Gol · #1 Uno/ }).click();
  await page.getByRole("dialog").getByLabel("Minuto").fill("14");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(lista).toContainText("14'");
  await lista.getByRole("button", { name: /Amarilla · #7/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar", exact: true }).click();
  await page.getByRole("button", { name: /^(Aceptar|Confirmar|Sí)/ }).click();
  await expect(lista.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("status").filter({ hasText: "Pendiente" })).toBeHidden({
    timeout: 15000,
  });

  await abrir(page);
  await expect(lista.getByRole("listitem")).toHaveCount(2);
  await expect(lista).toContainText("14'");
  await expect(page.getByLabel("Marcador")).toContainText("0 – 1");
  // Nada se sale de la pantalla del móvil.
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(360);
  expect(errores).toEqual([]);
});

test("sin cobertura queda pendiente y se envía al volver la red", async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrir(page);
  await context.setOffline(true);
  await apuntar(page, "Roja", { rival: true, dorsal: "5", minuto: "60" });
  await apuntar(page, "Gol", { rival: true, dorsal: "9", minuto: "61" });
  await expect(page.getByRole("status").filter({ hasText: "Pendiente de enviar (2)" })).toBeVisible();
  // Dice por qué no se envía.
  await expect(page.getByRole("status").filter({ hasText: "Pendiente" })).toContainText(
    "Sin conexión",
    { timeout: 15000 },
  );
  const lista = page.getByRole("list", { name: "Lo apuntado" });
  await expect(lista.getByRole("listitem")).toHaveCount(4);
  await context.setOffline(false);
  await expect(page.getByRole("status").filter({ hasText: "Pendiente" })).toBeHidden({
    timeout: 30000,
  });
  await abrir(page);
  await expect(lista.getByRole("listitem")).toHaveCount(4);
  await expect(page.getByLabel("Marcador")).toContainText("1 – 1");
});

test("cronómetro: el minuto se pone solo y la vista de cierre lista todo", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-15T16:00:00Z") });
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrir(page);
  // Se puede teclear otra duración (en el móvil no hay flechas).
  const duracion = page.getByLabel("Minutos por parte");
  await duracion.clear();
  await duracion.pressSequentially("40");
  await expect(duracion).toHaveValue("40");
  await duracion.clear();
  await duracion.pressSequentially("45");
  await page.getByRole("button", { name: "Empezar 1ª parte", exact: true }).click();
  await page.clock.fastForward("22:30");
  await page.getByRole("button", { name: "Amarilla", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Minuto")).toHaveValue("23");
  await page.getByRole("dialog").getByRole("button", { name: /Jugador: #2 Dous/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByLabel("Cronómetro", { exact: true })).toHaveText("22:30");

  await page.getByRole("tab", { name: "Para cerrar el acta" }).click();
  const cierre = page.getByRole("region", { name: "Para cerrar el acta" });
  await expect(cierre).toContainText("Sur Convocatoria 1 – 1 Norte Convocatoria");
  await expect(cierre).toContainText("1ª parte");
  await expect(cierre).toContainText("2ª parte");
  const primera = cierre.getByRole("list", { name: "1ª parte" });
  await expect(
    primera.getByRole("listitem").filter({ hasText: "23'" }).filter({ hasText: "Amarilla" }),
  ).toContainText(/Nosotros.*#2 Dous/);
  const segunda = cierre.getByRole("list", { name: "2ª parte" });
  await expect(segunda.getByRole("listitem").filter({ hasText: "Roja" })).toContainText(
    /Rival.*#5/,
  );
});

test("editar el minuto tecla a tecla no cambia de parte", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await abrir(page);
  await apuntar(page, "Roja", { rival: true, dorsal: "4", minuto: "70" });
  const lista = page.getByRole("list", { name: "Lo apuntado" });
  await lista.getByRole("button", { name: /Roja · #4/ }).click();
  const minuto = page.getByRole("dialog").getByLabel("Minuto");
  await minuto.clear();
  await minuto.pressSequentially("50");
  await page.getByRole("dialog").getByRole("button", { name: "Guardar", exact: true }).click();
  const fila = lista.getByRole("listitem").filter({ hasText: "#4" });
  await expect(fila).toContainText("50'");
  await fila.getByRole("button").click();
  await page.getByRole("dialog").getByRole("button", { name: "Borrar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(fila).toHaveCount(0);
});

test("la ficha del partido abre el directo", async ({ page }) => {
  await page.goto("/admin/directo");
  await expect(page.getByText("Abre el directo desde la ficha del partido")).toBeVisible({
    timeout: 30000,
  });
});
