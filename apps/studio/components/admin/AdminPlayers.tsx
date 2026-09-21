"use client";
import { Fragment, useCallback, useEffect, useState } from "react";
import { prepararImagen } from "@/lib/imagen-cliente";
import {
  buscarJugadoresParecidos,
  cargarCandidatosJugadores,
  cargarJugadores,
  guardarJugador,
  incorporarJugadores,
  quitarJugadorDeTemporada,
} from "@/lib/server/acciones/jugadores";
import { useStudio, useUnsavedChanges } from "@/components/studio/StudioContext";
import { Button } from "@/components/ui/foundation/Button";
import { EmptyState } from "@/components/ui/foundation/States";
import { useCompeticiones } from "@/lib/useCompeticiones";
import type { JugadorDto } from "@/lib/dto";
import BusyBanner from "./BusyBanner";
import BarraTemporada from "./plantilla/BarraTemporada";
import IncorporarDeTemporada, { type Elegido } from "./plantilla/IncorporarDeTemporada";

interface AdminPlayersProps {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
  categoria: string;
}

interface Jugador {
  id: string;
  inscripcion_id: string;
  nombre: string;
  apodo?: string | null;
  dorsal?: number | string | null;
  posicion?: string | null;
  foto_url?: string | null;
  capitan?: number | null;
  fecha_nacimiento?: string | null;
  historial_deportivo?: string[] | null;
}

