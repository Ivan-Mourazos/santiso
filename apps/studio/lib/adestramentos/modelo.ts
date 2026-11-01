export type Estado = "presente" | "tarde" | "ausente";
export interface Marca {
  personaClave: string;
  estado: Estado;
  justificado: boolean;
  motivo?: string | null;
}
export function conceptoDe(marca: Pick<Marca, "estado" | "justificado">): string | null {
  if (marca.justificado || marca.estado === "presente") return null;
  return marca.estado === "tarde"
    ? "Chegar tarde (inxustificado)"
    : "Non asistencia (inxustificada)";
}
export function cambioDe(
  antes: Pick<Marca, "estado" | "justificado"> | undefined,
  despues: Marca,
  multa: { pagadaEn: string | null } | undefined,
) {
  const cambio =
    !antes || antes.estado !== despues.estado || antes.justificado !== despues.justificado;
  if (!cambio) return "mantener";
  if (multa?.pagadaEn) return "avisar";
  if (conceptoDe(despues)) return "crear";
  return "quitar";
}
