/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * **The morph: a slide comes apart into its pieces, the pieces travel to
 * where they belong on the next slide, and come together flat again.**
 *
 * Keynote calls the middle of it Magic Move. What makes this one ours is the
 * first and last beat: the pieces lift off the slide into depth before they
 * travel, the way a slide looks when you pull its layers apart, and settle
 * back into a flat page at the end. Dion asked for exactly that after seeing
 * it somewhere else, and the 3D *rotations* (depth, cube, flip) were not it.
 *
 * Both halves here are pure, which is why they live in core rather than in
 * the browser that draws them:
 *
 * - `pairPieces` decides which piece on slide A becomes which piece on
 *   slide B — the same title, the same picture, the card with the same
 *   classes. A piece with no partner leaves (A) or arrives (B) instead.
 * - `morphPlan` turns two inventories into keyframes: for every piece on
 *   both slides, a transform and an opacity at each sample of the motion,
 *   already corrected for the pieces it sits inside.
 *
 * The inventories come from the slides themselves. A screen is a sandboxed
 * frame the app cannot look into, so the web surface loads a twin of each
 * slide with a small runtime (`web/src/lib/morphruntime.ts`) that lists its
 * own pieces and later plays the keyframes it is handed. Everything between
 * those two messages is this file.
 */

/** One piece of a slide, as the slide's own runtime measured it at rest. */
export interface MorphPiece {
  /** Its index in its slide's inventory — what the keyframes are addressed to. */
  i: number;
  /** The nearest enclosing piece's index, or -1: transforms compose, so a
   *  piece's own keyframes are written relative to its parent's. */
  parent: number;
  /** A run of words, a picture-like element, or a decorated box (a card). */
  kind: "text" | "media" | "box";
  tag: string;
  /** The author's own name for it — `data-morph`, else the element id. */
  key?: string | undefined;
  /** Its words, whitespace-collapsed, for text pieces. */
  text?: string | undefined;
  /** What it shows, for media pieces. */
  src?: string | undefined;
  /** A few of its classes, so the same card on two slides can find itself. */
  cls?: string | undefined;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A slide's inventory and the viewport it was measured in. */
export interface MorphScene {
  w: number;
  h: number;
  pieces: MorphPiece[];
}

/** One sample of a piece's motion, as CSS the runtime can hand to `animate`. */
interface MorphKeyframe {
  offset: number;
  transform: string;
  opacity: number;
}

/** One piece's animation track: keyframes plus optional timing so fast 2D
 *  content swaps can run 2-keyframe staggered compositor animations instead
 *  of sampling every beat. */
interface MorphTrack {
  i: number;
  frames: MorphKeyframe[];
  delay?: number;
  duration?: number;
  easing?: string;
}

/** Everything one slide's runtime plays: its pieces and its ground. */
interface MorphSide {
  tracks: MorphTrack[];
  /** The slide's own background (and any full-bleed backdrop), as a layer of
   *  its own: in `morph` it drops away beneath the pieces; in 2D content
   *  swaps (`poof`, `drift`, `rise`) it stays steady and quietly dissolves
   *  only when the two slides wear different grounds. */
  ground: MorphKeyframe[];
}

/** Both sides, and any whole-frame tilt the surface puts on the two frames
 *  together (empty for flat 2D piece swaps). */
interface MorphPlan {
  out: MorphSide;
  in: MorphSide;
  scene: Array<{ offset: number; transform: string }>;
}

/** How many pieces a slide may offer. Past this the motion is noise, and
 *  every extra promoted layer costs GPU memory across mounted twins. */
export const MORPH_MAX_PIECES = 64;

const norm = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const centre = (p: MorphPiece) => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });
const dist = (a: MorphPiece, b: MorphPiece) => {
  const ca = centre(a);
  const cb = centre(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y);
};
const sizeRatio = (a: MorphPiece, b: MorphPiece) => {
  const r = (a.w * a.h) / Math.max(1, b.w * b.h);
  return r >= 1 ? r : 1 / r;
};

/**
 * **Which piece on slide A becomes which piece on slide B.**
 *
 * Passes from most to least certain, each greedy by distance, each piece
 * used once — so an author who names things (`data-morph="hero"`) gets
 * exactly what they named, and a deck nobody annotated still finds its
 * repeated title and its repeated card:
 *
 * 1. the author's key (`data-morph`, else `id`), same kind;
 * 2. the same words (text) or the same source (media);
 * 3. the same tag and classes (boxes and text), sizes within 6×;
 * 4. text that begins with the same words, sizes within 6×.
 *
 * Returns A index → B index.
 */
