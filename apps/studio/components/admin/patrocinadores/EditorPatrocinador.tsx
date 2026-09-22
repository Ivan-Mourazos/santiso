"use client";

import { useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import type { PatrocinadorDto } from "@/lib/dto";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  borradorDePatrocinador,
  erroresPatrocinador,
  formularioDePatrocinador,
  type BorradorPatrocinador,
} from "@/lib/patrocinadores/modelo";
import {
  buscarCoincidenciaPatrocinador,
  guardarPatrocinador,
} from "@/lib/server/acciones/patrocinadores";
import FotoFormulario from "../plantilla/FotoFormulario";
import styles from "./Patrocinadores.module.css";

interface Props {
  /** `null` = alta. */
  registro: PatrocinadorDto | null;
  onCerrar: () => void;
  onGuardado: (fila: PatrocinadorDto, alta: boolean) => void;
  /** Abre la ficha que ya usaba ese nombre, descartando lo escrito aquí. */
  onAbrirExistente: (fila: PatrocinadorDto) => void;
}

type Errores = Partial<Record<"nombre" | "webUrl", string>>;

/**
 * Alta y edición de una ficha del catálogo. Se monta con `key` desde el padre: cada apertura
 * empieza de cero, sin efectos que reinicien el estado a destiempo.
 */
export default function EditorPatrocinador({
  registro,
  onCerrar,
  onGuardado,
  onAbrirExistente,
}: Props) {
  const alta = registro === null;
  const [inicial] = useState(() => borradorDePatrocinador(registro));
  const [borrador, setBorrador] = useState(inicial);
  const [logo, setLogo] = useState<File | null>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [coincidencia, setCoincidencia] = useState<PatrocinadorDto | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const guardando = useRef(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const webRef = useRef<HTMLInputElement>(null);

  const sucio =
    logo !== null ||
    borrador.nombre !== inicial.nombre ||
    borrador.webUrl !== inicial.webUrl ||
    borrador.enCarteles !== inicial.enCarteles;
  useUnsavedChanges(sucio);

  const campo =
    <K extends "nombre" | "webUrl">(clave: K) =>
    (e: { target: { value: string } }) => {
      setBorrador((b: BorradorPatrocinador) => ({ ...b, [clave]: e.target.value }));
      setErrores((actuales) => ({ ...actuales, [clave]: undefined }));
      if (clave === "nombre") setCoincidencia(null);
    };

  function cerrar() {
    if (pendiente) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }

  async function guardar() {
    if (guardando.current) return;
    const locales = erroresPatrocinador(borrador);
    if (Object.keys(locales).length > 0) {
      setErrores(locales);
      (locales.nombre ? nombreRef : webRef).current?.focus();
      return;
    }

    guardando.current = true;
    setPendiente(true);
    setErrorGeneral(null);
    try {
      // Antes de escribir, comprobar que el nombre no es de otra ficha: hasta la 6D, subir un
      // logo con un nombre repetido pisaba la ficha existente sin avisar.
      const choque = await buscarCoincidenciaPatrocinador(borrador.nombre, borrador.id || undefined);
      if (!choque.ok) {
        setErrorGeneral(choque.error);
        return;
      }
      if (choque.datos) {
        setCoincidencia(choque.datos);
        return;
      }

      const imagen = logo ? await prepararImagen(logo) : null;
      const resultado = await guardarPatrocinador(formularioDePatrocinador(borrador, imagen));
      if (!resultado.ok) {
        setErrorGeneral(resultado.error);
        setErrores({ nombre: resultado.campos?.nombre, webUrl: resultado.campos?.webUrl });
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

  function abrirExistente() {
    if (!coincidencia) return;
    if (!window.confirm(`Se descartará lo que has escrito y se abrirá «${coincidencia.nombre}».`)) {
      return;
    }
    onAbrirExistente(coincidencia);
  }

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      initialFocusRef={nombreRef}
      title={alta ? "Nuevo patrocinador o logo" : `Editar «${inicial.nombre}»`}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="editor-patrocinador"
            pending={pendiente}
            pendingLabel="Guardando…"
          >
            {alta ? "Añadir" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <form
        id="editor-patrocinador"
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

        {coincidencia && (
          <div role="alert" className={styles.aviso}>
            <p style={{ margin: 0 }}>
              Ya existe «{coincidencia.nombre}»
              {coincidencia.en_carteles ? ", que sale en los carteles" : ""}. No se ha guardado
              nada: su logo y su web siguen como estaban.
            </p>
            <p style={{ margin: "0.75rem 0 0" }}>
              <Button variant="secondary" onClick={abrirExistente} disabled={pendiente}>
                Abrir «{coincidencia.nombre}»
              </Button>
            </p>
          </div>
        )}

        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>Ficha</legend>
          <Field
            ref={nombreRef}
            label="Nombre"
            value={borrador.nombre}
            onChange={campo("nombre")}
            error={errores.nombre}
            autoComplete="off"
            required
          />
          <Field
            ref={webRef}
            label="Web"
            type="url"
            placeholder="https://…"
            hint="Opcional. Quien tenga web se muestra como patrocinador."
            value={borrador.webUrl}
            onChange={campo("webUrl")}
            error={errores.webUrl}
            autoComplete="off"
          />
          <FotoFormulario
            actual={registro?.logo_url ?? null}
            archivo={logo}
            onCambiar={setLogo}
            etiqueta="Logo"
            deshabilitado={pendiente}
          />
        </fieldset>

        <fieldset className={styles.grupo} disabled={pendiente}>
          <legend>Carteles</legend>
          <label className={styles.casilla}>
            <input
              type="checkbox"
              className={styles.check}
              checked={borrador.enCarteles}
              onChange={(e) =>
                setBorrador((b) => ({ ...b, enCarteles: e.target.checked }))
              }
            />
            Mostrar en carteles
          </label>
          <p className={styles.alcance}>
            Al activarlo entra el último de la barra. Desactivarlo no borra la ficha ni su logo.
          </p>
        </fieldset>
      </form>
    </Dialog>
  );
}
