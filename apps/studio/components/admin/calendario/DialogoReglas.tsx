"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ReglaClasificacion } from "@santiso/domain";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { Field } from "@/components/ui/foundation/Fields";
import { LoadingState } from "@/components/ui/foundation/States";
import { cargarReglas, guardarReglas } from "@/lib/server/acciones/competiciones";
import styles from "./Calendario.module.css";

interface Props {
  competicionId: string;
  competicion: string;
  onCerrar: () => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const PALETA = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];
const conColor = (color: string) => ({ "--color-regla": color }) as CSSProperties;

/** «1, 2 ,x, 3» → [1, 2, 3]. Lo que no sea un puesto válido se descarta. */
function leerPuestos(texto: string): number[] {
  return texto
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Zonas de la clasificación de la competición (ascenso, playoff, descenso…): nombre, puestos y
 * color. Se guardan en la competición y las pinta la pantalla de Clasificación.
 */
export default function DialogoReglas({ competicionId, competicion, onCerrar, showToast }: Props) {
  const [guardadas, setGuardadas] = useState<ReglaClasificacion[] | null>(null);
  const [reglas, setReglas] = useState<ReglaClasificacion[]>([]);
  const [nombre, setNombre] = useState("");
  const [puestos, setPuestos] = useState("");
  const [color, setColor] = useState(PALETA[0]!);
  const [pendiente, setPendiente] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);

  const sucio =
    Boolean(nombre || puestos) ||
    (guardadas !== null && JSON.stringify(reglas) !== JSON.stringify(guardadas));
  useUnsavedChanges(sucio);

  useEffect(() => {
    let vigente = true;
    const id = window.setTimeout(async () => {
      try {
        const cargadas = await cargarReglas(competicionId);
        if (!vigente) return;
        setGuardadas(cargadas);
        setReglas(cargadas);
      } catch {
        if (vigente) showToast("No se pudieron cargar las zonas.", "error");
      }
    }, 0);
    return () => {
      vigente = false;
      window.clearTimeout(id);
    };
  }, [competicionId, showToast]);

  function anadir(e: React.FormEvent) {
    e.preventDefault();
    const lista = leerPuestos(puestos);
    if (!nombre.trim() || lista.length === 0) {
      return showToast("La zona necesita nombre y al menos un puesto", "error");
    }
    setReglas((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nombre: nombre.trim(), puestos: lista, color },
    ]);
    setNombre("");
    setPuestos("");
    nombreRef.current?.focus();
  }

  const editar = (id: string, cambio: Partial<ReglaClasificacion>) =>
    setReglas((prev) => prev.map((r) => (r.id === id ? { ...r, ...cambio } : r)));

  async function guardar() {
    setPendiente(true);
    try {
      const resultado = await guardarReglas(competicionId, reglas);
      if (!resultado.ok) return showToast(resultado.error, "error");
      setGuardadas(reglas);
      showToast("Reglas de liga guardadas");
    } catch {
      showToast("No se pudieron guardar las zonas. Comprueba la conexión.", "error");
    } finally {
      setPendiente(false);
    }
  }

  function cerrar() {
    if (pendiente) return;
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    onCerrar();
  }

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      title="Zonas de la clasificación"
      description={competicion}
      initialFocusRef={nombreRef}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} pending={pendiente} disabled={guardadas === null}>
            Guardar zonas
          </Button>
        </>
      }
    >
      {guardadas === null ? (
        <LoadingState title="Cargando zonas…" />
      ) : (
        <>
          {reglas.length === 0 ? (
            <p className={styles.nota}>Esta competición todavía no tiene zonas.</p>
          ) : (
            <ul className={styles.zonas} aria-label="Zonas de la competición">
              {reglas.map((r) => (
                <li key={r.id} style={conColor(r.color)}>
                  <span className={styles.muestra} aria-hidden="true" />
                  <Field
                    label={`Nombre de ${r.nombre}`}
                    value={r.nombre}
                    onChange={(e) => editar(r.id, { nombre: e.target.value })}
                  />
                  <Field
                    label={`Puestos de ${r.nombre}`}
                    defaultValue={r.puestos.join(", ")}
                    onBlur={(e) => {
                      const lista = leerPuestos(e.target.value);
                      if (lista.length) editar(r.id, { puestos: lista });
                      else e.target.value = r.puestos.join(", ");
                    }}
                  />
                  <Button
                    variant="danger"
                    onClick={() => setReglas((prev) => prev.filter((x) => x.id !== r.id))}
                    aria-label={`Quitar ${r.nombre}`}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <hr className={styles.separador} />

          <form onSubmit={anadir}>
            <h4 className={styles.titulo}>Nueva zona</h4>
            <div className={styles.fila}>
              <Field
                ref={nombreRef}
                label="Nombre de la zona"
                placeholder="Ascenso, playoff…"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <Field
                label="Puestos"
                hint="Separados por comas: 1, 2"
                value={puestos}
                onChange={(e) => setPuestos(e.target.value)}
              />
            </div>
            <fieldset className={styles.paleta}>
              <legend>Color</legend>
              {PALETA.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={styles.color}
                  style={conColor(c)}
                  aria-pressed={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </fieldset>
            <div className={styles.acciones}>
              <Button type="submit" variant="secondary">
                Añadir zona
              </Button>
            </div>
          </form>
        </>
      )}
    </Dialog>
  );
}
