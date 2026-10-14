// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import type { Actor, Canvas, SpacesResponse, TakedownNotice } from "@isocan/core";

/**
 * **The canvas list is read beside the spaces and the takedowns, never
 * behind them** (14 Oct 2026).
 *
 * `refresh` was one `Promise.all` over the three reads. A rejection was
 * caught, so every test of "a home too old for the route" passed — but a read
 * that simply never ANSWERED held the canvases with it, and the page sat on
 * "Loading…" for good. And the list itself had no deadline: a home that did
 * not answer was a page that never said so.
 *
 * The real page, with only its transport replaced: each read is a promise the
 * test settles, or never settles.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const reads = vi.hoisted(() => ({
  canvases: null as null | (() => Promise<Canvas[]>),
  spaces: null as null | (() => Promise<SpacesResponse>),
  takedowns: null as null | (() => Promise<TakedownNotice[]>),
}));
const never = <T,>() => new Promise<T>(() => {});
vi.mock("../src/lib/api.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/api.ts")>()),
  listCanvases: () => reads.canvases!(),
  listSpaces: () => reads.spaces!(),
  fetchTakedowns: () => reads.takedowns!(),
  fetchHomes: () => never(),
}));
// Neighbours with reads of their own, and nothing to do with this one.
vi.mock("../src/components/PublicCatalogue.tsx", () => ({ PublicCatalogue: () => null }));
vi.mock("../src/components/CardPeek.tsx", () => ({ CardPeek: () => null }));
vi.mock("../src/components/Inbox.tsx", () => ({ Inbox: () => null }));
vi.mock("../src/components/GroupsPanel.tsx", () => ({ GroupsPanel: () => null }));

const { CanvasListPage } = await import("../src/pages/CanvasListPage.tsx");

const acme: Actor = { id: "usr_acme", name: "Acme" };
const board = (id: string, title: string): Canvas => ({
  id, title, createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
  createdBy: acme, updatedBy: acme,
} as unknown as Canvas);

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  try { localStorage.clear(); } catch { /* no storage, no recents */ }
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const show = async () => {
  await act(async () => root.render(h(MemoryRouter, null, h(CanvasListPage, { actor: acme, onIdentity: () => {} }))));
};
const flush = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); }); };

describe("the canvas list's three reads", () => {
  it("paints the canvases while the takedowns and the spaces never answer", async () => {
    reads.canvases = () => Promise.resolve([board("prj_one", "Acme board"), board("prj_two", "Test plan")]);
    reads.spaces = () => never();
    reads.takedowns = () => never();
    await show();
    await flush();
    expect(host.textContent).toContain("Acme board");
    expect(host.textContent).toContain("Test plan");
    expect(host.querySelector(".canvases-loading"), "a side read held the list").toBeNull();
  });

  it("a list that never answers ends in the error, not in Loading…, after the deadline", async () => {
    vi.useFakeTimers();
    reads.canvases = () => never();
    reads.spaces = () => never();
    reads.takedowns = () => never();
    await show();
    await flush();
    expect(host.querySelector(".canvases-loading")).not.toBeNull();
    await act(async () => { vi.advanceTimersByTime(30_000); });
    await flush();
    expect(host.querySelector(".canvases-loading"), "still Loading… after the deadline").toBeNull();
    expect(host.querySelector(".canvases-error")?.textContent).toMatch(/the canvases could not be read/);
  });

  it("a home that refuses the takedowns and spaces routes costs nothing but the greying and headings", async () => {
    reads.canvases = () => Promise.resolve([board("prj_one", "Acme board")]);
    reads.spaces = () => Promise.reject(new Error("unknown route"));
    reads.takedowns = () => Promise.reject(new Error("unknown route"));
    await show();
    await flush();
    expect(host.textContent).toContain("Acme board");
    expect(host.querySelector(".taken-down")).toBeNull();
    expect(host.querySelector(".canvas-space")).toBeNull();
    expect(host.querySelector(".canvases-error")).toBeNull();
  });

  it("spaces that arrive after the list become headings, in name order, No space last", async () => {
    let answer!: (spaces: SpacesResponse) => void;
    reads.canvases = () => Promise.resolve([board("prj_one", "Acme board"), board("prj_two", "Test plan"), board("prj_three", "Loose")]);
    reads.spaces = () => new Promise((resolve) => { answer = resolve; });
    reads.takedowns = () => Promise.resolve([]);
    await show();
    await flush();
    expect(host.textContent).toContain("Acme board");
    expect(host.querySelector(".canvas-space"), "headings before any space arrived").toBeNull();
    await act(async () => answer({ spaces: [
      { id: "spc_t", name: "Test", canvasIds: ["prj_two"] },
      { id: "spc_a", name: "Acme", canvasIds: ["prj_one"] },
    ] } as unknown as SpacesResponse));
    await flush();
    const sections = [...host.querySelectorAll(".canvas-space")];
    expect(sections.map((s) => s.querySelector("h2")?.textContent)).toEqual(["Acme", "Test", "No space"]);
    expect(sections.map((s) => [...s.querySelectorAll(".canvas-card h3")].map((t) => t.textContent))).toEqual([["Acme board"], ["Test plan"], ["Loose"]]);
  });

  it("the takedowns still grey their card when they arrive late", async () => {
    let answer!: (rows: TakedownNotice[]) => void;
    reads.canvases = () => Promise.resolve([board("prj_one", "Acme board")]);
    reads.spaces = () => Promise.resolve({ spaces: [] } as unknown as SpacesResponse);
    reads.takedowns = () => new Promise((resolve) => { answer = resolve; });
    await show();
    await flush();
    expect(host.querySelector(".taken-down")).toBeNull();
    await act(async () => answer([{ canvasId: "prj_one", sentence: "This home has stopped serving it." } as TakedownNotice]));
    await flush();
    expect(host.querySelector(".taken-down")?.textContent).toContain("stopped serving");
  });
});
