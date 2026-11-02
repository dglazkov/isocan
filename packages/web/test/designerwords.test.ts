// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CanvasContents } from "@isocan/core";

/**
 * **Enter sends your own words, untouched** (proactive-agent phase 10, design
 * §12) — the Chat mounted for real, with only the post itself caught.
 *
 * The composer underlines the words an agent could read more than one way
 * and offers a designer's sentence beside them. None of that may ever stand
 * between a person and Send: Enter posts exactly what they typed, a reading
 * they picked rides beside it as data and never in the body, and Tab — only
 * Tab — puts the designer's sentence in the field.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const posted = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/mainthread.ts", () => ({ postToMain: posted }));

const { MainThreadBody } = await import("../src/components/MainThreadPanel.tsx");
const { useCanvasStore } = await import("../src/stores/canvasStore.ts");

const actor = { id: "usr_acme_maya", name: "Maya" };
const canvas = { id: "prj_acme", title: "Acme Bakery", items: {}, threads: {} } as unknown as CanvasContents;
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  posted.mockReset();
  posted.mockResolvedValue({ status: "accepted" });
  act(() => useCanvasStore.setState({ canvasId: "prj_acme", canvas }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(h(MainThreadBody, { canvasId: "prj_acme", actor })));
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

/** Type into the field the way React hears it: the native setter, then an input event. */
function typeInto(field: HTMLTextAreaElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    set.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The readings card is a lazy chunk: wait for it the way the page does. */
async function readings(): Promise<HTMLElement> {
  for (let i = 0; i < 100; i++) {
    const card = host.querySelector<HTMLElement>(".designer-words");
    if (card) return card;
    await act(async () => new Promise((r) => setTimeout(r, 20)));
  }
  throw new Error("the readings never appeared");
}

const key = (field: HTMLTextAreaElement, k: string) =>
  act(() => {
    field.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });

describe("the Chat composer, saying it like a designer", () => {
  const said = "make the header pop more, it feels cramped";

  it("underlines only the vague words, and Enter sends the words as typed with the picked reading as data", async () => {
    const field = host.querySelector("textarea")!;
    typeInto(field, said);
    const card = await readings();
    expect([...card.querySelectorAll("[data-vague-word]")].map((w) => (w as HTMLElement).dataset.vagueWord)).toEqual(["pop", "cramped"]);
    expect([...host.querySelectorAll(".mention-backdrop .vague-word")].map((w) => w.textContent)).toEqual(["pop", "cramped"]);
    expect(card.querySelector("[data-designer-sentence]")!.textContent).toContain("raise the header's contrast and add space between its parts");

    act(() => (card.querySelector('[data-vague-word="pop"] [data-reading="contrast"]') as HTMLButtonElement).click());
    expect(card.querySelector('[data-reading="contrast"]')!.getAttribute("aria-checked")).toBe("true");

    key(field, "Enter");
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(posted).toHaveBeenCalledTimes(1);
    const [, , body, , , extra] = posted.mock.calls[0]!;
    expect(body).toBe(said);
    expect(extra).toEqual({ readings: [{ word: "pop", reading: "contrast" }] });
  });

  it("sends with no readings at all when none was picked", async () => {
    const field = host.querySelector("textarea")!;
    typeInto(field, said);
    await readings();
    key(field, "Enter");
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(posted.mock.calls[0]![2]).toBe(said);
    expect(posted.mock.calls[0]![5]).toBeUndefined();
  });

  it("puts the designer's sentence in the field only on Tab, and sends that only when asked", async () => {
    const field = host.querySelector("textarea")!;
    typeInto(field, said);
    await readings();
    key(field, "Tab");
    expect(field.value).toBe("raise the header's contrast and add space between its parts");
    expect(posted).not.toHaveBeenCalled();
    key(field, "Enter");
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(posted.mock.calls[0]![2]).toBe("raise the header's contrast and add space between its parts");
  });

  it("draws nothing for a clear ask", async () => {
    const field = host.querySelector("textarea")!;
    typeInto(field, "Move the pickup time above the total");
    await act(async () => new Promise((r) => setTimeout(r, 200)));
    expect(host.querySelector(".designer-words")).toBeNull();
    expect(host.querySelector(".mention-backdrop .vague-word")).toBeNull();
  });
});
