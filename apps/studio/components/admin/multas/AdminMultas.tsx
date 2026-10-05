"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/foundation/Button";
import { Field, Select } from "@/components/ui/foundation/Fields";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/foundation/States";
import { Tabs } from "@/components/ui/foundation/Tabs";
import { hoyLocal } from "@/lib/jornada/semana";
import {
  centimosDe,
  euros,
  GRUPOS_MULTA,
  importeDeMulta,
  NOMBRE_GRUPO,
  opcionesDeTexto,
  resumirMultas,
  unidadesDe,
  type ConceptoMulta,
  type Multa,
  type PantallaMultas,
} from "@/lib/multas/modelo";
import {
  cambiarPagoMulta,
  cargarPantallaMultas,
  guardarConcepto,
  ponerMulta,
  quitarMulta,
} from "@/lib/server/acciones/multas";
import styles from "./Multas.module.css";

interface Props {
  showToast: (msg: string, type?: "success" | "error") => void;
  showConfirm: (msg: string, onConfirm: () => void) => void;
}

const sinCeros = (centimos: number) => euros(centimos).replace(" €", "");
const fechaCorta = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/**
 * Multas internas del club: se ponen desde el móvil en dos toques (quién y por qué; el importe
 * sale de las normas), se cobran y se ve el bote. Datos privados del vestuario.
 */
export default function AdminMultas({ showToast, showConfirm }: Props) {
  const [pantalla, setPantalla] = useState<PantallaMultas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState("multas");

  const cargar = useCallback(async () => {
    const r = await cargarPantallaMultas();
    if (!r.ok) return setError(r.error);
    setError(null);
    setPantalla(r.datos);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void cargar(), 0);
    return () => window.clearTimeout(id);
  }, [cargar]);

  if (error) {
    return (
      <ErrorState
        title="No se pudieron cargar las multas"
        detail={error}
        action={<Button onClick={() => void cargar()}>Reintentar</Button>}
      />
    );
  }
  if (!pantalla) return <LoadingState title="Cargando multas…" />;
  if (!pantalla.temporada) {
    return (
      <EmptyState
        title="No hay temporada activa."
        detail="Créala en Ajustes › Temporadas para empezar a apuntar multas."
      />
    );
  }

  return (
    <div className={styles.panel}>
      <header className={styles.cabecera}>
        <h3>Multas · {pantalla.temporada.nombre}</h3>
        <p>Registro interno del vestuario. No sale en carteles ni en ninguna exportación.</p>
      </header>
      <Tabs
        label="Multas"
        value={pestana}
        onValueChange={setPestana}
        items={[
          {
            value: "multas",
            label: "Multas",
            content: (
              <Registro
                pantalla={pantalla}
                recargar={cargar}
                showToast={showToast}
                showConfirm={showConfirm}
              />
            ),
          },
          { value: "resumen", label: "Bote", content: <Resumen multas={pantalla.multas} /> },
          {
            value: "normas",
            label: "Normas",
            content: (
              <Normas conceptos={pantalla.conceptos} recargar={cargar} showToast={showToast} />
            ),
          },
        ]}
      />
    </div>
  );
}

// ─── Multas: alta rápida y lista ────────────────────────────────────────────────────────────

