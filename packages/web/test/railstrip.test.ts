import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";
import { STRIP_WIDTH, dockEdges, railSpan } from "../src/lib/stage.ts";

/**
 * **The rail when it is shut is a surface, not an absence.**
 *
 * Closing the Chat left a bare edge and no way to learn that anything had
 * happened in there. The strip carries the two facts you would otherwise have
 * to open the panel to find out: how much you have not read, and which agents
 * are working right now.
 */
const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

describe("the shut rail takes room, and everything that stands beside it knows", () => {
  const dock = (over = {}) => ({
    mainPanelOpen: false,
    filesPanelOpen: false,
    agentsPanelOpen: false,
    trashOpen: false,
    marksOpen: false,
    panelWidth: 320,
    ...over,
  });

  it("reserves the strip even with no panel open", () => {
    // The strip floats over the canvas exactly as the open rail does, so
    // framing must refuse to park an item under it for exactly the same
    // reason. Before this the left edge was 0 and an item framed there would
    // have sat beneath the agent faces.
    expect(dockEdges(dock()).left).toBe(railSpan(STRIP_WIDTH));
    expect(dockEdges(dock()).left).toBeGreaterThan(0);
  });

  it("keeps the stylesheet's width and the layout's width the same number", () => {
    // The CSS cannot import the constant, so this is the seam where a strip
    // that LOOKS 48px wide and is reserved as something else would show up.
    // Everything downstream — framing, the pan, the minimap — trusts the
    // constant, so the drawing is the thing that has to be checked.
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    const rule = /\.rail-strip\s*\{[^}]*\}/.exec(css)?.[0] ?? "";
    expect(rule, ".rail-strip must exist to be measured").not.toBe("");
    expect(rule).toMatch(new RegExp(`width:\\s*${STRIP_WIDTH}px`));
  });
});

describe("the strip does not compute anything a second way", () => {
  const strip = read("components/RailStrip.tsx");

  it("rings the agents `isocan who` would call working", () => {
    // `sessionState` is the reader the terminal prints from. Sharing it is
    // what makes "the ring is on" and "the terminal says working" the same
    // claim rather than two that were written to agree and can drift.
    expect(strip).toMatch(/sessionState\(/);
    const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
    // Exactly the two states worth interrupting for. A ring that is always on
    // says nothing, so `parked`, `quiet` and `here` deliberately have none.
    expect(css).toMatch(/\.strip-face\.is-working/);
    expect(css).toMatch(/\.strip-face\.is-blocked/);
    for (const quiet of ["is-parked", "is-quiet", "is-here"]) {
      expect(css, `${quiet} must not ring`).not.toContain(`.strip-face.${quiet}`);
    }
  });

  it("counts the CHAT's unread, not the canvas's", () => {
    /**
     * The badge sits on the button that opens the Chat, so it must count the
     * Chat. The first version summed every thread and put comment pins from
     * all over the canvas onto the Chat's badge — verified live: two Chat
     * messages plus one unrelated pin read "3" before this and "2" after,
     * while the tab title correctly went from (1) to (2).
     *
     * The tab title counting THREADS is not a contradiction: it answers "how
     * many conversations want you" across the whole canvas. Two numbers, two
     * questions.
     */
    expect(strip).toMatch(/mainThread\(canvas\)/);
    expect(strip, "unreadCount on the Chat, not a sum over every thread").toMatch(
      /unreadCount\(chat,/,
    );
    expect(strip).not.toMatch(/pending\.reduce/);
  });

  it("is the shut rail, so it is never drawn beside an open one", () => {
    expect(strip).toMatch(/if \(!canvas \|\| mainOpen \|\| filesOpen\) return null;/);
  });

  it("can be clicked, because a count you cannot act on is a taunt", () => {
    expect(strip).toMatch(/openPanel\(canvasId, "main"\)/);
  });
});

describe("⌘J is one row that reaches both surfaces", () => {
  it("is registered once, and both the overlay and the CLI read that registry", () => {
    // Copy and paste shipped as ⌘C/⌘V with no row at all, so `?` and
    // `isocan shortcuts` both denied a key the app listened for. One row,
    // two readers, is the shape that cannot drift.
    const row = SHORTCUTS.find((s) => s.keys.includes("⌘J"));
    expect(row?.does).toBe("Open or close the Chat");
    expect(read("components/HelpPanel.tsx")).toMatch(/SHORTCUT_GROUPS|shortcutsIn/);
  });

  it("has a handler that actually listens for it", () => {
    /**
     * The gap the plan named: nothing catches a documented shortcut with no
     * implementation. This closes it for ⌘J specifically and NOT in general —
     * a table-driven check over every row would need to guess how each key is
     * spelled in a handler, and a guard that guesses is one that eventually
     * passes for the wrong reason.
     *
     * Whether a BROWSER hands ⌘J to a page is a different question, and it
     * could not be answered where this was built: the harness delivers no key
     * events to the page at all, so a plain `j` never arrived either and the
     * test was inconclusive rather than negative. Recorded in the phases doc.
     * The feature does not rest on it — the strip is a button.
     */
    const page = read("pages/CanvasPage.tsx");
    expect(page).toMatch(/e\.key\.toLowerCase\(\) === "j"/);
    expect(page, "and it must toggle rather than only open").toMatch(
      /mainPanelOpen \|\| ui\.filesPanelOpen \? null : "main"/,
    );
  });
});
