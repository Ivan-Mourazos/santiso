import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { FormState } from "@/components/admin/cartel/types";
import { aHex, colorDominante, oscurecer } from "./color";
import { leerPeticion } from "./esquema";
import { peticionDeFormulario } from "./formulario";
import { categoriaCartel, fechaCartel, goleadores, PLANTILLAS, urlFoto } from "./modelo";

/** Píxeles RGBA de una imagen hecha con franjas de colores, como un escudo simplificado. */
async function pixeles(franjas: { color: string; alto: number }[], ancho = 40) {
  const alto = franjas.reduce((s, f) => s + f.alto, 0);
  let y = 0;
  const capas = [];
  for (const f of franjas) {
    capas.push({
      input: await sharp({
        create: { width: ancho, height: f.alto, channels: 4, background: f.color },
      })
        .png()
        .toBuffer(),
      top: y,
      left: 0,
    });
    y += f.alto;
  }
  return sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(capas)
    .raw()
    .toBuffer();
}

/** Formulario del Estudio con valores de prueba; `cambios` sobrescribe lo que haga falta. */
function formulario(cambios: Partial<FormState> = {}): FormState {
  return {
    categoria: "Senior",
    jugadorXOffset: 0.5,
    jugadorYOffset: 0.4,
    jugadorZoom: 1.2,
    showCarouselIndicator: false,
    competicion_id: "c",
    competicion: "Tercera Futgal - Grupo 3",
    jornada: "2",
    rivalNombre: "C.D. Berres",
    rivalEscudoUrl: "/media/escudos/berres.webp",
    fecha: "2026-10-04",
    hora: "17:00",
    lugar: "Pardiñeiro",
    santisoSide: "right",
    golesLocal: "1",
    golesRival: "3",
    estadio: "",
    localSponsor: "",
    rivalSponsor: "",
    events: [
      { id: "1", minuto: "10", tipo: "gol", equipo: "rival", jugador: "Rival Uno" },
      { id: "2", minuto: "20", tipo: "gol", equipo: "local", jugador: "Bareto" },
      { id: "3", minuto: "30", tipo: "penalti", equipo: "local", jugador: "Bareto" },
      { id: "4", minuto: "40", tipo: "amarela", equipo: "local", jugador: "Moncho" },
      {
        id: "5",
        minuto: "60",
        tipo: "cambio",
        equipo: "local",
        jugador: "Pío",
        jugadorEntra: "Tato",
      },
      { id: "6", minuto: "", tipo: "amarela", equipo: "rival", jugador: "" },
    ],
    categoriasText: "",
    matches: [
      {
        rival: "Melide",
        rivalEscudoUrl: "/media/m.webp",
        fecha: "2026-10-03",
        categoria: "Veteranos",
        hora: "19:00",
        lugar: "",
        santisoSide: "left",
      },
      {
        rival: "",
        rivalEscudoUrl: "",
        fecha: "",
        categoria: "Senior",
        hora: "",
        santisoSide: "left",
      },
    ],
    jugadorFotoUrl: "",
    noso11Flip: false,
    titulares: [
      { id: "a", dorsal: "1", nome: "Miguel Pampín", eCapitan: false },
      { id: "b", dorsal: "4", nome: "Iago SR", eCapitan: true },
      { id: "c", dorsal: "", nome: "  ", eCapitan: false },
    ],
    suplentes: [],
    multiusosTema: "fichaje",
    multiusosTitulo: "Benvido, Hugo",
    multiusosTexto: "Chega do Arzúa.",
    multiusosImg1Url: "/media/a.webp",
    multiusosImg2Url: "",
    clasificacionTipo: "liga",
    clasificacionNombre: "",
    clasificacionData: [
      { posicion: 1, nombre: "S.D. Cruces", pj: 1, pg: 1, pe: 0, pp: 0, gf: 6, gc: 1, pts: 3 },
      {
        posicion: 2,
        nombre: "U.D. Santiso F.C.",
        pj: 1,
        pg: 0,
        pe: 0,
        pp: 1,
        gf: 1,
        gc: 3,
        pts: 0,
      },
    ],
    showAssets: true,
    ...cambios,
  } as FormState;
}

const recursos = {
  escudosClub: { Senior: "/media/santiso-senior.webp" } as Record<string, string>,
  patrocinadores: ["/media/p.webp"],
  institucionales: ["/media/rfgf.webp"],
  escudosEn3d: [] as string[],
  coloresEquipo: {} as Record<string, string>,
};
const opciones = {
  color: (url: string | null) => (url ? "#d32f2f" : "#64748b"),
  composicion: "diagonal" as const,
  foto: null,
};

