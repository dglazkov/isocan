// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LIVE_TOKEN_ROUTE } from "@isocan/core/keys";
import type { DialogFacts } from "@isocan/core";

/**
 * **Talk asks the home for a token per session, and keeps no key** (keys
 * phase 4). The ⌘K dialog is mounted for real; the home, Google's socket and
 * the microphone are fakes. What these pin: nothing that looks like a key is
 * ever written to localStorage; a key an older build left there is removed
 * and said; every start asks `POST /api/voice/token` for its own token and
 * opens the socket with it; a refusal from the home is said in its words and
 * opens nothing. That Google accepts the token is NOT proved here.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../src/audio.ts", () => ({
  capture: async () => ({ stop: () => undefined }),
  fromBytes: async () => new Float32Array(),
  Playback: class {
    push = async () => undefined;
    stopNow = () => undefined;
    close = () => undefined;
    level = () => 0;
  },
}));

class FakeSocket {
  static readonly OPEN = 1;
  static opened: FakeSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  sent: string[] = [];
  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

const OLD_KEY = "AIza-acme-OLD-BROWSER-KEY-DO-NOT-KEEP";
let asked: { url: string; body: unknown }[];
let answer: () => Response;
let written: [string, string][];
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  FakeSocket.opened = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  asked = [];
  let n = 0;
  answer = () => new Response(JSON.stringify({ token: `auth_tokens/acme-${++n}`, expireTime: "2026-10-02T13:00:00Z", newSessionExpireTime: "2026-10-02T12:31:00Z" }), { status: 200 });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    asked.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return answer();
  });
  localStorage.clear();
  written = [];
  const setItem = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
    written.push([k, v]);
    return setItem.call(this, k, v);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // The rule: at no point did this browser store a key.
  for (const [k, v] of written) {
    expect(k).not.toBe("isocan:voice:key");
    expect(v).not.toContain("AIza");
  }
  for (let i = 0; i < localStorage.length; i++) expect(localStorage.getItem(localStorage.key(i)!)).not.toContain("AIza");
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await act(async () => await new Promise((r) => setTimeout(r, 0)));
};

async function mountDialog() {
  const { talkWeb } = await import("../src/web.tsx");
  const Dialog = talkWeb.dialogs![0]!.component;
  const facts = {
    canvasId: "prj_acme",
    canvas: { items: {}, threads: {}, trash: [], agents: {} },
    selection: [],
    canEdit: true,
    groupMode: "groups",
    host: { commands: () => [], send: async () => undefined },
  } as unknown as DialogFacts;
  await act(async () => root.render(h(Dialog, facts)));
  await flush();
}

const mic = () => container.querySelector<HTMLButtonElement>("button.talk-mic")!;
const said = () => container.textContent ?? "";

describe("talk: a token per session from the home, never a key in the browser", () => {
  it("asks the home for a token on each start and opens the socket with it", async () => {
    await mountDialog();
    // The dialog's door is a press: it started on open.
    expect(asked).toEqual([{ url: LIVE_TOKEN_ROUTE, body: { canvasId: "prj_acme" } }]);
    expect(FakeSocket.opened).toHaveLength(1);
    expect(FakeSocket.opened[0]!.url).toContain("BidiGenerateContentConstrained?access_token=auth_tokens/acme-1");
    expect(FakeSocket.opened[0]!.url).not.toContain("key=");
    // The provider says it is ready; the session is live.
    await act(async () => FakeSocket.opened[0]!.onmessage!({ data: JSON.stringify({ setupComplete: {} }) }));
    await flush();
    expect(said()).toContain("live");
    // Stop, start again: a second session is a second token.
    await act(async () => mic().click());
    await act(async () => mic().click());
    await flush();
    expect(asked).toHaveLength(2);
    expect(FakeSocket.opened[1]!.url).toContain("access_token=auth_tokens/acme-2");
    // No password field is left to paste a key into.
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(said()).toContain("Model keys");
  });

  it("removes a key an older build left in localStorage, and says so", async () => {
    localStorage.setItem("isocan:voice:key", OLD_KEY);
    written = [];
    await mountDialog();
    expect(localStorage.getItem("isocan:voice:key")).toBeNull();
    expect(said()).toContain("the Gemini key this browser used to keep has been removed");
    // …and it was not what the socket was opened with.
    for (const socket of FakeSocket.opened) expect(socket.url).not.toContain(OLD_KEY);
    for (const { body } of asked) expect(JSON.stringify(body)).not.toContain(OLD_KEY);
    // The leftover is gone, so the after-hook's scan is about what THIS build wrote.
  });

  it("a refusal from the home is said in its words, and no socket opens", async () => {
    answer = () => new Response(JSON.stringify({ code: "voice-owner-only", error: "Priya's keys pay only for Priya here — ask them to turn on sharing in Model keys, or use your own" }), { status: 403 });
    await mountDialog();
    expect(FakeSocket.opened).toHaveLength(0);
    expect(said()).toContain("no voice session — Priya's keys pay only for Priya here");
    expect(said()).toContain("refused");
  });
});
