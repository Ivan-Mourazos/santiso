import path from "node:path";
import { expect, test } from "@playwright/test";
import { abrirDb, schema, urlArchivo, type ConexionDb } from "@santiso/db";
import { eq } from "drizzle-orm";
import { DIR_ESCRITURA } from "./datos";

let conexion: ConexionDb;
const id = "vestiario-jornada-e2e";
const ruta = "/admin/jornada?categoria=Senior&semana=2099-06-07&partido=" + id;

test.beforeAll(async () => {
  // Única base escribible: carpeta temporal que siembra el servidor de escritura.
  if (!DIR_ESCRITURA.includes("santiso-e2e-escritura-"))
    throw new Error("Jornada exige una base temporal de juguete");
  conexion = await abrirDb(urlArchivo(path.join(DIR_ESCRITURA, "santiso.db")));
  const { db } = conexion;
  const [activa] = await db
    .select({ id: schema.temporadas.id })
    .from(schema.temporadas)
    .where(eq(schema.temporadas.activa, true));
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
  await db
    .insert(schema.competiciones)
    .values({
      id: "vestiario-copa",
      nombre: "Copa Vestiario Ficticia",
      categoria: "Senior",
      formato: "copa",
      temporadaId: activa!.id,
    });
  await db
    .insert(schema.jornadas)
    .values({ id: "vestiario-j3", competicionId: "vestiario-copa", numero: 3 });
  await db
    .insert(schema.partidos)
    .values({
      id,
      jornadaId: "vestiario-j3",
      equipoLocalId: "vestiario-propio",
      equipoVisitanteId: "vestiario-rival",
      fecha: "2099-06-07T17:00",
    });
  await db
    .insert(schema.jugadores)
    .values(
      Array.from({ length: 11 }, (_, i) => ({
        id: `vestiario-jugador-${i}`,
        nombre: `Jugador ${i} Vestiario Ficticio`,
      })),
    );
});
test.afterAll(() => conexion?.cerrar());

test("jornada: progreso real de convocatoria, once, resultado y acta sobre base de juguete", async ({
  page,
}) => {
  const { db } = conexion;
  await page.goto(ruta);
  const principal = page.locator("[data-accion-principal]");
  await expect(principal).toHaveText("Preparar convocatoria→", { timeout: 30000 });
  await db.insert(schema.partidoConvocatorias).values({ partidoId: id });
  await db
    .insert(schema.partidoConvocados)
    .values(
      Array.from({ length: 11 }, (_, i) => ({
        partidoId: id,
        jugadorId: `vestiario-jugador-${i}`,
      })),
    );
  await page.reload();
  await expect(principal).toHaveText("Completar once→");
  await db
    .insert(schema.partidoAlineaciones)
    .values(
      Array.from({ length: 11 }, (_, i) => ({
        partidoId: id,
        jugadorId: `vestiario-jugador-${i}`,
        titular: true,
        capitan: i === 0,
        orden: i,
      })),
    );
  await page.reload();
  await expect(principal).toHaveText("Preparar cartel de partido→");
  await expect(page.getByText("11 guardados", { exact: true })).toBeVisible();
  await expect(page.getByText("11/11", { exact: true })).toBeVisible();
  await db.update(schema.partidos).set({ estado: "finalizado" }).where(eq(schema.partidos.id, id));
  await page.reload();
  await expect(principal).toHaveText("Anotar resultado→");
  await db
    .update(schema.partidos)
    .set({ golesLocal: 0, golesVisitante: 0 })
    .where(eq(schema.partidos.id, id));
  await page.reload();
  await expect(principal).toHaveText("Completar acta→");
  await db
    .insert(schema.partidoParticipaciones)
    .values(
      Array.from({ length: 11 }, (_, i) => ({
        partidoId: id,
        jugadorId: `vestiario-jugador-${i}`,
        titular: true,
        jugo: true,
      })),
    );
  await page.reload();
  await expect(principal).toHaveText("Preparar publicaciones→");
  await expect(page.getByText("Guardada", { exact: true })).toBeVisible();
  await page.getByText("Más tareas del partido", { exact: true }).click();
  for (const nombre of ["Resultado", "Cronoloxía", "O noso 11"])
    await expect(page.getByRole("link", { name: nombre, exact: false }).last()).toBeVisible();
  await expect(principal).toHaveCount(1);
});
