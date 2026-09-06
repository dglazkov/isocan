import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXTENSION_ICONS } from "@isocan/core";
import { ToolGlyph } from "../src/lib/tools.tsx";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const src = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

/**
 * Stage 1 of `docs/projects/extensions/design.md` on this surface. What is
 * worth guarding here is not that a button appears — it is the two claims the
 * whole safety argument rests on, either of which could be quietly broken by
 * somebody making the rail "better".
 */
describe("a canvas's own tools", () => {
  it("goes through the same door a person's message goes through", () => {
    /**
     * **The design's whole sentence, as a test:** *an extension may only ask
     * for what a person could ask for.* A tool press posts the ask via
     * `postToMain` — the same function the composer and ⌘K call — so what
     * follows is a comment by the pressing actor, attributed and undoable per
     * actor, and an agent carries it out.
     *
     * The failure this exists to catch is somebody deciding a button should
     * "just do it" and calling `sendEchoed` with an operation instead. That
     * would be an extension acting DIRECTLY, which is the one thing the model
     * forbids, and nothing about the rail would look wrong.
     */
    const rail = src("components/CanvasTools.tsx");
    const press = rail.slice(rail.indexOf("tool-ext"));
    expect(press, "a tool press must post the ask, not apply it").toContain("postToMain");
    expect(press, "a tool must not send an operation of its own").not.toMatch(/sendEchoed|sendOp|type: "item\./);
  });

  it("reads a manifest with core's reader and no parser of its own", () => {
    /**
     * A second little parser here is how the rail and `isocan tool list` would
     * come to disagree about what a tool is — the same shape lesson #5 names,
     * and the same one `roadmap.mjs` is held to.
     */
    const lib = src("lib/tools.tsx");
    expect(lib).toContain("readToolExtension");
    expect(lib, "the rail must not parse a manifest itself").not.toContain("JSON.parse");
  });

  it("draws every icon core names, and only those", () => {
    // The Record is exhaustive at compile time; this catches the runtime half
    // TypeScript cannot see — a key present with nothing in it.
    for (const icon of EXTENSION_ICONS) {
      const html = renderToStaticMarkup(createElement(ToolGlyph, { icon }));
      expect(html, `${icon} draws nothing`).toMatch(/<path d="M[^"]{10,}"/);
      expect(html, `${icon} paints its own colour`).toContain('stroke="currentColor"');
    }
  });

  it("says a tool is unavailable rather than dropping it", () => {
    // The design's own open question — what happens to a canvas whose
    // extension is gone — and the answer is that the rail still shows it.
    const lib = src("lib/tools.tsx");
    expect(lib).toContain("problem");
    const rail = src("components/CanvasTools.tsx");
    expect(rail).toContain("unavailable");
    expect(rail, "an unreadable tool is shown, disabled — not filtered out").toContain("disabled={!t.tool}");
  });
});