describe("colorDominante", () => {
  it("se queda con el color del club, no con el blanco del fondo ni el negro del contorno", async () => {
    const rgba = await pixeles([
      { color: "#ffffff", alto: 40 },
      { color: "#000000", alto: 10 },
      { color: "#1e88e5", alto: 20 },
      { color: "#d32f2f", alto: 8 },
    ]);
    const color = colorDominante(rgba);
    expect(color && aHex(color)).toBe("#1e88e5");
  });

  it("ignora lo transparente y los grises; sin color, null", async () => {
    const rgba = await pixeles([
      { color: "#00000000", alto: 30 },
      { color: "#808080", alto: 30 },
      { color: "#ffffff", alto: 10 },
    ]);
    expect(colorDominante(rgba)).toBeNull();
  });

  it("oscurecer mezcla con negro", () => {
    expect(oscurecer({ r: 200, g: 100, b: 50 }, 0.5)).toEqual({ r: 100, g: 50, b: 25 });
  });
});

describe("modelo", () => {
  it("fecha y categoría en gallego, sin depender de la zona horaria", () => {
    expect(fechaCartel("2026-09-27")).toEqual({ dia: "DOMINGO", numero: "27", mes: "SET" });
    expect(fechaCartel("2026-10-03")).toEqual({ dia: "SÁBADO", numero: "3", mes: "OUT" });
    expect(fechaCartel("")).toBeNull();
    expect(categoriaCartel("Veteranos")).toBe("VETERANOS");
  });

  it("agrupa los goles por jugador, con penaltis y en propia marcados", () => {
    expect(
      goleadores(
        [
          { minuto: "59", jugador: "Bareto", lado: "local", tipo: "gol" },
          { minuto: "66", jugador: "Bareto", lado: "local", tipo: "penalti" },
          { minuto: "80", jugador: "Rival", lado: "local", tipo: "propia" },
          { minuto: "5", jugador: "Otro", lado: "visitante", tipo: "gol" },
        ],
        "local",
      ),
    ).toEqual([
      { nombre: "Bareto", minutos: ["59'", "66' (pen.)"] },
      { nombre: "Rival (p.p.)", minutos: ["80'"] },
    ]);
  });
});

describe("peticionDeFormulario", () => {
  it("partido: el Santiso de visitante con su amarillo; el rival con el color de su escudo", () => {
    const p = peticionDeFormulario("partido", formulario(), recursos, opciones);
    if (p.plantilla !== "partido") throw new Error("plantilla");
    expect(p.datos.local).toMatchObject({ nombre: "C.D. Berres", propio: false, color: "#d32f2f" });
    expect(p.datos.visitante).toMatchObject({
      nombre: "UD Santiso FC",
      propio: true,
      color: "#f5c518",
    });
  });

  it("resultado: goles con el lado del marcador y solo los goles", () => {
    const p = peticionDeFormulario("resumo", formulario(), recursos, opciones);
    if (p.plantilla !== "resultado") throw new Error("plantilla");
    expect([p.datos.golesLocal, p.datos.golesVisitante]).toEqual([1, 3]);
    // El Santiso juega fuera: sus goles («local» en el formulario) son del visitante.
    expect(p.datos.goles).toEqual([
      { minuto: "10", jugador: "Rival Uno", lado: "local", tipo: "gol" },
      { minuto: "20", jugador: "Bareto", lado: "visitante", tipo: "gol" },
      { minuto: "30", jugador: "Bareto", lado: "visitante", tipo: "penalti" },
    ]);
  });

  it("cronoloxía: todos los hechos con nombre, con los tipos traducidos", () => {
    const p = peticionDeFormulario("cronoloxia", formulario(), recursos, opciones);
    if (p.plantilla !== "cronoloxia") throw new Error("plantilla");
    expect(p.datos.eventos.map((e) => e.tipo)).toEqual([
      "gol",
      "gol",
      "penalti",
      "amarilla",
      "cambio",
    ]);
    expect(p.datos.eventos[4]).toMatchObject({ jugador: "Pío", entra: "Tato", lado: "visitante" });
  });

  it("próximos: solo los partidos con rival, con el Santiso de su categoría", () => {
    const p = peticionDeFormulario("proximos", formulario(), recursos, opciones);
    if (p.plantilla !== "proximos") throw new Error("plantilla");
    expect(p.datos.partidos).toHaveLength(1);
    expect(p.datos.partidos[0]!.local.nombre).toBe("UD Santiso FC Solaina");
  });

  it("once: sin jugadores vacíos; la foto con su encuadre", () => {
    const p = peticionDeFormulario(
      "noso11",
      formulario({ jugadorFotoUrl: "/media/foto.webp" }),
      recursos,
      opciones,
    );
    if (p.plantilla !== "once") throw new Error("plantilla");
    expect(p.datos.titulares).toEqual([
      { dorsal: "1", nombre: "Miguel Pampín", capitan: false },
      { dorsal: "4", nombre: "Iago SR", capitan: true },
    ]);
    expect(p.datos.foto).toEqual({ url: "/media/foto.webp", x: 0.5, y: 0.4, zoom: 1.2 });
  });

  it("anuncio: tema e imágenes que hay", () => {
    const p = peticionDeFormulario("multiusos", formulario(), recursos, opciones);
    if (p.plantilla !== "anuncio") throw new Error("plantilla");
    expect(p.datos).toMatchObject({ tema: "fichaje", imagenes: ["/media/a.webp"] });
  });

  it("clasificación: marca la fila del Santiso", () => {
    const p = peticionDeFormulario("clasificacion", formulario(), recursos, opciones);
    if (p.plantilla !== "clasificacion" || p.datos.tipo !== "liga") throw new Error("plantilla");
    expect(p.datos.filas.map((f) => f.propio)).toEqual([false, true]);
    expect(p.datos.titulo).toBe("Tercera Futgal - Grupo 3");
  });
});

