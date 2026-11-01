import { describe, expect, it } from "vitest";
import { parsearCalendarioWeb } from "./calendario-web";

/** Misma forma que la página real, con nombres inventados. */
const fila = (local: string, visitante: string, centro = '<i class="fa fa-minus"></i>') =>
  `<tr> <td width="47%" align=right> ${local} </td> <td width="6%" align=center> ${centro} </td> <td width="47%" align=left> ${visitante} </td> </tr>`;
const ronda = (titulo: string, filas: string[]) =>
  `<table><thead><tr><th colspan=4>${titulo}</th></tr></thead>${filas.join("")}</table>`;
const pagina = (cuerpo: string, salto = "<br><br>") =>
  `<h4>COPA DE PRUEBA, ZONA&nbsp;&nbsp; ${salto}Temporada 2026-2027</h4>${cuerpo}`;

describe("calendario de la página web de la federación", () => {
  it("lee una copa: rondas con nombre, fechas y lo que falta por sortear", () => {
    const calendario = parsearCalendarioWeb(
      pagina(
        ronda("FASE PREVIA , 31-10-2026", [fila("ALFA F.C.", "BETA S.D."), fila("GAMA", "DELTA")]) +
          ronda("Treintaidosavos , 06-02-2027", [fila("ALFA F.C.", "ÉPSILON &quot;B&quot;")]) +
          ronda("Final , 12-06-2027", [
            fila("Equipo Casa (No asignado)", "Equipo Fuera (No asignado)"),
          ]),
      ),
    );
    expect(calendario.competicion).toBe("COPA DE PRUEBA, ZONA");
    expect(calendario.temporada).toBe("2026-2027");
    expect(calendario.jornadas.map((j) => [j.numero, j.fase, j.fechaNominal])).toEqual([
      [1, "Fase previa", "2026-10-31"],
      [2, "Treintaidosavos", "2027-02-06"],
      [3, "Final", "2027-06-12"],
    ]);
    expect(calendario.jornadas[1]!.partidos[0]!.visitante.nombre).toBe('ÉPSILON "B"');
    // La final aún no tiene cruce, pero la ronda existe.
    expect(calendario.jornadas[2]!.partidos).toEqual([]);
    expect(calendario.equipos).toHaveLength(5);
  });

  it("lee una liga, también con partidos ya jugados y su marcador en medio", () => {
    const script = "<strong><script>ntype('x',0,0,'fa-6');</script></strong>";
    const calendario = parsearCalendarioWeb(
      pagina(
        ronda("Jornada 2 <span id=f>(04-10-2026)</span>", [fila("GAMA", "ALFA")]) +
          ronda("Jornada 1 <span id=f>(27-09-2026)</span>", [fila("ALFA", "GAMA", script)]),
        "<br>",
      ),
    );
    expect(calendario.jornadas.map((j) => [j.numero, j.fase])).toEqual([
      [1, undefined],
      [2, undefined],
    ]);
    expect(calendario.jornadas[0]!.fechaNominal).toBe("2026-09-27");
  });

  it("rechaza lo que no es un calendario y uno sin ningún partido", () => {
    expect(() => parsearCalendarioWeb("<html>nada</html>")).toThrow(/no es el calendario/);
    expect(() => parsearCalendarioWeb(pagina(ronda("Final , 12-06-2027", [])))).toThrow(
      /no trae partidos/,
    );
  });
});
