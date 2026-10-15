import { describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { resolveNodeFocus } from "../src/lib/focusRegistry.ts";

function makeScreenItem(id: string, properties: Record<string, string> = {}): Item {
  const version = {
    id: `${id}_v1`,
    blobHash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    mimeType: "text/html",
    filename: "acme-screen.html",
    size: 512,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
  };
  return {
    id,
    title: "Acme Screen",
    description: "",
    x: 0,
    y: 0,
    width: 1280,
    height: 800,
    properties,
    reactions: {},
    versions: [version],
    currentVersionId: version.id,
    createdAt: "2026-10-15T00:00:00.000Z",
    createdBy: { id: "u_test", name: "Test" },
    updatedAt: "2026-10-15T00:00:00.000Z",
    updatedBy: { id: "u_test", name: "Test" },
  };
}

describe("Wireframe Focus shell dispatch (node-focus phase 5)", () => {
  it("resolves wireframe screens to module.wireframe (priority 20) and skips prototype items", () => {
    const wire = makeScreenItem("it_wire", { fidelity: "wireframe" });
    const facet = resolveNodeFocus(wire);
    expect(facet?.id).toBe("module.wireframe");
    expect(facet?.priority).toBe(20);

    const proto = makeScreenItem("it_proto", {
      fidelity: "wireframe",
      wirePrototype: "flow_acme",
    });
    expect(resolveNodeFocus(proto)?.id).toBe("builtin.screen");
  });

  it("falls back cleanly to builtin.screen when fidelity is absent", () => {
    const plain = makeScreenItem("it_plain", {});
    expect(resolveNodeFocus(plain)?.id).toBe("builtin.screen");
  });
});
