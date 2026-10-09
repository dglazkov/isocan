import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AGENT_WEIGHT, MAX_POINTERS, PointerField } from "../src/lib/groundfield.ts";
import { realMove } from "../src/lib/groundcursors.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **Living grounds, phase 2: every cursor touches the ground** (journey.md
 * scene 3, design.md §2).
 *
 * Somebody else's grass bends because their cursor is already on your screen.
 * That sentence has two halves and this file holds both: the field takes
 * every presence cursor (at most sixteen, newest first, a speed from its own
 * samples, an agent at `AGENT_WEIGHT`), and nothing new goes over the wire to
 * make it so. The `meadow-others` journey proves the picture in Chrome.
 */

describe("the field takes every presence cursor", () => {
  it("takes up to 16, and the newest movers win", () => {
    const f = new PointerField();
    f.setPointer("self", 0, 0, 0, false, 1000);
    for (let i = 0; i < 20; i++) f.setPresence(`sess-${i}`, i * 10, 0, 1, false, 1001 + i);
    expect(f.pointers.size).toBe(MAX_POINTERS);
    expect(MAX_POINTERS).toBe(16);
    // The sixteen that moved last are the ones left; the oldest five — this
    // viewer's own idle pointer among them — have gone.
    for (let i = 4; i < 20; i++) expect(f.pointers.has(`sess-${i}`)).toBe(true);
    for (let i = 0; i < 4; i++) expect(f.pointers.has(`sess-${i}`)).toBe(false);
    expect(f.pointers.has("self")).toBe(false);
    // A cursor that moves again is newest again, and stays.
    f.setPresence("sess-4", 41, 0, 1, false, 2000);
    f.setPresence("sess-late", 0, 0, 1, false, 2001);
    expect(f.pointers.has("sess-4")).toBe(true);
    expect(f.pointers.has("sess-5")).toBe(false);
  });

  it("gets a velocity from successive positions, on the screen", () => {
    const f = new PointerField();
    f.setPresence("ravi", 100, 100, 2, false, 1000);
    expect(f.pointers.get("ravi")!.speed).toBe(0); // a first sample has none
    // 30 ground units right and 40 down in 50 ms, at ground scale 2:
    // 50 units → 100 screen px in 50 ms = 2000 px/s.
    f.setPresence("ravi", 130, 140, 2, false, 1050);
    const p = f.pointers.get("ravi")!;
    expect(p.speed).toBeCloseTo(2000, 6);
    expect([p.px, p.py, p.x, p.y]).toEqual([100, 100, 130, 140]);
    expect(f.moving(1049)).toEqual([p]);
  });

  it("never holds another person's button, because nothing says it is held", () => {
    const f = new PointerField();
    f.setPresence("maya", 0, 0, 1, false, 1000);
    f.setPresence("maya", 5, 5, 1, false, 1010);
    expect(f.pointers.get("maya")!.held).toBe(false);
  });

  it("weights an agent by the one constant, and a person by 1", () => {
    expect(AGENT_WEIGHT).toBe(1); // scene 3: full weight, until somebody halves it
    const f = new PointerField();
    f.setPresence("scout", 0, 0, 1, true, 1000);
    f.setPresence("maya", 0, 0, 1, false, 1000);
    f.setPointer("self", 0, 0, 0, false, 1000);
    expect(f.pointers.get("scout")!.weight).toBe(AGENT_WEIGHT);
    expect(f.pointers.get("maya")!.weight).toBe(1);
    expect(f.pointers.get("self")!.weight).toBe(1);
    // …and the stamp reads it, so halving the constant halves the trail.
    expect(read("../src/components/themes/GroundHost.ts")).toMatch(/0\.6 \+ p\.speed \/ 1500\) \* p\.weight/);
  });

  it("lets a cursor that left give up its place", () => {
    const f = new PointerField();
    f.setPresence("gone", 0, 0, 1, false, 1000);
    f.removePointer("gone");
    expect(f.pointers.has("gone")).toBe(false);
  });

  it("is fed the eased positions CursorLayer draws, and only while a ground listens", () => {
    const layer = read("../src/components/CursorLayer.tsx");
    expect(layer).toMatch(/groundCursors\.feed\?\.\(session\.sessionId, rec\)/);
    expect(layer).toMatch(/groundCursors\.feed\?\.\(key, null\)/);
    const living = read("../src/components/themes/LivingGround.tsx");
    expect(living).toMatch(/groundCursors\.feed = feed/);
    expect(living).toMatch(/if \(groundCursors\.feed === feed\) groundCursors\.feed = null/);
    expect(living).toMatch(/h\.presence\(/);
  });
});

describe("a working cursor's wander does not touch the ground", () => {
  /* The wander is CursorLayer's own animation of the fact of working — no
     position was sent for any of it — and a ground fed it would never sleep
     while an agent works. So a working cursor reaches the ground only when
     its real position changes. */
  it("passes a real position once, and nothing while it stands still", () => {
    const rec: { fx?: number; fy?: number } = {};
    expect(realMove(rec, { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    // Every later frame of the wander, with the same real position: nothing.
    for (let i = 0; i < 600; i++) expect(realMove(rec, { x: 10, y: 20 })).toBeNull();
    expect(realMove(rec, null)).toBeNull();
    // The agent really moves: that one counts.
    expect(realMove(rec, { x: 40, y: 20 })).toEqual({ x: 40, y: 20 });
    expect(realMove(rec, { x: 40, y: 20 })).toBeNull();
  });

  it("CursorLayer feeds the eased cursor only when it is not wandering", () => {
    const layer = read("../src/components/CursorLayer.tsx");
    expect(layer).toMatch(/if \(!workingBounds\) groundCursors\.feed\?\.\(session\.sessionId, rec\)/);
    expect(layer).toMatch(/workingBounds && groundCursors\.feed && realMove\(rec, session\.cursor\)/);
  });
});

describe("nothing new goes over the wire", () => {
  /** The fields of the web's presence beat — the one message a tab sends
   *  about its cursor. Phase 2 added none. */
  const PRESENCE_FIELDS = ["type", "sessionId", "actor", "cursor", "selection", "textSelection", "signal", "drag"];

  it("the presence message's schema is the one it was", () => {
    const protocol = read("../../core/src/protocol.ts");
    const start = protocol.indexOf("export type ClientMessage =");
    // The presence variant's object, from its opening line to the brace that
    // closes it at the variant's own indent.
    const open = protocol.indexOf("  | {", start);
    const body = protocol.slice(open, protocol.indexOf("\n    }", open));
    const fields = [...body.matchAll(/^ {6}(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields).toEqual(PRESENCE_FIELDS);
  });

  it("the beat the web builds carries the same fields and no more", () => {
    const store = read("../src/stores/canvasStore.ts");
    const at = store.indexOf("function flushPresence()");
    const literal = store.slice(store.indexOf("const message: ClientMessage = {", at), store.indexOf("};", at));
    const keys = [...literal.matchAll(/^\s+(\w+)[,:]/gm)].map((m) => m[1]);
    expect(keys).toEqual(PRESENCE_FIELDS);
  });

  it("the ground reads presence and never writes it", () => {
    for (const file of [
      "../src/lib/groundcursors.ts",
      "../src/lib/groundfield.ts",
      "../src/components/themes/GroundHost.ts",
      "../src/components/themes/LivingGround.tsx",
    ]) {
      const src = read(file);
      expect(src, file).not.toMatch(/\.send\(|flushPresence|schedulePresenceFlush|setCursor|WebSocket|fetch\(/);
    }
  });
});
