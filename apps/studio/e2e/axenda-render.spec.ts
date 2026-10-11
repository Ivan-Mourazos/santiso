import { expect, test, type Locator } from "@playwright/test";
import type { PeticionCartel, EquipoCartel, ContextoDeportivo } from "../lib/cartel2/modelo";

const escudo = (color: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><path fill="${color}" stroke="white" stroke-width="5" d="M10 5h100v80q0 40-50 60Q10 125 10 85Z"/><circle cx="60" cy="60" r="24" fill="white"/></svg>`)}`;
const club: EquipoCartel = {
  nombre: "UD Santiso FC Solaina",
  propio: true,
  escudo: escudo("#f5c518"),
  color: "#f5c518",
  relieve: false,
};
const rivales = ["C.D. Compañía de María", "A.C.U.D. Camporrapado"];
const rival = (i: number): EquipoCartel => ({
  ...club,
  nombre: rivales[i % 2]!,
  propio: false,
  color: i % 2 ? "#2166b4" : "#bd3030",
  escudo: escudo(i % 2 ? "#2166b4" : "#bd3030"),
});
const logos = {
  institucionales: [escudo("#ffffff"), escudo("#ffffee")],
  patrocinadores: ["#eeeeee", "#eeeedd", "#eeeedc", "#eeeedb"].map(escudo),
};
const contexto: ContextoDeportivo = {
  local: { posicion: 3, racha: ["V", "E", "D", "V", "V"] },
  visitante: { posicion: 12, racha: ["D", "D", "E", "V", "D"] },
};

test("PNG real de portada y lámina: doble resolución en publicación e historia", async ({
  request,
}) => {
  test.setTimeout(90000);
  for (const formato of ["publicacion", "historia"] as const)
    for (const plantilla of ["proximos", "partido"] as const) {
      const datos = {
        ...logos,
        local: club,
        visitante: rival(0),
        fecha: "2026-10-18",
        hora: "17:00",
        campo: "A Merced",
        categoria: "Senior",
        competicion: "Liga",
        jornada: "3",
        localidad: "Santiso",
        contexto,
      };
      const peticion: PeticionCartel =
        plantilla === "partido"
          ? { plantilla, formato, composicion: "diagonal", datos }
          : { plantilla, formato, datos: { ...logos, partidos: [datos] } };
      const respuesta = await request.post("/api/carteles/png", { data: peticion });
      expect(respuesta.ok()).toBe(true);
      const png = await respuesta.body();
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
        2160,
        formato === "historia" ? 3840 : 2700,
      ]);
    }
});

async function sinDesbordes(cartel: Locator, historia: boolean) {
  const errores = await cartel.evaluate((el, historia) => {
    const lienzo = el.getBoundingClientRect();
    const salida: string[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || !(n.parentElement instanceof HTMLElement)) continue;
      const padre = n.parentElement;
      if (["STYLE", "SCRIPT"].includes(padre.tagName)) continue;
      const caja = padre.getBoundingClientRect();
      const rango = document.createRange();
      rango.selectNodeContents(n);
      for (const t of rango.getClientRects()) {
        if (
          t.left < caja.left - 4 ||
          t.right > caja.right + 4 ||
          t.top < caja.top - 4 ||
          t.bottom > caja.bottom + 4 ||
          t.left < lienzo.left ||
          t.right > lienzo.right ||
          t.top < lienzo.top + (historia ? 250 : 0) - 1 ||
          t.bottom > lienzo.bottom - (historia ? 250 : 0) + 1
        )
          salida.push(
            JSON.stringify({
              texto: n.textContent.trim(),
              caja: [caja.x, caja.y, caja.width, caja.height],
              textoCaja: [t.x, t.y, t.width, t.height],
              lineHeight: getComputedStyle(padre).lineHeight,
            }),
          );
      }
      if (
        getComputedStyle(padre).display !== "inline" &&
        (padre.scrollWidth > padre.clientWidth + 2 || padre.scrollHeight > padre.clientHeight + 4)
      )
        salida.push("caja: " + n.textContent.trim());
    }
    return [...new Set(salida)];
  }, historia);
  expect(errores).toEqual([]);
}

test("Axenda: 1, 2, 3 y 4 partidos ocupan portada, nombres largos y zonas seguras", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const formato of ["publicacion", "historia"] as const)
    for (const cantidad of [1, 2, 3, 4]) {
      const p: PeticionCartel = {
        plantilla: "proximos",
        formato,
        datos: {
          ...logos,
          partidos: Array.from({ length: cantidad }, (_, i) => ({
            categoria: i % 2 ? "Veteranos" : "Senior",
            local: i % 2 ? rival(i) : club,
            visitante: i % 2 ? club : rival(i),
            fecha: "2026-10-18",
            hora: "17:00",
            campo: "O campo non aparece na portada",
          })),
        },
      };
      await page.evaluate((p) => window.__pintarCartel?.(p), p);
      const cartel = page.locator("[data-listo] [data-cartel]");
      await expect(cartel.locator("[data-axenda-partido]")).toHaveCount(cantidad);
      await cartel.screenshot({ path: info.outputPath(`portada-${cantidad}-${formato}.png`) });
      await sinDesbordes(cartel, formato === "historia");
      await expect(cartel).not.toContainText("O campo non aparece");
      const ocupacion = await cartel.locator("[data-axenda-bandas]").evaluate((el) => {
        const caja = el.getBoundingClientRect();
        const bandas = [...el.children].map((n) => n.getBoundingClientRect());
        return bandas.length ? (bandas.at(-1)!.bottom - bandas[0]!.top) / caja.height : 0;
      });
      expect(ocupacion).toBeGreaterThan(0.95);
      await cartel.screenshot({ path: info.outputPath(`portada-${cantidad}-${formato}.png`) });
    }
});

test("Partido: Diagonal y Enfrentados, sin fecha, contexto completo, parcial o ausente", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const formato of ["publicacion", "historia"] as const)
    for (const composicion of ["diagonal", "enfrentados"] as const)
      for (const datos of [
        contexto,
        undefined,
        {
          local: { posicion: null, racha: [] },
          visitante: { posicion: null, racha: ["V"] as const as ("V" | "E" | "D")[] },
        },
      ]) {
        const p: PeticionCartel = {
          plantilla: "partido",
          formato,
          composicion,
          datos: {
            ...logos,
            local: composicion === "diagonal" ? club : rival(1),
            visitante: composicion === "diagonal" ? rival(0) : club,
            categoria: "Veteranos",
            competicion: "Terceira Galicia — Grupo Santiago de Compostela",
            jornada: "12",
            fecha: datos ? "2026-10-18" : "",
            hora: datos ? "17:00" : "",
            campo: "Campo Municipal de Santa Isabel",
            localidad: "Santiago de Compostela",
            contexto: datos,
          },
        };
        await page.evaluate((p) => window.__pintarCartel?.(p), p);
        const cartel = page.locator("[data-listo] [data-cartel]");
        await expect(cartel).toContainText("Santiago de Compostela");
        await cartel.screenshot({
          path: info.outputPath(
            `partido-${composicion}-${formato}-${datos === contexto ? "completo" : datos ? "parcial" : "vacio"}.png`,
          ),
        });
        await sinDesbordes(cartel, formato === "historia");
        const alto = await cartel.evaluate((el) => el.getBoundingClientRect().height);
        expect(alto).toBe(formato === "historia" ? 1920 : 1350);
        await cartel.screenshot({
          path: info.outputPath(
            `partido-${composicion}-${formato}-${datos === contexto ? "completo" : datos ? "parcial" : "vacio"}.png`,
          ),
        });
      }
});
