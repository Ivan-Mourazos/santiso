import { expect, test, type Page } from "@playwright/test";

/**
 * Presupuestos de pantalla en móvil: en un teléfono no puede hacer falta un scroll interminable.
 * Solo lectura. Las medidas no dependen de cuántos datos haya: se mira lo que ocupa cada fila y
 * que el primer dato quepa en la primera pantalla, no el alto total de la página.
 */

interface Presupuesto {
  seccion: string;
  /** Primera fila de datos de la pantalla. */
  fila: string;
  /** Alto máximo de una fila, en px. */
  altoFila: number;
  /** Pendiente de compactar: se quita al cerrar su pantalla en la Fase 3 del plan. */
  pendiente?: boolean;
}

const PRESUPUESTOS: Presupuesto[] = [
  { seccion: "clasificacion", fila: "main tbody tr", altoFila: 72 },
  { seccion: "estadisticas", fila: "main tbody tr", altoFila: 56 },
  { seccion: "jugadores", fila: "main tbody tr", altoFila: 64 },
  { seccion: "tecnicos", fila: "main tbody tr", altoFila: 64 },
  { seccion: "directiva", fila: "main tbody tr", altoFila: 64 },
  { seccion: "equipos", fila: "main tbody tr", altoFila: 64 },
];

const SECCIONES = [
  "inicio",
  "partidos",
  "federacion",
  "calendario",
  "clasificacion",
  "estadisticas",
  "jugadores",
  "tecnicos",
  "directiva",
  "multas",
  "alineacion",
  "carteles",
  "equipos",
  "patrocinadores",
  "temporadas",
  "ajustes-graficos",
];

