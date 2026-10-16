import { annotationTarget } from "./annotation.ts";
import type { Move } from "./layout.ts";
import type { CanvasContents, Item } from "./model.ts";
import { PLACEMENT_CLEARANCE } from "./placement.ts";

/**
 * **Tidy, as a person means it: straighten what is there, keep the
 * arrangement** (14 Oct 2026).
 *
 * The first Tidy on a selection was the lattice (`formatMoves` in `grid`
 * mode): every item re-dealt into a √n-per-row grid whose columns are the
 * width of the widest item, in a reading order guessed from coarse bands of
 * `y`. It decided a NEW arrangement. Dion selected four things sitting in a
 * loose arrangement, pressed Tidy, and got a different one — two cards that
 * had been stacked put side by side, a title that ran under everything moved
 * to the top right — and, because the lattice counted no chrome, a title
 * pressed against the label strip drawn above its new neighbour so the two
 * texts sat on top of each other. "I just wanted to clean up the alignment."
 *
 * So this is the default now, and the lattice keeps its own name (`grid`):
 *
 * 1. **Snap near-aligned edges.** Tops, then bottoms, then middles share a row
 *    when they are within a tolerance; lefts, rights and centres share a
 *    column. A shared line is the thing a person squints at and fixes by hand.
 * 2. **Even out nearly-equal gaps.** Between neighbours in a row and in a
 *    column, gaps that are almost the same become the same — unless moving the
 *    item would break a line it was just snapped onto.
 * 3. **Never overlap.** Each item's footprint is its box AND the chrome the
 *    canvas draws outside it — the name strip above, the row of marks below —
 *    and the tidy never leaves two footprints touching that did not already.
 *    When a snap would, the later item (in reading order) is pushed the way it
 *    already sat from the other: down if it was below, right if beside.
 *
 * Nothing is re-dealt: an item that was left of another stays left of it, an
 * item that was above stays above, and everything moves by at most the snap
 * tolerance unless it had to move to clear an overlap.
 *
 * Pure geometry on boxes, so the web app, `isocan tidy <items...>` and the
 * group-canvas act (`groupArrangeAction`) all land on the same numbers, and
 * one `items.move` (or one group transform) is one undo.
 */

/**
 * **What the canvas draws OUTSIDE an item, in screen pixels.**
 *
 * Above: the title row (`.item-titlebar`), which sits 6px + the 1px border
 * above the item and is a 15px line beside a 13px kind icon — 22, rounded to
 * the 24 groups already reserve. Below: the marks row (`.item-under`), 8px of
 * clearance (`UNDER_ROW_PAD`) and a 22px reaction button — 30, rounded to 32.
 * Both are counter-scaled, so in WORLD units they are these divided by the
 * zoom: at 15% the name strip is 160 world units tall, which is exactly how a
 * 40-unit lattice gutter let a title land on a neighbour's name.
 */
export const ITEM_CHROME = { above: 24, below: 32 } as const;

/** World units of chrome above and below one item. */
interface ItemChrome {
  above: number;
  below: number;
}

/**
 * **An item's chrome in world units at a zoom.** Group frames draw their name
 * inside their own header and annotations wear nothing (they ride on their
 * target), so both are zero; every other item — text nodes included, which
 * show their name on hover and selection like anything else — carries the
 * strip above and the row below. `scale` defaults to 1, which is what a
 * surface with no zoom (the CLI) uses.
 */
