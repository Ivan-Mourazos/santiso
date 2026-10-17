"use client";

import Link from "next/link";
import { useState } from "react";
import GaleriaPartido from "@/components/admin/fotos/GaleriaPartido";
import { useStudio } from "@/components/studio/StudioContext";
import type { PartidoDeLaSemana } from "@/lib/server/consultas/jornada";
import {
  enlacesPartido,
  marcador,
  preparaConvocatoria,
  progresoPartido,
  tieneResultado,
} from "@/lib/jornada/vestiario";
import styles from "./Jornada.module.css";

export function fechaPartido(fecha: string | null) {
  if (!fecha) return { dia: "Fecha por confirmar", hora: "" };
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return { dia: "Fecha por confirmar", hora: "" };
  return {
    dia: f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }),
    hora: fecha.includes("T") ? fecha.slice(11, 16) : "",
  };
}

function Acceso({
  href,
  children,
  disponible = true,
  motivo,
}: {
  href: string;
  children: React.ReactNode;
  disponible?: boolean;
  motivo?: string;
}) {
  return disponible ? (
    <Link className={styles.acceso} href={href}>
      {children}
      <span aria-hidden="true">↗</span>
    </Link>
  ) : (
    <span className={styles.noDisponible}>
      <span>{children}</span>
      <small>{motivo}</small>
    </span>
  );
}

