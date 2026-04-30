"use client";
import { Fragment, useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase-browser";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";
import BusyBanner from "./BusyBanner";
import {
  competitionsForCategory,
  pickDefaultCompetitionId,
  type CompetenciaRow,
} from "@/lib/competition";
import { fetchCompeticiones } from "@/lib/supabase-queries";

interface AdminEquiposProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

interface Equipo {
  id: string;
  nombre: string;
  escudo_url: string;
  categoria: string;
}

interface EquipoCompeticion {
  equipo_id: string;
}

export default function AdminEquipos({
  showToast,
  showConfirm,
  categoria,
}: AdminEquiposProps) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [allCategoryTeams, setAllCategoryTeams] = useState<Equipo[]>([]);
  const [competicionesCatalog, setCompeticionesCatalog] = useState<
    CompetenciaRow[]
  >([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedExistingId, setSelectedExistingId] = useState("");

  const [nombreEquipo, setNombreEquipo] = useState("");
  const [escudoEquipo, setEscudoEquipo] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [relationEnabled, setRelationEnabled] = useState(true);

  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando equipos...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchCompeticiones();
      if (!cancelled) setCompeticionesCatalog(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (competicionesCatalog.length === 0) return;
    const def = pickDefaultCompetitionId(competicionesCatalog, categoria);
    setSelectedCompetitionId((prev) => {
      const opts = competitionsForCategory(competicionesCatalog, categoria);
      if (prev && opts.some((o) => o.id === prev)) return prev;
      return def;
    });
  }, [categoria, competicionesCatalog]);

  const competicionesEnCategoria = useMemo(
    () => competitionsForCategory(competicionesCatalog, categoria),
    [competicionesCatalog, categoria],
  );

  const selectedCompeticionNombre = useMemo(
    () =>
      competicionesCatalog.find((c) => c.id === selectedCompetitionId)?.nombre ??
      "",
    [competicionesCatalog, selectedCompetitionId],
  );

  useEffect(() => {
    if (!selectedCompetitionId) return;
    fetchEquipos();
  }, [categoria, selectedCompetitionId]);
  async function fetchAllTeams() {
    const { data } = await supabase
      .from("equipos")
      .select("*")
      .order("nombre", { ascending: true });
    const teams = (data || []) as Equipo[];
    setAllCategoryTeams(teams);
    return teams;
  }

  async function fetchEquipos() {
    setIsFetching(true);
    const teams = await fetchAllTeams();

    const { data: relData, error: relError } = await supabase
      .from("equipo_competiciones")
      .select("equipo_id")
      .eq("categoria", categoria)
      .eq("competicion_id", selectedCompetitionId);

    if (relError) {
      setRelationEnabled(false);
      setEquipos(teams);
      setSelectedExistingId("");
      setIsFetching(false);
      return;
    }

    setRelationEnabled(true);
    const rels = (relData || []) as EquipoCompeticion[];
    const ids = new Set(rels.map((r) => r.equipo_id));
    setEquipos(teams.filter((t) => ids.has(t.id)));
    setSelectedExistingId("");
    setIsFetching(false);
  }

  const resetForm = () => {
    setNombreEquipo("");
    setEscudoEquipo(null);
    setEditingId(null);
  };

  const startEdit = (equipo: Equipo) => {
    setNombreEquipo(equipo.nombre);
    setEditingId(equipo.id);
  };

  const availableTeams = allCategoryTeams.filter(
    (t) => !equipos.some((e) => e.id === t.id),
  );

  async function ensureTeamInLeague(teamId: string) {
    if (!relationEnabled || !selectedCompetitionId) return;
    const { error } = await supabase
      .from("equipo_competiciones")
      .upsert(
        [{ equipo_id: teamId, categoria, competicion_id: selectedCompetitionId }],
        {
          onConflict: "equipo_id,competicion_id",
        },
      );
    if (error) throw error;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreEquipo) return;
    setBusyText(
      editingId ? "Guardando cambios equipo..." : "Creando equipo...",
    );
    setBusyProgress(5);
    setLoading(true);

    try {
      let url = "";

      if (editingId) {
        const current = equipos.find((eq) => eq.id === editingId);
        url = current?.escudo_url || "";
      }

      if (escudoEquipo) {
        const processed = await processAndUploadImage(
          escudoEquipo,
          (percent) => {
            setBusyText("Procesando escudo...");
            setBusyProgress(percent * 0.6);
          },
        );
        if (processed) {
          setBusyText("Subiendo escudo...");
          setBusyProgress(75);
          const fileName = `escudos/${uuidv4()}.webp`;
          const { data } = await supabase.storage
            .from("fotos")
            .upload(fileName, processed);
          if (data) {
            setBusyText("Guardando datos equipo...");
            setBusyProgress(90);
            const { data: pUrl } = supabase.storage
              .from("fotos")
              .getPublicUrl(fileName);
            url = pUrl.publicUrl;
          }
        }
      }

      if (editingId) {
        const { error } = await supabase
          .from("equipos")
          .update({ nombre: nombreEquipo, escudo_url: url })
          .eq("id", editingId);

        if (!error) {
          await ensureTeamInLeague(editingId);
          showToast("Equipo actualizado");
          resetForm();
          fetchEquipos();
        }
      } else {
        const { data: inserted, error } = await supabase
          .from("equipos")
          .insert([
            {
              nombre: nombreEquipo,
              escudo_url: url,
              categoria,
            },
          ])
          .select("id")
          .single();

        if (!error) {
          if (inserted?.id) await ensureTeamInLeague(inserted.id);
          showToast("Equipo añadido");
          resetForm();
          fetchEquipos();
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Error en operación", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleAddExistingTeam() {
    if (!selectedExistingId) return;
    setBusyText("Añadiendo equipo existente...");
    setBusyProgress(70);
    setLoading(true);
    try {
      await ensureTeamInLeague(selectedExistingId);
      showToast("Equipo añadido a liga");
      setSelectedExistingId("");
      fetchEquipos();
    } catch (err) {
      console.error(err);
      showToast("Error añadiendo equipo", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleDeleteEquipo(id: string) {
    showConfirm(
      relationEnabled
        ? "¿Quitar equipo de esta liga?"
        : "¿Borrar equipo de librería?",
      async () => {
        if (relationEnabled) {
          await supabase
            .from("equipo_competiciones")
            .delete()
            .eq("equipo_id", id)
            .eq("categoria", categoria)
            .eq("competicion_id", selectedCompetitionId);
          showToast("Equipo quitado de liga");
        } else {
          await supabase.from("equipos").delete().eq("id", id);
          showToast("Equipo eliminado");
        }
        fetchEquipos();
      },
    );
  }

  async function handleUpdateEscudo(id: string, file: File) {
    setBusyText("Procesando y subiendo escudo...");
    setBusyProgress(5);
    setLoading(true);
    try {
      const processed = await processAndUploadImage(file, (percent) => {
        setBusyText("Procesando escudo...");
        setBusyProgress(percent * 0.6);
      });
      if (!processed) {
        showToast("No se pudo procesar imagen", "error");
        return;
      }

      setBusyText("Subiendo escudo...");
      setBusyProgress(75);
      const fileName = `escudos/${uuidv4()}.webp`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(fileName, processed);
      if (uploadError || !uploadData) {
        showToast("Error subiendo escudo", "error");
        return;
      }

      const { data: pUrl } = supabase.storage
        .from("fotos")
        .getPublicUrl(fileName);
      setBusyText("Guardando escudo...");
      setBusyProgress(90);
      const { error: dbError } = await supabase
        .from("equipos")
        .update({ escudo_url: pUrl.publicUrl })
        .eq("id", id);
      if (dbError) {
        showToast("Error guardando escudo", "error");
        return;
      }

      showToast("Escudo actualizado");
      fetchEquipos();
    } catch (err) {
      console.error(err);
      showToast("Error actualizando escudo", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  function renderEquipoForm() {
    return (
      <form
        onSubmit={handleSubmit}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div className="form-grid-3">
          <div className="input-group">
            <label>Nombre del Equipo</label>
            <input
              type="text"
              placeholder="Ej: Racing de Ferrol"
              value={nombreEquipo}
              onChange={(e) => setNombreEquipo(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Escudo {editingId ? "(Opcional)" : ""}</label>
            <div className="file-input-group">
              <label className="file-input-label">
                {escudoEquipo
                  ? escudoEquipo.name.substring(0, 15) + "..."
                  : editingId
                    ? "Cambiar Escudo"
                    : "Elegir Escudo"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setEscudoEquipo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.8rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ flex: "1 1 160px" }}
            >
              {loading
                ? "Procesando..."
                : editingId
                  ? "Guardar Cambios"
                  : "Añadir Equipo"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="card glass">
      <BusyBanner
        show={loading || isFetching}
        text={isFetching ? "Cargando equipos..." : busyText}
        progress={loading ? busyProgress : undefined}
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h3>Librería de Equipos ({categoria})</h3>
          <p style={{ color: "#a3a3a3", fontSize: "0.85rem" }}>
            Gestiona clubes por competición. Reutiliza equipos existentes sin
            duplicar.
          </p>
        </div>
        {editingId && (
          <button
            onClick={resetForm}
            className="btn-delete"
            style={{ padding: "0.4rem 1rem" }}
          >
            Cancelar Edición
          </button>
        )}
      </div>

      <div className="input-group" style={{ marginBottom: "1rem" }}>
        <label>Liga / Competición</label>
        <select
          value={selectedCompetitionId}
          onChange={(e) => setSelectedCompetitionId(e.target.value)}
          disabled={loading || isFetching}
        >
          {competicionesEnCategoria.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.nombre}
            </option>
          ))}
        </select>
      </div>

      {relationEnabled && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 220px",
            gap: "0.8rem",
            marginBottom: "1.2rem",
          }}
        >
          <div className="input-group">
            <label>Añadir desde equipos ya existentes</label>
            <select
              value={selectedExistingId}
              onChange={(e) => setSelectedExistingId(e.target.value)}
              disabled={loading}
            >
              <option value="">Seleccionar equipo de la base de datos...</option>
              {availableTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} {t.categoria ? `(${t.categoria})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: "100%" }}
              onClick={handleAddExistingTeam}
              disabled={loading || !selectedExistingId}
            >
              Añadir a liga
            </button>
          </div>
        </div>
      )}

      {!relationEnabled && (
        <p
          style={{ color: "#f59e0b", fontSize: "0.8rem", marginBottom: "1rem" }}
        >
          Tabla `equipo_competiciones` no existe. Modo clásico activo por
          categoría.
        </p>
      )}

      {relationEnabled && !editingId && (
        <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0' }}>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'solid', borderBottom: 'none' }} />
          <span style={{ padding: '0 1rem', color: '#666', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>o crear nuevo</span>
          <hr style={{ flex: 1, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'solid', borderBottom: 'none' }} />
        </div>
      )}

      {!editingId && (
      <form
        onSubmit={handleSubmit}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div className="form-grid-3">
          <div className="input-group">
            <label>Nombre del Equipo</label>
            <input
              type="text"
              placeholder="Ej: Racing de Ferrol"
              value={nombreEquipo}
              onChange={(e) => setNombreEquipo(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Escudo {editingId ? "(Opcional)" : ""}</label>
            <div className="file-input-group">
              <label className="file-input-label">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                {escudoEquipo
                  ? escudoEquipo.name.substring(0, 15) + "..."
                  : editingId
                    ? "Cambiar Escudo"
                    : "Elegir Escudo"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setEscudoEquipo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading
                ? "Procesando..."
                : editingId
                  ? "Guardar Cambios"
                  : "Añadir Equipo"}
            </button>
          </div>
        </div>
      </form>
      )}

      <div style={{ marginTop: "2.5rem" }}>
        <h4
          style={{
            marginBottom: "1rem",
            fontSize: "0.9rem",
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          Equipos en {selectedCompeticionNombre || "..."}
        </h4>
        <div
          className="equipos-list"
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          {equipos.map((e) => (
            <Fragment key={e.id}>
            <div
              className="admin-item glass shadow-sm"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1.2rem",
                border:
                  editingId === e.id
                    ? "1px solid var(--primary)"
                    : "1px solid rgba(255,255,255,0.05)",
                borderRadius: "12px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "36px",
                    height: "36px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {e.escudo_url ? (
                      <img
                        src={e.escudo_url}
                        alt={e.nombre}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "0.5rem" }}>Logo</span>
                    )}
                  </div>
                  <label
                    style={{
                      position: "absolute",
                      bottom: "-6px",
                      right: "-6px",
                      background: "var(--primary)",
                      color: "#000",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: loading ? "not-allowed" : "pointer",
                      border: "2px solid #000",
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <input
                      type="file"
                      className="hidden-input"
                      accept="image/*"
                      disabled={loading}
                      onChange={(ev) => {
                        const f = ev.target.files?.[0];
                        if (f) handleUpdateEscudo(e.id, f);
                        ev.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <span
                  style={{ fontSize: "1rem", fontWeight: 800, color: "white" }}
                >
                  {e.nombre}
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  disabled={loading}
                  onClick={() => startEdit(e)}
                  className="btn-edit btn-action"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Editar
                </button>
                <button
                  disabled={loading}
                  onClick={() => handleDeleteEquipo(e.id)}
                  className="btn-delete btn-action"
                >
                  {relationEnabled ? "Quitar" : "Borrar"}
                </button>
              </div>
            </div>
            {editingId === e.id && (
              <div style={{ margin: "0.2rem 0 1rem" }}>
                {renderEquipoForm()}
              </div>
            )}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
