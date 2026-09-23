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
