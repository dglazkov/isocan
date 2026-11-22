// @vitest-environment jsdom

/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.hoisted(() => {
  if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: () => ({
        matches: false,
        media: "",
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }),
    });
  }
});
import { buildWelcomeItemAddOp, welcomeItemSpec } from "@isocan/core/welcome";
import { PromptPill, PROMPT_FOLD_DELAY_MS } from "../src/components/shell/PromptPill.tsx";
import { AgentDock, AGENT_DOCK_GEOMETRY_KEY } from "../src/components/shell/AgentDock.tsx";
import {
  SettingsShell,
  registerSettingsSection,
} from "../src/components/shell/SettingsShell.tsx";
import {
  PROMPT_DOCK_STORAGE_KEY,
  agentDockSideFor,
  clampPanelGeometry,
} from "../src/components/shell/usePanelGeometry.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme_ada", name: "Ada" };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  useCanvasStore.setState({ record: null, canvas: null, sessions: [] });
  useUiStore.setState({ selectedItemIds: [], experiments: [] });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => {
    root.unmount();
  });
  host.remove();
  vi.restoreAllMocks();
});

describe("PromptPill (OS1 ADR 0214)", () => {
  it("folds to a compact 270x42 pill 3s after idle, expands on click, shows chips, persists dock, and submits", async () => {
    vi.useFakeTimers();
    const submitted: Array<{ body: string; attachedIds: string[] }> = [];

    await act(async () => {
      root.render(
        h(PromptPill, {
          canvasId: "prj_acme",
          actor,
          selectedItems: [
            { id: "itm_1", title: "Acme Hero" },
            { id: "itm_2", title: "Acme Pricing" },
          ],
          onSubmit: (payload) => {
            submitted.push(payload);
          },
        }),
      );
    });

    const pill = () => host.querySelector<HTMLElement>(".shell-prompt-pill")!;
    expect(pill().dataset.folded).toBe("false");
    expect(pill().dataset.size).toBe("compact");

    // Selection chips appear above the input row and can be dismissed.
    expect(host.querySelectorAll(".shell-prompt-chip")).toHaveLength(2);
    const removeSecond = host.querySelector<HTMLButtonElement>(
      'button[aria-label="Remove Acme Pricing from prompt"]',
    )!;
    await act(async () => {
      removeSecond.click();
    });
    expect(host.querySelectorAll(".shell-prompt-chip")).toHaveLength(1);

    // Idle for 3s folds into the compact pill.
    await act(async () => {
      vi.advanceTimersByTime(PROMPT_FOLD_DELAY_MS);
    });
    expect(pill().dataset.folded).toBe("true");
    expect(pill().dataset.size).toBe("pill");

    // Clicking the folded pill expands back to 480px card.
    const expandBtn = host.querySelector<HTMLButtonElement>(".shell-prompt-folded-btn")!;
    await act(async () => {
      expandBtn.click();
    });
    expect(pill().dataset.folded).toBe("false");
    expect(pill().dataset.size).toBe("compact");

    // Toggle to 640px wide mode.
    const wideBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Wide width"]')!;
    await act(async () => {
      wideBtn.click();
    });
    expect(pill().dataset.size).toBe("wide");

    // Switch dock preference to "right" and verify localStorage persistence.
    const rightDock = host.querySelector<HTMLButtonElement>('button[title="Dock prompt on right"]')!;
    await act(async () => {
      rightDock.click();
    });
    expect(localStorage.getItem(PROMPT_DOCK_STORAGE_KEY)).toBe("right");
    expect(pill().dataset.dock).toBe("right");

    // Type a message and submit -> calls onSubmit with attached chip id, then folds after 3s.
    const input = host.querySelector<HTMLTextAreaElement>(".shell-prompt-input")!;
    const form = host.querySelector<HTMLFormElement>(".shell-prompt-form")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      setter.call(input, "Tidy the Acme Hero card");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(submitted).toEqual([{ body: "Tidy the Acme Hero card", attachedIds: ["itm_1"] }]);
    expect(pill().dataset.folded).toBe("false");

    await act(async () => {
      vi.advanceTimersByTime(PROMPT_FOLD_DELAY_MS);
    });
    expect(pill().dataset.folded).toBe("true");
  });
});

