import {
  aFechaLiteral,
  type Categoria,
  claveNombre,
  esValorDe,
  normalizarCategoria,
  type Posicion,
  POSICIONES,
  TIPOS_STAFF,
} from "@santiso/domain";
import { claveMediaDesdeUrl } from "../snapshot/media";
import type { Snapshot } from "../snapshot/tipos";
import { marcasDesde, textoOpcional } from "./comunes";
import { ErrorMigracion, type Informe, type JugadorNuevo, type StaffNuevo } from "./tipos";

/** Jugadores y R13 (staff). */
export function transformarPlantilla(
  origen: Snapshot,
  informe: Informe,
): { jugadores: JugadorNuevo[]; staff: StaffNuevo[] } {
  const jugadores = origen.jugadores.map((fila): JugadorNuevo => {
    if (!fila.categoria) {
      throw new ErrorMigracion(`El jugador "${fila.nombre}" no tiene categoría.`);
    }
    const textoPosicion = textoOpcional(fila.posicion);
    let posicion: Posicion | null = null;
    if (textoPosicion !== null) {
      if (!esValorDe(POSICIONES, textoPosicion)) {
        throw new ErrorMigracion(
          `Posición desconocida "${textoPosicion}" en el jugador "${fila.nombre}".`,
        );
      }
      posicion = textoPosicion;
    }
    return {
      id: fila.id,
      nombre: fila.nombre.trim(),
      apodo: textoOpcional(fila.apodo),
      dorsal: fila.dorsal,
      posicion,
      posicionesConocidas: fila.posiciones_conocidas ?? [],
      capitania: fila.capitan !== null && fila.capitan > 0 ? fila.capitan : null,
      categoria: normalizarCategoria(fila.categoria),
      foto: claveMediaDesdeUrl(fila.foto_url),
      fechaNacimiento: fila.fecha_nacimiento ? aFechaLiteral(fila.fecha_nacimiento) : null,
      historial: fila.historial_deportivo ?? [],
      compromiso: fila.compromiso,
      ...marcasDesde(fila.created_at),
    };
  });

  const siguienteOrden = new Map<string, number>();
  const staff = [...origen.staff_club]
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
    .map((fila): StaffNuevo => {
      const tipo = claveNombre(fila.tipo);
      if (!esValorDe(TIPOS_STAFF, tipo)) {
        throw new ErrorMigracion(`Tipo de staff desconocido "${fila.tipo}" en "${fila.nombre}".`);
      }
      let categoria: Categoria | null = null;
      if (tipo === "tecnico") {
        if (!fila.categoria) {
          throw new ErrorMigracion(`El técnico "${fila.nombre}" no tiene categoría.`);
        }
        categoria = normalizarCategoria(fila.categoria);
      } else if (fila.categoria) {
        informe.avisos.push(
          `Directivo "${fila.nombre}" tenía categoría "${fila.categoria}"; se descarta.`,
        );
      }
      const grupo = `${tipo}|${categoria ?? ""}`;
      const orden = siguienteOrden.get(grupo) ?? 0;
      siguienteOrden.set(grupo, orden + 1);
      return {
        id: fila.id,
        nombre: fila.nombre.trim(),
        cargo: fila.cargo.trim(),
        tipo,
        categoria,
        foto: claveMediaDesdeUrl(fila.foto_url),
        orden,
        ...marcasDesde(fila.created_at),
      };
    });

  return { jugadores, staff };
}
