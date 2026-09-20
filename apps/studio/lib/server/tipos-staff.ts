import { esValorDe, TIPOS_STAFF, type TipoStaff } from "@santiso/domain";

/**
 * Admite tanto el catálogo nuevo (`tecnico`, `directiva`) como los valores heredados de
 * Supabase (`Tecnico`, `Directiva`), que siguen llegando por props desde `app/admin/page.tsx`.
 * Devuelve `null` si no reconoce el valor.
 */
export function normalizarTipoStaff(valor: string): TipoStaff | null {
  const minusculas = valor.trim().toLowerCase();
  return esValorDe(TIPOS_STAFF, minusculas) ? minusculas : null;
}