export function pairPieces(a: readonly MorphPiece[], b: readonly MorphPiece[]): Map<number, number> {
  const pairs = new Map<number, number>();
  const usedB = new Set<number>();
  const pass = (match: (pa: MorphPiece, pb: MorphPiece) => boolean) => {
    const candidates: Array<[number, MorphPiece, MorphPiece]> = [];
    for (const pa of a) {
      if (pairs.has(pa.i)) continue;
      for (const pb of b) {
        if (usedB.has(pb.i) || pa.kind !== pb.kind) continue;
        if (match(pa, pb)) candidates.push([dist(pa, pb), pa, pb]);
      }
    }
    candidates.sort((x, y) => x[0] - y[0] || x[1].i - y[1].i || x[2].i - y[2].i);
    for (const [, pa, pb] of candidates) {
      if (pairs.has(pa.i) || usedB.has(pb.i)) continue;
      pairs.set(pa.i, pb.i);
      usedB.add(pb.i);
    }
  };
  pass((pa, pb) => Boolean(pa.key) && pa.key === pb.key);
  pass((pa, pb) =>
    pa.kind === "media" ? Boolean(pa.src) && pa.src === pb.src : pa.kind === "text" && norm(pa.text) !== "" && norm(pa.text) === norm(pb.text),
  );
  pass((pa, pb) => pa.kind !== "media" && pa.tag === pb.tag && Boolean(pa.cls) && pa.cls === pb.cls && sizeRatio(pa, pb) <= 36);
  pass((pa, pb) => {
    if (pa.kind !== "text" || pa.tag !== pb.tag || sizeRatio(pa, pb) > 36) return false;
    const ta = norm(pa.text).split(" ").slice(0, 3).join(" ");
    return ta.length >= 4 && ta === norm(pb.text).split(" ").slice(0, 3).join(" ");
  });
  return pairs;
}

// ---------- the plan ----------

/** A uniform scale and a shift in page pixels: p → s·p + t. Every piece's
 *  motion is one of these at each sample, which keeps composition exact. */
interface Map2 {
  s: number;
  tx: number;
  ty: number;
}
const ID: Map2 = { s: 1, tx: 0, ty: 0 };
const then = (outer: Map2, inner: Map2): Map2 => ({ s: outer.s * inner.s, tx: outer.s * inner.tx + outer.tx, ty: outer.s * inner.ty + outer.ty });
const ease = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const ramp = (u: number, from: number, to: number) => ease((u - from) / (to - from));
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The three beats, as fractions of the whole: apart, across, together. */
export const MORPH_BEATS = { apart: 0.28, across: 0.74 } as const;

const PERSPECTIVE = 1400;

/**
 * Lifting a piece off the page by `z` pixels, as a flat map: scaled about the
 * slide's centre the way a perspective camera would, and nudged up and away
 * from the travel so the layers read as stacked rather than merely bigger.
 * Flat on purpose — a real `translateZ` inside a page needs `preserve-3d` on
 * every ancestor, and any ancestor with `overflow: hidden` or an opacity
 * flattens it silently. The tilt of the whole slide is real 3D, applied to
 * the frame from outside (`scene`).
 */
function lift(z: number, w: number, h: number, dir: 1 | -1): Map2 {
  const k = PERSPECTIVE / (PERSPECTIVE - z);
  return { s: k, tx: (w / 2) * (1 - k) - dir * 0.16 * z, ty: (h / 2) * (1 - k) - 0.26 * z };
}

/** Where a map puts a piece: its centre and size on screen. */
interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}
const placed = (map: Map2, p: MorphPiece): Rect => {
  const c = centre(p);
  return { cx: map.s * c.x + map.tx, cy: map.s * c.y + map.ty, w: map.s * p.w, h: map.s * p.h };
};
const between = (a: Rect, b: Rect, v: number): Rect => ({
  cx: a.cx + (b.cx - a.cx) * v,
  cy: a.cy + (b.cy - a.cy) * v,
  w: a.w + (b.w - a.w) * v,
  h: a.h + (b.h - a.h) * v,
});
/** The map that sits piece `p` on screen rect `r`: centres meet, and the
 *  scale is the geometric mean of the two ratios, so a long line meeting a
 *  short one is not crushed flat. */
