import { expect, test } from "@playwright/test";
import type { PeticionCartel } from "../lib/cartel2/modelo";

// Solo lectura: ninguna acción de guardar ni llamada a Gemini.
for (const ancho of [360, 390]) {
  test(`convocatoria a ${ancho}px: fichas compactas, controles de 44px y barra sobre pestañas`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto("/admin/convocatoria?categoria=Senior");
    const lista = page.getByRole("list", { name: "Plantilla Senior" });
    await expect(lista).toBeVisible({ timeout: 30000 });
    const fichas = lista.getByRole("button");
    expect(await fichas.count()).toBeGreaterThan(0);
    const medidas = await lista.evaluate((el) => {
      const estilo = getComputedStyle(el);
      const alturas = [...el.querySelectorAll("button")].map(
        (b) => b.getBoundingClientRect().height,
      );
      return {
        columnas: estilo.gridTemplateColumns.split(" ").length,
        altura: el.getBoundingClientRect().height,
        maxima: Math.max(...alturas),
        gap: parseFloat(estilo.rowGap),
      };
    });
    expect(medidas.columnas).toBe(2);
    expect(medidas.altura).toBeLessThanOrEqual(2 * 844);
    // Presupuesto independiente del número actual de inscritos: una plantilla de 22.
    expect(11 * medidas.maxima + 10 * medidas.gap).toBeLessThanOrEqual(2 * 844);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const control of await page
      .locator("main button:visible, main select:visible, main summary:visible")
      .all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const barra = page.getByLabel("Acciones de convocatoria");
    const caja = (await barra.boundingBox())!;
    const pestanas = (await page
      .getByRole("navigation", { name: "Accesos rápidos" })
      .boundingBox())!;
    expect(caja.y + caja.height).toBeLessThanOrEqual(pestanas.y + 1);
  });
}

for (const cantidad of [11, 22]) {
  test(`cartel con ${cantidad} convocados: dos columnas y contenido dentro del lienzo`, async ({
    page,
  }, testInfo) => {
    const equipo = {
      nombre: "UD Santiso FC",
      escudo: null,
      propio: true,
      color: "#f5c518",
      relieve: false,
    };
    const peticion: PeticionCartel = {
      plantilla: "convocatoria",
      datos: {
        institucionales: [],
        patrocinadores: [],
        categoria: "Senior",
        competicion: "Terceira Galicia",
        jornada: "5",
        club: equipo,
        rival: { ...equipo, nombre: "Rival de Nome Longo", propio: false },
        local: true,
        fecha: "2026-10-18",
        hora: "17:00",
        campo: "Campo Municipal de Santiso",
        horaQuedada: "16:00",
        lugarQuedada: "Entrada do campo",
        equipacion: "Amarela e negra",
        nota:
          cantidad === 22
            ? Array.from({ length: 20 }, (_, i) => `Aviso ${i + 1}`).join("\n")
            : "Puntualidade. Traede a equipación completa.",
        convocados: Array.from({ length: cantidad }, (_, i) => ({
          dorsal: String(i + 1),
          nombre: `Xogador con nome longo ${i + 1}`,
          capitan: false,
        })),
      },
    };
    await page.goto("/render/cartel");
    await page.waitForFunction(() => typeof window.__pintarCartel === "function");
    await page.evaluate((p) => window.__pintarCartel?.(p), peticion);
    const cartel = page.locator("[data-listo] [data-cartel]");
    await expect(cartel).toBeVisible();
    await expect(cartel.locator("ol li")).toHaveCount(cantidad);
    const medidas = await cartel.evaluate((el) => {
      const lienzo = el.getBoundingClientRect();
      const lista = el.querySelector("ol")!;
      const limites = lista.getBoundingClientRect();
      const dentro = [...lista.querySelectorAll("li, li span")].every((n) => {
        const caja = n.getBoundingClientRect();
        return (
          caja.bottom <= limites.bottom + 1 &&
          caja.right <= limites.right + 1 &&
          n.scrollHeight <= n.clientHeight + 1 &&
          n.scrollWidth <= n.clientWidth + 1
        );
      });
      return {
        ancho: lienzo.width,
        alto: lienzo.height,
        dentro,
        columnas: getComputedStyle(lista).gridTemplateColumns.split(" ").length,
      };
    });
    expect(medidas).toEqual({ ancho: 1080, alto: 1350, dentro: true, columnas: 2 });
    await cartel.screenshot({ path: testInfo.outputPath(`convocatoria-${cantidad}.png`) });
  });
}
