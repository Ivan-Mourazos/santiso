import {
  codigoDeTemporada,
  gruposDeEquipoHtml,
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

import { and, eq, inArray } from "drizzle-orm";

import { filasDeHistorial } from "@/lib/plantilla/historial";

import { emparejarClubes } from "@/lib/rfgf/clubes";

import { urlCompeticionesDeEquipo, urlEstadisticasJugador, urlJornada } from "@/lib/rfgf/enlace";

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

/** Elección local independiente del club. Conserva cachés ya leídas. */
export async function elegirEquipoAnterior(id: string, codigo: string) {
  if (!/^\d{1,12}$/u.test(codigo)) throw new Error("Código de equipo inválido.");
  const { db } = await obtenerDb();
  await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(s.rfgfAnterioresPeticiones)
      .where(eq(s.rfgfAnterioresPeticiones.id, id));
    if (!p || p.estado === "leido") throw new Error("Esa petición ya no necesita elegir equipo.");
    await tx
      .update(s.rfgfAnterioresPeticiones)
      .set({ equipoCodigo: codigo, estado: "pendiente", intentos: 0, aviso: "" })
      .where(eq(s.rfgfAnterioresPeticiones.id, id));
    await tx
      .update(s.rfgfAnterioresEquipo)
      .set({ estado: "pendiente", intentos: 0, aviso: "" })
      .where(
        and(eq(s.rfgfAnterioresEquipo.codigo, codigo), eq(s.rfgfAnterioresEquipo.estado, "error")),
      );
    const cifras = await tx
      .select()
      .from(s.rfgfAnterioresCifras)
      .where(eq(s.rfgfAnterioresCifras.peticionId, id));
    for (const c of cifras) {
      await tx
        .update(s.rfgfAnterioresGrupo)
        .set({ estado: "pendiente", intentos: 0, aviso: "", jornada: 1 })
        .where(
          and(
            eq(s.rfgfAnterioresGrupo.codGrupo, c.codGrupo),
            inArray(s.rfgfAnterioresGrupo.estado, ["error", "sin_datos"]),
          ),
        );
      await tx
        .update(s.rfgfAnterioresCifras)
        .set({ estado: "pendiente", intentos: 0, aviso: "" })
        .where(
          and(
            eq(s.rfgfAnterioresCifras.id, c.id),
            inArray(s.rfgfAnterioresCifras.estado, ["error", "sin_datos"]),
          ),
        );
    }
  });
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
    .where(eq(s.rfgfAnterioresPeticiones.estado, "pendiente"));

  for (const p of pendientes) {
    let grupos: s.GrupoAnterior[] = [];
    if (p.equipoCodigo) {
      const codigo = p.equipoCodigo;
      await db.insert(s.rfgfAnterioresEquipo).values({ codigo }).onConflictDoNothing();
      let [equipo] = await db
        .select()
        .from(s.rfgfAnterioresEquipo)
        .where(eq(s.rfgfAnterioresEquipo.codigo, codigo));
      const clave = `equipo:${codigo}`;
      if (equipo!.estado === "pendiente" && paginas < maximo && !vistos.has(clave)) {
        vistos.add(clave);
        paginas++;
        try {
          const [actual] = await db
            .select()
            .from(s.temporadas)
            .where(eq(s.temporadas.activa, true));
          const inicio = actual?.nombre.slice(0, 4) ?? String(ahora.getFullYear());
          const codTemporada = codigoDeTemporada(`${inicio}-${Number(inicio) + 1}`)!;
          const lista = gruposDeEquipoHtml(
            await d.html(urlCompeticionesDeEquipo(codigo, codTemporada)),
          );
          await db
            .update(s.rfgfAnterioresEquipo)
            .set({
              grupos: lista.map((g) => ({ ...g, codEquipo: codigo })),
              estado: "leido",
              aviso: "",
              actualizadoEn,
            })
            .where(eq(s.rfgfAnterioresEquipo.codigo, codigo));
        } catch (error) {
          await db
            .update(s.rfgfAnterioresEquipo)
            .set(fallo(equipo!.intentos, error))
            .where(eq(s.rfgfAnterioresEquipo.codigo, codigo));
        }
        [equipo] = await db
          .select()
          .from(s.rfgfAnterioresEquipo)
          .where(eq(s.rfgfAnterioresEquipo.codigo, codigo));
      }
      if (equipo!.estado === "error") {
        await db
          .update(s.rfgfAnterioresPeticiones)
          .set({ estado: "error", aviso: equipo!.aviso, actualizadoEn })
          .where(eq(s.rfgfAnterioresPeticiones.id, p.id));
        continue;
      }
      if (equipo!.estado !== "leido") continue;
      const lista = equipo!.grupos?.filter((g) => g.temporada === p.temporada) ?? [];
      const preferidos = lista.filter((g) => !/FEMENIN|L\.\s*G\.\s*F\.|SALA/iu.test(g.competicion));
      grupos = preferidos.length ? preferidos : lista;
      if (!grupos.length) {
        await db
          .update(s.rfgfAnterioresPeticiones)
          .set({ estado: "sin_datos", aviso: "Ese equipo no jugó esa temporada", actualizadoEn })
          .where(eq(s.rfgfAnterioresPeticiones.id, p.id));
        continue;
      }
    } else {
      if (!p.clubCodigo) continue;
      const id = claveClub(p.clubCodigo, p.temporada);

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

        [club] = await db
          .select()
          .from(s.rfgfAnterioresClub)
          .where(eq(s.rfgfAnterioresClub.id, id));
      }

      if (club!.estado === "sin_datos" || club!.estado === "error") {
        await db
          .update(s.rfgfAnterioresPeticiones)
          .set({ estado: club!.estado, aviso: club!.aviso, actualizadoEn })
          .where(eq(s.rfgfAnterioresPeticiones.id, p.id));
        continue;
      }

      if (club!.estado !== "leido") continue;

      grupos = club!.grupos ?? [];
    }
    for (const g of grupos) {
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
              partidos,
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
        .values({ peticionId: p.id, codGrupo: g.codGrupo, codEquipo: g.codEquipo })
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
              equipo:
                cifras.equipo ||
                g.equipo ||
                grupo!.partidos?.flatMap((partido) =>
                  partido.codLocal === g.codEquipo
                    ? [partido.local]
                    : partido.codVisitante === g.codEquipo
                      ? [partido.visitante]
                      : [],
                )[0] ||
                p.club,
              codEquipo: g.codEquipo,
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

    const vigentes = cifras.filter((c) => grupos.some((g) => g.codGrupo === c.codGrupo));
    if (vigentes.length && vigentes.every((c) => c.estado !== "pendiente")) {
      const error = vigentes.find((c) => c.estado === "error");

      await db
        .update(s.rfgfAnterioresPeticiones)
        .set({
          estado: error
            ? "error"
            : vigentes.some((c) => c.cifras && c.cifras.convocados > 0)
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
      equipo: s.rfgfAnterioresCifras.equipo,
      codEquipo: s.rfgfAnterioresCifras.codEquipo,
    })

    .from(s.rfgfAnterioresCifras)
    .innerJoin(
      s.rfgfAnterioresPeticiones,
      eq(s.rfgfAnterioresPeticiones.id, s.rfgfAnterioresCifras.peticionId),
    )
    .where(eq(s.rfgfAnterioresPeticiones.jugadorId, jugadorId));

  const caches = await db.select().from(s.rfgfAnterioresClub);
  const equipos = await db.select().from(s.rfgfAnterioresEquipo);
  const gruposDe = (p: (typeof peticiones)[number]) =>
    p.equipoCodigo
      ? equipos
          .find((e) => e.codigo === p.equipoCodigo)
          ?.grupos?.filter((g) => g.temporada === p.temporada)
      : caches.find((cache) => cache.id === claveClub(p.clubCodigo!, p.temporada))?.grupos;

  return peticiones
    .sort((a, b) => b.temporada.localeCompare(a.temporada))
    .map((p) => ({
      ...p,

      club: clubes.find((c) => c.codigo === p.clubCodigo)?.nombre ?? p.club,

      candidatos: clubes.filter((c) => p.candidatos.includes(c.codigo)),

      resultados: resultados
        .filter(
          (c) =>
            c.peticionId === p.id &&
            c.cifras &&
            c.cifras.convocados > 0 &&
            (!p.equipoCodigo || gruposDe(p)?.some((g) => g.codGrupo === c.codGrupo)),
        )
        .map((c) => ({
          ...c,

          equipo:
            c.equipo ||
            gruposDe(p)?.find((g) => g.codGrupo === c.codGrupo)?.equipo ||
            clubes.find((club) => club.codigo === p.clubCodigo)?.nombre ||
            p.club,
          competicion: gruposDe(p)?.find((g) => g.codGrupo === c.codGrupo)?.competicion ?? "",
        })),
    }));
}