function Registro({
  pantalla,
  recargar,
  showToast,
  showConfirm,
}: {
  pantalla: PantallaMultas;
  recargar: () => Promise<void>;
} & Props) {
  const [personaClave, setPersonaClave] = useState("");
  const [conceptoId, setConceptoId] = useState("");
  const [unidades, setUnidades] = useState("1");
  /** Opciones marcadas del concepto («Medias 1ª», «Peto»…): cada una es una unidad. */
  const [elegidas, setElegidas] = useState<string[]>([]);
  /** Importe escrito a mano; `null` = el de las normas. */
  const [aMano, setAMano] = useState<string | null>(null);
  const [fecha, setFecha] = useState(() => hoyLocal());
  const [nota, setNota] = useState("");
  const [ocupada, setOcupada] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(true);
  const [filtroPersona, setFiltroPersona] = useState("");

  const persona = pantalla.personas.find((p) => p.clave === personaClave);
  const concepto = pantalla.conceptos.find((c) => c.id === conceptoId);
  const segunNormas = concepto
    ? importeDeMulta(
        concepto,
        unidadesDe(concepto, Number(unidades), elegidas),
        Boolean(persona?.adestrador),
      )
    : null;

  const jugadores = pantalla.personas.filter((p) => p.tipo === "jugador");
  const tecnicos = pantalla.personas.filter((p) => p.tipo === "staff");
  const activos = pantalla.conceptos.filter((c) => c.activo);

  const visibles = pantalla.multas.filter(
    (m) =>
      (!soloPendientes || !m.pagadaEn) && (!filtroPersona || m.personaClave === filtroPersona),
  );
  const multados = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const m of pantalla.multas) vistos.set(m.personaClave, m.persona);
    return [...vistos.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [pantalla.multas]);

  async function poner(e: React.FormEvent) {
    e.preventDefault();
    if (!personaClave) return showToast("Elige a quién.", "error");
    if (!conceptoId) return showToast("Elige el motivo de la multa.", "error");
    const importe = aMano === null ? null : centimosDe(aMano);
    if (aMano !== null && importe === null) return showToast("El importe no es válido.", "error");
    setOcupada(true);
    try {
      const r = await ponerMulta({
        personaClave,
        conceptoId,
        unidades: Number(unidades) || 1,
        opciones: elegidas,
        importeCentimos: importe,
        fecha,
        nota,
      });
      if (!r.ok) return showToast(r.error, "error");
      await recargar();
      showToast("Multa apuntada");
      // Se queda el motivo y la fecha: lo normal es apuntar a varios seguidos por lo mismo.
      setPersonaClave("");
      setElegidas([]);
      setAMano(null);
      setNota("");
    } finally {
      setOcupada(false);
    }
  }

  async function cobrar(multa: Multa) {
    const r = await cambiarPagoMulta(multa.id, !multa.pagadaEn);
    if (!r.ok) return showToast(r.error, "error");
    await recargar();
  }

  function quitar(multa: Multa) {
    showConfirm(`¿Quitar la multa de ${multa.persona} (${multa.concepto})?`, async () => {
      const r = await quitarMulta(multa.id);
      if (!r.ok) return showToast(r.error, "error");
      await recargar();
      showToast("Multa quitada");
    });
  }

  return (
    <div className={styles.seccion}>
      <form className={styles.alta} onSubmit={(e) => void poner(e)} aria-label="Nueva multa">
        <Select
          label="A quién"
          value={personaClave}
          onChange={(e) => {
            setPersonaClave(e.target.value);
            setAMano(null);
          }}
        >
          <option value="">Elegir…</option>
          {jugadores.length > 0 && (
            <optgroup label="Jugadores">
              {jugadores.map((p) => (
                <option key={p.clave} value={p.clave}>
                  {p.nombre} · {p.detalle}
                </option>
              ))}
            </optgroup>
          )}
          {tecnicos.length > 0 && (
            <optgroup label="Cuerpo técnico (pagan el doble)">
              {tecnicos.map((p) => (
                <option key={p.clave} value={p.clave}>
                  {p.nombre} · {p.detalle}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <Select
          label="Motivo"
          value={conceptoId}
          onChange={(e) => {
            setConceptoId(e.target.value);
            setAMano(null);
            setUnidades("1");
            setElegidas([]);
          }}
        >
          <option value="">Elegir…</option>
          {GRUPOS_MULTA.map((grupo) => (
            <optgroup key={grupo} label={NOMBRE_GRUPO[grupo]}>
              {activos
                .filter((c) => c.grupo === grupo)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} — {euros(c.importeCentimos)}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
        {concepto?.porUnidad && concepto.opciones.length > 0 && (
          <fieldset className={styles.opciones}>
            <legend>Qué falta ({euros(concepto.importeCentimos)} cada una)</legend>
            {concepto.opciones.map((opcion) => {
              const marcada = elegidas.includes(opcion);
              return (
                <Button
                  key={opcion}
                  size="sm"
                  variant={marcada ? "primary" : "secondary"}
                  aria-pressed={marcada}
                  onClick={() => {
                    setAMano(null);
                    setElegidas(
                      marcada ? elegidas.filter((o) => o !== opcion) : [...elegidas, opcion],
                    );
                  }}
                >
                  {opcion}
                </Button>
              );
            })}
          </fieldset>
        )}
        <div className={styles.importes}>
          {concepto?.porUnidad && concepto.opciones.length === 0 && (
            <Field
              label="Unidades"
              type="number"
              min={1}
              inputMode="numeric"
              value={unidades}
              onChange={(e) => {
                setUnidades(e.target.value);
                setAMano(null);
              }}
            />
          )}
          <Field
            label="Importe (€)"
            inputMode="decimal"
            value={aMano ?? (segunNormas === null ? "" : sinCeros(segunNormas))}
            onChange={(e) => setAMano(e.target.value)}
            hint={
              persona?.adestrador && aMano === null && concepto
                ? "Cuerpo técnico: el doble."
                : undefined
            }
          />
          <Field
            label="Fecha"
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <Field
          label="Nota (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Partido contra…, detalle…"
        />
        <Button type="submit" pending={ocupada} pendingLabel="Apuntando…">
          Poner multa
        </Button>
      </form>

      <div className={styles.filtros} role="group" aria-label="Qué multas se ven">
        <Button
          size="sm"
          variant={soloPendientes ? "primary" : "secondary"}
          aria-pressed={soloPendientes}
          onClick={() => setSoloPendientes(true)}
        >
          Pendientes
        </Button>
        <Button
          size="sm"
          variant={soloPendientes ? "secondary" : "primary"}
          aria-pressed={!soloPendientes}
          onClick={() => setSoloPendientes(false)}
        >
          Todas
        </Button>
        {multados.length > 1 && (
          <select
            className={styles.filtroPersona}
            aria-label="Filtrar por persona"
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
          >
            <option value="">Todos</option>
            {multados.map(([clave, nombre]) => (
              <option key={clave} value={clave}>
                {nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className={styles.vacio}>
          {pantalla.multas.length === 0
            ? "Todavía no hay multas esta temporada."
            : "No hay multas con ese filtro."}
        </p>
      ) : (
        <ul className={styles.lista} aria-label="Multas">
          {visibles.map((m) => (
            <li key={m.id} data-pagada={Boolean(m.pagadaEn)}>
              <div className={styles.quien}>
                <strong>{m.persona}</strong>
                <span>
                  {m.concepto} · {fechaCorta(m.fecha)}
                  {m.nota ? ` · ${m.nota}` : ""}
                </span>
              </div>
              <span className={styles.importe}>{euros(m.importeCentimos)}</span>
              <div className={styles.accionesFila}>
                <Button
                  size="sm"
                  variant={m.pagadaEn ? "secondary" : "primary"}
                  aria-pressed={Boolean(m.pagadaEn)}
                  aria-label={
                    m.pagadaEn
                      ? `Pagada: ${m.persona}, ${m.concepto}. Volver a pendiente`
                      : `Cobrar a ${m.persona}: ${m.concepto}`
                  }
                  onClick={() => void cobrar(m)}
                >
                  {m.pagadaEn ? `Pagada ${fechaCorta(m.pagadaEn)}` : "Cobrar"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Quitar la multa de ${m.persona}: ${m.concepto}`}
                  onClick={() => quitar(m)}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Bote ───────────────────────────────────────────────────────────────────────────────────

function Resumen({ multas }: { multas: Multa[] }) {
  const resumen = useMemo(() => resumirMultas(multas), [multas]);
  return (
    <div className={styles.seccion}>
      <div className={styles.totales}>
        <div>
          <strong>{euros(resumen.boteCentimos)}</strong>
          <span>en el bote (cobrado)</span>
        </div>
        <div>
          <strong>{euros(resumen.pendienteCentimos)}</strong>
          <span>pendiente de cobrar</span>
        </div>
      </div>
      {resumen.personas.length === 0 ? (
        <p className={styles.vacio}>Todavía no hay multas esta temporada.</p>
      ) : (
        <table className={styles.tabla} aria-label="Multas por persona">
          <thead>
            <tr>
              <th scope="col">Persona</th>
              <th scope="col">Multas</th>
              <th scope="col">Debe</th>
              <th scope="col">Pagado</th>
            </tr>
          </thead>
          <tbody>
            {resumen.personas.map((p) => (
              <tr key={p.personaClave}>
                <th scope="row">{p.persona}</th>
                <td>{p.multas}</td>
                <td data-debe={p.pendienteCentimos > 0}>{euros(p.pendienteCentimos)}</td>
                <td>{euros(p.pagadoCentimos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Normas: catálogo de conceptos ──────────────────────────────────────────────────────────

function Normas({
  conceptos,
  recargar,
  showToast,
}: {
  conceptos: ConceptoMulta[];
  recargar: () => Promise<void>;
  showToast: Props["showToast"];
}) {
  return (
    <div className={styles.seccion}>
      <p className={styles.nota}>
        Cambiar una norma no cambia las multas ya puestas. El cuerpo técnico paga el doble.
      </p>
      {GRUPOS_MULTA.map((grupo) => (
        <section key={grupo} aria-label={NOMBRE_GRUPO[grupo]}>
          <h4 className={styles.grupo}>{NOMBRE_GRUPO[grupo]}</h4>
          <ul className={styles.normas}>
            {conceptos
              .filter((c) => c.grupo === grupo)
              .map((c) => (
                <FilaConcepto key={c.id} concepto={c} recargar={recargar} showToast={showToast} />
              ))}
            <FilaConcepto
              key={`nuevo-${grupo}-${conceptos.length}`}
              concepto={{
                id: "",
                nombre: "",
                grupo,
                importeCentimos: 0,
                porUnidad: false,
                opciones: [],
                activo: true,
              }}
              recargar={recargar}
              showToast={showToast}
            />
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilaConcepto({
  concepto,
  recargar,
  showToast,
}: {
  concepto: ConceptoMulta;
  recargar: () => Promise<void>;
  showToast: Props["showToast"];
}) {
  const nuevo = concepto.id === "";
  const inicial = {
    nombre: concepto.nombre,
    importe: nuevo ? "" : sinCeros(concepto.importeCentimos),
    porUnidad: concepto.porUnidad,
    opciones: concepto.opciones.join(", "),
    activo: concepto.activo,
  };
  const [borrador, setBorrador] = useState(inicial);
  const [ocupada, setOcupada] = useState(false);
  const sucio = JSON.stringify(borrador) !== JSON.stringify(inicial);
  const etiqueta = nuevo ? `nuevo concepto de ${NOMBRE_GRUPO[concepto.grupo]}` : concepto.nombre;

  async function guardar() {
    const importeCentimos = centimosDe(borrador.importe);
    if (importeCentimos === null) return showToast("El importe no es válido.", "error");
    setOcupada(true);
    try {
      const r = await guardarConcepto({
        id: concepto.id || undefined,
        nombre: borrador.nombre,
        grupo: concepto.grupo,
        importeCentimos,
        porUnidad: borrador.porUnidad,
        opciones: opcionesDeTexto(borrador.opciones),
        activo: borrador.activo,
      });
      if (!r.ok) return showToast(r.error, "error");
      await recargar();
      showToast(nuevo ? "Concepto añadido" : "Norma guardada");
    } finally {
      setOcupada(false);
    }
  }

  return (
    <li data-inactivo={!borrador.activo}>
      <input
        className={styles.normaNombre}
        aria-label={`Nombre: ${etiqueta}`}
        placeholder={nuevo ? "Añadir concepto…" : undefined}
        value={borrador.nombre}
        onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
      />
      <input
        className={styles.normaImporte}
        aria-label={`Importe en euros: ${etiqueta}`}
        inputMode="decimal"
        placeholder="€"
        value={borrador.importe}
        onChange={(e) => setBorrador({ ...borrador, importe: e.target.value })}
      />
      <label className={styles.casilla}>
        <input
          type="checkbox"
          checked={borrador.porUnidad}
          onChange={(e) => setBorrador({ ...borrador, porUnidad: e.target.checked })}
        />
        por unidad
      </label>
      {borrador.porUnidad && (
        <input
          className={styles.normaOpciones}
          aria-label={`Opciones para marcar, separadas por comas: ${etiqueta}`}
          placeholder="Opciones para marcar, separadas por comas (Medias 1ª, Peto…)"
          value={borrador.opciones}
          onChange={(e) => setBorrador({ ...borrador, opciones: e.target.value })}
        />
      )}
      {!nuevo && (
        <label className={styles.casilla}>
          <input
            type="checkbox"
            checked={borrador.activo}
            onChange={(e) => setBorrador({ ...borrador, activo: e.target.checked })}
          />
          en uso
        </label>
      )}
      <Button
        size="sm"
        variant={sucio ? "primary" : "secondary"}
        disabled={!sucio || !borrador.nombre.trim()}
        pending={ocupada}
        pendingLabel="…"
        aria-label={`${nuevo ? "Añadir" : "Guardar"}: ${etiqueta}`}
        onClick={() => void guardar()}
      >
        {nuevo ? "Añadir" : "Guardar"}
      </Button>
    </li>
  );
}
