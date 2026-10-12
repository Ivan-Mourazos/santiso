import { expect, test, type Locator } from "@playwright/test";
import sharp from "sharp";
import type { PeticionCartel, EquipoCartel, ContextoDeportivo } from "../lib/cartel2/modelo";

// WebKit recorta capturas fuera del viewport; el lienzo conserva sus medidas fijas.
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1080, height: 1920 });
});

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

const NOMBRES_LECTURA = [
  "Atlético Éter",
  "S.D.C. Recesende",
  "A.C.U.D. Camporrapado",
  "C.D. Compañía de María",
  "Sociedad Deportiva Cultural Recesende de Teo",
];
const jugadoresLectura = Array.from({ length: 22 }, (_, i) => ({
  dorsal: String(i + 1),
  nombre:
    i % 5 === 0 ? "Nicolás Carbajales López" : i % 3 === 0 ? "Manuel Vázquez Novas" : "Iago SR",
  capitan: i === 0,
}));
type PlantillaLectura =
  | "proximos"
  | "resultado"
  | "cronoloxia"
  | "once"
  | "clasificacion"
  | "anuncio"
  | "convocatoria"
  | "alineacion";

function casoLectura(plantilla: PlantillaLectura, nombre: string): PeticionCartel {
  const otro = { ...rival(0), nombre };
  const partido = {
    ...logos,
    local: club,
    visitante: otro,
    club,
    rival: otro,
    categoria: "Senior",
    competicion: "Terceira Futgal · Grupo 3",
    jornada: "3",
    fecha: "2026-10-18",
    hora: "17:00",
    campo: "Municipal de Santiso",
  };
  switch (plantilla) {
    case "proximos":
      return {
        plantilla,
        datos: {
          ...logos,
          partidos: Array.from({ length: 4 }, (_, i) => ({
            ...partido,
            categoria: i % 2 ? "Veteranos" : "Senior",
          })),
        },
      };
    case "resultado":
      return {
        plantilla,
        datos: {
          ...partido,
          golesLocal: 3,
          golesVisitante: 8,
          foto: null,
          goles: jugadoresLectura.slice(0, 8).map((j, i) => ({
            jugador: j.nombre,
            minuto: String(i * 10),
            lado: i < 3 ? "local" : "visitante",
            tipo: "gol",
          })),
        },
      };
    case "cronoloxia":
      return {
        plantilla,
        datos: {
          ...partido,
          golesLocal: 3,
          golesVisitante: 8,
          eventos: Array.from({ length: 26 }, (_, i) => ({
            minuto: String(i * 3),
            tipo: i % 7 === 0 ? "cambio" : "gol",
            lado: i % 2 ? "local" : "visitante",
            jugador: i % 7 === 0 ? "Ramos" : jugadoresLectura[i % 22]!.nombre,
            entra: "Xoel",
          })),
        },
      };
    case "once":
      return {
        plantilla,
        datos: {
          ...partido,
          titulares: jugadoresLectura.slice(0, 11),
          suplentes: jugadoresLectura.slice(11),
          foto: null,
          invertido: false,
        },
      };
    case "alineacion":
      return {
        plantilla,
        datos: {
          ...partido,
          local: true,
          titulares: jugadoresLectura.slice(0, 11),
          suplentes: jugadoresLectura.slice(11),
        },
      };
    case "convocatoria":
      return {
        plantilla,
        datos: {
          ...partido,
          local: true,
          convocados: jugadoresLectura.slice(0, 16),
          horaQuedada: "16:00",
          lugarQuedada: "No campo",
          equipacion: "Amarela",
          nota: "Puntualidade",
        },
      };
    case "clasificacion":
      return {
        plantilla,
        datos: {
          ...logos,
          tipo: "liga",
          categoria: "Senior",
          titulo: "Terceira Futgal",
          escudoClub: club.escudo,
          filas: Array.from({ length: 14 }, (_, i) => ({
            posicion: i + 1,
            nombre: i === 0 ? nombre : i === 11 ? club.nombre : NOMBRES_LECTURA[i % 4]!,
            escudo: club.escudo,
            pj: 2,
            pg: 1,
            pe: 0,
            pp: 1,
            gf: 8,
            gc: 3,
            pts: 3,
            propio: i === 11,
          })),
        },
      };
    case "anuncio":
      return {
        plantilla,
        datos: {
          ...logos,
          tema: "formal",
          titulo: nombre,
          texto:
            "Domingo 18 de outubro · 17:00\nMunicipal de Santiso\nA nosa xente, a nosa forza.\nVémonos no campo.",
          imagenes: [],
          escudoClub: club.escudo,
        },
      };
  }
}

