import type { AvisoJugador } from "@/lib/liga/avisos";
import styles from "./AvisosPartido.module.css";

const ETIQUETA: Record<AvisoJugador["situacion"], string> = {
  sancionado: "Sancionado",
  expulsado: "Expulsado",
  apercibido: "Apercibido",
};

/** El aviso de un jugador de la plantilla, si lo tiene. */
export function avisoDe(avisos: readonly AvisoJugador[], jugadorId: string) {
  return avisos.find((a) => a.jugadorId === jugadorId);
}

/** Marca junto al nombre: «Sancionado» en rojo, «Apercibido» en ámbar. */
export function MarcaAviso({ aviso }: { aviso: AvisoJugador | undefined }) {
  if (!aviso) return null;
  return (
    <small className={styles.marca} data-situacion={aviso.situacion} title={aviso.motivo}>
      {ETIQUETA[aviso.situacion]}
    </small>
  );
}

/**
 * Sanciones y apercibidos de la liga para este partido, antes de elegir a nadie. Incluye los
 * nombres del acta que no se reconocen en la plantilla: mejor verlos que perderlos.
 */
export function AvisosPartido({ avisos }: { avisos: readonly AvisoJugador[] }) {
  if (avisos.length === 0) return null;
  return (
    <section className={styles.avisos} aria-label="Sanciones y apercibidos">
      <p className={styles.etiqueta}>Sanciones y apercibidos</p>
      <ul>
        {avisos.map((a) => (
          <li key={`${a.persona}-${a.situacion}`} data-situacion={a.situacion}>
            <strong>
              {a.persona}
              {a.jugadorId === null && <small> · sin reconocer en la plantilla</small>}
            </strong>
            <span>{a.motivo}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
