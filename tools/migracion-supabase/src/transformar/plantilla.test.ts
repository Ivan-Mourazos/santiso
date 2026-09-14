import { describe, expect, it } from "vitest";
import { fabricar, snapshotVacio } from "../test/fabricas";
import { transformarPlantilla } from "./plantilla";
import { crearInforme } from "./tipos";

const BASE = "https://abc.supabase.co/storage/v1/object/public/fotos/";

describe("transformarPlantilla — jugadores", () => {
  it("normaliza textos, capitanía, foto, fecha y listas", () => {
    const origen = snapshotVacio();
    origen.jugadores.push(
      fabricar.jugador({
        nombre: " Iván Pérez ",
        apodo: "",
        dorsal: 9,
        posicion: "DC",
        posiciones_conocidas: ["DC", "MCO"],
        capitan: 0,
        foto_url: `${BASE}jugadores/ivan.webp`,
        fecha_nacimiento: "1995-02-12",
        historial_deportivo: null,
        compromiso: 3,
      }),
      fabricar.jugador({ nombre: "Capitán", capitan: 2 }),
    );

    const { jugadores } = transformarPlantilla(origen, crearInforme());

    expect(jugadores[0]).toMatchObject({
      nombre: "Iván Pérez",
      apodo: null,
      dorsal: 9,
      posicion: "DC",
      posicionesConocidas: ["DC", "MCO"],
      capitania: null,
      categoria: "Senior",
      foto: "jugadores/ivan.webp",
      fechaNacimiento: "1995-02-12",
      historial: [],
      compromiso: 3,
    });
    expect(jugadores[1]?.capitania).toBe(2);
  });

  it("rechaza posiciones desconocidas y jugadores sin categoría", () => {
    const conPosicion = snapshotVacio();
    conPosicion.jugadores.push(fabricar.jugador({ posicion: "LIBERO" }));
    expect(() => transformarPlantilla(conPosicion, crearInforme())).toThrow(/Posición desconocida/);

    const sinCategoria = snapshotVacio();
    sinCategoria.jugadores.push(fabricar.jugador({ categoria: null }));
    expect(() => transformarPlantilla(sinCategoria, crearInforme())).toThrow(/no tiene categoría/);
  });
});

describe("transformarPlantilla — staff", () => {
  it("normaliza el tipo, descarta la categoría de la directiva y ordena por antigüedad", () => {
    const origen = snapshotVacio();
    const segundo = fabricar.staff({ nombre: "Segundo", created_at: "2026-01-02T00:00:00+00:00" });
    const primero = fabricar.staff({ nombre: "Primero", created_at: "2026-01-01T00:00:00+00:00" });
    const presidente = fabricar.staff({
      nombre: "Presidente",
      cargo: "Presidente",
      tipo: "Directiva",
      categoria: "Senior",
    });
    origen.staff_club.push(segundo, primero, presidente);
    const informe = crearInforme();

    const { staff } = transformarPlantilla(origen, informe);

    expect(staff.find((m) => m.id === primero.id)).toMatchObject({
      tipo: "tecnico",
      categoria: "Senior",
      orden: 0,
    });
    expect(staff.find((m) => m.id === segundo.id)?.orden).toBe(1);
    expect(staff.find((m) => m.id === presidente.id)).toMatchObject({
      tipo: "directiva",
      categoria: null,
      orden: 0,
    });
    expect(informe.avisos).toEqual([
      'Directivo "Presidente" tenía categoría "Senior"; se descarta.',
    ]);
  });

  it("exige categoría a los técnicos y un tipo conocido", () => {
    const sinCategoria = snapshotVacio();
    sinCategoria.staff_club.push(fabricar.staff({ categoria: null }));
    expect(() => transformarPlantilla(sinCategoria, crearInforme())).toThrow(/no tiene categoría/);

    const tipoRaro = snapshotVacio();
    tipoRaro.staff_club.push(fabricar.staff({ tipo: "Utillero" }));
    expect(() => transformarPlantilla(tipoRaro, crearInforme())).toThrow(
      /Tipo de staff desconocido/,
    );
  });
});
