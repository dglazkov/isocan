/**
 * **A drag in progress, as the people watching it are told** (groups-by-hand
 * phase 3, docs/research/2026-10-01-groups-stacks-lift.md §4).
 *
 * Rides the presence beat beside the cursor, only while a press has become a
 * drag, and is gone from the next beat after the hand lets go. Presence is
 * latest-state-per-session and never written down, so this is never an op,
 * never in the log, never in undo — and a viewer who arrives late is handed
 * where the drag IS, never where it was.
 */
export interface PresenceDrag {
  /** One id per drag, so a viewer can tell a new drag from the same one. */
  gesture: string;
  /**
   * The selection ROOTS, not the closure: dragging a group of 200 sends one
   * id, and a viewer expands members and marks from its own copy. Past
   * `LIVE_DRAG_MAX_ROOTS` it is the first root alone, and `box` stands in for
   * the rest.
   */
  roots: string[];
  /** Where the first root stood when the drag began. A viewer draws the drag
   * only while that item is still there: the moment the real move lands — or
   * somebody else's — the item has left `from` and the ghost goes, whichever
   * order the two messages arrived in. */
  from: { x: number; y: number };
  /** The offset the mover SEES — snapped, so every screen shows one spot. */
  dx: number;
  dy: number;
  /** The drop target the mover's pill names: a group, `null` for the open
   * canvas (a ⌘-drag out), absent when the drop keeps every parent. */
  into?: string | null | undefined;
  /** A big selection's bounding box at the start, drawn as one lifted outline
   * instead of hundreds of moving cards. */
  box?: { x: number; y: number; width: number; height: number };
}

/** Past this many roots a drag is sent as a box (research §4, "will it scale"). */
export const LIVE_DRAG_MAX_ROOTS = 50;

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const point = (p: unknown): p is { x: number; y: number } =>
  !!p && typeof p === "object" && finite((p as { x?: unknown }).x) && finite((p as { y?: unknown }).y);
const id = (s: unknown): s is string => typeof s === "string" && s.length > 0 && s.length <= 64;

/**
 * A client's word for its drag, kept only when it is one. Presence is
 * client-asserted, so this is shape, not trust: a malformed field is dropped
 * (no drag) rather than relayed to every screen on the canvas.
 */
export function presenceDrag(value: unknown): PresenceDrag | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!id(v.gesture) || !point(v.from) || !finite(v.dx) || !finite(v.dy)) return null;
  if (!Array.isArray(v.roots) || v.roots.length === 0 || v.roots.length > LIVE_DRAG_MAX_ROOTS || !v.roots.every(id)) return null;
  const box = v.box as Record<string, unknown> | undefined;
  const w = box?.width, h = box?.height;
  const boxed = point(box) && finite(w) && finite(h) && w >= 0 && h >= 0;
  if (box !== undefined && !boxed) return null;
  if (v.into !== undefined && v.into !== null && !id(v.into)) return null;
  return {
    gesture: v.gesture,
    roots: [...v.roots] as string[],
    from: { x: v.from.x, y: v.from.y },
    dx: v.dx,
    dy: v.dy,
    ...(v.into !== undefined ? { into: v.into as string | null } : {}),
    ...(boxed ? { box: { x: box.x, y: box.y, width: w as number, height: h as number } } : {}),
  };
}
