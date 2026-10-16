// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { UI_PIECES, findUiKnob, findUiPiece } from "@isocan/core/ui-tweaks";
import { SHORTCUTS, keyFor } from "@isocan/core";
import UiDevtools, { collectPieceGlowBoxes, defaultRangeOffset } from "../src/components/UiDevtools.tsx";
import { canvasMenu, chromeMenu } from "../src/lib/menuentries.tsx";
import {
  UI_TWEAKS_STORAGE_KEY,
  closeUiDevtools,
  openUiDevtools,
  startUiPiecePicker,
  stopUiPiecePicker,
  toggleUiDevtools,
  useUiTweaksSignal,
} from "../src/lib/uitweaks.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const read = (rel: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../src", rel), "utf8");

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

  it("computes defaultRangeOffset centred under the 16px slider thumb", () => {
    const glassOpacity = findUiKnob("glass.opacity")!;
    // (0.78 - 0.2) / (1 - 0.2) = 0.725
    expect(defaultRangeOffset(glassOpacity)).toBe("calc(8px + 0.725 * (100% - 16px))");

    const atMin = { ...glassOpacity, min: 0, max: 100, defaultValue: 0 };
    expect(defaultRangeOffset(atMin)).toBe("calc(8px + 0 * (100% - 16px))");

    const atMid = { ...glassOpacity, min: 0, max: 100, defaultValue: 50 };
    expect(defaultRangeOffset(atMid)).toBe("calc(8px + 0.5 * (100% - 16px))");

    const atMax = { ...glassOpacity, min: 0, max: 100, defaultValue: 100 };
    expect(defaultRangeOffset(atMax)).toBe("calc(8px + 1 * (100% - 16px))");
  });

  it("collects visible glow boxes for a piece and skips hidden or devtools elements", () => {
    const stage = document.createElement("div");
    stage.innerHTML = `
      <div class="toolbar">
        <div class="bar-cluster" id="cluster-a" style="border-radius: 999px"></div>
        <div class="bar-cluster" id="cluster-hidden" style="opacity: 0"></div>
      </div>
      <aside class="ui-devtools">
        <div class="bar-cluster" id="inside-devtools"></div>
      </aside>
    `;
    document.body.appendChild(stage);

    const rectFor = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;

    stage.querySelector("#cluster-a")!.getBoundingClientRect = () => rectFor(20, 20, 140, 34);
    stage.querySelector("#cluster-hidden")!.getBoundingClientRect = () => rectFor(170, 20, 80, 34);
    stage.querySelector("#inside-devtools")!.getBoundingClientRect = () => rectFor(600, 68, 100, 34);

    const toolbarPiece = findUiPiece("toolbar")!;
    const boxes = collectPieceGlowBoxes(toolbarPiece);
    expect(boxes).toEqual([
      { left: 20, top: 20, width: 140, height: 34, borderRadius: "999px" },
    ]);

    // Full-bleed piece (`:root` for colors) insets by 6px so the border glow stays inside the viewport.
    const origRootRect = document.documentElement.getBoundingClientRect;
    document.documentElement.getBoundingClientRect = () =>
      rectFor(0, 0, window.innerWidth, window.innerHeight);
    try {
      const colorBoxes = collectPieceGlowBoxes(findUiPiece("colors")!);
      expect(colorBoxes).toEqual([
        {
          left: 6,
          top: 6,
          width: window.innerWidth - 12,
          height: window.innerHeight - 12,
          borderRadius: "12px",
        },
      ]);
    } finally {
      document.documentElement.getBoundingClientRect = origRootRect;
      stage.remove();
    }
  });

  it("renders default markers on range sliders and glows controls when clicking a piece pill", () => {
    localStorage.removeItem(UI_TWEAKS_STORAGE_KEY);
    const rail = document.createElement("div");
    rail.className = "tool-rail";
    rail.style.borderRadius = "14px";
    rail.getBoundingClientRect = () =>
      ({
        left: 960,
        top: 200,
        width: 44,
        height: 220,
        right: 1004,
        bottom: 420,
        x: 960,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(rail);

    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    try {
      act(() => {
        openUiDevtools("glass");
        root.render(h(UiDevtools, { canvasId: "prj_acme", actor: { id: "usr_a", name: "Ada" } }));
      });

      const ticks = host.querySelectorAll<HTMLElement>(".ui-devtools-range-default");
      expect(ticks.length).toBeGreaterThan(0);
      expect(ticks[0]!.style.left).toBe("calc(8px + 0.725 * (100% - 16px))");
      expect(ticks[0]!.classList.contains("changed")).toBe(false);

      // Click the "Tool Rail" piece pill and verify a glow overlay renders for `.tool-rail`.
      const railTab = Array.from(host.querySelectorAll<HTMLButtonElement>(".ui-devtools-tab")).find(
        (btn) => btn.textContent === "Tool Rail",
      );
      expect(railTab).toBeTruthy();
      act(() => {
        railTab!.click();
      });

      const glowEl = host.querySelector<HTMLElement>(".ui-devtools-glow");
      expect(glowEl).toBeTruthy();
      expect(glowEl!.getAttribute("data-glow-piece")).toBe("rail");
      expect(glowEl!.style.left).toBe("960px");
      expect(glowEl!.style.top).toBe("200px");
      expect(glowEl!.style.width).toBe("44px");
      expect(glowEl!.style.height).toBe("220px");
    } finally {
      act(() => root.unmount());
      host.remove();
      rail.remove();
      localStorage.removeItem(UI_TWEAKS_STORAGE_KEY);
    }
  });
});
