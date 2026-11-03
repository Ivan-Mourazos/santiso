import { describe, expect, it } from "vitest";
import { cuadrante, textoTabla, textoWhatsapp, type Registro } from "./asistencia";
const personas = [
  { clave: "a", nombre: "Ana (Ani)" },
  { clave: "b", nombre: "Brais" },
];
const entrenos = [
  { id: "viejo", fecha: "2026-09-01" },
  { id: "nuevo", fecha: "2026-11-03" },
];
const marcas: Registro[] = [
  { entrenamientoId: "viejo", personaClave: "a", estado: "presente", justificado: false },
  {
    entrenamientoId: "nuevo",
    personaClave: "a",
    estado: "ausente",
    justificado: true,
    motivo: "Trabajo",
  },
  {
    entrenamientoId: "nuevo",
    personaClave: "b",
    estado: "tarde",
    justificado: true,
    motivo: "Médico",
  },
];
describe("copias de asistencia", () => {
  it("WhatsApp omite grupos vacíos e incluye apodo y justificados", () => {
    expect(textoWhatsapp(entrenos[1], "Senior", personas, marcas)).toBe(
      "Entrenamiento mar 3/11 · Senior\n⏰ Tarde (1): Brais (justificado: Médico)\n❌ Faltan (1): Ana (Ani) (justificado: Trabajo)",
    );
  });
  it("presentes sin motivos ni importes", () => {
    expect(textoWhatsapp(entrenos[0], "Veteranos", personas, marcas)).toBe(
      "Entrenamiento mar 1/9 · Veteranos\n✅ Presentes (1): Ana (Ani)",
    );
  });
  it("TSV fechas recientes primero, minúsculas, porcentaje y orden", () => {
    const tabla = cuadrante(entrenos, personas, marcas, "temporada", "asistencia", "2026-11-03");
    expect(textoTabla(tabla)).toBe(
      "Persona\t3/11\t1/9\tAsistencia\nAna (Ani)\tf\tP\t50%\nBrais\tt\t·\t100%",
    );
    // Brais no figuraba en septiembre: denominador uno.
    expect(tabla.filas[1].porcentaje).toBe(100);
  });
  it("periodo mensual cambia porcentaje y exportación", () => {
    expect(textoTabla(cuadrante(entrenos, personas, marcas, "mes", "nombre", "2026-11-03"))).toBe(
      "Persona\t3/11\tAsistencia\nAna (Ani)\tf\t0%\nBrais\tt\t100%",
    );
  });
  it("últimos diez y orden por nombre", () => {
    const muchos = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      fecha: `2026-10-${String(i + 1).padStart(2, "0")}`,
    }));
    const tabla = cuadrante(muchos, [...personas].reverse(), [], "diez", "nombre", "2026-11-03");
    expect(tabla.columnas).toHaveLength(10);
    expect(tabla.columnas.map((e) => e.fecha)).toEqual(
      muchos
        .slice(2)
        .reverse()
        .map((e) => e.fecha),
    );
    expect(tabla.filas.map((f) => f.nombre)).toEqual(["Ana (Ani)", "Brais"]);
    expect(textoTabla(tabla)).toContain("—");
  });
  it("cuenta solo incidencias sin justificar y presentes por entrenamiento", () => {
    const sinJustificar = marcas.map((m) => ({ ...m, justificado: false }));
    const tabla = cuadrante(entrenos, personas, sinJustificar, "temporada", "nombre", "2026-11-03");
    expect(tabla.filas[0].faltas).toBe(1);
    expect(tabla.filas[1].tardes).toBe(1);
    expect(tabla.totales).toEqual([
      { presentes: 0, total: 2 },
      { presentes: 1, total: 1 },
    ]);
  });
});
