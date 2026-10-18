/**
 * components/admin/cartel/FormNoso11.tsx
 * Form panel for the "O Noso 11" template.
 */

import React from "react";
import { Field, Select } from "@/components/ui/foundation/Fields";
import type { Player } from "@/lib/cartel/types";
import {
  SectionLabel,
  CategorySelector,
  ConPartidoElegido,
  Deslizador,
  MatchSelector,
  Toggle,
} from "./Common";
import type { SelectorMatch } from "./Common";
import { Button } from "@/components/ui/foundation/Button";
import styles from "./Formularios.module.css";
import { PlegableMovil } from "./PlegableMovil";
import type { FormState } from "./types";

interface CartelPlayerOption {
  id: string;
  nombre?: string | null;
  apodo?: string | null;
  dorsal?: number | null;
  categoria?: string | null;
  foto_url?: string | null;
}

interface Props {
  form: FormState;
  set: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
  jugadores: CartelPlayerOption[];
  jugFileName: string;
  handleJugadorFile: (file: File) => void;
  updatePlayer: (list: "titulares" | "suplentes", i: number, patch: Partial<Player>) => void;
  swapPlayers?: (list: "titulares" | "suplentes", a: number, b: number) => void;
  dbMatches: SelectorMatch[];
  loadMatchFromDb: (m: SelectorMatch) => void;
  tipo: string;
}

