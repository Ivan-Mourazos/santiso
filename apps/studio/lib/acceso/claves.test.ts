import { describe, expect, it } from "vitest";

import {
  claveCorrecta,
  errorDeClave,
  errorDeUsuario,
  hashDeClave,
  huellaDeToken,
  normalizarUsuario,
  nuevoToken,
} from "./claves";

describe("contraseñas", () => {
  it("el hash no contiene la contraseña y cambia en cada llamada", async () => {
    const uno = await hashDeClave("Santiso2026!");
    const otro = await hashDeClave("Santiso2026!");
    expect(uno).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(uno).not.toContain("Santiso2026");
    expect(uno).not.toBe(otro);
  });

  it("acepta la contraseña buena y rechaza cualquier otra", async () => {
    const hash = await hashDeClave("Santiso2026!");
    expect(await claveCorrecta("Santiso2026!", hash)).toBe(true);
    expect(await claveCorrecta("santiso2026!", hash)).toBe(false);
    expect(await claveCorrecta("", hash)).toBe(false);
  });

  it("un hash mal formado nunca da por buena una contraseña", async () => {
    expect(await claveCorrecta("x", "")).toBe(false);
    expect(await claveCorrecta("x", "md5$aa$bb")).toBe(false);
    expect(await claveCorrecta("x", "scrypt$00$00")).toBe(false);
  });

  it("exige un mínimo de longitud", () => {
    expect(errorDeClave("123")).toMatch(/al menos 4/);
    expect(errorDeClave("1234")).toBeNull();
    expect(errorDeClave("a".repeat(201))).toMatch(/demasiado larga/);
  });
});

describe("usuarios y sesiones", () => {
  it("normaliza el nombre de usuario y valida su forma", () => {
    expect(normalizarUsuario("  Mou ")).toBe("mou");
    expect(errorDeUsuario("Mou")).toBeNull();
    expect(errorDeUsuario("dani.iglesias")).toBeNull();
    expect(errorDeUsuario("ab")).not.toBeNull();
    expect(errorDeUsuario("con espacio")).not.toBeNull();
    expect(errorDeUsuario("ñandú")).not.toBeNull();
  });

  it("cada token es distinto y su huella no lo revela", () => {
    const token = nuevoToken();
    expect(token).not.toBe(nuevoToken());
    expect(token.length).toBeGreaterThanOrEqual(40);
    const huella = huellaDeToken(token);
    expect(huella).toMatch(/^[0-9a-f]{64}$/);
    expect(huella).toBe(huellaDeToken(token));
    expect(huella).not.toContain(token);
  });
});
