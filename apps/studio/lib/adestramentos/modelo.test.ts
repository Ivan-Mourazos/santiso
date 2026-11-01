import { describe, expect, it } from "vitest";
import { conceptoDe, cambioDe, type Estado } from "./modelo";
describe("reglas de asistencia", () => {
  it.each(["presente", "tarde", "ausente"] as Estado[])("%s justificado no multa", (estado) => {
    expect(conceptoDe({ estado, justificado: true })).toBeNull();
  });
  it("elige ambos conceptos y presente", () => {
    expect(conceptoDe({ estado: "presente", justificado: false })).toBeNull();
    expect(conceptoDe({ estado: "tarde", justificado: false })).toBe(
      "Chegar tarde (inxustificado)",
    );
    expect(conceptoDe({ estado: "ausente", justificado: false })).toBe(
      "Non asistencia (inxustificada)",
    );
  });
  it("cambia pendientes, conserva pagadas y no repone borradas", () => {
    const tarde = { personaClave: "jugador:a", estado: "tarde" as const, justificado: false };
    expect(cambioDe(undefined, tarde, undefined)).toBe("crear");
    expect(cambioDe(tarde, tarde, undefined)).toBe("mantener");
    expect(cambioDe(tarde, { ...tarde, estado: "ausente" }, { pagadaEn: null })).toBe("crear");
    expect(cambioDe(tarde, { ...tarde, justificado: true }, { pagadaEn: null })).toBe("quitar");
    expect(cambioDe(tarde, { ...tarde, estado: "presente" }, { pagadaEn: "2026-11-01" })).toBe(
      "avisar",
    );
  });
});
