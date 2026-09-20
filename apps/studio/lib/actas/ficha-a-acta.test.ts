import type { CambioFicha, EquipoFicha, Ficha, GolFicha, TarjetaFicha } from "@santiso/actas";
import { describe, expect, it } from "vitest";
import { actaDeFicha, categoriaDeCompeticion } from "./ficha-a-acta";
import { eventosDeActa } from "./transformar";

const SANTISO: EquipoFicha = {
  nombre: "UD Santiso",
  titulares: [
    { dorsal: 1, nombre: "PORTEIRO NOVO, IAGO" },
    { dorsal: 9, nombre: "REI DOS GOLES, BRAIS" },
  ],
  suplentes: [{ dorsal: 14, nombre: "SUPLENTE FIEL, XAN" }],
};

const RIVAL: EquipoFicha = {
  nombre: "CD Rival",
  titulares: [{ dorsal: 5, nombre: "DEFENSA CONTRARIO, LOIS" }],
  suplentes: [{ dorsal: 12, nombre: "BANQUILLO AXENO, UXIO" }],
};

/** Ficha con el Santiso de local y sin ningún evento; cada prueba añade lo suyo. */
function ficha(parcial: Partial<Ficha> = {}): Ficha {
  return {
    version: 2,
    competicion: "Veteranos",
    jornada: 3,
    temporada: "2026/27",
    fecha: "18/10/2026 16:00",
    campo: "A Carballeira",
    poblacion: "Santiso",
    marcador: [0, 0],
    local: SANTISO,
    visitante: RIVAL,
    goles: [],
    tarjetas: [],
    sustituciones: [],
    coberturaSustituciones: { local: "registradas", visitante: "registradas" },
    avisos: [],
    ...parcial,
  };
}

function gol(parcial: Partial<GolFicha> = {}): GolFicha {
  return {
    autor: "REI DOS GOLES, BRAIS",
    minuto: "22",
    beneficiario: "local",
    marcador: [1, 0],
    tipo: "desconocido",
    equipoAutor: "local",
    ...parcial,
  };
}

function tarjeta(parcial: Partial<TarjetaFicha> = {}): TarjetaFicha {
  return {
    autor: "REI DOS GOLES, BRAIS",
    minuto: "31",
    equipo: "local",
    tipo: "amarilla",
    destinatario: "jugador",
    ...parcial,
  };
}

function cambio(parcial: Partial<CambioFicha> = {}): CambioFicha {
  return {
    equipo: "local",
    minuto: "60",
    entra: { dorsal: 14, nombre: "SUPLENTE FIEL, XAN" },
    sale: { dorsal: 9, nombre: "REI DOS GOLES, BRAIS" },
    ...parcial,
  };
}

const unico = <T>(lista: T[]): T => {
  expect(lista).toHaveLength(1);
  return lista[0] as T;
};

describe("goles", () => {
  it("un gol nuestro marcado por uno de los nuestros lleva jugador", () => {
    const acta = actaDeFicha(ficha({ marcador: [1, 0], goles: [gol()] }), true);
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ tipo: "gol", isRival: false, confidence: "alta" });
    expect(evento.esPropia).toBeUndefined();
    expect(evento.jugador?.rawName).toBe("REI DOS GOLES, BRAIS");
    expect(evento.jugador?.dorsal).toBe("9");
  });

  it("un gol a nuestro favor marcado por un rival es gol en propia del rival", () => {
    const acta = actaDeFicha(
      ficha({
        marcador: [1, 0],
        goles: [gol({ autor: "DEFENSA CONTRARIO, LOIS", equipoAutor: "visitante", tipo: "propia" })],
      }),
      true,
    );
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ isRival: false, esPropia: true });
    expect(evento.nombreRival).toBe("DEFENSA CONTRARIO, LOIS");
    expect(evento.jugador).toBeUndefined();
  });

  it("un gol del rival marcado por un rival guarda solo el nombre", () => {
    const acta = actaDeFicha(
      ficha({
        marcador: [0, 1],
        goles: [
          gol({
            autor: "DEFENSA CONTRARIO, LOIS",
            beneficiario: "visitante",
            marcador: [0, 1],
            equipoAutor: "visitante",
          }),
        ],
      }),
      true,
    );
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ isRival: true, nombreRival: "DEFENSA CONTRARIO, LOIS" });
    expect(evento.esPropiaSantiso).toBeUndefined();
    expect(evento.jugador).toBeUndefined();
  });

  it("un gol del rival marcado por uno de los nuestros es gol en propia nuestro", () => {
    const acta = actaDeFicha(
      ficha({
        marcador: [0, 1],
        goles: [gol({ beneficiario: "visitante", marcador: [0, 1], tipo: "propia" })],
      }),
      true,
    );
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ isRival: true, esPropiaSantiso: true });
    expect(evento.jugador?.rawName).toBe("REI DOS GOLES, BRAIS");
  });

  it("sin equipo de autor se supone que no es en propia, con aviso y confianza baja", () => {
    const acta = actaDeFicha(
      ficha({ marcador: [1, 0], goles: [gol({ autor: "HOMONIMO, ANDRES", equipoAutor: null })] }),
      true,
    );
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ isRival: false, confidence: "baja" });
    expect(evento.esPropia).toBeUndefined();
    expect(acta.warnings.join(" ")).toContain("HOMONIMO, ANDRES");
  });

  it("el marcador acumulado del gol viaja para que se pueda revisar", () => {
    const acta = actaDeFicha(ficha({ marcador: [1, 0], goles: [gol({ marcador: [1, 0] })] }), true);
    expect(unico(acta.eventos).scoreAfter).toBe("1-0");
  });
});

