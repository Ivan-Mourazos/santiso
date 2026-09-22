"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import type { StaffDto } from "@/lib/dto";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  borradorDeStaff,
  erroresStaff,
  formularioDeStaff,
  hayCambios,
  type BorradorStaff,
} from "@/lib/plantilla/modelo";
import { guardarMiembroStaff } from "@/lib/server/acciones/staff";
import FotoFormulario from "./FotoFormulario";
import styles from "./Plantilla.module.css";

interface Props {
  /** `null` = alta. Con valor, se edita ese papel concreto (una persona puede tener dos). */
  miembro: StaffDto | null;
  destino: {
    temporadaId: string;
    temporadaNombre: string;
    tipo: "Tecnico" | "Directiva";
    /** Solo técnicos. La directiva no tiene categoría. */
    categoria?: string;
  };
  onCerrar: () => void;
  onGuardado: (miembro: StaffDto, alta: boolean) => void;
}

type Errores = Partial<Record<keyof BorradorStaff, string>>;

/** Alta y edición de un papel del staff. Se monta con `key` desde el padre. */
export default function EditorStaff({ miembro, destino, onCerrar, onGuardado }: Props) {
  const alta = miembro === null;
  const [inicial] = useState(() => borradorDeStaff(miembro));
  const [borrador, setBorrador] = useState(inicial);
  const [foto, setFoto] = useState<File | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const guardando = useRef(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const cargoRef = useRef<HTMLInputElement>(null);

  const sucio = hayCambios(inicial, borrador, foto !== null);
  useUnsavedChanges(sucio);

  const grupo =
    destino.tipo === "Tecnico"
      ? `Cuerpo técnico ${destino.categoria ?? ""} ${destino.temporadaNombre}`
      : `Directiva ${destino.temporadaNombre}`;

  const campo = (clave: "nombre" | "cargo") => (e: { target: { value: string } }) => {
    setBorrador((b) => ({ ...b, [clave]: e.target.value }));
    setErrores((actuales) => ({ ...actuales, [clave]: undefined }));
  };

  function cerrar() {
    if (guardando.current) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }

  async function guardar() {
    if (guardando.current) return;
    const locales = erroresStaff(borrador);
    if (Object.keys(locales).length > 0) {
      setErrores(locales);
      (locales.nombre ? nombreRef : cargoRef).current?.focus();
      return;
    }
    guardando.current = true;
    setPendiente(true);
    setErrorGeneral(null);
    try {
      const archivo = foto ? await prepararImagen(foto) : null;
      const resultado = await guardarMiembroStaff(formularioDeStaff(borrador, destino, archivo));
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        setErrores({
          nombre: resultado.campos?.nombre,
          cargo: resultado.campos?.cargo,
        });
        return;
      }
      onGuardado(resultado.datos, alta);
    } catch (error) {
      console.error(error);
      setErrorGeneral("No se pudo guardar. Comprueba la conexión; lo que has escrito sigue aquí.");
    } finally {
      guardando.current = false;
      setPendiente(false);
    }
  }

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      initialFocusRef={nombreRef}
      title={alta ? `Nuevo · ${grupo}` : `Editar a ${inicial.nombre}`}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button type="submit" form="editor-staff" pending={pendiente} pendingLabel="Guardando…">
            {alta ? "Añadir" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form
        id="editor-staff"
        className={styles.editor}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {errorGeneral && (
          <p role="alert" className={styles.error}>
            {errorGeneral}
          </p>
        )}
        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>Persona</legend>
          {!alta && (
            <p className={styles.alcance}>
              El nombre es el mismo en todas sus temporadas y cargos.
            </p>
          )}
          <Field
            ref={nombreRef}
            label="Nombre completo"
            value={borrador.nombre}
            onChange={campo("nombre")}
            error={errores.nombre}
            autoComplete="off"
            required
          />
        </fieldset>
        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>{grupo}</legend>
          <p className={styles.alcance}>
            Solo cambian en esta temporada; las anteriores no se tocan.
          </p>
          <Field
            ref={cargoRef}
            label="Cargo"
            placeholder={
              destino.tipo === "Tecnico" ? "Entrenador, delegado…" : "Presidente, tesorera…"
            }
            value={borrador.cargo}
            onChange={campo("cargo")}
            error={errores.cargo}
            autoComplete="off"
            required
          />
          <FotoFormulario
            actual={miembro?.foto_url ?? null}
            archivo={foto}
            onCambiar={setFoto}
            etiqueta={`Foto de ${destino.temporadaNombre}`}
            deshabilitado={pendiente}
          />
        </fieldset>
      </form>
    </Dialog>
  );
}
