import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SHORTCUTS, keyFor, latelyOrder } from "@isocan/core";
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
const menuentries = bare(read("../src/lib/menuentries.tsx"));

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

/**
 * **And the half that is not this browser's** (#134 walk step 4, #147).
 *
 * "Lately" is the home's seen-marks now, so a person on two machines finds
 * the same canvases at the top of ⌘O. What must hold is that it is the home
 * FIRST and the browser UNDERNEATH: the durable answer leads, and a daemon
 * that cannot answer costs an ordering rather than the switcher.
 */
describe("lately, shared across your machines", () => {
  const marks = {
    prj_old: { seq: 40, at: "2026-09-10T10:00:00.000Z" },
    prj_new: { seq: 2, at: "2026-09-12T10:00:00.000Z" },
  };

  it("leads with the home's marks, newest visit first", () => {
    expect(latelyOrder(marks).map((row) => row.canvasId)).toEqual(["prj_new", "prj_old"]);
  });

  it("keeps the write on the visit and nowhere else", () => {
    // The one rule that lets the inbox and the switcher read one fact. A
    // second caller is how "lately" starts naming canvases nobody opened.
    const callers = [...bare(read("../src/lib/seen.ts")).matchAll(/putSeen\(/g)];
    expect(callers).toHaveLength(1);
    expect(page, "the canvas page is the visit").toContain("noteVisit(canvasId");
  });

  it("reads BEFORE it writes, so the two do not race the claim recovery", () => {
    /**
     * lessons.md #54, found by driving a real browser on the day this was
     * built. `lib/api.ts` heals a `not-your-actor` once and replays, guarded
     * by a single in-flight flag — so of two requests fired in the same tick
     * only one may heal. Fired together, the READ healed and the WRITE died,
     * silently, because a mark is deliberately allowed to fail quietly: every
     * canvas opened after the first page load recorded nothing.
     */
    const seen = bare(read("../src/lib/seen.ts"));
    expect(seen).toMatch(/loadSeen\(actorId\)\s*\.then\(\(\) => putSeen\(/);
    expect(page, "and the page asks for one thing, not two in a row").not.toContain("loadSeen(");
  });

  it("reads the marks for the person, not for the browser", () => {
    expect(bare(read("../src/lib/lately.ts"))).toContain("seenMarks(actorId)");
    expect(palette).toContain("latelyIds(actor.id)");
  });

  it("falls back to this browser's recents underneath", () => {
    // Offline the marks are empty and the recents are the whole list, which
    // is what the 6 Sep design rested on and must keep resting on.
    expect(bare(read("../src/lib/lately.ts"))).toContain("readRecents()");
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

  it("the ··· menu's row opens the same window, and the caret is gone", () => {
    /**
     * The caret beside the canvas name was the third door until 6 Sep 2026.
     * It was removed because it and the `···` were adjacent glyphs meaning
     * different things, with nothing on either to say which — and clicking the
     * NAME opens the rename editor, so the caret was not part of the name the
     * way it is in every app that shape was borrowed from.
     *
     * The negative half is the half worth holding: a caret quietly returning
     * to the bar puts the ambiguity back, and it would look like an
     * improvement in the diff.
     */
    expect(menuentries).toContain('label: "Switch canvas…"');
    expect(menuentries).toContain('shortcutFor: "Switch canvas"');
    expect(crumb, "the caret is gone from the bar").not.toContain("canvas-switch");
    expect(crumb, "and so is its label").not.toContain('aria-label="Switch canvas"');
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
  it("is ranked by core, with lately handed in", () => {
    // One ranking for the inline "Switch to" group, the switcher's face, and
    // the count of what the list scope hides: two matchers would be two
    // answers to "which canvas did I mean".
    expect(palette.match(/rankCanvases\(/g)?.length).toBe(3);
    // `latelyIds` leads with the home's marks and falls back to these; the
    // palette still reads them directly for the offline stand-in list.
    expect(palette).toContain("latelyIds(actor.id)");
    expect(palette).toContain("readRecents()");
  });

  it("reads the canvases this origin is the home of, like the home screen", () => {
    // `listCanvases` carries the `here` argument (phase 10.3); a wider list
    // would be rows that open a stale local copy of a canvas homed elsewhere.
    expect(palette).toContain("listCanvases()");
  });

  it("never offers the canvas you are on", () => {
    expect(palette).toMatch(/rankCanvases\(canvases, query, recents, canvasId, scope\)/);
  });

  it("lights the matched letters", () => {
    expect(palette).toContain("litRuns(");
    const sheet = rules(withoutComments());
    expect(sheet.some((r) => r.selector === ".palette-canvas-title mark")).toBe(true);
  });
});

/**
 * **The switcher's scope toggle** (#194, built 11 Sep as the issue asked).
 *
 * Which canvases a scope offers is core's (`rankCanvases` with a `ShelfScope`,
 * held in `core/test/canvasswitch.test.ts`, including that each scope offers
 * exactly the set `inScope` gives `canvas list`). What lives here is the
 * control: that it hands core the scope and not a second filter, that it
 * starts at the list every opening, and that it is reachable without a mouse
 * by the key every other surface prints for it.
 */
describe("the scope toggle", () => {
  it("hands both rankings the toggle's scope — the list, or the list and the shelf", () => {
    expect(palette).toContain('const scope: ShelfScope = withArchived ? "all" : "live";');
    // Both the switcher's face and the inline "Switch to" group: a toggle
    // that widened one and not the other would be two answers again.
    expect(palette.match(/canvasId, scope\)/g)?.length).toBe(2);
    // And no filter of its own — a second fold over `properties` is how
    // "archived" comes to mean two things.
    expect(palette).not.toMatch(/properties\??\.shelved/);
  });

  it("starts at the list on every opening, and remembers nothing", () => {
    // Remembered, one search would un-archive the shelf from this window for
    // good — the home screen's `Archived` resets for the same reason.
    expect(palette).toContain("const [withArchived, setWithArchived] = useState(false);");
    expect(palette, "no storage behind the scope").not.toContain("localStorage");
  });

  it("is a labelled checkbox a Tab away from the field, and ⌥A from inside it", () => {
    expect(palette).toMatch(/<label className="palette-scope">\s*<input\s+type="checkbox"/);
    expect(palette).toContain("<span>Include archived</span>");
    expect(palette).toContain('aria-keyshortcuts="Alt+A"');
    // By `code`: on a Mac ⌥A types "å", so `key` is not "a".
    expect(palette).toMatch(/e\.altKey &&\s*!e\.metaKey &&\s*!e\.ctrlKey &&\s*e\.code === "KeyA"/);
    // Offered only while something is archived — ⌥A included, so a title
    // with an å in it can still be typed on a home with no shelf.
    expect(palette).toMatch(/switching &&\s*hasShelf &&\s*e\.altKey/);
    expect(palette).toContain("{switching && hasShelf && (");
  });

  it("prints the key the help panel prints", () => {
    expect(keyFor("Include archived canvases")).toBe("⌥A");
    expect(palette).toContain("keyFor(INCLUDE_ARCHIVED)");
    expect(palette).toContain('const INCLUDE_ARCHIVED = "Include archived canvases";');
  });

  it("says what the list scope is hiding, so the default never reads as 'no such canvas'", () => {
    // Counted by the same ranking under the shelf's own scope.
    expect(palette).toContain('rankCanvases(canvases, query, [], canvasId, "shelved").length');
    expect(palette).toContain('className="palette-shelf-hint" onClick={toggleArchived}');
    const sheet = rules(withoutComments());
    expect(sheet.some((r) => r.selector === ".palette-scope")).toBe(true);
    expect(sheet.some((r) => r.selector === ".palette-shelf-hint")).toBe(true);
  });
});

/**
 * **What makes showing an archived canvas beside live ones safe** (#194).
 *
 * Under Include archived, `rankCanvases` ranks them among the live ones —
 * that half is core's. The half that lives here is that the row SAYS SO.
 * Take that away and the design stops being defensible: a canvas somebody
 * put away comes back looking exactly like one they did not, on a screen
 * whose whole job is telling canvases apart at a glance.
 *
 * Two surfaces show them beside live ones — this window, and the home
 * screen's grid under `Archived` — so both are checked, against one chip.
 */
describe("an archived canvas says it is archived", () => {
  const list = bare(read("../src/pages/CanvasListPage.tsx"));

  it("marks the switcher's row", () => {
    expect(palette).toContain('row.shelved && <span className="shelf-tag">Archived</span>');
  });

  it("marks the home screen's card", () => {
    expect(list).toContain('isShelved(canvas) && <span className="shelf-tag">Archived</span>');
  });

  it("is one chip and one word, not one per surface", () => {
    // Two rules would end up two different words for one state — the way
    // this codebase got `faceMark`/`initial`.
    const sheet = rules(withoutComments());
    expect(sheet.filter((r) => r.selector.includes(".shelf-tag"))).toHaveLength(1);
    expect(sheet.some((r) => r.selector === ".shelf-tag")).toBe(true);
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
