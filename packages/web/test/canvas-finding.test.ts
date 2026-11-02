// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CanvasArrivalVeil, CanvasFinding } from "../src/components/CanvasFinding.tsx";
import { recordVisit } from "../src/lib/recents.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  useCanvasStore.setState({ record: null, connection: "connecting" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  localStorage.clear();
});

describe("CanvasFinding arrival screen", () => {
  it("renders 'Finding this canvas…' as the main headline for an unvisited canvas", () => {
    act(() => {
      root.render(h(CanvasFinding, { canvasId: "prj_new" }));
    });
    const title = host.querySelector(".canvas-finding-title");
    const eyebrow = host.querySelector(".canvas-finding-eyebrow");
    expect(title?.textContent).toBe("Finding this canvas…");
    expect(eyebrow?.textContent).toBe("Opening canvas");
    expect(host.querySelector(".canvas-finding-emblem")).toBeTruthy();
  });

  it("shows the remembered canvas title large with 'Finding this canvas…' above it", () => {
    recordVisit({ id: "prj_known", title: "Acme Launch Board" });
    act(() => {
      root.render(h(CanvasFinding, { canvasId: "prj_known" }));
    });
    const title = host.querySelector(".canvas-finding-title");
    const eyebrow = host.querySelector(".canvas-finding-eyebrow");
    expect(title?.textContent).toBe("Acme Launch Board");
    expect(eyebrow?.textContent).toBe("Finding this canvas…");
  });

  it("falls back to the drifting motes where no living ground can run", () => {
    // jsdom has no WebGL2, which is exactly the fallback a real browser without
    // it (or under reduced motion) gets: the still, the motes, no ground canvas.
    act(() => {
      root.render(h(CanvasFinding, { canvasId: "prj_new" }));
    });
    expect(host.querySelector(".canvas-finding-motes")).toBeTruthy();
    expect(host.querySelector(".ground-canvas")).toBeNull();
    expect(host.querySelector(".canvas-finding-wash")).toBeTruthy();
  });

  it("holds the veil across asking and store load, then fades out once the canvas arrives", () => {
    vi.useFakeTimers();
    try {
      act(() => {
        root.render(h(CanvasArrivalVeil, { canvasId: "prj_acme", asking: true }));
      });
      expect(host.querySelector(".canvas-finding")).toBeTruthy();
      expect(host.querySelector(".canvas-finding")?.classList.contains("fading-out")).toBe(false);

      // `/api/homes` settles (`asking: false`), store still loading (`record: null`).
      act(() => {
        root.render(h(CanvasArrivalVeil, { canvasId: "prj_acme", asking: false }));
      });
      expect(host.querySelector(".canvas-finding")?.classList.contains("fading-out")).toBe(false);

      // Snapshot arrives in `canvasStore`.
      act(() => {
        useCanvasStore.setState({
          record: {
            id: "prj_acme",
            title: "Acme",
            description: "",
            properties: {},
            createdAt: "",
            createdBy: { id: "usr_a", name: "Ada" },
            updatedAt: "",
            updatedBy: { id: "usr_a", name: "Ada" },
          },
          connection: "live",
        });
      });

      const veil = host.querySelector(".canvas-finding");
      expect(veil?.classList.contains("fading-out")).toBe(true);
      expect(veil?.getAttribute("aria-hidden")).toBe("true");

      // After the 380ms cross-fade, the veil unmounts completely.
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(host.querySelector(".canvas-finding")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