async function abrir(page: Page, seccion: string) {
  await page.goto(`/admin/${seccion}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^(Preparando sección|Cargando sección)…$/)).toBeHidden();
  await page.waitForLoadState("networkidle");
}

for (const seccion of SECCIONES) {
  test(`${seccion}: cabecera de una fila y pestañas a un toque`, async ({ page }) => {
    await abrir(page, seccion);
    const cabecera = (await page.locator("header").first().boundingBox())!;
    expect(cabecera.height).toBeLessThanOrEqual(60);
    const pestanas = page.getByRole("navigation", { name: "Accesos rápidos" });
    const inicio = (await pestanas.getByRole("link", { name: "Inicio" }).boundingBox())!;
    expect(Math.round(inicio.height)).toBeGreaterThanOrEqual(44);
    for (const nombre of ["Liga", "Equipo", "Carteles", "Más"]) {
      const caja = (await pestanas.getByRole("button", { name: nombre }).boundingBox())!;
      expect(Math.round(caja.height)).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const ancho of [360, 390]) {
  test(`cabeceras de Cuerpo técnico y Adestramentos enteras a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    for (const seccion of ["tecnicos", "adestramentos"]) {
      await abrir(page, seccion);
      const titulo = page.getByRole("heading", { level: 1 });
      expect(await titulo.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
      const categoria = page.getByRole("group", { name: "Categoría deportiva" });
      const a = (await titulo.boundingBox())!;
      const b = (await categoria.boundingBox())!;
      expect(a.x + a.width).toBeLessThanOrEqual(b.x);
    }
  });

  test(`Goleadores: resumen entero y extremos de Liga visibles a ${ancho}px`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await abrir(page, "liga");
    const resumen = page.getByRole("button", { name: /^Filtros:/ }).locator("span");
    expect(await resumen.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const nav = page.getByRole("navigation", { name: "Liga", exact: true });
    const marco = nav.locator("..");
    for (const [desplazamiento, borde, opuesto] of [
      [0, "final", "inicio"],
      [1000, "inicio", "final"],
    ] as const) {
      await nav.evaluate((el, x) => (el.scrollLeft = x), desplazamiento);
      await expect(marco).toHaveAttribute(`data-hay-${borde}`, "true");
      await expect(marco).not.toHaveAttribute(`data-hay-${opuesto}`, "true");
    }
  });

  test(`Más: Adestramentos ocupa una fila y mantiene su nombre entero a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 800 });
    await abrir(page, "inicio");
    await page.getByRole("button", { name: "Más", exact: true }).tap();
    const enlace = page.getByRole("dialog").getByRole("link", { name: "Adestramentos" });
    await expect(enlace).toBeVisible();
    const medidas = await enlace.evaluate((el) => {
      const texto = el.lastElementChild!;
      const rango = document.createRange();
      rango.selectNodeContents(texto.firstChild!);
      return {
        lineas: rango.getClientRects().length,
        diferencia: el.parentElement!.clientWidth - (el as HTMLElement).offsetWidth,
      };
    });
    expect(medidas).toEqual({ lineas: 1, diferencia: 0 });
  });
}

const PLANTILLAS_CARTEL = ["partido", "proximos", "multiusos", "clasificacion"];
for (const ancho of [360, 390]) {
  for (const plantilla of PLANTILLAS_CARTEL) {
    test(`carteles ${plantilla}: presupuesto de formulario y vista debajo a ${ancho}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: ancho, height: 664 });
      await abrir(page, `carteles?plantilla=${plantilla}`);
      const datos = page.getByRole("region", { name: "Datos del cartel", exact: true });
      const primero = datos
        .locator("input:visible, select:visible, summary:visible, button:visible")
        .first();
      const caja = (await primero.boundingBox())!;
      expect(caja.y + caja.height).toBeLessThanOrEqual(600);
      // Presupuesto por bloque de edición: depende de campos, no de filas de una temporada.
      expect((await datos.boundingBox())!.height).toBeLessThanOrEqual(1100);
      if (plantilla === "proximos") {
        // Se rellena solo con los partidos de la federación: no hay botón de rellenar.
        for (const nombre of ["Preparar carrusel Axenda"]) {
          const accion = (await page
            .getByRole("button", { name: nombre, exact: true })
            .boundingBox())!;
          expect(accion.y + accion.height).toBeLessThanOrEqual(600);
        }
        const filas = datos.locator("[data-partido-plegado] > summary");
        await expect(filas.first()).toBeVisible();
        const altos = await filas.evaluateAll((ns) =>
          ns.map((n) => n.getBoundingClientRect().height),
        );
        expect(Math.max(...altos)).toBeLessThanOrEqual(64);
        await filas.first().tap();
        expect((await datos.boundingBox())!.height).toBeLessThanOrEqual(1100);
      }
      // Sin pestañas: la vista previa va debajo de los datos, en la misma pantalla.
      await page.locator("[data-vista-cartel]").scrollIntoViewIfNeeded();
      await expect(page.locator("[data-vista-cartel] [data-cartel]")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        ancho,
      );
    });
  }
  test(`calendario propio: primera fila compacta y anteriores plegados a ${ancho}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 664 });
    await abrir(page, "calendario?vista=santiso");
    const lista = page.getByRole("region", { name: "Partidos del Santiso", exact: true });
    const filas = lista.locator("[data-contexto=true][data-cambios]");
    await expect(filas.first()).toBeVisible();
    const caja = (await filas.first().boundingBox())!;
    expect(caja.y + caja.height).toBeLessThanOrEqual(600);
    expect(
      Math.max(
        ...(await filas.evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().height))),
      ),
    ).toBeLessThanOrEqual(72);
    const detalle = filas.first().getByRole("button");
    await detalle.tap();
    const hoja = page.getByRole("dialog");
    await expect(hoja).toBeVisible();
    await expect(hoja.getByLabel("Fecha y hora", { exact: true })).toBeVisible();
    await expect(hoja.getByLabel("Campo", { exact: true })).toBeVisible();
    await expect(hoja.getByLabel("Estado", { exact: true })).toBeVisible();
    await expect(hoja.getByRole("button", { name: "Guardar", exact: true })).toBeVisible();
    await hoja.getByRole("button", { name: "Cerrar diálogo", exact: true }).tap();
    await expect(hoja).toBeHidden();
    await expect(detalle).toBeFocused();
    const anteriores = lista.getByRole("button", { name: /^Ver anteriores/ });
    if (await anteriores.count()) {
      const antes = await filas.count();
      await expect(anteriores).toHaveAttribute("aria-expanded", "false");
      await anteriores.tap();
      expect(await filas.count()).toBeGreaterThan(antes);
      await lista.getByRole("button", { name: "Ocultar anteriores", exact: true }).tap();
      await expect(filas).toHaveCount(antes);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      ancho,
    );
  });
}

for (const { seccion, fila, altoFila, pendiente } of PRESUPUESTOS) {
  test(`${seccion}: el primer dato cabe en la primera pantalla y las filas son compactas`, async ({
    page,
  }) => {
    test.fixme(Boolean(pendiente), "Pendiente de compactar (Fase 3 del plan móvil).");
    await abrir(page, seccion);
    const filas = page.locator(fila);
    await expect(filas.first()).toBeVisible();
    const alto = page.viewportSize()!.height;
    const primera = (await filas.first().boundingBox())!;
    expect(primera.y + primera.height).toBeLessThanOrEqual(alto);
    const altos = await filas.evaluateAll((elementos) =>
      elementos.map((elemento) => elemento.getBoundingClientRect().height),
    );
    expect(Math.max(...altos)).toBeLessThanOrEqual(altoFila);
  });
}

test("multas: el bote no parte palabras ni importes y las casillas de normas se tocan bien", async ({
  page,
}) => {
  await abrir(page, "multas");
  await page.getByRole("tab", { name: "Bote" }).tap();
  const tabla = page.getByRole("table", { name: "Multas por persona" });
  if (await tabla.count()) {
    // Cifras y cabeceras en una sola línea: ni «MULT/AS» ni «5 / €». El nombre sí puede partirse.
    const cortes = await tabla
      .locator("thead th:not(:first-child), tbody td")
      .evaluateAll((celdas) => celdas.map((celda) => getComputedStyle(celda).whiteSpace));
    expect(new Set(cortes)).toEqual(new Set(["nowrap"]));
    const caja = (await tabla.boundingBox())!;
    expect(Math.round(caja.x + caja.width)).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await page.getByRole("tab", { name: "Normas" }).tap();
  const casillas = page.locator("label:has(input[type=checkbox])");
  await expect(casillas.first()).toBeVisible();
  const cajas = await casillas.evaluateAll((etiquetas) =>
    etiquetas.map((etiqueta) => Math.round(etiqueta.getBoundingClientRect().height)),
  );
  expect(Math.min(...cajas)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});
