import path from "node:path";
import { ultimaCopia, verificarCopia } from "../backup";

const ruta = process.argv[2] ? path.resolve(process.argv[2]) : ultimaCopia();
if (!ruta) {
  console.error("No hay copias completas para verificar.");
  process.exitCode = 1;
} else {
  const resultado = await verificarCopia(ruta);
  console.log(`Copia: ${ruta}`);
  console.log(`Restauración temporal: ${resultado.ok ? "CORRECTA" : "FALLIDA"}`);
  console.log(`Media referenciada ausente: ${resultado.mediaFaltante.length}`);
  for (const error of resultado.errores) console.error(error);
  for (const clave of resultado.mediaFaltante) console.error(`Media ausente: ${clave}`);
  if (!resultado.ok) process.exitCode = 1;
}