export default function TarjetaPartido({
  partido: p,
  categoria,
  momento,
}: {
  partido: PartidoDeLaSemana;
  categoria: string;
  momento: string;
}) {
  const { showToast } = useStudio();
  const [galeria, setGaleria] = useState(false);
  const cuando = fechaPartido(p.fecha);
  const { despues, pasos, principal } = progresoPartido(p, momento, categoria);
  const e = enlacesPartido(p, categoria);
  const marcado = tieneResultado(p);
  return (
    <article
      className={styles.tarjeta}
      aria-label={`${p.santiso} - ${p.rival.nombre}`}
      data-mesa-partido
      data-fase={despues ? "despues" : "antes"}
    >
      <div className={styles.partidoCabecera}>
        <span className={styles.contexto}>
          {despues ? "Tras el partido" : p.estado === "en_juego" ? "En juego" : "Próximo partido"} ·
          Jornada {p.jornadaNumero}
        </span>
        <span className={styles.localia}>
          {p.estado === "aplazado"
            ? "Aplazado"
            : p.estado === "cancelado"
              ? "Cancelado"
              : p.santisoLocal
                ? "Casa"
                : "Fuera"}
        </span>
      </div>
      {p.cambioFederacion && (
        <p className={styles.cambio} role="status">
          <strong>La federación cambió este partido:</strong> {p.cambioFederacion.texto}.
        </p>
      )}
      <div className={styles.rival}>
        <div>
          <p className={styles.propio}>{p.santiso} · contra</p>
          <h2>{p.rival.nombre}</h2>
        </div>
        {p.rival.escudoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- escudo del catálogo local
          <img src={p.rival.escudoUrl} alt="" />
        )}
      </div>
      <div className={styles.cuando}>
        <time dateTime={p.fecha ?? undefined}>{cuando.dia}</time>
        <strong>{marcador(p)?.cifras ?? (cuando.hora || "Sin hora")}</strong>
      </div>
      {marcado && (
        <p className={styles.contexto}>
          {marcador(p)?.desenlace} ·{" "}
          {p.santisoLocal ? `${p.santiso} – ${p.rival.nombre}` : `${p.rival.nombre} – ${p.santiso}`}
        </p>
      )}
      <p className={styles.campo}>{p.campo || "Campo por confirmar"}</p>
      <p className={styles.competicion}>{p.competicion}</p>
      {p.arbitro && <p className={styles.competicion}>Árbitro: {p.arbitro}</p>}

      <div className={styles.trabajo}>
        <p className={styles.etiqueta}>Siguiente tarea</p>
        <Link href={principal.href} className={styles.principal} data-accion-principal>
          {principal.titulo}
          <span aria-hidden="true">→</span>
        </Link>
        <ol
          className={styles.pasos}
          aria-label={despues ? "Cierre del partido" : "Preparación del partido"}
        >
          {pasos.map((paso, i) => (
            <li key={paso.titulo} className={styles.paso} data-tono={paso.tono} data-paso-partido>
              <span className={styles.numero} aria-hidden="true">
                {paso.tono === "hecho" ? "✓" : i + 1}
              </span>
              {paso.tono === "espera" ? (
                <span>{paso.titulo}</span>
              ) : (
                <Link href={paso.href}>{paso.titulo}</Link>
              )}
              <span className={styles.estado}>{paso.estado}</span>
            </li>
          ))}
        </ol>
        {despues && (
          <p className={styles.nota}>
            Acta automática de la federación; edición manual disponible.
          </p>
        )}
      </div>
      {p.avisos.length > 0 && (
        <section className={styles.sanciones} aria-label="Sanciones y apercibidos">
          <p className={styles.etiqueta}>Sanciones y apercibidos</p>
          <ul>
            {p.avisos.map((a) => (
              <li key={`${a.propio}-${a.persona}`} data-situacion={a.situacion}>
                <strong>
                  {a.persona}
                  <small> · {a.propio ? p.santiso : p.rival.nombre}</small>
                </strong>
                <span>{a.motivo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <details className={styles.masTareas}>
        <summary>Más tareas del partido</summary>
        {p.clasificacion && (
          <p className={styles.nota}>
            Santiso {p.clasificacion.posicion}.º de {p.clasificacion.equipos} ·{" "}
            {p.clasificacion.puntos} pts
          </p>
        )}
        <div className={styles.accesos}>
          {preparaConvocatoria(categoria) && (
            <>
              <Acceso href={e.convocatoria}>Convocatoria</Acceso>
              <Acceso href={e.once}>Once inicial</Acceso>
            </>
          )}
          <Acceso href={e.cartel("partido")}>Cartel de partido</Acceso>
          <Acceso href={e.calendario}>Cambiar fecha, hora o campo</Acceso>
          <Acceso href={e.acta} disponible={despues || Boolean(p.acta)} motivo="Tras el partido">
            {p.acta ? "Corregir acta" : "Meter acta a mano"}
          </Acceso>
          <Acceso href={e.cartel("resumo")} disponible={marcado} motivo="Necesita resultado">
            Resultado
          </Acceso>
          {/* Veteranos no alinea antes del partido: el once se publica después, con el resumen. */}
          {!preparaConvocatoria(categoria) && (
            <Acceso href={e.cartel("noso11")} disponible={despues} motivo="Tras el partido">
              Cartel del once
            </Acceso>
          )}
          <Acceso href={e.cartel("cronoloxia")} disponible={Boolean(p.acta)} motivo="Necesita acta">
            Cronoloxía
          </Acceso>
          <Acceso href={e.cartel("noso11")} disponible={Boolean(p.acta)} motivo="Necesita acta">
            O noso 11
          </Acceso>
          <button type="button" className={styles.acceso} onClick={() => setGaleria(true)}>
            Fotos del partido<span aria-hidden="true">↗</span>
          </button>
          <Acceso href={e.resultados} disponible={despues} motivo="Tras el partido">
            Importar resultados
          </Acceso>
          <Acceso href={e.clasificacion}>Ver clasificación</Acceso>
          <Acceso href="/admin/carteles?plantilla=clasificacion">Cartel de clasificación</Acceso>
        </div>
      </details>
      {galeria && (
        <GaleriaPartido
          partidoId={p.id}
          partido={`${p.santiso} – ${p.rival.nombre} · ${cuando.dia}`}
          onCerrar={() => setGaleria(false)}
          showToast={showToast}
        />
      )}
    </article>
  );
}
