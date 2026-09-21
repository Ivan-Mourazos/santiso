import { expect, test } from "@playwright/test";

const SECCIONES = [
  "Temporadas",
  "Clasificación",
  "Equipos",
  "Jugadores",
  "Patrocinadores",
  "Calendario",
  "Carteles",
  "Actas",
  "Importar jornada",
  "Cuerpo técnico",
  "Directiva",
  "Ajustes gráficos",
];

test("el panel carga con todas sus secciones", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (error) => errores.push(error.message));

  await page.goto("/admin");

  for (const seccion of SECCIONES) {
    await expect(page.getByText(seccion, { exact: true }).first()).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test("la app lee la base de datos local", async ({ request }) => {
  const respuesta = await request.get("/api/estado");
  expect(respuesta.ok()).toBe(true);
  const estado: unknown = await respuesta.json();
  expect(estado).toMatchObject({ ok: true, temporadaActiva: expect.any(String) });
  expect(estado).toHaveProperty("partidos", expect.any(Number));
});

test("sirve la media local", async ({ request }) => {
  const respuesta = await request.get("/media/escudo_club.webp");
  expect(respuesta.status()).toBe(200);
  expect(respuesta.headers()["content-type"]).toBe("image/webp");
});
