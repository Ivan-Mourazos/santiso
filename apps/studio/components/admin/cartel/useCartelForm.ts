/**
 * components/admin/cartel/useCartelForm.ts
 * Hook to manage the poster generator form state and helpers.
 */

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  cargarEventosDePartido,
  cargarPantallaActa,
  cargarParticipacionesDePartido,
} from "@/lib/server/acciones/actas";
import { cargarEquiposDeCategoria } from "@/lib/server/acciones/equipos";
import type { FormState } from "./types";
import type { SelectorMatch } from "./Common";
import type { Player, CronEvent, NextMatch } from "@/lib/cartel-draw";
import { fetchCompeticiones, type CompetenciaRow } from "@/lib/lecturas-cliente";
import { pickDefaultCompetitionId } from "@/lib/competition";
import { matchDateInput, matchTimeInput } from "./matchDateTime";
interface CartelPlayer {
  id: string;
  nombre: string;
  apodo?: string | null;
  dorsal?: number | null;
  categoria?: string | null;
}

interface CartelTeam {
  id: string;
  nombre: string;
  escudo_url: string;
  categoria: string;
}

interface CartelField {
  id: string;
  nombre: string;
  poblacion: string;
}

function normalizePlayerRelation(player: CartelPlayer | CartelPlayer[] | null) {
  return Array.isArray(player) ? (player[0] ?? null) : player;
}

function getPlayerDisplayName(player: CartelPlayer | CartelPlayer[] | null) {
  const normalized = normalizePlayerRelation(player);
  if (!normalized) return "";
  if (normalized.apodo) return normalized.apodo;
  if (!normalized.nombre) return "";
  const parts = normalized.nombre.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : normalized.nombre;
}

