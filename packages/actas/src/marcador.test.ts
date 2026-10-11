import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { marcadorDeFichaPdf, parsearFichaPdf } from "./pdf";

const fixture = (nombre: string) => readFile(new URL(`./fixtures/${nombre}`, import.meta.url));

describe("marcadorDeFichaPdf", () => {
  it.each(["senior-1.pdf", "jornada-1.pdf", "jornada-2.pdf"])(
    "da el mismo marcador que la lectura completa en %s",
    async (nombre) => {
      const bytes = await fixture(nombre);
      const completa = await parsearFichaPdf(bytes);
      expect(await marcadorDeFichaPdf(bytes)).toEqual(completa.marcador);
    },
  );

  it("conserva los bytes del llamante", async () => {
    const bytes = await fixture("senior-1.pdf");
    const copia = Buffer.from(bytes);
    await marcadorDeFichaPdf(bytes);
    expect(bytes.equals(copia)).toBe(true);
  });

  it("devuelve null con un PDF vacío o desmesurado, sin abrirlo", async () => {
    expect(await marcadorDeFichaPdf(new Uint8Array())).toBeNull();
    expect(await marcadorDeFichaPdf(new Uint8Array(15 * 1024 * 1024 + 1))).toBeNull();
  });
});
