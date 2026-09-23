"use client";

import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { CampoDto } from "@/lib/dto";
import type { LeagueMatch, Team } from "@/lib/lecturas-cliente";
import { crearPartido } from "@/lib/server/acciones/calendario";
import { matchLocalDateTimeToIso } from "../cartel/matchDateTime";
import styles from "./Calendario.module.css";

interface Props {
  jornadaId: string;
  equipos: Team[];
  campos: CampoDto[];
  partidos: LeagueMatch[];
  /** Equipos que ya juegan o descansan en la jornada. */
  ocupados: ReadonlySet<string>;
  onCreado: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

/**
 * Alta de un partido en la jornada. Solo se ofrecen equipos libres: ni los que ya juegan, ni
 * los que descansan, ni el elegido al otro lado. Se monta con `key` por jornada, así que al
 * cambiar de jornada empieza vacío.
 */
export default function NuevoPartido({
  jornadaId,
  equipos,
  campos,
  partidos,
  ocupados,
  onCreado,
  showToast,
}: Props) {
  const [localId, setLocalId] = useState("");
  const [visitanteId, setVisitanteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [campoId, setCampoId] = useState("");
  const [pendiente, setPendiente] = useState(false);
  const enviando = useRef(false);
  useUnsavedChanges(Boolean(localId || visitanteId || fecha || campoId));

  const libres = (propio: string, otro: string) =>
    equipos.filter((e) => (!ocupados.has(e.id) || e.id === propio) && e.id !== otro);

  async function anadir(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current || !localId || !visitanteId) return;
    // Las mismas comprobaciones que antes de la 6G. Con las listas filtradas no deberían
    // darse, pero un partido recién guardado por otra vía puede llegar entre medias.
    if (localId === visitanteId)
      return showToast("Un equipo no puede jugar contra sí mismo", "error");
    const yaJuega = partidos.some(
      (p) =>
        [localId, visitanteId].includes(p.equipo_local_id ?? "") ||
        [localId, visitanteId].includes(p.equipo_visitante_id ?? ""),
    );
    if (yaJuega) return showToast("Uno de los equipos ya juega en esta jornada", "error");
    if (ocupados.has(localId) || ocupados.has(visitanteId))
      return showToast("No puedes añadir un partido con un equipo que descansa", "error");

    enviando.current = true;
    setPendiente(true);
    try {
      const resultado = await crearPartido({
        jornadaId,
        equipoLocalId: localId,
        equipoVisitanteId: visitanteId,
        fecha: matchLocalDateTimeToIso(fecha) ?? "",
        campoId,
      });
      if (!resultado.ok) return showToast(resultado.error, "error");
      setLocalId("");
      setVisitanteId("");
      setFecha("");
      setCampoId("");
      showToast("Partido añadido");
      await onCreado();
    } catch {
      showToast("No se pudo añadir el partido. Comprueba la conexión.", "error");
    } finally {
      enviando.current = false;
      setPendiente(false);
    }
  }

  return (
    <section className={styles.bloque} aria-label="Añadir partido">
      <h3 className={styles.titulo}>Añadir partido</h3>
      <form className={styles.fila} onSubmit={(e) => void anadir(e)}>
        <Select
          label="Local"
          value={localId}
          onChange={(e) => setLocalId(e.target.value)}
          disabled={pendiente}
        >
          <option value="">Elegir equipo</option>
          {libres(localId, visitanteId).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <Select
          label="Visitante"
          value={visitanteId}
          onChange={(e) => setVisitanteId(e.target.value)}
          disabled={pendiente}
        >
          <option value="">Elegir equipo</option>
          {libres(visitanteId, localId).map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </Select>
        <Field
          label="Fecha y hora"
          type="datetime-local"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          disabled={pendiente}
        />
        <Select
          label="Campo"
          value={campoId}
          onChange={(e) => setCampoId(e.target.value)}
          disabled={pendiente}
        >
          <option value="">Sin asignar</option>
          {campos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Button type="submit" pending={pendiente} disabled={!localId || !visitanteId}>
          Añadir partido
        </Button>
      </form>
    </section>
  );
}
