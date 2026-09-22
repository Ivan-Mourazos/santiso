"use client";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import { filtrarEquipos, type EquipoCatalogo } from "@/lib/equipos/modelo";
import { inscribirEquipo } from "@/lib/server/acciones/equipos";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import styles from "./Equipos.module.css";

export default function IncorporarEquipo({
  catalogo,
  categoria,
  competicion,
  onCerrar,
  onGuardado,
}: {
  catalogo: EquipoCatalogo[];
  categoria: string;
  competicion: { id: string; nombre: string };
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [seleccion, setSeleccion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const operacion = useRef(false);
  const buscador = useRef<HTMLInputElement>(null);
  useUnsavedChanges(Boolean(seleccion));
  const candidatos = useMemo(
    () =>
      filtrarEquipos(catalogo, { texto, soloSinEscudo: false }).sort(
        (a, b) => Number(b.categoria === categoria) - Number(a.categoria === categoria),
      ),
    [catalogo, texto, categoria],
  );
  function cerrar() {
    if (operacion.current) return;
    if (seleccion && !window.confirm("Hay una selección sin añadir. ¿Descartarla?")) return;
    onCerrar();
  }
  async function incorporar() {
    const equipo = catalogo.find((e) => e.id === seleccion);
    if (
      operacion.current ||
      !equipo ||
      equipo.categoria !== categoria ||
      equipo.competiciones.some((c) => c.id === competicion.id)
    )
      return;
    operacion.current = true;
    setPendiente(true);
    setError(null);
    try {
      const resultado = await inscribirEquipo(competicion.id, equipo.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onGuardado();
    } catch {
      setError("No se pudo añadir el equipo. La selección se conserva.");
    } finally {
      operacion.current = false;
      setPendiente(false);
    }
  }
  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      initialFocusRef={buscador}
      title={`Añadir a ${competicion.nombre}`}
      description={`Destino: ${categoria}. Los equipos de otras categorías se muestran para distinguir homónimos.`}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            onClick={() => void incorporar()}
            disabled={!seleccion}
            pending={pendiente}
            pendingLabel="Añadiendo…"
          >
            Añadir equipo
          </Button>
        </>
      }
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Field
        ref={buscador}
        label="Buscar equipo existente"
        type="search"
        value={texto}
        disabled={pendiente}
        onChange={(e) => {
          setTexto(e.target.value);
          setSeleccion("");
        }}
      />
      <fieldset className={styles.candidatos} disabled={pendiente}>
        <legend>Equipos disponibles</legend>
        {candidatos.length === 0 && <p>Ningún equipo coincide con la búsqueda.</p>}
        {candidatos.map((equipo) => {
          const inscrito = equipo.competiciones.some((c) => c.id === competicion.id);
          const otra = equipo.categoria !== categoria;
          return (
            <label key={equipo.id} className={styles.candidato}>
              <input
                type="radio"
                name="equipo-existente"
                className={styles.check}
                value={equipo.id}
                checked={seleccion === equipo.id}
                disabled={otra || inscrito}
                onChange={() => setSeleccion(equipo.id)}
              />
              <span>
                <strong>
                  {equipo.nombre} · {equipo.categoria}
                </strong>
                <span className={styles.detalle}>
                  {equipo.competiciones
                    .map((c) => `${c.nombre} · ${c.temporadaNombre}`)
                    .join("; ") || "Sin competiciones"}
                </span>
                {(otra || inscrito) && (
                  <span className={styles.detalle}>{otra ? "Otra categoría" : "Ya inscrito"}</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
    </Dialog>
  );
}
