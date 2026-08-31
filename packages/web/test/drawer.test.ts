import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chromeMenu } from "../src/lib/menuentries.tsx";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **"We moved it into a menu" is the sentence that precedes a feature nobody
 * can find again.**
 *
 * The bar had grown to eight always-present controls. Each was right on its
 * own and none was worth the canvas it cost, so four of them went behind a
 * `···`. That is a good trade exactly once — the first time something goes in
 * there and does not come out.
 *
 * So this is a NOTHING-LOST test, not a menu test. Every control the drawer
 * swallowed has to be reachable from it, and the check is against the reasons
 * they were removed rather than against the code that removed them.
 */
const toolbar = readFileSync(
  fileURLToPath(new URL("../src/components/Toolbar.tsx", import.meta.url)),
  "utf8",
);
const labels = (entries: MenuEntry[]) =>
  entries.filter((e): e is MenuAction => "label" in e).map((e) => e.label);

const menu = (over = {}) =>
  chromeMenu({
    canvasId: "prj_1",
    filesOpen: false,
    agentsOpen: false,
    contextOpen: false,
    personasOpen: false,
    mainOpen: false,
    trashOpen: false,
    trashCount: 0,
    historyOpen: false,
    minimapOpen: true,
    toWorkbench: () => {},
    ...over,
  });

describe("the drawer holds everything it took", () => {
  it("offers the rail's panels, the trash, the map and the shortcut list", () => {
    const found = labels(menu()).join(" | ");
    for (const control of ["Chat", "Files", "Agents", "Context", "Workbench", "Trash", "minimap", "shortcuts"]) {
      expect(found, `${control} must be reachable from the drawer`).toContain(control);
    }
  });

  it("no longer keeps those in the bar", () => {
    // A control in both places is not a drawer, it is a duplicate — and the
    // duplicate is what makes people believe the drawer is optional and stop
    // looking in it.
    expect(toolbar, "the trash button moved").not.toMatch(/setTrashOpen\(!trashOpen\)\}\s*>/);
    expect(toolbar, "the help button moved").not.toMatch(/className="btn help-btn"/);
    expect(toolbar, "Chat|Files moved").not.toMatch(/<PanelSwitch/);
  });

  it("offers the two panels you are NOT looking at", () => {
    /**
     * The dock holds one of three, so "hide this" was never the useful
     * question — "which of the other two" is. Toggles named what you already
     * had and said nothing about where else you could go.
     */
    expect(labels(menu({ filesOpen: true }))).not.toContain("Files");
    expect(labels(menu({ filesOpen: true }))).toContain("Chat");
    expect(labels(menu({ filesOpen: true }))).toContain("Agents");
    expect(labels(menu({ agentsOpen: true }))).not.toContain("Agents");
    expect(labels(menu({ mainOpen: true }))).not.toContain("Chat");
    // Shut, all three are on offer.
    expect(labels(menu())).toEqual(expect.arrayContaining(["Chat", "Files", "Agents", "Context"]));
  });

  it("puts the place you GO above the things you look at", () => {
    // Workbench is a room you flip to; the trash and the map are surfaces you
    // glance at. It came out of the bar because the bar's job is now what you
    // are looking at and who is here, and going somewhere is not that.
    const shown = labels(menu());
    expect(shown.indexOf("Workbench")).toBeLessThan(shown.findIndex((l) => l.startsWith("Trash")));
  });

  it("keeps them in one order, so the menu does not have to be re-read", () => {
    // A menu whose items move about is a menu you read every time. Chat,
    // Files, Agents — always, minus whichever is showing.
    const shown = labels(menu()).slice(0, 4);
    expect(shown).toEqual(["Chat", "Files", "Agents", "Context"]);
    expect(labels(menu({ filesOpen: true })).slice(0, 3)).toEqual(["Chat", "Agents", "Context"]);
  });

  it("has Chat in it, because the strip IS the shut rail", () => {
    /**
     * Chat was deliberately left out, on the argument that it already had two
     * doors — the strip and ⌘J. That argument was wrong: the strip only
     * exists when the rail is SHUT, so with Files open there was no strip and
     * therefore no visible door to the Chat at all, from the one place you
     * would most want one.
     */
    expect(labels(menu({ filesOpen: true }))).toContain("Chat");
    expect(labels(menu({ agentsOpen: true }))).toContain("Chat");
  });

  it("carries the trash count, which is the one thing the bar said that a handle cannot", () => {
    expect(labels(menu({ trashCount: 16 })).join(" ")).toContain("Trash (16)");
    expect(labels(menu({ trashCount: 0 })).join(" "), "and no empty parentheses").toContain("Trash");
    expect(labels(menu({ trashCount: 0 })).join(" ")).not.toContain("(0)");
  });

  it("says which way the remaining toggles will go", () => {
    expect(labels(menu({ minimapOpen: true }))).toContain("Hide minimap");
    expect(labels(menu({ minimapOpen: false }))).toContain("Show minimap");
    expect(labels(menu({ trashOpen: true }))).toContain("Hide trash");
  });
});

/**
 * **History was reachable and not findable**, which are different things.
 *
 * It had a clock in the tool rail and an entry in ⌘K, and neither is a door
 * somebody finds without already suspecting the room is there. A canvas that
 * remembers everything and never says so is a feature that gets rebuilt by
 * the next person who wants it.
 */
describe("the drawer offers the canvas's own past", () => {
  it("names the history timeline, and toggles it", () => {
    expect(labels(menu())).toContain("History timeline");
    expect(labels(menu({ historyOpen: true }))).toContain("Hide history timeline");
  });

  it("wears the mark the tool rail already wears", () => {
    /* `MinimapGlyph` records what happens otherwise: a second drawing of one
       thing, invented for this menu rather than found, so the row and the
       surface it opens stop looking like each other. The toolbar's local
       `HISTORY` const is gone — there is one picture now. */
    const tools = readFileSync(
      fileURLToPath(new URL("../src/components/CanvasTools.tsx", import.meta.url)),
      "utf8",
    );
    expect(tools).toContain("<HistoryGlyph");
    expect(tools, "a second drawing of the clock came back").not.toMatch(/const HISTORY = \(/);
  });

  it("sits with Trash, because they ask the same question", () => {
    /* Both are "what was here before". A history entry filed next to the
       panels would read as a fourth panel, which it is not. */
    const shown = labels(menu());
    const history = shown.findIndex((l) => /history timeline/i.test(l));
    const trash = shown.findIndex((l) => l.startsWith("Trash"));
    expect(history).toBeGreaterThan(-1);
    expect(trash).toBe(history + 1);
  });
});
