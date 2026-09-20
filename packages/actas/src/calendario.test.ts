import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as unpdf from "unpdf";
import senior from "./fixtures/calendario-senior.json";
import veteranos from "./fixtures/calendario-veteranos.json";
import { parsearCalendario, parsearCalendarioPdf } from "./calendario";
import type { FragmentoCalendario } from "./calendario";

vi.mock("unpdf", async (original) => ({ ...(await original<typeof unpdf>()) }));
type Paginas = FragmentoCalendario[][];
const copia = (paginas: Paginas = senior): Paginas => structuredClone(paginas);

// PDF mínimo sin metadatos: únicamente texto sintético y geometría de las fixtures.
function pdfSintetico(paginas: Paginas, rotation = 0): Uint8Array {
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];
  const hijos: string[] = [];
  for (const pagina of paginas) {
    const id = objetos.length + 1;
    hijos.push(`${id} 0 R`);
    const contenido = pagina
      .map(({ texto, x, y }) => {
        const literal = texto.replace(/([\\()])/g, "\\$1");
        return `BT /F1 5 Tf 1 0 0 1 ${x * 595} ${(1 - y) * 842} Tm (${literal}) Tj ET`;
      })
      .join("\n");
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Rotate ${rotation} /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    objetos.push(
      `<< /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`,
    );
  }
  objetos[1] = `<< /Type /Pages /Kids [${hijos.join(" ")}] /Count ${paginas.length} >>`;
  let cuerpo = "%PDF-1.4\n";
  const offsets = [0];
  objetos.forEach((objeto, i) => {
    offsets.push(Buffer.byteLength(cuerpo, "latin1"));
    cuerpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const xref = Buffer.byteLength(cuerpo, "latin1");
  cuerpo += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  cuerpo += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  cuerpo += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(cuerpo, "latin1"));
}

function cambiar(paginas: Paginas, texto: string, nuevo: string, pagina = 1) {
  const item = paginas[pagina]!.find((f) => f.texto === texto);
  if (!item) throw new Error("Falta dato de prueba");
  item.texto = nuevo;
}

afterEach(() => vi.restoreAllMocks());

describe("calendarios completos", () => {
  it.each([
    [senior, "SENIOR", 14, 26, 182, "2026-09-27", "2027-05-09"],
    [veteranos, "VETERANOS", 16, 30, 240, "2026-09-12", "2027-05-15"],
  ] as const)(
    "resuelve catálogo, columnas y vueltas: %#",
    (paginas, clase, equipos, jornadas, partidos, inicio, fin) => {
      const c = parsearCalendario(paginas);
      expect(c.competicion).toBe(`LIGA SINTETICA ${clase} | GRUPO 1`);
      expect(c.temporada).toBe("2026-2027");
      expect(c.equipos).toHaveLength(equipos);
      expect(c.equipos[0]!.codigoFederativo).toBe("090006");
      expect(c.jornadas).toHaveLength(jornadas);
      expect(c.jornadas.map((j) => j.numero)).toEqual(
        Array.from({ length: jornadas }, (_, i) => i + 1),
      );
      expect(c.jornadas.flatMap((j) => j.partidos)).toHaveLength(partidos);
      expect(c.jornadas[0]!.fechaNominal).toBe(inicio);
      expect(c.jornadas.at(-1)!.fechaNominal).toBe(fin);
      for (const j of c.jornadas) {
        expect(Object.keys(j).sort()).toEqual(["fechaNominal", "numero", "partidos"]);
        expect(j.partidos).toHaveLength(equipos / 2);
        expect(
          new Set(
            j.partidos.flatMap((p) => [p.local.codigoFederativo, p.visitante.codigoFederativo]),
          ).size,
        ).toBe(equipos);
        for (const p of j.partidos) expect(Object.keys(p).sort()).toEqual(["local", "visitante"]);
      }
      expect(Object.keys(c).sort()).toEqual(["competicion", "equipos", "jornadas", "temporada"]);
    },
  );

  it("conserva guiones internos y recompone ambos lados multilínea", () => {
    const c = parsearCalendario(veteranos);
    expect(c.jornadas[0]!.partidos.slice(0, 4)).toEqual([
      {
        local: { nombre: "Q.E. VONAKYZUX IQEVON", codigoFederativo: "090016" },
        visitante: {
          nombre: "VONA KYZUXIQ EV ONAKYZUXI-QEVONAKYZ UXIQEVONA",
          codigoFederativo: "090030",
        },
      },
      {
        local: { nombre: "ZU XIQE - VONAKYZU", codigoFederativo: "090012" },
        visitante: { nombre: "K.Y. ZUXIQE V.O.N A.", codigoFederativo: "090034" },
      },
      {
        local: { nombre: "Z.U. XIQEVON", codigoFederativo: "090036" },
        visitante: { nombre: "NAKY ZUX IQEVONAKY", codigoFederativo: "090008" },
      },
      {
        local: { nombre: "QEVONAKYZUXIQ EVON AKYZUXI QEVONAKY", codigoFederativo: "090028" },
        visitante: { nombre: "VONAKYZUX IQEVONAK YZUXI QE VONAKYZ", codigoFederativo: "090018" },
      },
    ]);
  });

  it("usa coordenadas aunque PDF entregue fragmentos desordenados; no muta entrada", () => {
    const paginas = copia(veteranos).map((p) => p.reverse());
    const antes = structuredClone(paginas);
    expect(parsearCalendario(paginas)).toEqual(parsearCalendario(veteranos));
    expect(paginas).toEqual(antes);
  });
});

