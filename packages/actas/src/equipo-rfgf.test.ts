import { describe, expect, it } from "vitest";

import { codigoDeTemporada, gruposDeEquipoHtml, partidosConCodigos } from "./equipo-rfgf";

const equipo = (codigo: string, nombre: string) =>
  `<a href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=${codigo}">${nombre}</a>`;
const acta = (codigo: string) =>
  `<a href="/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${codigo}&cod_acta=${codigo}"></a>`;

describe("partidos de una jornada con sus códigos", () => {
  it("empareja cada acta con el equipo de antes y el de después", () => {
    const html = `${equipo("1", "LOCAL UN")}${acta("900")}${equipo("2", "VISITANTE DOUS")}
      ${equipo("3", "LOCAL TRES")}${acta("901")}${equipo("4", "VISITANTE CATRO &amp; CIA")}`;
    expect(partidosConCodigos(html)).toEqual([
      {
        codLocal: "1",
        local: "LOCAL UN",
        codVisitante: "2",
        visitante: "VISITANTE DOUS",
        codActa: "900",
      },
      {
        codLocal: "3",
        local: "LOCAL TRES",
        codVisitante: "4",
        visitante: "VISITANTE CATRO & CIA",
        codActa: "901",
      },
    ]);
  });

  it("no se descuadra con el equipo que descansa al principio (grupos impares)", () => {
    const html = `${equipo("9", "DESCANSA")}${equipo("1", "LOCAL UN")}${acta("900")}${equipo("2", "VISITANTE DOUS")}`;
    expect(partidosConCodigos(html).map((p) => [p.codLocal, p.codActa, p.codVisitante])).toEqual([
      ["1", "900", "2"],
    ]);
  });

  it("un partido sin acta no sale", () => {
    expect(partidosConCodigos(`${equipo("1", "A")}${equipo("2", "B")}`)).toEqual([]);
  });
});

describe("competiciones de un equipo por temporada", () => {
  const fila = (codCompeticion: string, competicion: string, codGrupo: string, grupo: string) =>
    `<tr><td><a href='/pnfg/NPcd/NFG_VisCompeticiones_Vis?&cod_primaria=1000123&codcompeticion=${codCompeticion}'>${competicion}</a> &nbsp;</td>
     <td><span><a href='/pnfg/NPcd/NFG_VisGrupos_Vis?cod_primaria=1000123&codgrupo=${codGrupo}'>${grupo}</a></span></td></tr>`;
  const html = `<h4 class=font-red>&nbsp;&nbsp;&nbsp;2026-2027</h4><table><thead><tr><th>Competición</th></tr></thead>
    ${fila("30", "LIGA SINTETICA", "300", "ZONA | GRUPO 3")}</table>
    <h4 class=font-red>&nbsp;&nbsp;&nbsp;2025-2026</h4><table>
    ${fila("20", "LIGA SINTETICA", "200", "ZONA | GRUPO 4 &gt; FASE PREVIA")}
    ${fila("21", "COPA SINTETICA", "210", "ZONA| GRUPO 1")}</table>`;

  it("lee cada grupo bajo su temporada, con los códigos de competición y grupo", () => {
    expect(gruposDeEquipoHtml(html)).toEqual([
      {
        temporada: "2026-2027",
        competicion: "LIGA SINTETICA",
        codCompeticion: "30",
        grupo: "ZONA | GRUPO 3",
        codGrupo: "300",
      },
      {
        temporada: "2025-2026",
        competicion: "LIGA SINTETICA",
        codCompeticion: "20",
        grupo: "ZONA | GRUPO 4 > FASE PREVIA",
        codGrupo: "200",
      },
      {
        temporada: "2025-2026",
        competicion: "COPA SINTETICA",
        codCompeticion: "21",
        grupo: "ZONA| GRUPO 1",
        codGrupo: "210",
      },
    ]);
  });

  it("sabe el código que la federación da a cada temporada", () => {
    expect(codigoDeTemporada("2026-2027")).toBe("22");
    expect(codigoDeTemporada("2021-2022")).toBe("17");
    expect(codigoDeTemporada("verano")).toBeNull();
  });
});
