/** Coordenadas relativas a la página, con origen arriba a la izquierda. */
export interface Fragmento {
  texto: string;
  x: number;
  y: number;
}
export type Lado = "local" | "visitante";
export interface JugadorFicha {
  dorsal: number;
  nombre: string;
}
export interface EquipoFicha {
  nombre: string;
  titulares: JugadorFicha[];
  suplentes: JugadorFicha[];
}
export interface GolFicha {
  autor: string;
  minuto: string;
  beneficiario: Lado;
  marcador: [number, number];
  tipo: "desconocido";
}
export interface TarjetaFicha {
  autor: string;
  minuto: string;
  equipo: Lado;
  tipo: "desconocido";
}
export interface Ficha {
  version: 1;
  competicion: string;
  jornada: number;
  temporada: string;
  fecha: string;
  campo: string;
  poblacion: string;
  marcador: [number, number];
  local: EquipoFicha;
  visitante: EquipoFicha;
  goles: GolFicha[];
  tarjetas: TarjetaFicha[];
  sustituciones: "no_registradas";
  avisos: string[];
}

function exigir<T>(valor: T | undefined | null, mensaje: string): T {
  if (valor === undefined || valor === null) throw new Error(mensaje);
  return valor;
}

function filas(items: readonly Fragmento[]): string[] {
  const grupos: Fragmento[][] = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const ultimo = grupos.at(-1);
    // La plantilla desplaza la línea base del marcador 1,25 puntos respecto al autor.
    if (ultimo?.[0] && Math.abs(item.y - ultimo[0].y) <= 0.0025) ultimo.push(item);
    else grupos.push([item]);
  }
  return grupos.map((g) =>
    g
      .sort((a, b) => a.x - b.x)
      .map((i) => i.texto)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function ancla(items: readonly Fragmento[], texto: string): Fragmento {
  const matches = items.filter((i) => i.texto === texto);
  if (matches.length !== 1) throw new Error(`Sección no reconocida: ${texto}`);
  return exigir(matches[0], texto);
}

function seccion(items: readonly Fragmento[], desde: string, hasta: string): string[] {
  const inicio = ancla(items, desde).y,
    fin = ancla(items, hasta).y;
  if (fin <= inicio) throw new Error(`Orden de secciones no reconocido: ${desde}`);
  return filas(items.filter((i) => i.y > inicio + 0.0025 && i.y < fin - 0.0025));
}

function jugadores(lineas: string[]): JugadorFicha[] {
  return lineas.map((l) => {
    const m = exigir(/^(\d{1,3})\s+(.+)$/u.exec(l), "Fila de jugador no reconocida");
    return { dorsal: Number(m[1]), nombre: exigir(m[2], "Nombre vacío") };
  });
}

function equipo(items: readonly Fragmento[], fechaY: number): EquipoFicha {
  const titulo = ancla(items, "TITULARES");
  const nombres = filas(items.filter((i) => i.y > fechaY + 0.003 && i.y < titulo.y - 0.003));
  if (nombres.length !== 1) throw new Error("Nombre de equipo ambiguo");
  const titulares = jugadores(seccion(items, "TITULARES", "SUPLENTES"));
  const suplentes = jugadores(seccion(items, "SUPLENTES", "CUERPO TÉCNICO"));
  if (!titulares.length) throw new Error("No se detectaron titulares");
  const dorsales = [...titulares, ...suplentes].map((j) => j.dorsal);
  if (new Set(dorsales).size !== dorsales.length)
    throw new Error("Dorsales duplicados en el mismo equipo");
  if (seccion(items, "SUSTITUCIONES", "TARJETAS").length)
    throw new Error("Ficha con sustituciones: formato aún no soportado");
  return { nombre: exigir(nombres[0], "Equipo vacío"), titulares, suplentes };
}

function evento(linea: string): { autor: string; minuto: string } {
  const m = exigir(
    /^(.+?)\s*\((\d{1,3}(?:\+\d{1,2})?)['’]\)$/u.exec(linea),
    "Evento no reconocido",
  );
  return { autor: exigir(m[1], "Autor vacío"), minuto: exigir(m[2], "Minuto vacío") };
}

/** Solo reconoce la plantilla de una página de veteranos validada con las muestras. */
export function parsearFicha(fragmentos: readonly Fragmento[]): Ficha {
  if (
    fragmentos.some(
      (i) =>
        !Number.isFinite(i.x) || !Number.isFinite(i.y) || i.x < 0 || i.x > 1 || i.y < 0 || i.y > 1,
    )
  )
    throw new Error("Coordenadas inválidas");
  const items = fragmentos
    .map((i) => ({ ...i, texto: i.texto.replace(/\s+/g, " ").trim() }))
    .filter((i) => i.texto);
  ancla(items, "Ficha del Partido");
  const competicion = exigir(
    items.find((i) => i.texto.startsWith("VETERANOS -")),
    "Categoría o formato no soportado",
  ).texto;
  const jornada = Number(
    exigir(
      items.find((i) => /^Jornada \d+$/.test(i.texto)),
      "Jornada no encontrada",
    ).texto.slice(8),
  );
  const temporada = exigir(
    items.find((i) => /^Temporada \d{4}-\d{4}$/.test(i.texto)),
    "Temporada no encontrada",
  ).texto.slice(10);
  const fechaItem = exigir(
    items.find((i) => /^Fecha:/.test(i.texto)),
    "Fecha no encontrada",
  );
  const fecha = exigir(/^Fecha: (\d{2})-(\d{2})-(\d{4})$/.exec(fechaItem.texto), "Fecha inválida");
  const hora = exigir(
    /^Hora: (\d{2}):(\d{2}) h$/.exec(
      exigir(
        items.find((i) => i.texto.startsWith("Hora:")),
        "Hora no encontrada",
      ).texto,
    ),
    "Hora inválida",
  );
  const literal = `${fecha[3]}-${fecha[2]}-${fecha[1]}T${hora[1]}:${hora[2]}`;
  const comprobacion = new Date(`${literal}:00Z`);
  if (
    !Number.isFinite(comprobacion.getTime()) ||
    comprobacion.toISOString().slice(0, 16) !== literal
  )
    throw new Error("Fecha u hora inválida");
  const izq = items.filter((i) => i.x < 0.4),
    der = items.filter((i) => i.x >= 0.66);
  const centro = items.filter((i) => i.x >= 0.4 && i.x < 0.66);
  const local = equipo(izq, fechaItem.y),
    visitante = equipo(der, fechaItem.y);
  const tituloGoles = ancla(centro, "GOLES");
  const estadio = exigir(
    centro.find((i) => i.texto.startsWith("ESTADIO:")),
    "Estadio no encontrado",
  );
  const marcadorTexto = exigir(
    filas(centro.filter((i) => i.y > fechaItem.y && i.y < tituloGoles.y)).find((l) =>
      /^\d+ - \d+$/.test(l),
    ),
    "Marcador no encontrado",
  );
  const [ml, mv] = marcadorTexto.split(" - ").map(Number);
  const marcador: [number, number] = [
    exigir(ml, "Marcador local"),
    exigir(mv, "Marcador visitante"),
  ];
  let anterior: [number, number] = [0, 0];
  const goles = filas(
    centro.filter((i) => i.y > tituloGoles.y + 0.0025 && i.y < estadio.y - 0.0025),
  ).map((l) => {
    const m = exigir(/^(\d+) - (\d+) (.+)$/.exec(l), "Fila de gol incompleta");
    const actual: [number, number] = [Number(m[1]), Number(m[2])];
    const dl = actual[0] - anterior[0],
      dv = actual[1] - anterior[1];
    if (!((dl === 1 && dv === 0) || (dl === 0 && dv === 1)))
      throw new Error("Secuencia de goles inconsistente");
    anterior = actual;
    const gol: GolFicha = {
      ...evento(exigir(m[3], "Autor del gol")),
      beneficiario: dl === 1 ? "local" : "visitante",
      marcador: actual,
      tipo: "desconocido",
    };
    return gol;
  });
  if (anterior[0] !== marcador[0] || anterior[1] !== marcador[1])
    throw new Error("Los goles no coinciden con el marcador final");
  const tarjetas: TarjetaFicha[] = [];
  for (const [lado, columna] of [
    ["local", izq],
    ["visitante", der],
  ] as const) {
    const encabezado = ancla(columna, "TARJETAS");
    for (const linea of filas(columna.filter((i) => i.y > encabezado.y + 0.0025)))
      tarjetas.push({ ...evento(linea), equipo: lado, tipo: "desconocido" });
  }
  const campo = exigir(
    filas(centro).find((l) => l.startsWith("ESTADIO:")),
    "Campo no encontrado",
  )
    .slice(8)
    .trim();
  const poblacion = exigir(
    filas(centro).find((l) => l.startsWith("Ciudad:")),
    "Población no encontrada",
  )
    .slice(7)
    .trim();
  const avisos = [
    "Sustituciones no registradas: no se pueden calcular minutos ni participación de todos los suplentes.",
    "Tipo de gol desconocido: revisar penaltis y goles en propia puerta.",
  ];
  if (tarjetas.length)
    avisos.push("El texto no identifica el color de las tarjetas: revisar su tipo.");
  if (local.titulares.length !== 11 || visitante.titulares.length !== 11)
    avisos.push("Revisar el número de titulares.");
  return {
    version: 1,
    competicion,
    jornada,
    temporada,
    fecha: literal,
    campo,
    poblacion,
    marcador,
    local,
    visitante,
    goles,
    tarjetas,
    sustituciones: "no_registradas",
    avisos,
  };
}