const fit = (p: MorphPiece, r: Rect): Map2 => {
  const s = Math.sqrt((r.w / Math.max(1, p.w)) * (r.h / Math.max(1, p.h)));
  const c = centre(p);
  return { s, tx: r.cx - s * c.x, ty: r.cy - s * c.y };
};

/** How far a piece lifts: deeper inside other pieces is higher off the page,
 *  and words and pictures ride a little above the boxes that hold them. */
function depthsOf(pieces: readonly MorphPiece[]): Map<number, number> {
  const byI = new Map(pieces.map((p) => [p.i, p]));
  const out = new Map<number, number>();
  for (const p of pieces) {
    let level = 0;
    for (let q = byI.get(p.parent); q && level < 8; q = byI.get(q.parent)) level++;
    out.set(p.i, Math.min(560, 90 + level * 130 + (p.kind === "box" ? 0 : 80)));
  }
  return out;
}

/** A piece's own CSS at one sample: its absolute map with its parent's
 *  undone, written for `transform-origin: 0 0` at its own top-left. */
function css(own: Map2, piece: MorphPiece): string {
  const e = own.tx - (1 - own.s) * piece.x;
  const f = own.ty - (1 - own.s) * piece.y;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `matrix(${r(own.s)},0,0,${r(own.s)},${r(e)},${r(f)})`;
}

/**
 * **The keyframes for one flip**, both slides at once.
 *
 * Three beats (`MORPH_BEATS`):
 *
 * - **Apart** — slide A's pieces lift off its ground, each to its own
 *   height, while the surface tilts both frames back.
 * - **Across** — a paired piece travels from where it hangs on A to where its
 *   partner hangs on B, and the two cross-fade on the way, so the eye sees
 *   one thing move. A piece without a partner flies up and away (A) or rises
 *   out of the depth (B). A's ground fades and B's arrives.
 * - **Together** — B's pieces come down onto its ground and the tilt goes
 *   flat, which is the moment the live slide can take over unseen.
 *
 * `dir` is which way the deck went; the layers lean away from it.
 */
