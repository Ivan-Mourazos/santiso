import { describe, expect, it } from "vitest";

import { grupoDeEnlace, urlActaPdf, urlJornada } from "./enlace";
import { partidosDeJornada } from "./jornada";

const CALENDARIO =
  "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1000120&codtemporada=22&codcompeticion=26990830&codgrupo=27576591&CodJornada=2";

describe("grupoDeEnlace", () => {
  it("saca los cuatro códigos del enlace del calendario", () => {
    expect(grupoDeEnlace(CALENDARIO)).toEqual({
      codPrimaria: "1000120",
      codTemporada: "22",
      codCompeticion: "26990830",
      codGrupo: "27576591",
    });
  });

  it("vale también el enlace de una jornada, con otras mayúsculas", () => {
    const jornada =
      " https://www.futgal.es/pnfg/NPcd/NFG_CmpJornada?cod_primaria=1000120&CodTemporada=22&CodGrupo=27576591&CodCompeticion=26990830&CodJornada=5 ";
    expect(grupoDeEnlace(jornada)).toEqual(grupoDeEnlace(CALENDARIO));
  });

  it("rechaza lo que no es de la federación o viene incompleto", () => {
    expect(grupoDeEnlace("")).toBeNull();
    expect(grupoDeEnlace("no es una dirección")).toBeNull();
    expect(grupoDeEnlace(CALENDARIO.replace("www.futgal.es", "futgal.es.ejemplo.com"))).toBeNull();
    expect(grupoDeEnlace(CALENDARIO.replace("&codgrupo=27576591", ""))).toBeNull();
    expect(grupoDeEnlace(CALENDARIO.replace("codgrupo=27576591", "codgrupo=1;drop"))).toBeNull();
    // El enlace de un partido suelto no dice de qué grupo es.
    expect(
      grupoDeEnlace(
        "https://www.futgal.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=1444198",
      ),
    ).toBeNull();
  });
});

describe("direcciones", () => {
  const grupo = grupoDeEnlace(CALENDARIO)!;

  it("arma la página de una jornada", () => {
    const url = new URL(urlJornada(grupo, 7));
    expect(url.origin + url.pathname).toBe("https://www.futgal.es/pnfg/NPcd/NFG_CmpJornada");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      cod_primaria: "1000120",
      CodTemporada: "22",
      CodGrupo: "27576591",
      CodCompeticion: "26990830",
      CodJornada: "7",
    });
  });

  it("arma el PDF de un acta, el mismo de «Generar PDF»", () => {
    expect(urlActaPdf(grupo, "1444198")).toBe(
      "https://www.futgal.es/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=1444198&cod_acta=1444198&NPcd_Pdf=1",
    );
  });
});

/** Un partido como lo pinta la web: equipo local, marcador, acta (si está cerrada) y visitante. */
function bloque(local: string, visitante: string, codActa?: string) {
  const acta = codActa
    ? `<a class="btn btn-success btn-sm" href="/pnfg/NPcd/NFG_CmpPartido?cod_primaria=1000120&CodActa=${codActa}&cod_acta=${codActa}" title="Acta del partido"></a>`
    : "";
  return `<tr><td><h4>&nbsp;
    <a style="color:#000;" href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=5376">
      ${local} </a></h4></td>
    <td><span class="wid2_resultado_cerrada ntype"><i class=fa-solid>8</i> -</span>${acta}
      04-10-2026 17:00</td>
    <td><h4><a style="color:#000;" href="NFG_VisEquipos?cod_primaria=1000119&Codigo_Equipo=2860">
      ${visitante} </a></h4>
      <a href="NFG_VisCampos?cod_primaria=1000122&Codigo_Campo=655"> Pardiñeiro </a></td></tr>`;
}

describe("partidosDeJornada", () => {
  it("empareja local y visitante y recoge el acta cerrada", () => {
    const html = [
      bloque("C.D. BERRES", "U.D. SANTISO F.C.", "1444198"),
      bloque('C.S.D ARZUA "B"', "GUERREROS DEL SOL", "1444201"),
    ].join("\n");
    expect(partidosDeJornada(html)).toEqual([
      { local: "C.D. BERRES", visitante: "U.D. SANTISO F.C.", codActa: "1444198" },
      { local: 'C.S.D ARZUA "B"', visitante: "GUERREROS DEL SOL", codActa: "1444201" },
    ]);
  });

  it("un partido sin acta queda pendiente y no hereda la del anterior", () => {
    const html = [
      bloque("VILATUXE F.C.", "C.D. BERRES", "1500001"),
      bloque("U.D. SANTISO F.C.", "ATLETICO ETER"),
    ].join("\n");
    expect(partidosDeJornada(html)).toEqual([
      { local: "VILATUXE F.C.", visitante: "C.D. BERRES", codActa: "1500001" },
      { local: "U.D. SANTISO F.C.", visitante: "ATLETICO ETER", codActa: null },
    ]);
  });

  it("descodifica las entidades de los nombres", () => {
    const html = bloque("C.D. COMPA&Ntilde;&Iacute;A DE MARIA", "S.D. TOURO &amp; CIA");
    expect(partidosDeJornada(html)).toEqual([
      { local: "C.D. COMPAÑÍA DE MARIA", visitante: "S.D. TOURO & CIA", codActa: null },
    ]);
  });

  it("una página sin partidos no devuelve nada", () => {
    expect(partidosDeJornada("<html><body>Sin datos</body></html>")).toEqual([]);
  });
});
