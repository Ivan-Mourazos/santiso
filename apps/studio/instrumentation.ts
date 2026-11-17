/** Se ejecuta una vez al arrancar el servidor. */
export async function register() {
  // Los programadores usan `fs` y la base de datos: solo existen en el servidor de Node.
  // Los imports van DENTRO del `if` (no tras un `return` anticipado): así el compilador los
  // descarta al construir la versión edge, que si no falla con `node:crypto`.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { iniciarProgramadorRfgf } = await import("@/lib/server/rfgf/programador");
    iniciarProgramadorRfgf();
    const { iniciarProgramadorCopias } = await import("@/lib/server/programador-copias");
    iniciarProgramadorCopias();
  }
}
