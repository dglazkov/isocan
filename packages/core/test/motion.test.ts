import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import {
  buildMotion,
  isMotionRecipe,
  MOTION_BEAT,
  MOTION_PIVOTS,
  MOTION_PROPS,
  motionEngine,
  motionEngineSource,
  motionProperties,
  motionWarnings,
  pivotOn,
  validateMotionSpec,
  type MotionBuild,
  type MotionBuildInput,
  type MotionElement,
  type MotionEngine,
  type MotionRoot,
  type MotionSource,
  type MotionSpec,
} from "@isocan/core/motion";

/**
 * **The motion engine and the motion document** (motion phase 0;
 * `docs/projects/motion/design.md` §1–§3, §6).
 *
 * The phase's proof, in the half that needs no browser: `render(t)` is pure
 * (the same `t` gives the same transforms in any order, any number of
 * times), the engine the document inlines is the same engine Node runs, the
 * principles are checks that fire, and a hostile source comes out with its
 * scripts and remote references gone, said in words.
 *
 * Fixtures are synthetic: an "Acme Bakery" logo as three SVGs.
 */

const fixture = (name: string) => readFileSync(new URL(`./fixtures/motion/${name}.svg`, import.meta.url), "utf8");

/** Scene 1's logo as the canvas holds it: circle, wheat inside it, wordmark below. */
const LOGO: MotionSource[] = [
  { item: "itm_circle", version: "ver_c1", title: "Circle", box: { x: 0, y: 0, width: 200, height: 200 }, svg: fixture("circle") },
  { item: "itm_wheat", version: "ver_w1", title: "Wheat", box: { x: 58, y: 30, width: 84, height: 140 }, svg: fixture("wheat") },
  { item: "itm_word", version: "ver_m1", title: "Wordmark", box: { x: -60, y: 210, width: 320, height: 60 }, svg: fixture("wordmark") },
];

/** A root that records what `render` sets, standing in for the stage `<svg>`. */
function recordingRoot(spec: MotionSpec): { root: MotionRoot; attrs: () => Record<string, Record<string, string>> } {
  const els = new Map<string, Record<string, string>>();
  const element = (key: string): MotionElement => ({
    setAttribute(name, value) {
      els.set(key, { ...(els.get(key) ?? {}), [name]: value });
    },
  });
  const root: MotionRoot = {
    querySelectorAll(selector) {
      const m = /^\[data-motion(-draw)?="([^"]+)"\]$/.exec(selector);
      if (!m) throw new Error(`unexpected selector ${selector}`);
      if (!spec.moves.some((move) => move.target === m[2])) return [];
      return [element(`${m[1] ? "draw" : "group"}:${m[2]}`)];
    },
  };
  return { root, attrs: () => Object.fromEntries([...els].sort(([a], [b]) => a.localeCompare(b))) };
}

describe("the engine's vocabulary", () => {
  const e = motionEngine;

  it("tracks through keys, holding the first before it and the last after", () => {
    const keys = [{ t: 1, v: 10 }, { t: 2, v: 20, ease: "linear" as const }];
    expect(e.track(0, keys)).toBe(10);
    expect(e.track(1.5, keys)).toBe(15);
    expect(e.track(9, keys)).toBe(20);
  });

  it("segs 0 → 1 across a window and waves, loops and bells as named", () => {
    expect(e.seg(0.5, 0, 1)).toBe(0.5);
    expect(e.seg(-1, 0, 1)).toBe(0);
    expect(e.seg(2, 0, 1)).toBe(1);
    expect(e.wave(0, 2, 5)).toBe(0);
    expect(e.wave(0.5, 2, 5)).toBeCloseTo(5);
    expect(e.loop(5, 2)).toBe(1);
    expect(e.loop(-0.5, 2)).toBe(1.5);
    expect(e.bell(1, 1, 0.2)).toBe(1);
    expect(e.bell(2, 1, 0.2)).toBeLessThan(0.001);
  });

  it("flows through every pose it is given", () => {
    const poses = [{ t: 0, x: 0 }, { t: 1, x: 10 }, { t: 2, x: 0 }, { t: 3, x: 5 }];
    for (const p of poses) expect(e.flow(p.t, poses).x).toBeCloseTo(p.x);
    expect(e.flow(0.5, poses).x).toBeGreaterThan(0);
  });

  it("seeds stable randomness — the same seed and n is the same number, asked in any order", () => {
    const a = motionEngine.seeded(42), b = motionEngine.seeded(42);
    const forward = [0, 1, 2, 3].map((n) => a(n));
    const backward = [3, 2, 1, 0].map((n) => b(n)).reverse();
    expect(forward).toEqual(backward);
    expect(new Set(forward).size).toBe(4);
    for (const v of forward) expect(v >= 0 && v < 1).toBe(true);
    expect(motionEngine.seeded(43)(0)).not.toBe(forward[0]);
  });
});

