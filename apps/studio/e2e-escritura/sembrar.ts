/**
 * Prepara una base de datos de juguete para `plantilla-escritura.spec.ts`: dos temporadas, una
 * plantilla en 2025/26 y 2026/27 vacía, como estaba la real al empezar la temporada.
 * La lanza `playwright.escritura.config.ts` antes de arrancar su propio servidor.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { abrirDb, migrarBd, schema, urlArchivo } from "@santiso/db";
import { claveNombre } from "@santiso/domain";
import { DIR_ESCRITURA } from "./datos";

// Función y no `await` de nivel superior: `apps/studio` no es `"type": "module"` y tsx lo
// ejecutaría como CommonJS.
async function sembrar() {
  mkdirSync(path.join(DIR_ESCRITURA, "media"), { recursive: true });

  const { db, cerrar } = await abrirDb(urlArchivo(path.join(DIR_ESCRITURA, "santiso.db")));
  await migrarBd(db);

  const [anterior, activa] = await db
    .insert(schema.temporadas)
    .values([
      { nombre: "2025/26", activa: false },
      { nombre: "2026/27", activa: true },
    ])
    .returning({ id: schema.temporadas.id });
  const competiciones = await db
    .insert(schema.competiciones)
    .values([
      { temporadaId: anterior!.id, categoria: "Senior", nombre: "Liga 25/26" },
      { temporadaId: activa!.id, categoria: "Senior", nombre: "Liga 26/27" },
    ])
    .returning();

  const actual = competiciones.find((c) => c.nombre === "Liga 26/27");
  const anteriorLiga = competiciones.find((c) => c.nombre === "Liga 25/26");
  if (!actual || !anteriorLiga || !activa) throw new Error("Faltan competiciones de prueba");
  const [veteranos] = await db
    .insert(schema.competiciones)
    .values({ temporadaId: activa.id, categoria: "Veteranos", nombre: "Liga Veteranos" })
    .returning();
  const [rio, rioVeterano, protegido, rival] = await db
    .insert(schema.equipos)
    .values([
      { nombre: "Río Ficticio", clave: claveNombre("Río Ficticio"), categoria: "Senior" },
      { nombre: "Río Ficticio", clave: claveNombre("Río Ficticio"), categoria: "Veteranos" },
      {
        nombre: "Histórico Ficticio",
        clave: claveNombre("Histórico Ficticio"),
        categoria: "Senior",
      },
      { nombre: "Rival Ficticio", clave: claveNombre("Rival Ficticio"), categoria: "Senior" },
    ])
    .returning();
  if (!rio || !rioVeterano || !protegido || !rival || !veteranos)
    throw new Error("Faltan equipos de prueba");
  await db.insert(schema.competicionEquipos).values([
    { equipoId: rio.id, competicionId: anteriorLiga.id },
    { equipoId: rioVeterano.id, competicionId: veteranos.id },
    { equipoId: protegido.id, competicionId: actual.id },
    { equipoId: rival.id, competicionId: actual.id },
  ]);
  const [jornada] = await db
    .insert(schema.jornadas)
    .values({ competicionId: actual.id, numero: 1 })
    .returning();
  if (!jornada) throw new Error("Falta jornada de prueba");
  await db
    .insert(schema.partidos)
    .values({ jornadaId: jornada.id, equipoLocalId: protegido.id, equipoVisitanteId: rival.id });
  await db.insert(schema.equipos).values({
    nombre: "Libre Ficticio",
    clave: claveNombre("Libre Ficticio"),
    categoria: "Senior",
  });

  const personas = await db
    .insert(schema.jugadores)
    .values([{ nombre: "Brais Rei Ficticio" }, { nombre: "Iago Porteiro Ficticio" }])
    .returning({ id: schema.jugadores.id });
  await db.insert(schema.jugadoresTemporada).values([
    {
      temporadaId: anterior!.id,
      jugadorId: personas[0]!.id,
      categoria: "Senior",
      dorsal: 9,
      posicion: "DC",
    },
    {
      temporadaId: anterior!.id,
      jugadorId: personas[1]!.id,
      categoria: "Senior",
      dorsal: 1,
      posicion: "POR",
    },
  ]);

  const [mister] = await db
    .insert(schema.staff)
    .values({ nombre: "Manuel Adestrador Ficticio" })
    .returning({ id: schema.staff.id });
  await db.insert(schema.staffTemporada).values({
    temporadaId: anterior!.id,
    staffId: mister!.id,
    tipo: "tecnico",
    categoria: "Senior",
    cargo: "Entrenador",
  });

  // Calendario (6G): una competición propia en Veteranos, con orden alto para que la primera
  // siga siendo «Liga Veteranos» (la que ven las pruebas de Equipos). Cuatro equipos que no usa
  // ninguna otra prueba, una jornada con un partido y un campo.
  const [copa] = await db
    .insert(schema.competiciones)
    .values({
      temporadaId: activa.id,
      categoria: "Veteranos",
      nombre: "Copa Calendario",
      orden: 5,
    })
    .returning();
  const equiposCopa = await db
    .insert(schema.equipos)
    .values(
      ["Norte", "Sur", "Leste", "Oeste"].map((punto) => ({
        nombre: `${punto} Calendario`,
        clave: claveNombre(`${punto} Calendario`),
        categoria: "Veteranos" as const,
        // «Norte» hace de equipo del club: la vista «Partidos del Santiso» lo filtra por esto.
        esPropio: punto === "Norte",
      })),
    )
    .returning();
  if (!copa || equiposCopa.length !== 4) throw new Error("Falta la copa de calendario");
  await db
    .insert(schema.competicionEquipos)
    .values(equiposCopa.map((e) => ({ equipoId: e.id, competicionId: copa.id })));
  const [jornadaCopa] = await db
    .insert(schema.jornadas)
    .values({ competicionId: copa.id, numero: 1 })
    .returning();
  await db.insert(schema.campos).values({
    nombre: "Campo Calendario",
    clave: claveNombre("Campo Calendario"),
    poblacion: "Santiso",
  });
  await db.insert(schema.partidos).values({
    jornadaId: jornadaCopa!.id,
    equipoLocalId: equiposCopa[0]!.id,
    equipoVisitanteId: equiposCopa[1]!.id,
  });

  // Historial (`historial-escritura.spec.ts`): 2025/26 jugada, con un equipo del club, dos
  // rivales, una liga terminada y una eliminatoria, y goles de la plantilla de 2025/26. La base
  // real ya no guarda temporadas pasadas: esto es lo que prueban Clasificación y Estadísticas.
  // Orden alto para que la primera competición de 2025/26 siga siendo «Liga 25/26».
  const [historica, eliminatoria] = await db
    .insert(schema.competiciones)
    .values([
      { temporadaId: anterior!.id, categoria: "Senior", nombre: "Liga Histórica", orden: 8 },
      {
        temporadaId: anterior!.id,
        categoria: "Senior",
        nombre: "Copa Histórica",
        formato: "eliminatoria",
        orden: 9,
      },
    ])
    .returning();
  const [club, uno, dos] = await db
    .insert(schema.equipos)
    .values(
      ["U.D. Santiso Ficticio", "Rival Uno Ficticio", "Rival Dos Ficticio"].map((nombre, i) => ({
        nombre,
        clave: claveNombre(nombre),
        categoria: "Senior" as const,
        esPropio: i === 0,
      })),
    )
    .returning();
  if (!historica || !eliminatoria || !club || !uno || !dos) throw new Error("Falta el historial");
  await db.insert(schema.competicionEquipos).values(
    [club, uno, dos].flatMap((e) => [
      { equipoId: e.id, competicionId: historica.id },
      { equipoId: e.id, competicionId: eliminatoria.id },
    ]),
  );
  const jornadasHistoricas = await db
    .insert(schema.jornadas)
    .values([
      { competicionId: historica.id, numero: 1 },
      { competicionId: historica.id, numero: 2 },
      { competicionId: historica.id, numero: 3 },
      { competicionId: eliminatoria.id, numero: 1 },
    ])
    .returning();
  const [h1, h2, h3, c1] = jornadasHistoricas;
  const jugado = (
    jornada: typeof h1,
    local: typeof club,
    visitante: typeof club,
    golesLocal: number,
    golesVisitante: number,
  ) => ({
    jornadaId: jornada!.id,
    equipoLocalId: local.id,
    equipoVisitanteId: visitante.id,
    golesLocal,
    golesVisitante,
    estado: "finalizado" as const,
  });
  // Tabla final: Santiso 4 puntos, Uno 3, Dos 1. Goles del Santiso: 2 + 1 en liga, 1 en copa.
  const [p1, p2, , p4] = await db
    .insert(schema.partidos)
    .values([
      jugado(h1, club, uno, 2, 0),
      jugado(h2, dos, club, 1, 1),
      jugado(h3, uno, dos, 3, 0),
      jugado(c1, club, dos, 1, 0),
    ])
    .returning();
  const [brais, iago] = personas;
  await db.insert(schema.partidoParticipaciones).values(
    [p1, p2, p4].flatMap((p) => [
      { partidoId: p!.id, jugadorId: brais!.id, titular: true, jugo: true },
      { partidoId: p!.id, jugadorId: iago!.id, titular: true, jugo: true },
    ]),
  );
  const gol = (partido: typeof p1, jugador: typeof brais, minuto: number) => ({
    partidoId: partido!.id,
    tipo: "gol" as const,
    lado: "propio" as const,
    jugadorId: jugador!.id,
    minuto,
  });
  await db
    .insert(schema.partidoEventos)
    .values([gol(p1, brais, 10), gol(p1, brais, 60), gol(p2, brais, 30), gol(p4, iago, 80)]);

  // Catálogo de patrocinadores: dos activados en la barra y uno de solo web.
  await db.insert(schema.patrocinadores).values([
    {
      nombre: "Concello Ficticio",
      clave: claveNombre("Concello Ficticio"),
      logo: "cartel/concello.webp",
      enCarteles: true,
      orden: 0,
    },
    {
      nombre: "Deporte Ficticio",
      clave: claveNombre("Deporte Ficticio"),
      logo: "cartel/deporte.webp",
      enCarteles: true,
      orden: 1,
    },
    {
      nombre: "Autobuses Ficticio",
      clave: claveNombre("Autobuses Ficticio"),
      logo: "cartel/autobuses.webp",
      webUrl: "https://example.test/autobuses",
      enCarteles: false,
      orden: 0,
    },
  ]);

  // Alineación y convocatoria: plantilla Senior de la temporada activa (Veteranos no convoca ni
  // alinea). Sus partidos son los de «Copa Convocatoria», más abajo.
  const alineables = await db
    .insert(schema.jugadores)
    .values([
      { nombre: "Uno Aliñación Ficticio" },
      { nombre: "Dous Aliñación Ficticio", apodo: "Dous" },
      { nombre: "Tres Aliñación Ficticio" },
    ])
    .returning({ id: schema.jugadores.id });
  await db.insert(schema.jugadoresTemporada).values(
    alineables.map((j, i) => ({
      temporadaId: activa.id,
      jugadorId: j.id,
      categoria: "Senior" as const,
      dorsal: i + 1,
      capitania: i === 1 ? 1 : null,
    })),
  );

  // Consulta móvil: temporada/categoría independiente para no alterar los recuentos de
  // plantilla, alineación o historial de las otras pruebas. Nombres largos y acta con tarjetas.
  const [consulta] = await db
    .insert(schema.competiciones)
    .values({
      temporadaId: anterior!.id,
      categoria: "Veteranos",
      nombre: "Copa Móvil Consulta",
      orden: 20,
    })
    .returning();
  const consultaEquipos = await db
    .insert(schema.equipos)
    .values(
      [
        "U.D. Santiso de Proba Móbil con Nome Moi Longo",
        "Rival de Consulta Móbil con Nome Moi Longo",
        "Terceiro Móbil",
        "Cuarto Móbil",
      ].map((nombre, i) => ({
        nombre,
        clave: claveNombre(nombre),
        categoria: "Veteranos" as const,
        esPropio: i === 0,
      })),
    )
    .returning();
  await db
    .insert(schema.competicionEquipos)
    .values(consultaEquipos.map((e) => ({ equipoId: e.id, competicionId: consulta!.id })));
  const [consultaJornada] = await db
    .insert(schema.jornadas)
    .values({ competicionId: consulta!.id, numero: 1 })
    .returning();
  const [consultaCampo] = await db
    .insert(schema.campos)
    .values({
      nombre: "Campo de Consulta Móbil con Nome Moi Longo",
      clave: claveNombre("Campo de Consulta Móbil con Nome Moi Longo"),
    })
    .returning();
  const [consultaPartido] = await db
    .insert(schema.partidos)
    .values({
      jornadaId: consultaJornada!.id,
      equipoLocalId: consultaEquipos[0]!.id,
      equipoVisitanteId: consultaEquipos[1]!.id,
      golesLocal: 2,
      golesVisitante: 1,
      estado: "finalizado",
      fecha: "2025-10-05T15:00:00.000Z",
      campoId: consultaCampo!.id,
    })
    .returning();
  const consultaJugadores = await db
    .insert(schema.jugadores)
    .values([
      { nombre: "Xoán Xogador de Proba Móbil con Nome Moi Longo" },
      { nombre: "Antón Consulta Móbil" },
    ])
    .returning();
  await db.insert(schema.jugadoresTemporada).values(
    consultaJugadores.map((j, i) => ({
      temporadaId: anterior!.id,
      jugadorId: j.id,
      categoria: "Veteranos" as const,
      dorsal: 20 + i,
    })),
  );
  await db.insert(schema.partidoParticipaciones).values(
    consultaJugadores.map((j) => ({
      partidoId: consultaPartido!.id,
      jugadorId: j.id,
      titular: true,
      jugo: true,
    })),
  );
  await db.insert(schema.partidoEventos).values([
    {
      partidoId: consultaPartido!.id,
      jugadorId: consultaJugadores[0]!.id,
      tipo: "gol",
      lado: "propio",
      minuto: 10,
    },
    {
      partidoId: consultaPartido!.id,
      jugadorId: consultaJugadores[0]!.id,
      tipo: "tarjeta_amarilla",
      lado: "propio",
      minuto: 30,
    },
    {
      partidoId: consultaPartido!.id,
      jugadorId: consultaJugadores[0]!.id,
      tipo: "tarjeta_roja",
      lado: "propio",
      minuto: 80,
    },
    {
      partidoId: consultaPartido!.id,
      jugadorId: consultaJugadores[1]!.id,
      tipo: "gol",
      lado: "propio",
      minuto: 60,
    },
  ]);

  // Partidos privados de convocatoria y alineación, en Senior con dos equipos propios de la copa.
  // Fecha pasada y sin finalizar: solo aparecen al pedirlos, sin cambiar el próximo partido de
  // las otras pruebas. Usan los tres jugadores de arriba.
  const [norte, sur] = await db
    .insert(schema.equipos)
    .values(
      ["Norte", "Sur"].map((punto) => ({
        nombre: `${punto} Convocatoria`,
        clave: claveNombre(`${punto} Convocatoria`),
        categoria: "Senior" as const,
        esPropio: punto === "Norte",
      })),
    )
    .returning();
  const [convocatoriaCompeticion] = await db
    .insert(schema.competiciones)
    .values({
      temporadaId: activa.id,
      categoria: "Senior",
      nombre: "Copa Convocatoria",
      orden: 30,
    })
    .returning();
  const [convocatoriaJornada] = await db
    .insert(schema.jornadas)
    .values({
      competicionId: convocatoriaCompeticion!.id,
      numero: 1,
    })
    .returning();
  await db.insert(schema.competicionEquipos).values([
    { competicionId: convocatoriaCompeticion!.id, equipoId: norte!.id },
    { competicionId: convocatoriaCompeticion!.id, equipoId: sur!.id },
  ]);
  await db.insert(schema.partidos).values({
    id: "convocatoria-e2e",
    jornadaId: convocatoriaJornada!.id,
    equipoLocalId: norte!.id,
    equipoVisitanteId: sur!.id,
    fecha: "2000-01-01T17:00",
  });
  const [alineacionJornada] = await db
    .insert(schema.jornadas)
    .values({ competicionId: convocatoriaCompeticion!.id, numero: 3 })
    .returning();
  await db.insert(schema.partidos).values({
    id: "alineacion-e2e",
    jornadaId: alineacionJornada!.id,
    equipoLocalId: norte!.id,
    equipoVisitanteId: sur!.id,
    fecha: "2000-01-08T17:00",
  });
  // Un partido ya jugado de la misma copa: «Uno» expulsado y «Tres» con cuatro
  // amarillas. Convocatoria y alineación lo avisan junto a su nombre. La federación escribe
  // «APELLIDOS, NOMBRE».
  const [avisosJornada] = await db
    .insert(schema.jornadas)
    .values({ competicionId: convocatoriaCompeticion!.id, numero: 2 })
    .returning();
  await db.insert(schema.partidos).values({
    id: "convocatoria-avisos",
    jornadaId: avisosJornada!.id,
    equipoLocalId: sur!.id,
    equipoVisitanteId: norte!.id,
    fecha: "1999-12-25T17:00",
    estado: "finalizado",
    golesLocal: 1,
    golesVisitante: 1,
  });
  await db.insert(schema.ligaEventos).values([
    ...Array.from({ length: 4 }, () => ({
      partidoId: "convocatoria-avisos",
      equipoId: norte!.id,
      persona: "ALIÑACIÓN FICTICIO, TRES",
      personaClave: claveNombre("ALIÑACIÓN FICTICIO, TRES"),
      tipo: "amarilla" as const,
    })),
    {
      partidoId: "convocatoria-avisos",
      equipoId: norte!.id,
      persona: "ALIÑACIÓN FICTICIO, UNO",
      personaClave: claveNombre("ALIÑACIÓN FICTICIO, UNO"),
      tipo: "roja" as const,
    },
  ]);

  // Jornada como mesa de partido: una copa Senior propia, en 2099 para no cruzarse con nada,
  // con un partido en cada punto del recorrido (ver `jornada-escritura.spec.ts`).
  await db.insert(schema.equipos).values([
    {
      id: "vestiario-propio",
      nombre: "U.D. Santiso F.C. Ficticio",
      clave: "vestiario-propio",
      categoria: "Senior",
      esPropio: true,
    },
    {
      id: "vestiario-rival",
      nombre: "C.D. Compañía de María Ficticio",
      clave: "vestiario-rival",
      categoria: "Senior",
    },
  ]);
  await db.insert(schema.competiciones).values({
    id: "vestiario-copa",
    nombre: "Copa Vestiario Ficticia",
    categoria: "Senior",
    formato: "eliminatoria",
    temporadaId: activa.id,
    // Por delante de la liga: en Senior, con dos competiciones, la pantalla abre la segunda
    // (`pickDefaultCompetitionId`), y las demás pruebas cuentan con que sea «Liga 26/27».
    orden: -1,
  });
  const once = Array.from({ length: 11 }, (_, i) => `vestiario-jugador-${i}`);
  await db
    .insert(schema.jugadores)
    .values(once.map((id, i) => ({ id, nombre: `Jugador ${i} Vestiario Ficticio` })));
  // «jugado» es un partido cuya hora ya pasó y sigue sin marcador (la base no admite un
  // finalizado sin goles): por eso va en el pasado. Cada uno, en su propia semana.
  const pasosVestiario = [
    ["sin-nada", "2099-06-07"],
    ["convocado", "2099-06-14"],
    ["once", "2099-06-21"],
    ["jugado", "2001-06-03"],
    ["resultado", "2099-07-05"],
    ["acta", "2099-07-12"],
  ] as const;
  for (const [i, [paso, dia]] of pasosVestiario.entries()) {
    const partidoId = `vestiario-${paso}`;
    await db
      .insert(schema.jornadas)
      .values({ id: `vestiario-j${i + 1}`, competicionId: "vestiario-copa", numero: i + 1 });
    await db.insert(schema.partidos).values({
      id: partidoId,
      jornadaId: `vestiario-j${i + 1}`,
      equipoLocalId: "vestiario-propio",
      equipoVisitanteId: "vestiario-rival",
      fecha: `${dia}T17:00`,
      ...(i >= 4 ? { estado: "finalizado" as const, golesLocal: 0, golesVisitante: 0 } : {}),
    });
    if (i >= 1) {
      await db.insert(schema.partidoConvocatorias).values({ partidoId });
      await db
        .insert(schema.partidoConvocados)
        .values(once.map((jugadorId) => ({ partidoId, jugadorId })));
    }
    if (i >= 2) {
      await db.insert(schema.partidoAlineaciones).values(
        once.map((jugadorId, orden) => ({
          partidoId,
          jugadorId,
          titular: true,
          capitan: orden === 0,
          orden,
        })),
      );
    }
    if (i >= 5) {
      await db
        .insert(schema.partidoParticipaciones)
        .values(once.map((jugadorId) => ({ partidoId, jugadorId, titular: true, jugo: true })));
    }
  }

  // Un rival con cuatro amarillas (apercibido) y uno expulsado en su último partido jugado:
  // lo que la mesa de Jornada enseña de cara al siguiente.
  await db.insert(schema.ligaEventos).values([
    ...Array.from({ length: 4 }, () => ({
      partidoId: "vestiario-acta",
      equipoId: "vestiario-rival",
      persona: "Xan Apercibido Ficticio",
      personaClave: "xan apercibido ficticio",
      tipo: "amarilla" as const,
    })),
    {
      partidoId: "vestiario-acta",
      equipoId: "vestiario-rival",
      persona: "Brais Expulsado Ficticio",
      personaClave: "brais expulsado ficticio",
      tipo: "roja" as const,
    },
  ]);
  await db.insert(schema.rfgfCompeticiones).values({
    competicionId: "vestiario-copa",
    enlace: "https://www.futgal.es/pnfg/NPcd/NFG_VisCalendario_Vis?cod_primaria=1&codtemporada=1&codcompeticion=1&codgrupo=1",
  });
  await db.insert(schema.rfgfPartidos).values({
    partidoId: "vestiario-sin-nada",
    fecha: "2099-06-07T17:00",
    campo: "",
    cambio: "07/06 17:00",
    cambioEn: new Date().toISOString(),
  });

  cerrar();
  console.log(`Datos de prueba en ${DIR_ESCRITURA}`);
}

sembrar().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
