import {
  codigoDeTemporada,
  competicionesDeClubHtml,
  parsearEstadisticasJugador,
  partidosConCodigos,
} from "@santiso/actas";

import { schema as s } from "@santiso/db";

import {
  esEquipoPropio,
  normalizarNombreEquipo,
  normalizarNombreCompeticion,
} from "@santiso/domain";

import { and, eq, isNotNull } from "drizzle-orm";

import { filasDeHistorial } from "@/lib/plantilla/historial";

import { emparejarClubes } from "@/lib/rfgf/clubes";

import { urlEstadisticasJugador, urlJornada } from "@/lib/rfgf/enlace";

import { obtenerDb } from "@/lib/server/db";

import type { DescargadorRfgf } from "./descargador";

const claveClub = (codigo: string, temporada: string) => `${codigo}:${temporada}`;

const publicada = (temporada: string) =>
  Number(temporada.slice(0, 4)) >= 2014 && temporada !== "2020-2021";

/** Solo lectura del historial. Conserva elecciones mientras no cambie la línea. */

export async function reconciliarAnteriores() {
  const { db } = await obtenerDb();

  const jugadores = await db
    .select({
      id: s.jugadores.id,
      historial: s.jugadores.historial,
      codigo: s.rfgfJugadores.codigo,
    })

    .from(s.jugadores)
    .innerJoin(s.rfgfJugadores, eq(s.rfgfJugadores.jugadorId, s.jugadores.id));

  const clubes = await db
    .select({ codigo: s.rfgfClubes.codigo, nombre: s.rfgfClubes.nombre })
    .from(s.rfgfClubes);

  const existentes = await db.select().from(s.rfgfAnterioresPeticiones);

  const vigentes = new Set<string>();

  const vistos = new Set<string>();

  for (const jugador of jugadores) {
    if (vistos.has(jugador.id)) continue;

    vistos.add(jugador.id);

    for (const fila of filasDeHistorial((jugador.historial ?? []).join("\n"))) {
      if (!fila.temporada || esEquipoPropio(fila.equipo)) continue;

      const linea = `${fila.temporada}: ${fila.equipo}`;

      const clave = `${jugador.id}:${linea}`;

      vigentes.add(clave);

      const previa = existentes.find((p) => p.jugadorId === jugador.id && p.linea === linea);

      if (previa && previa.estado !== "sin_club") continue;

      const nombre = fila.equipo.replace(/\([^)]*\)/gu, "").trim();

      const pareja = emparejarClubes([{ id: "club", nombre }], clubes);

      const clubCodigo = previa?.manual ? previa.clubCodigo : (pareja.enlazados[0]?.codigo ?? null);

      const anio = Number(fila.temporada.slice(0, 2));
      const inicio = (anio >= 70 ? 1900 : 2000) + anio;

      const temporada = `${inicio}-${inicio + 1}`;

      const estado = !publicada(temporada) ? "sin_datos" : clubCodigo ? "pendiente" : "sin_club";

      const valores = {
        jugadorId: jugador.id,
        linea,
        temporada,
        club: normalizarNombreEquipo(nombre, "Senior"),
        codigo: jugador.codigo,

        clubCodigo,
        estado,
        candidatos: pareja.dudosos[0]?.candidatos ?? [],
      } as const;

      await db
        .insert(s.rfgfAnterioresPeticiones)
        .values({ ...valores, candidatos: [...valores.candidatos] })

        .onConflictDoUpdate({
          target: [s.rfgfAnterioresPeticiones.jugadorId, s.rfgfAnterioresPeticiones.linea],
          set: { clubCodigo, estado, candidatos: [...valores.candidatos] },
        });
    }
  }

  for (const p of existentes)
    if (!vigentes.has(`${p.jugadorId}:${p.linea}`))
      await db.delete(s.rfgfAnterioresPeticiones).where(eq(s.rfgfAnterioresPeticiones.id, p.id));
}

/** Elección local: nunca descarga ni toca el historial. */

export async function elegirClubAnterior(id: string, codigo: string) {
  if (!/^\d+$/u.test(codigo)) throw new Error("Código de club inválido.");

  const { db } = await obtenerDb();

  const [club] = await db.select().from(s.rfgfClubes).where(eq(s.rfgfClubes.codigo, codigo));

  if (!club) throw new Error("Ese código no está en el listado de clubes.");

  const [p] = await db
    .select()
    .from(s.rfgfAnterioresPeticiones)
    .where(eq(s.rfgfAnterioresPeticiones.id, id));

  if (!p || p.estado !== "sin_club") throw new Error("Esa petición ya no necesita elegir club.");

  await db
    .update(s.rfgfAnterioresPeticiones)
    .set({
      clubCodigo: codigo,
      manual: true,
      estado: publicada(p.temporada) ? "pendiente" : "sin_datos",
    })

    .where(eq(s.rfgfAnterioresPeticiones.id, id));
}

