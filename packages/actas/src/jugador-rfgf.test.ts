import { describe, expect, it } from "vitest";

import { jugadoresDeActaHtml, parsearEstadisticasJugador } from "./jugador-rfgf";

// Estructura de la web de la federación, con nombres inventados.
const fila = (codigo: string, dorsal: number, nombre: string) =>
  `<tr onclick="location.href='NFG_EstadisticasJugador?cod_primaria=5000274&jugador=${codigo}&codacta=1&nueva_ventana=';" style="cursor: pointer;"> <td width="1%" align=center class=font_responsive>${dorsal}</td> <td class=font_responsive style="vertical-align:middle"> ${nombre}</td> </tr>`;
const ACTA = `<div><h4>C.D. LOCAL</h4> <h5><strong>Titulares</strong></h5> <table>
${fila("101", 1, "PORTERO UN, XAN")}
${fila("102", 3, "MUÑIZ DOUS, BR&#193;IS")}
</table> <h5><strong>Suplentes</strong></h5> <table>${fila("103", 13, "SUPLENTE TRES, IAGO")}</table>
<h4>U.D. VISITANTE</h4> <h5><strong>Titulares</strong></h5> <table>
${fila("201", 1, "GARDAMETA CATRO, ANXO")}
${fila("101", 9, "REPETIDO, NON")}
</table></div>`;

const JUGADOR = `<html><body><a>Generar PDF</a>
<div><h4>GARDAMETA CATRO, ANXO</h4> <span>Equipo:</span> <b>U.D. VISITANTE&nbsp;</b>
<b>TERCERA FUTGAL,&nbsp;SANTIAGO | GRUPO 3</b><br> <span><strong>Temporada 2026-2027</strong></span></div>
<h5>Partidos</h5><table><tr><td>Convocados</td><td>5</td></tr><tr><td>Titular</td><td>4</td></tr>
<tr><td>Suplente</td><td>1</td></tr><tr><td>Jugados</td><td>5</td></tr></table>
<h5>Sanciones</h5><table><tr><td>Total</td><td>3</td></tr><tr><td>Tarjeta amarilla</td><td>2</td></tr>
<tr><td>Doble tarjeta amarilla</td><td>1</td></tr><tr><td>Tarjeta roja</td><td>0</td></tr></table>
<h5>Goles</h5><table><tr><td>Total</td><td>7</td></tr><tr><td>Goles por partido</td><td>1.4</td></tr></table>
</body></html>`;

describe("jugadores en la web de la federación", () => {
  it("saca de un partido el código y el nombre de cada jugador, con su lado", () => {
    expect(jugadoresDeActaHtml(ACTA)).toEqual([
      { codigo: "101", nombre: "PORTERO UN, XAN", lado: "local" },
      { codigo: "102", nombre: "MUÑIZ DOUS, BRÁIS", lado: "local" },
      { codigo: "103", nombre: "SUPLENTE TRES, IAGO", lado: "local" },
      { codigo: "201", nombre: "GARDAMETA CATRO, ANXO", lado: "visitante" },
    ]);
  });

  it("sin bloque de goles (alguna eliminatoria) no da error ni inventa un cero", () => {
    const sinGoles = JUGADOR.replace(/<h5>Goles<\/h5>.*?<\/table>/su, "");
    expect(parsearEstadisticasJugador(sinGoles).goles).toBeNull();
  });

  it("lee las cifras de un jugador sin confundir el total de sanciones con el de goles", () => {
    expect(parsearEstadisticasJugador(JUGADOR)).toEqual({
      nombre: "GARDAMETA CATRO, ANXO",
      equipo: "U.D. VISITANTE",
      competicion: "TERCERA FUTGAL, SANTIAGO | GRUPO 3",
      temporada: "2026-2027",
      convocados: 5,
      titular: 4,
      suplente: 1,
      jugados: 5,
      amarillas: 2,
      doblesAmarillas: 1,
      rojas: 0,
      goles: 7,
    });
  });

  it("rechaza una página que no es la de un jugador", () => {
    expect(() => parsearEstadisticasJugador("<html>Calendario</html>")).toThrow(/no es la de/);
  });
});
