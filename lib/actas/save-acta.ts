import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActaEvent, ParsedActa } from "./types";

interface SaveActaInput {
  supabase: SupabaseClient;
  partidoId: string;
  acta: ParsedActa;
}

interface PlayerStatDraft {
  jugador_id: string;
  titular: boolean;
  jugo: boolean;
  goles: number;
}

function explainSupabaseError(table: string, operation: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);

  if (message.toLowerCase().includes("unauthorized")) {
    return new Error(
      `Supabase no permite ${operation} en ${table}. Ejecuta scripts/fix_rls_acta_importer.sql en Supabase SQL Editor.`,
    );
  }

  return new Error(`${table}: ${message}`);
}

function assertSantisoPlayer(event: ActaEvent, jugadorId?: string) {
  if (event.isRival) return;
  if (!jugadorId) {
    throw new Error(
      `Falta enlazar jugador Santiso en evento ${event.tipo} minuto ${event.minuto}.`,
    );
  }
}

async function ensureCampo(
  supabase: SupabaseClient,
  campoId: string | undefined,
  nombre: string,
  poblacion: string,
) {
  if (campoId) return campoId;

  const cleanNombre = nombre.trim();
  if (!cleanNombre) return null;

  const { data: existing, error: selectError } = await supabase
    .from("campos_futbol")
    .select("id")
    .ilike("nombre", cleanNombre)
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing?.id) {
    if (poblacion.trim()) {
      const { error: updateError } = await supabase
        .from("campos_futbol")
        .update({ poblacion: poblacion.trim() })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    }
    return existing.id as string;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("campos_futbol")
    .insert({ nombre: cleanNombre, poblacion: poblacion.trim() || null })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id as string;
}

function buildStats(acta: ParsedActa) {
  const stats = new Map<string, PlayerStatDraft>();

  for (const player of acta.titulares) {
    if (!player.jugadorId) continue;
    stats.set(player.jugadorId, {
      jugador_id: player.jugadorId,
      titular: true,
      jugo: true,
      goles: 0,
    });
  }

  for (const player of acta.suplentes) {
    if (!player.jugadorId || stats.has(player.jugadorId)) continue;
    stats.set(player.jugadorId, {
      jugador_id: player.jugadorId,
      titular: false,
      jugo: false,
      goles: 0,
    });
  }

  for (const event of acta.eventos) {
    if (event.isRival) continue;

    if (event.tipo === "gol" && event.jugador?.jugadorId) {
      const stat = stats.get(event.jugador.jugadorId);
      if (stat) {
        stat.goles += 1;
        stat.jugo = true;
      }
    }

    if (
      (event.tipo === "tarjeta_amarilla" || event.tipo === "tarjeta_roja") &&
      event.jugador?.jugadorId
    ) {
      const stat = stats.get(event.jugador.jugadorId);
      if (stat) stat.jugo = true;
    }

    if (event.tipo === "cambio" && event.jugadorEntra?.jugadorId) {
      const stat = stats.get(event.jugadorEntra.jugadorId);
      if (stat) stat.jugo = true;
    }
  }

  return [...stats.values()];
}

function buildEventRows(partidoId: string, acta: ParsedActa) {
  const rows = acta.eventos.map((event) => {
    const jugadorId =
      event.tipo === "cambio"
        ? event.jugadorEntra?.jugadorId
        : event.jugador?.jugadorId;
    const jugadorRelacionadoId =
      event.tipo === "cambio" ? event.jugadorSale?.jugadorId : null;

    assertSantisoPlayer(event, jugadorId || undefined);
    if (event.tipo === "cambio" && !event.isRival && !jugadorRelacionadoId) {
      throw new Error(`Falta jugador que sale en cambio minuto ${event.minuto}.`);
    }

    return {
      partido_id: partidoId,
      tipo: event.tipo,
      minuto: Number(event.minuto) || null,
      jugador_id: event.isRival ? null : jugadorId,
      jugador_relacionado_id: event.isRival ? null : jugadorRelacionadoId,
      es_rival: event.isRival,
      nombre_mostrado: event.isRival ? event.nombreRival?.trim() || null : null,
    };
  });

  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.tipo}_${row.minuto}_${row.jugador_id}_${row.jugador_relacionado_id}_${row.es_rival}_${row.nombre_mostrado}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function saveReviewedActa({
  supabase,
  partidoId,
  acta,
}: SaveActaInput) {
  const campoId = await ensureCampo(
    supabase,
    acta.campoId,
    acta.campoNombre,
    acta.campoPoblacion,
  );

  const updatePayload: Record<string, string | number | null> = {
    goles_local: Number(acta.marcadorLocal) || 0,
    goles_visitante: Number(acta.marcadorVisitante) || 0,
    estado: "finalizado",
  };
  if (campoId) updatePayload.campo_id = campoId;

  const stats = buildStats(acta).map((stat) => ({
    ...stat,
    partido_id: partidoId,
  }));
  const events = buildEventRows(partidoId, acta);

  const { error: rpcError } = await supabase.rpc("save_reviewed_acta", {
    p_partido_id: partidoId,
    p_goles_local: updatePayload.goles_local,
    p_goles_visitante: updatePayload.goles_visitante,
    p_campo_id: campoId,
    p_stats: stats,
    p_events: events,
  });
  if (!rpcError) return;
  if (rpcError.message && !rpcError.message.includes("save_reviewed_acta")) {
    throw explainSupabaseError("save_reviewed_acta", "guardar", rpcError);
  }

  const { error: matchError } = await supabase
    .from("partidos_liga")
    .update(updatePayload)
    .eq("id", partidoId);
  if (matchError) throw explainSupabaseError("partidos_liga", "actualizar", matchError);

  const [{ error: statsDeleteError }, { error: eventsDeleteError }] =
    await Promise.all([
      supabase.from("jugador_partido_stats").delete().eq("partido_id", partidoId),
      supabase.from("partido_eventos_santiso").delete().eq("partido_id", partidoId),
    ]);
  if (statsDeleteError) {
    throw explainSupabaseError(
      "jugador_partido_stats",
      "borrar",
      statsDeleteError,
    );
  }
  if (eventsDeleteError) {
    throw explainSupabaseError(
      "partido_eventos_santiso",
      "borrar",
      eventsDeleteError,
    );
  }

  if (stats.length > 0) {
    const { error } = await supabase.from("jugador_partido_stats").insert(stats);
    if (error) {
      throw explainSupabaseError(
        "jugador_partido_stats",
        "insertar",
        error,
      );
    }
  }

  if (events.length > 0) {
    const { error } = await supabase.from("partido_eventos_santiso").insert(events);
    if (error) {
      throw explainSupabaseError(
        "partido_eventos_santiso",
        "insertar",
        error,
      );
    }
  }
}