export default function AdminPlayers({
  showToast,
  showConfirm,
  categoria,
}: AdminPlayersProps) {
  const { setParams } = useStudio();
  // La temporada que se consulta sale de la URL (`?temporada=`); sin ella, la activa.
  const { temporadas, selectedSeasonId: temporadaId } = useCompeticiones(undefined, true);
  const temporadaNombre = temporadas.find((t) => t.id === temporadaId)?.nombre ?? "";
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [incorporando, setIncorporando] = useState(false);
  const [otrasCategorias, setOtrasCategorias] = useState(false);
  const [candidatos, setCandidatos] = useState<{ origen: string; jugadores: JugadorDto[] } | null>(
    null,
  );
  const [cargandoCandidatos, setCargandoCandidatos] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");
  const [dorsal, setDorsal] = useState("");
  const [posicion, setPosicion] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [historial, setHistorial] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, File>>({});
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [busyText, setBusyText] = useState("Cargando jugadores...");
  const [busyProgress, setBusyProgress] = useState<number | undefined>(
    undefined,
  );

  const [originalJugador, setOriginalJugador] = useState<Jugador | null>(null);

  useUnsavedChanges(
    nombre !== (originalJugador?.nombre || "") ||
      apodo !== (originalJugador?.apodo || "") ||
      dorsal !== (originalJugador?.dorsal?.toString() || "") ||
      posicion !== (originalJugador?.posicion || "") ||
      fechaNacimiento !== (originalJugador?.fecha_nacimiento || "") ||
      historial !== (originalJugador?.historial_deportivo || []).join("\n") ||
      fotoFile !== null ||
      Object.keys(pendingPhotos).length > 0,
  );

  function resetForm() {
    setNombre("");
    setApodo("");
    setDorsal("");
    setPosicion("");
    setFechaNacimiento("");
    setHistorial("");
    setFotoFile(null);
    setEditingId(null);
    setOriginalJugador(null);
  }

  function startEditJugador(jugador: Jugador) {
    setNombre(jugador.nombre || "");
    setApodo(jugador.apodo || "");
    setDorsal(jugador.dorsal?.toString() || "");
    setPosicion(jugador.posicion || "");
    setFechaNacimiento(jugador.fecha_nacimiento || "");
    setHistorial((jugador.historial_deportivo || []).join("\n"));
    setFotoFile(null);
    setEditingId(jugador.id);
    setOriginalJugador(jugador);
  }

  const fetchJugadores = useCallback(async () => {
    await Promise.resolve();
    if (!temporadaId) return;
    setIsFetching(true);
    setJugadores((await cargarJugadores(categoria, temporadaId)) as Jugador[]);
    setIsFetching(false);
  }, [categoria, temporadaId]);

  const fetchCandidatos = useCallback(
    async (todasLasCategorias: boolean) => {
      if (!temporadaId) return;
      setCargandoCandidatos(true);
      const resultado = await cargarCandidatosJugadores(categoria, temporadaId, !todasLasCategorias);
      setCandidatos(
        resultado.origen ? { origen: resultado.origen.nombre, jugadores: resultado.jugadores } : null,
      );
      setCargandoCandidatos(false);
    },
    [categoria, temporadaId],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCandidatos(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCandidatos]);

  async function handleIncorporar(elegidos: Elegido[]) {
    const porClave = new Map((candidatos?.jugadores ?? []).map((j) => [j.inscripcion_id, j]));
    const resultado = await incorporarJugadores({
      temporadaId,
      categoria,
      jugadores: elegidos.flatMap((e) => {
        const jugador = porClave.get(e.clave);
        return jugador
          ? [{ jugadorId: jugador.id, desdeInscripcionId: e.clave, dorsal: e.dorsal }]
          : [];
      }),
    });
    if (!resultado.ok) {
      showToast(resultado.error, "error");
      return;
    }
    showToast(`${resultado.datos} jugador(es) añadidos a ${temporadaNombre}`);
    setIncorporando(false);
    setOtrasCategorias(false);
    fetchJugadores();
    fetchCandidatos(false);
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchJugadores();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchJugadores]);

  async function handleSubmitJugador(e: React.FormEvent) {
    e.preventDefault();
    // Antes de dar de alta a alguien nuevo, comprobar que no existe ya: si se duplica a la
    // misma persona, sus goles de cada año quedan partidos entre dos fichas.
    if (!editingId) {
      const parecidos = await buscarJugadoresParecidos(nombre);
      if (parecidos.length > 0) {
        const lista = parecidos
          .map((p) => `«${p.nombre}»${p.ultimaTemporada ? ` (${p.ultimaTemporada})` : ""}`)
          .join(", ");
        showConfirm(
          `Ya existe ${lista}. Si es la misma persona, cancela y tráela con «Añadir de la temporada anterior». ¿Crear una ficha nueva de todos modos?`,
          () => guardarFormulario(),
        );
        return;
      }
    }
    await guardarFormulario();
  }

  async function guardarFormulario() {
    setBusyText(editingId ? "Guardando cambios jugador..." : "Procesando foto y guardando jugador...");
    setBusyProgress(5);
    setLoading(true);

    try {
      const cuerpo = new FormData();
      cuerpo.set("id", editingId ?? "");
      cuerpo.set("temporadaId", temporadaId);
      cuerpo.set("nombre", nombre);
      cuerpo.set("apodo", apodo);
      cuerpo.set("dorsal", dorsal);
      cuerpo.set("posicion", posicion);
      cuerpo.set("categoria", categoria);
      cuerpo.set("fechaNacimiento", fechaNacimiento);
      cuerpo.set("historial", historial);
      if (fotoFile) {
        setBusyText("Preparando foto...");
        setBusyProgress(40);
        cuerpo.set("foto", await prepararImagen(fotoFile));
      }

      setBusyText("Guardando jugador...");
      setBusyProgress(80);
      const resultado = await guardarJugador(cuerpo);

      if (resultado.ok) {
        resetForm();
        fetchJugadores();
        showToast(editingId ? "Jugador actualizado correctamente" : "Jugador añadido correctamente", "success");
      } else {
        showToast(resultado.error, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error al guardar jugador", "error");
    } finally {
      setLoading(false);
      setBusyProgress(undefined);
    }
  }

  async function handleUpdateFoto(id: string, file: File) {
    setBusyText("Procesando y subiendo foto...");
    setBusyProgress(5);
    setLoading(true);
    setPendingPhotos((pending) => ({ ...pending, [id]: file }));
    const jugador = jugadores.find((j) => j.id === id);
    if (!jugador) {
      showToast("No se encontró el jugador", "error");
      setLoading(false);
      setBusyProgress(undefined);
      return;
    }
    try {
      // `guardarJugador` reescribe la fila entera: hay que reenviar los valores actuales o se
      // perderían dorsal, posición, apodo, fecha de nacimiento e historial al cambiar la foto.
      const cuerpo = new FormData();
      cuerpo.set("id", id);
      cuerpo.set("temporadaId", temporadaId);
      cuerpo.set("nombre", jugador.nombre);
      cuerpo.set("apodo", jugador.apodo ?? "");
      cuerpo.set("dorsal", jugador.dorsal?.toString() ?? "");
      cuerpo.set("posicion", jugador.posicion ?? "");
      cuerpo.set("categoria", categoria);
      cuerpo.set("fechaNacimiento", jugador.fecha_nacimiento ?? "");
      cuerpo.set("historial", (jugador.historial_deportivo ?? []).join("\n"));
      setBusyText("Preparando foto...");
      setBusyProgress(40);
      cuerpo.set("foto", await prepararImagen(file));

      setBusyText("Guardando foto...");
      setBusyProgress(80);
      const resultado = await guardarJugador(cuerpo);
      if (resultado.ok) {
        showToast("Foto actualizada");
        setPendingPhotos((pending) => {
          const remaining = { ...pending };
          delete remaining[id];
          return remaining;
        });
        fetchJugadores();
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

  async function handleQuitarJugador(jugador: Jugador) {
    showConfirm(
      `¿Quitar a ${jugador.nombre} de la plantilla de ${temporadaNombre}? Sus partidos y sus otras temporadas no se tocan.`,
      async () => {
        const resultado = await quitarJugadorDeTemporada(jugador.inscripcion_id);
        if (resultado.ok) {
          fetchJugadores();
          fetchCandidatos(false);
          showToast(`${jugador.nombre} ya no está en ${temporadaNombre}`);
        } else {
          showToast(resultado.error, "error");
        }
      },
    );
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr", gap: "1rem" }}>
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
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
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
              <label>Fecha de Nacimiento</label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
              />
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            <div className="input-group">
              <label>Historial Deportivo (uno por línea, ej: 2022/23: Deportivo B)</label>
              <textarea
                rows={4}
                value={historial}
                onChange={(e) => setHistorial(e.target.value)}
                placeholder="2018/19 - 2020/21: Deportivo B&#10;2021/22: Sin equipo&#10;2022/23: Santiso"
                style={{
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "0.5rem 0.6rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.8rem", justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ flex: 1, padding: "0.8rem" }}
              >
                {loading
                  ? "Procesando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Añadir Jugador"}
              </button>
              {editingId && (
                <button type="button" className="btn-secondary" onClick={resetForm} style={{ padding: "0.8rem" }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    );
  }

  const vacia = !isFetching && temporadaId !== "" && jugadores.length === 0;

  return (
    <div className="card glass">
      <BarraTemporada
        temporadas={temporadas}
        seleccionada={temporadaId}
        onCambiar={(id) => setParams({ temporada: id })}
        deshabilitada={loading}
      />
      {candidatos && (
        <IncorporarDeTemporada
          open={incorporando}
          onClose={() => {
            setIncorporando(false);
            setOtrasCategorias(false);
            fetchCandidatos(false);
          }}
          origen={candidatos.origen}
          cargando={cargandoCandidatos}
          conDorsal
          otrasCategorias={{
            activo: otrasCategorias,
            onCambiar: (activo) => {
              setOtrasCategorias(activo);
              fetchCandidatos(activo);
            },
          }}
          candidatos={candidatos.jugadores.map((j) => ({
            clave: j.inscripcion_id,
            nombre: j.nombre,
            detalle: [j.categoria !== categoria ? j.categoria : null, j.posicion, j.apodo]
              .filter(Boolean)
              .join(" · "),
            foto_url: j.foto_url,
            dorsal: j.dorsal,
          }))}
          onConfirmar={handleIncorporar}
        />
      )}
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
        {candidatos && candidatos.jugadores.length > 0 && jugadores.length > 0 && (
          <Button variant="secondary" onClick={() => setIncorporando(true)}>
            Añadir de {candidatos.origen}
          </Button>
        )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr", gap: "1rem" }}>
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
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
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
              <label>Fecha de Nacimiento</label>
              <input
                type="date"
                value={fechaNacimiento}
                onChange={(e) => setFechaNacimiento(e.target.value)}
              />
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            <div className="input-group">
              <label>Historial Deportivo (uno por línea, ej: 2022/23: Deportivo B)</label>
              <textarea
                rows={4}
                value={historial}
                onChange={(e) => setHistorial(e.target.value)}
                placeholder="2018/19 - 2020/21: Deportivo B&#10;2021/22: Sin equipo&#10;2022/23: Santiso"
                style={{
                  width: "100%",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  color: "#fff",
                  padding: "0.5rem 0.6rem",
                  fontFamily: "inherit",
                }}
              />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: "100%", padding: "0.8rem" }}
              >
                {loading
                  ? "Procesando..."
                  : editingId
                    ? "Guardar cambios"
                    : "Añadir Jugador"}
              </button>
            </div>
          </div>
        </div>
      </form>
      )}

      {vacia && (
        <EmptyState
          title={`Todavía no hay jugadores en ${categoria} ${temporadaNombre}.`}
          detail={
            candidatos
              ? `Trae a quien sigue de ${candidatos.origen} o da de alta a los nuevos con el formulario de arriba.`
              : "Da de alta a los jugadores con el formulario de arriba."
          }
          action={
            candidatos && candidatos.jugadores.length > 0 ? (
              <Button onClick={() => setIncorporando(true)}>Añadir de {candidatos.origen}</Button>
            ) : undefined
          }
        />
      )}

      <div className="table-responsive" hidden={vacia}>
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
                          e.currentTarget.value = "";
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
                      onClick={() => handleQuitarJugador(j)}
                      className="btn-delete btn-action"
                      title="Quitar de la temporada"
                      aria-label={`Quitar a ${j.nombre} de la temporada`}
                      style={{ padding: "0.5rem" }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
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
