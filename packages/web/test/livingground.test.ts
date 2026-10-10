import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LIVING, THEMES, isLiving } from "@isocan/core";

import { ACTIVE_MS, ASLEEP, SETTLE_CAP_MS, advance, touch, type Sleep } from "../src/lib/groundsleep.ts";
import { MAX_ITEMS, MAX_POINTERS, PointerField, TRAIL_SIZE, groundView, itemRects, toGround, trailRect } from "../src/lib/groundfield.ts";
import { MAX_LOSSES, groundMode } from "../src/lib/groundmode.ts";
import { PAINTED } from "../src/components/themes/PaintedGround.tsx";
import { TILE } from "../src/components/themes/meadow.ts";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

/**
 * **Living grounds, phase 1: the parts a test can hold without a GPU.**
 *
 * The layer's promise is that an idle canvas stays idle, that the ground
 * answers the pointer where the pointer actually is, and that the still frame
 * is always there. The first two are arithmetic and a state machine; the third
 * is a decision table. The drawing itself is a browser's to prove — the
 * `meadow` journey does that, in Chrome.
 */

describe("the sleep policy keeps an idle canvas idle", () => {
  /** Walk frames at 60fps from `from` to `to`, with `moving` deciding what the
   *  ground says each frame; return each frame's state. */
  function walk(sleep: Sleep, from: number, to: number, moving: (t: number) => boolean) {
    const seen: { t: number; state: string; draw: boolean; again: boolean }[] = [];
    let s = sleep;
    for (let t = from; t <= to; t += 16) {
      const r = advance(s, t, moving(t));
      s = r.sleep;
      seen.push({ t, state: s.state, draw: r.draw, again: r.again });
      if (!r.again) break;
    }
    return { seen, sleep: s };
  }

  it("starts asleep and does nothing until touched", () => {
    expect(ASLEEP.state).toBe("asleep");
    const r = advance(ASLEEP, 1000, true);
    expect(r).toEqual({ sleep: ASLEEP, draw: false, again: false });
  });

  it("wakes on a touch, and stays awake while touched", () => {
    let s = touch(ASLEEP, 1000);
    expect(s.state).toBe("awake");
    for (let t = 1000; t < 3000; t += 100) {
      s = touch(s, t);
      const r = advance(s, t + 16, false);
      expect(r.sleep.state).toBe("awake");
      expect(r.draw && r.again).toBe(true);
    }
  });

  it("settles once the input stops, and sleeps when the ground is at rest", () => {
    const s = touch(ASLEEP, 0);
    // The ground keeps moving for 800 ms after the last touch (a fading trail).
    const { seen } = walk(s, 0, 10_000, (t) => t < 800);
    const states = [...new Set(seen.map((f) => f.state))];
    expect(states).toEqual(["awake", "settling", "asleep"]);
    const settled = seen.find((f) => f.state === "settling")!;
    expect(settled.t).toBeGreaterThanOrEqual(ACTIVE_MS);
    const last = seen[seen.length - 1]!;
    expect(last.state).toBe("asleep");
    expect(last.t).toBeGreaterThanOrEqual(800);
    expect(last.t).toBeLessThan(800 + 32);
    // The frame that falls asleep draws once more and asks for nothing.
    expect(last.draw).toBe(true);
    expect(last.again).toBe(false);
  });

  it("never draws past the cap, whatever the ground claims", () => {
    // A ground that says it is ALWAYS moving is exactly the bug the cap is for.
    const { seen } = walk(touch(ASLEEP, 0), 0, 60_000, () => true);
    const last = seen[seen.length - 1]!;
    expect(last.state).toBe("asleep");
    expect(last.t).toBeGreaterThanOrEqual(SETTLE_CAP_MS);
    expect(last.t).toBeLessThan(SETTLE_CAP_MS + 32);
    expect(SETTLE_CAP_MS).toBeLessThanOrEqual(3000);
  });

  it("is asleep, at once, in a hidden tab", () => {
    const r = advance(touch(ASLEEP, 0), 10, true, true);
    expect(r.sleep.state).toBe("asleep");
    expect(r.draw).toBe(false);
    expect(r.again).toBe(false);
  });

  describe("the eddy window: a pointer resting over a ground that declares one", () => {
    const rest = { window: 15_000, resting: true };
    /** Frames at 60fps from a touch at 0, with the pointer resting or not. */
    function rested(r: { window: number; resting: boolean } | undefined, moving: (t: number) => boolean = () => true) {
      let s = touch(ASLEEP, 0);
      const seen: { t: number; state: string }[] = [];
      for (let t = 0; t <= 60_000; t += 16) {
        const x = advance(s, t, moving(t), false, r);
        s = x.sleep;
        seen.push({ t, state: s.state });
        if (!x.again) break;
      }
      return seen;
    }

    it("keeps it awake for the window after the last move, then settles and sleeps", () => {
      const seen = rested(rest);
      expect(seen.find((f) => f.t >= 14_900)!.state).toBe("awake");
      const settling = seen.find((f) => f.state === "settling")!;
      expect(settling.t).toBeGreaterThanOrEqual(15_000);
      const last = seen[seen.length - 1]!;
      expect(last.state).toBe("asleep");
      // The ordinary settle, after the window: never past window + cap.
      expect(last.t).toBeLessThan(15_000 + SETTLE_CAP_MS);
    });

    it("sleeps once the ground is at rest after the window, not at the cap", () => {
      const seen = rested(rest, (t) => t < 16_000);
      expect(seen[seen.length - 1]!.t).toBeLessThan(16_000 + 32);
    });

    it("changes nothing when the pointer is not resting, or the ground declares no window", () => {
      for (const r of [undefined, { window: 15_000, resting: false }, { window: 0, resting: true }]) {
        const seen = rested(r);
        const last = seen[seen.length - 1]!;
        expect(last.state).toBe("asleep");
        expect(last.t).toBeLessThan(SETTLE_CAP_MS + 32);
        expect(seen.find((f) => f.state === "settling")!.t).toBeGreaterThanOrEqual(ACTIVE_MS);
      }
    });

    it("never wakes a sleeping ground by itself — an untouched canvas stays asleep", () => {
      expect(advance(ASLEEP, 1000, true, false, rest)).toEqual({ sleep: ASLEEP, draw: false, again: false });
    });
  });

  it("wakes again from sleep on the next touch", () => {
    const { sleep } = walk(touch(ASLEEP, 0), 0, 10_000, () => false);
    expect(sleep.state).toBe("asleep");
    expect(touch(sleep, 20_000).state).toBe("awake");
    expect(advance(touch(sleep, 20_000), 20_016, false).again).toBe(true);
  });
});

