import type { Viewport } from "./viewport.ts";

/**
 * **Everything that touches the ground, gathered once per frame** — the input
 * field of design.md §2, as pure arithmetic a test can hold.
 *
 * A living ground reads three things: pointers (where, how fast, held), a
 * trail texture of where they have been in the last second or so, and the
 * rectangles of the items standing on it. All three are in GROUND space,
 * which is world space for a ground that travels with the canvas and screen
 * space for one pinned to the window — so the shader has one coordinate
 * system and never asks which kind of ground it is.
 *
 * Nothing here is sent, stored or new on the wire: it is built from what the
 * browser already has. Phase 1 fed it this viewer's pointer; phase 2 adds
 * the presence cursors `CursorLayer` already draws — people and agents —
 * through `setPresence`, under their session ids. Their positions are the
 * ones CursorLayer has already eased toward each presence update, so the
 * ground follows the cursor you see, not the beat that moved it.
 */

/** Up to this many pointers reach the shader (design.md §2). */
export const MAX_POINTERS = 16;
/** Up to this many item rectangles; beyond it the largest on screen win. */
export const MAX_ITEMS = 64;
/**
 * **How hard an agent's cursor presses the ground, against a person's 1.**
 *
 * Scene 3 says full weight: an agent's small moves leave small trails like
 * anyone's. design.md's "Deliberately open" keeps the other answer ready — if
 * a busy agent's constant moves turn a shared screen into a lawnmower, this
 * goes to 0.5 and nothing else changes. One constant, so that is a one-line
 * edit rather than a hunt.
 */
export const AGENT_WEIGHT = 1;
/** The trail texture's side, in texels. */
export const TRAIL_SIZE = 256;
/** How far past the view the trail reaches, so a trail does not end at the
 *  window's edge the moment you pan. */
const TRAIL_MARGIN = 1.5;

/** The transform from ground space to the screen — the uniform the shader
 *  reads. A travelling ground's is the viewport itself; a pinned one's is
 *  the identity, so it neither pans nor zooms. */
export function groundView(viewport: Viewport, pinned: boolean): Viewport {
  return pinned ? { scale: 1, tx: 0, ty: 0 } : viewport;
}

/** A screen point (relative to the canvas element) in ground space. */
export function toGround(view: Viewport, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.tx) / view.scale, y: (sy - view.ty) / view.scale };
}

/** An item's box in world units — the slice of an item `itemRects` reads. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The item's id, when the caller wants `ids` filled in (Night's glow). */
  id?: string;
}

/**
 * The item rectangles the ground should know about, in ground space, packed
 * `x, y, w, h` for a uniform array.
 *
 * Items are stored in world space; on a pinned ground they still move across
 * it, so each is taken to the screen through the CANVAS viewport and back
 * into ground space through the ground's own view. Off-screen items are
 * dropped — the ground cannot be seen under them — and past `MAX_ITEMS` the
 * ones covering the most screen win, because a large card pressing the grass
 * is the thing a person would notice missing.
 */
export function itemRects(
  items: readonly Rect[],
  viewport: Viewport,
  ground: Viewport,
  screenW: number,
  screenH: number,
  max = MAX_ITEMS,
  ids?: string[],
): Float32Array {
  const seen: { area: number; x: number; y: number; w: number; h: number; id: string }[] = [];
  for (const it of items) {
    if (!(it.width > 0 && it.height > 0)) continue;
    const sx = it.x * viewport.scale + viewport.tx;
    const sy = it.y * viewport.scale + viewport.ty;
    const sw = it.width * viewport.scale;
    const sh = it.height * viewport.scale;
    const vw = Math.min(sx + sw, screenW) - Math.max(sx, 0);
    const vh = Math.min(sy + sh, screenH) - Math.max(sy, 0);
    if (vw <= 0 || vh <= 0) continue;
    const at = toGround(ground, sx, sy);
    seen.push({ area: vw * vh, x: at.x, y: at.y, w: sw / ground.scale, h: sh / ground.scale, id: it.id ?? "" });
  }
  seen.sort((a, b) => b.area - a.area);
  const n = Math.min(seen.length, max);
  const out = new Float32Array(n * 4);
  if (ids) ids.length = 0;
  for (let i = 0; i < n; i++) {
    const r = seen[i]!;
    out.set([r.x, r.y, r.w, r.h], i * 4);
    // Packed in the same order, so `ids[i]` is the item under rect `i`.
    ids?.push(r.id);
  }
  return out;
}

