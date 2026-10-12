import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Lo que el navegador mandaría y recibiría: la cookie de sesión. */
const navegador = { cookie: undefined as string | undefined, opciones: undefined as unknown };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (navegador.cookie ? { value: navegador.cookie } : undefined),
    set: (_nombre: string, valor: string, opciones: unknown) => {
      navegador.cookie = valor;
      navegador.opciones = opciones;
    },
    delete: () => {
      navegador.cookie = undefined;
    },
  }),
  headers: async () => ({ get: () => "https" }),
}));

/** BD migrada con un administrador y un técnico, y el acceso encendido. */
async function entorno() {
  const dir = mkdtempSync(path.join(tmpdir(), "santiso-sesion-"));
  process.env.SANTISO_DATA_DIR = dir;
  process.env.STUDIO_ACCESO = "1";
  vi.resetModules();
  globalThis.santisoConexionDb = undefined;
  globalThis.santisoFrenoAcceso = undefined;
  navegador.cookie = undefined;
  const bd = await import("@santiso/db");
  const inicial = await bd.abrirDb(bd.urlArchivo(path.join(dir, "santiso.db")));
  await bd.migrarBd(inicial.db);
  const { crearUsuario } = await import("./usuarios");
  const admin = await crearUsuario(inicial.db, {
    usuario: "mou",
    nombre: "Iván",
    rol: "admin",
    clave: "portero-2026",
  });
  const tecnico = await crearUsuario(inicial.db, {
    usuario: "dani",
    nombre: "Dani",
    rol: "tecnico",
    clave: "mister-2026",
  });
  inicial.cerrar();
  return {
    bd,
    admin,
    tecnico,
    sesion: await import("./sesion"),
    acceso: await import("@/lib/server/acciones/acceso"),
    temporadas: await import("@/lib/server/acciones/temporadas"),
    servidor: await import("@/lib/server/db"),
  };
}