export function morphPlan(a: MorphScene, b: MorphScene, dir: "next" | "prev", samples = 14): MorphPlan {
  const sign: 1 | -1 = dir === "next" ? 1 : -1;
  const w = b.w || a.w;
  const h = b.h || a.h;
  const pairs = pairPieces(a.pieces, b.pieces);
  const back = new Map([...pairs].map(([ia, ib]) => [ib, ia]));
  const za = depthsOf(a.pieces);
  const zb = depthsOf(b.pieces);
  const byA = new Map(a.pieces.map((p) => [p.i, p]));
  const byB = new Map(b.pieces.map((p) => [p.i, p]));
  const { apart, across } = MORPH_BEATS;
  const offsets = Array.from({ length: samples + 1 }, (_, n) => n / samples);

  /** Where a piece of A hangs, and how visible, at u. */
  const outAt = (p: MorphPiece, u: number): [Map2, number] => {
    const z = za.get(p.i)!;
    const up = lift(z * ramp(u, 0, apart), w, h, sign);
    if (u <= apart) return [up, 1];
    const v = ramp(u, apart, across);
    const partner = pairs.has(p.i) ? byB.get(pairs.get(p.i)!) : undefined;
    if (partner) {
      // Both partners ride ONE rectangle from where A's piece hangs to where
      // B's will: interpolating each piece's map instead sends the two along
      // different curves, and the eye sees two cards where it should see one.
      const r = between(placed(lift(z, w, h, sign), p), placed(lift(zb.get(partner.i)!, w, h, sign), partner), v);
      return [fit(p, r), 1 - clamp01((v - 0.45) / 0.25)];
    }
    const away = then({ s: 1, tx: -sign * 0.18 * w * v, ty: 0 }, lift(z + 520 * v, w, h, sign));
    return [away, 1 - clamp01((v - 0.1) / 0.6)];
  };

  /** Where a piece of B hangs, and how visible, at u. */
  const inAt = (p: MorphPiece, u: number): [Map2, number] => {
    const z = zb.get(p.i)!;
    if (u >= across) return [lift(z * (1 - ramp(u, across, 1)), w, h, sign), 1];
    const v = ramp(u, apart, across);
    const partner = back.has(p.i) ? byA.get(back.get(p.i)!) : undefined;
    if (partner) {
      const r = between(placed(lift(za.get(partner.i)!, w, h, sign), partner), placed(lift(z, w, h, sign), p), v);
      return [fit(p, r), clamp01((v - 0.3) / 0.25)];
    }
    const rise = then({ s: 1, tx: sign * 0.18 * w * (1 - v), ty: 0 }, lift(z - 700 * (1 - v), w, h, sign));
    return [rise, clamp01((v - 0.3) / 0.6)];
  };

  const side = (scene: MorphScene, at: (p: MorphPiece, u: number) => [Map2, number]): MorphSide["tracks"] => {
    const byI = new Map(scene.pieces.map((p) => [p.i, p]));
    const memo = new Map<string, [Map2, number]>();
    const abs = (p: MorphPiece, n: number): [Map2, number] => {
      const key = `${p.i}:${n}`;
      let got = memo.get(key);
      if (!got) memo.set(key, (got = at(p, offsets[n]!)));
      return got;
    };
    return scene.pieces.map((p) => {
      const parent = byI.get(p.parent);
      return {
        i: p.i,
        frames: offsets.map((offset, n) => {
          const [mine, seen] = abs(p, n);
          const [theirs, theirSeen] = parent ? abs(parent, n) : [ID, 1];
          const own: Map2 = { s: mine.s / theirs.s, tx: (mine.tx - theirs.tx) / theirs.s, ty: (mine.ty - theirs.ty) / theirs.s };
          const opacity = theirSeen > 0.001 ? clamp01(seen / theirSeen) : 1;
          return { offset, transform: css(own, p), opacity: Math.round(opacity * 1000) / 1000 };
        }),
      };
    });
  };

  const tilt = (u: number) => (u <= apart ? ramp(u, 0, apart) : u >= across ? 1 - ramp(u, across, 1) : 1);
  /** How far the grounds sink: the page drops while its pieces rise. */
  const SINK = -320;
  const wholePage: MorphPiece = { i: -1, parent: -1, kind: "box", tag: "body", x: 0, y: 0, w, h };
  const groundAt = (z: number, opacity: number, offset: number): MorphKeyframe => ({
    offset,
    transform: css(lift(z, w, h, sign), wholePage),
    opacity: Math.round(opacity * 1000) / 1000,
  });
  return {
    out: {
      tracks: side(a, outAt),
      ground: offsets.map((offset) => groundAt(SINK * ramp(offset, 0, apart), 1 - ramp(offset, apart + 0.08, apart + 0.36), offset)),
    },
    in: {
      tracks: side(b, inAt),
      ground: offsets.map((offset) => groundAt(SINK * (1 - ramp(offset, across, 1)), ramp(offset, apart + 0.1, across), offset)),
    },
    scene: offsets.map((offset) => {
      const t = tilt(offset);
      const r = (n: number) => Math.round(n * 100) / 100;
      return { offset, transform: `perspective(1800px) rotateX(${r(20 * t)}deg) rotateY(${r(-14 * sign * t)}deg) scale(${r(1 - 0.2 * t)})` };
    }),
  };
}

/** The fast, flat 2D content-swap transitions: background stays steady while
 *  only the slide's pieces leave and join. */
export type PieceSwapKind = "poof" | "drift" | "rise";

/** A big decorated box — a panel or card most of the slide sits on — is part
 *  of the surface, not content: it stays put with the ground while the pieces
 *  on it leave and join. */
function isBackdrop(p: MorphPiece, scene: MorphScene): boolean {
  return p.kind === "box" && p.w * p.h > 0.45 * scene.w * scene.h;
}

/** The pieces a content swap moves: every piece that is not surface and has
 *  no moving piece above it. A piece on a backdrop counts as top-level, so a
 *  deck whose content sits on one big card still comes apart piece by piece.
 *  The returned pieces keep their own `parent`; a backdrop never moves, so a
 *  piece's own transform is also its absolute one. */
function swapRoots(scene: MorphScene): MorphPiece[] {
  const byI = new Map(scene.pieces.map((p) => [p.i, p]));
  return scene.pieces.filter((p) => {
    if (isBackdrop(p, scene)) return false;
    for (let q = byI.get(p.parent); q; q = byI.get(q.parent)) if (!isBackdrop(q, scene)) return false;
    return true;
  });
}

/** Two root pieces are anchored when they are the same content in the same
 *  place (within 12px) — e.g. a persistent footer, header, or brand mark — so
 *  they stay rock-steady instead of blinking out and back in. */
