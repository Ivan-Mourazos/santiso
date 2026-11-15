import { hoyLocal } from "@/lib/jornada/semana";
import { partidoEnMesa, progresoPartido, trasPartido } from "@/lib/jornada/vestiario";
import { categoriasPorConvocar, pestanasConAviso } from "@/lib/navigation/avisos";
import { respuestaSinSesion } from "@/lib/server/acceso/sesion";
import { cartelesDePartidos } from "@/lib/server/carteles/guardados";
import { pantallaJornada } from "@/lib/server/consultas/jornada";

/**
 * El punto de aviso de la barra de abajo: las pestañas con algo pendiente de nuestros partidos
 * de la semana y las categorías con la convocatoria por hacer. Es una ruta y no una acción del
 * servidor porque las acciones van de una en una: el aviso hacía esperar a la pantalla abierta.
 * `?carteles=0` para quien no hace carteles (el técnico). Solo lee.
 */
export async function GET(peticion: Request) {
  const sinSesion = await respuestaSinSesion();
  if (sinSesion) return sinSesion;
  try {
    const conCarteles = new URL(peticion.url).searchParams.get("carteles") !== "0";
    const { momento, categorias } = await pantallaJornada(hoyLocal());
    const partidos = categorias.flatMap((c) => {
      const p = partidoEnMesa(c.proximo, c.ultimo, momento);
      return p ? [{ categoria: c.categoria, p }] : [];
    });
    const guardados = conCarteles ? await cartelesDePartidos(partidos.map(({ p }) => p.id)) : {};
    const pestanas = pestanasConAviso(
      partidos.map(({ categoria, p }) =>
        progresoPartido(p, momento, categoria, guardados[p.id] ?? {}, conCarteles),
      ),
    );
    const porConvocar = categoriasPorConvocar(
      partidos.map(({ categoria, p }) => ({
        categoria,
        despues: trasPartido(p, momento),
        convocados: p.preparacion.convocatoria,
      })),
    );
    return Response.json({ pestanas: [...pestanas], porConvocar: [...porConvocar] });
  } catch (error) {
    console.error("GET /api/avisos", error);
    return Response.json({ error: "No se pudieron cargar los avisos." }, { status: 503 });
  }
}
