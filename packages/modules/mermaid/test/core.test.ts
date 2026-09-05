import { afterEach, describe, expect, it } from "vitest";
import type { Item } from "@isocan/core";
import { itemKind, itemKinds, moduleKindOf, registerModule, unregisterModule } from "@isocan/core";
import { DIAGRAM_KIND, MERMAID_MIME, mermaidModule } from "../src/core.ts";

/**
 * **The first node-type module, and the seam it proves.** With the module
 * registered a Mermaid file is a diagram — in `itemKind`, in the list every
 * surface groups by, in the mime the extension maps to. Unregistered, the
 * same file is a document, which is what a `.mmd` is: text.
 */
function itemOf(mimeType: string, filename = "flow.mmd"): Item {
  return {
    id: "itm_1",
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    title: "T",
    description: "",
    properties: {},
    currentVersionId: "ver_1",
    versions: [{ id: "ver_1", blobHash: "h", mimeType, filename, size: 1 }],
  } as unknown as Item;
}

afterEach(() => unregisterModule(mermaidModule.name));

describe("a Mermaid file", () => {
  it("is a diagram while the module is loaded, and a document when it is not", () => {
    expect(itemKind(itemOf(MERMAID_MIME))).toBe("document");
    registerModule(mermaidModule);
    expect(itemKind(itemOf(MERMAID_MIME))).toBe("diagram");
    expect(moduleKindOf(MERMAID_MIME)).toBe(DIAGRAM_KIND);
    unregisterModule(mermaidModule.name);
    expect(itemKind(itemOf(MERMAID_MIME))).toBe("document");
  });

  it("does not claim what the built-ins own", () => {
    registerModule(mermaidModule);
    expect(itemKind(itemOf("text/markdown"))).toBe("document");
    expect(itemKind(itemOf("text/html"))).toBe("screen");
  });

  it("joins the kind list before Files, so a list groups it as something made", () => {
    expect(itemKinds()).not.toContain("diagram");
    registerModule(mermaidModule);
    const kinds = itemKinds();
    expect(kinds.indexOf("diagram")).toBeGreaterThan(kinds.indexOf("canvas"));
    expect(kinds.indexOf("diagram")).toBeLessThan(kinds.indexOf("other"));
    expect(kinds[kinds.length - 1]).toBe("other");
  });

  it("names its extensions bare and its icon from the built-in set", () => {
    expect(DIAGRAM_KIND.extensions).toEqual(["mmd", "mermaid"]);
    expect(DIAGRAM_KIND.icon).toBe("drawing");
    expect(mermaidModule.propertyKeys ?? []).toEqual([]);
  });
});