/** Cajas entre sí y texto REAL contra su columna y fila; no basta con límites del lienzo. */
async function conflictosLectura(cartel: Locator) {
  return cartel.evaluate((el) => {
    const errores: string[] = [];
    const rects = (n: Element) => {
      const salida: DOMRect[] = [];
      const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        if (!t.textContent?.trim() || ["STYLE", "SCRIPT"].includes(t.parentElement?.tagName ?? ""))
          continue;
        const r = document.createRange();
        r.selectNodeContents(t);
        salida.push(...r.getClientRects());
      }
      return salida.filter((c) => c.width > 0 && c.height > 0);
    };
    const bloques = [...el.querySelectorAll("[data-lectura-bloque]")];
    for (let i = 0; i < bloques.length; i++)
      for (let j = i + 1; j < bloques.length; j++) {
        const a = bloques[i]!,
          b = bloques[j]!;
        if (a.contains(b) || b.contains(a)) continue;
        const x = a.getBoundingClientRect(),
          y = b.getBoundingClientRect();
        if (
          Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 &&
          Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) >= -1
        )
          errores.push(
            "bloques se tocan: " +
              a.textContent?.slice(0, 45) +
              " / " +
              b.textContent?.slice(0, 45),
          );
      }
    for (const n of el.querySelectorAll("[data-lectura-columna]")) {
      const caja = n.getBoundingClientRect();
      for (const r of rects(n))
        if (r.left < caja.left - 1 || r.right > caja.right + 1)
          errores.push("fuera de columna: " + n.textContent);
    }
    for (const n of el.querySelectorAll("[data-lectura-fila]")) {
      const caja = n.getBoundingClientRect();
      const bloque = n.closest("[data-lectura-bloque]")?.getBoundingClientRect();
      if (bloque && (caja.top < bloque.top - 1 || caja.bottom > bloque.bottom + 1))
        errores.push("fila se sale de bloque: " + n.textContent);
      for (const r of rects(n))
        if (
          r.top < caja.top - 1 ||
          r.bottom > caja.bottom + 1 ||
          r.left < caja.left - 1 ||
          r.right > caja.right + 1
        )
          errores.push(
            "fuera de fila: " +
              n.textContent +
              " " +
              JSON.stringify({
                fila: [caja.x, caja.y, caja.width, caja.height],
                texto: [r.x, r.y, r.width, r.height],
              }),
          );
    }
    return [...new Set(errores)];
  });
}

for (const plantilla of [
  "proximos",
  "resultado",
  "cronoloxia",
  "once",
  "clasificacion",
  "anuncio",
  "convocatoria",
  "alineacion",
] as const) {
  test(`Lectura ${plantilla}: nombres cortos y largos y listas máximas nunca pisan siguiente bloque`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.goto("/render/cartel");
    await page.waitForFunction(() => typeof window.__pintarCartel === "function");
    for (const [i, nombre] of NOMBRES_LECTURA.entries()) {
      await page.evaluate((p) => window.__pintarCartel?.(p), casoLectura(plantilla, nombre));
      const cartel = page.locator("[data-listo] [data-cartel]");
      await expect(cartel.locator("[data-lectura-bloque]").first()).toBeVisible();
      await expect(cartel.locator("[data-cartel-aviso]")).toHaveCount(0);
      expect(await conflictosLectura(cartel)).toEqual([]);
      await sinDesbordes(cartel, plantilla === "alineacion");
      await capturaCompleta(cartel, { path: info.outputPath(`${plantilla}-nombre-${i}.png`) });
    }
  });
}

test("Lectura convocatoria: 22 jugadores y quedada nunca pisan siguiente bloque", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const [i, nombre] of NOMBRES_LECTURA.entries()) {
    const p = casoLectura("convocatoria", nombre);
    if (p.plantilla !== "convocatoria") throw new Error("plantilla");
    p.datos.convocados = jugadoresLectura;
    await page.evaluate((p) => window.__pintarCartel?.(p), p);
    const cartel = page.locator("[data-listo] [data-cartel]");
    await expect(cartel.locator("li")).toHaveCount(22);
    await expect(cartel).toContainText("16:00");
    await expect(cartel).toContainText("No campo");
    expect(await conflictosLectura(cartel)).toEqual([]);
    await sinDesbordes(cartel, false);
    await capturaCompleta(cartel, { path: info.outputPath(`convocatoria-22-nombre-${i}.png`) });
  }
});

