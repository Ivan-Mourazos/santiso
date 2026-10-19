"use client";
import { sinConexion } from "@/lib/resultado";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { cargarEquiposPorEnlazarRfgf, enlazarEquipoConClubRfgf } from "@/lib/server/acciones/rfgf";
import type { EquipoPorEnlazar } from "@/lib/server/rfgf/clubes";
import styles from "./Equipos.module.css";

/**
 * Equipos que la federación no deja enlazar solos con su club (dos clubes con nombre parecido):
 * se elige aquí cuál es. Solo para el administrador; para el resto no sale nada.
 */
export default function PorEnlazar({
  categoria,
  showToast,
}: {
  categoria: string;
  showToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [dudosos, setDudosos] = useState<EquipoPorEnlazar[]>([]);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [codigos, setCodigos] = useState<Record<string, string>>({});
  useEffect(() => {
    let vigente = true;
    void cargarEquiposPorEnlazarRfgf()
      .catch(sinConexion)
      .then((r) => {
        if (vigente && r.ok) setDudosos(r.datos);
      });
    return () => {
      vigente = false;
    };
  }, []);
  const deLaCategoria = dudosos.filter((d) => d.categoria === categoria);
  if (deLaCategoria.length === 0) return null;

  async function elegir(equipo: EquipoPorEnlazar, codigo: string | null) {
    setGuardando(`${equipo.equipoId}:${codigo ?? "ninguno"}`);
    const r = await enlazarEquipoConClubRfgf(equipo.equipoId, codigo);
    setGuardando(null);
    if (!r.ok) return showToast(r.error, "error");
    showToast(
      codigo ? `${equipo.nombre} enlazado con su club.` : `${equipo.nombre} queda sin club.`,
    );
    setDudosos((lista) => lista.filter((d) => d.equipoId !== equipo.equipoId));
  }

  return (
    <section className={styles.porEnlazar} aria-label="Equipos por enlazar con la federación">
      {/* Plegado: la lista de equipos sigue siendo lo primero de la pantalla. */}
      <details>
        <summary>
          {deLaCategoria.length === 1
            ? "1 equipo por enlazar con su club de la federación"
            : `${deLaCategoria.length} equipos por enlazar con su club de la federación`}
        </summary>
        <p className={styles.detalle}>
          Con el club enlazado, su ficha y sus carteles llevan su localidad, su campo y sus colores.
        </p>
        <ul>
          {deLaCategoria.map((equipo) => (
            <li key={equipo.equipoId}>
              <strong>{equipo.nombre}</strong>
              <div className={styles.candidatos}>
                {equipo.candidatos.map((club) => (
                  <Button
                    key={club.codigo}
                    size="sm"
                    variant="secondary"
                    pending={guardando === `${equipo.equipoId}:${club.codigo}`}
                    pendingLabel="Guardando…"
                    disabled={guardando !== null}
                    aria-label={`Enlazar ${equipo.nombre} con ${club.nombre}`}
                    onClick={() => void elegir(equipo, club.codigo)}
                  >
                    {club.nombre}
                    {club.localidad ? ` · ${club.localidad}` : ""}
                  </Button>
                ))}
                {/* Ningún candidato es el suyo (un club de fútbol sala con el mismo nombre…). */}
                <Button
                  size="sm"
                  variant="ghost"
                  pending={guardando === `${equipo.equipoId}:ninguno`}
                  pendingLabel="Guardando…"
                  disabled={guardando !== null}
                  aria-label={`${equipo.nombre}: ninguno de estos`}
                  onClick={() => void elegir(equipo, null)}
                >
                  Ninguno de estos
                </Button>
              </div>
              {/* Si el suyo no sale entre los candidatos: su código en la federación. */}
              <form
                className={styles.codigoClub}
                onSubmit={(e) => {
                  e.preventDefault();
                  const codigo = (codigos[equipo.equipoId] ?? "").trim();
                  if (codigo) void elegir(equipo, codigo);
                }}
              >
                <input
                  aria-label={`Código del club de ${equipo.nombre}`}
                  placeholder="Otro: código del club"
                  inputMode="numeric"
                  value={codigos[equipo.equipoId] ?? ""}
                  onChange={(e) => setCodigos((c) => ({ ...c, [equipo.equipoId]: e.target.value }))}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  aria-label={`Enlazar ${equipo.nombre} por código`}
                  disabled={guardando !== null || !(codigos[equipo.equipoId] ?? "").trim()}
                >
                  Enlazar
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
