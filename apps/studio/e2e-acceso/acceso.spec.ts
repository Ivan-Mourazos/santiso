import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * El recorrido completo del acceso, en orden: cada paso parte de lo que dejó el anterior
 * (primero no hay usuarios, luego el administrador crea al míster…).
 */
test.describe.configure({ mode: "serial" });

const ADMIN = { nombre: "Iván Ficticio", usuario: "mou", clave: "portero-2026" };
const MISTER = { nombre: "Dani Ficticio", usuario: "dani", clave: "mister-2026" };

async function entrar(page: Page, usuario: string, clave: string) {
  await page.goto("/entrar");
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Entrar" }).click();
}

async function sesionDe(browser: Browser, quien: { usuario: string; clave: string }) {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await entrar(page, quien.usuario, quien.clave);
  await expect(page).toHaveURL(/\/admin\/inicio/);
  return { contexto, page };
}

test("sin sesión no se ve nada: ni pantallas, ni datos, ni imágenes", async ({ page, request }) => {
  await page.goto("/admin/multas");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/render/cartel");
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await request.get("/api/estado")).status()).toBe(401);
  expect((await request.get("/media/equipos/no-existe.png")).status()).toBe(401);
  expect((await request.post("/api/carteles/png", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/admin/acta-detect", { multipart: {} })).status()).toBe(401);
  // Las acciones de servidor son POST a una página: tampoco pasan.
  expect((await request.post("/admin/multas", { data: "[]" })).status()).toBe(401);
});

test("una cookie inventada no abre nada", async ({ browser }) => {
  const contexto = await browser.newContext();
  await contexto.addCookies([
    { name: "santiso_sesion", value: "inventada", url: "http://127.0.0.1:3112" },
  ]);
  const page = await contexto.newPage();
  await page.goto("/admin/multas");
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await contexto.request.get("/api/estado")).status()).toBe(401);
  expect((await contexto.request.get("/media/equipos/no-existe.png")).status()).toBe(401);
  await contexto.close();
});

test("la primera vez se crea el administrador y se entra", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Crea el administrador" })).toBeVisible();
  await page.getByLabel("Tu nombre").fill(ADMIN.nombre);
  await page.getByLabel("Usuario").fill(ADMIN.usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.clave);
  await page.getByLabel("Repite la contraseña").fill("otra-distinta");
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page.locator('p[role="alert"]')).toHaveText("Las dos contraseñas no coinciden.");
  await page.getByLabel("Repite la contraseña").fill(ADMIN.clave);
  await page.getByRole("button", { name: "Crear y entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/inicio/);
  await expect(page.getByText(ADMIN.nombre)).toBeVisible();

  // Ya hay alguien: la pantalla de entrada deja de ofrecer crear el administrador.
  const otro = await page.context().browser()!.newContext();
  const ajena = await otro.newPage();
  await ajena.goto("/entrar");
  await expect(ajena.getByRole("heading", { name: "UD Santiso Studio" })).toBeVisible();
  await expect(ajena.getByLabel("Tu nombre")).toHaveCount(0);
  await otro.close();
});

test("el administrador crea al míster", async ({ browser }) => {
  const { contexto, page } = await sesionDe(browser, ADMIN);
  // Con sesión, la pantalla de entrada manda al panel.
  await page.goto("/entrar");
  await expect(page).toHaveURL(/\/admin\/inicio/);
  await page.getByRole("link", { name: "Usuarios" }).click();
  await expect(page.getByRole("heading", { name: "Quién puede entrar" })).toBeVisible();
  await page.getByRole("textbox", { name: "Nombre", exact: true }).fill(MISTER.nombre);
  await page.getByRole("textbox", { name: "Usuario", exact: true }).fill(MISTER.usuario);
  await page.getByLabel("Contraseña inicial").fill(MISTER.clave);
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText(`${MISTER.usuario} · Cuerpo técnico`)).toBeVisible();
  await contexto.close();
});

