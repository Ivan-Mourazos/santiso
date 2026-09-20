import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractImages, getResolvedPDFJS } from "unpdf";
import type { getDocumentProxy } from "unpdf";
import { clasificarIcono, extraerMarcasPdf } from "./iconos";

vi.mock("unpdf", () => ({ extractImages: vi.fn(), getResolvedPDFJS: vi.fn() }));

type Imagen = Awaited<ReturnType<typeof extractImages>>[number];
type Pdf = Awaited<ReturnType<typeof getDocumentProxy>>;
const OPS = {
  save: 10,
  restore: 11,
  transform: 12,
  dependency: 1,
  paintImageXObject: 85,
  paintImageXObjectRepeat: 88,
  paintInlineImageXObject: 86,
  paintFormXObjectBegin: 74,
  paintFormXObjectEnd: 75,
  beginGroup: 76,
  endGroup: 77,
};
type Paso = [number, unknown];

function tarjeta(roja = false, key = "tarjeta"): Imagen {
  const color = roja ? [255, 0, 0] : [246, 199, 51];
  return {
    key,
    width: 8,
    height: 11,
    channels: 3,
    data: new Uint8ClampedArray([
      ...Array.from({ length: 54 }, () => color).flat(),
      ...Array.from({ length: 30 }, () => [140, 140, 140]).flat(),
      ...Array.from({ length: 4 }, () => [255, 255, 255]).flat(),
    ]),
  };
}

function flecha(sale = false): Imagen {
  return {
    key: "flecha",
    width: 14,
    height: 10,
    channels: 4,
    data: new Uint8ClampedArray([
      ...Array.from({ length: 36 }, () => (sale ? [181, 8, 16, 255] : [0, 0, 98, 255])).flat(),
      // El RGB de un píxel completamente transparente no tiene significado.
      ...Array.from({ length: 104 }, () => [123, 42, 199, 0]).flat(),
    ]),
  };
}

function documento(pasos: Paso[], images: Imagen[] = [tarjeta()]) {
  const viewport = { width: 200, height: 400, rotation: 0, transform: [1, 0, 0, -1, 0, 400] };
  const destroy = vi.fn();
  const getPage = vi.fn(async () => ({
    getViewport: () => viewport,
    getOperatorList: async () => ({
      fnArray: pasos.map(([op]) => op),
      argsArray: pasos.map(([, args]) => args),
    }),
  }));
  vi.mocked(extractImages).mockResolvedValue(images);
  return {
    pdf: { numPages: 2, getPage, loadingTask: { destroy } } as unknown as Pdf,
    viewport,
    destroy,
    getPage,
  };
}

const pintar = (key = "tarjeta"): Paso => [OPS.paintImageXObject, [key, 8, 11]];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getResolvedPDFJS).mockResolvedValue({ OPS } as unknown as Awaited<
    ReturnType<typeof getResolvedPDFJS>
  >);
});

describe("clasificarIcono", () => {
  it.each([
    ["amarilla", () => tarjeta()],
    ["roja", () => tarjeta(true)],
    ["entra", () => flecha()],
    ["sale", () => flecha(true)],
  ] as const)("reconoce únicamente la muestra %s", (tipo, crear) => {
    expect(clasificarIcono(crear())).toBe(tipo);
  });

  it("rechaza un color cercano aunque domine la imagen", () => {
    const img = tarjeta();
    for (let i = 0; i < 54 * 3; i += 3) img.data[i] = 245;
    expect(clasificarIcono(img)).toBeNull();
  });

  it("exige los recuentos exactos de color, gris y blanco", () => {
    const img = tarjeta();
    img.data.set([140, 140, 140], 0);
    expect(clasificarIcono(img)).toBeNull();
    const otra = tarjeta();
    otra.data.set([140, 140, 140], 84 * 3);
    expect(clasificarIcono(otra)).toBeNull();
  });

  it("rechaza paletas mixtas y colores opacos desconocidos", () => {
    const img = flecha();
    img.data.set([181, 8, 16, 255], 0);
    expect(clasificarIcono(img)).toBeNull();
    img.data.set([0, 0, 99, 255], 0);
    expect(clasificarIcono(img)).toBeNull();
  });

  it.each([0, 128, 254])("rechaza alfa %i en los 36 píxeles de la flecha", (alpha) => {
    const img = flecha();
    img.data[3] = alpha;
    expect(clasificarIcono(img)).toBeNull();
  });

  it("rechaza un píxel opaco adicional y flechas completamente transparentes", () => {
    const img = flecha();
    img.data.set([0, 0, 98, 255], 36 * 4);
    expect(clasificarIcono(img)).toBeNull();
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 0;
    expect(clasificarIcono(img)).toBeNull();
  });

  it("rechaza tamaños, canales y buffers no comprobados", () => {
    const img = tarjeta();
    expect(clasificarIcono({ ...img, width: 80, height: 110 })).toBeNull();
    expect(clasificarIcono({ ...img, channels: 1 })).toBeNull();
    expect(clasificarIcono({ ...img, data: img.data.slice(1) })).toBeNull();
    expect(clasificarIcono({ ...img, data: new Uint8ClampedArray(265) })).toBeNull();
    expect(clasificarIcono({ ...flecha(), channels: 3 })).toBeNull();
  });
});

