import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CURSOR_SIGNAL_MS, cursorChipLabel, cursorSignal } from "@isocan/core";
import { PresenceHub } from "../../server/src/presence.ts";
import {
  clearCursorSignal,
  commitCursorSignal,
  setCursorSignalText,
  startCursorSignal,
} from "../src/stores/canvasStore.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("temporary 20-second cursor signal", () => {
  afterEach(() => {
    clearCursorSignal();
    vi.useRealTimers();
  });

  it("lasts 20 seconds and reverts to the actor's name on expiry", () => {
    expect(CURSOR_SIGNAL_MS).toBe(20_000);
    const now = 1_000_000;
    const sig = cursorSignal("whee", now);
    expect(sig).toEqual({ text: "whee", expiresAt: now + 20_000 });
    expect(cursorChipLabel(sig, "Ada", now + 19_999)).toBe("whee");
    expect(cursorChipLabel(sig, "Ada", now + 20_000)).toBe("Ada");
    expect(cursorChipLabel(null, "Ada", now)).toBe("Ada");
  });

  it("enters edit mode on /, updates live, reverts after 20s, and cleans up on Esc", () => {
    vi.useFakeTimers();
    useUiStore.getState().setActiveTool("hand");

    startCursorSignal();
    expect(useUiStore.getState().activeTool).toBe("select");
    expect(useUiStore.getState().cursorSignalEditing).toBe(true);

    setCursorSignalText("whee");
    expect(useUiStore.getState().cursorSignal?.text).toBe("whee");
    expect(cursorChipLabel(useUiStore.getState().cursorSignal, "Ada")).toBe("whee");

    commitCursorSignal("whee");
    expect(useUiStore.getState().cursorSignalEditing).toBe(false);
    expect(cursorChipLabel(useUiStore.getState().cursorSignal, "Ada")).toBe("whee");

    vi.advanceTimersByTime(19_999);
    expect(cursorChipLabel(useUiStore.getState().cursorSignal, "Ada")).toBe("whee");

    vi.advanceTimersByTime(1);
    expect(useUiStore.getState().cursorSignal).toBeNull();
    expect(cursorChipLabel(useUiStore.getState().cursorSignal, "Ada")).toBe("Ada");

    // Pressing / and then Esc cleans up immediately.
    startCursorSignal();
    setCursorSignalText("brb");
    expect(useUiStore.getState().cursorSignalEditing).toBe(true);
    expect(useUiStore.getState().cursorSignal?.text).toBe("brb");

    clearCursorSignal();
    expect(useUiStore.getState().cursorSignalEditing).toBe(false);
    expect(useUiStore.getState().cursorSignal).toBeNull();
    expect(cursorChipLabel(useUiStore.getState().cursorSignal, "Ada")).toBe("Ada");
  });

  it("carries the signal across PresenceHub and expires it from the roster after 20s", () => {
    vi.useFakeTimers();
    const hub = new PresenceHub();
    try {
      const s = hub.createSession("prj_acme", { id: "usr_ada", name: "Ada" }, "web");
      hub.touch("prj_acme", s.sessionId, { cursor: { x: 10, y: 20 }, signal: "ok I am" });
      expect(hub.roster("prj_acme")[0]?.signal?.text).toBe("ok I am");

      vi.advanceTimersByTime(20_001);
      expect(hub.roster("prj_acme")[0]?.signal).toBeNull();
    } finally {
      hub.close();
    }
  });

  it("wires /, Esc, and cursorChipLabel in CanvasPage, OwnCursor, and CursorLayer", () => {
    const page = read("../src/pages/CanvasPage.tsx");
    const own = read("../src/components/OwnCursor.tsx");
    const layer = read("../src/components/CursorLayer.tsx");

    expect(page).toContain('e.key === "/"');
    expect(page).toContain("startCursorSignal()");
    expect(page).toContain("clearCursorSignal()");
    expect(own).toContain("cursorChipLabel(");
    expect(own).toContain("<em>Esc</em>");
    expect(layer).toContain("cursorChipLabel(");
  });
});
