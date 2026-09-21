"use client";

import { useEffect, useMemo, useState } from "react";
import type { CalendarioLeido } from "@/lib/server/acciones/calendario-pdf";
import { guardarCalendario, leerCalendarioPdf } from "@/lib/server/acciones/calendario-pdf";
import { useCompeticiones } from "@/lib/useCompeticiones";
import AvisoError from "./AvisoError";
import BusyBanner from "./BusyBanner";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const CATEGORIAS = ["Senior", "Femenino", "Veteranos"];

export default function AdminCalendarioPdf({ showToast, showConfirm }: Props) {
  const [categoria, setCategoria] = useState("Senior");
  const {
    competicionesEnCategoria,
    selectedCompetitionId,
    setSelectedCompetitionId,
    errorCompeticiones,
  } = useCompeticiones(categoria);

  const [file, setFile] = useState<File | null>(null);
  const [leido, setLeido] = useState<CalendarioLeido | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState("");

  // Cambiar de competición invalida el plan: se calculó contra la anterior.
  useEffect(() => {
    setLeido(null);
  }, [selectedCompetitionId]);

  const porJornada = useMemo(() => {
    if (!leido) return [];
    const mapa = new Map<number, typeof leido.plan.cruces>();
    for (const cruce of leido.plan.cruces) {
      const lista = mapa.get(cruce.jornada) ?? [];
      lista.push(cruce);
      mapa.set(cruce.jornada, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0] - b[0]);
  }, [leido]);

  async function leer() {
    if (!file) {
      showToast("Elige el PDF del calendario.", "error");
      return;
    }
    if (!selectedCompetitionId) {
      showToast("Elige la competición de destino.", "error");
      return;
    }

    setBusy(true);
    setBusyText("Leyendo el calendario...");
    try {
      const formulario = new FormData();
      formulario.append("calendario", file);
      formulario.append("competicionId", selectedCompetitionId);
      const resultado = await leerCalendarioPdf(formulario);
      if (!resultado.ok) {
        showToast(resultado.error, "error");
        setLeido(null);
        return;
      }
      setLeido(resultado.datos);
      showToast("Calendario leído. Revisa el plan antes de aplicarlo.");
    } finally {
      setBusy(false);
    }
  }

  function aplicar() {
    if (!leido || !selectedCompetitionId) return;
    const { resumen } = leido.plan;
    showConfirm(
      `Se crearán ${resumen.jornadasNuevas} jornada(s) y ${resumen.crucesNuevos} partido(s). ` +
        `Lo que ya existe no se toca. ¿Continuar?`,
      async () => {
        setBusy(true);
        setBusyText("Guardando el calendario...");
        try {
          const resultado = await guardarCalendario({
            competicionId: selectedCompetitionId,
            plan: leido.plan,
          });
          if (!resultado.ok) {
            showToast(resultado.error, "error");
            return;
          }
          showToast(
            `Creadas ${resultado.datos.jornadas} jornada(s) y ${resultado.datos.partidos} partido(s).`,
          );
          // Releer para que el plan refleje lo que acaba de escribirse.
          await leer();
        } finally {
          setBusy(false);
        }
      },
    );
  }

  const resumen = leido?.plan.resumen;
  const nadaQueHacer =
    resumen !== undefined && resumen.jornadasNuevas === 0 && resumen.crucesNuevos === 0;

  return (
    <div>
      <BusyBanner show={busy} text={busyText} />

      <div className="input-group">
        <label htmlFor="cal-categoria">Categoría</label>
        <select
          id="cal-categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          disabled={busy}
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="cal-competicion">Competición de destino</label>
        <AvisoError mensaje={errorCompeticiones} />
        <select
          id="cal-competicion"
          value={selectedCompetitionId}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
          disabled={busy}
        >
          <option value="">Elige una competición</option>
          {competicionesEnCategoria.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="input-group">
        <label htmlFor="cal-file">PDF del calendario</label>
        <input
          id="cal-file"
          type="file"
          accept="application/pdf"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setLeido(null);
          }}
        />
      </div>

      <button
        className="btn-primary"
        onClick={leer}
        disabled={busy || !file || !selectedCompetitionId}
      >
        Leer calendario (sin IA)
      </button>

      {leido && resumen && (
        <section style={{ marginTop: "2rem" }}>
          <h4 style={{ margin: "0 0 0.25rem" }}>{leido.competicion}</h4>
          <p style={{ margin: "0 0 1rem", color: "#888", fontSize: "0.8rem" }}>
            Temporada {leido.temporada}
          </p>

          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            <Dato valor={resumen.jornadasNuevas} etiqueta="jornadas nuevas" />
            <Dato valor={resumen.crucesNuevos} etiqueta="partidos nuevos" color="#4ade80" />
            <Dato valor={resumen.crucesExistentes} etiqueta="ya estaban" color="#888" />
            <Dato
              valor={resumen.crucesSinEquipo}
              etiqueta="sin equipo"
              color={resumen.crucesSinEquipo > 0 ? "#f87171" : "#888"}
            />
          </div>

          {leido.plan.sinResolver.length > 0 && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--radius-sm)",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.22)",
                color: "#f59e0b",
                fontSize: "0.8rem",
              }}
            >
              <p style={{ margin: 0 }}>
                Estos nombres del PDF no corresponden a ningún equipo de la competición. Sus
                partidos no se crearán. Dalos de alta en «Equipos» y vuelve a leer el PDF:
              </p>
              <p style={{ margin: "0.4rem 0 0", fontWeight: 700 }}>
                {leido.plan.sinResolver.join(" · ")}
              </p>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={aplicar}
            disabled={busy || nadaQueHacer}
            style={{ marginBottom: "1.5rem" }}
          >
            {nadaQueHacer ? "Nada que crear" : "Crear jornadas y partidos"}
          </button>

          <div style={{ maxHeight: "22rem", overflowY: "auto" }}>
            {porJornada.map(([numero, cruces]) => (
              <div key={numero} style={{ marginBottom: "0.75rem" }}>
                <p
                  style={{
                    margin: "0 0 0.25rem",
                    color: "#facc15",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Jornada {numero}
                </p>
                {cruces.map((cruce, indice) => (
                  <p
                    key={`${numero}-${indice}`}
                    style={{
                      margin: 0,
                      fontSize: "0.8rem",
                      color:
                        cruce.estado === "nuevo"
                          ? "#e5e5e5"
                          : cruce.estado === "existe"
                            ? "#666"
                            : "#f87171",
                    }}
                  >
                    {cruce.estado === "nuevo" ? "+" : cruce.estado === "existe" ? "=" : "!"}{" "}
                    {cruce.localNombre} vs {cruce.visitanteNombre}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Dato({
  valor,
  etiqueta,
  color = "#facc15",
}: {
  valor: number;
  etiqueta: string;
  color?: string;
}) {
  return (
    <div>
      <p style={{ margin: 0, color, fontSize: "1.6rem", fontWeight: 900, lineHeight: 1 }}>
        {valor}
      </p>
      <p style={{ margin: 0, color: "#888", fontSize: "0.72rem" }}>{etiqueta}</p>
    </div>
  );
}