test("Lectura resultado: marcador centrado con uno o ambos escudos ausentes", async ({ page }) => {
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const lado of ["local", "visitante", "ambos"] as const) {
    const p = structuredClone(casoLectura("resultado", NOMBRES_LECTURA.at(-1)!));
    if (p.plantilla !== "resultado") throw new Error("plantilla");
    if (lado !== "visitante") p.datos.local.escudo = null;
    if (lado !== "local") p.datos.visitante.escudo = null;
    await page.evaluate((p) => window.__pintarCartel?.(p), p);
    const cartel = page.locator("[data-listo] [data-cartel]");
    const centro = await cartel.locator("[data-resultado-marcador]").evaluate((el) => {
      const r = el.getBoundingClientRect(),
        c = el.closest("[data-cartel]")!.getBoundingClientRect();
      return r.left + r.width / 2 - c.left;
    });
    expect(centro).toBeCloseTo(540, 0);
    expect(await conflictosLectura(cartel)).toEqual([]);
    await sinDesbordes(cartel, false);
  }
});

test("Lectura retrato: once y doce suplentes completos en ambos lados", async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const invertido of [false, true])
    for (const [i, nombre] of NOMBRES_LECTURA.entries()) {
      const p = casoLectura("once", nombre);
      if (p.plantilla !== "once") throw new Error("plantilla");
      p.datos.modoFoto = "retrato";
      p.datos.invertido = invertido;
      p.datos.titulares = p.datos.titulares.map((j, k) => ({
        ...j,
        dorsal: k === 0 ? "26" : j.dorsal,
      }));
      p.datos.foto = { url: club.escudo!, x: 0.5, y: 0.5, zoom: 1 };
      p.datos.suplentes.push({ nombre: "Manuel Vázquez Novas", dorsal: "23", capitan: false });
      await page.evaluate((p) => window.__pintarCartel?.(p), p);
      const cartel = page.locator("[data-listo] [data-cartel]");
      await expect(cartel.locator("ol li")).toHaveCount(11);
      expect(await conflictosLectura(cartel)).toEqual([]);
      await sinDesbordes(cartel, false);
      await capturaCompleta(cartel, {
        path: info.outputPath(`once-retrato-${invertido}-nombre-${i}.png`),
      });
    }
});

test("Lectura capacidad: listas y anuncios excesivos avisan y no generan PNG recortado", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const casos: PeticionCartel[] = [];
  for (const n of [14, 20]) {
    const p = casoLectura("clasificacion", NOMBRES_LECTURA.at(-1)!);
    if (p.plantilla !== "clasificacion" || p.datos.tipo !== "liga") throw new Error("plantilla");
    const fila = p.datos.filas[0]!;
    p.datos.filas = Array.from({ length: n }, (_, i) => ({ ...fila, posicion: i + 1 }));
    casos.push(p);
  }
  const cron = casoLectura("cronoloxia", NOMBRES_LECTURA.at(-1)!);
  if (cron.plantilla !== "cronoloxia") throw new Error("plantilla");
  cron.datos.eventos = Array.from({ length: 26 }, (_, i) => ({
    tipo: "cambio",
    minuto: String(i * 3),
    lado: "local",
    jugador: "Nicolás Carbajales López",
    entra: "Manuel Vázquez Novas",
  }));
  casos.push(cron);
  const anuncio = casoLectura("anuncio", NOMBRES_LECTURA[0]!);
  if (anuncio.plantilla !== "anuncio") throw new Error("plantilla");
  anuncio.datos.texto = Array.from({ length: 20 }, () => "A nosa xente, a nosa forza.").join("\n");
  casos.push(anuncio);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const p of casos) {
    await page.evaluate((p) => window.__pintarCartel?.(p), p);
    await expect(page.locator("[data-cartel-aviso]")).toContainText("O CONTIDO NON CABE");
    const r = await request.post("/api/carteles/png", { data: p, timeout: 30000 });
    expect(r.status()).toBe(422);
    expect((await r.json()).error).toContain("dos láminas");
  }
});

