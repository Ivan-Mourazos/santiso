import { describe, expect, it } from "vitest";
import { urlMedia } from "./media";

describe("urlMedia", () => {
  it("construye la URL codificando cada segmento", () => {
    expect(urlMedia("escudos/abc.webp")).toBe("/media/escudos/abc.webp");
    expect(urlMedia("sponsors/café bar#1.webp")).toBe("/media/sponsors/caf%C3%A9%20bar%231.webp");
  });
});
