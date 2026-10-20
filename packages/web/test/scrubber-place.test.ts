// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";

// The history never arrives: the panel's placement is all this reads.
vi.mock("../src/lib/api.ts", () => ({
  getOplog: () => new Promise(() => {}),
  getArchivedOplog: () => new Promise(() => {}),
}));

import { Scrubber } from "../src/components/Scrubber.tsx";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **History goes on top when the Chat is the bottom bar** (20 Oct 2026).
 * Dion: "History is broken if chat is on the bottom… I guess it should go on
 * top?" Both were bottom-centred and the bar rides higher, so the composer
 * covered the rail and Play. Docked on the left, the bottom is free and
 * History stays where it always was.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLDivElement;
let root: Root;
const was = useUiStore.getState().chatAt;
beforeEach(() => {
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  useUiStore.setState({ chatAt: was });
});

describe("where History sits", () => {
  it("takes the top while the Chat is the bottom bar", () => {
    useUiStore.setState({ chatAt: "bottom" });
    act(() => root.render(h(Scrubber, { canvasId: "prj_acme", onClose: () => {} })));
    expect(el.querySelector(".scrubber")?.classList.contains("at-top")).toBe(true);
  });

  it("keeps the bottom while the Chat is docked on the left", () => {
    useUiStore.setState({ chatAt: "left" });
    act(() => root.render(h(Scrubber, { canvasId: "prj_acme", onClose: () => {} })));
    expect(el.querySelector(".scrubber")?.classList.contains("at-top")).toBe(false);
  });
});
