import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { leerFichaPdf } from "./fichas";

// `new URL(import.meta.url)` de un solo argumento: la forma de dos lo analiza el empaquetador.
const AQUI = path.dirname(fileURLToPath(new URL(import.meta.url)));
const FIXTURES = path.resolve(AQUI, "../../../../../packages/actas/src/fixtures");

async function formularioCon(fichero: string, santisoEsLocal = true) {
  const bytes = await readFile(path.join(FIXTURES, fichero));
  const formulario = new FormData();
  formulario.append(
    "ficha",
    new File([new Uint8Array(bytes)], fichero, { type: "application/pdf" }),
  );
  formulario.append("santisoEsLocal", santisoEsLocal ? "1" : "0");
  return formulario;
}

describe("leerFichaPdf", () => {
  it("lee una ficha real de principio a fin: PDF → acta revisable", async () => {
    const resultado = await leerFichaPdf(await formularioCon("senior-1.pdf"));
    if (!resultado.ok) throw new Error(resultado.error);

    const { acta, deteccion } = resultado.datos;
    expect(deteccion.jornada).toBeGreaterThan(0);
    expect(deteccion.localTeam).not.toBe("");
    expect(deteccion.visitorTeam).not.toBe("");
    expect(acta.titulares.length).toBeGreaterThan(0);
    expect(Number(acta.marcadorLocal)).toBeGreaterThanOrEqual(0);
    // Todo minuto ha de ser un entero: `transformar.ts` detiene el guardado si no lo es.
    for (const evento of acta.eventos) {
      expect(evento.minuto).toMatch(/^\d*$/);
    }
  });

  it("el lado del Santiso cambia a quién se atribuyen los goles", async () => {
    const comoLocal = await leerFichaPdf(await formularioCon("senior-6.pdf", true));
    const comoVisitante = await leerFichaPdf(await formularioCon("senior-6.pdf", false));
    if (!comoLocal.ok || !comoVisitante.ok) throw new Error("La ficha no se pudo leer");

    const goles = comoLocal.datos.acta.eventos.filter((e) => e.tipo === "gol").length;
    expect(goles).toBeGreaterThan(0);

    // Un gol se le anota a uno de los dos lados, nunca a los dos ni a ninguno: al dar la vuelta
    // al lado del Santiso, los goles propios de una lectura son los del rival de la otra.
    const propios = (r: typeof comoLocal.datos) =>
      r.acta.eventos.filter((e) => e.tipo === "gol" && !e.isRival).length;
    expect(propios(comoLocal.datos) + propios(comoVisitante.datos)).toBe(goles);
  });

  it("rechaza con un mensaje claro lo que el parser no admite", async () => {
    const resultado = await leerFichaPdf(await formularioCon("girado.pdf"));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error).toContain("No se pudo leer la ficha");
  });

  it("rechaza un formulario sin fichero", async () => {
    const resultado = await leerFichaPdf(new FormData());
    expect(resultado).toMatchObject({ ok: false, error: "No se recibió ningún PDF." });
  });
});