describe("rechazo atómico de calendarios inconsistentes", () => {
  it.each([
    ["vacío", (p: Paginas) => p.splice(0)],
    ["página truncada", (p: Paginas) => p.pop()],
    ["competición ausente", (p: Paginas) => cambiar(p, "LIGA SINTETICA SENIOR | GRUPO 1", "", 0)],
    [
      "temporada incoherente",
      (p: Paginas) => cambiar(p, "Temporada 2026-2027", "Temporada 2026-2028", 0),
    ],
    ["catálogo incompleto", (p: Paginas) => cambiar(p, "14.-", "", 0)],
    [
      "código duplicado",
      (p: Paginas) => cambiar(p, 'N.A.K YZUXI "Q" (090008)', 'N.A.K YZUXI "Q" (090006)', 0),
    ],
    [
      "nombre ambiguo",
      (p: Paginas) => cambiar(p, 'N.A.K YZUXI "Q" (090008)', "VONAK YZUXIQ E.V. (090008)", 0),
    ],
    [
      "jornada repetida",
      (p: Paginas) => cambiar(p, "Jornada 2 (04-10-2026)", "Jornada 1 (04-10-2026)"),
    ],
    [
      "jornada no consecutiva",
      (p: Paginas) => cambiar(p, "Jornada 2 (04-10-2026)", "Jornada 99 (04-10-2026)"),
    ],
    [
      "fecha imposible",
      (p: Paginas) => cambiar(p, "Jornada 1 (27-09-2026)", "Jornada 1 (31-09-2026)"),
    ],
    [
      "fecha fuera de temporada",
      (p: Paginas) => cambiar(p, "Jornada 1 (27-09-2026)", "Jornada 1 (27-09-2025)"),
    ],
    [
      "cabecera malformada",
      (p: Paginas) => cambiar(p, "Jornada 1 (27-09-2026)", "Jornada 1 (pendiente)"),
    ],
    ["equipo desconocido", (p: Paginas) => cambiar(p, "VONAK YZUXIQ E.V.", "EQUIPO DESCONOCIDO")],
    ["equipo repetido", (p: Paginas) => cambiar(p, "VONAK YZUXIQ E.V.", "QEVONAKY Z.U.")],
    [
      "partido contra sí mismo",
      (p: Paginas) => cambiar(p, "VONAK YZUXIQ E.V.", "K.Y. ZUXIQEVO NA KYZUX"),
    ],
    ["partido incompleto", (p: Paginas) => cambiar(p, "VONAK YZUXIQ E.V.", "")],
    [
      "texto sobrante",
      (p: Paginas) => p[1]!.push({ texto: "RESTO NO RECONOCIDO", x: 0.15, y: 0.25 }),
    ],
    [
      "coordenadas inválidas",
      (p: Paginas) => {
        p[1]![5]!.x = NaN;
      },
    ],
  ])("rechaza %s", (_, mutar) => {
    const p = copia();
    mutar(p);
    expect(() => parsearCalendario(p)).toThrow();
  });

  it("rechaza cruces duplicados aunque cada jornada incluya todos los equipos", () => {
    const p = copia();
    // Renombrar dos equipos en una jornada conserva 7 partidos y 14 equipos,
    // pero repite cruces de otras jornadas y rompe la liga completa.
    const a = "VONAK YZUXIQ E.V.",
      b = "QEVONAKY Z.U.";
    for (const f of p[1]!)
      if (f.x < 0.5 && f.y > 0.1571 && f.y < 0.25) {
        if (f.texto === a) f.texto = b;
        else if (f.texto === b) f.texto = a;
      }
    expect(() => parsearCalendario(p)).toThrow(/cruce|vuelta|duplicad/i);
  });

  it("rechaza vuelta con misma localía aunque pares no ordenados coincidan", () => {
    const p = copia();
    const a = p[1]!.find((f) => f.x > 0.5 && f.texto === "K.Y. ZUXIQEVO NA KYZUX")!;
    const b = p[1]!.find((f) => f.x > 0.5 && f.texto === "VONAK YZUXIQ E.V.")!;
    [a.texto, b.texto] = [b.texto, a.texto];
    expect(() => parsearCalendario(p)).toThrow(/cruce|vuelta|duplicad/i);
  });
});

