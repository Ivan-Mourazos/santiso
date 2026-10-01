"use client";
import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import type { EquipoDto } from "@/lib/dto";
import { borradorDeEquipo, formularioDeEquipo } from "@/lib/equipos/modelo";
import { prepararImagen } from "@/lib/imagen-cliente";
import { guardarEquipo } from "@/lib/server/acciones/equipos";
import FotoFormulario from "../plantilla/FotoFormulario";
import styles from "./Equipos.module.css";

interface Props {
  equipo: EquipoDto | null;
  destino: { categoria: string; competicionId?: string; competicionNombre?: string };
  onCerrar: () => void;
  onGuardado: () => void;
}
export default function EditorEquipo({ equipo, destino, onCerrar, onGuardado }: Props) {
  const [inicial] = useState(() => borradorDeEquipo(equipo));
  const [nombre, setNombre] = useState(inicial.nombre);
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorNombre, setErrorNombre] = useState<string | undefined>();
  const [pendiente, setPendiente] = useState(false);
  const operacion = useRef(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const [escudo3d, setEscudo3d] = useState(inicial.escudo3d);
  const [color, setColor] = useState(inicial.color);
  const sucio =
    nombre !== inicial.nombre ||
    foto !== null ||
    escudo3d !== inicial.escudo3d ||
    color !== inicial.color;
  useUnsavedChanges(sucio);
  function cerrar() {
    if (operacion.current) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }
  async function guardar() {
    if (operacion.current) return;
    if (!nombre.trim()) {
      setErrorNombre("El nombre es obligatorio.");
      nombreRef.current?.focus();
      return;
    }
    operacion.current = true;
    setPendiente(true);
    setError(null);
    try {
      const imagen = foto ? await prepararImagen(foto) : null;
      const resultado = await guardarEquipo(
        formularioDeEquipo({ id: inicial.id, nombre, escudo3d, color }, destino, imagen),
      );
      if (!resultado.ok) {
        setError(resultado.error);
        setErrorNombre(resultado.campos?.nombre);
        return;
      }
      onGuardado();
    } catch {
      setError("No se pudo guardar. Tus cambios siguen aquí.");
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
      initialFocusRef={nombreRef}
      title={equipo ? `Editar a ${equipo.nombre}` : "Crear equipo"}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" form="editor-equipo" pending={pendiente}>
            {equipo ? "Guardar cambios" : "Crear equipo"}
          </Button>
        </>
      }
    >
      <form
        id="editor-equipo"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <fieldset className={styles.editor} disabled={pendiente}>
          <legend>{destino.categoria}</legend>
          <p className={styles.detalle}>
            El nombre y el escudo pertenecen al equipo y cambian en todas sus competiciones.
          </p>
          {!equipo && (
            <p>
              {destino.competicionId
                ? `Se añadirá a ${destino.competicionNombre}.`
                : "Se creará en la biblioteca, sin inscribirlo en ninguna competición."}
            </p>
          )}
          <Field
            ref={nombreRef}
            label="Nombre del equipo"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setErrorNombre(undefined);
            }}
            error={errorNombre}
            required
            autoComplete="off"
          />
          <FotoFormulario
            actual={equipo?.escudo_url ?? null}
            archivo={foto}
            onCambiar={setFoto}
            etiqueta="Escudo del equipo"
            deshabilitado={pendiente}
          />
          <label className={styles.casilla}>
            <input
              className={styles.check}
              type="checkbox"
              checked={escudo3d}
              onChange={(e) => setEscudo3d(e.target.checked)}
            />
            Escudo ya en 3D (los carteles no le añaden relieve)
          </label>
          {/* Sin color elegido, los carteles lo sacan del escudo. */}
          <div className={styles.color}>
            <label className={styles.casilla}>
              <input
                className={styles.check}
                type="checkbox"
                checked={color !== ""}
                onChange={(e) => setColor(e.target.checked ? "#64748b" : "")}
                disabled={pendiente}
              />
              Color del equipo en los carteles
            </label>
            {color ? (
              <input
                type="color"
                className={styles.muestra}
                aria-label="Color del equipo"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={pendiente}
              />
            ) : (
              <span className={styles.detalle}>Se saca del escudo</span>
            )}
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}
