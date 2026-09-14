import { createHash } from "node:crypto";

/** UUID estable (formato v8, RFC 9562) derivado de las partes. Para filas que crea la migración. */
export function idDeterminista(...partes: string[]): string {
  const h = createHash("sha256").update(JSON.stringify(partes)).digest("hex");
  const variante = ((Number.parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-${variante}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
