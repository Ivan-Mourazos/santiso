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

  cerrar();
  console.log(`Datos de prueba en ${DIR_ESCRITURA}`);
}

sembrar().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
