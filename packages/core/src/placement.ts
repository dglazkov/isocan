import type { CanvasContents } from "./model.ts";
import type { Operation } from "./ops.ts";
import { DRAWING_MIME } from "./drawing.ts";
import { ANNOTATES_PROP } from "./annotation.ts";
import { TEXT_KIND } from "./textnode.ts";
import type { Box } from "./annotation.ts";
import type { Placement } from "./ops.ts";
import { OpValidationError } from "./errors.ts";

/** Gap between a new item and its anchor, and the step the search moves in. */
export const PLACEMENT_GAP = 40;

/**
 * How close two items may sit before they count as on top of each other.
 * Not zero: items a pixel apart are technically not overlapping and read as a
 * mistake anyway.
 */
export const PLACEMENT_CLEARANCE = 12;

/** How far the search will look before giving up and going round the side. */
const MAX_RINGS = 14;

/**
 * **Where a thread anchored to an item lands** — just off its TOP-RIGHT
 * corner, as an offset from the item's origin.
 *
 * In core because both surfaces must agree, and until this existed they did
 * not: `⇧C` in the app anchored at `{0, 0}` under a comment claiming "where a
 * thread anchored by the CLI lands too, so both surfaces agree", while
 * `isocan comment add --item` had always used `{width + 12, 0}` — the same
 * corner, but a nudge past it in WORLD units, which is a different number of
 * screen pixels at every zoom. One function now, called by both, and the
 * corner ITSELF: a corner is the same place at every zoom, and the pin's own
 * clearance is screen-measured where it belongs (`PIN_NUDGE` in the app).
 *
 * Not the top-left, which is the NAME's end of that edge — a pin's body sits
 * above its point, so a thread anchored at the origin covered the item's own
 * title with the conversation about it. Not the bottom-left either, which was
 * the first move away from the title and looked wrong for a reason worth
 * writing down: the bottom-left is where the item's MARKS live, and a pin
 * hanging under them turned one corner into a stack of two unlike things —
 * a mark is a reaction worn on the item, a thread is a conversation about it.
 * They read as one pile.
 *
 * So the ends divide by kind rather than by ownership: the item's own facts
 * live on the top edge (name at the left, version count at the right), what
 * people *wore* on it sits under the bottom-left, and what people *said*
 * about it hangs off the top-right corner, outside the item, where it covers
 * neither the title nor the content nor the marks.
 */
export function anchorOffset(item: { width: number; height: number }): {
  x: number;
  y: number;
} {
  return { x: item.width, y: 0 };
}

/** Anything already taking up room — an item, or one just placed this pass. */
export type Placed = Box;

const overlaps = (a: Box, b: Box, pad: number): boolean =>
  a.x < b.x + b.width + pad &&
  b.x < a.x + a.width + pad &&
  a.y < b.y + b.height + pad &&
  b.y < a.y + a.height + pad;

/**
 * Where a new item can sit without landing on anything.
 *
 * Deliberately a REQUEST, not an instruction: the spot asked for is honoured
 * exactly whenever it is free, and only a collision moves it. So `--at 0,0`
 * onto empty canvas still lands at 0,0, and dropping six files no longer
 * builds a pile.
 *
 * The search walks outward on a lattice of the item's own size plus the gap,
 * so displaced items line up with each other instead of scattering, and takes
 * the nearest free cell — with ties broken in reading order, right before
 * down before left before up, because a canvas is read like a page.
 *
 * Deterministic given canvas state, which is what lets it run inside the
 * reducer. It is also what makes a batch work: each `item.add` is applied in
 * turn, so the second file's search already sees the first one land.
 */
