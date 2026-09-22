import { describe, expect, it } from "vitest";
import type { JugadorDto, StaffDto } from "@/lib/dto";
import {
  borradorDeJugador,
  borradorDeStaff,
  dorsalesRepetidos,
  erroresJugador,
  erroresStaff,
  FILTRO_VACIO,
  filtrarJugadores,
  filtrarStaff,
  formularioDeJugador,
  formularioDeStaff,
  hayCambios,
} from "./modelo";

const jugador = (parcial: Partial<JugadorDto>): JugadorDto => ({
  id: "p1",
  inscripcion_id: "i1",
  temporada_id: "t26",
  nombre: "Brais Rei",
  apodo: null,
  dorsal: 9,
  posicion: "DC",
  foto_url: "/media/jugadores/brais.webp",
  categoria: "Senior",
  fecha_nacimiento: null,
  historial_deportivo: [],
  ...parcial,
});

const LISTA = [
  jugador({
    id: "a",
    inscripcion_id: "ia",
    nombre: "Iago Pérez",
    apodo: "Pichi",
    dorsal: 1,
    posicion: "POR",
  }),
  jugador({
    id: "b",
    inscripcion_id: "ib",
    nombre: "Brais Rei",
    dorsal: 9,
    posicion: "DC",
    foto_url: null,
  }),
  jugador({ id: "c", inscripcion_id: "ic", nombre: "Xan Fiel", dorsal: 10, posicion: "MC" }),
];

describe("filtrarJugadores", () => {
  it("sin filtro devuelve todos", () => {
    expect(filtrarJugadores(LISTA, FILTRO_VACIO)).toHaveLength(3);
  });

  it("busca por nombre sin tildes ni mayúsculas", () => {
    expect(filtrarJugadores(LISTA, { ...FILTRO_VACIO, texto: "perez" }).map((j) => j.id)).toEqual([
      "a",
    ]);
  });

  it("busca también por apodo", () => {
    expect(filtrarJugadores(LISTA, { ...FILTRO_VACIO, texto: "PICHI" }).map((j) => j.id)).toEqual([
      "a",
    ]);
  });

  it("un número busca el dorsal", () => {
    expect(filtrarJugadores(LISTA, { ...FILTRO_VACIO, texto: "10" }).map((j) => j.id)).toEqual([
      "c",
    ]);
  });

  it("filtra por posición y por falta de foto", () => {
    expect(filtrarJugadores(LISTA, { ...FILTRO_VACIO, posicion: "POR" }).map((j) => j.id)).toEqual([
      "a",
    ]);
    expect(
      filtrarJugadores(LISTA, { ...FILTRO_VACIO, soloSinFoto: true }).map((j) => j.id),
    ).toEqual(["b"]);
  });

  it("no altera la lista original", () => {
    const copia = [...LISTA];
    filtrarJugadores(LISTA, { ...FILTRO_VACIO, texto: "xan" });
    expect(LISTA).toEqual(copia);
  });
});

describe("filtrarStaff", () => {
  const staff: StaffDto[] = [
    {
      id: "s1",
      inscripcion_id: "is1",
      temporada_id: "t",
      nombre: "Manuel Adestrador",
      cargo: "Entrenador",
      tipo: "tecnico",
      categoria: "Senior",
      foto_url: null,
      orden: 10,
    },
    {
      id: "s2",
      inscripcion_id: "is2",
      temporada_id: "t",
      nombre: "Ana Martínez",
      cargo: "Delegada",
      tipo: "tecnico",
      categoria: "Senior",
      foto_url: null,
      orden: 20,
    },
  ];

  it("busca por nombre o por cargo", () => {
    expect(filtrarStaff(staff, "martinez").map((s) => s.id)).toEqual(["s2"]);
    expect(filtrarStaff(staff, "entrena").map((s) => s.id)).toEqual(["s1"]);
    expect(filtrarStaff(staff, "")).toHaveLength(2);
  });
});