describe("the input field puts things where they are", () => {
  const vp = { scale: 2, tx: 100, ty: -40 };

  it("takes a screen point to the world through the viewport", () => {
    // screen = world * scale + t, so (300, 160) is world (100, 100).
    expect(toGround(groundView(vp, false), 300, 160)).toEqual({ x: 100, y: 100 });
  });

  it("keeps a pinned ground in screen space", () => {
    expect(groundView(vp, true)).toEqual({ scale: 1, tx: 0, ty: 0 });
    expect(toGround(groundView(vp, true), 300, 160)).toEqual({ x: 300, y: 160 });
  });

  it("hands over item rectangles in ground space", () => {
    const rects = itemRects([{ x: 10, y: 20, width: 50, height: 40 }], vp, groundView(vp, false), 1000, 800);
    expect([...rects]).toEqual([10, 20, 50, 40]);
    // On a pinned ground the item is where it is on SCREEN.
    const pinned = itemRects([{ x: 10, y: 20, width: 50, height: 40 }], vp, groundView(vp, true), 1000, 800);
    expect([...pinned]).toEqual([120, 0, 100, 80]);
  });

  it("drops what is off screen, and keeps the largest past 64", () => {
    const items = [
      { x: -5000, y: 0, width: 100, height: 100 }, // off screen
      ...Array.from({ length: 100 }, (_, i) => ({ x: (i % 10) * 40, y: Math.floor(i / 10) * 30, width: 10 + i, height: 10 })),
    ];
    const id = { scale: 1, tx: 0, ty: 0 };
    const rects = itemRects(items, id, id, 1000, 800);
    expect(rects.length / 4).toBe(MAX_ITEMS);
    const widths = Array.from({ length: MAX_ITEMS }, (_, i) => rects[i * 4 + 2]!);
    // The 64 widest of 10..109 are 46..109 — the smallest kept is 46.
    expect(Math.min(...widths)).toBe(46);
    expect(widths).not.toContain(100 + 5000);
    expect([...rects].some((v) => v === -5000)).toBe(false);
  });

  it("measures by what is ON screen, so a huge card mostly off screen loses to a visible one", () => {
    const id = { scale: 1, tx: 0, ty: 0 };
    const items = [
      { x: -10_000, y: 0, width: 10_010, height: 10 }, // 10 × 10 visible
      { x: 100, y: 100, width: 50, height: 50 }, // 50 × 50 visible
    ];
    const rects = itemRects(items, id, id, 1000, 800, 1);
    expect([...rects]).toEqual([100, 100, 50, 50]);
  });

  it("covers the view with the trail texture, snapped to whole texels", () => {
    for (const view of [{ scale: 1, tx: 0, ty: 0 }, { scale: 0.13, tx: 377, ty: -91 }, { scale: 5, tx: -2000, ty: 900 }]) {
      const r = trailRect(view, 1440, 900);
      const texel = r.size / TRAIL_SIZE;
      expect(Number.isInteger(Math.log2(texel))).toBe(true);
      expect(Number.isInteger(r.x / texel)).toBe(true);
      expect(Number.isInteger(r.y / texel)).toBe(true);
      const tl = toGround(view, 0, 0);
      const br = toGround(view, 1440, 900);
      expect(r.x).toBeLessThanOrEqual(tl.x);
      expect(r.y).toBeLessThanOrEqual(tl.y);
      expect(r.x + r.size).toBeGreaterThanOrEqual(br.x);
      expect(r.y + r.size).toBeGreaterThanOrEqual(br.y);
    }
  });

  it("moves the trail by whole texels when only panning", () => {
    const a = trailRect({ scale: 1, tx: 0, ty: 0 }, 1440, 900);
    const b = trailRect({ scale: 1, tx: -333, ty: 47 }, 1440, 900);
    expect(b.size).toBe(a.size);
    const texel = a.size / TRAIL_SIZE;
    expect(Number.isInteger((b.x - a.x) / texel)).toBe(true);
  });

  it("tracks pointers with speed and a capsule back to the last frame", () => {
    const f = new PointerField();
    f.setPointer("self", 0, 0, 0, false, 1000);
    f.setPointer("self", 10, 0, 10, false, 1010); // 10px in 10ms = 1000 px/s
    f.setPointer("self", 20, 0, 10, true, 1020);
    const p = f.pointers.get("self")!;
    expect(p.speed).toBe(1000);
    expect([p.px, p.py, p.x, p.y]).toEqual([0, 0, 20, 0]);
    expect(p.held).toBe(true);
    expect(f.moving(1015)).toHaveLength(1);
    f.settle();
    expect([p.px, p.py]).toEqual([20, 0]);
    expect(f.moving(1020)).toHaveLength(0);
  });

  it("holds at most 16 pointers, letting the stalest go", () => {
    const f = new PointerField();
    for (let i = 0; i < MAX_POINTERS + 3; i++) f.setPointer(`p${i}`, i, i, 0, false, 1000 + i);
    expect(f.pointers.size).toBe(MAX_POINTERS);
    expect(f.pointers.has("p0")).toBe(false);
    expect(f.pointers.has(`p${MAX_POINTERS + 2}`)).toBe(true);
  });
});