describe("el lado del Santiso", () => {
  it("de visitante, los goles del local son del rival", () => {
    const acta = actaDeFicha(
      ficha({
        local: RIVAL,
        visitante: SANTISO,
        marcador: [1, 0],
        goles: [gol({ autor: "DEFENSA CONTRARIO, LOIS", equipoAutor: "local" })],
      }),
      false,
    );
    expect(unico(acta.eventos)).toMatchObject({
      isRival: true,
      nombreRival: "DEFENSA CONTRARIO, LOIS",
    });
  });

  it("la convocatoria es siempre la nuestra", () => {
    const acta = actaDeFicha(ficha({ local: RIVAL, visitante: SANTISO }), false);
    expect(acta.titulares.map((jugador) => jugador.dorsal)).toEqual(["1", "9"]);
    expect(acta.suplentes.map((jugador) => jugador.dorsal)).toEqual(["14"]);
  });
});

describe("tarjetas", () => {
  it("la amarilla de uno de los nuestros lleva jugador", () => {
    const acta = actaDeFicha(ficha({ tarjetas: [tarjeta()] }), true);
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ tipo: "tarjeta_amarilla", isRival: false });
    expect(evento.jugador?.dorsal).toBe("9");
  });

  it("la tarjeta del rival guarda solo el nombre", () => {
    const acta = actaDeFicha(
      ficha({
        tarjetas: [
          tarjeta({ autor: "DEFENSA CONTRARIO, LOIS", equipo: "visitante", tipo: "roja" }),
        ],
      }),
      true,
    );
    expect(unico(acta.eventos)).toMatchObject({
      tipo: "tarjeta_roja",
      isRival: true,
      nombreRival: "DEFENSA CONTRARIO, LOIS",
    });
  });

  it("la doble amarilla es una sola roja, y se avisa", () => {
    const acta = actaDeFicha(ficha({ tarjetas: [tarjeta({ tipo: "doble_amarilla" })] }), true);
    expect(unico(acta.eventos).tipo).toBe("tarjeta_roja");
    expect(acta.warnings.join(" ")).toContain("Doble amarilla");
  });

  it("la tarjeta de icono desconocido no genera evento, pero sí aviso", () => {
    const acta = actaDeFicha(ficha({ tarjetas: [tarjeta({ tipo: "desconocido" })] }), true);
    expect(acta.eventos).toEqual([]);
    expect(acta.warnings.join(" ")).toContain("no se reconoció");
  });

  it("la tarjeta al cuerpo técnico no genera evento, pero sí aviso", () => {
    const acta = actaDeFicha(
      ficha({ tarjetas: [tarjeta({ autor: "ADESTRADOR, MANUEL", destinatario: "tecnico" })] }),
      true,
    );
    expect(acta.eventos).toEqual([]);
    expect(acta.warnings.join(" ")).toContain("ADESTRADOR, MANUEL");
  });
});

describe("cambios", () => {
  it("el cambio nuestro trae quien entra y quien sale", () => {
    const acta = actaDeFicha(ficha({ sustituciones: [cambio()] }), true);
    const evento = unico(acta.eventos);
    expect(evento).toMatchObject({ tipo: "cambio", isRival: false, minuto: "60" });
    expect(evento.jugadorEntra?.dorsal).toBe("14");
    expect(evento.jugadorSale?.dorsal).toBe("9");
  });

  it("el cambio del rival se descarta con aviso: la tabla solo admite cambios propios", () => {
    const acta = actaDeFicha(
      ficha({
        sustituciones: [
          cambio({
            equipo: "visitante",
            entra: { dorsal: 12, nombre: "BANQUILLO AXENO, UXIO" },
            sale: { dorsal: 5, nombre: "DEFENSA CONTRARIO, LOIS" },
          }),
        ],
      }),
      true,
    );
    expect(acta.eventos).toEqual([]);
    expect(acta.warnings.join(" ")).toContain("del rival");
  });

  it("avisa cuando la ficha no registra sustituciones", () => {
    const acta = actaDeFicha(
      ficha({
        sustituciones: "no_registradas",
        coberturaSustituciones: { local: "no_registradas", visitante: "no_registradas" },
      }),
      true,
    );
    expect(acta.eventos).toEqual([]);
    expect(acta.warnings.join(" ")).toContain("no registra");
  });

  it("avisa cuando faltan solo nuestras sustituciones", () => {
    const acta = actaDeFicha(
      ficha({
        sustituciones: [cambio({ equipo: "visitante" })],
        coberturaSustituciones: { local: "no_registradas", visitante: "registradas" },
      }),
      true,
    );
    expect(acta.warnings.join(" ")).toContain("no registra");
  });
});

