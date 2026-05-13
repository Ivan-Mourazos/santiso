/**
 * components/admin/cartel/useCartelForm.ts
 * Hook to manage the poster generator form state and helpers.
 */

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase-browser";
import type { FormState } from "./types";
import type { SelectorMatch } from "./Common";
import type { Player, CronEvent, NextMatch } from "@/lib/cartel-draw";
import { fetchSeasons, fetchCompeticiones, type CompetenciaRow } from "@/lib/supabase-queries";
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

interface DbCronEventRow {
  id: string | null;
  tipo: string;
  minuto: number | null;
  es_rival?: boolean | null;
  nombre_mostrado?: string | null;
  jugador: CartelPlayer | CartelPlayer[] | null;
  jugador_relacionado: CartelPlayer | CartelPlayer[] | null;
}

interface DbLineupRow {
  titular: boolean | null;
  jugo: boolean | null;
  jugador: CartelPlayer | CartelPlayer[] | null;
}

function normalizePlayerRelation(
  player: CartelPlayer | CartelPlayer[] | null,
) {
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
  categoriasText: "FEMENINO – SENIOR – VETERANOS",
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
  clasificacionData: null,
  showAssets: true,
};

export function useCartelForm() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [equipos, setEquipos] = useState<CartelTeam[]>([]);
  const [jugadores, setJugadores] = useState<CartelPlayer[]>([]);
  const [dbMatches, setDbMatches] = useState<SelectorMatch[]>([]);
  const [campos, setCampos] = useState<CartelField[]>([]);
  const [competicionesCatalog, setCompeticionesCatalog] = useState<
    CompetenciaRow[]
  >([]);
  const catalogRef = useRef<CompetenciaRow[]>([]);
  const [jugFileName, setJugFileName] = useState("");
  const fileUrlRef = useRef<string>("");
  const multiImg1Ref = useRef<string>("");
  const multiImg2Ref = useRef<string>("");

  useEffect(() => {
    catalogRef.current = competicionesCatalog;
  }, [competicionesCatalog]);

  useEffect(() => {
    async function loadData() {
      const { active } = await fetchSeasons();
      const comps = await fetchCompeticiones();
      setCompeticionesCatalog(comps);

      const { data: jData } = await supabase.from("jugadores").select("*");
      if (jData) setJugadores(jData);

      const { data: eData } = await supabase.from("equipos").select("*");
      if (eData) setEquipos(eData);

      const { data: cData } = await supabase.from("campos_futbol").select("*");
      if (cData) setCampos(cData);

      const { data: mData } = await supabase
        .from("partidos_liga")
        .select(
          "*, equipo_local:equipo_local_id(*), equipo_visitante:equipo_visitante_id(*), jornada:jornada_id(*), campo:campo_id(*), competiciones:competicion_id(id, nombre)",
        )
        .order("fecha", { ascending: false });
      if (mData) {
        const matches = mData as SelectorMatch[];
        const activeMatches = active?.id
          ? matches.filter((match) => match.jornada?.temporada_id === active.id)
          : matches;
        setDbMatches(activeMatches);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (competicionesCatalog.length === 0) return;
    setForm((prev) => {
      if (prev.competicion_id) return prev;
      const id = pickDefaultCompetitionId(
        competicionesCatalog,
        prev.categoria,
      );
      const row = competicionesCatalog.find((c) => c.id === id);
      return {
        ...prev,
        competicion_id: id,
        competicion: row?.nombre ?? "",
      };
    });
  }, [competicionesCatalog]);

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
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

  function updatePlayer(
    list: "titulares" | "suplentes",
    i: number,
    patch: Partial<Player>,
  ) {
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

  function loadMatchFromDb(match: SelectorMatch) {
    const isSantisoLocal = match.equipo_local?.nombre
      ?.toLowerCase()
      .includes("santiso");
    const rival = isSantisoLocal ? match.equipo_visitante : match.equipo_local;
    const campoNombre = match.campo?.nombre || match.lugar || "";

    const compNombre =
      match.competiciones?.nombre ??
      match.competicion ??
      "";
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

    supabase
      .from("partido_eventos_santiso")
      .select(
        `
        id,
        tipo,
        minuto,
        es_rival,
        nombre_mostrado,
        jugador:jugador_id(id, nombre, apodo),
        jugador_relacionado:jugador_relacionado_id(id, nombre, apodo)
      `,
      )
      .eq("partido_id", match.id)
      .order("minuto", { ascending: true })
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (error || !data) return;

        const rows = data as DbCronEventRow[];
        const events: CronEvent[] = rows.map((row) => {
          const tipo = mapDbEventType(row.tipo);
          const jugador = getPlayerDisplayName(row.jugador);
          const jugadorRelacionado = getPlayerDisplayName(
            row.jugador_relacionado,
          );
          const nombreLibre = row.nombre_mostrado?.trim() || "";
          const esRival = Boolean(row.es_rival);

          return {
            id: row.id || uuidv4(),
            minuto: row.minuto ? String(row.minuto) : "",
            tipo,
            equipo: esRival ? "rival" : "local",
            jugador:
              tipo === "cambio"
                ? jugadorRelacionado
                : nombreLibre || jugador,
            jugadorEntra: tipo === "cambio" ? jugador : undefined,
          };
        });

        setForm((p) => ({ ...p, events }));
      });

    supabase
      .from("jugador_partido_stats")
      .select(
        `
        titular,
        jugo,
        jugador:jugador_id(id, nombre, apodo, dorsal, categoria)
      `,
      )
      .eq("partido_id", match.id)
      .then(({ data, error }: { data: unknown; error: { message: string } | null }) => {
        if (error || !Array.isArray(data) || data.length === 0) return;

        const rows = (data as DbLineupRow[])
          .map((row) => ({
            ...row,
            jugador: normalizePlayerRelation(row.jugador),
          }))
          .filter((row): row is DbLineupRow & { jugador: CartelPlayer } =>
            Boolean(row.jugador),
          )
          .sort((a, b) => {
            if (a.titular !== b.titular) return a.titular ? -1 : 1;
            return (a.jugador.dorsal || 999) - (b.jugador.dorsal || 999);
          });

        const titulares = rows
          .filter((row) => row.titular)
          .map((row) => toCartelPlayer(row.jugador))
          .slice(0, 11);
        const suplentes = rows
          .filter((row) => !row.titular)
          .map((row) => toCartelPlayer(row.jugador));

        if (titulares.length === 0 && suplentes.length === 0) return;

        while (titulares.length < 11) titulares.push(mkPlayer());
        while (suplentes.length < 5) suplentes.push(mkPlayer());

        setForm((p) => ({
          ...p,
          titulares,
          suplentes,
        }));
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
    dbMatches,
    campos,
    loadMatchFromDb,
    resetForm,
    competicionesCatalog,
  };
}
