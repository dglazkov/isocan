import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { UI_PIECES } from "@isocan/core/ui-tweaks";
import { SHORTCUTS, keyFor } from "@isocan/core";
import { canvasMenu, chromeMenu } from "../src/lib/menuentries.tsx";
import {
  closeUiDevtools,
  openUiDevtools,
  startUiPiecePicker,
  stopUiPiecePicker,
  toggleUiDevtools,
  useUiTweaksSignal,
} from "../src/lib/uitweaks.ts";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

describe("UI Devtools doors and state", () => {
  afterEach(() => {
    closeUiDevtools();
  });

  it("switches pieces, toggles open/closed, and runs the element picker state", () => {
    expect(typeof useUiTweaksSignal).toBe("function");
    openUiDevtools("toolbar");
    toggleUiDevtools("toolbar");
    openUiDevtools("zoom");
    startUiPiecePicker();
    stopUiPiecePicker("minimap");
    closeUiDevtools();
  });

  it("registers ⌥D in SHORTCUTS and exposes Customize UI in ⌘K, canvas menu, and ··· drawer", () => {
    expect(keyFor("Customize UI")).toBe("⌥D");
    expect(SHORTCUTS.some((s) => s.keys.includes("⌥D") && s.does === "Customize UI")).toBe(true);

    const actions = read("lib/actions.ts");
    expect(actions).toContain('id: "ui-devtools"');
    expect(actions).toContain('id: "ui-pick-piece"');

    const canvasRows = canvasMenu({
      canvasId: "prj_acme",
      actor: { id: "usr_a", name: "Acme" },
      world: { x: 0, y: 0 },
      navigate: () => {},
    });
    expect(canvasRows.some((r) => "label" in r && r.label === "Customize UI…")).toBe(true);

    const drawerRows = chromeMenu({
      canvasId: "prj_acme",
      filesOpen: false,
      agentsOpen: false,
      contextOpen: false,
      personasOpen: false,
      mainOpen: false,
      trashOpen: false,
      trashCount: 0,
      historyOpen: false,
      unreadNews: 0,
      theme: null,
      ownGround: false,
      pickGround: () => {},
      cursor: null,
      setCursor: () => {},
      anchor: "world",
      toggleAnchor: () => {},
      openSwitcher: () => {},
      setTheme: () => {},
      toWorkbench: () => {},
    });
    expect(drawerRows.some((r) => "label" in r && r.label === "Customize UI…")).toBe(true);
  });

  it("keeps @isocan/core/ui-tweaks out of the eager entry chunk (loaded only by lazy UiDevtools)", () => {
    const page = read("pages/CanvasPage.tsx");
    expect(page).toContain('const UiDevtools = lazy(() => import("../components/UiDevtools.tsx"));');
    expect(page).not.toContain("@isocan/core/ui-tweaks");

    const eagerDoor = read("lib/uitweaks.ts");
    expect(eagerDoor).not.toContain("@isocan/core/ui-tweaks");

    const studio = read("components/UiDevtools.tsx");
    expect(studio).toContain('from "@isocan/core/ui-tweaks"');
    expect(UI_PIECES).toHaveLength(9);
  });

  it("wires right-click Tweak <Piece>… onto chrome pieces via chromeTweakMenu", () => {
    const chromemenu = read("lib/chromemenu.tsx");
    expect(chromemenu).toContain("export function chromeTweakMenu");
    for (const label of ["Top Bar", "Tool Rail", "Zoom & Undo", "Minimap", "Chat & Docks"]) {
      expect(chromemenu).toContain(`label: "${label}"`);
    }
    const page = read("pages/CanvasPage.tsx");
    expect(page).toContain("onContextMenu={chromeTweakMenu}");
  });
});
