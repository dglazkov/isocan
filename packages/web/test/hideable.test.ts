import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SHORTCUTS } from "@isocan/core";
import { DISPLAY_SWITCHES, HIDEABLE } from "../src/lib/hideable.ts";

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

  it("right-click the area offers back what was hidden from it, and only then (stage 2)", () => {
    const menu = read("../src/lib/chromemenu.tsx");
    expect(menu).toContain("export function showMenu(e: React.MouseEvent, where: string)");
    expect(menu).toContain("if (hidden.length === 0) return;");
    expect(rail).toContain('onContextMenu={(e) => showMenu(e, "the rail")}');
    expect(zoom).toContain('onContextMenu={(e) => showMenu(e, "the zoom cluster")}');
    // Every registry entry's `where` is an area that has the door.
    for (const entry of HIDEABLE) expect(["the rail", "the zoom cluster", "the top edge"]).toContain(entry.where);
    expect(read("../src/components/Toolbar.tsx")).toContain('showMenu(e, "the top edge")');
  });

  it("Settings under the identity menu lists the registry with a switch each", () => {
    expect(identity).toContain("HIDEABLE.map((entry) =>");
    expect(identity).toContain("setChromeHidden(entry.id, !e.target.checked)");
  });

  /**
   * **One category, one place.** The cursor glow was a row in the `···` menu
   * while every other "what this browser draws" switch was in Settings, and
   * neither surface mentioned the other — so a person who had seen one had no
   * reason to believe the other existed. It is in Settings now.
   *
   * It is a separate list from `HIDEABLE` and that is the interesting part.
   * `HIDEABLE`'s rule is that a control may be hidden only when what it DOES
   * is reachable another way, and the case above refuses an entry with neither
   * a shortcut nor a command. An effect does nothing, so it can never satisfy
   * that rule and must never be smuggled in to sit in the same list. Same
   * section on screen, different registry, and the reason written down.
   */
  describe("effects, which are not controls", () => {
    it("keeps the glow out of the hideable registry, because it has no door", () => {
      expect(HIDEABLE.map((entry) => entry.id)).not.toContain("cursor.glow");
      for (const entry of DISPLAY_SWITCHES) {
        expect(
          HIDEABLE.some((hideable) => hideable.id === entry.id),
          `${entry.id} cannot be both: a hideable control owes a door, an effect has none`,
        ).toBe(false);
      }
    });

    it("shows it in the same Settings section, reading the same store", () => {
      expect(DISPLAY_SWITCHES.map((entry) => entry.id)).toContain("cursor.glow");
      expect(identity).toContain("DISPLAY_SWITCHES.map((entry) =>");
      expect(identity).toContain("setCursorGlow(e.target.checked)");
      expect(store).toContain('const GLOW_KEY = "isocan.cursorGlow";');
    });

    it("leaves no second home for it in the drawer", () => {
      const menu = read("../src/lib/menuentries.tsx");
      expect(menu, "a switch in two menus is a switch that disagrees with itself").not.toMatch(
        /label: ctx\.cursorGlow \?/,
      );
      expect(read("../src/components/Toolbar.tsx")).not.toMatch(/^\s*cursorGlow,$/m);
    });

    it("says what it costs everybody else, which for an effect is nothing", () => {
      for (const entry of DISPLAY_SWITCHES) {
        expect(entry.what, `${entry.id} should say whose view it changes`).toMatch(/yours|nobody/i);
      }
    });
  });

  /**
   * "Show everything" read as an action on the CANVAS — reveal what is hidden
   * out there, or select the lot — when it acts on the checkboxes directly
   * above it and nothing else. It names its own list and its own size now.
   */
  it("names what the restore button restores, and how much of it", () => {
    expect(identity, "the old label claimed the whole screen").not.toContain(">Show everything<");
    expect(identity).toMatch(/Turn all \{hiddenChrome\.length\} back on/);
  });

  it("is local, per browser, and survives an unreadable store as nothing hidden", () => {
    expect(store).toContain('const HIDDEN_CHROME_KEY = "isocan.hiddenChrome";');
    expect(store).toContain("hiddenChrome: readHiddenChrome(),");
    expect(store).toMatch(/function readIdList\(key: string\): string\[\] \{\n  try \{/);
  });
});