test("Lectura resultado: goleadores del 8-3 no invaden fecha ni patrocinadores", async ({
  page,
  request,
}, info) => {
  const p = structuredClone(casoLectura("resultado", "C.D. Berres"));
  if (p.plantilla !== "resultado") throw new Error("plantilla");
  p.datos.goles = [
    ...[
      "GARCIA REY, ALEJANDRO",
      "LOPEZ PEDREIRA, SERGIO",
      "CERVANTES HERNANDEZ, GRECO SALOMON",
      "SANCHEZ MUNERA, LUIS ALBEIRO",
      "RAMOS GONZALEZ, RODRIGO",
    ].map((jugador, i) => ({
      jugador,
      minuto: String(16 + i * 17),
      lado: "local" as const,
      tipo: "gol" as const,
    })),
    { jugador: "Fury", minuto: "57", lado: "visitante", tipo: "gol" },
    { jugador: "Iago SR", minuto: "75", lado: "visitante", tipo: "gol" },
    { jugador: "Iago SR", minuto: "85", lado: "visitante", tipo: "gol" },
  ];
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  await page.evaluate((p) => window.__pintarCartel?.(p), p);
  const cartel = page.locator("[data-listo] [data-cartel]");
  expect(await conflictosLectura(cartel)).toEqual([]);
  await expect(cartel.locator("[data-cartel-aviso]")).toHaveCount(0);
  await sinDesbordes(cartel, false);
  await capturaCompleta(cartel, { path: info.outputPath("resultado-goleadores-reales.png") });
  const r = await request.post("/api/carteles/png", { data: p });
  expect(r.ok()).toBe(true);
});

test("Lectura PNG: once, alineación y clasificación normales siguen exportando a doble resolución", async ({
  request,
}) => {
  test.setTimeout(60000);
  for (const plantilla of ["once", "alineacion", "clasificacion"] as const) {
    const r = await request.post("/api/carteles/png", {
      data: casoLectura(plantilla, "S.D.C. Recesende"),
    });
    expect(r.ok()).toBe(true);
    const png = await r.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      2160,
      plantilla === "alineacion" ? 3840 : 2700,
    ]);
  }
});

test("Lectura: comprobación detecta nombre agrandado que invade fila vecina", async ({ page }) => {
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  await page.evaluate(
    (p) => window.__pintarCartel?.(p),
    casoLectura("convocatoria", NOMBRES_LECTURA[0]!),
  );
  const cartel = page.locator("[data-listo] [data-cartel]");
  await cartel
    .locator("[data-lectura-columna]")
    .last()
    .evaluate((n) => {
      (n as HTMLElement).style.fontSize = "180px";
    });
  expect((await conflictosLectura(cartel)).length).toBeGreaterThan(0);
});

test("Lectura fondos: campo a lienzo completo y texto sin colisiones sobre foto clara", async ({
  page,
}, info) => {
  const campo =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#b8e49a"/><path d="M40 40h1520v820H40zM800 40v820" stroke="white" fill="none" stroke-width="20"/></svg>',
    );
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const plantilla of ["once", "alineacion"] as const) {
    const p = casoLectura(plantilla, NOMBRES_LECTURA.at(-1)!);
    if (p.plantilla === "once") {
      p.datos.modoFoto = "fondo";
      p.datos.foto = { url: campo, x: 0.3, y: 0.7, zoom: 1.2 };
    } else if (p.plantilla === "alineacion")
      p.datos.foto = { url: campo, x: 0.3, y: 0.7, estilo: "color" };
    await page.evaluate((p) => window.__pintarCartel?.(p), p);
    const cartel = page.locator("[data-listo] [data-cartel]");
    await expect(cartel.locator("[data-foto-fondo] img")).toBeVisible();
    const fondo = await cartel.locator("[data-foto-fondo]").boundingBox();
    expect(fondo?.width).toBe(1080);
    expect(fondo?.height).toBe(plantilla === "alineacion" ? 1920 : 1350);
    expect(await conflictosLectura(cartel)).toEqual([]);
    await sinDesbordes(cartel, plantilla === "alineacion");
    await capturaCompleta(cartel, { path: info.outputPath(plantilla + "-campo-claro.png") });
  }
});

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
      await capturaCompleta(cartel, {
        path: info.outputPath(`portada-${cantidad}-${formato}.png`),
      });
      await sinDesbordes(cartel, formato === "historia");
      await expect(cartel).not.toContainText("O campo non aparece");
      const ocupacion = await cartel.locator("[data-axenda-bandas]").evaluate((el) => {
        const caja = el.getBoundingClientRect();
        const bandas = [...el.children].map((n) => n.getBoundingClientRect());
        return bandas.length ? (bandas.at(-1)!.bottom - bandas[0]!.top) / caja.height : 0;
      });
      expect(ocupacion).toBeGreaterThan(0.95);
      await capturaCompleta(cartel, {
        path: info.outputPath(`portada-${cantidad}-${formato}.png`),
      });
    }
});

