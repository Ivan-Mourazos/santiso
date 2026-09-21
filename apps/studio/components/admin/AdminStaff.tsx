"use client";
import { useCallback, useEffect, useState } from "react";
import type { StaffDto } from "@/lib/dto";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  cargarCandidatosStaff,
  cargarStaff,
  guardarMiembroStaff,
  incorporarStaff,
  quitarMiembroStaffDeTemporada,
} from "@/lib/server/acciones/staff";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { useCompeticiones } from "@/lib/useCompeticiones";
import BusyBanner from "./BusyBanner";
import BarraTemporada from "./plantilla/BarraTemporada";
import IncorporarDeTemporada, { type Elegido } from "./plantilla/IncorporarDeTemporada";

interface AdminStaffProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  tipo: "Tecnico" | "Directiva";
  categoria?: string;
}

export default function AdminStaff({ showToast, showConfirm, tipo, categoria }: AdminStaffProps) {
  const { setParams } = useStudio();
  // La temporada que se consulta sale de la URL (`?temporada=`); sin ella, la activa.
  const { temporadas, selectedSeasonId: temporadaId } = useCompeticiones(undefined, true);
  const temporadaNombre = temporadas.find((t) => t.id === temporadaId)?.nombre ?? "";
  const [staff, setStaff] = useState<StaffDto[]>([]);
  const [incorporando, setIncorporando] = useState(false);
  const [candidatos, setCandidatos] = useState<{ origen: string; miembros: StaffDto[] } | null>(
    null,
  );
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File>>({});
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando staff...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(undefined);

  useUnsavedChanges(
    nombre !== "" || cargo !== "" || fotoFile !== null || Object.keys(pendingPhotos).length > 0,
  );

  const fetchStaff = useCallback(async () => {
    await Promise.resolve();
    if (!temporadaId) return;
    setIsFetching(true);
    setStaff(await cargarStaff(tipo, categoria, temporadaId));
    const resultado = await cargarCandidatosStaff(tipo, categoria, temporadaId);
    setCandidatos(
      resultado.origen ? { origen: resultado.origen.nombre, miembros: resultado.miembros } : null,
    );
    setIsFetching(false);
  }, [tipo, categoria, temporadaId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchStaff();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchStaff]);

  async function handleIncorporar(elegidos: Elegido[]) {
    const resultado = await incorporarStaff({
      temporadaId,
      inscripciones: elegidos.map((e) => e.clave),
    });
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`${resultado.datos} añadido(s) a ${temporadaNombre}`);
    setIncorporando(false);
    fetchStaff();
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre || !cargo) return;
    setBusyText("Procesando foto y guardando staff...");
    setBusyProgress(5);
    setLoading(true);

    try {
      const cuerpo = new FormData();
      cuerpo.set("id", "");
      cuerpo.set("temporadaId", temporadaId);
      cuerpo.set("nombre", nombre);
      cuerpo.set("cargo", cargo);
      cuerpo.set("tipo", tipo);
      cuerpo.set("categoria", categoria ?? "");
      if (fotoFile) {
        setBusyText("Preparando foto...");
        setBusyProgress(40);
        cuerpo.set("foto", await prepararImagen(fotoFile));
      }

      setBusyText("Guardando staff...");
      setBusyProgress(80);
      const resultado = await guardarMiembroStaff(cuerpo);

      if (resultado.ok) {
        setNombre("");
        setCargo("");
        setFotoFile(null);
        fetchStaff();
        showToast(`${tipo === 'Tecnico' ? 'Técnico' : 'Directivo'} añadido correctamente`);
      } else {
        showToast(resultado.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al guardar miembro", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleUpdateFoto(inscripcionId: string, file: File) {
    setBusyText("Procesando y subiendo foto...");
    setBusyProgress(5);
    setLoading(true);
    setPendingPhotos((pending) => ({ ...pending, [inscripcionId]: file }));
    const miembro = staff.find((s) => s.inscripcion_id === inscripcionId);
    if (!miembro) {
      showToast("No se encontró el miembro", "error");
      setLoading(false);
      setBusyProgress(undefined);
      return;
    }
    try {
      // `guardarMiembroStaff` reescribe el papel entero: hay que reenviar nombre, cargo y tipo.
      const cuerpo = new FormData();
      cuerpo.set("id", miembro.id);
      cuerpo.set("inscripcionId", inscripcionId);
      cuerpo.set("temporadaId", temporadaId);
      cuerpo.set("nombre", miembro.nombre);
      cuerpo.set("cargo", miembro.cargo);
      cuerpo.set("tipo", miembro.tipo);
      cuerpo.set("categoria", miembro.categoria ?? "");
      setBusyText("Preparando foto...");
      setBusyProgress(40);
      cuerpo.set("foto", await prepararImagen(file));

      setBusyText("Guardando foto...");
      setBusyProgress(80);
      const resultado = await guardarMiembroStaff(cuerpo);
      if (resultado.ok) {
        showToast("Foto actualizada");
        setPendingPhotos((pending) => {
          const remaining = { ...pending };
          delete remaining[inscripcionId];
          return remaining;
        });
        fetchStaff();
      } else {
        showToast(resultado.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error actualizando foto", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleQuitarStaff(miembro: StaffDto) {
    showConfirm(
      `¿Quitar a ${miembro.nombre} (${miembro.cargo}) de ${temporadaNombre}? Sus otras temporadas no se tocan.`,
      async () => {
        const resultado = await quitarMiembroStaffDeTemporada(miembro.inscripcion_id);
        if (resultado.ok) {
          fetchStaff();
          showToast(`${miembro.nombre} ya no está en ${temporadaNombre}`);
        } else {
          showToast(resultado.error, "error");
        }
      },
    );
  }

  return (
    <div className="card glass">
      <BusyBanner show={loading || isFetching} text={isFetching ? "Cargando staff..." : busyText} progress={loading ? busyProgress : undefined} />
      <BarraTemporada
        temporadas={temporadas}
        seleccionada={temporadaId}
        onCambiar={(id) => setParams({ temporada: id })}
        deshabilitada={loading}
      />
      {candidatos && (
        <IncorporarDeTemporada
          open={incorporando}
          onClose={() => setIncorporando(false)}
          origen={candidatos.origen}
          candidatos={candidatos.miembros.map((m) => ({
            clave: m.inscripcion_id,
            nombre: m.nombre,
            detalle: m.cargo,
            foto_url: m.foto_url,
          }))}
          onConfirmar={handleIncorporar}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <h3>
          {tipo === 'Tecnico' ? `Cuerpo Técnico (${categoria})` : 'Junta Directiva'} {temporadaNombre}
        </h3>
        {candidatos && candidatos.miembros.length > 0 && (
          <Button variant="secondary" onClick={() => setIncorporando(true)}>
            Añadir de {candidatos.origen}
          </Button>
        )}
      </div>
      
      <form onSubmit={handleAddStaff} className="admin-form" style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 150px auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="input-group">
            <label>Nombre Completo</label>
            <input type="text" placeholder="Ej: Alberto López" value={nombre} onChange={(e) => setNombre(e.target.value)} required style={{ height: '50px' }} />
          </div>
          <div className="input-group">
            <label>Cargo / Función</label>
            <input type="text" placeholder={tipo === 'Tecnico' ? "Ej: Entrenador" : "Ej: Presidente"} value={cargo} onChange={(e) => setCargo(e.target.value)} required style={{ height: '50px' }} />
          </div>
          <div className="input-group">
            <label>Foto</label>
            <div className="file-input-group">
              <label className="file-input-label" style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                {fotoFile ? "OK" : "Subir"}
                <input type="file" className="hidden-input" accept="image/*" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
              </label>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading} style={{ height: '50px', padding: '0 2rem', borderRadius: '10px' }}>
            {loading ? "..." : "+"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>Foto</th>
              <th>Nombre</th>
              <th>Cargo</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                  No hay {tipo === 'Tecnico' ? 'técnicos' : 'directivos'} {categoria ? `en ${categoria} ` : ''}en {temporadaNombre}.
                  {candidatos && candidatos.miembros.length > 0 && (
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      Usa «Añadir de {candidatos.origen}» para traer a quien sigue, o da de alta a los nuevos arriba.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              staff.map(s => (
                <tr key={s.inscripcion_id}>
                  <td>
                    <div style={{ position: 'relative', width: '40px', height: '40px' }}>
                      {s.foto_url ? (
                        <img src={s.foto_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                      )}
                      <label style={{ position: 'absolute', bottom: '-4px', right: '-4px', background: 'var(--primary)', color: 'black', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: loading ? 'not-allowed' : 'pointer', border: '1px solid #000', opacity: loading ? 0.6 : 1 }}>
                        <span style={{ fontSize: '10px' }}>+</span>
                        <input disabled={loading} type="file" className="hidden-input" accept="image/*" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUpdateFoto(s.inscripcion_id, f);
                          e.currentTarget.value = "";
                        }} />
                      </label>
                    </div>
                  </td>
                  <td style={{ fontWeight: 800 }}>{s.nombre}</td>
                  <td><span className="badge-posicion">{s.cargo}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button disabled={loading} onClick={() => handleQuitarStaff(s)} className="btn-delete-icon-only" title="Quitar de la temporada" aria-label={`Quitar a ${s.nombre} de la temporada`} style={{ opacity: loading ? 0.6 : 1 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
