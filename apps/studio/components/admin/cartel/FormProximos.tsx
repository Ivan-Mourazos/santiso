/**
 * components/admin/cartel/FormProximos.tsx
 * Form panel for the "Próximos Encontros" template.
 */

import React from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { NextMatch } from "@/lib/cartel-draw";
import { SectionLabel, Toggle, type SelectorMatch } from "./Common";
import styles from "./Formularios.module.css";
import { matchDateInput, matchTimeInput } from "./matchDateTime";
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

function isSantisoTeam(team?: { nombre?: string | null } | null) {
  return normalizeText(team?.nombre || "").includes("santiso");
}

function isPendingMatch(match: SelectorMatch) {
  const estado = normalizeText(match.estado || "programado");
  return !["finalizado", "cancelado", "aplazado"].includes(estado);
}

function getMatchTime(match: SelectorMatch) {
  return match.fecha ? new Date(match.fecha).getTime() : Number.POSITIVE_INFINITY;
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  updateMatch: (i: number, patch: Partial<NextMatch>) => void;
  handleMatchRivalFile?: (i: number, file: File | null) => void;
  equipos: { id: string; nombre: string; escudo_url: string; categoria?: string }[];
  dbMatches: SelectorMatch[];
}

export const FormProximos: React.FC<Props> = ({
  form,
  set,
  updateMatch,
  handleMatchRivalFile,
  equipos,
  dbMatches,
}) => {
  const handleAutoFill = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Solo partidos del Santiso pendientes. Si no, puede coger otro partido de la liga.
    const allUpcomingSantiso = [...dbMatches]
      .filter((m) => {
        if (!m.fecha || !isPendingMatch(m)) return false;
        if (!isSantisoTeam(m.equipo_local) && !isSantisoTeam(m.equipo_visitante)) return false;
        const matchDate = new Date(m.fecha);
        if (Number.isNaN(matchDate.getTime())) return false;
        return matchDate.getTime() >= today.getTime();
      })
      .sort((a, b) => getMatchTime(a) - getMatchTime(b));

    if (allUpcomingSantiso.length === 0) return;

    // Ventana máxima de 6 días desde el primer partido para asegurar que solo
    // autocompletamos partidos de la MISMA jornada (si un equipo descansa, no coge el de la semana que viene).
    const earliestMatchTime = getMatchTime(allUpcomingSantiso[0]);
    const maxWindowTime = earliestMatchTime + 6 * 24 * 60 * 60 * 1000;

    const currentMatchdayMatches = allUpcomingSantiso.filter(
      (m) => getMatchTime(m) <= maxWindowTime,
    );

    // Buscar el más próximo de cada categoría del club.
    const cats = ["Senior", "Veteranos"];
    const selectedMatches: SelectorMatch[] = [];

    cats.forEach((cat) => {
      const match = currentMatchdayMatches.find(
        (m) => categoriaKey(m.categoria || "") === categoriaKey(cat),
      );
      if (match) selectedMatches.push(match);
    });

    // Si no hay 3 categorías con partido, rellena con otros próximos del Santiso de la misma jornada.
    if (selectedMatches.length < 3) {
      currentMatchdayMatches.forEach((m) => {
        if (selectedMatches.length < 3 && !selectedMatches.find((sm) => sm.id === m.id)) {
          selectedMatches.push(m);
        }
      });
    }

    // 4. Ordenar los elegidos por fecha para que el cartel sea cronológico
    selectedMatches.sort((a, b) => getMatchTime(a) - getMatchTime(b));

    // 5. Rellenar los 3 slots
    const newMatches: NextMatch[] = Array.from({ length: 3 }, () => ({
      rival: "",
      rivalEscudoUrl: "",
      fecha: "",
      hora: "18:00",
      categoria: "Senior",
      lugar: "",
      santisoSide: "right",
    }));

    selectedMatches.forEach((match, index) => {
      const isSantisoLocal = isSantisoTeam(match.equipo_local);
      const rival = isSantisoLocal ? match.equipo_visitante : match.equipo_local;
      newMatches[index] = {
        rival: rival?.nombre || "",
        rivalEscudoUrl: rival?.escudo_url || "",
        fecha: matchDateInput(match.fecha),
        hora: matchTimeInput(match.fecha),
        categoria: match.categoria || "Senior",
        lugar: match.campo?.nombre || match.lugar || "",
        santisoSide: isSantisoLocal ? "left" : "right",
      };
    });

    set("matches", newMatches);
  };

  return (
    <>
      <div className={styles.desdeLiga}>
        <h4 className={styles.seccion}>Autocompletar desde la liga</h4>
        <Button onClick={handleAutoFill}>Rellenar con los 3 próximos partidos</Button>
      </div>
      <SectionLabel>Configurar los 3 partidos</SectionLabel>
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
