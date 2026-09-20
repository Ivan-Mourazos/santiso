export type * from "./ficha-tipos";
import type { Ficha, Fragmento, EquipoFicha, JugadorFicha, GolFicha } from "./ficha-tipos";
import type { MarcaFicha } from "./iconos";
import { exigir, filas, ancla, seccion } from "./ficha-geometria";
import { evento, leerCambios, leerTarjetas, equipoDeAutor } from "./ficha-eventos";

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
  return { nombre: exigir(nombres[0], "Equipo vacío"), titulares, suplentes };
}

/** Reconoce las plantillas de una página de sénior y veteranos validadas con muestras. */
export function parsearFicha(
  fragmentos: readonly Fragmento[],
  marcas: readonly MarcaFicha[] = [],
): Ficha {
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
    items.find((i) => /^(VETERANOS -|TERCERA FUTGAL)/.test(i.texto)),
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
  const izq = items.filter((i) => i.x < 0.33),
    der = items.filter((i) => i.x >= 0.66);
  const centro = items.filter((i) => i.x >= 0.33 && i.x < 0.66);
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
    const datos = evento(exigir(m[3], "Autor del gol"));
    const beneficiario = dl === 1 ? "local" : "visitante";
    const equipoAutor = equipoDeAutor(datos.autor, local, visitante);
    const gol: GolFicha = {
      ...datos,
      beneficiario,
      equipoAutor,
      marcador: actual,
      tipo: equipoAutor !== null && equipoAutor !== beneficiario ? "propia" : "desconocido",
    };
    return gol;
  });
  if (anterior[0] !== marcador[0] || anterior[1] !== marcador[1])
    throw new Error("Los goles no coinciden con el marcador final");
  const tarjetas = [
    ...leerTarjetas(izq, "local", local, marcas),
    ...leerTarjetas(der, "visitante", visitante, marcas),
  ];
  const cambiosLocal = leerCambios(izq, "local", local, marcas);
  const cambiosVisitante = leerCambios(der, "visitante", visitante, marcas);
  const cambios = [...cambiosLocal, ...cambiosVisitante];
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
  const avisos = ["Los PDF no indican penaltis: revisar el tipo de gol antes de guardar."];
  if (!cambiosLocal.length || !cambiosVisitante.length)
    avisos.push(
      "Sustituciones no registradas en algún equipo: no inferir minutos ni participación de suplentes.",
    );
  if (tarjetas.some((t) => t.tipo === "desconocido"))
    avisos.push("Hay tarjetas sin icono reconocido: revisar su tipo.");
  if (tarjetas.some((t) => t.destinatario === "desconocido"))
    avisos.push("Hay sanciones cuyo destinatario no se ha identificado.");
  if (goles.some((g) => g.tipo === "propia"))
    avisos.push(
      "Gol en propia identificado por autor en la plantilla contraria al equipo beneficiario: confirmar en revisión.",
    );
  const clavesTarjeta = tarjetas.map((t) => `${t.equipo}|${t.autor}|${t.minuto}|${t.tipo}`);
  if (new Set(clavesTarjeta).size !== clavesTarjeta.length)
    avisos.push(
      "La ficha repite tarjetas del mismo tipo, autor y minuto: confirmar sin deduplicar ni inferir expulsión.",
    );
  if (local.titulares.length !== 11 || visitante.titulares.length !== 11)
    avisos.push("Revisar el número de titulares.");
  return {
    version: 2,
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
    sustituciones: cambios.length ? cambios : "no_registradas",
    coberturaSustituciones: {
      local: cambiosLocal.length ? "registradas" : "no_registradas",
      visitante: cambiosVisitante.length ? "registradas" : "no_registradas",
    },
    avisos,
  };
}