export function itemChrome(item: Item, scale = 1): ItemChrome {
  if (item.properties.kind === "group" || annotationTarget(item)) return { above: 0, below: 0 };
  const s = scale > 0 && Number.isFinite(scale) ? scale : 1;
  return { above: ITEM_CHROME.above / s, below: ITEM_CHROME.below / s };
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One thing a tidy may move: its box (what lines up) and its footprint
 * (what must not overlap — the box plus chrome plus anything that rides on it). */
export interface TidyUnit {
  id: string;
  box: Rect;
  footprint: Rect;
}

/** How a tidy is tuned. Every field is optional. */
interface TidyOptions {
  /** Footprints that do not move but must not be run into — the unselected
   * neighbours. One already touching a unit before the tidy is left alone. */
  obstacles?: readonly Rect[];
  /** The smallest snap distance in world units, whatever the sizes say. The
   * app passes a few screen pixels at the current zoom, so "nearly lined up"
   * means what it looks like. */
  tolerance?: number;
}

type Axis = "x" | "y";
const size = (axis: Axis): "width" | "height" => (axis === "x" ? "width" : "height");
const other = (axis: Axis): Axis => (axis === "x" ? "y" : "x");

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function touching(a: Rect, b: Rect, clearance: number): boolean {
  return a.x < b.x + b.width + clearance && b.x < a.x + a.width + clearance &&
    a.y < b.y + b.height + clearance && b.y < a.y + a.height + clearance;
}

/** Did `a` sit wholly before `b` along `axis` (left of it, or above it)? */
function before(a: Rect, b: Rect, axis: Axis): boolean {
  return a[axis] + a[size(axis)] <= b[axis];
}

/** Do the two spans overlap across `axis` — i.e. are they in one row (for x)
 * or one column (for y)? */
function sideBySide(a: Rect, b: Rect, axis: Axis): boolean {
  const o = other(axis);
  return a[o] < b[o] + b[size(o)] && b[o] < a[o] + a[size(o)];
}

/** How two boxes sit: which is before which on each axis, and whether they
 * share a row or a column. A tidy may straighten; it may not change this. */
function relation(a: Rect, b: Rect): string {
  return `${before(a, b, "x") ? "<" : before(b, a, "x") ? ">" : "="}${before(a, b, "y") ? "<" : before(b, a, "y") ? ">" : "="}${sideBySide(a, b, "x") ? "r" : ""}${sideBySide(a, b, "y") ? "c" : ""}`;
}

/** Did the relation lose something — a shared row or column, or an order? */
function loses(was: string, now: string): boolean {
  const flipped = (i: number) => (was[i] === "<" && now[i] === ">") || (was[i] === ">" && now[i] === "<");
  return flipped(0) || flipped(1) || (was.includes("r") && !now.includes("r")) || (was.includes("c") && !now.includes("c"));
}

/**
 * The tidy itself, on units: where each one's box should go. Returns a new
 * top-left for every unit (moved or not), keyed by id. See the file comment
 * for the three rules and their order.
 */
export function tidyInPlace(units: readonly TidyUnit[], options: TidyOptions = {}): Map<string, { x: number; y: number }> {
  const delta = new Map(units.map((u) => [u.id, { x: 0, y: 0 }]));
  const boxOf = (u: TidyUnit): Rect => ({ ...u.box, x: u.box.x + delta.get(u.id)!.x, y: u.box.y + delta.get(u.id)!.y });
  const footOf = (u: TidyUnit): Rect => ({ ...u.footprint, x: u.footprint.x + delta.get(u.id)!.x, y: u.footprint.y + delta.get(u.id)!.y });
  const result = (): Map<string, { x: number; y: number }> =>
    new Map(units.map((u) => [u.id, { x: Math.round(boxOf(u).x), y: Math.round(boxOf(u).y) }]));
  if (units.length < 2) return result();
  const obstacles = options.obstacles ?? [];
  // Would this unit, where it is now, crowd a footprint it did not crowd
  // before? A snap or a gap that would is not taken: the tidy moves things
  // as little as possible, and clearing an overlap it made is not little.
  const crowds = (was: Rect, now: Rect, them: Rect, themNow: Rect): boolean =>
    [PLACEMENT_CLEARANCE, 0].some((room) => !touching(was, them, room) && touching(now, themNow, room));
  const clashes = (u: TidyUnit): boolean =>
    units.some((o) => o !== u && crowds(u.footprint, footOf(u), o.footprint, footOf(o))) ||
    obstacles.some((o) => crowds(u.footprint, footOf(u), o, o));

  // How near is "nearly": a fraction of the typical size on that axis, never
  // under a few units, and never more than a quarter of the item being moved
  // (so a small card is not hauled its own width onto somebody else's line).
  const tolerance = (axis: Axis): number =>
    Math.max(options.tolerance ?? 0, 16, Math.min(240, 0.08 * median(units.map((u) => u.box[size(axis)]))));
  const aligned: Record<Axis, Set<string>> = { x: new Set(), y: new Set() };

  // 1. Snap. Rows first (y), then columns (x); on each axis the start edge,
  //    then the end edge, then the centre — the first line an item joins wins.
  for (const axis of ["y", "x"] as const) {
    const tol = tolerance(axis);
    const fixed = new Set<string>();
    for (const anchor of [0, 1, 0.5]) {
      const at = (u: TidyUnit): number => boxOf(u)[axis] + anchor * u.box[size(axis)];
      const sorted = [...units].sort((a, b) => at(a) - at(b) || a.id.localeCompare(b.id));
      let i = 0;
      while (i < sorted.length) {
        let j = i + 1;
        while (j < sorted.length && at(sorted[j]!) - at(sorted[i]!) <= tol) j++;
        const cluster = sorted.slice(i, j);
        i = j;
        if (cluster.length < 2) continue;
        const held = cluster.filter((u) => fixed.has(u.id));
        // Snap every member it can onto `target`; say who joined, and undo
        // it all when `keep` is false. A member whose snap would crowd a
        // neighbour or break the arrangement stays where it is.
        const snapTo = (target: number, keep: boolean): TidyUnit[] => {
          const moved = new Map<TidyUnit, number>();
          for (const u of cluster) {
            if (fixed.has(u.id) || Math.abs(at(u) - target) > Math.min(tol, 0.25 * u.box[size(axis)])) continue;
            const was = units.map((o) => relation(u.box, o.box));
            // Whole units, so what was checked is what lands.
            const shift = Math.round(target - at(u));
            delta.get(u.id)![axis] += shift;
            // A snap may bring a near-row into a row; it may not take an item
            // out of a row or column it shared, or past a neighbour.
            if (clashes(u) || units.some((o, k) => o !== u && loses(was[k]!, relation(boxOf(u), boxOf(o))))) delta.get(u.id)![axis] -= shift;
            else moved.set(u, shift);
          }
          const line = [...held.filter((u) => Math.abs(at(u) - target) < 0.5), ...moved.keys()];
          if (!keep || line.length < 2) for (const [u, shift] of moved) delta.get(u.id)![axis] -= shift;
          return line;
        };
        // Where the line goes: onto an item already on a line if there is
        // one, else the middle of the cluster — or, when somebody cannot get
        // there, onto one of the members itself, whichever lines up most.
        const middle = median((held.length ? held : cluster).map(at));
        const targets = [...new Set([...(held.length ? [] : [Math.round(middle)]), ...(held.length ? held : cluster).map((u) => Math.round(at(u)))])]
          .sort((p, q) => Math.abs(p - middle) - Math.abs(q - middle));
        let best: { target: number; count: number } | null = null;
        for (const target of targets) {
          const count = snapTo(target, false).length;
          if (count >= 2 && (!best || count > best.count)) best = { target, count };
        }
        if (!best) continue;
        for (const u of snapTo(best.target, true)) {
          fixed.add(u.id);
          aligned[axis].add(u.id);
        }
      }
    }
  }

  // 2. Even nearly-equal gaps. Each unit's neighbour is the nearest one wholly
  //    before it on the axis and side by side with it; gaps that cluster
  //    become their median, walked in order so a row moves as a row.
  for (const axis of ["x", "y"] as const) {
    const gapTol = (gaps: number[]): number => Math.max(8, tolerance(axis) / 2, 0.25 * median(gaps));
    const pairs: Array<{ a: TidyUnit; b: TidyUnit; gap: number }> = [];
    for (const b of units) {
      const fb = footOf(b);
      let best: TidyUnit | null = null;
      for (const a of units) {
        if (a === b) continue;
        const fa = footOf(a);
        if (!before(fa, fb, axis) || !sideBySide(fa, fb, axis)) continue;
        if (!best || fa[axis] + fa[size(axis)] > footOf(best)[axis] + footOf(best)[size(axis)]) best = a;
      }
      if (best) {
        const fa = footOf(best);
        pairs.push({ a: best, b, gap: fb[axis] - (fa[axis] + fa[size(axis)]) });
      }
    }
    const byGap = [...pairs].sort((p, q) => p.gap - q.gap);
    const target = new Map<TidyUnit, number>();
    let i = 0;
    while (i < byGap.length) {
      let j = i + 1;
      while (j < byGap.length && byGap[j]!.gap - byGap[i]!.gap <= gapTol(byGap.slice(i, j + 1).map((p) => p.gap))) j++;
      const cluster = byGap.slice(i, j);
      const even = Math.max(PLACEMENT_CLEARANCE, Math.round(median(cluster.map((p) => p.gap))));
      for (const p of cluster) target.set(p.b, cluster.length > 1 ? even : p.gap);
      i = j;
    }
    const ordered = [...pairs].sort((p, q) => footOf(p.b)[axis] - footOf(q.b)[axis] || p.b.id.localeCompare(q.b.id));
    for (const { a, b } of ordered) {
      // A unit on a shared line stays on it: alignment outranks a gap.
      if (aligned[axis].has(b.id)) continue;
      const fa = footOf(a);
      const want = fa[axis] + fa[size(axis)] + target.get(b)!;
      const was = units.map((u) => relation(boxOf(b), boxOf(u)));
      const shift = Math.round(want - footOf(b)[axis]);
      delta.get(b.id)![axis] += shift;
      // And a gap never costs the arrangement: if evening it would take the
      // unit out of a row or column it shared, or past a neighbour, it stays.
      if (clashes(b) || units.some((u, i) => u !== b && (relation(boxOf(b), boxOf(u)) !== was[i] || loses(relation(b.box, u.box), relation(boxOf(b), boxOf(u)))))) delta.get(b.id)![axis] -= shift;
    }
  }

  // 3. Clear overlaps. A pair whose footprints already touched before the
  //    tidy is somebody's deliberate stacking (or chrome the person already
  //    lives with), and is left as it was — but never made into a box overlap
  //    it was not. Everything else ends clear, in reading order, pushed the
  //    way it already sat.
  const original = new Map(units.map((u) => [u.id, { box: u.box, foot: u.footprint }]));
  // Reading order, row-major: units sharing a row (by their original boxes,
  // transitively) read left to right, and rows read top to bottom — so a
  // push goes down or right, never back across a row.
  const rowOf = new Map<string, number>();
  const byTop = [...units].sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || a.id.localeCompare(b.id));
  let rowBottom = -Infinity;
  let rowIndex = -1;
  for (const u of byTop) {
    if (u.box.y >= rowBottom) rowIndex++;
    rowBottom = u.box.y >= rowBottom ? u.box.y + u.box.height : Math.max(rowBottom, u.box.y + u.box.height);
    rowOf.set(u.id, rowIndex);
  }
  const reading = [...units].sort((a, b) => rowOf.get(a.id)! - rowOf.get(b.id)! || a.box.x - b.box.x || a.box.y - b.box.y || a.id.localeCompare(b.id));
  const placed: TidyUnit[] = [];
  const blockerOf = (u: TidyUnit): { foot: Rect; was: { box: Rect; foot: Rect } } | null => {
    const mine = original.get(u.id)!;
    for (const p of placed) {
      const was = original.get(p.id)!;
      const exempt = touching(mine.foot, was.foot, 0);
      if (exempt ? !touching(mine.box, was.box, 0) && touching(boxOf(u), boxOf(p), 0) : touching(footOf(u), footOf(p), PLACEMENT_CLEARANCE)) {
        return { foot: exempt ? boxOf(p) : footOf(p), was };
      }
    }
    for (const o of obstacles) {
      if (touching(mine.foot, o, 0)) continue;
      if (touching(footOf(u), o, PLACEMENT_CLEARANCE)) return { foot: o, was: { box: o, foot: o } };
    }
    return null;
  };
  for (const u of reading) {
    for (let guard = 0; guard < 4 * (units.length + obstacles.length) + 4; guard++) {
      const hit = blockerOf(u);
      if (!hit) break;
      const mine = original.get(u.id)!;
      const f = footOf(u);
      const down = Math.ceil(hit.foot.y + hit.foot.height + PLACEMENT_CLEARANCE - f.y);
      const right = Math.ceil(hit.foot.x + hit.foot.width + PLACEMENT_CLEARANCE - f.x);
      const up = Math.ceil(f.y + f.height + PLACEMENT_CLEARANCE - hit.foot.y);
      const left = Math.ceil(f.x + f.width + PLACEMENT_CLEARANCE - hit.foot.x);
      // The way it already sat decides the way it goes; a diagonal neighbour
      // takes the shorter way.
      const wasBelow = before(hit.was.foot, mine.foot, "y");
      const wasRight = before(hit.was.foot, mine.foot, "x");
      const wasAbove = before(mine.foot, hit.was.foot, "y");
      const wasLeft = before(mine.foot, hit.was.foot, "x");
      const d = delta.get(u.id)!;
      if (wasBelow && (!wasRight || down <= right)) d.y += down;
      else if (wasRight) d.x += right;
      else if (wasAbove && (!wasLeft || up <= left)) d.y -= up;
      else if (wasLeft) d.x -= left;
      else if (down <= right) d.y += down;
      else d.x += right;
    }
    placed.push(u);
  }
  return result();
}

