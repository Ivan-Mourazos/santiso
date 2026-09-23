/**
 * components/admin/cartel/FormClasificacion.tsx
 * Form panel for the "Clasificación / Copa" template.
 */

import React, { useEffect, useState } from "react";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { getClasificacionData } from "@/lib/cartel/clasificacion-data";
import { useCompeticiones } from "@/lib/useCompeticiones";
import AvisoError from "../AvisoError";
import { CategorySelector, SectionLabel, Toggle } from "./Common";
import styles from "./Formularios.module.css";
import type { FilaCartelClasificacion } from "@/lib/cartel/templates/clasificacion";
import type { FormState } from "./types";

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export const FormClasificacion: React.FC<Props> = ({ form, set }) => {
  const { competicionesEnCategoria, errorCompeticiones } = useCompeticiones(form.categoria);
  const [loading, setLoading] = useState(false);
  const [competicionId, setCompeticionId] = useState("");
  const [modoManual, setModoManual] = useState(false);

  // Auto-select a competition that belongs to the current category.
  useEffect(() => {
    const firstCompetitionId = competicionesEnCategoria[0]?.id || "";
    const selectedExists = competicionesEnCategoria.some((c) => c.id === competicionId);

    if (!selectedExists) {
      setCompeticionId(firstCompetitionId);
    }
  }, [competicionesEnCategoria, competicionId]);

  // Fetch data when competition changes (solo si no es modo manual)
  useEffect(() => {
    if (modoManual) return;
    if (!competicionId || !form.categoria) {
      set("clasificacionData", []);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getClasificacionData(form.categoria, competicionId)
      .then((data) => {
        if (!isMounted) return;
        const comp = competicionesEnCategoria.find((c) => c.id === competicionId);
        set("clasificacionTipo", comp?.formato === "eliminatoria" ? "copa" : "liga");
        set("clasificacionNombre", comp?.nombre || "");
        set("clasificacionData", data.equipos);
      })
      .catch(() => {
        if (!isMounted) return;
        set("clasificacionData", []);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria, competicionId, competicionesEnCategoria, modoManual]);

  /** En modo manual los datos son filas de tabla (en copa serían rondas). */
  const filasManuales = (): FilaCartelClasificacion[] =>
    Array.isArray(form.clasificacionData)
      ? [...(form.clasificacionData as FilaCartelClasificacion[])]
      : [];

  const handleAddManualTeam = () => {
    const current = filasManuales();
    const nextPos = current.length + 1;
    current.push({
      id: `manual-${Date.now()}`,
      posicion: nextPos,
      nombre: nextPos === 1 ? "UD Santiso FC" : `Equipo ${nextPos}`,
      escudo_url: "",
      pts: 0,
      pj: 0,
      pg: 0,
      pe: 0,
      pp: 0,
      gf: 0,
      gc: 0,
    });
    set("clasificacionData", current);
  };

  const handleUpdateManualTeam = (
    index: number,
    field: "nombre" | "pts" | "pj",
    val: string | number,
  ) => {
    const current = filasManuales();
    if (!current[index]) return;
    current[index] = { ...current[index], [field]: val };
    set("clasificacionData", current);
  };

  const handleRemoveManualTeam = (index: number) => {
    const current = filasManuales();
    current.splice(index, 1);
    // Reindexar posiciones
    const reindexed = current.map((item, idx) => ({ ...item, posicion: idx + 1 }));
    set("clasificacionData", reindexed);
  };

  return (
    <>
      <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
      <AvisoError mensaje={errorCompeticiones} />

      <SectionLabel>Modo de datos</SectionLabel>
      <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.2rem" }}>
        <button
          type="button"
          onClick={() => {
            setModoManual(false);
          }}
          style={{
            flex: 1,
            padding: "0.6rem",
            background: !modoManual ? "var(--primary)" : "rgba(255,255,255,0.05)",
            color: !modoManual ? "#000" : "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Automático (BD)
        </button>
        <button
          type="button"
          onClick={() => {
            setModoManual(true);
            if (!form.clasificacionData || form.clasificacionData.length === 0) {
              set("clasificacionNombre", form.clasificacionNombre || "LIGA DA COSTA");
              set("clasificacionTipo", "liga");
              set("clasificacionData", [
                {
                  id: "1",
                  posicion: 1,
                  nombre: "UD Santiso FC",
                  pts: 15,
                  pj: 5,
                  pg: 5,
                  pe: 0,
                  pp: 0,
                  gf: 14,
                  gc: 2,
                },
                {
                  id: "2",
                  posicion: 2,
                  nombre: "SD Dubra",
                  pts: 12,
                  pj: 5,
                  pg: 4,
                  pe: 0,
                  pp: 1,
                  gf: 10,
                  gc: 4,
                },
                {
                  id: "3",
                  posicion: 3,
                  nombre: "CF Dumbría",
                  pts: 10,
                  pj: 5,
                  pg: 3,
                  pe: 1,
                  pp: 1,
                  gf: 8,
                  gc: 5,
                },
                {
                  id: "4",
                  posicion: 4,
                  nombre: "Oroso CF",
                  pts: 9,
                  pj: 5,
                  pg: 3,
                  pe: 0,
                  pp: 2,
                  gf: 7,
                  gc: 6,
                },
              ]);
            }
          }}
          style={{
            flex: 1,
            padding: "0.6rem",
            background: modoManual ? "var(--primary)" : "rgba(255,255,255,0.05)",
            color: modoManual ? "#000" : "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ✍️ Manual (Sin BD)
        </button>
      </div>

      <SectionLabel>Visibilidad de Activos</SectionLabel>
      <div style={{ display: "flex", gap: "0.8rem", marginBottom: "1.5rem" }}>
        <Toggle
          label="Logos y Patrocinadores"
          active={form.showAssets}
          onClick={() => set("showAssets", !form.showAssets)}
        />
      </div>

      {modoManual ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <div className={styles.campo}>
            <Field
              label="Nombre de la competición"
              placeholder="LIGA DA COSTA"
              value={form.clasificacionNombre}
              onChange={(e) => set("clasificacionNombre", e.target.value)}
            />
          </div>

          <div className={styles.campo} role="group" aria-label="Tipo de competición">
            <span className={styles.etiqueta}>Tipo</span>
            <div className={styles.interruptores}>
              <Toggle
                label="Liga"
                active={form.clasificacionTipo === "liga"}
                onClick={() => set("clasificacionTipo", "liga")}
              />
              <Toggle
                label="Copa"
                active={form.clasificacionTipo === "copa"}
                onClick={() => set("clasificacionTipo", "copa")}
              />
            </div>
          </div>

          <SectionLabel>Equipos en la tabla</SectionLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              marginBottom: "1rem",
            }}
          >
            {filasManuales().map((eq, idx) => (
              <div
                key={eq.id || idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 50px 50px 32px",
                  gap: "0.4rem",
                  alignItems: "center",
                  background: "rgba(255,255,255,0.03)",
                  padding: "0.4rem 0.6rem",
                  borderRadius: "8px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--primary)",
                    textAlign: "center",
                  }}
                >
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={eq.nombre || ""}
                  onChange={(e) => handleUpdateManualTeam(idx, "nombre", e.target.value)}
                  aria-label={`Nombre del equipo ${idx + 1}`}
                  placeholder="Nombre equipo"
                  style={{ padding: "0.3rem 0.5rem", fontSize: "0.75rem" }}
                />
                <input
                  type="number"
                  value={eq.pts ?? 0}
                  onChange={(e) =>
                    handleUpdateManualTeam(idx, "pts", parseInt(e.target.value) || 0)
                  }
                  aria-label={`Puntos del equipo ${idx + 1}`}
                  placeholder="Pts"
                  title="Puntos"
                  style={{ padding: "0.3rem 0.3rem", fontSize: "0.75rem", textAlign: "center" }}
                />
                <input
                  type="number"
                  value={eq.pj ?? 0}
                  onChange={(e) => handleUpdateManualTeam(idx, "pj", parseInt(e.target.value) || 0)}
                  aria-label={`Partidos jugados del equipo ${idx + 1}`}
                  placeholder="PJ"
                  title="Partidos Jugados"
                  style={{ padding: "0.3rem 0.3rem", fontSize: "0.75rem", textAlign: "center" }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveManualTeam(idx)}
                  style={{
                    background: "rgba(239,68,68,0.2)",
                    border: "none",
                    color: "#f87171",
                    borderRadius: "4px",
                    cursor: "pointer",
                    height: "28px",
                    fontWeight: 800,
                  }}
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddManualTeam}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px dashed rgba(255,255,255,0.2)",
                color: "#fff",
                padding: "0.6rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.8rem",
                marginTop: "0.4rem",
              }}
            >
              + Añadir equipo a la tabla
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.campo}>
            <Select
              label="Competición"
              value={competicionId}
              onChange={(e) => setCompeticionId(e.target.value)}
            >
              {competicionesEnCategoria.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} {c.formato === "eliminatoria" ? "(Eliminatorias)" : "(Liga)"}
                </option>
              ))}
            </Select>
          </div>

          <SectionLabel>Previsualización de Datos</SectionLabel>
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              padding: "1rem",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              fontSize: "0.8rem",
              color: "#ccc",
            }}
          >
            {loading ? (
              <p>Cargando clasificación...</p>
            ) : form.clasificacionData && form.clasificacionData.length > 0 ? (
              <p>
                Se cargaron <strong>{form.clasificacionData.length}</strong>{" "}
                {form.clasificacionTipo === "copa"
                  ? "rondas para este cuadro."
                  : "equipos para esta tabla."}
              </p>
            ) : (
              <p style={{ color: "#f87171" }}>
                No hay datos para esta categoría y competición. Puedes usar el modo Manual arriba.
              </p>
            )}
          </div>
        </>
      )}

      <div className={styles.campo} role="group" aria-label="Santiso en el cartel">
        <span className={styles.etiqueta}>Santiso en el cartel</span>
        <div className={styles.interruptores}>
          <Toggle
            label="← Izquierda"
            active={form.santisoSide === "left"}
            onClick={() => set("santisoSide", "left")}
          />
          <Toggle
            label="Derecha →"
            active={form.santisoSide === "right"}
            onClick={() => set("santisoSide", "right")}
          />
        </div>
      </div>
    </>
  );
};
