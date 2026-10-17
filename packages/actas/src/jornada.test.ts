import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { parsearJornada, parsearJornadaPdf } from "./jornada";

// Texto tal como sale de los PDF de la federación (Tercera Futgal, grupo 3, 2026/27).
const POR_JUGAR = `TERCERA FUTGAL, SANTIAGO | GRUPO 3 Temporada 2026-2027
Jornada 3
Resultados
C.D. COMPAÑÍA DE MARIA 18-10-2026 A.C.U.D. CAMPORRAPADO
Campo: Campo de Fútbol Municipal As Cancelas - Hierba Artificial
VILATUXE F.C. 18-10-2026
17:00
C.D. BERRES
Campo: San Lorenzo - Vilatuxe - Hierba Artificial
U.D. SANTISO F.C. 18-10-2026
17:00
ATLETICO ETER
Campo: Municipal de Santiso - Hierba Artificial
S.D. CRUCES 18-10-2026
18:00
C.S.D ARZUA "B"
Campo: Mpal Do Camballón - Hierba Artificial
ATLETICO ETER 25-10-2026 VILATUXE F.C.
Campo: Campo Pendiente de asignar
REAL FEDERACIÓN
GALLEGA DE FÚTBOL`;

const JUGADA = `TERCERA FUTGAL, SANTIAGO | GRUPO 3 Temporada 2026-2027
Jornada 2
Resultados
A.C.U.D. CAMPORRAPADO
4 - 1
04-10-2026
12:00
VISTA ALEGRE S.D.
Campo: O Forte-Boqueixón - Hierba Artificial Árbitro: LOPEZ BLANCO, VICTOR
C.D. BERRES
8 - 3
04-10-2026
17:00
U.D. SANTISO F.C.
Campo: Pardiñeiro - Hierba Natural Árbitro: ENRIQUEZ PEREIRO, OSCAR
CLUB ARENAL
0 - 5
04-10-2026
19:00
S.D. CRUCES
Campo: Suso Conde - Hierba Artificial Árbitro: PICON REGOS, YAGO
REAL FEDERACIÓN
GALLEGA DE FÚTBOL`;