const ASSEMBLE = await buildMotion({ sources: LOGO, recipe: "assemble" });
const IDLE = await buildMotion({ sources: LOGO, recipe: "idle" });

describe("render(t) is a pure function of t", () => {
  const { spec } = ASSEMBLE;

  it("evaluates the same t to the same state, in any order, any number of times", () => {
    const times = [0, 0.3, 1.2, 2.4, 0.7, 1.2, 0, 2.4, 1.2];
    const first = new Map<number, string>();
    for (const t of times) {
      const s = JSON.stringify(motionEngine.evaluate(spec, t));
      if (first.has(t)) expect(s).toBe(first.get(t));
      else first.set(t, s);
    }
    // ...and the frames differ where the motion does, or the comparison proves nothing.
    expect(first.get(0)).not.toBe(first.get(1.2));
    expect(first.get(0.3)).not.toBe(first.get(1.2));
  });

  it("sets the same attributes for 1.2 s whatever was rendered before it", () => {
    const fresh = recordingRoot(spec);
    motionEngine.render(fresh.root, spec, 1.2);
    const visited = recordingRoot(spec);
    for (const t of [2.4, 0.3, 0, 1.9, 1.2, 0.3]) motionEngine.render(visited.root, spec, t);
    motionEngine.render(visited.root, spec, 1.2);
    expect(visited.attrs()).toEqual(fresh.attrs());
    const at03 = recordingRoot(spec);
    motionEngine.render(at03.root, spec, 0.3);
    expect(at03.attrs()).not.toEqual(fresh.attrs());
  });
});

describe("one engine, two places it runs", () => {
  // The document's engine is `motionEngineSource()`, evaluated with nothing
  // around it. If the factory reached for an import or a module binding, or
  // a transpiler wrapped it in a helper the source does not supply, this is
  // where it throws.
  const isolated = vm.runInNewContext(motionEngineSource(), {}) as MotionEngine;
  const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

  it("evaluates every frame of the logo exactly as Node's copy does", () => {
    const { spec } = ASSEMBLE;
    for (let n = 0; n <= 150; n++) {
      expect(plain(isolated.evaluate(spec, n / 60))).toEqual(plain(motionEngine.evaluate(spec, n / 60)));
    }
    const idle = IDLE.spec;
    for (let n = 0; n <= 240; n += 7) expect(plain(isolated.evaluate(idle, n / 60))).toEqual(plain(motionEngine.evaluate(idle, n / 60)));
  });

  it("answers every function of the vocabulary the same", () => {
    const keys = [{ t: 0, v: 0 }, { t: 1, v: 1, ease: "outBack" as const }];
    const poses = [{ t: 0, a: 0 }, { t: 1, a: 3 }, { t: 2, a: -1 }];
    for (const t of [-0.5, 0, 0.25, 0.5, 1, 1.5, 3]) {
      expect(isolated.track(t, keys)).toBe(motionEngine.track(t, keys));
      expect(isolated.seg(t, 0, 2, "inOutSine")).toBe(motionEngine.seg(t, 0, 2, "inOutSine"));
      expect(plain(isolated.flow(t, poses))).toEqual(plain(motionEngine.flow(t, poses)));
      expect(isolated.wave(t, 1.3, 2, 0.1)).toBe(motionEngine.wave(t, 1.3, 2, 0.1));
      expect(isolated.loop(t, 0.7)).toBe(motionEngine.loop(t, 0.7));
      expect(isolated.bell(t, 1, 0.3)).toBe(motionEngine.bell(t, 1, 0.3));
      expect(isolated.seeded(7)(Math.round(t * 4))).toBe(motionEngine.seeded(7)(Math.round(t * 4)));
    }
    for (const name of Object.keys(motionEngine.EASINGS)) {
      expect(isolated.ease(name as never, 0.37)).toBe(motionEngine.ease(name as never, 0.37));
    }
    const state = { x: 1, y: 2, rotate: 30, scale: 0.5, opacity: 1, draw: 1 };
    expect(isolated.transformOf(state, { x: 5, y: 9, at: "base" })).toBe(motionEngine.transformOf(state, { x: 5, y: 9, at: "base" }));
  });

  it("is the text the document carries", () => {
    expect(ASSEMBLE.html).toContain(motionEngineSource());
  });
});