describe("adaptador PDF", () => {
  it.each([[senior], [veteranos]])("extrae PDF sintético sin alterar bytes", async (paginas) => {
    const bytes = pdfSintetico(paginas);
    const original = bytes.slice();
    expect(await parsearCalendarioPdf(bytes)).toEqual(parsearCalendario(paginas));
    expect(bytes).toEqual(original);
  });

  it("no extrae páginas de anexos y libera PDF al terminar", async () => {
    const real = unpdf.getDocumentProxy;
    const pdf = await real(pdfSintetico([...veteranos, [], [], []]));
    const getPage = vi.spyOn(pdf, "getPage");
    const destroy = vi.spyOn(pdf.loadingTask, "destroy");
    vi.spyOn(unpdf, "getDocumentProxy").mockResolvedValueOnce(pdf);
    const c = await parsearCalendarioPdf(new Uint8Array([1]));
    expect(c.jornadas).toHaveLength(30);
    expect(getPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4]);
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("libera PDF ante errores de validación", async () => {
    const pdf = await unpdf.getDocumentProxy(pdfSintetico([senior[0]!, []]));
    const destroy = vi.spyOn(pdf.loadingTask, "destroy");
    vi.spyOn(unpdf, "getDocumentProxy").mockResolvedValueOnce(pdf);
    await expect(parsearCalendarioPdf(new Uint8Array([1]))).rejects.toThrow();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it.each([
    ["vacío", new Uint8Array()],
    ["inválido", new Uint8Array([1, 2, 3])],
    ["15 MiB", new Uint8Array(15 * 1024 * 1024 + 1)],
    ["demasiadas páginas", pdfSintetico(Array.from({ length: 21 }, () => []))],
    ["girado", pdfSintetico(senior, 90)],
    ["sin texto", pdfSintetico([[], []])],
  ])("rechaza PDF %s", async (_, bytes) => {
    await expect(parsearCalendarioPdf(bytes)).rejects.toThrow();
  });
});

// Comprobación privada opt-in. Nunca imprime nombres, códigos ni contenido original.
it.skipIf(!process.env.CALENDARIO_PDFS_PRIVADOS)("valida originales: solo cantidades", async () => {
  const rutas = JSON.parse(process.env.CALENDARIO_PDFS_PRIVADOS!) as string[];
  for (const [i, ruta] of rutas.entries()) {
    const c = await parsearCalendarioPdf(await readFile(ruta));
    const conteo = {
      equipos: c.equipos.length,
      jornadas: c.jornadas.length,
      partidos: c.jornadas.reduce((n, j) => n + j.partidos.length, 0),
    };
    expect(conteo).toEqual(
      i === 0
        ? { equipos: 14, jornadas: 26, partidos: 182 }
        : { equipos: 16, jornadas: 30, partidos: 240 },
    );
    console.info(JSON.stringify(conteo));
  }
});

it.each([
  ["competición", "LIGA SINTETICA SENIOR | GRUPO 1", "OTRA LIGA SINTETICA"],
  ["temporada", "Temporada 2026-2027", "Temporada 2025-2026"],
])("rechaza %s distinta en páginas de jornadas", (_, antes, despues) => {
  const p = copia();
  cambiar(p, antes, despues);
  expect(() => parsearCalendario(p)).toThrow(/competición|temporada/i);
});

it("valida tamaño antes de invocar PDF.js", async () => {
  const abrir = vi.spyOn(unpdf, "getDocumentProxy");
  await expect(parsearCalendarioPdf(new Uint8Array(15 * 1024 * 1024 + 1))).rejects.toThrow(
    "15 MiB",
  );
  expect(abrir).not.toHaveBeenCalled();
});

it("libera PDF también si falla extracción de texto", async () => {
  const pdf = await unpdf.getDocumentProxy(pdfSintetico(senior));
  const destroy = vi.spyOn(pdf.loadingTask, "destroy");
  vi.spyOn(pdf, "getPage").mockRejectedValueOnce(new Error("Fallo sintético de extracción"));
  vi.spyOn(unpdf, "getDocumentProxy").mockResolvedValueOnce(pdf);
  await expect(parsearCalendarioPdf(new Uint8Array([1]))).rejects.toThrow("Fallo sintético");
  expect(destroy).toHaveBeenCalledOnce();
});

it("anexos posteriores no afectan resultado del parser puro", () => {
  const p = [...copia(), [{ texto: "ANEXO SINTETICO NO INTERPRETABLE", x: 0, y: NaN }]];
  expect(parsearCalendario(p)).toEqual(parsearCalendario(senior));
});