describe("escudos del club y relieve", () => {
  it("el Santiso usa el escudo de su equipo de la categoría; si no hay, el del Senior", () => {
    const vet = peticionDeFormulario(
      "partido",
      formulario({ categoria: "Veteranos" }),
      { ...recursos, escudosClub: { Veteranos: "/media/vet.webp", Senior: "/media/sen.webp" } },
      opciones,
    );
    if (vet.plantilla !== "partido") throw new Error("plantilla");
    expect(vet.datos.visitante.escudo).toBe("/media/vet.webp");
    const vetSinEscudo = peticionDeFormulario(
      "partido",
      formulario({ categoria: "Veteranos" }),
      { ...recursos, escudosClub: { Senior: "/media/sen.webp" } },
      opciones,
    );
    if (vetSinEscudo.plantilla !== "partido") throw new Error("plantilla");
    expect(vetSinEscudo.datos.visitante.escudo).toBe("/media/sen.webp");
    const sinEquipo = peticionDeFormulario(
      "partido",
      formulario(),
      { ...recursos, escudosClub: {} },
      opciones,
    );
    if (sinEquipo.plantilla !== "partido") throw new Error("plantilla");
    expect(sinEquipo.datos.visitante.escudo).toBeNull();
  });

  it("el color elegido en Equipos manda sobre el del escudo", () => {
    const p = peticionDeFormulario(
      "partido",
      formulario(),
      { ...recursos, coloresEquipo: { "c d berres": "#1d4ed8" } },
      opciones,
    );
    if (p.plantilla !== "partido") throw new Error("plantilla");
    const rival = p.datos.local.propio ? p.datos.visitante : p.datos.local;
    expect(rival.color).toBe("#1d4ed8");
  });

  it("sin relieve los escudos marcados en 3D; con relieve el resto", () => {
    const p = peticionDeFormulario(
      "partido",
      formulario(),
      { ...recursos, escudosEn3d: ["/media/escudos/berres.webp"] },
      opciones,
    );
    if (p.plantilla !== "partido") throw new Error("plantilla");
    expect(p.datos.local.relieve).toBe(false);
    expect(p.datos.visitante.relieve).toBe(true);
  });
});

describe("leerPeticion", () => {
  it("acepta la petición de cada plantilla sacada del formulario", () => {
    const tipos = [
      "partido",
      "resumo",
      "cronoloxia",
      "proximos",
      "noso11",
      "multiusos",
      "clasificacion",
    ] as const;
    const plantillas = tipos.map((t) => {
      const p = peticionDeFormulario(t, formulario(), recursos, opciones);
      expect(leerPeticion(JSON.parse(JSON.stringify(p))), t).not.toBeNull();
      return p.plantilla;
    });
    expect(plantillas.sort()).toEqual([...PLANTILLAS].sort());
  });

  it("resultado: la foto va con su foco y estilo, y el foco no sale de 0–1", () => {
    const foto = { url: "/media/partidos/f.webp", x: 0.7, y: 0.3, estilo: "amarillo" as const };
    const p = peticionDeFormulario("resumo", formulario(), recursos, { ...opciones, foto });
    if (p.plantilla !== "resultado") throw new Error("plantilla");
    expect(p.datos.foto).toEqual(foto);
    expect(leerPeticion(JSON.parse(JSON.stringify(p)))).not.toBeNull();
    const fuera = { ...p, datos: { ...p.datos, foto: { ...foto, x: 1.4 } } };
    expect(leerPeticion(fuera)).toBeNull();
    const sinEstilo = { ...p, datos: { ...p.datos, foto: { ...foto, estilo: "sepia" } } };
    expect(leerPeticion(sinEstilo)).toBeNull();
  });

  it("rechaza lo que no tiene forma de cartel", () => {
    expect(leerPeticion(null)).toBeNull();
    expect(leerPeticion({ plantilla: "otra", datos: {} })).toBeNull();
    const p = peticionDeFormulario("partido", formulario(), recursos, opciones);
    expect(leerPeticion({ ...p, datos: { ...p.datos, local: { nombre: "x" } } })).toBeNull();
  });
});

describe("urlFoto", () => {
  it("pide la media local al ancho del cartel exportado; lo demás, tal cual", () => {
    expect(urlFoto("/media/partidos/f.webp")).toBe("/media/partidos/f.webp?ancho=2160");
    expect(urlFoto("/media/partidos/f.webp?ancho=480")).toBe("/media/partidos/f.webp?ancho=480");
    expect(urlFoto("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });
});