const input: MotionBuildInput = { sources: LOGO, recipe: "assemble" };
const built: MotionBuild = await buildMotion(input);
const SLOW = await buildMotion({ sources: LOGO, recipe: "assemble", seconds: 4.8, loop: true });
const IDLE_3S = await buildMotion({ sources: LOGO, recipe: "idle", seconds: 3 });

describe("buildMotion, the logo of Scene 1", () => {

  it("makes the selection's bounding box the stage, sources at their offsets, back to front", () => {
    expect(built.stage).toEqual({ x: -60, y: 0, width: 320, height: 270 });
    expect(built.spec.stage).toEqual({ width: 320, height: 270 });
    expect(built.spec.layers.map((l) => [l.id, l.box.x, l.box.y])).toEqual([["circle", 60, 0], ["wheat", 118, 30], ["wordmark", 0, 210]]);
    const at = (needle: string) => built.html.indexOf(needle);
    expect(at('data-motion-layer="circle"')).toBeLessThan(at('data-motion-layer="wheat"'));
    expect(at('data-motion-layer="wheat"')).toBeLessThan(at('data-motion-layer="wordmark"'));
  });

  it("finds the named group and turns it on its base, not its middle", () => {
    const wheat = built.spec.layers.find((l) => l.id === "wheat")!;
    expect(Object.keys(wheat.parts)).toEqual(["stalk"]);
    const stalk = built.spec.moves.find((m) => m.target === "wheat/stalk")!;
    expect(stalk.pivot?.at).toBe("base");
    expect(stalk.pivot?.y).toBeCloseTo(wheat.parts.stalk!.y + wheat.parts.stalk!.height);
    expect(built.html).toContain('data-motion="wheat/stalk"');
    // The drawing's own id survives, prefixed, around the wrapper.
    expect(built.html).toContain('id="m-wheat-stalk"');
  });

  it("draws the circle on, and settles the wordmark a beat after the wheat stops", () => {
    expect(built.spec.layers.find((l) => l.id === "circle")!.ink).toBe("outline");
    expect(built.spec.moves[0]).toMatchObject({ target: "circle", channels: { draw: {} } });
    expect(built.html).toMatch(/<circle[^>]*pathLength="1"[^>]*data-motion-draw="circle"/);
    const end = (target: string) => Math.max(...Object.values(built.spec.moves.find((m) => m.target === target)!.channels).flatMap((c) => c!.keys!.map((k) => k.t)));
    const start = (target: string) => Math.min(...Object.values(built.spec.moves.find((m) => m.target === target)!.channels).flatMap((c) => c!.keys!.map((k) => k.t)));
    expect(start("wordmark")).toBeGreaterThanOrEqual(end("wheat/stalk") + MOTION_BEAT);
    expect(built.spec.seconds).toBe(2.4);
    expect(built.spec.loop).toBe(false);
  });

  it("breaks no principle, and says so with no warnings", () => {
    expect(built.warnings).toEqual([]);
    expect(IDLE.warnings).toEqual([]);
  });

  it("strips nothing from a clean drawing", () => {
    expect(built.stripped).toEqual([]);
  });

  it("fits --seconds and loops when asked, and the loop's seam is a warning", () => {
    const slow = SLOW;
    expect(slow.spec.seconds).toBe(4.8);
    expect(slow.spec.moves.find((m) => m.target === "circle")!.channels.draw!.keys![1]!.t).toBeCloseTo(1.8);
    expect(slow.warnings.map((w) => w.code)).toContain("loop-seam");
    const idle = IDLE_3S;
    expect(idle.spec).toMatchObject({ seconds: 3, loop: true, recipe: "idle" });
  });

  it("wears the motion properties", () => {
    expect(motionProperties(built)).toEqual({
      [MOTION_PROPS.motion]: "true",
      [MOTION_PROPS.sources]: JSON.stringify([{ item: "itm_circle", version: "ver_c1" }, { item: "itm_wheat", version: "ver_w1" }, { item: "itm_word", version: "ver_m1" }]),
      [MOTION_PROPS.seconds]: "2.4",
      [MOTION_PROPS.loop]: "false",
    });
  });

  it("knows its recipes and pivots", () => {
    expect(isMotionRecipe("assemble")).toBe(true);
    expect(isMotionRecipe("orbit")).toBe(false);
    expect(MOTION_PIVOTS).toContain("base");
  });
});

