import type { MarcaFicha } from "./iconos";
import { expect, it } from "vitest";
import { parsearFicha } from "./ficha";
import s18 from "./fixtures/senior-18.json";
import s1 from "./fixtures/senior-1.json";
import s6 from "./fixtures/senior-6.json";
import m18 from "./fixtures/senior-18-marcas.json";
import m1 from "./fixtures/senior-1-marcas.json";
import m6 from "./fixtures/senior-6-marcas.json";

function marcas(items: { tipo: string; x: number; y: number }[]) {
  return items.map<MarcaFicha>((i) => {
    const tipo = i.tipo;
    if (tipo !== "amarilla" && tipo !== "roja" && tipo !== "entra" && tipo !== "sale")
      throw new Error("Marca inválida");
    return { ...i, tipo };
  });
}
it.each([
  [s18, m18, 18, 5, 4, 7],
  [s1, m1, 1, 10, 9, 6],
  [s6, m6, 6, 3, 9, 11],
] as const)("lee las nuevas fichas sénior", (items, iconos, jornada, goles, cambios, tarjetas) => {
  const f = parsearFicha(items, marcas([...iconos]));
  expect(f.jornada).toBe(jornada);
  expect(f.goles).toHaveLength(goles);
  expect(f.sustituciones).toHaveLength(cambios);
  expect(f.tarjetas).toHaveLength(tarjetas);
  expect(f.tarjetas.every((t) => t.tipo !== "desconocido")).toBe(true);
  expect(f.local.titulares).toHaveLength(11);
  expect(f.visitante.titulares).toHaveLength(11);
});
it("distingue autor de gol en propia del equipo beneficiario y conserva descuento", () => {
  const f = parsearFicha(s18, marcas(m18));
  expect(f.goles[3]).toMatchObject({
    tipo: "propia",
    minuto: "45+1",
    beneficiario: "local",
    equipoAutor: "visitante",
  });
  expect(f.goles.filter((g) => g.tipo === "propia")).toHaveLength(1);
});
it("distingue roja directa a técnico y expulsiones por doble amarilla", () => {
  const f = parsearFicha(s6, marcas(m6));
  expect(f.tarjetas.filter((t) => t.tipo === "roja")).toEqual([
    expect.objectContaining({ minuto: "65", destinatario: "tecnico", equipo: "visitante" }),
  ]);
  expect(f.tarjetas.filter((t) => t.tipo === "doble_amarilla").map((t) => t.minuto)).toEqual([
    "78",
    "83",
  ]);
});
it("no convierte penaltis no indicados en goles normales", () => {
  expect(parsearFicha(s1, marcas(m1)).goles.every((g) => g.tipo === "desconocido")).toBe(true);
});
it("sin imágenes conserva las tarjetas como desconocidas", () => {
  expect(parsearFicha(s6).tarjetas.every((t) => t.tipo === "desconocido")).toBe(true);
});
it("rechaza sustituciones incompletas", () => {
  const eliminado = s18.find((i) => i.texto.includes("(36')"))!;
  expect(() =>
    parsearFicha(
      s18.filter((i) => i !== eliminado),
      marcas(m18),
    ),
  ).toThrow();
});

it("conserva dos amarillas publicadas al mismo minuto sin inventar una roja", () => {
  const tarjetas = parsearFicha(s18, marcas(m18)).tarjetas.filter((t) => t.minuto === "77");
  expect(tarjetas).toHaveLength(2);
  expect(tarjetas.every((t) => t.tipo === "amarilla")).toBe(true);
  expect(parsearFicha(s18, marcas(m18)).avisos.some((a) => a.includes("repite tarjetas"))).toBe(
    true,
  );
});
it("rechaza flechas invertidas en una sustitución", () => {
  const iconos = marcas(m18);
  const primera = iconos.find((i) => i.tipo === "entra")!;
  expect(() =>
    parsearFicha(
      s18,
      iconos.map<MarcaFicha>((i) => (i === primera ? { ...i, tipo: "sale" } : i)),
    ),
  ).toThrow("Dirección");
});
it("mantiene desconocido un autor que coincide en ambos equipos", () => {
  const autor = parsearFicha(s18).goles[3]!.autor;
  const titular = s18.find((i) => i.x < 0.33 && i.texto.startsWith("APELLIDO"))!;
  const ambiguo = s18.map((i) => (i === titular ? { ...i, texto: autor } : i));
  expect(parsearFicha(ambiguo).goles[3]).toMatchObject({ equipoAutor: null, tipo: "desconocido" });
});

it("no pierde una tarjeta cuyo texto falta", () => {
  const incompleta = s6.filter((i) => !i.texto.includes("(65')"));
  expect(() => parsearFicha(incompleta, marcas(m6))).toThrow("Icono de tarjeta");
});
it("no degrada una doble amarilla con icono parcialmente reconocido", () => {
  const marcasOriginales = marcas(m6);
  const roja = marcasOriginales.filter((i) => i.tipo === "roja")[1]!;
  const parciales = marcasOriginales.map((i) =>
    i === roja ? { ...i, tipo: "desconocida" as const } : i,
  );
  const f = parsearFicha(s6, parciales);
  expect(f.tarjetas.find((t) => t.minuto === "78")?.tipo).toBe("desconocido");
  expect(f.avisos.some((a) => a.includes("sin icono reconocido"))).toBe(true);
});
