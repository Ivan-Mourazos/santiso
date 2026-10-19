import type { Ficha, Lado } from "@santiso/actas";
import { claveNombre, normalizarNombrePersona } from "@santiso/domain";

export type TipoEventoLiga = "gol" | "gol_propia" | "amarilla" | "doble_amarilla" | "roja";

/** Un gol o una tarjeta de un acta, listo para guardarse en las tablas de la liga. */
export interface EventoDeActa {
  lado: Lado;
  persona: string;
  personaClave: string;
  tipo: TipoEventoLiga;
  minuto: string;
  tecnico: boolean;
}

const contrario = (lado: Lado): Lado => (lado === "local" ? "visitante" : "local");

/** «GARCIA REY, ALEJANDRO» → «Alejandro Garcia Rey», con las reglas de nombres de persona. */
export function personaDeActa(nombre: string): string {
  const [apellidos = "", pila = ""] = nombre.split(",").map((parte) => parte.trim());
  return normalizarNombrePersona(pila ? `${pila} ${apellidos}` : apellidos);
}

/**
 * Los goles y las tarjetas de un acta, cada uno con el lado de su autor. Un gol en propia se
 * apunta al equipo de quien lo marcó, con su propio tipo: no cuenta para los goleadores. Las
 * tarjetas cuyo color no se supo leer no se inventan: se dejan fuera.
 */
export function eventosDeFicha(ficha: Ficha): EventoDeActa[] {
  const eventos: EventoDeActa[] = [];
  const anadir = (
    lado: Lado,
    nombre: string,
    tipo: TipoEventoLiga,
    minuto: string,
    tecnico = false,
  ) => {
    const persona = personaDeActa(nombre);
    const personaClave = claveNombre(persona);
    if (personaClave) eventos.push({ lado, persona, personaClave, tipo, minuto, tecnico });
  };
  for (const gol of ficha.goles) {
    if (gol.tipo === "propia") {
      anadir(gol.equipoAutor ?? contrario(gol.beneficiario), gol.autor, "gol_propia", gol.minuto);
    } else {
      anadir(gol.equipoAutor ?? gol.beneficiario, gol.autor, "gol", gol.minuto);
    }
  }
  for (const tarjeta of ficha.tarjetas) {
    if (tarjeta.tipo === "desconocido") continue;
    anadir(
      tarjeta.equipo,
      tarjeta.autor,
      tarjeta.tipo,
      tarjeta.minuto,
      tarjeta.destinatario === "tecnico",
    );
  }
  return eventos;
}

/** Un jugador de la alineación de un acta, listo para guardarse en `liga_alineaciones`. */
export interface AlineadoDeActa {
  lado: Lado;
  persona: string;
  personaClave: string;
  dorsal: number | null;
  titular: boolean;
}

/**
 * Titulares y suplentes de los dos equipos de un acta, con las mismas reglas de nombre que los
 * goles y las tarjetas. Una persona repetida en el mismo lado cuenta una vez.
 */
export function alineacionesDeFicha(ficha: Ficha): AlineadoDeActa[] {
  const salida: AlineadoDeActa[] = [];
  for (const lado of ["local", "visitante"] as const) {
    const equipo = ficha[lado];
    for (const [titular, jugadores] of [
      [true, equipo.titulares],
      [false, equipo.suplentes],
    ] as const) {
      for (const jugador of jugadores) {
        const persona = personaDeActa(jugador.nombre);
        const personaClave = claveNombre(persona);
        if (!personaClave) continue;
        if (salida.some((a) => a.lado === lado && a.personaClave === personaClave)) continue;
        const dorsal =
          Number.isInteger(jugador.dorsal) && jugador.dorsal >= 0 ? jugador.dorsal : null;
        salida.push({ lado, persona, personaClave, dorsal, titular });
      }
    }
  }
  return salida;
}
