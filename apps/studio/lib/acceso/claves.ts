import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { LARGO_MINIMO_CLAVE } from "./largo";

const LARGO_SAL = 16;
const LARGO_DERIVADA = 64;

function derivar(clave: string, sal: Buffer): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(clave.normalize("NFKC"), sal, LARGO_DERIVADA, (error, derivada) =>
      error ? rechazar(error) : resolver(derivada),
    );
  });
}

/** Lo que se guarda de una contraseña: `scrypt$<sal>$<derivada>`. La contraseña, nunca. */
export async function hashDeClave(clave: string): Promise<string> {
  const sal = randomBytes(LARGO_SAL);
  const derivada = await derivar(clave, sal);
  return `scrypt$${sal.toString("hex")}$${derivada.toString("hex")}`;
}

/** Comprueba una contraseña contra su hash, en tiempo constante. */
export async function claveCorrecta(clave: string, hash: string): Promise<boolean> {
  const [algoritmo, salHex, derivadaHex] = hash.split("$");
  if (algoritmo !== "scrypt" || !salHex || !derivadaHex) return false;
  const esperada = Buffer.from(derivadaHex, "hex");
  if (esperada.length !== LARGO_DERIVADA) return false;
  const derivada = await derivar(clave, Buffer.from(salHex, "hex"));
  return timingSafeEqual(derivada, esperada);
}

/** Valor aleatorio que va en la cookie de sesión. */
export function nuevoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Lo que se guarda de un token: su SHA-256. Con la base en la mano no se puede suplantar. */
export function huellaDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Nombre de usuario canónico: minúsculas y sin espacios alrededor. */
export function normalizarUsuario(usuario: string): string {
  return usuario.trim().toLowerCase();
}

/** `null` si el nombre de usuario vale; si no, por qué. */
export function errorDeUsuario(usuario: string): string | null {
  return /^[a-z0-9._-]{3,32}$/.test(normalizarUsuario(usuario))
    ? null
    : "El usuario debe tener de 3 a 32 letras, números, puntos o guiones, sin espacios.";
}

/** `null` si la contraseña vale; si no, por qué. */
export function errorDeClave(clave: string): string | null {
  if (clave.length < LARGO_MINIMO_CLAVE) {
    return `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`;
  }
  if (clave.length > 200) return "La contraseña es demasiado larga.";
  return null;
}
