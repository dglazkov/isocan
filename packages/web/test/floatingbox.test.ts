// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { FloatingHandles, useFloatingBox } from "../src/lib/floatingbox.tsx";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function PopupHarness({ minWidth = 200, minHeight = 120 }: { minWidth?: number; minHeight?: number }) {
  const float = useFloatingBox<HTMLDivElement>({ minWidth, minHeight });
  return h(
    "div",
    {
      ref: float.ref,
      className: "test-popup",
      style: float.style,
      "data-moved": String(float.isMoved),
      "data-sized": String(float.isSized),
    },
    h(FloatingHandles, { box: float }),
    h(
      "header",
      { className: "test-head", onPointerDown: float.onDragPointerDown, onDoubleClick: float.reset },
      h("span", null, "Title"),
      h("button", { type: "button", className: "test-close" }, "Close"),
    ),
    h("div", { className: "float-scroll" }, "Body"),
  );
}

function mockRect(el: HTMLElement, rect: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

describe("useFloatingBox and FloatingHandles", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("leaves style untouched until moved, then drags and resets on double-click", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(h(PopupHarness)));

    const popup = host.querySelector(".test-popup") as HTMLElement;
    expect(popup.style.position).toBe("");
    expect(popup.getAttribute("data-moved")).toBe("false");

    const handles = popup.querySelectorAll(".float-handle");
    expect(handles.length).toBe(9);
    expect(popup.querySelector(".float-resize-se .float-corner-grip")).not.toBeNull();

    mockRect(popup, { left: 100, top: 80, width: 300, height: 220 });
    const bar = popup.querySelector(".float-drag-bar") as HTMLElement;

    act(() => {
      bar.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 150, clientY: 90 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 210, clientY: 130 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    expect(popup.style.position).toBe("fixed");
    expect(popup.style.left).toBe("160px");
    expect(popup.style.top).toBe("120px");
    expect(popup.getAttribute("data-moved")).toBe("true");
    expect(popup.getAttribute("data-sized")).toBe("false");

    act(() => {
      bar.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    });
    expect(popup.style.position).toBe("");
    expect(popup.getAttribute("data-moved")).toBe("false");

    act(() => root.unmount());
  });

  it("ignores drag pointerdown on interactive child buttons", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(h(PopupHarness)));

    const popup = host.querySelector(".test-popup") as HTMLElement;
    mockRect(popup, { left: 100, top: 80, width: 300, height: 220 });
    const closeBtn = popup.querySelector(".test-close") as HTMLElement;

    act(() => {
      closeBtn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 120, clientY: 90 }));
    });
    expect(popup.getAttribute("data-moved")).toBe("false");

    act(() => root.unmount());
  });

  it("resizes from edges and corners while respecting minWidth and minHeight", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(h(PopupHarness, { minWidth: 220, minHeight: 140 })));

    const popup = host.querySelector(".test-popup") as HTMLElement;
    mockRect(popup, { left: 200, top: 100, width: 320, height: 240 });

    const se = popup.querySelector(".float-resize-se") as HTMLElement;
    act(() => {
      se.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 520, clientY: 340 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 600, clientY: 400 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    expect(popup.style.width).toBe("400px");
    expect(popup.style.height).toBe("300px");
    expect(popup.getAttribute("data-sized")).toBe("true");

    // West edge resize clamps at minWidth (220px).
    mockRect(popup, { left: 200, top: 100, width: 400, height: 300 });
    const west = popup.querySelector(".float-resize-w") as HTMLElement;
    act(() => {
      west.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 200 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 500, clientY: 200 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    expect(popup.style.width).toBe("220px");
    expect(popup.style.left).toBe("380px");

    act(() => root.unmount());
  });

  it("subtracts the containing-block origin when an ancestor has backdrop-filter", () => {
    const cluster = document.createElement("div");
    cluster.style.backdropFilter = "blur(6px)";
    mockRect(cluster, { left: 40, top: 20, width: 400, height: 40 });
    document.body.appendChild(cluster);

    const host = document.createElement("div");
    cluster.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(h(PopupHarness)));

    const popup = host.querySelector(".test-popup") as HTMLElement;
    mockRect(popup, { left: 140, top: 70, width: 280, height: 200 });

    const bar = popup.querySelector(".float-drag-bar") as HTMLElement;
    act(() => {
      bar.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: 160, clientY: 75 }));
    });
    act(() => {
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 190, clientY: 95 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    });

    // Viewport (140 + 30, 70 + 20) minus containing block (40, 20) = (130, 70).
    expect(popup.style.left).toBe("130px");
    expect(popup.style.top).toBe("70px");

    act(() => root.unmount());
  });

  it("uses var(--glass-filter) across popup and floating glass stylesheets", () => {
    const styles = readFileSync(path.resolve(import.meta.dirname, "../src/styles.css"), "utf8");
    expect(styles).toContain("--glass-filter: blur(6px) saturate(1.45);");
    for (const selector of [
      ".floats {",
      ".identity-popover {",
      ".canvas-popover {",
      ".thread-popover {",
      ".context-menu {",
      ".modal-card {",
      ".hover-card {",
    ]) {
      const idx = styles.indexOf(`\n${selector}`);
      expect(idx, `${selector} exists in styles.css`).toBeGreaterThan(-1);
      const block = styles.slice(idx, styles.indexOf("}", idx));
      expect(block, `${selector} uses --glass`).toContain("var(--glass)");
      expect(block, `${selector} uses --glass-filter`).toContain("var(--glass-filter)");
    }
  });
});
