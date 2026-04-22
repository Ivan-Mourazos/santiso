/**
 * components/admin/cartel/useCartelForm.ts
 * Hook to manage the poster generator form state and helpers.
 */

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabase";
import { COMPETICIONS, type FormState, type TemplateId } from "./types";
import type { Player, CronEvent, NextMatch } from "@/lib/cartel-draw";

function mkPlayer(): Player {
  return { id: uuidv4(), dorsal: "", nome: "", eCapitan: false };
}
function mkEvent(): CronEvent {
  return { id: uuidv4(), minuto: "", tipo: "gol", equipo: "local", jugador: "" };
}
function mkMatch(): NextMatch {
  return { rival: "", rivalEscudoUrl: "", fecha: "", hora: "18:00", categoria: "Senior", santisoSide: "right" };
}

const DEFAULT_FORM: FormState = {
  categoria:      "Senior",
  competicion:    COMPETICIONS["Senior"][0],
  jornada:        "1",
  rivalNombre:    "",
  rivalEscudoUrl: "",
  fecha:          "",
  hora:           "18:00",
  lugar:          "",
  santisoSide:    "right",
  golesLocal:     "0",
  golesRival:     "0",
  estadio:        "",
  localSponsor:   "",
  rivalSponsor:   "",
  events:         [],
  categoriasText: "FEMENINO – SENIOR – VETERANOS",
  matches:        Array.from({ length: 3 }, mkMatch),
  jugadorFotoUrl: "",
  jugadorXOffset: 0.5,
  jugadorYOffset: 0.5,
  jugadorZoom:    1.0,
  showCarouselIndicator: true,
  noso11Flip:     false,
  titulares:      Array.from({ length: 11 }, mkPlayer),
  suplentes:      Array.from({ length: 5 },  mkPlayer),
};

export function useCartelForm() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [equipos, setEquipos] = useState<{ id: string; nombre: string; escudo_url: string; categoria: string }[]>([]);
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [dbMatches, setDbMatches] = useState<any[]>([]);
  const [campos, setCampos] = useState<any[]>([]);
  const [jugFileName, setJugFileName] = useState("");
  const fileUrlRef = useRef<string>("");

  useEffect(() => {
    async function loadData() {
      const { data: jData } = await supabase.from("jugadores").select("*");
      if (jData) setJugadores(jData);

      const { data: eData } = await supabase.from("equipos").select("*");
      if (eData) setEquipos(eData);

      const { data: cData } = await supabase.from("campos_futbol").select("*");
      if (cData) setCampos(cData);

      const { data: mData } = await supabase
        .from("partidos_liga")
        .select("*, equipo_local:equipo_local_id(*), equipo_visitante:equipo_visitante_id(*)")
        .order("fecha", { ascending: false });
      if (mData) setDbMatches(mData);
    }
    loadData();
  }, []);

  useEffect(() => {
    return () => { if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current); };
  }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === "categoria" && typeof v === "string") {
        next.competicion = COMPETICIONS[v]?.[0] || "";
      }
      return next;
    });
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setJugFileName("");
    if (fileUrlRef.current) { URL.revokeObjectURL(fileUrlRef.current); fileUrlRef.current = ""; }
  }

  function handleRivalSelect(nombre: string) {
    const eq = equipos.find(e => e.nombre === nombre);
    setForm(p => ({ ...p, rivalNombre: nombre, rivalEscudoUrl: eq?.escudo_url || "" }));
    if (fileUrlRef.current) { URL.revokeObjectURL(fileUrlRef.current); fileUrlRef.current = ""; }
  }

  function handleRivalFile(file: File) {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setForm(p => ({ ...p, rivalEscudoUrl: url }));
  }

  function handleJugadorFile(file: File) {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    const url = URL.createObjectURL(file);
    fileUrlRef.current = url;
    setJugFileName(file.name);
    setForm(p => ({ ...p, jugadorFotoUrl: url }));
  }

  function updatePlayer(list: "titulares" | "suplentes", i: number, patch: Partial<Player>) {
    setForm(p => {
      const arr = [...p[list]];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, [list]: arr };
    });
  }

  function addEvent() {
    setForm(p => ({ ...p, events: [...p.events, mkEvent()] }));
  }
  function updateEvent(i: number, patch: Partial<CronEvent>) {
    setForm(p => {
      const evts = [...p.events];
      evts[i] = { ...evts[i], ...patch };
      return { ...p, events: evts };
    });
  }
  function removeEvent(id: string) {
    setForm(p => ({ ...p, events: p.events.filter(e => e.id !== id) }));
  }

  function updateMatch(i: number, patch: Partial<NextMatch>) {
    setForm(p => {
      const ms = [...p.matches];
      ms[i] = { ...ms[i], ...patch };
      return { ...p, matches: ms };
    });
  }

  function loadMatchFromDb(match: any) {
    const isSantisoLocal = match.local.nombre.toLowerCase().includes("santiso");
    const rival = isSantisoLocal ? match.visitante : match.local;
    
    setForm(p => ({
      ...p,
      categoria: match.categoria,
      jornada: match.jornada?.numero?.toString() || "1",
      rivalNombre: rival.nombre,
      rivalEscudoUrl: rival.escudo_url,
      fecha: match.fecha ? match.fecha.split("T")[0] : "",
      hora: match.fecha ? match.fecha.split("T")[1].substring(0, 5) : "18:00",
      lugar: match.lugar || "",
      santisoSide: isSantisoLocal ? "left" : "right",
      golesLocal: match.goles_local?.toString() || "0",
      golesRival: match.goles_visitante?.toString() || "0",
    }));

    // Cargar estadísticas si existen (goleadores, etc)
    supabase.from("estadisticas_partido_santiso")
      .select("*")
      .eq("partido_id", match.id)
      .single()
      .then(({ data }) => {
        if (data) {
          // Aquí podríamos mapear eventos a la cronología si quisiéramos,
          // por ahora guardamos los datos base.
          console.log("Estadísticas extra cargadas:", data);
        }
      });
  }

  return {
    form, set,
    equipos, setEquipos,
    jugadores,
    jugFileName,
    handleRivalSelect,
    handleRivalFile,
    handleJugadorFile,
    updatePlayer,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
    dbMatches,
    loadMatchFromDb,
    resetForm,
  };
}
