import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";
import { HIDEABLE } from "../src/lib/hideable.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const actions = read("../src/lib/actions.ts");
const zoom = read("../src/components/ZoomControls.tsx");
const rail = read("../src/components/CanvasTools.tsx");
const identity = read("../src/components/IdentityMenu.tsx");
const store = read("../src/stores/uiStore.ts");

/**
 * **Chrome you can turn off** (`docs/research/2026-09-02-chrome-you-can-turn-off.md`,
 * stages 1 and 4). The test that keeps the door open: a control may be
 * hidden only if the thing it does is reachable another way, and the
 * palette — which cannot be hidden — always has "Show hidden controls".
 */
describe("every hideable control names its other door", () => {
  it("each registry entry names a shortcut that exists in core, or a ⌘K action that exists", () => {
    for (const entry of HIDEABLE) {
      const byKey = entry.shortcut ? SHORTCUTS.some((s) => s.does === entry.shortcut) : false;
      const byCommand = entry.command ? actions.includes(`id: "${entry.command}"`) : false;
      expect(byKey || byCommand, `${entry.id} has no other door`).toBe(true);
      expect(entry.stillReachable, `${entry.id} must say how to get it back`).toMatch(/still|brings/);
    }
  });

  it("the palette's own command to show everything is not in the registry and is always offered", () => {
    expect(actions).toContain('id: "show-chrome"');
    expect(actions).toContain("run: showAllChrome");
    expect(HIDEABLE.some((entry) => entry.id.includes("palette") || entry.command === "show-chrome")).toBe(false);
  });
});

describe("the two controls asked for hide by right-click and come back from Settings", () => {
  it("undo/redo and History consult the store and offer Hide on right-click", () => {
    expect(zoom).toContain('useChromeHidden("zoom.undo")');
    expect(zoom).toContain('hideMenu(e, "zoom.undo")');
    expect(rail).toContain('useChromeHidden("rail.history")');
    expect(rail).toContain('hideMenu(e, "rail.history")');
  });

  it("Settings under the identity menu lists the registry with a switch each and Show everything", () => {
    expect(identity).toContain("HIDEABLE.map((entry) =>");
    expect(identity).toContain("Show everything");
    expect(identity).toContain("setChromeHidden(entry.id, !e.target.checked)");
  });

  it("is local, per browser, and survives an unreadable store as nothing hidden", () => {
    expect(store).toContain('const HIDDEN_CHROME_KEY = "isocan.hiddenChrome";');
    expect(store).toContain("hiddenChrome: readHiddenChrome(),");
    expect(store).toMatch(/function readHiddenChrome\(\): string\[\] \{\n  try \{/);
  });
});