/** Dentro del candado del histórico. Cada intento gasta página; un fallo espera otro tic. */

export async function avanzarAnterioresSinCandado(d: DescargadorRfgf, ahora: Date, maximo: number) {
  await reconciliarAnteriores();

  const { db } = await obtenerDb();

  let paginas = 0;

  const vistos = new Set<string>();

  const actualizadoEn = ahora.toISOString();

  const fallo = (intentos: number, error: unknown) => ({
    intentos: intentos + 1,
    estado: intentos + 1 >= 3 ? ("error" as const) : ("pendiente" as const),

    aviso: error instanceof Error ? error.message : "No se pudo leer la federación.",
    actualizadoEn,
  });

  const pendientes = await db
    .select()
    .from(s.rfgfAnterioresPeticiones)
    .where(
      and(
        eq(s.rfgfAnterioresPeticiones.estado, "pendiente"),
        isNotNull(s.rfgfAnterioresPeticiones.clubCodigo),
      ),
    );

  for (const p of pendientes) {
    const id = claveClub(p.clubCodigo!, p.temporada);

    await db
      .insert(s.rfgfAnterioresClub)
      .values({ id, clubCodigo: p.clubCodigo!, temporada: p.temporada })
      .onConflictDoNothing();

    let [club] = await db
      .select()
      .from(s.rfgfAnterioresClub)
      .where(eq(s.rfgfAnterioresClub.id, id));

    if (club!.estado === "pendiente" && paginas < maximo && !vistos.has(id)) {
      vistos.add(id);
      paginas++;

      try {
        const url = new URL("https://www.futgal.es/pnfg/NPcd/NFG_VisCompeticiones_Club");

        url.search = new URLSearchParams({
          cod_primaria: "1000123",
          codclub: p.clubCodigo!,
          codtemporada: codigoDeTemporada(p.temporada)!,
        }).toString();

        const resultado = competicionesDeClubHtml(await d.html(url.toString()));

        const grupos =
          resultado.grupos?.map((g) => ({
            ...g,
            competicion: normalizarNombreCompeticion(g.competicion),
          })) ?? [];

        const sinTemporada =
          resultado.temporadas.length > 0 &&
          !resultado.temporadas.some((t) => t.temporada === p.temporada);

        await db
          .update(s.rfgfAnterioresClub)
          .set({
            grupos: sinTemporada ? [] : grupos,
            estado: sinTemporada || !grupos.length ? "sin_datos" : "leido",

            aviso: resultado.grupos === null ? "El club no publica tabla de competiciones." : "",
            actualizadoEn,
          })
          .where(eq(s.rfgfAnterioresClub.id, id));
      } catch (error) {
        await db
          .update(s.rfgfAnterioresClub)
          .set(fallo(club!.intentos, error))
          .where(eq(s.rfgfAnterioresClub.id, id));
      }

      [club] = await db.select().from(s.rfgfAnterioresClub).where(eq(s.rfgfAnterioresClub.id, id));
    }

    if (club!.estado === "sin_datos" || club!.estado === "error") {
      await db
        .update(s.rfgfAnterioresPeticiones)
        .set({ estado: club!.estado, aviso: club!.aviso, actualizadoEn })
        .where(eq(s.rfgfAnterioresPeticiones.id, p.id));
      continue;
    }

    if (club!.estado !== "leido") continue;

    for (const g of club!.grupos ?? []) {
      await db
        .insert(s.rfgfAnterioresGrupo)
        .values({ codGrupo: g.codGrupo, temporada: p.temporada, codCompeticion: g.codCompeticion })
        .onConflictDoNothing();

      let [grupo] = await db
        .select()
        .from(s.rfgfAnterioresGrupo)
        .where(eq(s.rfgfAnterioresGrupo.codGrupo, g.codGrupo));

      const clave = `grupo:${g.codGrupo}`;

      if (grupo!.estado === "pendiente" && paginas < maximo && !vistos.has(clave)) {
        vistos.add(clave);
        paginas++;

        try {
          const partidos = partidosConCodigos(
            await d.html(
              urlJornada(
                {
                  codPrimaria: "1000120",
                  codTemporada: codigoDeTemporada(p.temporada)!,
                  codCompeticion: g.codCompeticion,
                  codGrupo: g.codGrupo,
                },
                grupo!.jornada,
              ),
            ),
          );

          await db
            .update(s.rfgfAnterioresGrupo)
            .set({
              codActa: partidos[0]?.codActa ?? null,
              jornada: grupo!.jornada + 1,

              estado: partidos.length ? "leido" : grupo!.jornada >= 3 ? "sin_datos" : "pendiente",
              actualizadoEn,
            })
            .where(eq(s.rfgfAnterioresGrupo.codGrupo, g.codGrupo));
        } catch (error) {
          await db
            .update(s.rfgfAnterioresGrupo)
            .set(fallo(grupo!.intentos, error))
            .where(eq(s.rfgfAnterioresGrupo.codGrupo, g.codGrupo));
        }

        [grupo] = await db
          .select()
          .from(s.rfgfAnterioresGrupo)
          .where(eq(s.rfgfAnterioresGrupo.codGrupo, g.codGrupo));
      }

      await db
        .insert(s.rfgfAnterioresCifras)
        .values({ peticionId: p.id, codGrupo: g.codGrupo })
        .onConflictDoNothing();

      const [c] = await db
        .select()
        .from(s.rfgfAnterioresCifras)
        .where(
          and(
            eq(s.rfgfAnterioresCifras.peticionId, p.id),
            eq(s.rfgfAnterioresCifras.codGrupo, g.codGrupo),
          ),
        );

      if (grupo!.estado === "error" || grupo!.estado === "sin_datos") {
        await db
          .update(s.rfgfAnterioresCifras)
          .set({ estado: grupo!.estado, aviso: grupo!.aviso, actualizadoEn })
          .where(eq(s.rfgfAnterioresCifras.id, c!.id));
        continue;
      }

      if (grupo!.codActa && c!.estado === "pendiente" && paginas < maximo) {
        paginas++;

        try {
          const cifras = parsearEstadisticasJugador(
            await d.html(urlEstadisticasJugador(p.codigo, grupo!.codActa)),
          );

          await db
            .update(s.rfgfAnterioresCifras)
            .set({
              cifras: {
                convocados: cifras.convocados,
                titular: cifras.titular,
                suplente: cifras.suplente,
                jugados: cifras.jugados,
                goles: cifras.goles,
                amarillas: cifras.amarillas,
                doblesAmarillas: cifras.doblesAmarillas,
                rojas: cifras.rojas,
              },
              estado: "leido",
              aviso: "",
              actualizadoEn,
            })
            .where(eq(s.rfgfAnterioresCifras.id, c!.id));
        } catch (error) {
          await db
            .update(s.rfgfAnterioresCifras)
            .set(fallo(c!.intentos, error))
            .where(eq(s.rfgfAnterioresCifras.id, c!.id));
        }
      }
    }

    const cifras = await db
      .select()
      .from(s.rfgfAnterioresCifras)
      .where(eq(s.rfgfAnterioresCifras.peticionId, p.id));

    if (cifras.length && cifras.every((c) => c.estado !== "pendiente")) {
      const error = cifras.find((c) => c.estado === "error");

      await db
        .update(s.rfgfAnterioresPeticiones)
        .set({
          estado: error
            ? "error"
            : cifras.some((c) => c.cifras && c.cifras.convocados > 0)
              ? "leido"
              : "sin_datos",
          aviso: error?.aviso ?? "",
          actualizadoEn,
        })
        .where(eq(s.rfgfAnterioresPeticiones.id, p.id));
    }
  }

  return paginas;
}

