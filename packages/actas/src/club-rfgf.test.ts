import { expect, it } from "vitest";
import { competicionesDeClubHtml } from "./equipo-rfgf";
const fila = (categoria: string, competicion: string) =>
  `<tr><td><a href="?codequipo=1231">BASTAVALES U.D.</a></td><td>${categoria}</td><td><a href="?codcompeticion=20">${competicion}</a></td><td><a href="?codgrupo=30">GRUPO 2</a></td></tr>`;
it("lee tabla del club, temporadas y descarta femenino y sala", () => {
  const r = competicionesDeClubHtml(
    `<select name=codtemporada><option value=19>2023-2024</option></select><table><tr><th>Equipo</th><th>Categoría</th><th>Competición</th><th>Grupo</th></tr>${fila("1ª FUTGAL&nbsp;", "PRIMERA FUTGAL")}${fila("FEMENINA", "Liga")}${fila("L.G.F.", "Liga")}${fila("Senior", "FUTBOL SALA")}</table>`,
  );
  expect(r.temporadas).toEqual([{ codigo: "19", temporada: "2023-2024" }]);
  expect(r.grupos).toHaveLength(1);
  expect(r.grupos![0]).toMatchObject({
    codEquipo: "1231",
    codGrupo: "30",
    codCompeticion: "20",
    categoria: "1ª FUTGAL",
  });
  expect(competicionesDeClubHtml("<html>Sin tabla</html>").grupos).toBeNull();
});
