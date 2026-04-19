/**
 * components/admin/cartel/useCartelForm.ts
 * Hook to manage the poster generator form state and helpers.
 */

import { useState, useRef, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import type { FormState, TemplateId } from "./types";
import type { Player, CronEvent, NextMatch } from "@/lib/cartel-draw";

function mkPlayer(): Player {
  return { id: uuidv4(), dorsal: "", nome: "", eCapitan: false };
}
function mkEvent(): CronEvent {
  return { id: uuidv4(), minuto: "", tipo: "gol", equipo: "local", jugador: "" };
}
function mkMatch(): NextMatch {
  return { rival: "", fecha: "", hora: "18:00", categoria: "Senior" };
}

const DEFAULT_FORM: FormState = {
  categoria:      "Senior",
  textoLateral:   "GRAZAS POLO VOSO APOIO",
  xuntaIsLeft:    true,
  competicion:    "TERCEIRA FUTGAL – FASE COPA – GRUPO 4",
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
  categoriasText: "FEMININO – SÉNIOR – VETERANOS",
  matches:        Array.from({ length: 3 }, mkMatch),
  jugadorFotoUrl: "",
  titulares:      Array.from({ length: 11 }, mkPlayer),
  suplentes:      Array.from({ length: 5 },  mkPlayer),
};

export function useCartelForm() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [equipos, setEquipos] = useState<{ id: string; nombre: string; escudo_url: string }[]>([]);
  const [jugFileName, setJugFileName] = useState("");
  const fileUrlRef = useRef<string>("");

  useEffect(() => {
    return () => { if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current); };
  }, []);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(p => ({ ...p, [k]: v }));
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

  return {
    form, set,
    equipos, setEquipos,
    jugFileName,
    handleRivalSelect,
    handleRivalFile,
    handleJugadorFile,
    updatePlayer,
    addEvent,
    updateEvent,
    removeEvent,
    updateMatch,
  };
}