describe("minutos y avisos", () => {
  it("el descuento se guarda en el minuto base: la columna es un entero", () => {
    const acta = actaDeFicha(
      ficha({ marcador: [1, 0], goles: [gol({ minuto: "45+2" })] }),
      true,
    );
    expect(unico(acta.eventos).minuto).toBe("45");
  });

  it("conserva los avisos que ya traía la ficha", () => {
    const acta = actaDeFicha(ficha({ avisos: ["Aviso del parser"] }), true);
    expect(acta.warnings).toContain("Aviso del parser");
  });

  it("copia marcador, campo y población", () => {
    const acta = actaDeFicha(ficha({ marcador: [2, 1] }), true);
    expect(acta).toMatchObject({
      marcadorLocal: "2",
      marcadorVisitante: "1",
      campoNombre: "A Carballeira",
      campoPoblacion: "Santiso",
    });
  });
});

describe("categoriaDeCompeticion", () => {
  // Cadenas tal cual salen de las fichas de prueba del parser.
  it("reconoce veteranos", () => {
    expect(categoriaDeCompeticion("VETERANOS - PRIMERA GALICIA (SANTIAGO | GRUPO 2)")).toBe(
      "Veteranos",
    );
  });

  it("reconoce femenino con las dos grafías", () => {
    expect(categoriaDeCompeticion("PRIMERA FEMININA GALEGA")).toBe("Femenino");
    expect(categoriaDeCompeticion("Liga Femenina Aficionada")).toBe("Femenino");
  });

  it("no inventa categoría cuando el nombre no la dice", () => {
    expect(categoriaDeCompeticion("TERCERA FUTGAL (SANTIAGO | GRUPO 4 > FASE PREVIA)")).toBe("");
  });
});

describe("el acta resultante atraviesa transformar.ts", () => {
  /**
   * `eventosDeActa` es lo que rechaza las formas que el CHECK de la tabla no admite. Si el
   * adaptador produjera un cambio del rival, un minuto con descuento o un gol sin jugador
   * enlazado, saltaría aquí y no en producción.
   */
  it("no produce ninguna forma que el guardado rechace", () => {
    const acta = actaDeFicha(
      ficha({
        marcador: [2, 1],
        goles: [
          gol({ minuto: "45+2" }),
          gol({
            autor: "DEFENSA CONTRARIO, LOIS",
            minuto: "70",
            equipoAutor: "visitante",
            tipo: "propia",
            marcador: [2, 0],
          }),
          gol({
            autor: "DEFENSA CONTRARIO, LOIS",
            minuto: "80",
            beneficiario: "visitante",
            equipoAutor: "visitante",
            marcador: [2, 1],
          }),
        ],
        tarjetas: [tarjeta(), tarjeta({ equipo: "visitante", autor: "DEFENSA CONTRARIO, LOIS" })],
        sustituciones: [cambio(), cambio({ equipo: "visitante" })],
      }),
      true,
    );

    // La pantalla enlaza los nombres con la plantilla; aquí se simula ese paso.
    const enlazada = {
      ...acta,
      titulares: acta.titulares.map((j) => ({ ...j, jugadorId: `id-${j.dorsal}` })),
      suplentes: acta.suplentes.map((j) => ({ ...j, jugadorId: `id-${j.dorsal}` })),
      eventos: acta.eventos.map((evento) => ({
        ...evento,
        jugador: evento.jugador && { ...evento.jugador, jugadorId: `id-${evento.jugador.dorsal}` },
        jugadorEntra: evento.jugadorEntra && {
          ...evento.jugadorEntra,
          jugadorId: `id-${evento.jugadorEntra.dorsal}`,
        },
        jugadorSale: evento.jugadorSale && {
          ...evento.jugadorSale,
          jugadorId: `id-${evento.jugadorSale.dorsal}`,
        },
      })),
    };

    expect(() => eventosDeActa(enlazada)).not.toThrow();
    expect(eventosDeActa(enlazada)).toHaveLength(6);
  });
});
