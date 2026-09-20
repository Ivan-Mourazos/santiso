import type { EquipoFicha, Ficha, GolFicha, JugadorFicha, Lado } from "@santiso/actas";
import type { ActaEvent, ActaEventType, ActaPlayerRef, ParsedActa } from "./types";

/**
 * La ficha federativa es **neutral**: habla de local y visitante. `ParsedActa` mira desde el
 * Santiso: habla de `isRival`, `esPropia` y `esPropiaSantiso`. Aquí se pasa de una a otra.
 *
 * Nada de esto toca la base de datos ni el PDF: es una función pura, y por eso se prueba sola.
 */

/** Nombre comparable: sin tildes, sin puntuación y en minúsculas. */
function clave(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

/**
 * El descuento llega de la ficha como `45+1`, pero `partido_eventos.minuto` es un entero y
 * `transformar.ts` detendría el guardado. Se guarda el minuto base.
 */
function minutoBase(minuto: string): string {
  return minuto.split("+")[0]?.trim() ?? "";
}

function refDe(jugador: JugadorFicha): ActaPlayerRef {
  return { id: crypto.randomUUID(), dorsal: String(jugador.dorsal), rawName: jugador.nombre };
}

/**
 * Goles y tarjetas traen el nombre del autor, no su dorsal. Se busca en la convocatoria de la
 * ficha para que la pantalla pueda enlazarlo por dorsal, que es más fiable que por nombre. Si el
 * nombre aparece dos veces, se deja sin dorsal y decide el nombre.
 */
function refDeNombre(nombre: string, equipo: EquipoFicha): ActaPlayerRef {
  const buscado = clave(nombre);
  const iguales = [...equipo.titulares, ...equipo.suplentes].filter(
    (jugador) => clave(jugador.nombre) === buscado,
  );
  const unico = iguales.length === 1 ? iguales[0] : undefined;
  return {
    id: crypto.randomUUID(),
    dorsal: unico ? String(unico.dorsal) : "",
    rawName: nombre,
  };
}

/**
 * La ficha nombra la competición en claro («VETERANOS - PRIMERA GALICIA (…)», «TERCERA FUTGAL
 * (…)»), pero no la categoría. Solo se deduce cuando el nombre lo dice: devolver `""` y que
 * la pantalla pregunte es mejor que suponer Senior y guardar el acta en el partido de otro.
 */
export function categoriaDeCompeticion(competicion: string): "Veteranos" | "Femenino" | "" {
  const texto = clave(competicion);
  if (texto.includes("vetera")) return "Veteranos";
  if (texto.includes("femin") || texto.includes("femen")) return "Femenino";
  return "";
}

/** La tabla solo tiene amarilla y roja: la doble amarilla entra como una sola roja. */
const TIPO_TARJETA: Record<string, ActaEventType | null> = {
  amarilla: "tarjeta_amarilla",
  roja: "tarjeta_roja",
  doble_amarilla: "tarjeta_roja",
  desconocido: null,
};

function eventoDeGol(
  gol: GolFicha,
  nos: Lado,
  nuestro: EquipoFicha,
  avisos: string[],
): ActaEvent {
  const base = {
    id: crypto.randomUUID(),
    tipo: "gol" as const,
    minuto: minutoBase(gol.minuto),
    scoreAfter: `${gol.marcador[0]}-${gol.marcador[1]}`,
  };

  const aNuestroFavor = gol.beneficiario === nos;
  const autorConocido = gol.equipoAutor !== null;
  if (!autorConocido) {
    avisos.push(
      `Gol del minuto ${gol.minuto} de "${gol.autor}": el nombre no identifica a un solo jugador, así que no se sabe de qué equipo es. Se ha supuesto que no es en propia; confírmalo.`,
    );
  }
  // Sin equipo de autor se supone el caso corriente: lo marcó quien se lleva el gol.
  const autorEsNuestro = autorConocido ? gol.equipoAutor === nos : aNuestroFavor;
  const confidence = autorConocido ? ("alta" as const) : ("baja" as const);

  if (aNuestroFavor && autorEsNuestro) {
    return { ...base, isRival: false, confidence, jugador: refDeNombre(gol.autor, nuestro) };
  }
  if (aNuestroFavor) {
    return { ...base, isRival: false, esPropia: true, confidence, nombreRival: gol.autor };
  }
  if (autorEsNuestro) {
    return {
      ...base,
      isRival: true,
      esPropiaSantiso: true,
      confidence,
      jugador: refDeNombre(gol.autor, nuestro),
    };
  }
  return { ...base, isRival: true, confidence, nombreRival: gol.autor };
}

export function actaDeFicha(ficha: Ficha, santisoEsLocal: boolean): ParsedActa {
  const nos: Lado = santisoEsLocal ? "local" : "visitante";
  const nuestro = santisoEsLocal ? ficha.local : ficha.visitante;
  const avisos = [...ficha.avisos];
  const eventos: ActaEvent[] = [];

  for (const gol of ficha.goles) eventos.push(eventoDeGol(gol, nos, nuestro, avisos));

  for (const tarjeta of ficha.tarjetas) {
    const tipo = TIPO_TARJETA[tarjeta.tipo] ?? null;
    if (!tipo) {
      avisos.push(
        `Tarjeta del minuto ${tarjeta.minuto} a "${tarjeta.autor}": el icono no se reconoció. Añádela a mano si la hubo.`,
      );
      continue;
    }
    // `partido_eventos.jugador_id` apunta a `jugadores`: una sanción al técnico no cabe.
    if (tarjeta.destinatario === "tecnico") {
      avisos.push(
        `Tarjeta del minuto ${tarjeta.minuto} a "${tarjeta.autor}" (cuerpo técnico): no se guarda, la tabla solo admite jugadores.`,
      );
      continue;
    }
    if (tarjeta.tipo === "doble_amarilla") {
      avisos.push(
        `Doble amarilla del minuto ${tarjeta.minuto} a "${tarjeta.autor}": se guarda como una sola roja.`,
      );
    }

    const base = {
      id: crypto.randomUUID(),
      tipo,
      minuto: minutoBase(tarjeta.minuto),
      confidence: tarjeta.destinatario === "jugador" ? ("alta" as const) : ("media" as const),
    };
    eventos.push(
      tarjeta.equipo === nos
        ? { ...base, isRival: false, jugador: refDeNombre(tarjeta.autor, nuestro) }
        : { ...base, isRival: true, nombreRival: tarjeta.autor },
    );
  }

  if (ficha.sustituciones === "no_registradas") {
    avisos.push("La ficha no registra las sustituciones de ningún equipo.");
  } else {
    let delRival = 0;
    for (const cambio of ficha.sustituciones) {
      // El CHECK `partido_eventos_cambio_ck` exige lado propio con los dos jugadores.
      if (cambio.equipo !== nos) {
        delRival += 1;
        continue;
      }
      eventos.push({
        id: crypto.randomUUID(),
        tipo: "cambio",
        minuto: minutoBase(cambio.minuto),
        isRival: false,
        confidence: "alta",
        jugadorEntra: refDe(cambio.entra),
        jugadorSale: refDe(cambio.sale),
      });
    }
    if (delRival > 0) {
      avisos.push(
        `${delRival} ${delRival === 1 ? "sustitución" : "sustituciones"} del rival no se guardan: la tabla solo admite cambios propios.`,
      );
    }
    if (ficha.coberturaSustituciones[nos] === "no_registradas") {
      avisos.push("La ficha no registra nuestras sustituciones.");
    }
  }

  return {
    marcadorLocal: String(ficha.marcador[0]),
    marcadorVisitante: String(ficha.marcador[1]),
    campoNombre: ficha.campo,
    campoPoblacion: ficha.poblacion,
    titulares: nuestro.titulares.map(refDe),
    suplentes: nuestro.suplentes.map(refDe),
    eventos,
    warnings: avisos,
    rawText: JSON.stringify(ficha, null, 2),
  };
}
