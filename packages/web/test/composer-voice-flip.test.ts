// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h, Suspense, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CanvasContents, ComposerFacts } from "@isocan/core";

/**
 * **Voice when empty, Send as soon as you type** (Perplexity-style composer flip).
 *
 * When a composer offers voice (`composerOffered.length > 0`), showing both the
 * mic button and a disabled Send button side-by-side wastes room for two modes
 * that never happen together: you either start a voice session OR type and send.
 *
 * - Empty draft (`draft.trim() === ""`): show the voice button; omit Send.
 * - Typing (`draft.trim() !== ""`): hide the voice button (keeping it mounted so
 *   clearing or sending never remounts the lazy control) and show Send in its place.
 * - No voice offered (`composerOffered.length === 0`): Send stays visible.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

const posted = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/mainthread.ts", () => ({ postToMain: posted }));

const { MainThreadBody } = await import("../src/components/MainThreadPanel.tsx");
const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
const { useUiStore } = await import("../src/stores/uiStore.ts");
const { addModule } = await import("../src/modules.ts");

const actor = { id: "usr_acme_maya", name: "Maya" };
const canvas = { id: "prj_acme", title: "Acme Bakery", items: {}, threads: {} } as unknown as CanvasContents;

let mounts = 0;
function FakeVoiceControl({ active, takeOver }: ComposerFacts) {
  useEffect(() => {
    mounts++;
  }, []);
  return h(
    "button",
    {
      type: "button",
      "data-testid": "voice-btn",
      "data-active": active ? "1" : "0",
      onClick: () => takeOver(!active),
    },
    active ? "End voice" : "Talk to the canvas",
  );
}

addModule({
  core: { name: "talk" },
  composer: [{ label: "Talk to the canvas", component: FakeVoiceControl }],
});

let host: HTMLDivElement;
let root: Root;

function typeInto(field: HTMLTextAreaElement, text: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
  act(() => {
    set.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function waitForVoiceControl(): Promise<HTMLElement> {
  for (let i = 0; i < 60; i++) {
    const el = host.querySelector<HTMLElement>(".module-composer-control");
    if (el) return el;
    await act(async () => new Promise((r) => setTimeout(r, 10)));
  }
  throw new Error("ModuleComposerControls did not resolve");
}

beforeEach(async () => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  posted.mockReset();
  posted.mockResolvedValue({ status: "accepted" });
  mounts = 0;
  act(() => {
    useCanvasStore.setState({ canvasId: "prj_acme", canvas });
    useUiStore.setState({ experiments: ["modules.talk"] });
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(h(Suspense, { fallback: null }, h(MainThreadBody, { canvasId: "prj_acme", actor })));
  });
  await waitForVoiceControl();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  act(() => useUiStore.setState({ experiments: [] }));
  vi.unstubAllGlobals();
});

describe("composer voice ↔ send flip", () => {
  it("shows the voice button when empty and flips to Send as soon as typing starts", async () => {
    const voiceSlot = await waitForVoiceControl();
    expect(voiceSlot.hidden, "empty draft shows the voice button").toBe(false);
    expect(
      host.querySelector('button[type="submit"]'),
      "empty draft with voice omits the Send button",
    ).toBeNull();
    expect(mounts).toBe(1);

    const field = host.querySelector("textarea")!;
    typeInto(field, "Hello Acme");

    expect(voiceSlot.hidden, "typing hides the voice button").toBe(true);
    const sendBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(sendBtn, "typing flips to the Send button").not.toBeNull();
    expect(sendBtn!.disabled).toBe(false);
    expect(mounts, "voice control stays mounted when hidden").toBe(1);

    // Clearing the draft flips right back to voice without remounting.
    typeInto(field, "");
    expect(voiceSlot.hidden, "clearing draft restores the voice button").toBe(false);
    expect(host.querySelector('button[type="submit"]')).toBeNull();
    expect(mounts, "clearing draft does not remount the voice control").toBe(1);
  });

  it("flips back to the voice button after sending a message", async () => {
    const voiceSlot = await waitForVoiceControl();
    const field = host.querySelector("textarea")!;
    typeInto(field, "Ship it");
    expect(voiceSlot.hidden).toBe(true);

    const sendBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    await act(async () => {
      sendBtn.click();
    });

    expect(posted).toHaveBeenCalledTimes(1);
    expect(field.value).toBe("");
    expect(voiceSlot.hidden, "after send clears the draft, voice returns").toBe(false);
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it("keeps the live voice row visible when voice takes over", async () => {
    const voiceSlot = await waitForVoiceControl();
    const voiceBtn = voiceSlot.querySelector<HTMLButtonElement>('[data-testid="voice-btn"]')!;
    act(() => voiceBtn.click());

    expect(voiceSlot.hidden).toBe(false);
    expect(voiceSlot.classList.contains("module-composer-wide")).toBe(true);
    expect(host.querySelector("textarea")).toBeNull();
    expect(host.querySelector('button[type="submit"]')).toBeNull();
  });

  it("keeps the Send button visible when empty if no voice module is offered", () => {
    act(() => useUiStore.setState({ experiments: [] }));
    expect(host.querySelector(".module-composer-control")).toBeNull();
    const sendBtn = host.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(sendBtn, "without voice, Send stays present when empty").not.toBeNull();
    expect(sendBtn!.disabled).toBe(true);
  });
});
