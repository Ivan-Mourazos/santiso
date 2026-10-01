/**
 * Texto para Instagram de cada cartel, en gallego. Sale del mismo formulario que el cartel y se
 * puede retocar en pantalla antes de copiarlo. Corto, con lo que no se ve en la imagen (goles con
 * minuto, tarjetas, campo) y pocos hashtags: los que de verdad usa el club.
 */
import type { FormState, TemplateId } from "@/components/admin/cartel/types";
import type { CronEvent, FilaCartelClasificacion, Player } from "./types";

const DIAS = ["domingo", "luns", "martes", "mércores", "xoves", "venres", "sábado"];
const MESES = [
  "xaneiro",
  "febreiro",
  "marzo",
  "abril",
  "maio",
  "xuño",
  "xullo",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "decembro",
];

/** Límite de Instagram para el pie de una publicación. */
export const LIMITE_INSTAGRAM = 2200;

/** «2026-10-04» → «Domingo 4 de outubro»; vacío si no hay fecha válida. */
export function dataLonga(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return "";
  const [, a, mes, d] = m;
  // Mediodía UTC: el día de la semana no depende de la zona horaria.
  const dia = new Date(Date.UTC(Number(a), Number(mes) - 1, Number(d), 12)).getUTCDay();
  const texto = `${DIAS[dia]} ${Number(d)} de ${MESES[Number(mes) - 1]}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const nomeClub = (categoria: string) =>
  categoria === "Veteranos" ? "UD Santiso FC Solaina" : "UD Santiso FC";

const etiquetaCategoria = (categoria: string) =>
  categoria === "Veteranos" ? "Veteranos" : "Sénior";

/** Hashtags del club: fijos, categoría y, si es copa, #Copa. Sin repetidos. */
function hashtags(categoria: string, ...extra: string[]): string {
  const lista = [
    "#UDSantiso",
    categoria === "Veteranos" ? "#Veteranos" : "#Senior",
    ...extra,
    "#FutbolGalego",
    "#FamiliaAurinegra",
  ];
  return [...new Set(lista.filter(Boolean))].join(" ");
}

const esCopa = (competicion: string) => /copa/i.test(competicion);

/** «Xornada 2 · Tercera Futgal - Grupo 3» con lo que haya. */
function cabeceraCompeticion(jornada: string, competicion: string): string {
  const partes = [];
  if (jornada.trim() && !esCopa(competicion)) partes.push(`Xornada ${jornada.trim()}`);
  if (competicion.trim()) partes.push(competicion.trim());
  return partes.join(" · ");
}

/** Línea «Local – Visitante» según el lado del Santiso. */
function cruce(categoria: string, rival: string, santisoLocal: boolean, sep = " – "): string {
  const club = nomeClub(categoria);
  const otro = rival.trim() || "Rival";
  return santisoLocal ? `${club}${sep}${otro}` : `${otro}${sep}${club}`;
}

/** «Fulano (12', 81'), Mengano (54' pen.)»: agrupado por jugador, en orden de minuto. */
function listaGoles(eventos: CronEvent[]): string {
  const porJugador = new Map<string, string[]>();
  const ordenados = [...eventos].sort((x, y) => Number(x.minuto) - Number(y.minuto));
  for (const e of ordenados) {
    const nome = (e.jugador || "").trim() || "Gol";
    const clave = e.tipo === "propia" ? `${nome} (p.p.)` : nome;
    const minuto = e.minuto.trim() ? `${e.minuto.trim()}'${e.tipo === "penalti" ? " pen." : ""}` : "";
    const lista = porJugador.get(clave) ?? [];
    if (minuto) lista.push(minuto);
    porJugador.set(clave, lista);
  }
  return [...porJugador.entries()]
    .map(([nome, minutos]) => (minutos.length ? `${nome} (${minutos.join(", ")})` : nome))
    .join(", ");
}

const GOLES: CronEvent["tipo"][] = ["gol", "penalti", "propia"];
const TARXETAS: CronEvent["tipo"][] = ["amarela", "doble_amarela", "vermella"];
const iconoTarxeta = (tipo: CronEvent["tipo"]) =>
  tipo === "amarela" ? "🟨" : tipo === "doble_amarela" ? "🟨🟥" : "🟥";

// ─── Por plantilla ──────────────────────────────────────────────────────────────────────

