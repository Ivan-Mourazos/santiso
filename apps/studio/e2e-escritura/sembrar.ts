/**
 * Prepara una base de datos de juguete para `plantilla-escritura.spec.ts`: dos temporadas, una
 * plantilla en 2025/26 y 2026/27 vacía, como estaba la real al empezar la temporada.
 * La lanza `playwright.escritura.config.ts` antes de arrancar su propio servidor.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { abrirDb, migrarBd, schema, urlArchivo } from "@santiso/db";
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
  await db.insert(schema.competiciones).values([
    { temporadaId: anterior!.id, categoria: "Senior", nombre: "Liga 25/26" },
    { temporadaId: activa!.id, categoria: "Senior", nombre: "Liga 26/27" },
  ]);

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

  cerrar();
  console.log(`Datos de prueba en ${DIR_ESCRITURA}`);
}

sembrar().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