/** Nombre corto para el cartel: el apodo si lo hay, si no nombre y primer apellido. */
function nombreVisible(nombre: string | null, apodo: string | null) {
  if (apodo?.trim()) return apodo.trim();
  if (!nombre) return "";
  const partes = nombre.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes[1]}` : nombre;
}

function mapDbEventType(tipo: string): CronEvent["tipo"] {
  if (tipo === "tarjeta_amarilla") return "amarela";
  if (tipo === "tarjeta_roja") return "vermella";
  if (tipo === "cambio") return "cambio";
  return "gol";
}

function mkPlayer(): Player {
  return { id: uuidv4(), dorsal: "", nome: "", eCapitan: false };
}
function mkEvent(): CronEvent {
  return {
    id: uuidv4(),
    minuto: "",
    tipo: "gol",
    equipo: "local",
    jugador: "",
  };
}
function mkMatch(): NextMatch {
  return {
    rival: "",
    rivalEscudoUrl: "",
    fecha: "",
    hora: "18:00",
    categoria: "Senior",
    lugar: "",
    santisoSide: "right",
  };
}

function toCartelPlayer(player: CartelPlayer): Player {
  return {
    id: uuidv4(),
    dorsal: player.dorsal?.toString() || "",
    nome: getPlayerDisplayName(player),
    eCapitan: false,
  };
}

const DEFAULT_FORM: FormState = {
  categoria: "Senior",
  competicion_id: "",
  competicion: "",
  jornada: "1",
  rivalNombre: "",
  rivalEscudoUrl: "",
  fecha: "",
  hora: "18:00",
  lugar: "",
  santisoSide: "right",
  golesLocal: "0",
  golesRival: "0",
  estadio: "",
  localSponsor: "",
  rivalSponsor: "",
  events: [],
  categoriasText: "SENIOR – VETERANOS",
  matches: Array.from({ length: 3 }, mkMatch),
  jugadorFotoUrl: "",
  jugadorXOffset: 0.5,
  jugadorYOffset: 0.5,
  jugadorZoom: 1.0,
  showCarouselIndicator: true,
  noso11Flip: false,
  titulares: Array.from({ length: 11 }, mkPlayer),
  suplentes: Array.from({ length: 5 }, mkPlayer),
  multiusosTema: "celebracion",
  multiusosTitulo: "¡CAMPIÓNS DA COPA!",
  multiusosTexto: "Pasamos á seguinte fase do torneo. Parabéns a todo o equipo polo gran traballo!",
  multiusosImg1Url: "",
  multiusosImg2Url: "",
  clasificacionTipo: "liga",
  clasificacionNombre: "",
  clasificacionData: [],
  showAssets: true,
};

export function useCartelForm() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [equipos, setEquipos] = useState<CartelTeam[]>([]);
  const [jugadores, setJugadores] = useState<CartelPlayer[]>([]);
  const [dbMatches, setDbMatches] = useState<SelectorMatch[]>([]);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [campos, setCampos] = useState<CartelField[]>([]);
  const [competicionesCatalog, setCompeticionesCatalog] = useState<CompetenciaRow[]>([]);
  const catalogRef = useRef<CompetenciaRow[]>([]);
  const [jugFileName, setJugFileName] = useState("");
  const fileUrlRef = useRef<string>("");
  const matchFileUrlsRef = useRef<Record<number, string>>({});
  const multiImg1Ref = useRef<string>("");
  const multiImg2Ref = useRef<string>("");

  useEffect(() => {
    catalogRef.current = competicionesCatalog;
  }, [competicionesCatalog]);

  useEffect(() => {
    async function loadData() {
      try {
        const comps = await fetchCompeticiones();
        setCompeticionesCatalog(comps);
        // Competición por defecto en cuanto se conoce el catálogo, si no hay una elegida ya.
        // Antes lo hacía un efecto aparte que cambiaba el estado al ejecutarse.
        if (comps.length > 0) {
          setForm((prev) => {
            if (prev.competicion_id) return prev;
            const id = pickDefaultCompetitionId(comps, prev.categoria);
            const row = comps.find((c) => c.id === id);
            return { ...prev, competicion_id: id, competicion: row?.nombre ?? "" };
          });
        }

        // Una sola acción trae partidos, plantilla y campos de la temporada activa; sin
        // categoría, porque el generador trabaja con las tres.
        const { partidos, jugadores: plantilla, campos: sedes } = await cargarPantallaActa();
        if (plantilla.length > 0) setJugadores(plantilla as unknown as typeof jugadores);
        if (sedes.length > 0) setCampos(sedes as unknown as typeof campos);

        const equiposDeTodas = (
          await Promise.all(
            ["Senior", "Femenino", "Veteranos"].map((c) => cargarEquiposDeCategoria(c)),
          )
        ).flat();
        setEquipos(equiposDeTodas as unknown as typeof equipos);
        setDbMatches(partidos as unknown as SelectorMatch[]);
        setErrorDatos(null);
      } catch (error) {
        // Sin respaldo inventado: antes se rellenaba con equipos y partidos escritos a mano,
        // cuyos identificadores no existen en la base de datos. El cartel salía con datos
        // falsos y sin avisar.
        console.error("cargarDatosDelCartel", error);
        setCompeticionesCatalog([]);
        setDbMatches([]);
        setEquipos([]);
        setErrorDatos("No se pudieron cargar los datos. Revisa la base de datos.");
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    // El registro de escudos por partido se modifica en el sitio, nunca se reasigna: capturarlo
    // aquí apunta al mismo objeto que habrá al desmontar.
    const escudosPartidos = matchFileUrlsRef.current;
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      Object.values(escudosPartidos).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
      if (multiImg1Ref.current) URL.revokeObjectURL(multiImg1Ref.current);
      if (multiImg2Ref.current) URL.revokeObjectURL(multiImg2Ref.current);
    };
  }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      const cat = catalogRef.current;
      if (k === "categoria" && typeof v === "string") {
        const id = pickDefaultCompetitionId(cat, v);
        const row = cat.find((c) => c.id === id);
        next.competicion_id = id;
        next.competicion = row?.nombre ?? "";
      }
      if (k === "competicion_id" && typeof v === "string") {
        const row = cat.find((c) => c.id === v);
        next.competicion = row?.nombre ?? next.competicion;
      }
      return next;
    });
  }

  function resetForm() {
    const cat = catalogRef.current;
    const id = pickDefaultCompetitionId(cat, "Senior");
    const row = cat.find((c) => c.id === id);
    setForm({
      ...DEFAULT_FORM,
      competicion_id: id,
      competicion: row?.nombre ?? "",
    });
    setJugFileName("");
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = "";
    }
    if (multiImg1Ref.current) {
      URL.revokeObjectURL(multiImg1Ref.current);
      multiImg1Ref.current = "";
    }
    if (multiImg2Ref.current) {
      URL.revokeObjectURL(multiImg2Ref.current);
      multiImg2Ref.current = "";
    }
  }

  function handleRivalSelect(nombre: string) {
    const eq = equipos.find((e) => e.nombre === nombre);
    setForm((p) => ({
      ...p,
      rivalNombre: nombre,
      rivalEscudoUrl: eq?.escudo_url || "",
    }));
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = "";
    }
  }

  function handleRivalFile(file: File) {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setForm((p) => ({ ...p, rivalEscudoUrl: url }));
  }

  function handleJugadorFile(file: File) {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setJugFileName(file.name);
    setForm((p) => ({ ...p, jugadorFotoUrl: url }));
  }

  function updatePlayer(list: "titulares" | "suplentes", i: number, patch: Partial<Player>) {
    setForm((p) => {
      const arr = [...p[list]];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, [list]: arr };
    });
  }

  function swapPlayers(list: "titulares" | "suplentes", indexA: number, indexB: number) {
    setForm((p) => {
      const arr = [...p[list]];
      if (indexA < 0 || indexA >= arr.length || indexB < 0 || indexB >= arr.length) return p;
      const temp = arr[indexA];
      arr[indexA] = arr[indexB];
      arr[indexB] = temp;
      return { ...p, [list]: arr };
    });
  }

  function addEvent() {
    setForm((p) => ({ ...p, events: [...p.events, mkEvent()] }));
  }
  function updateEvent(i: number, patch: Partial<CronEvent>) {
    setForm((p) => {
      const evts = [...p.events];
      evts[i] = { ...evts[i], ...patch };
      return { ...p, events: evts };
    });
  }
  function removeEvent(id: string) {
    setForm((p) => ({ ...p, events: p.events.filter((e) => e.id !== id) }));
  }

  function updateMatch(i: number, patch: Partial<NextMatch>) {
    setForm((p) => {
      const ms = [...p.matches];
      ms[i] = { ...ms[i], ...patch };
      return { ...p, matches: ms };
    });
  }

  function handleMatchRivalFile(i: number, file: File | null) {
    if (matchFileUrlsRef.current[i]) {
      URL.revokeObjectURL(matchFileUrlsRef.current[i]);
      delete matchFileUrlsRef.current[i];
    }
    if (!file) {
      updateMatch(i, { rivalEscudoUrl: "" });
      return;
    }
    const url = URL.createObjectURL(file);
    matchFileUrlsRef.current[i] = url;
    updateMatch(i, { rivalEscudoUrl: url });
  }

  function loadMatchFromDb(match: SelectorMatch) {
    const isSantisoLocal = match.equipo_local?.nombre?.toLowerCase().includes("santiso");
    const rival = isSantisoLocal ? match.equipo_visitante : match.equipo_local;
    const campoNombre = match.campo?.nombre || match.lugar || "";

    const compNombre = match.competiciones?.nombre ?? match.competicion ?? "";
    const compId = match.competicion_id ?? "";

    setForm((p) => ({
      ...p,
      categoria: match.categoria || p.categoria,
      competicion_id: compId || p.competicion_id,
      competicion: compNombre || p.competicion,
      jornada: match.jornada?.numero?.toString() || "1",
      rivalNombre: rival?.nombre || "",
      rivalEscudoUrl: rival?.escudo_url || "",
      fecha: matchDateInput(match.fecha),
      hora: matchTimeInput(match.fecha),
      lugar: campoNombre,
      estadio: campoNombre,
      santisoSide: isSantisoLocal ? "left" : "right",
      golesLocal: match.goles_local?.toString() || "0",
      golesRival: match.goles_visitante?.toString() || "0",
      events: [],
    }));

    // `propia` ya es una columna: no hay que deducirla del nombre mostrado como antes.
    cargarEventosDePartido(match.id).then((filas) => {
      const events: CronEvent[] = filas.map((fila) => {
        let tipo = mapDbEventType(fila.tipo);
        if (tipo === "gol" && fila.propia) tipo = "propia";
        const esRival = fila.lado === "rival";
        const nombreJugador = nombreVisible(fila.jugadorNombre, fila.jugadorApodo);
        const nombreSale = nombreVisible(fila.saleNombre, fila.saleApodo);

        return {
          id: fila.id || uuidv4(),
          minuto: fila.minuto !== null ? String(fila.minuto) : "",
          tipo,
          equipo: esRival ? "rival" : "local",
          jugador: tipo === "cambio" ? nombreSale : nombreJugador || fila.nombreRival?.trim() || "",
          jugadorEntra: tipo === "cambio" ? nombreJugador : undefined,
        };
      });

      setForm((p) => ({ ...p, events }));
    });

    // La consulta ya devuelve titulares primero y luego por dorsal.
    cargarParticipacionesDePartido(match.id).then((filas) => {
      if (filas.length === 0) return;

      const aJugador = (fila: (typeof filas)[number]) =>
        toCartelPlayer({
          id: fila.id,
          nombre: fila.nombre,
          apodo: fila.apodo,
          dorsal: fila.dorsal,
          categoria: fila.categoria,
        });

      const titulares = filas
        .filter((f) => f.titular)
        .map(aJugador)
        .slice(0, 11);
      const suplentes = filas.filter((f) => !f.titular).map(aJugador);
      if (titulares.length === 0 && suplentes.length === 0) return;

      while (titulares.length < 11) titulares.push(mkPlayer());
      while (suplentes.length < 5) suplentes.push(mkPlayer());

      setForm((p) => ({ ...p, titulares, suplentes }));
    });
  }

  function handleMultiusosFile(num: 1 | 2, file: File | null) {
    const ref = num === 1 ? multiImg1Ref : multiImg2Ref;
    const key = num === 1 ? "multiusosImg1Url" : "multiusosImg2Url";

    if (ref.current) {
      URL.revokeObjectURL(ref.current);
      ref.current = "";
    }
    if (!file) {
      set(key, "");
      return;
    }
    const url = URL.createObjectURL(file);
    ref.current = url;
    set(key, url);
  }

  return {
    form,
    set,
    errorDatos,
    equipos,
    setEquipos,
    jugadores,
    jugFileName,
    handleRivalSelect,
    handleRivalFile,
    handleJugadorFile,
    handleMultiusosFile,
    updatePlayer,
    swapPlayers,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
    handleMatchRivalFile,
    dbMatches,
    campos,
    loadMatchFromDb,
    resetForm,
    competicionesCatalog,
  };
}
