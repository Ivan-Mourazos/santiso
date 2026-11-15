import { hoyLocal } from "@/lib/jornada/semana";
import { partidoEnMesa, trasPartido } from "@/lib/jornada/vestiario";
import { categoriasPorConvocar } from "@/lib/navigation/avisos";
import { respuestaSinSesion } from "@/lib/server/acceso/sesion";
import { pantallaJornada } from "@/lib/server/consultas/jornada";

/**
 * Las categorías con la convocatoria de la semana por hacer, para que la pestaña «Equipo» lleve
 * directa a ella. Es una ruta y no una acción del servidor porque las acciones van de una en una:
 * así no hace esperar a la pantalla abierta. Solo lee.
 */
export async function GET() {
  const sinSesion = await respuestaSinSesion();
  if (sinSesion) return sinSesion;
  try {
    const { momento, categorias } = await pantallaJornada(hoyLocal());
    const porConvocar = categoriasPorConvocar(
      categorias.flatMap((c) => {
        const p = partidoEnMesa(c.proximo, c.ultimo, momento);
        return p
          ? [
              {
                categoria: c.categoria,
                despues: trasPartido(p, momento),
                convocados: p.preparacion.convocatoria,
              },
            ]
          : [];
      }),
    );
    return Response.json({ porConvocar: [...porConvocar] });
  } catch (error) {
    console.error("GET /api/avisos", error);
    return Response.json({ error: "No se pudieron cargar los avisos." }, { status: 503 });
  }
}