/** Ningún nombre de equipo, por largo que sea, baja hasta la línea de fecha y hora. */
async function nombresSobreLaFecha(cartel: Locator) {
  const medidas = await cartel.evaluate((el) => {
    const cando = el.querySelector("[data-cando]")!.getBoundingClientRect();
    return [...el.querySelectorAll("[data-nombre-equipo]")].map((nombre) => {
      const rango = document.createRange();
      rango.selectNodeContents(nombre);
      const cajas = [...rango.getClientRects()];
      return {
        texto: nombre.textContent,
        sobra: cando.top - Math.max(...cajas.map((c) => c.bottom)),
        ancho: Math.max(...cajas.map((c) => c.right)) - Math.min(...cajas.map((c) => c.left)),
        columna: nombre.getBoundingClientRect().width,
      };
    });
  });
  for (const m of medidas) {
    expect(m.sobra, `«${m.texto}» pisa la fecha`).toBeGreaterThanOrEqual(0);
    expect(m.ancho, `«${m.texto}» se sale de su columna`).toBeLessThanOrEqual(m.columna + 1);
  }
}

test("Partido: nombres de rival cortos y largos nunca pisan la fecha", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const formato of ["publicacion", "historia"] as const)
    for (const nombre of [
      "Atlético Éter",
      "S.D.C. Recesende",
      "A.C.U.D. Camporrapado",
      "C.D. Compañía de María",
      "Sociedad Deportiva Cultural Recesende de Teo",
    ]) {
      const p: PeticionCartel = {
        plantilla: "partido",
        formato,
        composicion: "diagonal",
        datos: {
          ...logos,
          local: club,
          visitante: { ...rival(0), nombre },
          categoria: "Veteranos",
          competicion: "Veteranos 1ª Galicia - Grupo 2",
          jornada: "6",
          fecha: "2026-10-17",
          hora: "18:00",
          campo: "Municipal de Santiso",
          localidad: "Arcediago (Santiso)",
          contexto,
        },
      };
      await page.evaluate((p) => window.__pintarCartel?.(p), p);
      const cartel = page.locator("[data-listo] [data-cartel]");
      await expect(cartel).toContainText(nombre);
      await nombresSobreLaFecha(cartel);
      await sinDesbordes(cartel, formato === "historia");
    }
});

test("Partido: sin fecha, contexto completo, parcial o ausente", async ({ page }, info) => {
  test.setTimeout(120000);
  await page.goto("/render/cartel");
  await page.waitForFunction(() => typeof window.__pintarCartel === "function");
  for (const formato of ["publicacion", "historia"] as const)
    for (const composicion of ["diagonal"] as const)
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
        await capturaCompleta(cartel, {
          path: info.outputPath(
            `partido-${composicion}-${formato}-${datos === contexto ? "completo" : datos ? "parcial" : "vacio"}.png`,
          ),
        });
        await sinDesbordes(cartel, formato === "historia");
        await nombresSobreLaFecha(cartel);
        const alto = await cartel.evaluate((el) => el.getBoundingClientRect().height);
        expect(alto).toBe(formato === "historia" ? 1920 : 1350);
        await capturaCompleta(cartel, {
          path: info.outputPath(
            `partido-${composicion}-${formato}-${datos === contexto ? "completo" : datos ? "parcial" : "vacio"}.png`,
          ),
        });
      }
});

/** Detecta también PNG de WebKit con la parte exterior del viewport transparente. */
async function capturaCompleta(cartel: Locator, opciones: Parameters<Locator["screenshot"]>[0]) {
  const png = await cartel.screenshot(opciones);
  const meta = await sharp(png).metadata();
  const { data, info } = await sharp(png)
    .extract({ left: meta.width! - 1, top: 0, width: 1, height: meta.height! })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(
    [...data].filter((_, i) => i % info.channels === info.channels - 1).every((a) => a === 255),
    "PNG completo: ninguna franja queda recortada por el viewport",
  ).toBe(true);
}
