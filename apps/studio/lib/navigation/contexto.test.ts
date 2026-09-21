import { describe, expect, it, vi } from "vitest";
vi.mock("@/components/studio/StudioContext", () => ({ useOptionalStudio: () => null }));
vi.mock("@/lib/server/acciones/competiciones", () => ({}));
vi.mock("@/lib/lecturas-cliente", () => ({}));
import { resolveContextId } from "../useCompeticiones";
describe("resolveContextId", () => {
  const options = [{ id: "a" }, { id: "b" }];
  it("preserves URL selection and back navigation", () => {
    expect(resolveContextId("b", options, "a")).toBe("b");
    expect(resolveContextId("a", options, "b")).toBe("a");
  });
  it("normalizes missing and invalid IDs", () => {
    expect(resolveContextId(null, options, "b")).toBe("b");
    expect(resolveContextId("foreign", options, "b")).toBe("b");
    expect(resolveContextId("foreign", options, "deleted")).toBe("a");
  });
  it("clears empty season/category", () => {
    expect(resolveContextId("a", [], "a")).toBe("");
  });
});