describe("extraerMarcasPdf", () => {
  it("compone CTM y normaliza el centro desde arriba izquierda", async () => {
    const { pdf, destroy, getPage } = documento([
      [OPS.transform, [2, 0, 0, 3, 10, 20]],
      [OPS.transform, [8, 0, 0, 11, 5, 7]],
      pintar(),
    ]);
    expect(await extraerMarcasPdf(pdf, 2)).toEqual([{ tipo: "amarilla", x: 0.14, y: 0.85625 }]);
    expect(getPage).toHaveBeenCalledWith(2);
    expect(extractImages).toHaveBeenCalledWith(pdf, 2);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("restaura estados anidados y conserva cada aparición de la misma clave", async () => {
    const img = tarjeta();
    const { pdf } = documento(
      [
        [OPS.transform, [8, 0, 0, 11, 20, 40]],
        [OPS.save, null],
        [OPS.transform, [1, 0, 0, 1, 5, 0]],
        [OPS.save, null],
        [OPS.transform, [1, 0, 0, 1, 0, 10]],
        pintar(),
        [OPS.restore, null],
        pintar(),
        [OPS.restore, null],
        pintar(),
        pintar(),
      ],
      [img, img, img, img],
    );
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([
      { tipo: "amarilla", x: 0.32, y: 0.61125 },
      { tipo: "amarilla", x: 0.32, y: 0.88625 },
      { tipo: "amarilla", x: 0.12, y: 0.88625 },
      { tipo: "amarilla", x: 0.12, y: 0.88625 },
    ]);
  });

  it("compone las reflexiones intermedias y respeta el origen del viewport", async () => {
    const { pdf, viewport } = documento([
      [OPS.transform, [1, 0, 0, -1, 10, 300]],
      [OPS.transform, [8, 0, 0, -11, 20, 40]],
      pintar(),
    ]);
    viewport.transform = [1, 0, 0, -1, -10, 380];
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([{ tipo: "amarilla", x: 0.12, y: 0.28625 }]);
  });

  it("mantiene amarilla y roja separadas en una misma fila", async () => {
    const { pdf } = documento(
      [
        [OPS.transform, [8, 0, 0, 11, 20, 40]],
        pintar(),
        [OPS.transform, [1, 0, 0, 1, 2, 0]],
        pintar("roja"),
      ],
      [tarjeta(), tarjeta(true, "roja")],
    );
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([
      { tipo: "amarilla", x: 0.12, y: 0.88625 },
      { tipo: "roja", x: 0.2, y: 0.88625 },
    ]);
  });

  it.each([
    [0, 8, -11, 0, 20, 40],
    [-8, 0, 0, -11, 20, 40],
    [-8, 0, 0, 11, 20, 40],
    [8, 0, 0, -11, 20, 40],
    [8, 1, 0, 11, 20, 40],
    [0, 0, 0, 11, 20, 40],
  ])(
    "conserva como desconocida imagen girada, reflejada, sesgada o degenerada: %j",
    (...matrix) => {
      const { pdf } = documento([[OPS.transform, matrix], pintar()]);
      return expect(extraerMarcasPdf(pdf, 1)).resolves.toEqual([
        expect.objectContaining({ tipo: "desconocida" }),
      ]);
    },
  );

  it("ignora páginas giradas e imágenes fuera del viewport", async () => {
    const { pdf, viewport } = documento([[OPS.transform, [8, 0, 0, 11, 300, 40]], pintar()]);
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([]);
    viewport.rotation = 90;
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([]);
  });

  it("conserva iconos desconocidos y omite imágenes grandes", async () => {
    const img = tarjeta();
    img.data[0] = 1;
    const { pdf } = documento(
      [pintar(), pintar("grande")],
      [img, { ...tarjeta(), key: "grande", width: 80 }],
    );
    expect(await extraerMarcasPdf(pdf, 1)).toEqual([
      { tipo: "desconocida", x: 0.0025, y: 0.99875 },
    ]);
  });

  it.each([
    [[OPS.restore, null]],
    [[OPS.save, null]],
    [[OPS.transform, [1, 0, 0, 1, Number.NaN, 0]]],
    [[OPS.transform, [1, 0, 0, 1]]],
    [[OPS.paintImageXObject, [17, 8, 11]]],
    [[9999, []]],
    [[OPS.paintImageXObjectRepeat, ["tarjeta", 1, 1, [0, 0]]]],
    [[OPS.paintFormXObjectBegin, [[1, 0, 0, 1, 20, 40]]]],
  ] as Paso[][])("falla ante operadores o estados ambiguos: %j", async (...pasos) => {
    const { pdf, destroy } = documento(pasos);
    await expect(extraerMarcasPdf(pdf, 1)).rejects.toThrow();
    expect(destroy).not.toHaveBeenCalled();
  });

  it("propaga errores de extracción sin destruir el documento del llamante", async () => {
    const { pdf, destroy } = documento([]);
    vi.mocked(extractImages).mockRejectedValue(new Error("imagen ilegible"));
    await expect(extraerMarcasPdf(pdf, 1)).rejects.toThrow("imagen ilegible");
    expect(destroy).not.toHaveBeenCalled();
  });
});

it("conserva la posición de un icono pequeño cuya paleta no reconoce", async () => {
  const img = tarjeta(true);
  const i = img.data.findIndex((v) => v === 255);
  img.data[i] = 254;
  const { pdf } = documento([[OPS.transform, [8, 0, 0, 11, 20, 40]], pintar()], [img]);
  expect(await extraerMarcasPdf(pdf, 1)).toEqual([{ tipo: "desconocida", x: 0.12, y: 0.88625 }]);
});

it("rechaza un recurso de imagen ausente en vez de perder su marca", async () => {
  const { pdf } = documento([pintar("ausente")]);
  await expect(extraerMarcasPdf(pdf, 1)).rejects.toThrow("sin datos decodificados");
});
