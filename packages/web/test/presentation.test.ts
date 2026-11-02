import type { PresenceSession } from "@isocan/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedState } from "../../core/test/helpers.ts";
import { spring, presentedCanvas, presentedItem, presentedOffset, presentedLocus, type PresentationFrame } from "../src/lib/presentation.ts";
import { PresentationStore } from "../src/lib/presentationStore.ts";

const view = (x = 0) => ({ isolate: true, items: { itm_1: { x, y: 40, width: 220, height: 88, detail: "compact" as const } } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("temporary native presentation", () => {
  it("keeps the replica untouched and maps drag deltas and anchored comments both ways", () => {
    const canvas = seedState().canvas, native = canvas.items.itm_1!;
    const before = structuredClone(canvas);
    const frame: PresentationFrame = { ...view(), origins: { itm_1: { x: native.x, y: native.y } } };
    const projected = presentedCanvas(canvas, frame);
    expect(projected.items.itm_1).toMatchObject({ x: 0, y: 40, width: 220, height: 88, id: native.id, versions: native.versions });
    expect(presentedItem({ ...native, x: native.x + 80, y: native.y - 20 }, frame)).toMatchObject({ x: 80, y: 20 });
    const offset = { x: native.width * 0.75, y: native.height * 0.25 };
    const point = presentedOffset(native, frame, offset);
    expect(point).toEqual({ x: 165, y: 62 });
    expect(presentedOffset(native, frame, point, true)).toEqual(offset);
    expect(presentedCanvas(canvas, null)).toBe(canvas);
    expect(canvas).toEqual(before);
  });
  it("projects declared work and selection but never free-space cursors from another view", () => {
    const canvas = seedState().canvas, item = canvas.items.itm_1!;
    const frame: PresentationFrame = { ...view(), origins: { itm_1: { x: item.x, y: item.y } } };
    const session = { cursor: { x: 9000, y: 9000 }, selection: [] } as unknown as PresenceSession;
    expect(presentedLocus(session, canvas, frame)).toBeNull();
    expect(presentedLocus({ ...session, selection: [item.id] }, canvas, frame)).toEqual({ x: 110, y: 84 });
    expect(presentedLocus({ ...session, activity: { kind: "working", itemId: item.id } }, canvas, frame)).toEqual({ x: 110, y: 84 });
    expect(presentedLocus(session, canvas, null)).toEqual(session.cursor);
  });
  it("converges at different refresh rates without overshooting or endless frames", () => {
    for (const hz of [30, 60, 120]) {
      let position = -400, velocity = 0;
      for (let tick = 0; tick < hz * 2; tick++) {
        const next = spring(position, velocity, 320, 1 / hz);
        expect(next.position).toBeGreaterThanOrEqual(position);
        expect(next.position).toBeLessThanOrEqual(320);
        ({ position, velocity } = next);
      }
      expect({ position, velocity }).toEqual({ position: 320, velocity: 0 });
    }
  });
  it("retargets from the current frame, settles idle, and snaps for reduced motion", () => {
    let clock = 0, serial = 0, reduced = false;
    const pending = new Map<number, FrameRequestCallback>();
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { pending.set(++serial, cb); return serial; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
    const tick = () => { clock += 16; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(cb => cb(clock)); };
    const store = new PresentationStore(), canvas = seedState().canvas;
    store.set(view(), canvas);
    expect(pending.size).toBe(0);
    store.set(view(500), canvas);
    for (let i = 0; i < 8; i++) tick();
    const interrupted = store.snapshot()!.items.itm_1!.x;
    expect(interrupted).toBeGreaterThan(0); expect(interrupted).toBeLessThan(500);
    store.set(view(-100), canvas);
    expect(store.snapshot()!.items.itm_1!.x).toBe(interrupted);
    for (let i = 0; i < 160; i++) tick();
    expect(store.snapshot()!.items.itm_1!.x).toBe(-100);
    expect(pending.size).toBe(0);
    store.set(view(400), canvas);
    tick();
    const grabbed = store.snapshot();
    store.freeze();
    tick();
    expect(store.snapshot()).toBe(grabbed);
    expect(pending.size).toBe(0);
    reduced = true;
    store.set(view(900), canvas);
    expect(store.snapshot()!.items.itm_1!.x).toBe(900);
    expect(pending.size).toBe(0);
    // Repeated content refreshes must not reset an explicit native drag.
    const moved = structuredClone(canvas);
    moved.items.itm_1!.x += 80;
    store.set(view(900), moved);
    expect(presentedItem(moved.items.itm_1!, store.snapshot()).x).toBe(980);
    store.set(view(900), moved);
    expect(presentedItem(moved.items.itm_1!, store.snapshot()).x).toBe(980);
    store.set({ ...view(900), focusIds: ["itm_1"] }, moved);
    expect(presentedItem(moved.items.itm_1!, store.snapshot()).x).toBe(900);
    store.set(null, canvas); expect(store.snapshot()).toBeNull();
    store.dispose(); expect(pending.size).toBe(0);
  });
});
