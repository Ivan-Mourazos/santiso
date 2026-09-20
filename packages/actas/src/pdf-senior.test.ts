import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { parsearFichaPdf } from "./pdf";

it.each([
  [18, 4, 7],
  [1, 9, 6],
  [6, 9, 11],
])("extrae texto e iconos del PDF sénior %i", async (jornada, cambios, tarjetas) => {
  const f = await parsearFichaPdf(
    await readFile(new URL(`./fixtures/senior-${jornada}.pdf`, import.meta.url)),
  );
  expect(f.jornada).toBe(jornada);
  expect(f.sustituciones).toHaveLength(cambios);
  expect(f.tarjetas).toHaveLength(tarjetas);
  expect(f.tarjetas.every((t) => t.tipo !== "desconocido")).toBe(true);
  if (jornada === 6) {
    expect(f.tarjetas.filter((t) => t.tipo === "doble_amarilla")).toHaveLength(2);
    expect(f.tarjetas.filter((t) => t.tipo === "roja")).toEqual([
      expect.objectContaining({ destinatario: "tecnico", minuto: "65" }),
    ]);
  }
  if (jornada === 18)
    expect(f.goles[3]).toMatchObject({
      tipo: "propia",
      equipoAutor: "visitante",
      beneficiario: "local",
      minuto: "45+1",
    });
});
