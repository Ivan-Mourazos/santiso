"use client";

import { Field, Select } from "@/components/ui/foundation/Fields";
import type { JornadaMatchExtracted } from "@/app/api/admin/jornada-gemini/route";
import type { CampoCatalogo, ConNombre } from "@/lib/importar/emparejar";
import styles from "./Importar.module.css";

/** Fila editable de la revisión: lo leído en la captura y cómo se va a guardar. */
export interface FilaRevision {
  key: string;
  extracted: JornadaMatchExtracted;
  localId: string;
  visitanteId: string;
  golesLocal: string;
  golesVisitante: string;
  fecha: string;
  campoId: string;
  /** Texto libre cuando el campo no está en el catálogo. */
  campoNombre: string;
  campoPoblacion: string;
  selected: boolean;
}

interface Props {
  fila: FilaRevision;
  numero: number;
  equipos: ConNombre[];
  campos: CampoCatalogo[];
  onCambiar: (cambio: Partial<FilaRevision>) => void;
  deshabilitada: boolean;
}

/**
 * Una fila de la jornada leída. Cada campo lleva el número de fila en su etiqueta: en una
 * revisión con diez partidos, «Local» a secas no dice cuál.
 */
export default function TarjetaFila({
  fila,
  numero,
  equipos,
  campos,
  onCambiar,
  deshabilitada,
}: Props) {
  const { extracted: leido } = fila;
  const nombre = leido.descansa
    ? `Fila ${numero}: ${leido.localNombre}`
    : `Fila ${numero}: ${leido.localNombre} - ${leido.visitanteNombre}`;

  return (
    <section
      className={styles.tarjeta}
      aria-label={nombre}
      data-seleccionada={leido.descansa ? undefined : fila.selected}
      data-descansa={Boolean(leido.descansa)}
    >
      <div className={styles.tarjetaCabecera}>
        {leido.descansa ? (
          <span className={styles.descansa}>Descansa · {leido.localNombre}</span>
        ) : (
          <label className={styles.casilla}>
            <input
              type="checkbox"
              checked={fila.selected}
              onChange={(e) => onCambiar({ selected: e.target.checked })}
              disabled={deshabilitada}
            />
            Guardar fila {numero}
          </label>
        )}
        <span
          className={styles.confianza}
          data-nivel={leido.confidence}
          title="Confianza de la lectura"
        >
          {leido.confidence}
        </span>
      </div>

      {!leido.descansa && (
        <>
          <div className={styles.cruce}>
            <div>
              <p className={styles.leido}>Leído: {leido.localNombre}</p>
              <Select
                label={`Local de la fila ${numero}`}
                value={fila.localId}
                onChange={(e) => onCambiar({ localId: e.target.value })}
                disabled={deshabilitada}
              >
                <option value="">Enlazar…</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div className={styles.goles}>
              <Field
                label={`Goles del local, fila ${numero}`}
                type="number"
                min={0}
                placeholder="–"
                value={fila.golesLocal}
                onChange={(e) => onCambiar({ golesLocal: e.target.value })}
                disabled={deshabilitada}
              />
              <Field
                label={`Goles del visitante, fila ${numero}`}
                type="number"
                min={0}
                placeholder="–"
                value={fila.golesVisitante}
                onChange={(e) => onCambiar({ golesVisitante: e.target.value })}
                disabled={deshabilitada}
              />
            </div>
            <div>
              <p className={styles.leido}>Leído: {leido.visitanteNombre}</p>
              <Select
                label={`Visitante de la fila ${numero}`}
                value={fila.visitanteId}
                onChange={(e) => onCambiar({ visitanteId: e.target.value })}
                disabled={deshabilitada}
              >
                <option value="">Enlazar…</option>
                {equipos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className={styles.fila}>
            <Field
              label={`Fecha y hora, fila ${numero}`}
              hint="Formato 2026-11-08T17:00; vale solo el día."
              placeholder="AAAA-MM-DDTHH:MM"
              value={fila.fecha}
              onChange={(e) => onCambiar({ fecha: e.target.value })}
              disabled={deshabilitada}
            />
            <Select
              label={`Campo, fila ${numero}`}
              value={fila.campoId}
              onChange={(e) => {
                // Elegir uno del catálogo descarta lo escrito a mano; volver a «a mano» lo recupera.
                const id = e.target.value;
                onCambiar({
                  campoId: id,
                  campoNombre: id ? "" : fila.campoNombre,
                  campoPoblacion: id ? "" : fila.campoPoblacion,
                });
              }}
              disabled={deshabilitada}
            >
              <option value="">Escribir a mano</option>
              {campos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.poblacion ? ` (${c.poblacion})` : ""}
                </option>
              ))}
            </Select>
            {!fila.campoId && (
              <>
                <Field
                  label={`Nombre del campo, fila ${numero}`}
                  value={fila.campoNombre}
                  onChange={(e) => onCambiar({ campoNombre: e.target.value })}
                  disabled={deshabilitada}
                />
                <Field
                  label={`Localidad del campo, fila ${numero}`}
                  value={fila.campoPoblacion}
                  onChange={(e) => onCambiar({ campoPoblacion: e.target.value })}
                  disabled={deshabilitada}
                />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
