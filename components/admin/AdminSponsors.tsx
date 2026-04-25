"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { processAndUploadImage } from "@/lib/image-utils";
import { v4 as uuidv4 } from "uuid";
import BusyBanner from "./BusyBanner";

interface AdminSponsorsProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

export default function AdminSponsors({
  showToast,
  showConfirm,
}: AdminSponsorsProps) {
  const [patrocinadores, setPatrocinadores] = useState<any[]>([]);
  const [nombreSponsor, setNombreSponsor] = useState("");
  const [logoSponsor, setLogoSponsor] = useState<File | null>(null);
  const [webSponsor, setWebSponsor] = useState("");
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando patrocinadores...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    fetchPatrocinadores();
  }, []);

  async function fetchPatrocinadores() {
    setIsFetching(true);
    const { data } = await supabase
      .from("patrocinadores")
      .select("*")
      .order("orden", { ascending: true });
    if (data) setPatrocinadores(data);
    setIsFetching(false);
  }

  async function handleAddSponsor(e: React.FormEvent) {
    e.preventDefault();
    if (!nombreSponsor || !logoSponsor) return;
    setBusyText("Procesando logo y creando patrocinador...");
    setBusyProgress(5);
    setLoading(true);

    try {
      const processed = await processAndUploadImage(logoSponsor, (percent) => {
        setBusyText("Procesando logo...");
        setBusyProgress(percent * 0.6);
      });
      if (!processed) return;

      setBusyText("Subiendo logo...");
      setBusyProgress(75);
      const fileName = `sponsors/${uuidv4()}.webp`;
      const { data, error: uploadError } = await supabase.storage
        .from("fotos")
        .upload(fileName, processed);

      if (uploadError) throw uploadError;

      const { data: pUrl } = supabase.storage
        .from("fotos")
        .getPublicUrl(fileName);

      setBusyText("Guardando patrocinador...");
      setBusyProgress(90);
      const { error: dbError } = await supabase.from("patrocinadores").insert([
        {
          nombre: nombreSponsor,
          logo_url: pUrl.publicUrl,
          web_url: webSponsor,
        },
      ]);

      if (dbError) throw dbError;

      setNombreSponsor("");
      setLogoSponsor(null);
      setWebSponsor("");
      fetchPatrocinadores();
      showToast("Patrocinador añadido correctamente");
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
      await supabase.from("patrocinadores").delete().eq("id", id);
      fetchPatrocinadores();
      showToast("Patrocinador eliminado");
    });
  }

  return (
    <div className="card glass">
      <BusyBanner
        show={loading || isFetching}
        text={isFetching ? "Cargando patrocinadores..." : busyText}
        progress={loading ? busyProgress : undefined}
      />
      <h3>Gestión de Patrocinadores</h3>
      <form onSubmit={handleAddSponsor} className="admin-form">
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
            <label>Logo (Auto-1:1)</label>
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
              {loading ? "Subiendo..." : "Añadir Sponsor"}
            </button>
          </div>
        </div>
      </form>

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
              <tr key={s.id}>
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
                  <button
                    onClick={() => handleDeleteSponsor(s.id)}
                    className="btn-delete"
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