/**
 * **Where the trail texture sits in ground space.** Centred on the view and
 * `TRAIL_MARGIN` times its larger side, with a texel size that is a power of
 * two and an origin snapped to whole texels — so panning moves the texture by
 * whole texels and the history is copied across exactly, not re-sampled (and
 * blurred) every frame. Only a zoom across a power of two changes the texel
 * size and resamples.
 */
export function trailRect(view: Viewport, screenW: number, screenH: number): { x: number; y: number; size: number } {
  const span = (Math.max(screenW, screenH) / view.scale) * TRAIL_MARGIN;
  const texel = 2 ** Math.ceil(Math.log2(Math.max(span / TRAIL_SIZE, 1e-6)));
  const size = texel * TRAIL_SIZE;
  const cx = (screenW / 2 - view.tx) / view.scale;
  const cy = (screenH / 2 - view.ty) / view.scale;
  return {
    x: Math.floor((cx - size / 2) / texel) * texel,
    y: Math.floor((cy - size / 2) / texel) * texel,
    size,
  };
}

/** One thing touching the ground, as the shader sees it. */
export interface Pointer {
  /** `"self"` for this viewer's pointer, else the presence session id — so a
   *  ground with memory of its own (Night's fireflies) can tell them apart. */
  id: string;
  /** Ground-space position now, and where it was at the last frame — the
   *  stamp is a capsule between the two, so a fast flick leaves a line, not
   *  dots. */
  x: number;
  y: number;
  px: number;
  py: number;
  /** Screen pixels per second — speed is felt on screen, not in the world. */
  speed: number;
  held: boolean;
  /** How hard it presses, 0..1 — a person 1, an agent `AGENT_WEIGHT`. */
  weight: number;
  /** When this pointer last moved, `performance.now()` ms. */
  at: number;
}

/**
 * The pointers on this ground, by id. This viewer's own is `"self"`; every
 * presence cursor is under its session id. At most `MAX_POINTERS`, newest
 * movement first.
 */
export class PointerField {
  readonly pointers = new Map<string, Pointer>();

  /** A new sample for one pointer, in ground space, with its screen speed
   *  from the last sample. A first sample has no speed and stamps nothing
   *  wider than itself. */
  setPointer(id: string, x: number, y: number, screenDist: number, held: boolean, now: number, weight = 1): void {
    const was = this.pointers.get(id);
    const dt = was ? Math.max(now - was.at, 1) : Infinity;
    const speed = was ? (screenDist / dt) * 1000 : 0;
    // `px, py` stay where the last FRAME left them (`settle`), so several
    // events between two frames still stamp one unbroken capsule.
    this.pointers.set(id, { id, x, y, px: was ? was.px : x, py: was ? was.py : y, speed, held, weight, at: now });
    if (this.pointers.size > MAX_POINTERS) {
      // The stalest goes: a cursor that has not moved for longest is the one
      // whose trail is already gone.
      let stalest: string | null = null;
      let oldest = Infinity;
      for (const [k, p] of this.pointers) if (p.at < oldest) [stalest, oldest] = [k, p.at];
      if (stalest !== null) this.pointers.delete(stalest);
    }
  }

  /**
   * **Somebody else's cursor moved** — a presence cursor, at a ground-space
   * point. Its speed comes from its own last sample (the distance taken back
   * to the screen through `groundScale`, the ground view's scale), because a
   * presence update carries a position and nothing else; and its button is
   * never held, because nothing on the wire says so and nothing new is sent
   * to make it say so. An agent presses with `AGENT_WEIGHT`.
   */
  setPresence(id: string, x: number, y: number, groundScale: number, agent: boolean, now: number): void {
    const was = this.pointers.get(id);
    const dist = was ? Math.hypot(x - was.x, y - was.y) * groundScale : 0;
    this.setPointer(id, x, y, dist, false, now, agent ? AGENT_WEIGHT : 1);
  }

  /** A presence cursor left: its trail fades on its own, but it no longer
   *  holds one of the sixteen places. */
  removePointer(id: string): void {
    this.pointers.delete(id);
  }

  /** Pointers that moved since `since` — the ones that stamp this frame. */
  moving(since: number): Pointer[] {
    return [...this.pointers.values()].filter((p) => p.at > since);
  }

  /** After a frame has stamped them, each pointer's capsule collapses to its
   *  current point, so a pointer that stops does not keep stamping a line. */
  settle(): void {
    for (const p of this.pointers.values()) {
      p.px = p.x;
      p.py = p.y;
    }
  }
}
