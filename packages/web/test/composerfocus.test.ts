// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TextComposer } from "../src/components/TextComposer.tsx";
import { useUiStore } from "../src/stores/uiStore.ts";

/**
 * **A composer that opens has the keyboard** (1 Oct 2026).
 *
 * a22c3f1a made the composer mount only while one is open, to keep its bytes
 * off the first paint. Its focus effect had been written for a component that
 * stayed mounted: `placeCaret` started false and the open effect set it true a
 * render later, which on a FRESH mount never came — every value the open
 * effect set was the value it already had, so React skipped the render and
 * nothing focused the field. What a person typed went to the canvas's
 * single-key shortcuts instead. The suite was green for a day; four nightly
 * journeys caught it. This is the case they caught, mounted for real.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme_ada", name: "Ada" };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // Fonts, colours and names may ask the home; here it never answers.
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  act(() => useUiStore.setState({ pendingText: null }));
  vi.unstubAllGlobals();
});

describe("a freshly mounted composer", () => {
  it("focuses its field, so the first keystroke is a word and not a shortcut", () => {
    act(() => useUiStore.setState({ pendingText: { x: 40, y: 40, itemId: null, body: "", style: "body", face: "sans" } }));
    act(() => root.render(h(TextComposer, { canvasId: "prj_acme", actor })));
    const field = host.querySelector("textarea");
    expect(field, "the composer drew a field").toBeTruthy();
    expect(document.activeElement).toBe(field);
  });

  it("selects the words of a node it re-opens", () => {
    act(() => useUiStore.setState({ pendingText: { x: 40, y: 40, itemId: "itm_acme_note", body: "Acme launch", style: "body", face: "sans" } }));
    act(() => root.render(h(TextComposer, { canvasId: "prj_acme", actor })));
    const field = host.querySelector("textarea")!;
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, "Acme launch".length]);
  });
});
