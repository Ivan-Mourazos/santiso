"use client";

import Link from "next/link";
import boton from "@/components/ui/foundation/Button.module.css";
import { hoyLocal } from "@/lib/jornada/semana";
import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import styles from "./Jornada.module.css";

interface Props {
  partido: PartidoDeLaSemana;
  categoria: string;
}

const clasesBoton = (variante: "primary" | "secondary") =>
  `${boton.button} ${boton[variante]} ${boton.sm}`;

/** Enlace con aspecto de botón. Deshabilitado, es un botón inerte que dice por qué. */
function Accion({
  href,
  children,
  principal,
  deshabilitada,
  motivo,
}: {
  href: string;
  children: React.ReactNode;
  principal?: boolean;
  deshabilitada?: boolean;
  motivo?: string;
}) {
  const clase = clasesBoton(principal ? "primary" : "secondary");
  if (deshabilitada) {
    return (
      <button type="button" className={clase} disabled title={motivo}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={clase}>
      {children}
    </Link>
  );
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-09-27T17:00` → { dia: "dom 27 sep", hora: "17:00" }. Sin fecha, nada. */
function fechaCorta(fecha: string | null) {
  if (!fecha) return null;
  const [dia, hora] = fecha.split("T");
  const [a, m, d] = (dia ?? "").split("-").map(Number);
  if (!a || !m || !d) return null;
  const f = new Date(a, m - 1, d);
  return { dia: `${DIAS[f.getDay()]} ${d} ${MESES[m - 1]}`, hora: hora?.slice(0, 5) ?? "" };
}

function Paso({
  titulo,
  estado,
  tono,
  children,
}: {
  titulo: string;
  estado: string;
  tono: "hecho" | "pendiente" | "espera";
  children: React.ReactNode;
}) {
  return (
    <li className={styles.paso}>
      <div className={styles.pasoCabecera}>
        <h4>{titulo}</h4>
        <span className={styles.estado} data-tono={tono}>
          {estado}
        </span>
      </div>
      {children}
    </li>
  );
}

/**
 * Un partido de la semana y lo que toca hacer con él: cartel previo, acta, carteles del resultado,
 * resto de la jornada y clasificación. No guarda nada: cada botón abre su pantalla con el partido
 * ya elegido.
 */
export default function TarjetaPartido({ partido: p, categoria }: Props) {
  const cuando = fechaCorta(p.fecha);
  const conResultado = p.golesSantiso !== null;
  // Un partido cuya hora ya pasó cuenta como jugado aunque siga «programado»: es justo cuando
  // hay que importar su acta.
  const ahora = new Date();
  const momentoActual = `${hoyLocal(ahora)}T${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const pasado = Boolean(p.fecha && p.fecha <= momentoActual);
  const jugado = p.estado === "finalizado" || conResultado || pasado;
  const cat = encodeURIComponent(categoria);
  const conPartido = (plantilla: string) =>
    `/admin/carteles?plantilla=${plantilla}&partido=${p.id}`;
  const local = p.santisoLocal
    ? { nombre: p.santiso, escudo: p.santisoEscudoUrl, propio: true }
    : { nombre: p.rival.nombre, escudo: p.rival.escudoUrl, propio: false };
  const visitante = p.santisoLocal
    ? { nombre: p.rival.nombre, escudo: p.rival.escudoUrl, propio: false }
    : { nombre: p.santiso, escudo: p.santisoEscudoUrl, propio: true };
  const golesLocal = p.santisoLocal ? p.golesSantiso : p.golesRival;
  const golesVisitante = p.santisoLocal ? p.golesRival : p.golesSantiso;

  const equipo = (e: typeof local, lado: "local" | "visitante") => (
    <div className={`${styles.equipo} ${e.propio ? styles.propio : ""}`}>
      {lado === "visitante" &&
        (e.escudo ? (
          // eslint-disable-next-line @next/next/no-img-element -- escudo local del catálogo
          <img src={e.escudo} alt="" />
        ) : (
          <span className={styles.escudoVacio} aria-hidden="true" />
        ))}
      <span>{e.nombre}</span>
      {lado === "local" &&
        (e.escudo ? (
          // eslint-disable-next-line @next/next/no-img-element -- escudo local del catálogo
          <img src={e.escudo} alt="" />
        ) : (
          <span className={styles.escudoVacio} aria-hidden="true" />
        ))}
    </div>
  );

  const acta = p.acta;
  const resumenActa = acta
    ? [
        `${acta.convocados} convocados`,
        acta.goleadores.length
          ? `goles: ${acta.goleadores.map((g) => (g.goles > 1 ? `${g.nombre} (${g.goles})` : g.nombre)).join(", ")}`
          : null,
        acta.golesPropiaRival ? `${acta.golesPropiaRival} en propia del rival` : null,
        acta.amarillas ? `${acta.amarillas} amarilla${acta.amarillas > 1 ? "s" : ""}` : null,
        acta.rojas ? `${acta.rojas} roja${acta.rojas > 1 ? "s" : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <article className={styles.tarjeta} aria-label={`${local.nombre} - ${visitante.nombre}`}>
      <p className={styles.contexto}>
        {p.competicion} · Jornada {p.jornadaNumero}
        {p.campo ? ` · ${p.campo}` : ""}
      </p>

      <div className={styles.cruce}>
        {equipo(local, "local")}
        <div className={styles.centro}>
          {conResultado ? (
            <span className={styles.marcador}>
              {golesLocal} – {golesVisitante}
            </span>
          ) : pasado ? (
            <>
              <span className={styles.hora}>Sin resultado</span>
              {cuando && <span className={styles.dia}>{cuando.dia}</span>}
            </>
          ) : cuando ? (
            <>
              <span className={styles.hora}>{cuando.hora || "Sin hora"}</span>
              <span className={styles.dia}>{cuando.dia}</span>
            </>
          ) : (
            <span className={styles.dia}>Sin fecha</span>
          )}
        </div>
        {equipo(visitante, "visitante")}
      </div>

      <ol className={styles.pasos}>
        <Paso
          titulo="Antes del partido"
          estado={
            jugado
              ? "Jugado"
              : cuando
                ? `${cuando.dia}${cuando.hora ? `, ${cuando.hora}` : ""}`
                : "Sin fecha"
          }
          tono={jugado ? "hecho" : "espera"}
        >
          <div className={styles.botones}>
            <Accion href={conPartido("partido")} principal={!jugado}>
              Cartel de partido
            </Accion>
            <Accion
              href={`/admin/calendario?categoria=${cat}&competicion=${p.competicionId}&jornada=${p.jornadaId}`}
            >
              Cambiar fecha, hora o campo
            </Accion>
          </div>
        </Paso>

        <Paso
          titulo="Acta"
          estado={acta ? "Guardada" : jugado ? "Pendiente" : "Tras el partido"}
          tono={acta ? "hecho" : jugado ? "pendiente" : "espera"}
        >
          {resumenActa && <p className={styles.detalle}>{resumenActa}</p>}
          {!acta && (
            <div className={styles.botones}>
              <Accion
                href={`/admin/actas?categoria=${cat}&competicion=${p.competicionId}&partido=${p.id}`}
                principal={jugado}
                deshabilitada={!jugado}
                motivo="Se importa cuando se haya jugado"
              >
                Importar acta
              </Accion>
            </div>
          )}
        </Paso>

        <Paso
          titulo="Carteles del resultado"
          estado={
            !jugado
              ? "Tras el partido"
              : acta
                ? "Listos"
                : conResultado
                  ? "Faltan datos del acta"
                  : "Falta el resultado"
          }
          tono={jugado ? (acta ? "hecho" : "pendiente") : "espera"}
        >
          <div className={styles.botones}>
            <Accion
              href={conPartido("resumo")}
              deshabilitada={!conResultado}
              motivo="Necesita el resultado"
            >
              Resultado
            </Accion>
            <Accion
              href={conPartido("cronoloxia")}
              deshabilitada={!acta}
              motivo="Necesita el acta: goles y tarjetas"
            >
              Cronoloxía
            </Accion>
            <Accion
              href={conPartido("noso11")}
              deshabilitada={!acta}
              motivo="Necesita el acta: la convocatoria"
            >
              O noso 11
            </Accion>
          </div>
        </Paso>

        <Paso
          titulo="Resto de la jornada"
          estado={jugado ? "Resultados de la liga" : "Tras el partido"}
          tono="espera"
        >
          <div className={styles.botones}>
            <Accion
              href={`/admin/importar-jornada?origen=foto&categoria=${cat}&competicion=${p.competicionId}&jornada=${p.jornadaId}`}
              deshabilitada={!jugado}
              motivo="Se importan cuando se haya jugado la jornada"
            >
              Importar resultados
            </Accion>
          </div>
        </Paso>

        {p.clasificacion && (
          <Paso
            titulo="Clasificación"
            estado={
              p.clasificacion.jugados === 0
                ? "Sin partidos jugados"
                : `${p.clasificacion.posicion}º de ${p.clasificacion.equipos} · ${p.clasificacion.puntos} ${p.clasificacion.puntos === 1 ? "punto" : "puntos"}`
            }
            tono={p.clasificacion.jugados === 0 ? "espera" : "hecho"}
          >
            <div className={styles.botones}>
              <Accion href={`/admin/clasificacion?categoria=${cat}&competicion=${p.competicionId}`}>
                Ver clasificación
              </Accion>
              <Accion href="/admin/carteles?plantilla=clasificacion">
                Cartel de clasificación
              </Accion>
            </div>
          </Paso>
        )}
      </ol>
    </article>
  );
}
