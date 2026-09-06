import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SHORTCUTS, keyFor } from "@isocan/core";
import { ACTIONS, availableActions } from "../src/lib/actions.ts";
import { crossesCover } from "../src/lib/keys.ts";
import { RECENT_LIMIT, rememberVisit } from "../src/lib/recents.ts";
import { SWITCH_IN_MS, SWITCH_OUT_MS } from "../src/lib/canvasswitch.ts";
import { rules, withoutComments } from "./cssrules.ts";

/**
 * **The switcher: the launcher's second face.**
 *
 * Three doors — ⌘O, ⌘K's "Switch canvas…" row, the caret beside the name —
 * and one window behind them, leading with the canvases this browser was on
 * lately. The rules that must hold are the ones a screenshot cannot check:
 * that the doors all open the same window, that the key the palette prints
 * is the key the help panel prints, and that "lately" is one row per canvas.
 */
const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const bare = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\/.*$/gm, "");
const page = bare(read("../src/pages/CanvasPage.tsx"));
const palette = bare(read("../src/components/CommandPalette.tsx"));
const crumb = bare(read("../src/components/CanvasCrumb.tsx"));

describe("what this browser was on lately", () => {
  const a = { id: "c_a", title: "Acme" };
  const b = { id: "c_b", title: "Bramble" };

  it("puts the latest visit first", () => {
    expect(rememberVisit([a], b).map((r) => r.id)).toEqual(["c_b", "c_a"]);
  });

  it("keeps one row per canvas, at its latest place", () => {
    expect(rememberVisit([b, a], a).map((r) => r.id)).toEqual(["c_a", "c_b"]);
  });

  it("takes a rename with it", () => {
    // The title rides along so the list can paint offline; a stale one would
    // be a list that names a canvas by what it used to be called.
    const renamed = rememberVisit([a], { id: "c_a", title: "Acme, renamed" });
    expect(renamed).toEqual([{ id: "c_a", title: "Acme, renamed" }]);
  });

  it("forgets beyond the limit — a canvas from months ago is not recent", () => {
    let list: Array<{ id: string; title: string }> = [];
    for (let i = 0; i < RECENT_LIMIT + 5; i++) list = rememberVisit(list, { id: `c_${i}`, title: `${i}` });
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]!.id).toBe(`c_${RECENT_LIMIT + 4}`);
  });
});

describe("the doors", () => {
  it("⌘O opens the switcher from the canvas, and crosses a cover like ⌘K", () => {
    expect(page).toMatch(/e\.key\.toLowerCase\(\) === "o"/);
    expect(page).toContain('setPaletteOpen(ui.paletteOpen === "canvases" ? null : "canvases")');
    expect(crossesCover({ key: "o", metaKey: true })).toBe(true);
    expect(crossesCover({ key: "O", ctrlKey: true })).toBe(true);
    // Not a bare o — that would be a letter somebody typed.
    expect(crossesCover({ key: "o" })).toBe(false);
  });

  it("⌘K offers it as a row, on a canvas only", () => {
    const row = ACTIONS.find((a) => a.id === "switch-canvas");
    expect(row).toBeDefined();
    expect(row!.group).toBe("Open");
    expect(availableActions(ctx({ canvasId: null })).some((a) => a.id === "switch-canvas")).toBe(false);
    expect(availableActions(ctx()).some((a) => a.id === "switch-canvas")).toBe(true);
  });

  it("the row flips the window rather than closing it", () => {
    // Closing first and opening again would unmount the palette and mount a
    // new one — a flash, and a lost keystroke.
    expect(palette).toContain('onMode("canvases")');
    expect(palette).toMatch(/if \(row\.action\.id === SWITCH_ACTION\) \{\s*onMode\("canvases"\);\s*return;/);
  });

  it("the caret beside the name opens the same window", () => {
    expect(crumb).toContain('setPaletteOpen("canvases")');
    expect(crumb).toContain('aria-label="Switch canvas"');
  });

  it("prints one key everywhere it is offered", () => {
    // The palette's kbd, the help panel and `isocan shortcuts` must agree.
    const row = ACTIONS.find((a) => a.id === "switch-canvas")!;
    expect(keyFor("Switch canvas")).toBe(row.keys);
    expect(SHORTCUTS.some((s) => s.keys.includes("⌘O") && s.group === "Moving around")).toBe(true);
  });

  it("Backspace on an empty field steps back to the commands", () => {
    expect(palette).toMatch(/e\.key === "Backspace" && switching && query\.length === 0/);
    expect(palette).toContain('onMode("commands")');
  });
});

describe("the list", () => {
  it("is ranked by core, with the recents handed in", () => {
    // One ranking for the inline "Switch to" group and the switcher's face:
    // two matchers would be two answers to "which canvas did I mean".
    expect(palette.match(/rankCanvases\(/g)?.length).toBe(2);
    expect(palette).toContain("readRecents()");
  });

  it("reads the canvases this origin is the home of, like the home screen", () => {
    // `listCanvases` carries the `here` argument (phase 10.3); a wider list
    // would be rows that open a stale local copy of a canvas homed elsewhere.
    expect(palette).toContain("listCanvases()");
  });

  it("never offers the canvas you are on", () => {
    expect(palette).toMatch(/rankCanvases\(canvases, query, recents\.map\(\(r\) => r\.id\), canvasId\)/);
  });

  it("lights the matched letters", () => {
    expect(palette).toContain("litRuns(");
    const sheet = rules(withoutComments());
    expect(sheet.some((r) => r.selector === ".palette-canvas-title mark")).toBe(true);
  });
});

describe("the move", () => {
  it("is timed in one place and drawn in the other, to the same numbers", () => {
    const css = withoutComments();
    expect(css).toContain(`.canvas-surface.switching-out { animation: switch-out ${SWITCH_OUT_MS}ms`);
    expect(css).toContain(`.canvas-surface.switching-in { animation: switch-in ${SWITCH_IN_MS}ms`);
  });

  it("stays still for somebody who asked for no motion", () => {
    const css = withoutComments();
    const reduced = css.slice(css.indexOf(".canvas-surface.switching-out, .canvas-surface.switching-in { animation: none; }") - 60);
    expect(reduced).toContain("prefers-reduced-motion: reduce");
    // And the wait for it is skipped, not just the drawing.
    expect(bare(read("../src/lib/canvasswitch.ts"))).toContain("prefers-reduced-motion: reduce");
  });

  it("moves the surface, not the chrome", () => {
    expect(page).toContain("className={`canvas-surface${switching ? ` switching-${switching}` : \"\"}`}");
  });
});

function ctx(over: Partial<Parameters<typeof availableActions>[0]> = {}) {
  return {
    canvasId: "prj_1",
    actor: { id: "usr_1", name: "Di" },
    navigate: (() => {}) as never,
    selection: [] as string[],
    ...over,
  };
}
