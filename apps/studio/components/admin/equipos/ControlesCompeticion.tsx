"use client";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { useCompeticiones } from "@/lib/useCompeticiones";
import { crearCompeticion } from "@/lib/server/acciones/competiciones";
import styles from "./Equipos.module.css";

type Contexto = ReturnType<typeof useCompeticiones>;
export default function ControlesCompeticion({
  contexto,
  categoria,
  onMutado,
}: {
  contexto: Contexto;
  categoria: string;
  onMutado: () => void;
}) {
  const [dialogo, setDialogo] = useState<"crear" | "borrar" | null>(null);
  const [nombre, setNombre] = useState("");
  const [formato, setFormato] = useState("liga");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const operacion = useRef(false);
  const refNombre = useRef<HTMLInputElement>(null);
  const sucio = dialogo === "crear" && (nombre !== "" || formato !== "liga");
  useUnsavedChanges(sucio);
  const actual = contexto.competicionesEnCategoria.find(
    (c) => c.id === contexto.selectedCompetitionId,
  );
  function cerrar() {
    if (operacion.current) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    setDialogo(null);
    setNombre("");
    setFormato("liga");
    setError(null);
  }
  async function confirmar() {
    if (operacion.current) return;
    if (dialogo === "crear" && !nombre.trim()) {
      setError("El nombre es obligatorio.");
      refNombre.current?.focus();
      return;
    }
    if (dialogo === "borrar" && !actual) return;
    operacion.current = true;
    setPendiente(true);
    setError(null);
    try {
      if (dialogo === "crear") {
        const resultado = await crearCompeticion({ nombre, categoria, formato });
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
        // Solo después de guardar se resuelve el borrador. La recarga desmonta el
        // diálogo y su guardia antes de navegar a la competición recién creada.
        setDialogo(null);
        setNombre("");
        setFormato("liga");
        await contexto.loadCompeticiones();
        contexto.setSelectedCompetitionId(resultado.datos.id);
      } else {
        const resultado = await contexto.removeCompeticion(contexto.selectedCompetitionId);
        if (resultado.error) {
          setError(resultado.error.message);
          return;
        }
      }
      setDialogo(null);
      setNombre("");
      setFormato("liga");
      onMutado();
    } catch {
      setError("No se pudo completar la operación. Vuelve a intentarlo.");
    } finally {
      operacion.current = false;
      setPendiente(false);
    }
  }
  return (
    <>
      <div className={styles.contexto}>
        <Select
          label="Competición"
          value={contexto.selectedCompetitionId}
          onChange={(e) => contexto.setSelectedCompetitionId(e.target.value)}
          disabled={!contexto.competicionesEnCategoria.length}
        >
          {!contexto.competicionesEnCategoria.length && <option value="">Sin competiciones</option>}
          {contexto.competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <div className={styles.acciones}>
          <Button
            variant="secondary"
            onClick={() => setDialogo("crear")}
            disabled={contexto.historicalSeason || !contexto.selectedSeasonId}
          >
            Crear competición
          </Button>
          {actual && contexto.competicionesEnCategoria.length > 1 && (
            <Button variant="secondary" onClick={() => setDialogo("borrar")}>
              Eliminar competición
            </Button>
          )}
        </div>
      </div>
      {contexto.historicalSeason && (
        <p className={styles.detalle}>
          Consultando una temporada anterior. Las nuevas competiciones se crean en la temporada
          activa.
        </p>
      )}
      {dialogo && (
        <Dialog
          open
          onClose={cerrar}
          pending={pendiente}
          initialFocusRef={dialogo === "crear" ? refNombre : undefined}
          title={dialogo === "crear" ? "Crear competición" : "Eliminar competición"}
          footer={
            <>
              <Button variant="secondary" disabled={pendiente} onClick={cerrar}>
                Cancelar
              </Button>
              <Button
                variant={dialogo === "borrar" ? "danger" : "primary"}
                pending={pendiente}
                onClick={() => void confirmar()}
              >
                {dialogo === "crear" ? "Crear competición" : "Confirmar eliminar competición"}
              </Button>
            </>
          }
        >
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {dialogo === "crear" ? (
            <fieldset className={styles.editor} disabled={pendiente}>
              <legend>{categoria}</legend>
              <Field
                ref={refNombre}
                label="Nombre de la competición"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
              <Select label="Formato" value={formato} onChange={(e) => setFormato(e.target.value)}>
                <option value="liga">Liga</option>
                <option value="eliminatoria">Copa / Árbol</option>
              </Select>
            </fieldset>
          ) : (
            <p>
              ¿Eliminar {actual?.nombre}? Solo se puede eliminar si no tiene jornadas. Sus equipos
              permanecerán en la biblioteca.
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
