import type { Ficha } from "@santiso/actas";
import { describe, expect, it } from "vitest";

import { eventosDeFicha, personaDeActa } from "./eventos";
import { disciplina, goleadores, type EventoLiga } from "./tablas";

const ficha = (parte: Partial<Ficha>): Ficha => ({
  version: 2,
  competicion: "Liga",
  jornada: 1,
  temporada: "2026-2027",
  fecha: "2026-10-04",
  campo: "",
  poblacion: "",
  marcador: [0, 0],
  local: { nombre: "A", titulares: [], suplentes: [] },
  visitante: { nombre: "B", titulares: [], suplentes: [] },
  goles: [],
  tarjetas: [],
  sustituciones: "no_registradas",
  coberturaSustituciones: { local: "no_registradas", visitante: "no_registradas" },
  avisos: [],
  ...parte,
});

describe("eventos de un acta", () => {
  it("escribe a las personas como personas", () => {
    expect(personaDeActa("GARCIA REY, ALEJANDRO")).toBe("Alejandro Garcia Rey");
    expect(personaDeActa("Iago SR")).toBe("Iago SR");
  });

  it("apunta cada gol a su autor y deja aparte los goles en propia", () => {
    const eventos = eventosDeFicha(
      ficha({
        goles: [
          {
            autor: "GARCIA REY, ALEJANDRO",
            minuto: "16",
            beneficiario: "local",
            marcador: [1, 0],
            tipo: "desconocido",
            equipoAutor: "local",
          },
          {
            autor: "LOPEZ, XAN",
            minuto: "40",
            beneficiario: "local",
            marcador: [2, 0],
            tipo: "propia",
            equipoAutor: null,
          },
        ],
      }),
    );
    expect(eventos).toEqual([
      expect.objectContaining({ lado: "local", persona: "Alejandro Garcia Rey", tipo: "gol" }),
      // En propia: beneficia al local, así que lo marcó alguien del visitante.
      expect.objectContaining({ lado: "visitante", persona: "Xan Lopez", tipo: "gol_propia" }),
    ]);
    expect(eventos[0]?.personaClave).toBe("alejandro garcia rey");
  });

  it("las tarjetas llevan su color y si son a un técnico; las ilegibles no se inventan", () => {
    const eventos = eventosDeFicha(
      ficha({
        tarjetas: [
          { autor: "A, B", minuto: "10", equipo: "visitante", tipo: "amarilla", destinatario: "jugador" },
          { autor: "C, D", minuto: "70", equipo: "local", tipo: "roja", destinatario: "tecnico" },
          { autor: "E, F", minuto: "80", equipo: "local", tipo: "desconocido", destinatario: "jugador" },
        ],
      }),
    );
    expect(eventos).toEqual([
      expect.objectContaining({ lado: "visitante", tipo: "amarilla", tecnico: false }),
      expect.objectContaining({ lado: "local", tipo: "roja", tecnico: true }),
    ]);
  });
});

const evento = (
  persona: string,
  tipo: EventoLiga["tipo"],
  jornada: number,
  equipo = "A",
  tecnico = false,
): EventoLiga => ({
  equipoId: equipo,
  equipo: `Equipo ${equipo}`,
  persona,
  personaClave: persona.toLowerCase(),
  tipo,
  tecnico,
  jornada,
});

describe("tablas de la liga", () => {
  it("ordena los goleadores y los empatados comparten puesto", () => {
    const tabla = goleadores([
      evento("Ana", "gol", 1),
      evento("Ana", "gol", 2),
      evento("Bea", "gol", 1, "B"),
      evento("Bea", "gol", 2, "B"),
      evento("Cora", "gol", 1),
      evento("Cora", "gol_propia", 2),
      evento("Ana", "amarilla", 2),
    ]);
    expect(tabla.map((g) => [g.puesto, g.persona, g.goles])).toEqual([
      [1, "Ana", 2],
      [1, "Bea", 2],
      [3, "Cora", 1],
    ]);
  });

  it("dos personas con el mismo nombre en equipos distintos no se suman", () => {
    const tabla = goleadores([evento("Xan", "gol", 1, "A"), evento("Xan", "gol", 1, "B")]);
    expect(tabla).toHaveLength(2);
  });

  it("avisa de quien está a una amarilla de la sanción", () => {
    const eventos = [1, 2, 3, 4].map((j) => evento("Ana", "amarilla", j));
    expect(disciplina(eventos, 5)[0]).toMatchObject({
      persona: "Ana",
      amarillas: 4,
      situacion: "apercibido",
    });
  });

  it("quien completa el ciclo en el último partido de su equipo se pierde el siguiente", () => {
    const eventos = [1, 2, 3, 4, 5].map((j) => evento("Ana", "amarilla", j));
    expect(disciplina(eventos, 5)[0]).toMatchObject({ situacion: "sancionado", amarillas: 5 });
    // Jugado ya otro partido después, la sanción quedó cumplida.
    const despues = [...eventos, evento("Bea", "amarilla", 6)];
    expect(disciplina(despues, 5).find((d) => d.persona === "Ana")).toMatchObject({
      situacion: null,
    });
  });

  it("un expulsado en el último partido se pierde al menos el siguiente", () => {
    const tabla = disciplina(
      [evento("Ana", "roja", 3), evento("Bea", "doble_amarilla", 2), evento("Cora", "amarilla", 3)],
      5,
    );
    expect(tabla[0]).toMatchObject({ persona: "Ana", situacion: "expulsado", expulsiones: 1 });
    expect(tabla.find((d) => d.persona === "Bea")).toMatchObject({ situacion: null });
  });

  it("las tarjetas a técnicos no cuentan para los ciclos de jugadores", () => {
    const eventos = [1, 2, 3, 4].map((j) => evento("Míster", "amarilla", j, "A", true));
    expect(disciplina(eventos, 5)).toEqual([]);
  });

  it("una expulsión antigua no avisa si el equipo ya jugó después, aunque ese acta no dejara eventos", () => {
    const eventos = [evento("Ana", "roja", 1)];
    expect(disciplina(eventos, 5, new Map([["A", 2]]))[0]).toMatchObject({ situacion: null });
    expect(disciplina(eventos, 5, new Map([["A", 1]]))[0]).toMatchObject({
      situacion: "expulsado",
    });
  });
});