export async function otrosClubesDeJugador(jugadorId: string) {
  const { db } = await obtenerDb();

  const peticiones = await db
    .select()
    .from(s.rfgfAnterioresPeticiones)
    .where(eq(s.rfgfAnterioresPeticiones.jugadorId, jugadorId));

  const clubes = await db
    .select({ codigo: s.rfgfClubes.codigo, nombre: s.rfgfClubes.nombre })
    .from(s.rfgfClubes);

  const resultados = await db
    .select({
      peticionId: s.rfgfAnterioresCifras.peticionId,
      codGrupo: s.rfgfAnterioresCifras.codGrupo,
      cifras: s.rfgfAnterioresCifras.cifras,
    })

    .from(s.rfgfAnterioresCifras)
    .innerJoin(
      s.rfgfAnterioresPeticiones,
      eq(s.rfgfAnterioresPeticiones.id, s.rfgfAnterioresCifras.peticionId),
    )
    .where(eq(s.rfgfAnterioresPeticiones.jugadorId, jugadorId));

  const caches = await db.select().from(s.rfgfAnterioresClub);

  return peticiones
    .sort((a, b) => b.temporada.localeCompare(a.temporada))
    .map((p) => ({
      ...p,

      club: clubes.find((c) => c.codigo === p.clubCodigo)?.nombre ?? p.club,

      candidatos: clubes.filter((c) => p.candidatos.includes(c.codigo)),

      resultados: resultados
        .filter((c) => c.peticionId === p.id && c.cifras && c.cifras.convocados > 0)
        .map((c) => ({
          ...c,

          competicion:
            caches
              .find((cache) => cache.id === claveClub(p.clubCodigo!, p.temporada))
              ?.grupos?.find((g) => g.codGrupo === c.codGrupo)?.competicion ?? "",
        })),
    }));
}
