import type { Informe, ModeloNuevo } from "./transformar/tipos";
import type { ResultadoVerificacion } from "./verificar";

export interface EntradaInforme {
  dirSnapshot: string;
  modelo: ModeloNuevo;
  informe: Informe;
  verificacion: ResultadoVerificacion;
  fecha: Date;
}

const lista = (elementos: string[]) =>
  elementos.length > 0 ? elementos.map((elemento) => `- ${elemento}`) : ["- Ninguno"];
const celda = (valor: string | number) => String(valor).replaceAll("|", "\\|");

export function renderizarInforme({
  dirSnapshot,
  modelo,
  informe,
  verificacion,
  fecha,
}: EntradaInforme): string {
  const lineas = [
    "# Informe de migración Supabase → SQLite",
    "",
    `- **Fecha:** ${fecha.toISOString()}`,
    `- **Snapshot:** \`${dirSnapshot}\``,
    `- **Resultado:** ${verificacion.ok ? "correcto" : "CON ERRORES"}`,
    "",
    "## Filas importadas",
    "",
    "| Tabla | Filas |",
    "| --- | ---: |",
    ...Object.entries(modelo).map(([tabla, filas]) => `| ${tabla} | ${filas.length} |`),
    "",
    "## Comprobaciones",
    "",
    "| Comprobación | Estado | Detalle |",
    "| --- | --- | --- |",
    ...verificacion.comprobaciones.map(
      (c) => `| ${celda(c.nombre)} | ${c.ok ? "OK" : "FALLO"} | ${celda(c.detalle)} |`,
    ),
    "",
    "## Correcciones aplicadas",
    "",
    ...lista(informe.avisos),
    "",
    "## Equipos fusionados",
    "",
    ...lista(
      informe.equiposFusionados.map(
        (f) =>
          `${f.nombre} (${f.categoria}): se conserva ${f.conservado}; se fusionan ${f.eliminados.join(", ")}`,
      ),
    ),
    "",
    "## Equipos separados por categoría",
    "",
    ...lista(
      informe.equiposSeparados.map(
        (f) => `${f.nombre} → ${f.categoria} en "${f.competicion}" (${f.origen} → ${f.nuevo})`,
      ),
    ),
    "",
    "## Participaciones creadas desde eventos",
    "",
    String(informe.participacionesCreadas),
    "",
    "## Clasificación manual antigua",
    "",
    "Referencia para validar la clasificación calculada en la Fase 6. No se importa.",
    "",
    "| Equipo | Categoría | PTS | PJ | PG | PE | PP | GF | GC |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...informe.clasificacionManualAntigua.map(
      (c) =>
        `| ${celda(c.nombre)} | ${c.categoria} | ${c.pts} | ${c.pj} | ${c.pg} | ${c.pe} | ${c.pp} | ${c.gf} | ${c.gc} |`,
    ),
  ];
  return `${lineas.join("\n")}\n`;
}