function textoPrevia(f: FormState): string {
  const santisoLocal = f.santisoSide === "left";
  const data = dataLonga(f.fecha);
  const linhas = [
    `📣 ${etiquetaCategoria(f.categoria).toUpperCase()} · ${cabeceraCompeticion(f.jornada, f.competicion)}`.replace(
      / · $/,
      "",
    ),
    "",
    `🆚 ${cruce(f.categoria, f.rivalNombre, santisoLocal)}`,
    `🗓️ ${data || "Data por confirmar"}${f.hora ? ` · ${f.hora} h` : ""}`,
  ];
  if (f.lugar.trim()) linhas.push(`📍 ${f.lugar.trim()}`);
  linhas.push(
    "",
    santisoLocal ? "Vémonos no campo. Todos a animar! 💛🖤" : "Toca saír fóra. Imos con todo! 💛🖤",
    "",
    hashtags(f.categoria, esCopa(f.competicion) ? "#Copa" : "#Previa"),
  );
  return linhas.join("\n");
}

function textoProximos(f: FormState): string {
  const partidos = f.matches.filter((m) => m.rival.trim()).slice(0, 2);
  if (partidos.length === 0) return "";
  const linhas = ["🗓️ AXENDA DA FIN DE SEMANA", ""];
  for (const m of partidos) {
    const santisoLocal = m.santisoSide === "left";
    linhas.push(`⚽ ${etiquetaCategoria(m.categoria).toUpperCase()}`);
    linhas.push(cruce(m.categoria, m.rival, santisoLocal));
    const data = dataLonga(m.fecha);
    linhas.push(`${data || "Data por confirmar"}${m.hora ? ` · ${m.hora} h` : ""}`);
    if (m.lugar?.trim()) linhas.push(`📍 ${m.lugar.trim()}`);
    linhas.push("");
  }
  linhas.push("Contamos contigo! 💛🖤", "", hashtags(partidos[0]!.categoria, "#Axenda"));
  return linhas.join("\n");
}