describe("acceso con usuario y contraseña", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.SANTISO_DATA_DIR;
    delete process.env.STUDIO_ACCESO;
    vi.restoreAllMocks();
  });

  it("sin sesión no se abre la base de datos ni responde ninguna acción", async () => {
    const { servidor, sesion, temporadas } = await entorno();
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);
    expect(await sesion.usuarioActual()).toBeNull();
    expect(await temporadas.cargarTemporadas()).toMatchObject({ ok: false });
    expect((await sesion.respuestaSinSesion())?.status).toBe(401);
    // Tampoco se guarda nada en disco: las acciones se pueden llamar desde la página de entrada.
    const { guardarImagen, guardarFotoPartido } = await import("@/lib/server/media");
    const dir = process.env.SANTISO_DATA_DIR!;
    await expect(guardarImagen(new Uint8Array(4), "escudos", dir)).rejects.toThrow(/contraseña/);
    await expect(guardarFotoPartido(new Uint8Array(4), dir)).rejects.toThrow(/contraseña/);
    expect(existsSync(path.join(dir, "escudos"))).toBe(false);
    // Una cookie inventada tampoco vale.
    navegador.cookie = "inventada";
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);
  });

  it("entrar deja una cookie protegida que abre la base de datos", async () => {
    const { acceso, servidor, sesion, bd } = await entorno();
    expect(await acceso.entrar("mou", "no-es-esta")).toEqual({
      ok: false,
      error: "Usuario o contraseña incorrectos.",
    });
    expect(navegador.cookie).toBeUndefined();
    expect(await acceso.entrar(" MOU ", "portero-2026")).toEqual({ ok: true, datos: null });
    expect(navegador.opciones).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax" });
    const { db } = await servidor.obtenerDb();
    // En la base no está la cookie, solo su huella.
    const [guardada] = await db.select().from(bd.schema.sesiones);
    expect(guardada?.id).not.toBe(navegador.cookie);
    expect(guardada?.id).toMatch(/^[0-9a-f]{64}$/);
    expect(await sesion.usuarioActual()).toMatchObject({ usuario: "mou", rol: "admin" });
    expect(await sesion.respuestaSinSesion()).toBeNull();
  });

  it("salir, caducar o perder el acceso dejan la sesión sin valor", async () => {
    const { acceso, servidor, bd, tecnico } = await entorno();
    await acceso.entrar("dani", "mister-2026");
    const cookie = navegador.cookie;
    await acceso.salir();
    navegador.cookie = cookie;
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);

    await acceso.entrar("dani", "mister-2026");
    const { db } = await servidor.obtenerDbSinControl();
    await db.update(bd.schema.sesiones).set({ expiraEn: "2020-01-01T00:00:00.000Z" });
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);

    await acceso.entrar("dani", "mister-2026");
    await db.update(bd.schema.usuarios).set({ activo: false });
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);
    expect(tecnico.rol).toBe("tecnico");
  });

  it("el cuerpo técnico no puede con lo que es del administrador", async () => {
    const { acceso, temporadas } = await entorno();
    await acceso.entrar("dani", "mister-2026");
    expect(await temporadas.cargarTemporadas()).toMatchObject({ ok: true });
    expect(await temporadas.crearTemporada("2026/27")).toEqual({
      ok: false,
      error: "Solo el administrador puede hacer eso.",
    });
    expect(await acceso.cargarUsuarios()).toMatchObject({ ok: false });
    expect(
      await acceso.crearUsuarioNuevo({
        usuario: "colado",
        nombre: "Colado",
        rol: "admin",
        clave: "colado-2026",
      }),
    ).toMatchObject({ ok: false, error: "Solo el administrador puede hacer eso." });

    await acceso.salir();
    await acceso.entrar("mou", "portero-2026");
    expect(await temporadas.crearTemporada("2026/27")).toMatchObject({ ok: true });
    expect((await acceso.cargarUsuarios()).ok).toBe(true);
  });

  it("el primer administrador solo se puede crear cuando no hay nadie", async () => {
    const { acceso } = await entorno();
    expect(
      await acceso.crearPrimerAdministrador({
        usuario: "intruso",
        nombre: "Intruso",
        clave: "intruso-2026",
      }),
    ).toEqual({ ok: false, error: "Ya hay un administrador. Entra con él." });
    expect(navegador.cookie).toBeUndefined();
  });

  it("cada uno se cambia su contraseña dando la actual, y no se queda fuera", async () => {
    const { acceso, servidor } = await entorno();
    await acceso.entrar("dani", "mister-2026");
    expect(await acceso.cambiarMiClave("no-es-esta", "nueva-clave-2026")).toMatchObject({
      ok: false,
      error: "La contraseña actual no es esa.",
    });
    expect(await acceso.cambiarMiClave("mister-2026", "nueva-clave-2026")).toMatchObject({
      ok: true,
    });
    await expect(servidor.obtenerDb()).resolves.toBeDefined();
    await acceso.salir();
    expect(await acceso.entrar("dani", "mister-2026")).toMatchObject({ ok: false });
    expect(await acceso.entrar("dani", "nueva-clave-2026")).toMatchObject({ ok: true });
  });

  it("tras varios fallos seguidos hay que esperar, aunque luego se acierte", async () => {
    const { acceso } = await entorno();
    for (let i = 0; i < 5; i += 1) await acceso.entrar("dani", "fallo-numero-x");
    expect(await acceso.entrar("dani", "mister-2026")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Demasiados intentos/),
    });
    // A los demás no les afecta.
    expect(await acceso.entrar("mou", "portero-2026")).toMatchObject({ ok: true });
  });

  it("las tareas del propio servidor pasan sin usuario", async () => {
    const { servidor } = await entorno();
    await expect(servidor.comoSistema(() => servidor.obtenerDb())).resolves.toBeDefined();
    await expect(servidor.obtenerDb()).rejects.toThrow(/usuario y contraseña/);
  });
});