test("el míster entra, usa el día a día y no ve lo del administrador", async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await entrar(page, MISTER.usuario, "no-es-esta");
  await expect(page.locator('p[role="alert"]')).toHaveText("Usuario o contraseña incorrectos.");
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel("Contraseña").fill(MISTER.clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/inicio/);

  const menu = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(menu.getByRole("link", { name: "Multas" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Mi cuenta" })).toBeVisible();
  for (const reservada of ["Temporadas", "Ajustes gráficos", "Usuarios"]) {
    await expect(menu.getByRole("link", { name: reservada })).toHaveCount(0);
  }
  await page.goto("/admin/usuarios");
  await expect(page.getByText("Esta sección es solo para el administrador.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quién puede entrar" })).toHaveCount(0);

  // Lo suyo sí funciona: los datos cargan con su sesión.
  expect((await contexto.request.get("/api/estado")).status()).toBe(200);
  await page.goto("/admin/multas");
  await expect(page.getByRole("heading", { name: "Multas", level: 1 })).toBeVisible();
  await contexto.close();
});

test("en el móvil cada uno tiene sus pestañas", async ({ browser }) => {
  const movil = { viewport: { width: 360, height: 780 }, hasTouch: true };
  for (const [quien, esperadas, ausente] of [
    [MISTER, ["Inicio", "Liga", "Once", "Multas"], "Carteles"],
    [ADMIN, ["Inicio", "Liga", "Carteles", "Multas"], "Once"],
  ] as const) {
    const contexto = await browser.newContext(movil);
    const page = await contexto.newPage();
    await entrar(page, quien.usuario, quien.clave);
    await expect(page).toHaveURL(/\/admin\/inicio/);
    const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
    for (const nombre of esperadas) {
      const caja = (await pestanas.getByRole("link", { name: nombre, exact: true }).boundingBox())!;
      expect(Math.round(caja.height)).toBeGreaterThanOrEqual(44);
    }
    await expect(pestanas.getByRole("link", { name: ausente, exact: true })).toHaveCount(0);
    // El resto del menú, en la hoja de «Más».
    await expect(pestanas.getByRole("button", { name: "Más" })).toHaveCount(1);
    // Ninguna etiqueta se sale de su pestaña ni ensancha la pantalla.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const desbordadas = await pestanas
      .locator("a, button")
      .evaluateAll((items) => items.filter((i) => i.scrollWidth > i.clientWidth + 1).length);
    expect(desbordadas).toBe(0);
    await contexto.close();
  }
});

test("el cartel se exporta a PNG con la sesión de quien lo pide", async ({ browser }) => {
  test.setTimeout(90_000);
  const { contexto } = await sesionDe(browser, MISTER);
  const escudo = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><path fill="#f5c518" d="M10 5h100v80q0 40-50 60Q10 125 10 85Z"/></svg>')}`;
  const equipo = { nombre: "Río Ficticio", propio: true, escudo, color: "#f5c518", relieve: false };
  const respuesta = await contexto.request.post("/api/carteles/png", {
    data: {
      plantilla: "partido",
      formato: "publicacion",
      composicion: "diagonal",
      datos: {
        institucionales: [],
        patrocinadores: [],
        local: equipo,
        visitante: { ...equipo, nombre: "Rival Ficticio", propio: false, color: "#bd3030" },
        fecha: "2026-10-18",
        hora: "17:00",
        campo: "A Merced",
        categoria: "Senior",
        competicion: "Liga",
        jornada: "3",
        localidad: "Santiso",
      },
    },
  });
  expect(respuesta.status()).toBe(200);
  const png = await respuesta.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([2160, 2700]);
  await contexto.close();
});

test("cada uno se cambia su contraseña y sale", async ({ browser }) => {
  const { contexto, page } = await sesionDe(browser, MISTER);
  await page.getByRole("link", { name: "Mi cuenta" }).click();
  await page.getByLabel("Contraseña actual").fill(MISTER.clave);
  await page.getByLabel("Contraseña nueva", { exact: true }).fill("mister-nueva-2026");
  await page.getByLabel("Repite la contraseña nueva").fill("mister-nueva-2026");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByText("Contraseña cambiada")).toBeVisible();
  MISTER.clave = "mister-nueva-2026";

  await page.getByRole("region", { name: "Cerrar sesión" }).getByRole("button").click();
  await expect(page).toHaveURL(/\/entrar$/);
  await page.goto("/admin/multas");
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await contexto.request.get("/api/estado")).status()).toBe(401);
  await contexto.close();
});

test("quitar el acceso echa al momento a quien estaba dentro", async ({ browser }) => {
  const mister = await sesionDe(browser, MISTER);
  const admin = await sesionDe(browser, ADMIN);
  await admin.page.getByRole("link", { name: "Usuarios" }).click();
  await admin.page.getByRole("button", { name: `Quitar el acceso a ${MISTER.nombre}` }).click();
  await admin.page.getByRole("dialog").getByRole("button").last().click();
  await expect(admin.page.getByText("· sin acceso")).toBeVisible();

  expect((await mister.contexto.request.get("/api/estado")).status()).toBe(401);
  await mister.page.goto("/admin/multas");
  await expect(mister.page).toHaveURL(/\/entrar$/);
  await entrar(mister.page, MISTER.usuario, MISTER.clave);
  await expect(mister.page.locator('p[role="alert"]')).toHaveText(
    "Usuario o contraseña incorrectos.",
  );

  // El administrador no puede dejarse fuera a sí mismo.
  await expect(
    admin.page.getByRole("button", { name: `Quitar el acceso a ${ADMIN.nombre}` }),
  ).toBeVisible();
  await admin.page.getByRole("button", { name: `Quitar el acceso a ${ADMIN.nombre}` }).click();
  await admin.page.getByRole("dialog").getByRole("button").last().click();
  await expect(admin.page.getByText("No puedes quitarte el acceso a ti mismo.")).toBeVisible();
  await mister.contexto.close();
  await admin.contexto.close();
});

test("probar contraseñas tiene un límite", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Usuario").fill("alguien");
  for (let intento = 0; intento < 5; intento += 1) {
    await page.getByLabel("Contraseña").fill(`prueba-numero-${intento}`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.locator('p[role="alert"]')).toHaveText("Usuario o contraseña incorrectos.");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  }
  await page.getByLabel("Contraseña").fill("otra-prueba-mas");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator('p[role="alert"]')).toContainText("Demasiados intentos");
});