const HOSTILE = `<?xml version="1.0"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 100" onload="alert('acme-onload')">
<script>alert('acme-script')</script>
<style>@import url("https://acme.test/evil.css"); .st0 { fill: #c00 } #dot { stroke: url(#grad) } .bg { background: url(https://acme.test/track.png) }</style>
<defs><linearGradient id="grad"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">acme-foreign</div></foreignObject>
<image href="https://acme.test/pixel.png" width="10" height="10"/>
<use xlink:href="https://acme.test/sprite.svg#icon"/>
<a href="javascript:alert('acme-js')"><circle id="dot" class="st0" cx="50" cy="50" r="10" onclick="alert('acme-click')" fill="url(#grad)"/></a>
<rect width="5" height="5" fill="url(https://acme.test/paint.svg#p)"/>
<animate attributeName="r" from="1" to="9" dur="1s"/>
<img src="x" onerror="alert('acme-img')">
</svg>`;
const source: MotionSource = { item: "itm_bad", version: "ver_b1", title: "Badge", box: { x: 0, y: 0, width: 100, height: 100 }, svg: HOSTILE };
const HOSTILE_BUILT = await buildMotion({ sources: [source], recipe: "idle" });

describe("what a motion refuses to carry", () => {
  const built = HOSTILE_BUILT;
  const layerMarkup = built.html.slice(built.html.indexOf("<svg"), built.html.indexOf("</svg>\n<div"));

  it("strips scripts, handlers, foreign content, remote references and SMIL, and says what", () => {
    for (const evil of ["acme-onload", "acme-script", "acme-foreign", "acme-click", "acme-js", "acme-img", "acme.test", "<animate"]) {
      expect(layerMarkup, evil).not.toContain(evil);
    }
    expect(built.stripped).toHaveLength(1);
    const what = built.stripped[0]!.what.join("; ");
    for (const said of ["<script>", "onload attribute", "onclick attribute", "<foreignObject>", "external href ×3", "remote url()", "CSS @import", "remote url() in CSS", "<animate> (SMIL animation)", "outside the <svg> root"]) {
      expect(what, said).toContain(said);
    }
  });

  it("keeps the drawing: same-document references renamed together, styles scoped to the layer", () => {
    expect(layerMarkup).toContain('id="m-badge-grad"');
    expect(layerMarkup).toContain('fill="url(#m-badge-grad)"');
    expect(layerMarkup).toContain('id="m-badge-dot"');
    expect(layerMarkup).toMatch(/@scope \(\[data-motion-layer="badge"\]\)/);
    expect(layerMarkup).toContain("#m-badge-dot");
    expect(layerMarkup).toContain(".st0");
  });

  it("gives two sources with the same ids their own", async () => {
    const twin = (title: string): MotionSource => ({ ...source, item: `itm_${title}`, title, svg: '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="10" height="10"/></svg>' });
    const { html } = await buildMotion({ sources: [twin("One"), twin("Two")], recipe: "idle" });
    expect(html).toContain('id="m-one-g"');
    expect(html).toContain('id="m-two-g"');
    expect(html).toContain('fill="url(#m-two-g)"');
  });

  it("refuses a source with no <svg>", async () => {
    await expect(buildMotion({ sources: [{ ...source, svg: "<p>hello</p>" }], recipe: "idle" })).rejects.toThrow(/has no <svg> to animate/);
  });
});