function anchoredSets(a: readonly MorphPiece[], b: readonly MorphPiece[]): { a: Set<number>; b: Set<number> } {
  const sameSpot = (pa: MorphPiece, pb: MorphPiece) =>
    Math.abs(pa.x - pb.x) <= 12 &&
    Math.abs(pa.y - pb.y) <= 12 &&
    Math.abs(pa.w - pb.w) <= 12 &&
    Math.abs(pa.h - pb.h) <= 12;
  const sameContent = (pa: MorphPiece, pb: MorphPiece) => {
    if (pa.kind !== pb.kind || pa.tag !== pb.tag) return false;
    if (pa.key && pa.key === pb.key) return true;
    if (pa.kind === "media") return Boolean(pa.src) && pa.src === pb.src;
    if (pa.kind === "text") return norm(pa.text) !== "" && norm(pa.text) === norm(pb.text);
    return false;
  };
  const outA = new Set<number>();
  const outB = new Set<number>();
  for (const pa of a) {
    for (const pb of b) {
      if (outB.has(pb.i)) continue;
      if (sameContent(pa, pb) && sameSpot(pa, pb)) {
        outA.add(pa.i);
        outB.add(pb.i);
        break;
      }
    }
  }
  return { a: outA, b: outB };
}

/** Centre-scaled transform for `transform-origin: 0 0`: keeps the piece's
 *  visual centre fixed while contracting or blooming in place. */
function centreScale(p: MorphPiece, s: number): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return `translate3d(${r(((1 - s) * p.w) / 2)}px,${r(((1 - s) * p.h) / 2)}px,0) scale(${s})`;
}

const IDENTITY_TRANSFORM = "translate3d(0px,0px,0) scale(1)";

/**
 * **Subtle 2D content-swap plans (`poof`, `drift`, `rise`)** — no 3D tilt,
 * no surface seam, and only 2 keyframes per root piece so every track runs
 * natively on the compositor thread.
 *
 * The slide's background (and any full-bleed backdrop) stays motionless on
 * `out` and gently dissolves across the middle on `in`: when both slides wear
 * the same or a similar background, the surface looks completely still while
 * the content pieces leave and join. Persistent chrome in the same spot
 * (`anchoredSets`) stays pinned too.
 */
