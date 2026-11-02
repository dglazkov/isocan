// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { HANDOFF_REVIEWED_PROP, applyOperation, handoffProperties, mainThread } from "@isocan/core";
import type { Actor, CanvasState, NightNote, Operation } from "@isocan/core";
import type { PriorVisit } from "../src/lib/visitdigest.ts";

/**
 * **On the phone, the morning review is owed to an arrival, not to a tab**
 * (proactive-agent phase 3, design §5: "the person returns after a
 * `/goodnight`").
 *
 * The phone's digest sits under the Chat tab, so it unmounts on every switch
 * away and mounts again on the way back. `MorningBrief` used to decide whether
 * a review was due at its own mount. So Maya, on the visit she said goodnight
 * in, could switch Agents → Chat after Kit's brief landed: the remounted brief
 * found the night over and her mark older than ready-by, drew the review, and
 * closed the note while she had not come back at all. And the other way: on
 * the visit that did owe it, switching away and back after the close echoed
 * found the note "already reviewed", and the review she was reading was gone
 * for the rest of the visit. The desktop's twin of
 * this bug stopped Kit's named edit mid-night in the `proactive-morning`
 * journey (15 Oct 2026). Both faces now take the decision made once, at
 * arrival (`reviewOwed`, from `CanvasPage`), and this mounts the real
 * `PhoneFace` and switches its tabs to prove it.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sent = vi.hoisted(() => vi.fn());
vi.mock("../src/stores/canvasStore.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/stores/canvasStore.ts")>()),
  sendEchoed: sent,
}));

const { PhoneFace } = await import("../src/components/PhoneFace.tsx");
const { reviewOwed } = await import("../src/components/VisitDigest.tsx");
const { useCanvasStore } = await import("../src/stores/canvasStore.ts");
// Preload MainThreadBody's lazy children so their dynamic imports settle inside
// act(...) rather than logging console warnings during worker teardown.
await Promise.all([
  import("../src/components/GoodnightPlan.tsx"),
  import("../src/components/ChatTidy.tsx"),
  import("../src/components/DesignTaskPanel.tsx"),
  import("../src/components/QuestionnairePanel.tsx"),
]);

const maya: Actor = { id: "usr_acme_maya", name: "Maya" };
const kit: Actor = { id: "usr_acme_kit", name: "Kit" };
const H = 3600_000;
const EVENING = Date.now() - 12 * H;
const READY = Date.now() - H; // the night is over: ready-by has passed
const iso = (ms: number) => new Date(ms).toISOString();

let seq = 0;
function step(s: CanvasState | null, op: Operation, actor: Actor, at: number): CanvasState {
  seq += 1;
  return applyOperation(s, { id: `op_${seq}`, canvasId: op.type === "project.create" ? null : "prj_acme", actor, ts: iso(at), op })!;
}
const version = (id: string, mimeType = "text/html") => ({ id, blobHash: `hash_${id}`, mimeType, filename: `${id}.html`, size: 10 });

/** Acme Bakery as Maya left it: a screen and her goodnight in the Chat. */
function evening(): CanvasState {
  seq = 0;
  let s = step(null, { type: "project.create", canvasId: "prj_acme", title: "Acme Bakery", description: "" }, maya, EVENING);
  s = step(s, { type: "item.add", itemId: "itm_basket", version: version("ver_basket"), width: 390, height: 640, placement: { x: 0, y: 0, chosen: true }, title: "Basket", properties: {} }, maya, EVENING);
  return step(s, { type: "thread.create", threadId: "thr_chat", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_gn", body: "/goodnight @Kit the basket bugs me" } as never }, maya, EVENING + 60_000);
}

/** The night on top of it: Kit's note, past its ready-by, and the brief. */
function night(from: CanvasState): CanvasState {
  const note: NightNote = {
    person: maya, lead: kit, settled: [], open: [], lines: [], wont: [], ready: iso(READY), named: [],
    titles: { itm_basket: "Basket" }, midway: [], left: [{ what: "Ravi's note about delivery", why: "a business decision, not a design one" }],
  };
  let s = step(from, { type: "item.add", itemId: "itm_note", version: version("ver_note", "text/markdown"), width: 460, height: 600, placement: { x: 0, y: -900, chosen: true }, title: "Goodnight, Maya", properties: handoffProperties(note) }, kit, EVENING + 120_000);
  s = step(s, { type: "thread.reply", threadId: mainThread(s.canvas)!.id, comment: { id: "cmt_brief", body: "Nothing new tonight: the basket stays as it is.", record: true, goodnight: { step: "brief", note: "itm_note" } } as never }, kit, READY - 60_000);
  return s;
}

/** Her visit: no mark recorded before it, so any note's ready-by is newer than it. */
const prior: PriorVisit = { canvasId: "prj_acme", actorId: maya.id, head: 3, mark: null, available: true };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  sent.mockReset();
  sent.mockResolvedValue({ status: "accepted" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function mount(morning: string | null) {
  const visit = { current: { tab: "Chat" as const, itemId: null, plan: false } };
  await act(async () => root.render(h(MemoryRouter, null, h(PhoneFace, { canvasId: "prj_acme", actor: maya, visit, prior, morning }))));
}
const tab = (name: string) => act(async () => { [...host.querySelectorAll<HTMLButtonElement>(".phone-tabs button")].find((b) => b.textContent === name)!.click(); });
const closes = () => sent.mock.calls.filter(([, , op]) => op?.type === "item.update" && op.patch?.properties?.[HANDOFF_REVIEWED_PROP]);
const review = () => host.querySelector("[data-morning]");

describe("the phone's morning review", () => {
  it("is not drawn, and closes nothing, when the night ends during the visit the goodnight was said in", async () => {
    await act(async () => useCanvasStore.setState({ canvasId: "prj_acme", canvas: evening().canvas }));
    // What CanvasPage decides on arrival: no note stood, so no review is owed.
    expect(reviewOwed(useCanvasStore.getState().canvas!, prior, Date.now())).toBe(null);
    await mount(null);
    expect(host.querySelector(".phone-digest"), "the digest is up under Chat").not.toBe(null);

    // Kit's night lands while she is still here, and she switches tabs.
    await act(async () => useCanvasStore.setState({ canvas: night(evening()).canvas }));
    await tab("Agents");
    await tab("Chat");
    expect(host.querySelector(".phone-digest"), "the digest mounted again").not.toBe(null);
    expect(review(), "a tab switch drew a review this visit does not owe").toBe(null);
    expect(closes(), "a tab switch closed the note mid-visit").toHaveLength(0);
  });

  it("is drawn on the arrival that owes it, closes the note once, and stays through tab switches", async () => {
    const back = night(evening()).canvas;
    await act(async () => useCanvasStore.setState({ canvasId: "prj_acme", canvas: back }));
    const owed = reviewOwed(back, prior, Date.now());
    expect(owed).toBe("itm_note");
    await mount(owed);
    expect(review()?.textContent).toContain("Nothing new tonight");
    expect(closes()).toHaveLength(1);

    // The close echoes back; switching away and back shows the same review and writes nothing more.
    const note = back.items.itm_note!;
    await act(async () => useCanvasStore.setState({ canvas: { ...back, items: { ...back.items, itm_note: { ...note, properties: { ...note.properties, [HANDOFF_REVIEWED_PROP]: iso(Date.now()) } } } } }));
    await tab("Agents");
    expect(review()).toBe(null);
    await tab("Chat");
    expect(review()?.textContent ?? "", "the review went away on a tab switch once it was seen").toContain("Nothing new tonight");
    expect(closes()).toHaveLength(1);
  });
});
