/**
 * The edge radar: beacons around the rim of the screen for items that have
 * panned out of sight, each pointing the way to what it names.
 *
 * A canvas that goes on forever will lose your work behind the edge of the
 * window; the minimap answers "where is everything" and this answers "what did
 * I just walk away from, and how do I get back". Pure geometry lives here —
 * the component only paints what this returns.
 *
 * Everything is SCREEN space unless a name says world.
 */

export interface Viewport {
  tx: number;
  ty: number;
  scale: number;
}

export interface RadarItem {
  id: string;
  title: string;
  /** World box. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Used to pick which member of a cluster gets to wear the label. */
  updatedAt?: string;
}

/** Room to keep clear of the window's furniture: the top bar, the tool rail,
 * the zoom controls, the minimap, and the main-thread panel when it is open. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** One item a beacon speaks for, with its own reading. */
interface BeaconMember {
  item: RadarItem;
  /** World-space distance from the middle of the screen. */
  distance: number;
  /** Degrees from the middle of the screen toward this item. */
  angle: number;
}

export interface Beacon {
  /** Screen position, docked on the padded boundary. */
  x: number;
  y: number;
  /** Which wall it docked to. The beacon has to sit INSIDE that wall — a pill
   * centered on the boundary hangs half of itself off the screen. */
  side: "left" | "right" | "top" | "bottom";
  /** Degrees, pointing from the middle of the screen toward the item. */
  angle: number;
  /** The item that wears the label: the most recently touched of the group. */
  primary: RadarItem;
  /** Everything this beacon speaks for, primary included, NEAREST FIRST —
   * a hover card lists them, so the order is the reading order. */
  members: BeaconMember[];
  /** World-space distance from the middle of the screen to the primary. */
  distance: number;
  /**
   * How much of the wall the beacon covers, in screen pixels along that wall
   * (y for a left/right wall, x for top/bottom): the item's own size and
   * position, projected onto the edge. A tall thing out there reads as a tall
   * bar, so the rim shows you the SHAPE of what is off screen, not just that
   * something is.
   */
  span: { from: number; to: number };
}

/** Beacons closer together than this along the rim become one. */
const CLUSTER_RADIUS = 56;

/** A beacon never gets shorter than this, however small or far its item —
 * the bar has to stay something you can see and point at. */
export const MIN_SPAN = 28;

/** The screen box an item occupies right now. */
function screenBox(item: RadarItem, viewport: Viewport) {
  const left = item.x * viewport.scale + viewport.tx;
  const top = item.y * viewport.scale + viewport.ty;
  return {
    left,
    top,
    right: left + item.width * viewport.scale,
    bottom: top + item.height * viewport.scale,
  };
}

/**
 * Beacons for everything entirely out of sight. Note "entirely": an item with
 * a corner still on screen is already telling you where it is, and a beacon
 * for it would be a second, contradictory answer.
 */
export function edgeBeacons(
  items: readonly RadarItem[],
  viewport: Viewport,
  width: number,
  height: number,
  insets: Insets,
  clusterRadius = CLUSTER_RADIUS,
): Beacon[] {
  const cx = width / 2;
  const cy = height / 2;
  const minX = insets.left;
  const maxX = width - insets.right;
  const minY = insets.top;
  const maxY = height - insets.bottom;
  if (maxX <= minX || maxY <= minY) return [];

  const docked: Beacon[] = [];
  for (const item of items) {
    const box = screenBox(item, viewport);
    const offscreen = box.right <= 0 || box.left >= width || box.bottom <= 0 || box.top >= height;
    if (!offscreen) continue;

    const dx = (box.left + box.right) / 2 - cx;
    const dy = (box.top + box.bottom) / 2 - cy;
    if (dx === 0 && dy === 0) continue; // cannot be offscreen and dead center

    // Ray from the middle of the screen to the item, clipped to the padded
    // boundary: whichever wall it reaches first is the one it docks to.
    const tx = dx > 0 ? (maxX - cx) / dx : dx < 0 ? (minX - cx) / dx : Infinity;
    const ty = dy > 0 ? (maxY - cy) / dy : dy < 0 ? (minY - cy) / dy : Infinity;
    const t = Math.min(tx, ty);
    const side = tx <= ty ? (dx > 0 ? "right" : "left") : dy > 0 ? "bottom" : "top";

    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const distance = Math.round(Math.hypot(dx, dy) / viewport.scale);
    // The item's extent along the wall it docked to, clipped to the stretch of
    // wall the beacons are allowed to use.
    const vertical = side === "left" || side === "right";
    const span = clampSpan(
      vertical ? { from: box.top, to: box.bottom } : { from: box.left, to: box.right },
      vertical ? minY : minX,
      vertical ? maxY : maxX,
    );
    docked.push({
      x: cx + t * dx,
      y: cy + t * dy,
      side,
      angle,
      primary: item,
      members: [{ item, distance, angle }],
      distance,
      span,
    });
  }

  return cluster(docked, clusterRadius);
}

/**
 * Fold beacons that landed on top of each other into one. Walking the rim in
 * order means a cluster is a run of neighbours, not an arbitrary grouping, so
 * the badge always covers a contiguous stretch of edge.
 */
function cluster(beacons: Beacon[], radius: number): Beacon[] {
  if (beacons.length <= 1) return beacons;
  const byPosition = [...beacons].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const out: Beacon[] = [];
  for (const beacon of byPosition) {
    const last = out[out.length - 1];
    // Same wall only: a bar that spanned two walls would be a bar about
    // nothing, and a corner is exactly where that would happen.
    if (
      last &&
      last.side === beacon.side &&
      Math.hypot(beacon.x - last.x, beacon.y - last.y) <= radius
    ) {
      last.members.push(...beacon.members);
      last.span = {
        from: Math.min(last.span.from, beacon.span.from),
        to: Math.max(last.span.to, beacon.span.to),
      };
      // The label goes to the most recently touched member, and the arrow with
      // it: an indicator should point at the thing it names.
      if (newer(beacon.primary, last.primary)) {
        last.primary = beacon.primary;
        last.x = beacon.x;
        last.y = beacon.y;
        last.side = beacon.side;
        last.angle = beacon.angle;
        last.distance = beacon.distance;
      }
      continue;
    }
    out.push({ ...beacon, members: [...beacon.members] });
  }
  // Nearest first: a card reads as "here is what is that way, closest first".
  for (const beacon of out) beacon.members.sort((a, b) => a.distance - b.distance);
  return out;
}

/** Clip a span to the usable wall, keeping it at least MIN_SPAN long — an
 * item mostly past the corner still deserves a bar you can hit. */
function clampSpan(
  span: { from: number; to: number },
  low: number,
  high: number,
): { from: number; to: number } {
  const room = high - low;
  if (room <= 0) return { from: low, to: low };
  const wanted = Math.min(Math.max(span.to - span.from, MIN_SPAN), room);
  const middle = Math.min(Math.max((span.from + span.to) / 2, low + wanted / 2), high - wanted / 2);
  return { from: middle - wanted / 2, to: middle + wanted / 2 };
}

function newer(candidate: RadarItem, current: RadarItem): boolean {
  if (!candidate.updatedAt) return false;
  if (!current.updatedAt) return true;
  return candidate.updatedAt > current.updatedAt;
}

/** "1,400px away" — the distance as a person reads it. */
export function formatDistance(distance: number): string {
  return `${distance.toLocaleString("en-US")}px away`;
}