/**
 * **Tidy these items where they are** — the moves for the default Tidy on a
 * selection, on a canvas without groups. Annotations are not units: a mark on
 * a selected item widens that item's footprint and travels with it. `chrome`
 * says how much the canvas draws around each item in world units; the app
 * passes the current zoom's, the CLI the 1:1 default. Unselected items are
 * obstacles. Fewer than two units moves nothing.
 */
export function tidyMoves(
  canvas: CanvasContents,
  itemIds: readonly string[],
  options: { chrome?: (item: Item) => ItemChrome; tolerance?: number } = {},
): Move[] {
  const chrome = options.chrome ?? ((item: Item) => itemChrome(item));
  const picked = new Set(itemIds.filter((id) => canvas.items[id]));
  const marksOn = (id: string): Item[] => Object.values(canvas.items).filter((one) => annotationTarget(one) === id);
  const units: TidyUnit[] = [];
  for (const id of picked) {
    const item = canvas.items[id]!;
    const target = annotationTarget(item);
    if (target && canvas.items[target]) continue;
    const c = chrome(item);
    const box = { x: item.x, y: item.y, width: item.width, height: item.height };
    const rects = [{ ...box, y: box.y - c.above, height: box.height + c.above + c.below }, ...marksOn(id)];
    const x = Math.min(...rects.map((r) => r.x));
    const y = Math.min(...rects.map((r) => r.y));
    const footprint = { x, y, width: Math.max(...rects.map((r) => r.x + r.width)) - x, height: Math.max(...rects.map((r) => r.y + r.height)) - y };
    units.push({ id, box, footprint });
  }
  if (units.length < 2) return [];
  const moving = new Set(units.map((u) => u.id));
  const obstacles = Object.values(canvas.items)
    .filter((one) => !moving.has(one.id) && !(annotationTarget(one) && moving.has(annotationTarget(one)!)))
    .map((one) => {
      const c = chrome(one);
      return { x: one.x, y: one.y - c.above, width: one.width, height: one.height + c.above + c.below };
    });
  const at = tidyInPlace(units, { obstacles, ...(options.tolerance !== undefined ? { tolerance: options.tolerance } : {}) });
  const moves: Move[] = [];
  for (const u of units) {
    const to = at.get(u.id)!;
    const dx = to.x - u.box.x;
    const dy = to.y - u.box.y;
    if (dx === 0 && dy === 0) continue;
    moves.push({ itemId: u.id, x: to.x, y: to.y });
    for (const mark of marksOn(u.id)) moves.push({ itemId: mark.id, x: mark.x + dx, y: mark.y + dy });
  }
  return moves;
}
