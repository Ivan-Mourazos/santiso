"use client";
import { useRef, useState } from "react";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { rutaSeccion } from "@/lib/navigation/contexto";
import type { useCompeticiones } from "@/lib/useCompeticiones";
import { crearCompeticion, crearCompeticionDesdeEnlace } from "@/lib/server/acciones/competiciones";
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
  const { navigate, params, showConfirm, showToast } = useStudio();
  const [dialogo, setDialogo] = useState<"crear" | "borrar" | null>(null);
  // La competición elegida vive en la URL y tarda un instante en actualizarse. Mientras tanto,
  // `selectedCompetitionId` sigue siendo la anterior: se guarda aquí la pedida para mostrarla ya
  // y para no dejar crear ni eliminar sobre la que se está dejando.
  const [solicitada, setSolicitada] = useState<{ desde: string; hacia: string } | null>(null);
  // El borrado apunta a la competición que se vio al abrir el diálogo, no a la que esté
  // seleccionada al confirmar.
  const [objetivo, setObjetivo] = useState<{ id: string; nombre: string } | null>(null);
  const [enlace, setEnlace] = useState("");
  const [nombre, setNombre] = useState("");
  const [formato, setFormato] = useState("liga");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const operacion = useRef(false);
  const refEnlace = useRef<HTMLInputElement>(null);
  const sucio = dialogo === "crear" && (enlace !== "" || nombre !== "" || formato !== "liga");
  useUnsavedChanges(sucio);
  // Solo cuenta como «cambiando» mientras siga seleccionada la de antes: en cuanto la selección
  // cambia —por este desplegable o por otra vía, como crear una competición—, deja de estarlo.
  const cambiando =
    solicitada !== null &&
    solicitada.hacia !== solicitada.desde &&
    contexto.selectedCompetitionId === solicitada.desde;
  const actual = cambiando
    ? undefined
    : contexto.competicionesEnCategoria.find((c) => c.id === contexto.selectedCompetitionId);
  function cerrar() {
    if (operacion.current) return;
    if (sucio)
      return showConfirm("Hay cambios sin guardar. ¿Descartarlos?", descartar, {
        trasCerrar: true,
      });
    descartar();
  }
  function descartar() {
    setDialogo(null);
    setEnlace("");
    setNombre("");
    setFormato("liga");
    setError(null);
  }
  async function confirmar() {
    if (operacion.current) return;
    if (dialogo === "crear" && !enlace.trim() && !nombre.trim()) {
      setError("Pega el enlace de la federación o escribe el nombre.");
      refEnlace.current?.focus();
      return;
    }
    if (dialogo === "borrar" && !objetivo) return;
    operacion.current = true;
    setPendiente(true);
    setError(null);
    try {
      if (dialogo === "crear") {
        const resultado = enlace.trim()
          ? await crearCompeticionDesdeEnlace({ enlace, categoria, nombre })
          : await crearCompeticion({ nombre, categoria, formato });
        if (!resultado.ok) {
          setError(resultado.error);
          return;
        }
        // Solo después de guardar se resuelve el borrador. La recarga desmonta el
        // diálogo y su guardia antes de navegar a la competición recién creada.
        const conEnlace = enlace.trim() !== "";
        setDialogo(null);
        setEnlace("");
        setNombre("");
        setFormato("liga");
        await contexto.loadCompeticiones();
        contexto.setSelectedCompetitionId(resultado.datos.id);
        if (conEnlace) {
          showToast(`${resultado.datos.nombre} creada. Trae sus equipos y partidos en Federación.`);
          const destino = new URLSearchParams(params);
          destino.set("competicion", resultado.datos.id);
          navigate(rutaSeccion("federacion", destino));
        }
      } else {
        if (!objetivo) return;
        const resultado = await contexto.removeCompeticion(objetivo.id);
        if (resultado.error) {
          setError(resultado.error.message);
          return;
        }
      }
      setDialogo(null);
      setEnlace("");
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
          value={cambiando && solicitada ? solicitada.hacia : contexto.selectedCompetitionId}
          onChange={(e) => {
            const desde = contexto.selectedCompetitionId;
            const hacia = e.target.value;
            setSolicitada(contexto.setSelectedCompetitionId(hacia) ? { desde, hacia } : null);
          }}
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
            disabled={cambiando || contexto.historicalSeason || !contexto.selectedSeasonId}
          >
            Crear competición
          </Button>
          {actual && contexto.competicionesEnCategoria.length > 1 && (
            <Button
              variant="secondary"
              onClick={() => {
                setObjetivo({ id: actual.id, nombre: actual.nombre });
                setDialogo("borrar");
              }}
            >
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
          initialFocusRef={dialogo === "crear" ? refEnlace : undefined}
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
                ref={refEnlace}
                label="Enlace de futgal.es"
                type="url"
                inputMode="url"
                placeholder="https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?…"
                value={enlace}
                onChange={(e) => setEnlace(e.target.value)}
              />
              <p className={styles.detalle}>
                Con el enlace, el nombre y el formato salen de la federación. Sin él, créala a mano.
              </p>
              <Field
                label={enlace.trim() ? "Nombre (opcional)" : "Nombre de la competición"}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              {!enlace.trim() && (
                <Select
                  label="Formato"
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                >
                  <option value="liga">Liga</option>
                  <option value="eliminatoria">Copa / Árbol</option>
                </Select>
              )}
            </fieldset>
          ) : (
            <p>
              ¿Eliminar «{objetivo?.nombre}»? Solo se puede eliminar si no tiene jornadas. Sus
              equipos permanecerán en la biblioteca.
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
