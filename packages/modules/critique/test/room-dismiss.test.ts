// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { applyOperation, type Actor, type CanvasState, type OverlayFacts, type Operation, type WebHost } from "@isocan/core";
import { CRITIC_PROP, noteBody } from "../src/core.ts";
import { CRITIC_COLOR, CRITIC_ON, STARTER_LENSES, roomAskBody, starterDraft } from "../src/room.ts";
import { RoomOverlay } from "../src/room-web.tsx";

/**
 * **A closed read stays closed** (20 Oct 2026). Dion reported the read of the
 * room opening on every load of a canvas whose critics had spoken days
 * before: closing it only set component state. On a synthetic Acme canvas:
 * close it, load again, and it stays closed — until the room is asked
 * something new.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MAYA: Actor = { id: "usr_maya", name: "Maya" };
const KIT: Actor = { id: "usr_kit", name: "Kit" };
let n = 0;
function apply(s: CanvasState | null, op: Operation, actor: Actor = MAYA): CanvasState {
  n += 1;
  return applyOperation(s, { id: `op_${n}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: new Date(Date.parse("2026-10-14T10:00:00.000Z") + n * 1000).toISOString(), op })!;
}

const LENSES = [
  { name: "the-reductionist", agentName: "The Reductionist", loud: "studio" as const },
  { name: "the-brand-voice", agentName: "The Brand Voice", loud: "studio" as const },
];

/** Acme's Home, two lenses on, the room asked (`askId`) and one lens spoken. */
function spoken(s: CanvasState | null, askId: string, threadId: string): CanvasState {
  if (!s) {
    s = apply(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" });
    s = apply(s, { type: "item.add", itemId: "itm_home", version: { id: "ver_home", blobHash: "h_home", mimeType: "text/html", filename: "home.html", size: 10 }, width: 390, height: 800, placement: { x: 0, y: 0 }, title: "Home" });
    for (const lens of [STARTER_LENSES[0]!, STARTER_LENSES[1]!]) {
      const d = starterDraft(lens);
      s = apply(s, { type: "item.add", itemId: `itm_${d.name}`, version: { id: `ver_${d.name}`, blobHash: `h_${d.name}`, mimeType: "text/markdown", filename: `${d.name}.md`, size: 10 }, width: 360, height: 440, placement: { x: 500, y: 0 }, title: d.agentName, properties: { [CRITIC_PROP]: d.name, [CRITIC_ON]: "on", [CRITIC_COLOR]: d.color! } });
    }
    s = apply(s, { type: "thread.create", threadId: "thr_main", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_hello", body: "Hello" } });
  }
  s = apply(s, { type: "thread.reply", threadId: "thr_main", comment: { id: askId, body: roomAskBody(KIT, [{ id: "itm_home", title: "Home", versionId: "ver_home" }], LENSES, "asked"), mentions: [KIT.id], items: ["itm_home"] } });
  return apply(s, { type: "thread.create", threadId, x: 195, y: 160, anchorItemId: "itm_home", comment: { id: `cmt_${threadId}`, body: noteBody({ kind: "risk", question: 1, text: "The banner competes with the order button." }), persona: "the-reductionist" } }, KIT);
}

const host = { viewer: MAYA, send: async () => undefined } as unknown as WebHost;
const facts = (s: CanvasState): OverlayFacts => ({ canvasId: "prj_acme", canvas: s.canvas, host, groupMode: "legacy" });

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  localStorage.clear();
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  localStorage.clear();
});

/** A fresh mount, as a page load is. */
function load(s: CanvasState): void {
  act(() => root.unmount());
  root = createRoot(el);
  act(() => root.render(h(RoomOverlay, facts(s))));
}

describe("the read of the room, closed", () => {
  it("stays closed across loads, and opens again only for a new ask", () => {
    const first = spoken(null, "cmt_ask_1", "thr_banner");
    load(first);
    expect(el.querySelector('[data-room-read="cmt_ask_1"]')).toBeTruthy();

    act(() => (el.querySelector(".room-close") as HTMLButtonElement).click());
    expect(el.querySelector("[data-room-read]")).toBeNull();

    // The next visit: the same read, closed before — so nothing draws.
    load(first);
    expect(el.querySelector("[data-room-read]")).toBeNull();

    // The room is asked again, and speaks: that is new, so it opens.
    const second = spoken(first, "cmt_ask_2", "thr_banner_again");
    load(second);
    expect(el.querySelector('[data-room-read="cmt_ask_2"]')).toBeTruthy();
  });

  it("is remembered per canvas, so closing one canvas's read closes no other", () => {
    const s = spoken(null, "cmt_ask_1", "thr_banner");
    localStorage.setItem("critique:room-dismissed:prj_other", "cmt_ask_1");
    load(s);
    expect(el.querySelector('[data-room-read="cmt_ask_1"]')).toBeTruthy();
  });
});
