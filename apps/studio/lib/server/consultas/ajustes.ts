import "server-only";
import { schema } from "@santiso/db";
import { type ClaveAjuste, type ValorAjuste, validarAjuste } from "@santiso/domain";
import { eq } from "drizzle-orm";
import { obtenerDb } from "@/lib/server/db";

/**
 * Valor de un ajuste global, ya validado contra su esquema.
 * Un valor corrupto se trata como ausente: la pantalla lo muestra vacío en vez de romperse.
 */
export async function leerAjuste<K extends ClaveAjuste>(clave: K): Promise<ValorAjuste<K> | null> {
  const { db } = await obtenerDb();
  const [fila] = await db
    .select({ valor: schema.ajustes.valor })
    .from(schema.ajustes)
    .where(eq(schema.ajustes.id, clave));
  if (!fila) return null;
  try {
    return validarAjuste(clave, fila.valor);
  } catch {
    return null;
  }
}
