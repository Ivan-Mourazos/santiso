/**
 * components/admin/cartel/FormProximos.tsx
 * Form panel for the "Próximos Encontros" template.
 */

import React from "react";
import type { FormState } from "./types";
import { SectionLabel, Toggle } from "./Common";
import type { NextMatch } from "@/lib/cartel-draw";

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

function isPendingMatch(match: any) {
  const estado = normalizeText(match.estado || "programado");
  return !["finalizado", "cancelado", "aplazado"].includes(estado);
}

function toDateInput(value: string) {
  return value.split("T")[0] || "";
}

function toTimeInput(value: string) {
  const rawTime = value.split("T")[1];
  if (!rawTime) return "18:00";
  const match = rawTime.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "18:00";
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  updateMatch: (i: number, patch: Partial<NextMatch>) => void;
  equipos: { id: string; nombre: string; escudo_url: string; categoria?: string }[];
  dbMatches: any[];
  tipo: string;
}

export const FormProximos: React.FC<Props> = ({ form, set, updateMatch, equipos, dbMatches, tipo }) => {
  const handleAutoFill = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Solo partidos del Santiso pendientes. Si no, puede coger otro partido de la liga.
    const allUpcomingSantiso = [...dbMatches]
      .filter(m => {
        if (!m.fecha || !isPendingMatch(m)) return false;
        if (!isSantisoTeam(m.equipo_local) && !isSantisoTeam(m.equipo_visitante)) return false;
        const matchDate = new Date(m.fecha);
        if (Number.isNaN(matchDate.getTime())) return false;
        return matchDate.getTime() >= today.getTime();
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    if (allUpcomingSantiso.length === 0) return;

    // Buscar el más próximo de cada categoría del club.
    const cats = ["Sénior", "Feminino", "Veteranos"];
    const selectedMatches: any[] = [];

    cats.forEach(cat => {
      const match = allUpcomingSantiso.find(m => categoriaKey(m.categoria || "") === categoriaKey(cat));
      if (match) selectedMatches.push(match);
    });

    // Si no hay 3 categorías con partido, rellena con otros próximos del Santiso.
    if (selectedMatches.length < 3) {
      allUpcomingSantiso.forEach(m => {
        if (selectedMatches.length < 3 && !selectedMatches.find(sm => sm.id === m.id)) {
          selectedMatches.push(m);
        }
      });
    }

    // 4. Ordenar los elegidos por fecha para que el cartel sea cronológico
    selectedMatches.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    // 5. Rellenar los 3 slots
    const newMatches = Array.from({ length: 3 }, () => ({
      rival: "", rivalEscudoUrl: "", fecha: "", hora: "18:00", categoria: "Sénior", santisoSide: "right"
    }));

    selectedMatches.forEach((match, index) => {
      const isSantisoLocal = isSantisoTeam(match.equipo_local);
      const rival = isSantisoLocal ? match.equipo_visitante : match.equipo_local;
      newMatches[index] = {
        rival: rival?.nombre || "",
        rivalEscudoUrl: rival?.escudo_url || "",
        fecha: match.fecha ? toDateInput(match.fecha) : "",
        hora: match.fecha ? toTimeInput(match.fecha) : "18:00",
        categoria: match.categoria || "Sénior",
        santisoSide: isSantisoLocal ? "left" : "right"
      };
    });

    set("matches", newMatches as any);
  };

  return (
    <>
      <div style={{ marginBottom: "1.5rem" }}>
        <button 
          onClick={handleAutoFill}
          className="btn-primary"
          style={{ width: "100%", background: "rgba(250, 204, 21, 0.1)", border: "1px dashed var(--primary)", color: "var(--primary)", padding: "0.8rem" }}
        >
          ⚡ Autocompletado inteligente (3 partidos)
        </button>
      </div>
      <SectionLabel>Configurar los 3 partidos</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {form.matches.map((m, i) => (
          <div key={i} style={{
            background: "rgba(255,255,255,0.02)",
            padding: "1rem",
            borderRadius: "0.6rem",
            border: "1px solid var(--border)"
          }}>
            <p style={{ margin: "0 0 0.8rem", fontSize: "0.75rem", fontWeight: 800, color: "var(--primary)" }}>PARTIDO {i + 1}</p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
              <div className="input-group">
                <label>Rival</label>
                <select 
                  value={m.rival}
                  onChange={e => {
                    const eq = equipos.find(ev => ev.nombre === e.target.value);
                    updateMatch(i, { rival: e.target.value, rivalEscudoUrl: eq?.escudo_url || "" });
                  }}
                >
                  <option value="">-- Seleccionar --</option>
                  {equipos
                    .filter(e => {
                      const dbCat = categoriaKey(e.categoria || "");
                      const stateCat = categoriaKey(m.categoria || "");
                      return dbCat === stateCat;
                    })
                    .map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label>Categoría</label>
                <select value={m.categoria} onChange={e => updateMatch(i, { 
                categoria: e.target.value,
                rival: "",
                rivalEscudoUrl: ""
              })}>
                  <option value="Sénior">Sénior</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Veteranos">Veteranos</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div className="input-group">
                <label>Fecha</label>
                <input type="date" value={m.fecha}
                  onChange={e => updateMatch(i, { fecha: e.target.value })} />
              </div>
              <div className="input-group">
                <label>Hora</label>
                <input type="time" value={m.hora || "18:00"}
                  onChange={e => updateMatch(i, { hora: e.target.value })} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.8rem", marginTop: "0.8rem" }}>
              <div className="input-group">
                <label>Localía</label>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <Toggle label="LOCAL" active={m.santisoSide === "left"} onClick={() => updateMatch(i, { santisoSide: "left" })} />
                  <Toggle label="VISIT." active={m.santisoSide === "right"} onClick={() => updateMatch(i, { santisoSide: "right" })} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
