/** Ejecutar desde apps/studio: pnpm exec node --conditions=react-server --import tsx scripts/verificar-estadisticas.ts <ruta-absoluta-bd> */
import { abrirLecturaEstadisticas } from "@santiso/db";
import { CATEGORIAS, esValorDe } from "@santiso/domain";
import { auditarEstadisticas } from "../lib/server/consultas/auditar-estadisticas";

async function main() {
  const archivo = process.argv[2];
  if (!archivo) throw new Error("Indica la ruta absoluta de la base de datos que se va a leer.");
  const lectura = await abrirLecturaEstadisticas(archivo);
  try {
    const temporadas = await lectura.ejecutar("SELECT id FROM temporadas ORDER BY id");
    let ambitos = 0;
    let fallos = 0;
    for (const temporada of temporadas.rows) {
      const temporadaId = String(temporada.id);
      for (const categoria of CATEGORIAS) {
        const informe = await auditarEstadisticas(lectura, { temporadaId, categoria });
        console.log(JSON.stringify(informe));
        ambitos++;
        fallos += informe.errores.length;
      }
    }
    const competiciones = await lectura.ejecutar(
      "SELECT id, temporada_id, categoria FROM competiciones ORDER BY id",
    );
    for (const c of competiciones.rows) {
      const categoria = String(c.categoria);
      if (!esValorDe(CATEGORIAS, categoria)) throw new Error("Categoría almacenada desconocida");
      const informe = await auditarEstadisticas(lectura, {
        temporadaId: String(c.temporada_id),
        categoria,
        competicionId: String(c.id),
      });
      console.log(JSON.stringify(informe));
      ambitos++;
      fallos += informe.errores.length;
    }
    console.log(JSON.stringify({ ambitos, fallos, disponibilidadPenaltis: false }));
    if (fallos) process.exitCode = 1;
  } finally {
    await lectura.cerrar();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Error al verificar estadísticas");
  process.exitCode = 1;
});
