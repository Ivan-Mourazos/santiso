"use client";

import { useState, type CSSProperties } from "react";
import type { ReglaClasificacion } from "@santiso/domain";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";
import { guardarReglas } from "@/lib/server/acciones/competiciones";
import { aFila, entero, validarZonas, type Fila } from "@/lib/clasificacion/zonas";
import styles from "./Clasificacion.module.css";

interface Props {
  competicionId: string;
  competicion: string;
  /** Equipos de la tabla: los puestos van de 1 a este número. */
  equipos: number;
  zonas: ReglaClasificacion[];
  onCerrar: () => void;
  onGuardadas: (zonas: ReglaClasificacion[]) => void;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const COLORES = [
  { valor: "#10b981", nombre: "Verde" },
  { valor: "#3b82f6", nombre: "Azul" },
  { valor: "#06b6d4", nombre: "Turquesa" },
  { valor: "#8b5cf6", nombre: "Morado" },
  { valor: "#f59e0b", nombre: "Ámbar" },
  { valor: "#f97316", nombre: "Naranja" },
  { valor: "#ef4444", nombre: "Rojo" },
  { valor: "#ec4899", nombre: "Rosa" },
];
const conColor = (color: string) => ({ "--color-regla": color }) as CSSProperties;

/**
 * Zonas de la clasificación (ascenso, playoff, descenso…): cada una es un tramo de puestos con
 * su color. La tira de abajo enseña cómo queda la tabla mientras se editan.
 */
export default function DialogoZonas({
  competicionId,
  competicion,
  equipos,
  zonas,
  onCerrar,
  onGuardadas,
  showToast,
}: Props) {
  const [inicial] = useState(() => zonas.map(aFila));
  const [filas, setFilas] = useState(inicial);
  const [pendiente, setPendiente] = useState(false);
  const sucio = JSON.stringify(filas) !== JSON.stringify(inicial);
  useUnsavedChanges(sucio);

  const editar = (id: string, cambio: Partial<Fila>) =>
    setFilas((antes) => antes.map((f) => (f.id === id ? { ...f, ...cambio } : f)));

  function anadir() {
    // Propone el tramo siguiente al último y un color que aún no se use.
    const ultimo = Math.max(0, ...filas.map((f) => entero(f.hasta)).filter(Number.isFinite));
    const libre = COLORES.find((c) => !filas.some((f) => f.color === c.valor)) ?? COLORES[0]!;
    const desde = Math.min(ultimo + 1, Math.max(equipos, 1));
    setFilas((antes) => [
      ...antes,
      {
        id: crypto.randomUUID(),
        nombre: "",
        desde: String(desde),
        hasta: String(desde),
        color: libre.valor,
      },
    ]);
  }

  async function guardar() {
    const validas = validarZonas(filas, equipos);
    if ("error" in validas) return showToast(validas.error, "error");
    setPendiente(true);
    try {
      const resultado = await guardarReglas(competicionId, validas.zonas);
      if (!resultado.ok) return showToast(resultado.error, "error");
      showToast("Zonas guardadas");
      onGuardadas(validas.zonas);
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

  // Color de cada puesto para la vista previa (la última zona que lo nombre, como la tabla).
  const total = Math.max(equipos, ...filas.map((f) => entero(f.hasta)).filter(Number.isFinite), 1);
  const colorDe = (puesto: number) =>
    filas.find((f) => puesto >= entero(f.desde) && puesto <= entero(f.hasta))?.color ?? null;

  return (
    <Dialog
      open
      onClose={cerrar}
      pending={pendiente}
      title="Zonas de la clasificación"
      description={competicion}
      footer={
        <>
          <Button variant="secondary" onClick={cerrar} disabled={pendiente}>
            Cancelar
          </Button>
          <Button onClick={() => void guardar()} pending={pendiente}>
            Guardar zonas
          </Button>
        </>
      }
    >
      <div className={styles.zonasEditor}>
        {filas.length === 0 ? (
          <p className={styles.nota}>
            Sin zonas. Añade, por ejemplo, «Ascenso» del 1 al 2 y «Descenso» de los últimos puestos.
          </p>
        ) : (
          <ul className={styles.zonasLista} aria-label="Zonas de la competición">
            {filas.map((f, i) => (
              <li key={f.id} style={conColor(f.color)}>
                <span className={styles.muestra} aria-hidden="true" />
                <input
                  className={styles.zonaNombre}
                  aria-label={`Nombre de la zona ${i + 1}`}
                  placeholder="Ascenso, playoff…"
                  value={f.nombre}
                  onChange={(e) => editar(f.id, { nombre: e.target.value })}
                  autoFocus={!f.nombre && i === filas.length - 1}
                />
                <label className={styles.tramo}>
                  del
                  <input
                    type="number"
                    min={1}
                    max={equipos || undefined}
                    aria-label={`Desde el puesto (zona ${i + 1})`}
                    value={f.desde}
                    onChange={(e) => editar(f.id, { desde: e.target.value })}
                  />
                  al
                  <input
                    type="number"
                    min={1}
                    max={equipos || undefined}
                    aria-label={`Hasta el puesto (zona ${i + 1})`}
                    value={f.hasta}
                    onChange={(e) => editar(f.id, { hasta: e.target.value })}
                  />
                </label>
                <select
                  className={styles.zonaColor}
                  aria-label={`Color de la zona ${i + 1}`}
                  value={f.color}
                  onChange={(e) => editar(f.id, { color: e.target.value })}
                >
                  {COLORES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.nombre}
                    </option>
                  ))}
                  {!COLORES.some((c) => c.valor === f.color) && (
                    <option value={f.color}>Otro</option>
                  )}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Quitar ${f.nombre || `zona ${i + 1}`}`}
                  onClick={() => setFilas((antes) => antes.filter((x) => x.id !== f.id))}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button size="sm" variant="secondary" onClick={anadir}>
            Añadir zona
          </Button>
        </div>

        <div>
          <p className={styles.nota}>Así queda la tabla:</p>
          <ol className={styles.tira} aria-label="Vista previa de los puestos">
            {Array.from({ length: total }, (_, i) => {
              const color = colorDe(i + 1);
              return (
                <li key={i} style={color ? conColor(color) : undefined} data-zona={Boolean(color)}>
                  {i + 1}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Dialog>
  );
}
