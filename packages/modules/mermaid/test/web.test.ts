import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MERMAID_MIME } from "../src/core.ts";
import { isMermaidFocusMatch, mermaidFocusFacet, mermaidWeb } from "../src/web.tsx";
import { extractMermaidNodes, renameMermaidNodeLabel } from "../src/focus.tsx";

/**
 * **The renderer slot, structurally.** The library is behind a lazy boundary
 * and only `diagram.tsx` imports it; the renderer claims exactly the mime the
 * kind claims; the shell mounts module renderers ahead of its own chain; and
 * the drawing takes its colours from the page's tokens.
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");
const web = read("../src/web.tsx");
const diagram = read("../src/diagram.tsx");
const itemView = read("../../../web/src/components/ItemView.tsx");
const css = read("../../../web/src/styles.css");

describe("the diagram renderer", () => {
  it("claims the kind's mime and nothing else", () => {
    expect(mermaidWeb.renderers?.map((r) => r.mimes)).toEqual([[MERMAID_MIME]]);
    expect(mermaidWeb.underlays ?? []).toEqual([]);
  });

  it("keeps the library on the far side of a lazy boundary", () => {
    expect(web).toContain('lazy(() => import("./diagram.tsx"))');
    expect(web).not.toMatch(/from "mermaid"/);
    expect(diagram).toContain('from "mermaid"');
  });

  it("renders strictly — the text is somebody else's", () => {
    expect(diagram).toContain('securityLevel: "strict"');
  });

  it("is asked before the built-in chain, with the facts and never a blob path", () => {
    const head = itemView.slice(itemView.indexOf("function VersionContent("), itemView.indexOf('if (designSystem && (mimeType === "text/markdown"'));
    // Asked with the item too, so a renderer that claims only items carrying
    // a property (critique's critic cards) can say whether this one is theirs.
    expect(head).toContain("moduleRendererFor(mimeType, moduleItem)");
    expect(head).toContain("useCallback(() => readBlobText(canvasId, blobHash), [canvasId, blobHash])");
    expect(head).toContain("readText={readText}");
    expect(diagram).not.toMatch(/["'`]\/api\//);
  });

  it("draws on the page's own surface tokens", () => {
    const rule = css.slice(css.indexOf(".diagram-view {"), css.indexOf("}", css.indexOf(".diagram-view {")));
    expect(rule).toContain("var(--card)");
    expect(rule).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });

  it("declares a ModuleFocus facet (module.mermaid) and extracts/renames diagram nodes cleanly", () => {
    expect(mermaidFocusFacet.id).toBe("module.mermaid");
    expect(mermaidFocusFacet.priority).toBe(15);
    expect(typeof isMermaidFocusMatch).toBe("function");
    const dsl = `flowchart LR\n  A["Client App"] --> B["Auth Gateway"]\n  B --> C["Billing Service"]`;
    expect(extractMermaidNodes(dsl)).toEqual([
      { id: "A", label: "Client App" },
      { id: "B", label: "Auth Gateway" },
      { id: "C", label: "Billing Service" },
    ]);
    expect(renameMermaidNodeLabel(dsl, "B", "Identity Desk")).toContain('B["Identity Desk"]');
  });
});
