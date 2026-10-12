import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { abrirDb, migrarBd, schema, urlArchivo } from "@santiso/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  activarUsuario,
  cambiarClave,
  comprobarCredenciales,
  crearUsuario,
  hayUsuarios,
  listarUsuarios,
} from "./usuarios";

async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-usuarios-"));
  const { db } = await abrirDb(urlArchivo(path.join(dir, "santiso.db")));
  await migrarBd(db);
  return db;
}

const MOU = { usuario: "Mou", nombre: "Iván", rol: "admin", clave: "portero-2026" } as const;
const DANI = { usuario: "dani", nombre: "Dani", rol: "tecnico", clave: "mister-2026" } as const;

describe("usuarios", () => {
  it("crea usuarios con el nombre normalizado y sin guardar la contraseña", async () => {
    const db = await entorno();
    expect(await hayUsuarios(db)).toBe(false);
    const creado = await crearUsuario(db, MOU);
    expect(creado).toMatchObject({ usuario: "mou", nombre: "Iván", rol: "admin", activo: true });
    expect(await hayUsuarios(db)).toBe(true);
    const [fila] = await db.select().from(schema.usuarios);
    expect(fila?.claveHash).toMatch(/^scrypt\$/);
    expect(fila?.claveHash).not.toContain(MOU.clave);
  });

  it("rechaza usuarios repetidos, mal escritos o con contraseña corta", async () => {
    const db = await entorno();
    await crearUsuario(db, MOU);
    await expect(crearUsuario(db, { ...DANI, usuario: " MOU " })).rejects.toThrow(/Ya hay/);
    await expect(crearUsuario(db, { ...DANI, usuario: "el míster" })).rejects.toThrow(/usuario/);
    await expect(crearUsuario(db, { ...DANI, clave: "123" })).rejects.toThrow(/al menos 4/);
    await expect(crearUsuario(db, { ...DANI, nombre: "  " })).rejects.toThrow(/nombre/);
    expect(await listarUsuarios(db)).toHaveLength(1);
  });

  it("solo entra quien da su usuario y su contraseña", async () => {
    const db = await entorno();
    await crearUsuario(db, MOU);
    expect(await comprobarCredenciales(db, "MOU", MOU.clave)).toMatchObject({ usuario: "mou" });
    expect(await comprobarCredenciales(db, "mou", "otra-cosa-2026")).toBeNull();
    expect(await comprobarCredenciales(db, "nadie", MOU.clave)).toBeNull();
    expect(await comprobarCredenciales(db, "mou", "")).toBeNull();
  });

  it("cambiar la contraseña cierra las demás sesiones de ese usuario", async () => {
    const db = await entorno();
    const mou = await crearUsuario(db, MOU);
    const dani = await crearUsuario(db, DANI);
    const expiraEn = "2099-01-01T00:00:00.000Z";
    await db.insert(schema.sesiones).values([
      { id: "esta", usuarioId: mou.id, expiraEn },
      { id: "otra", usuarioId: mou.id, expiraEn },
      { id: "de-dani", usuarioId: dani.id, expiraEn },
    ]);
    await cambiarClave(db, mou.id, "nueva-clave-2026", "esta");
    expect((await db.select().from(schema.sesiones)).map((s) => s.id).sort()).toEqual([
      "de-dani",
      "esta",
    ]);
    expect(await comprobarCredenciales(db, "mou", MOU.clave)).toBeNull();
    expect(await comprobarCredenciales(db, "mou", "nueva-clave-2026")).not.toBeNull();
    await expect(cambiarClave(db, mou.id, "123")).rejects.toThrow(/al menos 4/);
    await expect(cambiarClave(db, "no-existe", "nueva-clave-2026")).rejects.toThrow(/ya no existe/);
  });

  it("quitar el acceso cierra la sesión y no deja entrar; devolverlo, sí", async () => {
    const db = await entorno();
    await crearUsuario(db, MOU);
    const dani = await crearUsuario(db, DANI);
    await db
      .insert(schema.sesiones)
      .values({ id: "de-dani", usuarioId: dani.id, expiraEn: "2099-01-01T00:00:00.000Z" });
    await activarUsuario(db, dani.id, false);
    expect(
      await db.select().from(schema.sesiones).where(eq(schema.sesiones.usuarioId, dani.id)),
    ).toHaveLength(0);
    expect(await comprobarCredenciales(db, "dani", DANI.clave)).toBeNull();
    await activarUsuario(db, dani.id, true);
    expect(await comprobarCredenciales(db, "dani", DANI.clave)).not.toBeNull();
  });

  it("siempre queda un administrador con acceso", async () => {
    const db = await entorno();
    const mou = await crearUsuario(db, MOU);
    await crearUsuario(db, DANI);
    await expect(activarUsuario(db, mou.id, false)).rejects.toThrow(/administrador/);
    const otro = await crearUsuario(db, { ...MOU, usuario: "presi", nombre: "Presi" });
    await activarUsuario(db, mou.id, false);
    await expect(activarUsuario(db, otro.id, false)).rejects.toThrow(/administrador/);
  });
});