describe("the principles, as checks", () => {
  const base = ASSEMBLE.spec;
  const withMoves = (moves: MotionSpec["moves"], extra: Partial<MotionSpec> = {}): MotionSpec => ({ ...base, ...extra, moves });
  const stalkBox = base.layers.find((l) => l.id === "wheat")!.parts.stalk!;

  it("refuses a rotation that names no pivot, and a target that is not there", () => {
    expect(() => validateMotionSpec(withMoves([{ target: "wheat/stalk", channels: { rotate: { keys: [{ t: 0, v: 0 }, { t: 1, v: 10 }] } } }]))).toThrow(/names no pivot/);
    expect(() => validateMotionSpec(withMoves([{ target: "wheat/leaf", channels: { opacity: {} } }]))).toThrow(/not a layer or a named part/);
    expect(() => validateMotionSpec(withMoves([], { seconds: 600 }))).toThrow(/at most 60 seconds/);
  });

  it("warns when a part turns on its own centre unless the centre was said", () => {
    const centre = pivotOn(stalkBox, "center");
    const unsaid = motionWarnings(withMoves([{ target: "wheat/stalk", pivot: { ...centre, at: "point" }, channels: { rotate: { wave: { period: 2, amp: 3 } } } }]));
    expect(unsaid.map((w) => w.code)).toEqual(["pivot-centre"]);
    expect(motionWarnings(withMoves([{ target: "wheat/stalk", pivot: centre, channels: { rotate: { wave: { period: 2, amp: 3 } } } }]))).toEqual([]);
  });

  it("warns when a follower does not trail its leader by a beat", () => {
    const warnings = motionWarnings(withMoves([
      { target: "circle", channels: { opacity: { keys: [{ t: 0, v: 0 }, { t: 0.5, v: 1 }] } } },
      { target: "wordmark", follows: "circle", channels: { opacity: { keys: [{ t: 0.02, v: 0 }, { t: 0.5, v: 1 }] } } },
    ]));
    expect(warnings.map((w) => w.code)).toEqual(["follower-lag"]);
  });

  it("warns when idle motion passes its ceiling, and when something teleports", () => {
    const pivot = pivotOn(stalkBox, "base");
    expect(motionWarnings(withMoves([{ target: "wheat/stalk", pivot, channels: { rotate: { wave: { period: 2.4, amp: 25 } } } }])).map((w) => w.code)).toContain("idle-ceiling");
    expect(motionWarnings(withMoves([{ target: "wordmark", channels: { opacity: { keys: [{ t: 1, v: 0 }, { t: 1, v: 1 }] } } }])).map((w) => w.code)).toEqual(["teleport"]);
  });
});