export function pieceSwapPlan(
  kind: PieceSwapKind,
  a: MorphScene,
  b: MorphScene,
  dir: "next" | "prev",
  totalMs = 460,
): MorphPlan {
  const sign: 1 | -1 = dir === "next" ? 1 : -1;
  const rootsA = swapRoots(a);
  const rootsB = swapRoots(b);
  const anchored = anchoredSets(rootsA, rootsB);

  // Visual stagger order: reading order (rows top-to-bottom, left-to-right),
  // reversed along the travel axis when stepping backward.
  const order = (list: MorphPiece[]) =>
    [...list].sort((p, q) => {
      if (kind === "drift") return sign * (p.x - q.x || p.y - q.y);
      const row = Math.floor(p.y / 48) - Math.floor(q.y / 48);
      return kind === "rise" ? sign * (row || p.x - q.x) : row || p.x - q.x;
    });

  const outDur = Math.round(totalMs * 0.36);
  const outSpread = Math.min(Math.round(totalMs * 0.16), Math.max(0, rootsA.length - 1) * 12);
  const inBase = Math.round(totalMs * 0.3);
  const inDur = Math.round(totalMs * 0.48);
  const inSpread = Math.min(totalMs - inBase - inDur, Math.max(0, rootsB.length - 1) * 16);

  const outEase = "cubic-bezier(0.4, 0, 1, 1)";
  const inEase = "cubic-bezier(0.22, 1, 0.36, 1)";

  const leaveTransform = (p: MorphPiece) =>
    kind === "poof"
      ? centreScale(p, 0.92)
      : kind === "drift"
        ? `translate3d(${-sign * 32}px,0px,0) scale(1)`
        : `translate3d(0px,${-sign * 16}px,0) scale(1)`;

  const enterTransform = (p: MorphPiece) =>
    kind === "poof"
      ? centreScale(p, 0.92)
      : kind === "drift"
        ? `translate3d(${sign * 36}px,0px,0) scale(1)`
        : `translate3d(0px,${sign * 22}px,0) scale(1)`;

  const movingA = order(rootsA.filter((p) => !anchored.a.has(p.i)));
  const movingB = order(rootsB.filter((p) => !anchored.b.has(p.i)));
  const stepA = movingA.length > 1 ? outSpread / (movingA.length - 1) : 0;
  const stepB = movingB.length > 1 ? inSpread / (movingB.length - 1) : 0;

  const outTracks: MorphTrack[] = [
    ...rootsA
      .filter((p) => anchored.a.has(p.i))
      .map((p) => ({
        i: p.i,
        frames: [
          { offset: 0, transform: IDENTITY_TRANSFORM, opacity: 1 },
          { offset: 1, transform: IDENTITY_TRANSFORM, opacity: 1 },
        ],
      })),
    ...movingA.map((p, idx) => ({
      i: p.i,
      delay: Math.round(idx * stepA),
      duration: outDur,
      easing: outEase,
      frames: [
        { offset: 0, transform: IDENTITY_TRANSFORM, opacity: 1 },
        { offset: 1, transform: leaveTransform(p), opacity: 0 },
      ],
    })),
  ];

  const inGround: MorphKeyframe[] = [
    { offset: 0, transform: "none", opacity: 0 },
    { offset: 0.32, transform: "none", opacity: 0 },
    { offset: 0.62, transform: "none", opacity: 1 },
    { offset: 1, transform: "none", opacity: 1 },
  ];

  const inTracks: MorphTrack[] = [
    // A slide's backdrop cards are part of its surface: on the way in they
    // arrive with its ground, never ahead of what is still leaving.
    ...b.pieces
      .filter((p) => isBackdrop(p, b))
      .map((p) => ({
        i: p.i,
        easing: "ease-in-out",
        frames: inGround.map((f) => ({ ...f, transform: IDENTITY_TRANSFORM })),
      })),
    ...rootsB
      .filter((p) => anchored.b.has(p.i))
      .map((p) => ({
        i: p.i,
        easing: "ease-in-out",
        frames: inGround.map((f) => ({ ...f, transform: IDENTITY_TRANSFORM })),
      })),
    ...movingB.map((p, idx) => ({
      i: p.i,
      delay: Math.round(inBase + idx * stepB),
      duration: inDur,
      easing: inEase,
      frames: [
        { offset: 0, transform: enterTransform(p), opacity: 0 },
        { offset: 1, transform: IDENTITY_TRANSFORM, opacity: 1 },
      ],
    })),
  ];

  return {
    out: {
      tracks: outTracks,
      ground: [
        { offset: 0, transform: "none", opacity: 1 },
        { offset: 1, transform: "none", opacity: 1 },
      ],
    },
    in: {
      tracks: inTracks,
      ground: inGround,
    },
    scene: [],
  };
}

/**
 * **What a slide's runtime said, made safe to plan with.** The runtime runs
 * inside the slide's own document, next to the slide's own scripts, so its
 * message is untrusted input: every number must be finite, every string is
 * cut short, and a piece may only point at a parent that came before it.
 * Null when it is not a scene at all.
 */
export function sceneFromMessage(data: unknown): MorphScene | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.type !== "isocan:morph:scene" || !Array.isArray(m.pieces)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : undefined);
  const w = num(m.w);
  const h = num(m.h);
  if (w === null || h === null || w <= 0 || h <= 0) return null;
  const pieces: MorphPiece[] = [];
  const kept = new Set<number>();
  // `i` stays the runtime's own index even when a neighbour is refused: the
  // keyframes are addressed by it, and renumbering would move the wrong element.
  m.pieces.slice(0, MORPH_MAX_PIECES).forEach((raw, i) => {
    if (typeof raw !== "object" || raw === null) return;
    const r = raw as Record<string, unknown>;
    const [x, y, pw, ph] = [num(r.x), num(r.y), num(r.w), num(r.h)];
    const kind = r.kind === "text" || r.kind === "media" || r.kind === "box" ? r.kind : null;
    if (x === null || y === null || pw === null || ph === null || pw <= 0 || ph <= 0 || !kind) return;
    const parent = num(r.parent);
    kept.add(i);
    pieces.push({
      i,
      parent: parent !== null && kept.has(parent) && parent < i ? parent : -1,
      kind,
      tag: str(r.tag, 24) ?? "div",
      key: str(r.key, 120),
      text: str(r.text, 160),
      src: str(r.src, 400),
      cls: str(r.cls, 160),
      x,
      y,
      w: pw,
      h: ph,
    });
  });
  return { w, h, pieces };
}
