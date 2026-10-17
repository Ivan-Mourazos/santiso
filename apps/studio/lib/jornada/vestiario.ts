import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";

/** Hora de pared local, igual que las fechas guardadas en el calendario. */
export function momentoLocal(ahora = new Date()) {
  const n = (v: number) => String(v).padStart(2, "0");
  return `${ahora.getFullYear()}-${n(ahora.getMonth() + 1)}-${n(ahora.getDate())}T${n(ahora.getHours())}:${n(ahora.getMinutes())}`;
}

/** Veteranos no hace convocatoria ni once: solo el Senior prepara el partido así. */
export function preparaConvocatoria(categoria: string) {
  return categoria !== "Veteranos";
}

export function tieneResultado(p: PartidoDeLaSemana) {
  return p.golesSantiso !== null && p.golesRival !== null;
}

/**
 * El marcador como se escribe en el fútbol: goles del local, goles del visitante, y delante lo
 * que significó para el Santiso. «3–8 Santiso / rival» se leía al revés tras perder 8–3 fuera.
 */
export function marcador(p: PartidoDeLaSemana) {
  if (p.golesSantiso === null || p.golesRival === null) return null;
  const cifras = p.santisoLocal
    ? `${p.golesSantiso}–${p.golesRival}`
    : `${p.golesRival}–${p.golesSantiso}`;
  const desenlace =
    p.golesSantiso > p.golesRival ? "Victoria" : p.golesSantiso < p.golesRival ? "Derrota" : "Empate";
  return { cifras, desenlace };
}

/** Pasar la hora de inicio no significa que el partido haya terminado. */
export function trasPartido(p: PartidoDeLaSemana, ahora: string) {
  if (p.estado === "aplazado" || p.estado === "cancelado" || p.estado === "en_juego") return false;
  if (p.estado === "finalizado" || tieneResultado(p)) return true;
  if (!p.fecha?.includes("T")) return false;
  const fin = new Date(p.fecha);
  fin.setMinutes(fin.getMinutes() + 120);
  return !Number.isNaN(fin.getTime()) && momentoLocal(fin) <= ahora;
}

/** Hoy se cierra el recién jugado. Al día siguiente vuelve a mandar el próximo. */
export function partidoEnMesa(
  proximo: PartidoDeLaSemana | null,
  ultimo: PartidoDeLaSemana | null,
  ahora: string,
) {
  if (ultimo?.fecha?.slice(0, 10) === ahora.slice(0, 10)) return ultimo;
  return proximo ?? ultimo;
}

export interface PasoPartido {
  titulo: string;
  estado: string;
  tono: "hecho" | "pendiente" | "espera";
  href: string;
}

export function enlacesPartido(p: PartidoDeLaSemana, categoria: string) {
  const cat = encodeURIComponent(categoria);
  const id = encodeURIComponent(p.id);
  return {
    convocatoria: `/admin/convocatoria?categoria=${cat}&partido=${id}`,
    once: `/admin/alineacion?categoria=${cat}&partido=${id}`,
    cartel: (plantilla: string) => `/admin/carteles?plantilla=${plantilla}&partido=${id}`,
    calendario: `/admin/calendario?categoria=${cat}&competicion=${p.competicionId}&jornada=${p.jornadaId}`,
    acta: `/admin/actas?categoria=${cat}&competicion=${p.competicionId}&partido=${id}`,
    resultados: `/admin/importar-jornada?origen=foto&categoria=${cat}&competicion=${p.competicionId}&jornada=${p.jornadaId}`,
    clasificacion: `/admin/clasificacion?categoria=${cat}&competicion=${p.competicionId}`,
  };
}

/** Solo los datos guardados prueban un paso. Abrir Carteles no confirma una publicación. */
export function progresoPartido(p: PartidoDeLaSemana, ahora: string, categoria = "Senior") {
  const e = enlacesPartido(p, categoria);
  const despues = trasPartido(p, ahora);
  const resultado = marcador(p);
  const convocados = p.preparacion.convocatoria;
  const once = p.preparacion.titulares === 11 && p.preparacion.capitan;
  const pasos: PasoPartido[] = despues
    ? [
        {
          titulo: "Resultado",
          estado: resultado ? `${resultado.desenlace} ${resultado.cifras}` : "Pendiente",
          tono: tieneResultado(p) ? "hecho" : "pendiente",
          href: e.calendario,
        },
        {
          titulo: "Acta",
          estado: p.acta ? "Guardada" : "Pendiente",
          tono: p.acta ? "hecho" : "pendiente",
          href: e.acta,
        },
        {
          titulo: "Publicaciones",
          estado:
            p.acta && tieneResultado(p)
              ? ""
              : tieneResultado(p)
                ? "Resultado disponible"
                : "Espera resultado",
          tono: tieneResultado(p) ? "pendiente" : "espera",
          href: e.cartel("resumo"),
        },
      ]
    : !preparaConvocatoria(categoria)
      ? [
          {
            titulo: "Cartel",
            estado: "",
            tono: "pendiente",
            href: e.cartel("partido"),
          },
        ]
      : [
        {
          titulo: "Convocatoria",
          estado: convocados ? `${convocados} guardados` : "Pendiente",
          tono: convocados ? "hecho" : "pendiente",
          href: e.convocatoria,
        },
        {
          titulo: "Once",
          estado: `${p.preparacion.titulares}/11${p.preparacion.titulares === 11 && !p.preparacion.capitan ? " · falta capitán" : ""}`,
          tono: once ? "hecho" : "pendiente",
          href: e.once,
        },
        {
          titulo: "Cartel",
          // Compartir pasa fuera del Studio: no se puede saber si está hecho, así que no lleva estado.
          estado: "",
          tono: "pendiente",
          href: e.cartel("partido"),
        },
      ];
  const principal =
    p.estado === "cancelado" || p.estado === "aplazado"
      ? { titulo: "Revisar fecha del partido", href: e.calendario }
      : despues
        ? !tieneResultado(p)
          ? { titulo: "Anotar resultado", href: e.calendario }
          : !p.acta
            ? { titulo: "Completar acta", href: e.acta }
            : { titulo: "Preparar publicaciones", href: e.cartel("resumo") }
        : !preparaConvocatoria(categoria)
          ? { titulo: "Preparar cartel de partido", href: e.cartel("partido") }
          : !convocados
          ? { titulo: "Preparar convocatoria", href: e.convocatoria }
          : !once
            ? { titulo: "Completar once", href: e.once }
            : { titulo: "Preparar cartel de partido", href: e.cartel("partido") };
  return { despues, pasos, principal };
}
