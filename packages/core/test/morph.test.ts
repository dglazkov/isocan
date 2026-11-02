import { describe, expect, it } from "vitest";
import { MORPH_BEATS, morphPlan, pairPieces, sceneFromMessage, type MorphPiece, type MorphScene } from "../src/morph.ts";

/**
 * The morph's head: which piece becomes which, and where every piece is at
 * every moment. The browser only plays what this decides, so the promises a
 * presenter sees are checked here — the first frame IS slide A, the last
 * frame IS slide B, and a piece that appears on both travels between them.
 */
let n = 0;
const piece = (over: Partial<MorphPiece>): MorphPiece => ({
  i: n++, parent: -1, kind: "text", tag: "h1", x: 0, y: 0, w: 100, h: 40, ...over,
});
const scene = (pieces: MorphPiece[]): MorphScene => ({ w: 1280, h: 800, pieces: pieces.map((p, i) => ({ ...p, i })) });

/** Parse `matrix(s,0,0,s,e,f)`. */
const m = (t: string) => {
  const [s, , , , e, f] = t.slice(7, -1).split(",").map(Number);
  return { s: s!, e: e!, f: f! };
};

describe("pairPieces", () => {
  it("prefers the author's key, then the same words, then the same classes", () => {
    const a = scene([
      piece({ key: "hero", text: "Old words", x: 0 }),
      piece({ text: "Acme quarterly", x: 400 }),
      piece({ kind: "box", tag: "div", cls: "card shadow", x: 800, w: 300, h: 200 }),
      piece({ text: "Only on A", x: 50, y: 600 }),
    ]);
    const b = scene([
      piece({ text: "Acme quarterly", x: 10, y: 10, w: 60, h: 20 }),
      piece({ key: "hero", text: "New words", x: 900 }),
      piece({ kind: "box", tag: "div", cls: "card shadow", x: 100, y: 300, w: 500, h: 300 }),
      piece({ text: "Only on B", x: 700, y: 700 }),
    ]);
    const pairs = pairPieces(a.pieces, b.pieces);
    expect([...pairs]).toEqual(expect.arrayContaining([[0, 1], [1, 0], [2, 2]]));
    expect(pairs.has(3)).toBe(false);
  });

  it("never pairs across kinds, and uses each piece once", () => {
    const a = scene([piece({ text: "Same" }), piece({ text: "Same", x: 500 })]);
    const b = scene([piece({ text: "Same", x: 480 }), piece({ kind: "media", tag: "img", src: "Same" })]);
    const pairs = pairPieces(a.pieces, b.pieces);
    expect([...pairs]).toEqual([[1, 0]]);
  });
});

