import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parsearFichaPdf } from "./pdf";

describe("adaptador PDF", () => {
  it.each([1, 2])(
    "lee PDF sintético anonimizado %i y conserva los bytes del llamante",
    async (j) => {
      const bytes = await readFile(new URL(`./fixtures/jornada-${j}.pdf`, import.meta.url));
      const copia = Buffer.from(bytes);
      const f = await parsearFichaPdf(bytes);
      expect(f.jornada).toBe(j);
      expect(f.goles).toHaveLength(j === 1 ? 5 : 7);
      expect(f.local.titulares).toHaveLength(11);
      expect(f.tarjetas).toHaveLength(2);
      expect(bytes.equals(copia)).toBe(true);
    },
  );
  it("rechaza bytes inválidos", async () => {
    await expect(parsearFichaPdf(new Uint8Array([1, 2, 3]))).rejects.toThrow();
  });
  it("rechaza archivos mayores de 15 MiB antes de abrirlos", async () => {
    await expect(parsearFichaPdf(new Uint8Array(15 * 1024 * 1024 + 1))).rejects.toThrow("15 MiB");
  });
});

it.each([
  ["dos-paginas", "una página"],
  ["girado", "girada"],
  ["sin-texto", "Ficha del Partido"],
])("rechaza la plantilla %s sin devolver datos parciales", async (nombre, mensaje) => {
  const bytes = await readFile(new URL(`./fixtures/${nombre}.pdf`, import.meta.url));
  await expect(parsearFichaPdf(bytes)).rejects.toThrow(mensaje);
});
