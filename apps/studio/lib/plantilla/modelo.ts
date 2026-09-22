import { claveNombre, POSICIONES } from "@santiso/domain";
import type { JugadorDto, StaffDto } from "@/lib/dto";

/**
 * Lógica pura de las pantallas de Plantilla y Staff: filtrado, borradores del editor y su paso a
 * `FormData`. Sin React ni servidor, para poder probarla sola.
 */

export const ETIQUETAS_POSICION: Record<(typeof POSICIONES)[number], string> = {
  POR: "Portero",
  LD: "Lateral derecho",
  DFC: "Defensa central",
  LI: "Lateral izquierdo",
  MCD: "Medio centro defensivo",
  MC: "Medio centro",
  MCO: "Medio centro ofensivo",
  MD: "Medio derecho",
  MI: "Medio izquierdo",
  ED: "Extremo derecho",
  EI: "Extremo izquierdo",
  DC: "Delantero centro",
};
export { POSICIONES };

// ─── Filtrado ──────────────────────────────────────────────────────────────────────────────

export interface FiltroJugadores {
  texto: string;
  /** "" = todas. */
  posicion: string;
  soloSinFoto: boolean;
}

export const FILTRO_VACIO: FiltroJugadores = { texto: "", posicion: "", soloSinFoto: false };

/** Busca por nombre o apodo sin tildes ni mayúsculas, y por dorsal si se escribe un número. */
export function filtrarJugadores(lista: JugadorDto[], filtro: FiltroJugadores): JugadorDto[] {
  const buscado = claveNombre(filtro.texto);
  return lista.filter((j) => {
    if (filtro.posicion && j.posicion !== filtro.posicion) return false;
    if (filtro.soloSinFoto && j.foto_url) return false;
    if (!buscado) return true;
    if (/^\d+$/.test(buscado) && j.dorsal === Number(buscado)) return true;
    return (
      claveNombre(j.nombre).includes(buscado) ||
      (j.apodo !== null && claveNombre(j.apodo).includes(buscado))
    );
  });
}

/** Busca por nombre o cargo, sin tildes ni mayúsculas. */
export function filtrarStaff(lista: StaffDto[], texto: string): StaffDto[] {
  const buscado = claveNombre(texto);
  if (!buscado) return lista;
  return lista.filter(
    (s) => claveNombre(s.nombre).includes(buscado) || claveNombre(s.cargo).includes(buscado),
  );
}

/** Dorsales que se repiten en la lista: es un aviso, no un error (en la vida real pasa). */
export function dorsalesRepetidos(lista: JugadorDto[]): Set<number> {
  const vistos = new Set<number>();
  const repetidos = new Set<number>();
  for (const { dorsal } of lista) {
    if (dorsal === null) continue;
    if (vistos.has(dorsal)) repetidos.add(dorsal);
    vistos.add(dorsal);
  }
  return repetidos;
}

// ─── Borradores del editor ─────────────────────────────────────────────────────────────────

/**
 * Lo que se edita de un jugador. `jugadorId` es la persona (vacío = alta). Los campos de la
 * persona se comparten entre temporadas; dorsal, posición y foto son de la inscripción.
 */
export interface BorradorJugador {
  jugadorId: string;
  nombre: string;
  apodo: string;
  fechaNacimiento: string;
  historial: string;
  dorsal: string;
  posicion: string;
}

export function borradorDeJugador(jugador: JugadorDto | null): BorradorJugador {
  return {
    jugadorId: jugador?.id ?? "",
    nombre: jugador?.nombre ?? "",
    apodo: jugador?.apodo ?? "",
    fechaNacimiento: jugador?.fecha_nacimiento ?? "",
    historial: (jugador?.historial_deportivo ?? []).join("\n"),
    // `0` es un dorsal válido: no confundirlo con «sin dorsal».
    dorsal: jugador?.dorsal === null || jugador?.dorsal === undefined ? "" : String(jugador.dorsal),
    posicion: jugador?.posicion ?? "",
  };
}

/**
 * `guardarJugador` reescribe la persona y la inscripción enteras: aquí se envían siempre todos
 * los campos, también cuando solo cambia la foto.
 */
export function formularioDeJugador(
  borrador: BorradorJugador,
  destino: { temporadaId: string; categoria: string },
  foto: Blob | null,
): FormData {
  const f = new FormData();
  f.set("id", borrador.jugadorId);
  f.set("temporadaId", destino.temporadaId);
  f.set("categoria", destino.categoria);
  f.set("nombre", borrador.nombre);
  f.set("apodo", borrador.apodo);
  f.set("fechaNacimiento", borrador.fechaNacimiento);
  f.set("historial", borrador.historial);
  f.set("dorsal", borrador.dorsal.trim());
  f.set("posicion", borrador.posicion);
  if (foto) f.set("foto", foto);
  return f;
}

/** Lo que se edita de un papel del staff. `staffId` es la persona; `inscripcionId`, el papel. */
export interface BorradorStaff {
  staffId: string;
  inscripcionId: string;
  nombre: string;
  cargo: string;
}

export function borradorDeStaff(miembro: StaffDto | null): BorradorStaff {
  return {
    staffId: miembro?.id ?? "",
    inscripcionId: miembro?.inscripcion_id ?? "",
    nombre: miembro?.nombre ?? "",
    cargo: miembro?.cargo ?? "",
  };
}

export function formularioDeStaff(
  borrador: BorradorStaff,
  destino: { temporadaId: string; tipo: string; categoria?: string },
  foto: Blob | null,
): FormData {
  const f = new FormData();
  f.set("id", borrador.staffId);
  f.set("inscripcionId", borrador.inscripcionId);
  f.set("temporadaId", destino.temporadaId);
  f.set("nombre", borrador.nombre);
  f.set("cargo", borrador.cargo);
  f.set("tipo", destino.tipo);
  f.set("categoria", destino.categoria ?? "");
  if (foto) f.set("foto", foto);
  return f;
}

/** ¿Difiere el borrador del de partida? Una foto nueva siempre cuenta como cambio. */
export function hayCambios<T extends object>(inicial: T, actual: T, fotoNueva: boolean): boolean {
  if (fotoNueva) return true;
  return (Object.keys(inicial) as (keyof T)[]).some((k) => inicial[k] !== actual[k]);
}

/** Valida en el cliente lo mismo que el servidor, para marcar el campo antes de enviar. */
export function erroresJugador(b: BorradorJugador): Partial<Record<keyof BorradorJugador, string>> {
  const errores: Partial<Record<keyof BorradorJugador, string>> = {};
  if (!b.nombre.trim()) errores.nombre = "El nombre es obligatorio.";
  const dorsal = b.dorsal.trim();
  if (dorsal !== "" && !/^\d+$/.test(dorsal)) errores.dorsal = "El dorsal debe ser un número.";
  return errores;
}

export function erroresStaff(b: BorradorStaff): Partial<Record<keyof BorradorStaff, string>> {
  const errores: Partial<Record<keyof BorradorStaff, string>> = {};
  if (!b.nombre.trim()) errores.nombre = "El nombre es obligatorio.";
  if (!b.cargo.trim()) errores.cargo = "El cargo es obligatorio.";
  return errores;
}
