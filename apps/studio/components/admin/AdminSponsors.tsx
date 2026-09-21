"use client";
import { Fragment, useState, useEffect } from "react";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  borrarPatrocinador,
  cargarPatrocinadores,
  guardarPatrocinador,
} from "@/lib/server/acciones/patrocinadores";
import { useUnsavedChanges } from "@/components/studio/StudioContext";
import BusyBanner from "./BusyBanner";

interface AdminSponsorsProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

interface Sponsor {
  id: string;
  nombre: string;
  logo_url?: string | null;
  web_url?: string | null;
}

export default function AdminSponsors({
  showToast,
  showConfirm,
}: AdminSponsorsProps) {
  const [patrocinadores, setPatrocinadores] = useState<Sponsor[]>([]);
  const [nombreSponsor, setNombreSponsor] = useState("");
  const [logoSponsor, setLogoSponsor] = useState<File | null>(null);
  const [webSponsor, setWebSponsor] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando patrocinadores...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(
    undefined,
  );

  const [originalSponsor, setOriginalSponsor] = useState<Sponsor | null>(null);

  useUnsavedChanges(
    nombreSponsor !== (originalSponsor?.nombre || "") ||
      webSponsor !== (originalSponsor?.web_url || "") ||
      logoSponsor !== null,
  );

  useEffect(() => {
    fetchPatrocinadores();
  }, []);

  async function fetchPatrocinadores() {
    setIsFetching(true);
    setPatrocinadores((await cargarPatrocinadores()) as Sponsor[]);
    setIsFetching(false);
  }

  function resetForm() {
    setNombreSponsor("");
    setLogoSponsor(null);
    setWebSponsor("");
    setEditingId(null);
    setOriginalSponsor(null);
  }

  function startEditSponsor(sponsor: Sponsor) {
    setNombreSponsor(sponsor.nombre || "");
    setWebSponsor(sponsor.web_url || "");
    setLogoSponsor(null);
    setEditingId(sponsor.id);
    setOriginalSponsor(sponsor);
  }

  async function handleSubmitSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreSponsor || (!editingId && !logoSponsor)) return;
    setBusyText(editingId ? "Guardando cambios patrocinador..." : "Procesando logo y creando patrocinador...");
    setBusyProgress(5);
    setLoading(true);

    try {
      const cuerpo = new FormData();
      cuerpo.set("id", editingId ?? "");
      cuerpo.set("nombre", nombreSponsor);
      cuerpo.set("webUrl", webSponsor);
      if (logoSponsor) {
        setBusyText("Preparando logo...");
        setBusyProgress(40);
        cuerpo.set("logo", await prepararImagen(logoSponsor));
      }

      setBusyText("Guardando patrocinador...");
      setBusyProgress(80);
      const resultado = await guardarPatrocinador(cuerpo);

      if (resultado.ok) {
        resetForm();
        fetchPatrocinadores();
        showToast(editingId ? "Patrocinador actualizado correctamente" : "Patrocinador añadido correctamente");
      } else {
        showToast(resultado.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al añadir patrocinador", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleDeleteSponsor(id: string) {
    showConfirm("¿Borrar este patrocinador?", async () => {
      const resultado = await borrarPatrocinador(id);
      if (resultado.ok) {
        fetchPatrocinadores();
        showToast("Patrocinador eliminado");
      } else {
        showToast(resultado.error, "error");
      }
    });
  }

  function renderSponsorForm() {
    return (
      <form
        onSubmit={handleSubmitSponsor}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div className="form-grid-4">
          <div className="input-group">
            <label>Nombre Empresa</label>
            <input
              type="text"
              placeholder="Ej: Talleres Santiso"
              value={nombreSponsor}
              onChange={(e) => setNombreSponsor(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Logo (Auto-1:1) {editingId ? "(Opcional)" : ""}</label>
            <div className="file-input-group">
              <label className="file-input-label">
                {logoSponsor
                  ? logoSponsor.name.substring(0, 10) + "..."
                  : editingId
                    ? "Cambiar Logo"
                    : "Subir Logo"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setLogoSponsor(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <div className="input-group">
            <label>Enlace Web/IG (Opcional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={webSponsor}
              onChange={(e) => setWebSponsor(e.target.value)}
            />
          </div>
          <div
            className="input-group"
            style={{ flexDirection: "row", alignItems: "end", gap: "0.8rem" }}
          >
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? "Procesando..."
                : editingId
                  ? "Guardar cambios"
                  : "Añadir Sponsor"}
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
        text={isFetching ? "Cargando patrocinadores..." : busyText}
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
          <h3>Gestión de Patrocinadores</h3>
          <p style={{ color: "#a3a3a3", fontSize: "0.85rem", margin: 0 }}>
            Edita nombre, enlace y logo manteniendo el estilo del panel.
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
        onSubmit={handleSubmitSponsor}
        className="admin-form"
        style={{
          background: editingId ? "rgba(250, 204, 21, 0.05)" : "",
          padding: editingId ? "1.5rem" : "",
          borderRadius: "1rem",
          transition: "all 0.3s",
        }}
      >
        <div className="form-grid-4">
          <div className="input-group">
            <label>Nombre Empresa</label>
            <input
              type="text"
              placeholder="Ej: Talleres Santiso"
              value={nombreSponsor}
              onChange={(e) => setNombreSponsor(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Logo (Auto-1:1) {editingId ? "(Opcional)" : ""}</label>
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
                {logoSponsor
                  ? logoSponsor.name.substring(0, 10) + "..."
                  : editingId
                    ? "Cambiar Logo"
                    : "Subir Logo"}
                <input
                  type="file"
                  className="hidden-input"
                  accept="image/*"
                  onChange={(e) => setLogoSponsor(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
          <div className="input-group">
            <label>Enlace Web/IG (Opcional)</label>
            <input
              type="url"
              placeholder="https://..."
              value={webSponsor}
              onChange={(e) => setWebSponsor(e.target.value)}
            />
          </div>
          <div className="input-group">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading
                ? "Procesando..."
                : editingId
                  ? "Guardar cambios"
                  : "Añadir Sponsor"}
            </button>
          </div>
        </div>
      </form>
      )}

      <div
        className="table-responsive"
        style={{ maxHeight: "300px", overflowY: "auto" }}
      >
        <table className="admin-table">
          <thead>
            <tr>
              <th>Logo</th>
              <th>Nombre</th>
              <th>Enlace</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {patrocinadores.map((s) => (
              <Fragment key={s.id}>
              <tr>
                <td>
                  {s.logo_url && s.logo_url !== "" && (
                    <img
                      src={s.logo_url}
                      alt={s.nombre}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "contain",
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: "8px",
                        padding: "5px",
                      }}
                    />
                  )}
                </td>
                <td>{s.nombre}</td>
                <td>
                  <span style={{ fontSize: "0.7rem", color: "#666" }}>
                    {s.web_url || "-"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      disabled={loading}
                      onClick={() => startEditSponsor(s)}
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
                      onClick={() => handleDeleteSponsor(s.id)}
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
              {editingId === s.id && (
                <tr>
                  <td colSpan={4}>
                    <div style={{ margin: "0.4rem 0 1rem" }}>
                      {renderSponsorForm()}
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