describe("dorsalesRepetidos", () => {
  it("señala los que aparecen más de una vez e ignora los vacíos", () => {
    const lista = [
      jugador({ dorsal: 9 }),
      jugador({ dorsal: 9 }),
      jugador({ dorsal: null }),
      jugador({ dorsal: null }),
      jugador({ dorsal: 1 }),
    ];
    expect([...dorsalesRepetidos(lista)]).toEqual([9]);
  });
});

describe("borradores de jugador", () => {
  it("el alta parte de un borrador vacío", () => {
    expect(borradorDeJugador(null)).toMatchObject({ jugadorId: "", nombre: "", dorsal: "" });
  });

  it("el dorsal 0 no se confunde con «sin dorsal»", () => {
    expect(borradorDeJugador(jugador({ dorsal: 0 })).dorsal).toBe("0");
    expect(borradorDeJugador(jugador({ dorsal: null })).dorsal).toBe("");
  });

  it("el historial se edita línea a línea", () => {
    expect(
      borradorDeJugador(jugador({ historial_deportivo: ["24/25: A", "25/26: B"] })).historial,
    ).toBe("24/25: A\n25/26: B");
  });

  it("el formulario lleva siempre todos los campos y el destino", () => {
    const b = borradorDeJugador(jugador({ apodo: "Rei", posicion: "DC" }));
    const f = formularioDeJugador(b, { temporadaId: "t26", categoria: "Senior" }, null);
    expect(Object.fromEntries(f.entries())).toEqual({
      id: "p1",
      temporadaId: "t26",
      categoria: "Senior",
      nombre: "Brais Rei",
      apodo: "Rei",
      fechaNacimiento: "",
      historial: "",
      dorsal: "9",
      posicion: "DC",
    });
  });

  it("la foto solo viaja si hay una nueva", () => {
    const b = borradorDeJugador(null);
    const destino = { temporadaId: "t", categoria: "Senior" };
    expect(formularioDeJugador(b, destino, null).has("foto")).toBe(false);
    expect(formularioDeJugador(b, destino, new Blob(["x"])).has("foto")).toBe(true);
  });
});

describe("borradores de staff", () => {
  it("distingue la persona del papel", () => {
    const miembro: StaffDto = {
      id: "s1",
      inscripcion_id: "papel1",
      temporada_id: "t",
      nombre: "Manuel",
      cargo: "Entrenador",
      tipo: "tecnico",
      categoria: "Senior",
      foto_url: null,
      orden: 10,
    };
    const b = borradorDeStaff(miembro);
    const f = formularioDeStaff(
      b,
      { temporadaId: "t", tipo: "Tecnico", categoria: "Senior" },
      null,
    );
    expect(f.get("id")).toBe("s1");
    expect(f.get("inscripcionId")).toBe("papel1");
    expect(f.get("tipo")).toBe("Tecnico");
  });

  it("la directiva viaja sin categoría", () => {
    const f = formularioDeStaff(
      borradorDeStaff(null),
      { temporadaId: "t", tipo: "Directiva" },
      null,
    );
    expect(f.get("categoria")).toBe("");
  });
});

describe("cambios y errores", () => {
  it("detecta cambios de campo y cuenta una foto nueva como cambio", () => {
    const inicial = borradorDeJugador(jugador({}));
    expect(hayCambios(inicial, { ...inicial }, false)).toBe(false);
    expect(hayCambios(inicial, { ...inicial, dorsal: "10" }, false)).toBe(true);
    expect(hayCambios(inicial, { ...inicial }, true)).toBe(true);
  });

  it("valida nombre y dorsal como el servidor", () => {
    expect(erroresJugador(borradorDeJugador(null))).toHaveProperty("nombre");
    expect(
      erroresJugador({ ...borradorDeJugador(null), nombre: "A", dorsal: "9a" }),
    ).toHaveProperty("dorsal");
    expect(erroresJugador({ ...borradorDeJugador(null), nombre: "A", dorsal: " 9 " })).toEqual({});
    expect(erroresStaff({ ...borradorDeStaff(null), nombre: "A" })).toHaveProperty("cargo");
  });
});
