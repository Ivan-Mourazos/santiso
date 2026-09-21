"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Dialog } from "@/components/ui/foundation/Dialog";

export interface Candidato {
  /** Identifica la fila: la inscripción de origen. */
  clave: string;
  nombre: string;
  detalle?: string | null;
  foto_url?: string | null;
  /** Solo jugadores: el dorsal del año pasado, editable antes de traerlo. */
  dorsal?: number | null;
}

export interface Elegido {
  clave: string;
  dorsal: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** "2025/26". */
  origen: string;
  candidatos: Candidato[];
  cargando?: boolean;
  /** Muestra el dorsal editable (jugadores) o no (staff). */
  conDorsal?: boolean;
  /** Si existe, muestra la casilla «ver también otras categorías». */
  otrasCategorias?: { activo: boolean; onCambiar: (activo: boolean) => void };
  onConfirmar: (elegidos: Elegido[]) => Promise<void>;
}

/**
 * «Añadir de la temporada anterior»: se marcan los que siguen y se traen de golpe. Con los
 * jugadores el dorsal viene puesto y se puede cambiar antes de confirmar, porque es lo que más
 * cambia de un año a otro.
 */
export default function IncorporarDeTemporada({
  open,
  onClose,
  origen,
  candidatos,
  cargando,
  conDorsal,
  otrasCategorias,
  onConfirmar,
}: Props) {
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [dorsales, setDorsales] = useState<Record<string, string>>({});
  const [pendiente, setPendiente] = useState(false);

  // Solo se reinicia cuando cambia de verdad el CONJUNTO de candidatos (se abre el diálogo o
  // se amplía a otras categorías), nunca por una identidad de array nueva: el padre construye
  // `candidatos` con `.map()` en cada render, y eso no puede tirar la selección del usuario.
  const firma = candidatos
    .map((c) => c.clave)
    .sort()
    .join("|");
  const firmaAnterior = useRef<string | null>(null);
  useEffect(() => {
    if (firmaAnterior.current === firma) return;
    firmaAnterior.current = firma;
    setMarcados({});
    setDorsales(
      Object.fromEntries(candidatos.map((c) => [c.clave, c.dorsal?.toString() ?? ""])),
    );
    // Solo la firma decide si toca reiniciar; `candidatos` cambia de identidad cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  const elegidos = candidatos.filter((c) => marcados[c.clave]);
  const dorsalNoValido = elegidos.some((c) => {
    const texto = (dorsales[c.clave] ?? "").trim();
    return texto !== "" && !/^\d+$/.test(texto);
  });

  async function confirmar() {
    setPendiente(true);
    try {
      await onConfirmar(
        elegidos.map((c) => {
          const texto = (dorsales[c.clave] ?? "").trim();
          return { clave: c.clave, dorsal: texto === "" ? null : Number(texto) };
        }),
      );
    } finally {
      setPendiente(false);
    }
  }

  const todos = candidatos.length > 0 && elegidos.length === candidatos.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      pending={pendiente}
      title={`Añadir de ${origen}`}
      description="Marca a quien sigue esta temporada. Se copia su foto; lo demás lo puedes cambiar después."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            pending={pendiente}
            pendingLabel="Añadiendo…"
            disabled={elegidos.length === 0 || dorsalNoValido}
          >
            {elegidos.length === 0 ? "Añadir" : `Añadir ${elegidos.length}`}
          </Button>
        </>
      }
    >
      {otrasCategorias && (
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
          <input
            type="checkbox"
            checked={otrasCategorias.activo}
            onChange={(e) => otrasCategorias.onCambiar(e.target.checked)}
          />
          Ver también otras categorías (quien sube o baja de equipo)
        </label>
      )}

      {cargando ? (
        <p>Cargando…</p>
      ) : candidatos.length === 0 ? (
        <p>No queda nadie de {origen} por añadir.</p>
      ) : (
        <>
          <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
            <input
              type="checkbox"
              checked={todos}
              onChange={(e) =>
                setMarcados(
                  Object.fromEntries(candidatos.map((c) => [c.clave, e.target.checked])),
                )
              }
            />
            Marcar todos
          </label>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: "50vh", overflowY: "auto" }}>
            {candidatos.map((c) => {
              const idCasilla = `incorporar-${c.clave}`;
              return (
                <li
                  key={c.clave}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                    padding: "0.4rem 0",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <input
                    id={idCasilla}
                    type="checkbox"
                    checked={Boolean(marcados[c.clave])}
                    onChange={(e) => setMarcados((m) => ({ ...m, [c.clave]: e.target.checked }))}
                  />
                  {c.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- media local servida por el route handler
                    <img
                      src={c.foto_url}
                      alt=""
                      width={36}
                      height={36}
                      style={{ borderRadius: "6px", objectFit: "cover" }}
                    />
                  ) : (
                    <span aria-hidden style={{ width: 36, height: 36, borderRadius: 6, background: "#1a1a1a" }} />
                  )}
                  <label htmlFor={idCasilla} style={{ flex: 1, cursor: "pointer" }}>
                    <strong>{c.nombre}</strong>
                    {c.detalle && (
                      <span style={{ display: "block", color: "#aaa", fontSize: "0.8rem" }}>
                        {c.detalle}
                      </span>
                    )}
                  </label>
                  {conDorsal && (
                    <input
                      aria-label={`Dorsal de ${c.nombre}`}
                      inputMode="numeric"
                      value={dorsales[c.clave] ?? ""}
                      onChange={(e) => setDorsales((d) => ({ ...d, [c.clave]: e.target.value }))}
                      disabled={!marcados[c.clave]}
                      style={{ width: "4rem", textAlign: "center" }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {dorsalNoValido && (
            <p role="alert" style={{ color: "#f87171", fontSize: "0.85rem" }}>
              Algún dorsal no es un número.
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