describe("PDF de jornada de la federación", () => {
  it("lee día, hora y campo de los partidos por jugar", () => {
    const jornada = parsearJornada(POR_JUGAR);
    expect(jornada).toMatchObject({
      competicion: "TERCERA FUTGAL, SANTIAGO | GRUPO 3",
      numero: 3,
      sinLeer: [],
    });
    expect(jornada.partidos).toHaveLength(5);
    expect(jornada.partidos[2]).toEqual({
      local: "U.D. SANTISO F.C.",
      visitante: "ATLETICO ETER",
      fecha: "2026-10-18",
      hora: "17:00",
      campo: "Municipal de Santiso",
      superficie: "Hierba Artificial",
      marcador: null,
      arbitro: null,
    });
  });

  it("sin hora publicada el partido sale con el día y la hora vacía", () => {
    const [primero] = parsearJornada(POR_JUGAR).partidos;
    expect(primero).toMatchObject({
      local: "C.D. COMPAÑÍA DE MARIA",
      visitante: "A.C.U.D. CAMPORRAPADO",
      fecha: "2026-10-18",
      hora: null,
      campo: "Campo de Fútbol Municipal As Cancelas",
    });
  });

  it("un campo con guion en el nombre no pierde su segunda mitad, ni un equipo sus comillas", () => {
    const { partidos } = parsearJornada(POR_JUGAR);
    expect(partidos[1]).toMatchObject({ campo: "San Lorenzo - Vilatuxe" });
    expect(partidos[3]).toMatchObject({ visitante: 'C.S.D ARZUA "B"', hora: "18:00" });
  });

  it("«pendiente de asignar» es un campo vacío, no un campo con ese nombre", () => {
    expect(parsearJornada(POR_JUGAR).partidos[4]).toMatchObject({
      local: "ATLETICO ETER",
      campo: null,
      superficie: null,
    });
  });

  it("de una jornada jugada trae también el marcador, y el árbitro no se cuela en el campo", () => {
    const jornada = parsearJornada(JUGADA);
    expect(jornada.numero).toBe(2);
    expect(jornada.partidos).toEqual([
      expect.objectContaining({
        local: "A.C.U.D. CAMPORRAPADO",
        visitante: "VISTA ALEGRE S.D.",
        marcador: [4, 1],
        hora: "12:00",
        campo: "O Forte-Boqueixón",
      }),
      expect.objectContaining({
        local: "C.D. BERRES",
        visitante: "U.D. SANTISO F.C.",
        marcador: [8, 3],
        campo: "Pardiñeiro",
        superficie: "Hierba Natural",
        arbitro: "ENRIQUEZ PEREIRO, OSCAR",
      }),
      expect.objectContaining({ local: "CLUB ARENAL", marcador: [0, 5] }),
    ]);
  });

  it("lo que no cuadra no se inventa: queda para revisar", () => {
    const raro = POR_JUGAR.replace(
      "U.D. SANTISO F.C. 18-10-2026\n17:00\nATLETICO ETER",
      "U.D. SANTISO F.C. APLAZADO ATLETICO ETER",
    );
    const jornada = parsearJornada(raro);
    expect(jornada.partidos).toHaveLength(4);
    expect(jornada.sinLeer).toEqual(["U.D. SANTISO F.C. APLAZADO ATLETICO ETER"]);
  });

  it("rechaza un PDF que no es de jornada", () => {
    expect(() => parsearJornada("Calendario de Competiciones\nEquipos Participantes")).toThrow(
      /no es de una jornada/,
    );
  });

  it("un equipo que acaba en número no se confunde con el marcador", () => {
    const texto = `LIGA X Temporada 2026-2027
Jornada 1
Resultados
RACING 1906
2 - 1
04-10-2026
17:00
ATLETICO 2010
Campo: O Campo - Hierba Natural
REAL FEDERACIÓN`;
    expect(parsearJornada(texto).partidos[0]).toMatchObject({
      local: "RACING 1906",
      visitante: "ATLETICO 2010",
      marcador: [2, 1],
    });
  });

  it("un árbitro partido en dos líneas conserva su nombre y no se pega al equipo siguiente", () => {
    const texto = `LIGA X Temporada 2026-2027
Jornada 6
Resultados
U.D. SANTISO F.C. SOLAINA
0 - 1
17-10-2026
18:30
S.D.C. RECESENDE
Campo: Municipal de Santiso - Hierba Artificial Árbitro: FERNANDEZ MONTOUTO,
RUBEN
SR CALO - MILONGAS
0 - 0
17-10-2026
20:00
RESMON C.F.
Campo: Munic. Rebordelo - Hierba Artificial Árbitro: REBOREDO RIADIGOS, JOSE
LUIS
S.D. CACHEIRAS
0 - 0
17-10-2026
20:00
MELIDE VETERANOS
Campo: A Cañoteira - Hierba Artificial
REAL FEDERACIÓN`;
    // La coma final basta; «LUIS» solo se sabe por su sitio en el PDF.
    const { partidos } = parsearJornada(texto, new Set(["LUIS"]));
    expect(partidos.map((p) => [p.local, p.arbitro])).toEqual([
      ["U.D. SANTISO F.C. SOLAINA", "FERNANDEZ MONTOUTO, RUBEN"],
      ["SR CALO - MILONGAS", "REBOREDO RIADIGOS, JOSE LUIS"],
      ["S.D. CACHEIRAS", null],
    ]);
  });

  it("en el PDF real, cada árbitro con su partido y su nombre entero", async () => {
    const bytes = await readFile(new URL("./fixtures/veteranos-6.pdf", import.meta.url));
    const { partidos, sinLeer } = await parsearJornadaPdf(new Uint8Array(bytes));
    expect(sinLeer).toEqual([]);
    const arbitros = Object.fromEntries(partidos.map((p) => [p.local, p.arbitro]));
    expect(arbitros).toMatchObject({
      "C.D. VETERANOS BERMÉS": "ENRIQUEZ PEREIRO, OSCAR",
      "U.D. SANTISO F.C. SOLAINA": "FERNANDEZ MONTOUTO, RUBEN",
      "CLUB TABERNA DO PORTUGUES-BOQUEIXON VETERANOS": "BOTANA REY, PABLO",
      "ULLA OIL VETERANOS": "HERNANDEZ GIADANS, AGUSTIN",
      "VETERANOS BALOMPIE FOGAR DE BREOGAN": "PAZ HERMIDA, MANUEL",
      "SR CALO - MILONGAS": "MARTINEZ SANTOS, OSCAR",
      "S.D. CACHEIRAS": "REBOREDO RIADIGOS, JOSE LUIS",
    });
  });
});
