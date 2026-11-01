"use client";

import { useState } from "react";

import { Button } from "@/components/ui/foundation/Button";

import { elegirClubDeHistorial } from "@/lib/server/acciones/fichas-rfgf";

import type { FichaCompletaDeJugador } from "@/lib/server/consultas/fichas-rfgf";

import { sinConexion } from "@/lib/resultado";

import styles from "./Fichas.module.css";

const ESTADOS = {
  pendiente: "Buscando",
  leido: "Leído",
  sin_datos: "Sin datos publicados",
  sin_club: "Club por elegir",
  error: "No se pudo leer",
};

export default function OtrosClubes({
  filas,
  admin,
  recargar,
}: {
  filas: FichaCompletaDeJugador["otrosClubes"];
  admin: boolean;
  recargar: () => Promise<void>;
}) {
  const [ocupado, setOcupado] = useState(false);

  const [error, setError] = useState("");

  async function elegir(id: string, codigo: string) {
    setOcupado(true);

    const r = await elegirClubDeHistorial(id, codigo).catch(sinConexion);

    setOcupado(false);

    setError(r.ok ? "" : r.error);

    if (r.ok) await recargar();
  }

  return (
    <section className={styles.bloque} aria-label="Otros clubes">
      <h3>Otros clubes</h3>

      <p className={styles.nota}>Escribe 22/23: Club en el historial para rellenar estas cifras.</p>

      {error && <p role="alert">{error}</p>}

      <ul className={styles.lista}>
        {filas.map((p) => (
          <li key={p.id} className={styles.otroClub}>
            <span>
              <strong>
                {p.temporada} · {p.club}
              </strong>
              <small>{ESTADOS[p.estado]}</small>

              {p.aviso && <small>{p.aviso}</small>}

              {p.resultados.map((r) => (
                <small key={r.codGrupo}>
                  {r.competicion} · {r.cifras!.jugados} partidos · {r.cifras!.goles ?? "—"} goles ·{" "}
                  {r.cifras!.amarillas + r.cifras!.doblesAmarillas} amarillas · {r.cifras!.rojas}{" "}
                  rojas
                </small>
              ))}
            </span>

            {admin && p.estado === "sin_club" && (
              <div className={styles.elegirClub}>
                {p.candidatos.map((c) => (
                  <Button
                    key={c.codigo}
                    size="sm"
                    variant="secondary"
                    disabled={ocupado}
                    onClick={() => void elegir(p.id, c.codigo)}
                  >
                    {c.nombre}
                  </Button>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const datos = new FormData(e.currentTarget);
                    void elegir(p.id, String(datos.get("codigo") ?? "").trim());
                  }}
                >
                  <input
                    name="codigo"
                    aria-label={`Código del club de ${p.club}`}
                    placeholder="Código del club"
                    inputMode="numeric"
                    required
                    pattern="[0-9]+"
                  />

                  <Button type="submit" size="sm" variant="secondary" disabled={ocupado}>
                    Enlazar
                  </Button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
