import { describe, expect, it } from "vitest";
import { nombreDelClub } from "./apodos";

const plantilla = [
  { id: "1", nombre: "Brais Rei Ficticio", apodo: "Bareto" },
  { id: "2", nombre: "Iago Porteiro Ficticio", apodo: null },
];

describe("nombreDelClub", () => {
  it("cambia el nombre del acta por el apodo del jugador", () => {
    expect(nombreDelClub("REI FICTICIO, BRAIS", plantilla)).toBe("Bareto");
  });

  it("sin apodo, el nombre del Studio; sin reconocerlo, el de la federación", () => {
    expect(nombreDelClub("PORTEIRO FICTICIO, IAGO", plantilla)).toBe("Iago Porteiro Ficticio");
    expect(nombreDelClub("OUTRO RIVAL, XOAN", plantilla)).toBe("OUTRO RIVAL, XOAN");
  });
});
