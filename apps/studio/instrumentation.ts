/** Se ejecuta una vez al arrancar el servidor. */
export async function register() {
  // El programador usa `fs` y la base de datos: solo existe en el servidor de Node.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarProgramadorRfgf } = await import("@/lib/server/rfgf/programador");
  iniciarProgramadorRfgf();
}
