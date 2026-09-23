"use client";

import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Select } from "@/components/ui/foundation/Fields";
import type { DescansoDto } from "@/lib/dto";
import type { Team } from "@/lib/lecturas-cliente";
import { anadirDescanso, quitarDescanso } from "@/lib/server/acciones/calendario";
import styles from "./Calendario.module.css";

interface Props {
  jornadaId: string;
  equipos: Team[];
  descansos: DescansoDto[];
  ocupados: ReadonlySet<string>;
  nombreEquipo: (id: string) => string;
  onCambiado: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

/**
 * Equipos que descansan en la jornada. Se monta con `key` por jornada. La comprobación de «ya
 * juega esta jornada» la hace la acción contra la base de datos; aquí solo se filtra la lista.
 */
export default function Descansos({
  jornadaId,
  equipos,
  descansos,
  ocupados,
  nombreEquipo,
  onCambiado,
  showToast,
  showConfirm,
}: Props) {
  const [equipoId, setEquipoId] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const enviando = useRef(false);
  useUnsavedChanges(Boolean(equipoId));

  const libres = equipos.filter((e) => !ocupados.has(e.id) || e.id === equipoId);

  async function marcar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current || !equipoId) return;
    enviando.current = true;
    setPendiente(true);
    try {
      const resultado = await anadirDescanso(jornadaId, equipoId);
      if (!resultado.ok) return showToast(resultado.error, "error");
      setEquipoId("");
      showToast("Descanso registrado");
      await onCambiado();
    } catch {
      showToast("No se pudo marcar el descanso. Comprueba la conexión.", "error");
    } finally {
      enviando.current = false;
      setPendiente(false);
    }
  }

  function quitar(id: string) {
    showConfirm(`¿Quitar el descanso de ${nombreEquipo(id)} en esta jornada?`, async () => {
      const resultado = await quitarDescanso(jornadaId, id);
      if (!resultado.ok) return showToast(resultado.error, "error");
      await onCambiado();
      showToast("Descanso eliminado");
    });
  }

  return (
    <section className={styles.bloque} aria-label="Descansos">
      <h3 className={styles.titulo}>Descansos</h3>
      <form className={styles.fila} onSubmit={(e) => void marcar(e)}>
        <Select
          label="Equipo que descansa"
          value={equipoId}
          onChange={(e) => setEquipoId(e.target.value)}
          disabled={pendiente}
        >
          <option value="">Elegir equipo</option>
          {libres.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary" pending={pendiente} disabled={!equipoId}>
          Marcar descanso
        </Button>
      </form>
      {descansos.length === 0 ? (
        <p className={`${styles.nota} ${styles.vacio}`}>Ningún equipo descansa en esta jornada.</p>
      ) : (
        <ul className={styles.descansos}>
          {descansos.map((d) => (
            <li key={d.equipo_id}>
              {nombreEquipo(d.equipo_id)}
              <Button
                variant="secondary"
                onClick={() => quitar(d.equipo_id)}
                aria-label={`Quitar descanso de ${nombreEquipo(d.equipo_id)}`}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