describe("the still frame is always there", () => {
  const ok = { reducedMotion: false, webgl2: true, compiled: true, losses: 0 };

  it("draws the living ground when nothing stands in the way", () => {
    expect(groundMode(ok)).toBe("living");
    expect(groundMode({ ...ok, webgl2: null, compiled: null })).toBe("living");
    expect(groundMode({ ...ok, losses: MAX_LOSSES - 1 })).toBe("living");
  });

  it("falls back for reduced motion, no WebGL2, a failed compile, and a context lost twice", () => {
    expect(groundMode({ ...ok, reducedMotion: true })).toBe("still");
    expect(groundMode({ ...ok, webgl2: false })).toBe("still");
    expect(groundMode({ ...ok, compiled: false })).toBe("still");
    expect(groundMode({ ...ok, losses: 2 })).toBe("still");
    expect(MAX_LOSSES).toBe(2);
  });

  it("has a still on disk for every living ground, tiled at the field's own period", () => {
    for (const theme of LIVING) {
      expect(PAINTED[theme], `${theme} has no still frame`).toBeTruthy();
    }
    expect(PAINTED.meadow!.world).toBe(TILE);
  });

  it("hands the host's failures and reduced motion to that still", () => {
    const layer = read("../src/components/CanvasThemeLayer.tsx");
    expect(layer).toMatch(/isLiving\(theme\) && groundMode\(\{ reducedMotion,/);
    expect(layer).toMatch(/still=\{painted\}/);
    const host = read("../src/components/themes/GroundHost.ts");
    expect(host).toMatch(/losses: this\.losses \}\) === "still"/);
    expect(host).toMatch(/this\.fail\("no WebGL2"\)/);
  });
});

describe("nothing living reaches a first visit", () => {
  it("loads the living layer and each ground only through import()", () => {
    /* design.md §7: the entry chunk gains the theme names and nothing else. A
       single static import of the host or a ground would merge its shaders
       into whichever chunk imported it. */
    const layer = read("../src/components/CanvasThemeLayer.tsx");
    expect(layer).toMatch(/import\("\.\/themes\/LivingGround\.tsx"\)/);
    expect(layer).not.toMatch(/^import .*LivingGround/m);
    const living = read("../src/components/themes/LivingGround.tsx");
    expect(living).toMatch(/import\("\.\/meadow\.ts"\)/);
    expect(living).not.toMatch(/^import .*meadow\.ts/m);
  });

  it("only names living grounds core knows", () => {
    for (const theme of THEMES) expect(isLiving(theme)).toBe((LIVING as readonly string[]).includes(theme));
  });
});
