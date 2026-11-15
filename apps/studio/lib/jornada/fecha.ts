/** Día («domingo, 15 nov») y hora («16:00») de un partido; sin fecha, «Fecha por confirmar». */
export function fechaPartido(fecha: string | null) {
  if (!fecha) return { dia: "Fecha por confirmar", hora: "" };
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return { dia: "Fecha por confirmar", hora: "" };
  return {
    dia: f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }),
    hora: fecha.includes("T") ? fecha.slice(11, 16) : "",
  };
}
