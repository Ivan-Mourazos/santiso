"use client";

import { Select } from "@/components/ui/foundation/Fields";

interface Props {
  temporadas: { id: string; nombre: string; activa?: boolean }[];
  seleccionada: string;
  onCambiar: (id: string) => void;
  deshabilitada?: boolean;
}

/**
 * Qué temporada se está viendo en Plantilla o Staff. Por defecto la activa. En una temporada
 * pasada todo se puede corregir, pero se avisa: los cambios se guardan en esa temporada.
 */
export default function BarraTemporada({
  temporadas,
  seleccionada,
  onCambiar,
  deshabilitada,
}: Props) {
  const actual = temporadas.find((t) => t.id === seleccionada);
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "end",
        gap: "1rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ minWidth: "12rem" }}>
        <Select
          label="Temporada"
          value={seleccionada}
          // Elegir la que ya se ve no hace nada: si no, la URL gana `?temporada=` y la
          // sección se vuelve a montar, perdiendo lo que hubiera abierto.
          onChange={(e) => {
            if (e.target.value !== seleccionada) onCambiar(e.target.value);
          }}
          disabled={deshabilitada || temporadas.length === 0}
        >
          {temporadas.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
              {t.activa ? " (activa)" : ""}
            </option>
          ))}
        </Select>
      </div>
      {actual && !actual.activa && (
        <p role="status" style={{ margin: 0, color: "#f59e0b", fontSize: "0.85rem" }}>
          Estás viendo {actual.nombre}. Lo que cambies se guarda en esa temporada, no en la actual.
        </p>
      )}
    </div>
  );
}
