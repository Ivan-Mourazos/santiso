import { aInstanteIso } from "@santiso/domain";

/** Conserva la fecha de creación de origen. Sin ella, la BD pone la fecha actual. */
export function marcasDesde(createdAt: string | null | undefined): {
  creadoEn?: string;
  actualizadoEn?: string;
} {
  if (!createdAt) return {};
  const instante = aInstanteIso(createdAt);
  return { creadoEn: instante, actualizadoEn: instante };
}

/** Texto recortado, o null si queda vacío. */
export const textoOpcional = (valor: string | null | undefined): string | null =>
  valor?.trim() || null;