export function nearestFreeSpot(want: Box, occupied: Placed[]): { x: number; y: number } {
  const clear = (box: Box) => !occupied.some((item) => overlaps(box, item, PLACEMENT_CLEARANCE));
  if (clear(want)) return { x: want.x, y: want.y };

  const stepX = want.width + PLACEMENT_GAP;
  const stepY = want.height + PLACEMENT_GAP;
  // Reading order, so a tie goes to the right of the thing it collided with.
  const order = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const;

  for (let ring = 1; ring <= MAX_RINGS; ring++) {
    const cells: { dx: number; dy: number }[] = [];
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) cells.push({ dx, dy });
      }
    }
    cells.sort((a, b) => {
      const da = a.dx * a.dx + a.dy * a.dy;
      const db = b.dx * b.dx + b.dy * b.dy;
      if (da !== db) return da - db;
      const rank = (c: { dx: number; dy: number }) =>
        order.findIndex(([ox, oy]) => Math.sign(c.dx) === ox && Math.sign(c.dy) === oy);
      return rank(a) - rank(b);
    });
    for (const { dx, dy } of cells) {
      const box = { ...want, x: want.x + dx * stepX, y: want.y + dy * stepY };
      if (clear(box)) return { x: box.x, y: box.y };
    }
  }

  // A canvas dense enough to defeat the search still gets a real answer:
  // past the right edge of everything, level with where it was asked for.
  const right = Math.max(...occupied.map((i) => i.x + i.width));
  return { x: right + PLACEMENT_GAP, y: want.y };
}

/**
 * Resolve a placement to concrete world coordinates. Anchored placement puts
 * the new item neatly to the LEFT of the anchor, top-aligned; either form is
 * then nudged clear of anything already there.
 *
 * `exact` is the escape hatch for a position that MEANS something — ink lands
 * where the pen drew it, and an annotation sits over what it annotates, so
 * neither may be tidied away from the thing that gives it its meaning.
 */
export function resolvePlacement(
  canvas: CanvasContents,
  placement: Placement,
  width: number,
  height = 0,
  exact = false,
): { x: number; y: number } {
  let want: { x: number; y: number };
  if ("anchorItemId" in placement) {
    const anchor = canvas.items[placement.anchorItemId];
    if (!anchor) {
      throw new OpValidationError(
        "unknown-anchor",
        `anchor item not found: ${placement.anchorItemId}`,
      );
    }
    want = { x: anchor.x - PLACEMENT_GAP - width, y: anchor.y };
  } else {
    want = { x: placement.x, y: placement.y };
  }

  const occupied = Object.values(canvas.items);
  if (exact || height <= 0 || width <= 0 || occupied.length === 0) return want;
  return nearestFreeSpot({ ...want, width, height }, occupied);
}

/**
 * Whether this item's position MEANS something, and must not be tidied.
 *
 * Two ways a position can mean something. By what the item IS: ink is where
 * the pen drew it, and an annotation sits over the thing it is about — both
 * inherent, so they hold for every op ever logged. And by how it was PLACED:
 * `placement.chosen` says a person pointed at this spot — a click, a drop at
 * the pointer, `--at` — and "commit this here" has to mean here. That rule
 * was first written for text nodes by kind, after words typed touching a
 * note landed somewhere else; it is the gesture that carries the meaning,
 * not the kind, so a dropped file or a paste at the pointer stays put the
 * same way, and a text node placed by anchor (the CLI's default) is still
 * tidied because nobody chose those coordinates. The kind rule for text
 * stays for logs written between the two, which replay the same either way.
 *
 * Lives here, beside the rule it exempts, because two callers need the
 * same answer: the daemon, which resolves the final position before logging,
 * and the reducer, which must reach the same place when the log is replayed.
 * Two implementations of this predicate is two canvases.
 */
export function positionIsMeaningful(op: Extract<Operation, { type: "item.add" }>): boolean {
  if (op.version.mimeType === DRAWING_MIME) return true;
  if (op.properties?.[ANNOTATES_PROP] !== undefined) return true;
  if (!("x" in op.placement)) return false;
  return op.placement.chosen === true || op.properties?.kind === TEXT_KIND;
}
