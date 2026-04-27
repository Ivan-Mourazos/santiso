"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";
import BusyBanner from "./BusyBanner";

interface AdminPlayersProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

interface Jugador {
  id: string;
  nombre: string;
  apodo?: string | null;
  dorsal?: number | string | null;
  posicion?: string | null;
  foto_url?: string | null;
  capitan?: number | null;
}

export default function AdminPlayers({
  showToast,
  showConfirm,
  categoria,
}: AdminPlayersProps) {
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [posicion, setPosicion] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando jugadores...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(
    undefined,
  );

  function resetForm() {
    setNombre("");
    setApodo("");
    setDorsal("");
    setPosicion("");
    setFotoFile(null);
    setEditingId(null);
  }

  function startEditJugador(jugador: Jugador) {
    setNombre(jugador.nombre || "");
    setApodo(jugador.apodo || "");
    setDorsal(jugador.dorsal?.toString() || "");
    setPosicion(jugador.posicion || "");
    setFotoFile(null);
    setEditingId(jugador.id);
  }

  const fetchJugadores = useCallback(async () => {
    await Promise.resolve();
    setIsFetching(true);
    const { data } = await supabase
      .from("jugadores")
      .select("*")
      .eq("categoria", categoria)
      .order("dorsal", { ascending: true });
    setJugadores((data ?? []) as Jugador[]);
    setIsFetching(false);
  }, [categoria]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchJugadores();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchJugadores]);

  async function handleSubmitJugador(e: React.FormEvent) {
    e.preventDefault();
    setBusyText(editingId ? "Guardando cambios jugador..." : "Procesando foto y guardando jugador...");
    setBusyProgress(5);
    setLoading(true);

    let foto_url = "";
    if (editingId) {
      const current = jugadores.find((j) => j.id === editingId);
      foto_url = current?.foto_url || "";
    }

    if (fotoFile) {
      const processed = await processAndUploadImage(fotoFile, (percent) => {
        setBusyText("Procesando foto...");
        setBusyProgress(percent * 0.6);
      });
      if (processed) {
        setBusyText("Subiendo foto...");
        setBusyProgress(75);
        const fileName = `jugadores/${uuidv4()}.webp`;
        const { data, error: uploadError } = await supabase.storage
          .from("fotos")
          .upload(fileName, processed);
        if (uploadError) throw uploadError;
        if (data) {
          setBusyText("Guardando jugador...");
          setBusyProgress(90);
          const { data: pUrl } = supabase.storage
            .from("fotos")
            .getPublicUrl(fileName);
          foto_url = pUrl.publicUrl;
        }
      }
    }

    const payload = {
      nombre,
      apodo,
      dorsal: parseInt(dorsal),
      posicion,
      foto_url,
      categoria,
    };

    const { error } = editingId
      ? await supabase.from("jugadores").update(payload).eq("id", editingId)
      : await supabase.from("jugadores").insert([payload]);

    if (!error) {
      resetForm();
      fetchJugadores();
      showToast(editingId ? "Jugador actualizado correctamente" : "Jugador añadido correctamente");
    }
    setLoading(false);
    setBusyProgress(undefined);
  }

  async function handleUpdateFoto(id: string, file: File) {
    setBusyText("Procesando y subiendo foto...");
    setBusyProgress(5);
    setLoading(true);
    const processed = await processAndUploadImage(file, (percent) => {
      setBusyText("Procesando foto...");
      setBusyProgress(percent * 0.6);
    });
    if (processed) {
      setBusyText("Subiendo foto...");
      setBusyProgress(75);
      const fileName = `jugadores/${uuidv4()}.webp`;
      const { data, error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(fileName, processed);

      if (uploadError) {
        showToast("Error subiendo foto", "error");
      } else if (data) {
        setBusyText("Guardando foto...");
        setBusyProgress(90);
        const { data: pUrl } = supabase.storage
          .from("fotos")
          .getPublicUrl(fileName);
        const { error: dbError } = await supabase
          .from("jugadores")
          .update({ foto_url: pUrl.publicUrl })
          .eq("id", id);

        if (!dbError) {
          showToast("Foto actualizada");
          fetchJugadores();
        }
      }
    }
    setLoading(false);
    setBusyProgress(undefined);
  }

  async function handleDeleteJugador(id: string) {
    showConfirm("¿Borrar jugador?", async () => {
      await supabase.from("jugadores").delete().eq("id", id);
      fetchJugadores();
      showToast("Jugador eliminado");
    });
  }

  function renderJugadorForm() {
    return (
      <form
        onSubmit={handleSubmitJugador}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div
          className="form-grid-5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="input-group">
            <label>Nombre Completo</label>
            <input
              type="text"
              placeholder="Ej: Iván Sánchez Vázquez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Apodo</label>
            <input
              type="text"
              placeholder="Ej: Mourazos"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Dorsal</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="10"
              value={dorsal}
              onChange={(e) => setDorsal(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Posición</label>
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              required
            >
              <option value="">Selección...</option>
              <option value="POR">POR (Portero)</option>
              <option value="LD">LD (Lateral Derecho)</option>
              <option value="LI">LI (Lateral Izquierdo)</option>
              <option value="DFC">DFC (Defensa Central)</option>
              <option value="MCD">M. Centro Defensivo</option>
              <option value="MC">Medio Centro</option>
              <option value="MI">Medio Izquierdo</option>
              <option value="MD">Medio Derecho</option>
              <option value="MCO">M. Centro Ofensivo</option>
              <option value="EI">Extremo Izquierdo</option>
              <option value="ED">Extremo Derecho</option>
              <option value="DC">Delantero Centro</option>
            </select>
          </div>
          <div className="input-group">
            <label>Foto {editingId ? "(Opcional)" : ""}</label>
            <div className="file-input-group">
              <label className="file-input-label">
                {fotoFile
                  ? fotoFile.name.substring(0, 10) + "..."
                  : editingId
                    ? "Cambiar Foto"
                    : "Subir Foto"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ padding: "0.8rem 2rem" }}
          >
            {loading
              ? "Procesando..."
              : editingId
                ? "Guardar cambios"
                : "Añadir Jugador"}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancelar edición
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="card glass">
      <BusyBanner
        show={loading || isFetching}
        text={isFetching ? "Cargando jugadores..." : busyText}
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
          <h3>Plantilla {categoria}</h3>
          <p style={{ color: "#a3a3a3", fontSize: "0.85rem", margin: 0 }}>
            Gestiona jugadores, motes, dorsales, posiciones y fotos.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="btn-delete"
            style={{ padding: "0.4rem 1rem" }}
          >
            Cancelar edición
          </button>
        )}
      </div>

      {!editingId && (
      <form
        onSubmit={handleSubmitJugador}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div
          className="form-grid-5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div className="input-group">
            <label>Nombre Completo</label>
            <input
              type="text"
              placeholder="Ej: Iván Sánchez Vázquez"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Apodo</label>
            <input
              type="text"
              placeholder="Ej: Mourazos"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>Dorsal</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="10"
              value={dorsal}
              onChange={(e) => setDorsal(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Posición</label>
            <select
              value={posicion}
              onChange={(e) => setPosicion(e.target.value)}
              required
            >
              <option value="">Selección...</option>
              <option value="POR">POR (Portero)</option>
              <option value="LD">LD (Lateral Derecho)</option>
              <option value="LI">LI (Lateral Izquierdo)</option>
              <option value="DFC">DFC (Defensa Central)</option>
              <option value="MCD">MCD (M. Centro Defensivo)</option>
              <option value="MC">MC (Medio Centro)</option>
              <option value="MI">MI (Medio Izquierdo)</option>
              <option value="MD">MD (Medio Derecho)</option>
              <option value="MCO">MCO (M. Centro Ofensivo)</option>
              <option value="EI">EI (Extremo Izquierdo)</option>
              <option value="ED">ED (Extremo Derecho)</option>
              <option value="DC">DC (Delantero Centro)</option>
            </select>
          </div>
          <div className="input-group">
            <label>Foto {editingId ? "(Opcional)" : ""}</label>
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
                {fotoFile
                  ? fotoFile.name.substring(0, 10) + "..."
                  : editingId
                    ? "Cambiar Foto"
                    : "Subir Foto"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ padding: "0.8rem 2rem" }}
        >
          {loading
            ? "Procesando..."
            : editingId
              ? "Guardar cambios"
              : "Añadir Jugador"}
        </button>
      </form>
      )}

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Dorsal</th>
              <th>Nombre</th>
              <th>Apodo</th>
              <th>Posición</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {jugadores.map((j) => (
              <Fragment key={j.id}>
              <tr>
                <td>
                  <div
                    style={{
                      position: "relative",
                      width: "45px",
                      height: "45px",
                    }}
                  >
                    {j.foto_url ? (
                      <img
                        src={j.foto_url}
                        alt={j.nombre}
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "#1a1a1a",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#444",
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                    <label
                      style={{
                        position: "absolute",
                        bottom: "-5px",
                        right: "-5px",
                        background: "var(--primary)",
                        color: "black",
                        borderRadius: "50%",
                        width: "22px",
                        height: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: loading ? "not-allowed" : "pointer",
                        border: "2px solid #000",
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <input
                        disabled={loading}
                        type="file"
                        className="hidden-input"
                        accept="image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpdateFoto(j.id, f);
                        }}
                      />
                    </label>
                  </div>
                </td>
                <td style={{ fontWeight: 900, color: "var(--primary)" }}>
                  #{j.dorsal}
                </td>
                <td style={{ fontWeight: 700 }}>
                  {j.nombre}
                  {(j.capitan ?? 0) > 0 && (
                    <span
                      className="badge-capitan"
                      title={`Capitán ${j.capitan}`}
                      style={{
                        marginLeft: "8px",
                        fontSize: "0.8rem",
                        backgroundColor: "#ffd700",
                        color: "#000",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontWeight: "bold",
                      }}
                    >
                      C{j.capitan}
                    </span>
                  )}
                </td>
                <td
                  style={{
                    fontStyle: "italic",
                    color: "var(--text-secondary)",
                  }}
                >
                  {j.apodo || "-"}
                </td>
                <td>
                  <span className="badge-posicion">{j.posicion}</span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      disabled={loading}
                      onClick={() => startEditJugador(j)}
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
                      onClick={() => handleDeleteJugador(j.id)}
                      className="btn-delete btn-action"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
              {editingId === j.id && (
                <tr>
                  <td colSpan={6}>
                    <div style={{ margin: "0.4rem 0 1rem" }}>
                      {renderJugadorForm()}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