export const FormNoso11: React.FC<Props> = ({
  form,
  set,
  jugadores,
  jugFileName,
  handleJugadorFile,
  updatePlayer,
  swapPlayers,
  dbMatches,
  loadMatchFromDb,
  tipo,
}) => {
  const modoFoto = form.noso11FotoModo ?? "fondo";
  const getDisplayName = (j: CartelPlayerOption | undefined) => {
    if (!j) return "";
    if (j.apodo) return j.apodo;
    if (!j.nombre) return "";
    const parts = j.nombre.split(" ");
    return parts.length > 1 ? `${parts[0]} ${parts[1]}` : j.nombre;
  };

  const jugadoresCategoria = jugadores.filter((j) => j.categoria === form.categoria);

  const handleChangeJugadorText = (list: "titulares" | "suplentes", i: number, val: string) => {
    const matched = jugadoresCategoria.find(
      (j) => getDisplayName(j).toLowerCase() === val.toLowerCase(),
    );
    if (matched) {
      updatePlayer(list, i, { nome: val, dorsal: matched.dorsal?.toString() || "" });
    } else {
      updatePlayer(list, i, { nome: val });
    }
  };

  return (
    <>
      <ConPartidoElegido partidoId={form.partido_id} dbMatches={dbMatches} categoria={form.categoria} onSelect={loadMatchFromDb}>
      <MatchSelector
        dbMatches={dbMatches}
        onSelect={loadMatchFromDb}
        categoria={form.categoria}
        competicionId={form.competicion_id}
        tipo={tipo}
        santisoOnly
      />
      {/* Fecha y estadio llegan con el partido elegido: a mano, solo si hace falta. */}
      <PlegableMovil titulo="Editar datos a mano">
        <CategorySelector value={form.categoria} onChange={(v: string) => set("categoria", v)} />
        <div className={styles.pareja}>
          <Field
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => set("fecha", e.target.value)}
          />
          <Field
            label="Estadio"
            placeholder="Estadio Municipal de Santiso"
            value={form.estadio}
            onChange={(e) => set("estadio", e.target.value)}
          />
        </div>
      </PlegableMovil>
      </ConPartidoElegido>

      {/* A la vista y no dentro de «Foto y encuadre»: cualquier foto, no solo la guardada del
          jugador. La subida manda sobre la de la galería del partido. */}
      <div className={styles.campo}>
        <span className={styles.etiqueta}>Foto del cartel</span>
        <label className="file-input-label">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          {jugFileName ? `Cambiar foto (${jugFileName})` : "Subir la foto que quieras"}
          <input
            type="file"
            className="hidden-input"
            accept="image/*"
            onChange={(e) => {
              const fichero = e.target.files?.[0];
              e.target.value = "";
              if (fichero) handleJugadorFile(fichero);
            }}
          />
        </label>
      </div>

      <PlegableMovil titulo="Foto y encuadre">
        <Select
          label="Uso de la foto"
          value={modoFoto}
          onChange={(e) => set("noso11FotoModo", e.target.value as "retrato" | "fondo")}
        >
          <option value="fondo">Foto de campo · fondo completo</option>
          <option value="retrato">Retrato de jugador</option>
        </Select>
        {modoFoto === "retrato" && (
          <div className={styles.campo} role="group" aria-label="Disposición del cartel">
            <span className={styles.etiqueta}>Disposición del cartel</span>
            <div className={styles.interruptores}>
              <Toggle
                label="← Foto a la izquierda"
                active={!form.noso11Flip}
                onClick={() => set("noso11Flip", false)}
              />
              <Toggle
                label="Foto a la derecha →"
                active={!!form.noso11Flip}
                onClick={() => set("noso11Flip", true)}
              />
            </div>
          </div>
        )}

        {modoFoto === "retrato" && jugadoresCategoria.some((j) => j.foto_url) && (
          <Select
            label="Jugador de la plantilla"
            value={jugadoresCategoria.some((j) => j.foto_url === form.jugadorFotoUrl) ? form.jugadorFotoUrl : ""}
            onChange={(e) => {
              set("jugadorFotoUrl", e.target.value);
              set("jugadorXOffset", 0.5);
              set("jugadorYOffset", 0.2);
              set("jugadorZoom", 1);
            }}
          >
            <option value="">Elegir jugador…</option>
            {jugadoresCategoria.map((j) =>
              j.foto_url ? (
                <option key={j.id} value={j.foto_url}>
                  {getDisplayName(j)}
                </option>
              ) : null,
            )}
          </Select>
        )}

        <div className={styles.encuadre}>
          <h5>Encuadre de la foto</h5>
          <Deslizador
            label="Desplazamiento horizontal"
            min={0}
            max={1}
            step={0.01}
            value={form.jugadorXOffset}
            onChange={(v) => set("jugadorXOffset", v)}
            extremos={["Izquierda", "Derecha"]}
          />
          <Deslizador
            label="Desplazamiento vertical"
            min={0}
            max={1}
            step={0.01}
            value={form.jugadorYOffset}
            onChange={(v) => set("jugadorYOffset", v)}
            extremos={["Arriba", "Abajo"]}
          />
          <Deslizador
            label="Zoom"
            min={modoFoto === "fondo" ? 1 : 0.5}
            max={4}
            step={0.01}
            value={modoFoto === "fondo" ? Math.max(1, form.jugadorZoom) : form.jugadorZoom}
            onChange={(v) => set("jugadorZoom", v)}
            extremos={["Alejar", "Acercar"]}
          />
        </div>
      </PlegableMovil>
      <datalist id="jugadores-categoria-list">
        {jugadoresCategoria.map((j) => (
          <option key={j.id} value={getDisplayName(j)}>
            #{j.dorsal || "-"} {j.nombre}
          </option>
        ))}
      </datalist>

      <SectionLabel>Titulares (11)</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {form.titulares.map((p, i) => (
          <div
            key={p.id}
            style={{
              display: "grid",
              gridTemplateColumns: "55px 1fr auto auto",
              gap: "0.5rem",
              alignItems: "center",
            }}
            className={styles.filaTitulares}
          >
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="#"
              value={p.dorsal}
              onChange={(e) => updatePlayer("titulares", i, { dorsal: e.target.value })}
              style={{ textAlign: "center" }}
            />
            <input
              type="text"
              list="jugadores-categoria-list"
              placeholder="Nombre del jugador..."
              value={p.nome}
              onChange={(e) => handleChangeJugadorText("titulares", i, e.target.value)}
              style={{
                padding: "0.4rem",
                borderRadius: "0.4rem",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                color: "#fff",
                width: "100%",
              }}
            />
            <Button size="sm" variant={p.eCapitan ? "primary" : "secondary"}
 aria-pressed={p.eCapitan}
              title="Capitán"
              onClick={() => updatePlayer("titulares", i, { eCapitan: !p.eCapitan })}
              
            >
              C
            </Button>
            <div style={{ display: "flex", gap: "2px" }}>
              <Button size="sm" variant="secondary"
                title="Subir"
                disabled={i === 0}
                onClick={() => swapPlayers?.("titulares", i, i - 1)}
                
              >
                ▲
              </Button>
              <Button size="sm" variant="secondary"
                title="Bajar"
                disabled={i === form.titulares.length - 1}
                onClick={() => swapPlayers?.("titulares", i, i + 1)}
                
              >
                ▼
              </Button>
            </div>
          </div>
        ))}
      </div>

      <PlegableMovil titulo={`Suplentes (${form.suplentes.length})`}>
        <SectionLabel>Suplentes</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {form.suplentes.map((p, i) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "55px 1fr auto",
                gap: "0.5rem",
                alignItems: "center",
              }}
              className={styles.filaSuplentes}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="#"
                value={p.dorsal}
                onChange={(e) => updatePlayer("suplentes", i, { dorsal: e.target.value })}
                style={{ textAlign: "center" }}
              />
              <input
                type="text"
                list="jugadores-categoria-list"
                placeholder="Nombre del jugador..."
                value={p.nome}
                onChange={(e) => handleChangeJugadorText("suplentes", i, e.target.value)}
                style={{
                  padding: "0.4rem",
                  borderRadius: "0.4rem",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "#fff",
                  width: "100%",
                }}
              />
              <div style={{ display: "flex", gap: "2px" }}>
                <Button size="sm" variant="secondary"
                  title="Subir"
                  disabled={i === 0}
                  onClick={() => swapPlayers?.("suplentes", i, i - 1)}
                  
                >
                  ▲
                </Button>
                <Button size="sm" variant="secondary"
                  title="Bajar"
                  disabled={i === form.suplentes.length - 1}
                  onClick={() => swapPlayers?.("suplentes", i, i + 1)}
                  
                >
                  ▼
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PlegableMovil>
    </>
  );
};