describe("morphPlan", () => {
  const a = scene([
    piece({ kind: "box", tag: "section", cls: "panel", x: 100, y: 100, w: 600, h: 400 }),
    piece({ parent: 0, text: "Shared title", x: 140, y: 140, w: 300, h: 60 }),
    piece({ text: "Leaves", x: 900, y: 600 }),
  ]);
  const b = scene([
    piece({ text: "Shared title", x: 40, y: 40, w: 200, h: 40 }),
    piece({ text: "Arrives", x: 600, y: 500 }),
  ]);
  const plan = morphPlan(a, b, "next", 20);

  it("starts as slide A and ends as slide B, exactly", () => {
    for (const t of plan.out.tracks) {
      const first = t.frames[0]!;
      expect(m(first.transform)).toEqual({ s: 1, e: 0, f: 0 });
      expect(first.opacity).toBe(1);
    }
    for (const t of plan.in.tracks) {
      const last = t.frames.at(-1)!;
      expect(m(last.transform)).toEqual({ s: 1, e: 0, f: 0 });
      expect(last.opacity).toBe(1);
      expect(t.frames[0]!.opacity).toBe(0);
    }
    expect(plan.out.ground[0]!.opacity).toBe(1);
    expect(plan.in.ground.at(-1)!.opacity).toBe(1);
    expect(plan.scene[0]!.transform).toContain("rotateX(0deg)");
    expect(plan.scene.at(-1)!.transform).toContain("scale(1)");
  });

  it("is gone from A by the end, and B is unseen until the pieces start across", () => {
    // What shows is a piece's opacity times every piece it sits inside.
    const seen = (i: number): number => {
      const p = a.pieces[i]!;
      return plan.out.tracks[i]!.frames.at(-1)!.opacity * (p.parent >= 0 ? seen(p.parent) : 1);
    };
    for (const t of plan.out.tracks) expect(seen(t.i), `A piece ${t.i}`).toBeLessThan(0.01);
    const before = plan.in.tracks.map((t) => t.frames.find((f) => f.offset >= MORPH_BEATS.apart)!.opacity);
    expect(before.every((o) => o === 0)).toBe(true);
  });

  it("lifts A's pieces apart — inner pieces higher than the box that holds them", () => {
    const at = (track: number) => plan.out.tracks[track]!.frames.find((f) => f.offset >= MORPH_BEATS.apart)!;
    const box = m(at(0).transform).s;
    expect(box).toBeGreaterThan(1);
    // The title's own scale is RELATIVE to the box: above 1 means higher still.
    expect(m(at(1).transform).s).toBeGreaterThan(1);
  });

  /** A track's page map p → s·p + t, from its CSS and its top-left origin. */
  const pageMap = (t: string, ox: number, oy: number) => {
    const { s, e, f } = m(t);
    return { s, tx: e + (1 - s) * ox, ty: f + (1 - s) * oy };
  };
  const apartFrame = (frames: { offset: number }[]) => frames.findIndex((f) => f.offset >= MORPH_BEATS.apart);

  it("moves a shared piece and its partner as ONE thing, all the way across", () => {
    // A's title rides inside A's panel (parent ∘ own); B's title has no parent.
    // At every sample the two centres coincide — the eye sees one title move.
    for (let k = 0; k <= 20; k++) {
      const panel = pageMap(plan.out.tracks[0]!.frames[k]!.transform, 100, 100);
      const own = pageMap(plan.out.tracks[1]!.frames[k]!.transform, 140, 140);
      const ax = panel.s * (own.s * 290 + own.tx) + panel.tx;
      const ay = panel.s * (own.s * 170 + own.ty) + panel.ty;
      const bt = pageMap(plan.in.tracks[0]!.frames[k]!.transform, 40, 40);
      const offset = plan.in.tracks[0]!.frames[k]!.offset;
      if (offset < MORPH_BEATS.apart || offset > MORPH_BEATS.across) continue;
      expect(bt.s * 140 + bt.tx, `x at ${offset}`).toBeCloseTo(ax, 0);
      expect(bt.s * 60 + bt.ty, `y at ${offset}`).toBeCloseTo(ay, 0);
    }
  });

  it("composes: a child's own keyframes undo its parent's, so it lands where planned", () => {
    // A's title rides inside A's panel; parent ∘ own is the title's absolute
    // lift — one level deep plus the words' extra, 300px: 1400 / (1400 − 300).
    const k = apartFrame(plan.out.tracks[1]!.frames);
    const parent = pageMap(plan.out.tracks[0]!.frames[k]!.transform, 100, 100);
    const own = pageMap(plan.out.tracks[1]!.frames[k]!.transform, 140, 140);
    expect(parent.s * own.s).toBeCloseTo(1400 / 1100, 2);
    expect(parent.s).toBeCloseTo(1400 / 1310, 2);
  });
});

describe("sceneFromMessage", () => {
  it("refuses what is not a scene, bounds strings, and keeps the runtime's own indices", () => {
    expect(sceneFromMessage({ type: "other" })).toBeNull();
    expect(sceneFromMessage({ type: "isocan:morph:scene", w: 0, h: 10, pieces: [] })).toBeNull();
    const got = sceneFromMessage({
      type: "isocan:morph:scene", w: 1280, h: 800,
      pieces: [
        { kind: "box", tag: "div", x: 0, y: 0, w: 10, h: 10, parent: -1 },
        { kind: "nonsense", x: 0, y: 0, w: 1, h: 1 },
        { kind: "text", tag: "p", text: "x".repeat(500), x: 1, y: 1, w: 5, h: 5, parent: 1 },
        { kind: "text", tag: "p", x: 1, y: 1, w: 5, h: 5, parent: 0 },
        { kind: "media", tag: "img", x: NaN, y: 1, w: 5, h: 5 },
      ],
    })!;
    expect(got.pieces.map((p) => p.i)).toEqual([0, 2, 3]);
    expect(got.pieces[1]!.parent).toBe(-1); // pointed at a refused piece
    expect(got.pieces[2]!.parent).toBe(0);
    expect(got.pieces[1]!.text!.length).toBe(160);
  });
});
