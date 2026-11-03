import type { Marca } from "./modelo";

export type Periodo = "mes" | "diez" | "temporada";
export type Orden = "nombre" | "asistencia";
export interface Entreno {
  id: string;
  fecha: string;
}
export interface Persona {
  clave: string;
  nombre: string;
}
export interface Registro extends Marca {
  entrenamientoId: string;
}
export function fechaCorta(fecha: string) {
  const [, mes, dia] = fecha.split("-");
  return `${Number(dia)}/${Number(mes)}`;
}
export function letra(m?: Marca) {
  if (!m) return "·";
  const valor = { presente: "P", tarde: "T", ausente: "F" }[m.estado];
  return m.justificado ? valor.toLowerCase() : valor;
}
export function descripcion(m?: Marca) {
  if (!m) return "Sin marca: no figuraba en este entrenamiento";
  return `${{ presente: "Presente", tarde: "Tarde", ausente: "Falta" }[m.estado]}${m.justificado ? ", justificado" : ""}${m.motivo ? `: ${m.motivo}` : ""}`;
}
export function cuadrante(
  entrenos: Entreno[],
  personas: Persona[],
  marcas: Registro[],
  periodo: Periodo,
  orden: Orden,
  hoy: string,
) {
  const limite = new Date(`${hoy}T12:00:00Z`);
  // Mes móvil; limita al último día existente si el mes anterior es más corto.
  const dia = limite.getUTCDate();
  limite.setUTCDate(1);
  limite.setUTCMonth(limite.getUTCMonth() - 1);
  const ultimo = new Date(
    Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth() + 1, 0),
  ).getUTCDate();
  limite.setUTCDate(Math.min(dia, ultimo));
  const desde = limite.toISOString().slice(0, 10);
  let columnas = [...entrenos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id),
  );
  if (periodo === "diez") columnas = columnas.slice(0, 10);
  if (periodo === "mes") columnas = columnas.filter((e) => e.fecha >= desde && e.fecha <= hoy);
  const indice = new Map(marcas.map((m) => [`${m.entrenamientoId}/${m.personaClave}`, m]));
  const filas = personas
    .map((p) => {
      const celdas = columnas.map((e) => indice.get(`${e.id}/${p.clave}`));
      const registradas = celdas.filter((m) => m !== undefined);
      const asistencia = registradas.filter((m) => m.estado !== "ausente").length;
      return {
        ...p,
        celdas,
        porcentaje: registradas.length ? Math.round((asistencia * 100) / registradas.length) : null,
        tardes: registradas.filter((m) => m.estado === "tarde" && !m.justificado).length,
        faltas: registradas.filter((m) => m.estado === "ausente" && !m.justificado).length,
      };
    })
    .sort(
      (a, b) =>
        (orden === "asistencia" ? (a.porcentaje ?? -1) - (b.porcentaje ?? -1) : 0) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
  const totales = columnas.map((_, i) => ({
    presentes: filas.filter((f) => f.celdas[i]?.estado === "presente").length,
    total: filas.filter((f) => f.celdas[i]).length,
  }));
  return { columnas, filas, totales };
}
const limpio = (s: string) => s.replace(/[\t\r\n]+/g, " ");
export function textoTabla(tabla: ReturnType<typeof cuadrante>) {
  return [
    ["Persona", ...tabla.columnas.map((e) => fechaCorta(e.fecha)), "Asistencia"],
    ...tabla.filas.map((f) => [
      f.nombre,
      ...f.celdas.map(letra),
      f.porcentaje === null ? "—" : `${f.porcentaje}%`,
    ]),
  ]
    .map((fila) => fila.map(limpio).join("\t"))
    .join("\n");
}
export function textoWhatsapp(
  entreno: Entreno,
  categoria: string,
  personas: Persona[],
  marcas: Registro[],
) {
  const nombres = new Map(personas.map((p) => [p.clave, p.nombre]));
  const dia = new Intl.DateTimeFormat("es-ES", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${entreno.fecha}T12:00:00Z`),
  );
  const lineas = [`Entrenamiento ${dia} ${fechaCorta(entreno.fecha)} · ${categoria}`];
  for (const [estado, titulo] of [
    ["presente", "✅ Presentes"],
    ["tarde", "⏰ Tarde"],
    ["ausente", "❌ Faltan"],
  ] as const) {
    const grupo = marcas.filter((m) => m.entrenamientoId === entreno.id && m.estado === estado);
    if (grupo.length)
      lineas.push(
        `${titulo} (${grupo.length}): ${grupo.map((m) => `${limpio(nombres.get(m.personaClave) ?? m.personaClave)}${m.justificado ? ` (justificado${m.motivo ? `: ${limpio(m.motivo)}` : ""})` : ""}`).join(", ")}`,
      );
  }
  return lineas.join("\n");
}