function textoResultado(f: FormState, conCarrusel: boolean): string {
  const santisoLocal = f.santisoSide === "left";
  const golesLocal = Number.parseInt(f.golesLocal || "0", 10) || 0;
  const golesVisitante = Number.parseInt(f.golesRival || "0", 10) || 0;
  const nosos = santisoLocal ? golesLocal : golesVisitante;
  const deles = santisoLocal ? golesVisitante : golesLocal;
  const titular = nosos > deles ? "✅ VITORIA" : nosos < deles ? "❌ DERROTA" : "🤝 EMPATE";

  const club = nomeClub(f.categoria);
  const rival = f.rivalNombre.trim() || "Rival";
  const marcador = santisoLocal
    ? `${club} ${golesLocal}-${golesVisitante} ${rival}`
    : `${rival} ${golesLocal}-${golesVisitante} ${club}`;

  const cabeceira = [etiquetaCategoria(f.categoria), cabeceraCompeticion(f.jornada, f.competicion)]
    .filter(Boolean)
    .join(" · ");
  const linhas = [`${titular} | ${cabeceira}`, "", `⚽ ${marcador}`];
  const data = dataLonga(f.fecha);
  const campo = (f.estadio || f.lugar).trim();
  if (data || campo) linhas.push(`📍 ${[data, campo].filter(Boolean).join(" · ")}`);

  const goles = f.events.filter((e) => GOLES.includes(e.tipo));
  const nososGoles = goles.filter((e) => e.equipo === "local");
  const rivalGoles = goles.filter((e) => e.equipo === "rival");
  if (goles.length) {
    linhas.push("", "Goles:");
    if (nososGoles.length) linhas.push(`💛 ${listaGoles(nososGoles)}`);
    if (rivalGoles.length) linhas.push(`${rival}: ${listaGoles(rivalGoles)}`);
  }

  const tarxetas = f.events.filter((e) => TARXETAS.includes(e.tipo) && e.equipo === "local");
  if (tarxetas.length) {
    linhas.push(
      "",
      "Tarxetas:",
      tarxetas
        .sort((x, y) => Number(x.minuto) - Number(y.minuto))
        .map((e) => `${iconoTarxeta(e.tipo)} ${e.jugador.trim() || "—"}${e.minuto ? ` (${e.minuto}')` : ""}`)
        .join(", "),
    );
  }

  const peche =
    nosos > deles ? "Tres puntos para casa! 💪" : nosos < deles ? "Á seguinte! 💪" : "Seguimos sumando 💪";
  linhas.push("", peche);
  if (conCarrusel) linhas.push("👉 Desliza para ver a cronoloxía e o noso once.");
  linhas.push("", hashtags(f.categoria, esCopa(f.competicion) ? "#Copa" : "", "#Resultado"));
  return linhas.join("\n");
}

function textoOnce(f: FormState): string {
  const nome = (p: Player) => `${p.dorsal ? `${p.dorsal}. ` : ""}${p.nome.trim()}${p.eCapitan ? " (C)" : ""}`;
  const titulares = f.titulares.filter((p) => p.nome.trim());
  if (titulares.length === 0) return "";
  const suplentes = f.suplentes.filter((p) => p.nome.trim());
  const linhas = [
    `📋 O NOSO 11 | ${etiquetaCategoria(f.categoria)}${f.rivalNombre.trim() ? ` vs ${f.rivalNombre.trim()}` : ""}`,
    "",
    ...titulares.map(nome),
  ];
  if (suplentes.length) linhas.push("", `Suplentes: ${suplentes.map(nome).join(", ")}`);
  linhas.push("", hashtags(f.categoria, "#ONoso11"));
  return linhas.join("\n");
}

const TEMAS: Record<string, { cabeza: string; tag: string }> = {
  celebracion: { cabeza: "🎉", tag: "#Celebracion" },
  medico: { cabeza: "🩹 PARTE MÉDICO", tag: "" },
  fichaje: { cabeza: "✍️ NOVA INCORPORACIÓN", tag: "#Fichaxe" },
  despedida: { cabeza: "💛🖤 COMUNICADO", tag: "" },
  formal: { cabeza: "📢 COMUNICADO OFICIAL", tag: "#Comunicado" },
};

function textoAnuncio(f: FormState): string {
  const tema = TEMAS[f.multiusosTema] ?? TEMAS.formal!;
  const titulo = f.multiusosTitulo.trim();
  const linhas = [titulo ? `${tema.cabeza} ${titulo.toUpperCase()}`.trim() : tema.cabeza];
  if (f.multiusosTexto.trim()) linhas.push("", f.multiusosTexto.trim());
  linhas.push("", hashtags(f.categoria, tema.tag));
  return linhas.join("\n");
}

function textoClasificacion(f: FormState): string {
  const categoria = etiquetaCategoria(f.categoria);
  const nome = f.clasificacionNombre.trim();
  if (f.clasificacionTipo === "copa") {
    return [
      `🏆 ${nome || "COPA"} | ${categoria}`,
      "",
      "Así está o cadro. Seguimos! 💛🖤",
      "",
      hashtags(f.categoria, "#Copa"),
    ].join("\n");
  }
  const filas = (f.clasificacionData as FilaCartelClasificacion[]).filter((x) => "pts" in x);
  const indice = filas.findIndex((x) => /santiso/i.test(x.nombre));
  const linhas = [`📊 CLASIFICACIÓN | ${categoria}${nome ? ` · ${nome}` : ""}`, ""];
  if (indice >= 0) {
    const nosa = filas[indice]!;
    const posto = nosa.posicion ?? indice + 1;
    linhas.push(
      `Imos ${posto}º con ${nosa.pts} ${nosa.pts === 1 ? "punto" : "puntos"} (${nosa.pg}V ${nosa.pe}E ${nosa.pp}D).`,
    );
  } else {
    linhas.push("Así queda a táboa tras a última xornada.");
  }
  linhas.push("", "Seguimos traballando! 💛🖤", "", hashtags(f.categoria, "#Clasificacion"));
  return linhas.join("\n");
}

/** Texto para el pie de la publicación del cartel; vacío si aún no hay datos con qué hacerlo. */
export function textoInstagram(tipo: TemplateId, f: FormState): string {
  switch (tipo) {
    case "partido":
      return textoPrevia(f);
    case "proximos":
      return textoProximos(f);
    case "resumo":
      return textoResultado(f, true);
    case "cronoloxia":
      return textoResultado(f, false);
    case "noso11":
      return textoOnce(f);
    case "multiusos":
      return textoAnuncio(f);
    case "clasificacion":
      return textoClasificacion(f);
  }
}
