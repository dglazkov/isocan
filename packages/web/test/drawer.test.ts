import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { chromeMenu } from "../src/lib/menuentries.ts";
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
    trashOpen: false,
    trashCount: 0,
    minimapOpen: true,
    ...over,
  });

describe("the drawer holds everything it took", () => {
  it("offers files, trash, the map and the shortcut list", () => {
    const found = labels(menu()).join(" | ");
    for (const control of ["Files", "Agents", "Trash", "map", "shortcuts"]) {
      expect(found, `${control} left the bar and must be in the drawer`).toContain(control);
    }
  });

  it("no longer keeps those four in the bar", () => {
    // The other half: a control in both places is not a drawer, it is a
    // duplicate — and the duplicate is what makes people believe the drawer
    // is optional and stop looking in it.
    expect(toolbar, "the trash button moved").not.toMatch(/setTrashOpen\(!trashOpen\)\}\s*>/);
    expect(toolbar, "the help button moved").not.toMatch(/className="btn help-btn"/);
    expect(toolbar, "Chat|Files moved").not.toMatch(/<PanelSwitch/);
  });

  it("says what state each toggle is in, so a label is never a lie", () => {
    // "Files" when it is shut and "Hide files" when it is open. A menu that
    // says "Files" while the files are already showing has told you nothing
    // about what the click will do.
    expect(labels(menu({ filesOpen: false }))).toContain("Files");
    expect(labels(menu({ filesOpen: true }))).toContain("Hide files");
    expect(labels(menu({ minimapOpen: true }))).toContain("Hide the map");
    expect(labels(menu({ minimapOpen: false }))).toContain("Show the map");
    expect(labels(menu({ agentsOpen: true }))).toContain("Hide agents");
  });

  it("carries the trash count, which is the one thing the bar said that a handle cannot", () => {
    // `🗑 16` was information at a glance. A bare `···` cannot show it, so the
    // number travels with the label instead of being dropped quietly.
    expect(labels(menu({ trashCount: 16 })).join(" ")).toContain("Trash (16)");
    expect(labels(menu({ trashCount: 0 })).join(" "), "and no empty parentheses").toContain("Trash");
    expect(labels(menu({ trashCount: 0 })).join(" ")).not.toContain("(0)");
  });

  it("leaves Chat out, because Chat already has two doors", () => {
    /**
     * The strip is a permanent surface carrying its unread count, and ⌘J
     * toggles it. A third door would make the strip look decorative and give
     * one thing three ways in — which is how a menu becomes a junk drawer.
     */
    expect(labels(menu()).join(" ")).not.toContain("Chat");
  });
});
