/** Se ejecuta una vez al arrancar el servidor. */
export async function register() {
  // Los programadores usan `fs` y la base de datos: solo existen en el servidor de Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarProgramadorRfgf } = await import("@/lib/server/rfgf/programador");
  iniciarProgramadorRfgf();
  const { iniciarProgramadorCopias } = await import("@/lib/server/programador-copias");
  iniciarProgramadorCopias();
}
