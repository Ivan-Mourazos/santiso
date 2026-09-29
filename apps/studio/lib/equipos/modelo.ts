import { claveNombre } from "@santiso/domain";
import type { EquipoDto } from "@/lib/dto";

export interface InscripcionEquipo {
  id: string;
  nombre: string;
  temporadaId: string;
  temporadaNombre: string;
}
export interface EquipoCatalogo extends EquipoDto {
  competiciones: InscripcionEquipo[];
  numeroPartidos: number;
}
export interface FiltroEquipos {
  texto: string;
  soloSinEscudo: boolean;
}
export interface BorradorEquipo {
  id: string;
  nombre: string;
  /** El escudo ya tiene volumen: los carteles no le añaden relieve. */
  escudo3d: boolean;
}

export function filtrarEquipos(lista: EquipoCatalogo[], filtro: FiltroEquipos): EquipoCatalogo[] {
  const texto = claveNombre(filtro.texto);
  return lista.filter(
    (equipo) =>
      (!filtro.soloSinEscudo || !equipo.escudo_url) && claveNombre(equipo.nombre).includes(texto),
  );
}
export function borradorDeEquipo(equipo: EquipoDto | null): BorradorEquipo {
  return {
    id: equipo?.id ?? "",
    nombre: equipo?.nombre ?? "",
    escudo3d: equipo?.escudo_3d ?? false,
  };
}
export function formularioDeEquipo(
  borrador: BorradorEquipo,
  destino: { categoria: string; competicionId?: string },
  escudo: Blob | null,
): FormData {
  const form = new FormData();
  form.set("id", borrador.id);
  form.set("nombre", borrador.nombre);
  form.set("categoria", destino.categoria);
  form.set("escudo3d", borrador.escudo3d ? "1" : "0");
  if (destino.competicionId) form.set("competicionId", destino.competicionId);
  if (escudo) form.set("escudo", escudo);
  return form;
}
