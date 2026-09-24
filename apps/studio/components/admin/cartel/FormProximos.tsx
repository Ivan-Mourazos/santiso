/**
 * components/admin/cartel/FormProximos.tsx
 * Form panel for the "Próximos Encontros" template.
 */

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { NextMatch } from "@/lib/cartel-draw";
import { elegirProximos } from "@/lib/jornada/proximos";
import { SectionLabel, Toggle, type SelectorMatch } from "./Common";
import styles from "./Formularios.module.css";
import type { FormState } from "./types";

function normalizeText(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function categoriaKey(value: string) {
  const normalized = normalizeText(value);
  if (normalized.startsWith("sen")) return "sen";
  if (normalized.startsWith("fem")) return "fem";
  if (normalized.startsWith("vet")) return "vet";
  return normalized.slice(0, 3);
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  updateMatch: (i: number, patch: Partial<NextMatch>) => void;
  handleMatchRivalFile?: (i: number, file: File | null) => void;
  equipos: { id: string; nombre: string; escudo_url: string; categoria?: string }[];
  dbMatches: SelectorMatch[];
  /** Abierto desde «Jornada»: rellena solo en cuanto llega la lista, una vez. */
  rellenarAlAbrir?: boolean;
}

export const FormProximos: React.FC<Props> = ({
  form,
  set,
  updateMatch,
  handleMatchRivalFile,
  equipos,
  dbMatches,
  rellenarAlAbrir = false,
}) => {
  const [aviso, setAviso] = useState("");
  const pendienteRef = useRef(rellenarAlAbrir);

  const handleAutoFill = () => {
    const elegidos = elegirProximos(dbMatches, new Date());
    const conRival = elegidos.filter((m) => m.rival).length;
    if (conRival === 0) {
      setAviso("No hay partidos pendientes del Santiso con fecha. Revisa las horas en Calendario.");
      return;
    }
    setAviso(
      conRival < elegidos.length
        ? "Solo juega una categoría esta jornada: el otro hueco queda vacío y no sale en el cartel."
        : "",
    );
    set("matches", elegidos);
  };

  // La ref se vacía al rellenar, no antes: en desarrollo React ejecuta el efecto dos veces.
  useEffect(() => {
    if (!pendienteRef.current || dbMatches.length === 0) return;
    const temporizador = window.setTimeout(() => {
      pendienteRef.current = false;
      handleAutoFill();
    }, 0);
    return () => window.clearTimeout(temporizador);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al llegar la lista
  }, [dbMatches]);

  return (
    <>
      <div className={styles.desdeLiga}>
        <h4 className={styles.seccion}>Autocompletar desde la liga</h4>
        <Button onClick={handleAutoFill}>Rellenar con los partidos de esta jornada</Button>
        {aviso && (
          <p role="status" className={styles.nota}>
            {aviso}
          </p>
        )}
      </div>
      <SectionLabel>Sénior y veteranos</SectionLabel>
      <p className={styles.nota}>
        Un partido sin rival no sale en el cartel: déjalo vacío si esa categoría descansa.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {form.matches.map((m, i) => (
          <div key={i} className={styles.tarjetaPartido}>
            <h5 className={styles.seccion}>Partido {i + 1}</h5>

            <div className={styles.parejaAncha}>
              <div>
                <Field
                  label={`Rival del partido ${i + 1}`}
                  list={`rival-list-${i}`}
                  placeholder="Nombre del rival…"
                  value={m.rival}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = equipos.find(
                      (eq) => eq.nombre.toLowerCase() === val.toLowerCase(),
                    );
                    updateMatch(i, {
                      rival: val,
                      ...(found ? { rivalEscudoUrl: found.escudo_url } : {}),
                    });
                  }}
                />
                <datalist id={`rival-list-${i}`}>
                  {equipos
                    .filter(
                      (e) => categoriaKey(e.categoria || "") === categoriaKey(m.categoria || ""),
                    )
                    .map((e) => (
                      <option key={e.id} value={e.nombre} />
                    ))}
                </datalist>
                <div className={styles.escudo}>
                  <label className="file-input-label">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Subir escudo
                    <input
                      type="file"
                      className="hidden-input"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0] && handleMatchRivalFile) {
                          handleMatchRivalFile(i, e.target.files[0]);
                        }
                      }}
                    />
                  </label>
                  {m.rivalEscudoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                    <img
                      className={styles.escudoImagen}
                      src={m.rivalEscudoUrl}
                      alt="Escudo del rival"
                    />
                  )}
                </div>
              </div>
              <Select
                label="Categoría"
                value={m.categoria}
                onChange={(e) =>
                  updateMatch(i, { categoria: e.target.value, rival: "", rivalEscudoUrl: "" })
                }
              >
                <option value="Senior">Sénior</option>
                <option value="Veteranos">Veteranos</option>
              </Select>
            </div>

            <div className={styles.pareja}>
              <Field
                label="Fecha"
                type="date"
                value={m.fecha}
                onChange={(e) => updateMatch(i, { fecha: e.target.value })}
              />
              <Field
                label="Hora"
                type="time"
                value={m.hora || "18:00"}
                onChange={(e) => updateMatch(i, { hora: e.target.value })}
              />
            </div>

            <Field
              label="Campo o estadio"
              value={m.lugar || ""}
              placeholder="A Merced"
              onChange={(e) => updateMatch(i, { lugar: e.target.value })}
            />

            <div className={styles.campo} role="group" aria-label={`Localía del partido ${i + 1}`}>
              <span className={styles.etiqueta}>Localía</span>
              <div className={styles.interruptores}>
                <Toggle
                  label="Local"
                  active={m.santisoSide === "left"}
                  onClick={() => updateMatch(i, { santisoSide: "left" })}
                />
                <Toggle
                  label="Visitante"
                  active={m.santisoSide === "right"}
                  onClick={() => updateMatch(i, { santisoSide: "right" })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
