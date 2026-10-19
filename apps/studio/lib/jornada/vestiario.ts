import { estadoPaso, type CartelGuardado, type PasoCartel } from "@/lib/cartel2/pasos";
import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";

/** Carteles guardados de un partido, por paso. */
export type CartelesDelPartido = Partial<Record<PasoCartel, CartelGuardado[]>>;

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

/** Días que el recién jugado sigue en la mesa para cerrarlo, si no tiene aún sus carteles. */
export const DIAS_PARA_CERRAR = 2;

/** Los carteles de después del partido (resultado, cronoloxía y O Noso 11) ya están guardados. */
export function cierreHecho(carteles: CartelesDelPartido) {
  return (["resultado", "cronoloxia", "noso11"] as const).every(
    (paso) => estadoPaso(carteles[paso]) !== "pendiente",
  );
}

/**
 * Si el recién jugado (`diaUltimo`) sigue en la mesa: el mismo día siempre; después, hasta
 * DIAS_PARA_CERRAR días mientras le falten carteles, salvo que hoy se juegue el próximo.
 */
export function sigueEnMesa(
  diaUltimo: string | null | undefined,
  diaProximo: string | null | undefined,
  ahora: string,
  cerrado: boolean,
) {
  const hoy = ahora.slice(0, 10);
  if (!diaUltimo) return false;
  if (diaUltimo.slice(0, 10) === hoy) return true;
  if (cerrado || diaProximo?.slice(0, 10) === hoy) return false;
  const dias = Math.round((Date.parse(hoy) - Date.parse(diaUltimo.slice(0, 10))) / 86_400_000);
  return dias > 0 && dias <= DIAS_PARA_CERRAR;
}

/**
 * El día del partido se cierra el recién jugado, y sigue hasta dos días más mientras le falten
 * los carteles de después. Luego vuelve a mandar el próximo.
 */
export function partidoEnMesa(
  proximo: PartidoDeLaSemana | null,
  ultimo: PartidoDeLaSemana | null,
  ahora: string,
) {
  if (ultimo && sigueEnMesa(ultimo.fecha, proximo?.fecha, ahora, ultimo.cierreHecho ?? false))
    return ultimo;
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

/** Lo que dice un cartel guardado de su paso, para la tarjeta del partido. */
function cartel(
  guardados: readonly CartelGuardado[] | undefined,
): { estado: string; hecho: boolean } {
  const estado = estadoPaso(guardados);
  if (estado === "hecho") return { estado: "Cartel guardado", hecho: true };
  if (estado === "desactualizado") return { estado: "⚠ Cartel desactualizado", hecho: false };
  return { estado: "Sin cartel", hecho: false };
}

/**
 * Solo los datos guardados prueban un paso: la convocatoria o el once guardados y el cartel
 * guardado con datos al día. Compartirlo pasa fuera del Studio: «guardado» no es «publicado».
 */
export function progresoPartido(
  p: PartidoDeLaSemana,
  ahora: string,
  categoria = "Senior",
  carteles: CartelesDelPartido = {},
) {
  const e = enlacesPartido(p, categoria);
  const despues = trasPartido(p, ahora);
  const resultado = marcador(p);
  const convocados = p.preparacion.convocatoria;
  const once = p.preparacion.titulares === 11 && p.preparacion.capitan;
  const cPartido = cartel(carteles.partido);
  const cConvocatoria = cartel(carteles.convocatoria);
  const cOnce = cartel(carteles.once);
  const cResultado = cartel(carteles.resultado);
  const cCronoloxia = cartel(carteles.cronoloxia);
  const cNoso11 = cartel(carteles.noso11);
  const pasoCartelPartido: PasoPartido = {
    titulo: "Cartel de partido",
    estado: cPartido.estado,
    tono: cPartido.hecho ? "hecho" : "pendiente",
    href: e.cartel("partido"),
  };
  const pasos: PasoPartido[] = despues
    ? [
        {
          titulo: "Marcador",
          estado: resultado
            ? `${resultado.desenlace} ${resultado.cifras}`
            : p.federacion
              ? "Lo trae la federación"
              : "Pendiente",
          tono: tieneResultado(p) ? "hecho" : "pendiente",
          // Con la federación, el marcador llega con el acta y se corrige en ella.
          href: p.federacion ? e.acta : e.calendario,
        },
        {
          titulo: "Acta",
          estado: p.acta ? "Guardada" : "Pendiente",
          tono: p.acta ? "hecho" : "pendiente",
          href: e.acta,
        },
        {
          titulo: "Cartel de resultado",
          estado: tieneResultado(p) ? cResultado.estado : "Espera resultado",
          tono: !tieneResultado(p) ? "espera" : cResultado.hecho ? "hecho" : "pendiente",
          href: e.cartel("resumo"),
        },
        {
          titulo: "Cronoloxía",
          estado: p.acta ? cCronoloxia.estado : "Espera acta",
          tono: !p.acta ? "espera" : cCronoloxia.hecho ? "hecho" : "pendiente",
          href: e.cartel("cronoloxia"),
        },
        {
          titulo: "O Noso 11",
          estado: cNoso11.estado,
          tono: cNoso11.hecho ? "hecho" : "pendiente",
          href: e.cartel("noso11"),
        },
      ]
    : !preparaConvocatoria(categoria)
      ? [pasoCartelPartido]
      : [
          pasoCartelPartido,
          {
            titulo: "Convocatoria",
            estado: convocados ? `${convocados} convocados · ${cConvocatoria.estado}` : "Pendiente",
            tono: convocados && cConvocatoria.hecho ? "hecho" : "pendiente",
            href: e.convocatoria,
          },
          {
            titulo: "Once inicial",
            estado: `${p.preparacion.titulares}/11${p.preparacion.titulares === 11 && !p.preparacion.capitan ? " · falta capitán" : once ? ` · ${cOnce.estado}` : ""}`,
            tono: once && cOnce.hecho ? "hecho" : "pendiente",
            href: e.once,
          },
        ];
  const principal: { titulo: string; href: string; traerActa?: boolean } =
    p.estado === "cancelado" || p.estado === "aplazado"
      ? { titulo: "Revisar fecha del partido", href: e.calendario }
      : despues
        ? !tieneResultado(p)
          ? p.federacion
            ? { titulo: "Esperando a la federación", href: e.acta, traerActa: true }
            : { titulo: "Anotar resultado", href: e.calendario }
          : !p.acta
            ? { titulo: "Completar acta", href: e.acta }
            : !cResultado.hecho
              ? { titulo: "Hacer cartel de resultado", href: e.cartel("resumo") }
              : !cCronoloxia.hecho
                ? { titulo: "Hacer cronoloxía", href: e.cartel("cronoloxia") }
                : !cNoso11.hecho
                  ? { titulo: "Hacer O Noso 11", href: e.cartel("noso11") }
                  : { titulo: "Carteles listos: compartir", href: e.cartel("resumo") }
        : !cPartido.hecho
          ? { titulo: "Preparar cartel de partido", href: e.cartel("partido") }
          : !preparaConvocatoria(categoria)
            ? { titulo: "Revisar cartel de partido", href: e.cartel("partido") }
            : !convocados || !cConvocatoria.hecho
              ? { titulo: "Preparar convocatoria", href: e.convocatoria }
              : !once || !cOnce.hecho
                ? { titulo: "Completar once inicial", href: e.once }
                : { titulo: "Todo listo: compartir", href: e.cartel("partido") };
  return { despues, pasos, principal };
}