describe("AgentDock & usePanelGeometry (OS1 ADR 0256)", () => {
  it("anchors opposite a side-docked prompt, toggles mutually exclusive accordions, and persists dragged geometry", async () => {
    expect(agentDockSideFor("bottom")).toBe("right");
    expect(agentDockSideFor("left")).toBe("right");
    expect(agentDockSideFor("right")).toBe("left");

    expect(
      clampPanelGeometry(
        { x: -50, y: 2000, width: 100, height: 900 },
        { viewportWidth: 1000, viewportHeight: 700, minWidth: 240, minHeight: 140 },
      ),
    ).toEqual({ x: 12, y: 12, width: 240, height: 676 });

    await act(async () => {
      root.render(
        h(AgentDock, {
          canvasId: "prj_acme",
          actor,
          orientationTitle: "Acme Board",
          promptDock: "right",
          notifications: [{ id: "n1", title: "Acme Bot asked a question", detail: "Approve header?" }],
          rows: [
            {
              actorId: "usr_bot",
              name: "Acme Bot",
              state: "working",
              primary: { status: "drafting hero" },
              others: [],
              recent: [],
              ask: null,
            } as never,
          ],
        }),
      );
    });

    const dock = host.querySelector<HTMLElement>(".shell-agent-dock")!;
    expect(dock.dataset.side).toBe("left");
    expect(dock.dataset.openSection).toBe("none");

    // Open Notifications accordion.
    const triggers = host.querySelectorAll<HTMLButtonElement>(".shell-agent-dock-trigger");
    await act(async () => {
      triggers[0]!.click();
    });
    expect(dock.dataset.openSection).toBe("notifications");
    expect(host.textContent).toContain("Acme Bot asked a question");

    // Opening Agents collapses Notifications (mutually exclusive accordion).
    await act(async () => {
      triggers[1]!.click();
    });
    expect(dock.dataset.openSection).toBe("agents");
    expect(host.querySelector('[data-section="notifications"]')).toBeNull();
    expect(host.textContent).toContain("Acme Bot");

    // Clicking Agents again collapses back to null.
    await act(async () => {
      triggers[1]!.click();
    });
    expect(dock.dataset.openSection).toBe("none");

    // Pointer-capture drag persists geometry in localStorage.
    const header = host.querySelector<HTMLElement>(".shell-agent-dock-header")!;
    await act(async () => {
      header.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 100 }));
      window.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 260, clientY: 140 }));
      window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 260, clientY: 140 }));
    });
    expect(dock.dataset.customGeometry).toBe("true");
    expect(localStorage.getItem(AGENT_DOCK_GEOMETRY_KEY)).toBeTruthy();

    // Reset restores anchored dock layout.
    const resetBtn = host.querySelector<HTMLButtonElement>(".shell-agent-dock-reset")!;
    await act(async () => {
      resetBtn.click();
    });
    expect(dock.dataset.customGeometry).toBe("false");
    expect(localStorage.getItem(AGENT_DOCK_GEOMETRY_KEY)).toBeNull();
  });
});

describe("SettingsShell", () => {
  it("renders all 5 core nav sections plus module-registered sections and closes on Escape", async () => {
    const unregister = registerSettingsSection({
      id: "acme-module",
      label: "Acme Module",
      render: () => h("p", { className: "acme-mod-settings" }, "Module settings body"),
    });
    const onClose = vi.fn();

    try {
      await act(async () => {
        root.render(
          h(SettingsShell, {
            open: true,
            actor,
            onClose,
          }),
        );
      });

      const navButtons = Array.from(host.querySelectorAll<HTMLButtonElement>(".shell-settings-nav-btn"));
      expect(navButtons.map((b) => b.textContent)).toEqual([
        "Preferences",
        "Appearance",
        "API keys",
        "Connections",
        "Experimental",
        "Acme Module",
      ]);

      // Switch to Appearance and check Stitch presets are present.
      await act(async () => {
        navButtons[1]!.click();
      });
      expect(host.querySelector('[data-settings-section="appearance"]')).toBeTruthy();
      expect(host.textContent).toContain("Frosted");

      // Switch to module-registered section.
      await act(async () => {
        navButtons[5]!.click();
      });
      expect(host.querySelector(".acme-mod-settings")?.textContent).toBe("Module settings body");

      // Escape closes the modal.
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      unregister();
    }
  });
});

describe("Welcome item spec (@isocan/core/welcome)", () => {
  it("builds a concise synthetic Welcome to Open Stitch markdown card and standard item.add op", () => {
    const spec = welcomeItemSpec();
    expect(spec.kind).toBe("document");
    expect(spec.title).toBe("Welcome to Open Stitch");
    expect(spec.mimeType).toBe("text/markdown");
    expect(spec.body).toContain("## Try asking");
    expect(spec.body).toContain("## Canvas gestures");
    expect(spec.width).toBe(480);

    const op = buildWelcomeItemAddOp(spec, { blobHash: "sha256:acme", size: spec.body.length }, {
      itemId: "itm_welcome",
      versionId: "ver_welcome",
    });
    expect(op.type).toBe("item.add");
    expect(op.itemId).toBe("itm_welcome");
    expect(op.title).toBe("Welcome to Open Stitch");
    expect(op.properties).toEqual({ role: "welcome" });
    expect(op.version.blobHash).toBe("sha256:acme");
  });
});
