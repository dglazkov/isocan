import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rules, withoutComments } from "./cssrules.ts";
import { applyOperation } from "@isocan/core";
import type { CanvasState, OpEnvelope, Operation } from "@isocan/core";

/**
 * **The past does not take writes**, and the scrubber's other load-bearing
 * rule: the past sits BESIDE the live replica and never on top of it.
 *
 * The scrubber is a way of looking, not a branch. There is no operation that
 * means "and from here it went differently", and inventing one is a different
 * and far larger feature than seeing what happened — so a write attempted
 * while somebody is standing at seq 26 has nowhere to go. Refusing in the UI
 * only (pointer-events off, buttons dimmed) is what this codebase calls a
 * habit rather than a rule: the first keyboard shortcut, paste handler or
 * agent write goes straight through it. The refusal is therefore at the one
 * door every change comes through, and this is the test that says so.
 */
const actor = { id: "usr_1", name: "Priya" };
let posted: unknown[] = [];

function envelope(op: Operation): OpEnvelope {
  return {
    id: "op_seed",
    canvasId: op.type === "project.create" ? null : "prj_1",
    actor,
    ts: "2026-08-30T00:00:00.000Z",
    op,
  };
}

/** A canvas with one item on it. */
function seed(): CanvasState {
  const created = applyOperation(
    null,
    envelope({ type: "project.create", canvasId: "prj_1", title: "Acme" }),
  )!;
  return applyOperation(
    created,
    envelope({
      type: "item.add",
      itemId: "itm_1",
      version: {
        id: "ver_1",
        blobHash: "hash_1",
        mimeType: "text/markdown",
        filename: "ver_1.md",
        size: 10,
      },
      width: 100,
      height: 80,
      placement: { x: 5, y: 6 },
    }),
  )!;
}

beforeEach(async () => {
  posted = [];
  vi.resetModules();
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
  (globalThis as Record<string, unknown>).fetch = async (url: string, init?: { body?: string }) => {
    if (String(url).endsWith("/api/ops")) posted.push(JSON.parse(init?.body ?? "{}"));
    return { ok: true, status: 200, json: async () => ({ seq: 99, envelope: {} }) };
  };
});

describe("the write door, while somebody is in the past", () => {
  const move: Operation = { type: "item.move", itemId: "itm_1", x: 1, y: 2 };

  it("takes the write when the canvas is at now", async () => {
    /* The control. Without it, a test that asserts 'nothing was posted' passes
       just as happily against a door that is broken shut — which is the exact
       shape of instrument this repo keeps catching. */
    const { useCanvasStore, sendEchoed } = await import("../src/stores/canvasStore.ts");
    const state = seed();
    useCanvasStore.setState({ ...state, confirmed: state, past: null, queue: [] });
    await sendEchoed("prj_1", actor, move);
    expect(posted).toHaveLength(1);
  });

  it("refuses it while standing at a seq", async () => {
    const { useCanvasStore, sendEchoed } = await import("../src/stores/canvasStore.ts");
    const state = seed();
    useCanvasStore.setState({
      ...state,
      confirmed: state,
      past: { seq: 26, canvas: state.canvas },
      queue: [],
    });
    await sendEchoed("prj_1", actor, move);
    expect(posted).toHaveLength(0);
  });

  it("says why, rather than doing nothing", async () => {
    /* A control that silently declines is indistinguishable from one that is
       broken, and the person is looking at a canvas that will not respond. */
    const { useCanvasStore, sendEchoed } = await import("../src/stores/canvasStore.ts");
    const state = seed();
    useCanvasStore.setState({
      ...state,
      confirmed: state,
      past: { seq: 26, canvas: state.canvas },
      queue: [],
    });
    await sendEchoed("prj_1", actor, move);
    expect(useCanvasStore.getState().notice).toMatch(/past|as it was/i);
  });

  it("leaves the live replica untouched — the past is beside it, not over it", async () => {
    /* The whole reason `past` is its own field. A tail landing while somebody
       looks at last Tuesday must be folded onto the LIVE state; writing the
       past into `canvas` would embed last Tuesday into the thing the home's
       history is then applied to. */
    const { useCanvasStore, enterPast, leavePast } = await import(
      "../src/stores/canvasStore.ts"
    );
    const state = seed();
    useCanvasStore.setState({ ...state, confirmed: state, past: null, queue: [] });
    const before = useCanvasStore.getState().canvas;
    enterPast(26, { items: {}, threads: {}, trash: [] });
    expect(useCanvasStore.getState().canvas).toBe(before);
    expect(Object.keys(useCanvasStore.getState().past!.canvas.items)).toHaveLength(0);
    leavePast();
    expect(useCanvasStore.getState().past).toBeNull();
    expect(useCanvasStore.getState().canvas).toBe(before);
  });
});

describe("the track's stylesheet", () => {
  const scrub = rules(withoutComments()).filter((r) => /\.scrub|\.in-past/.test(r.selector));

  it("exists", () => {
    expect(scrub.length).toBeGreaterThan(0);
  });

  it("takes every colour from a token, so both themes get a track", () => {
    /* A literal hex here would be one theme's track on both grounds — the
       classic unreadable-artifact bug, one surface along. */
    for (const r of scrub) expect(r.body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("marks a seam by colour, not by making the bar taller", () => {
    /* Height is already significance. A seam that also grew would be saying
       one thing twice and would make a busy stretch indistinguishable from an
       important one — which is the exact discrimination the track exists for. */
    const seam = scrub.find((r) => r.selector.includes(".scrub-bar.seam"));
    expect(seam).toBeDefined();
    expect(seam!.body).toMatch(/background/);
    expect(seam!.body).not.toMatch(/height/);
  });

  it("gives the rail a visible focus ring, because it is a real slider", () => {
    const focus = scrub.find((r) => r.selector.includes(".scrub-rail:focus-visible"));
    expect(focus?.body).toMatch(/outline/);
  });

  it("lines the seq up with tabular figures", () => {
    /* The number changes as the playhead moves; proportional digits make it
       jitter, which reads as the readout being unstable. */
    const where = scrub.find((r) => r.selector.includes(".scrub-where"));
    expect(where?.body).toMatch(/tabular-nums/);
  });
});

describe("the scrubber's own source", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../src/components/Scrubber.tsx", import.meta.url)),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("folds with core's `at`, so both surfaces land on the same past", () => {
    /* The whole isomorphism claim. A second fold written here would be a
       second opinion about history, and `isocan at <seq>` would drift from
       the scrubber with nothing able to tell. */
    expect(src).toMatch(/\bat\(entries, seq\)/);
  });

  it("reads the archive as well as the live log", () => {
    /* On a canvas old enough to have been compacted the story predates the
       live log; folding from the live log alone replays a history missing its
       own beginning.

       This asked for the literal route until the route moved into `api.ts`,
       where a 401 can knock on the door. The fact it was always guarding is
       that BOTH logs are read — so it asks for that instead, and survives the
       next move too. */
    expect(src).toContain("getArchivedOplog(canvasId)");
    expect(src).toContain("getOplog(canvasId)");
  });

  it("returns the canvas to now when it unmounts", () => {
    /* A past that outlived its scrubber is a read-only canvas with nothing on
       screen explaining why it will not take a change. */
    expect(src).toMatch(/=> \(\) => leavePast\(\)/);
  });

  it("does not offer playback to someone who asked for less motion", () => {
    expect(src).toContain("prefers-reduced-motion");
    expect(src).toMatch(/!still && \(/);
  });
});
