/**
 * **A submenu forgives a diagonal** (1 Oct 2026).
 *
 * Dion's report: right-click, hover Style, move right — and the submenu hid
 * on the way, because the shortest path to it crosses the row below, and that
 * row took the hover. The fix is the one menus have used since Amazon's mega
 * dropdown made it famous: while a submenu is open, a pointer heading INTO it
 * — inside the triangle from where it was a moment ago to the submenu's near
 * corners — does not hand the menu to the rows it crosses. Stop inside the
 * triangle and it was not heading there after all: normal hover resumes.
 *
 * Pure, and kept out of the component, so the geometry and the timing are
 * tested without a layout. Only `ContextMenu` imports it, and that arrives on
 * the first right-click, so none of this is in a first visit.
 */

interface Pt { x: number; y: number }
type Rect = Pick<DOMRect, "left" | "right" | "top" | "bottom">;

/** Sweeping DOWN a menu should not flash every submenu it passes. */
export const OPEN_DELAY = 100;
/** A pointer that overshoots the pair gets back before the children are gone. */
export const CLOSE_GRACE = 300;
/** Still inside the triangle this long, and the pointer was not going there. */
export const AIM_PAUSE = 300;

/**
 * Whether the move `from → at` heads into `panel`: `at` lies in the triangle
 * whose apex is `from` and whose base is the panel's near edge, `tol` px
 * forgiving on every side. A move with no horizontal progress toward the
 * panel is never aim — straight down the menu is choosing another row.
 */
export function aimsAt(from: Pt, at: Pt, panel: Rect, tol = 4): boolean {
  const right = from.x <= panel.left;
  if (!right && from.x < panel.right) return false;
  const x = right ? panel.left : panel.right;
  if (right ? at.x <= from.x : at.x >= from.x) return false;
  const corners: Pt[] = [from, { x, y: panel.top - tol }, { x, y: panel.bottom + tol }];
  // Inside a triangle is "on the same side of all three edges"; each edge is
  // allowed `tol` px of the wrong side, measured as a distance.
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const a = corners[i]!, b = corners[(i + 1) % 3]!;
    const cross = (b.x - a.x) * (at.y - a.y) - (b.y - a.y) * (at.x - a.x);
    const side = cross / Math.hypot(b.x - a.x, b.y - a.y);
    if (Math.abs(side) <= tol) continue;
    if (sign && Math.sign(side) !== sign) return false;
    sign = Math.sign(side);
  }
  return true;
}

/**
 * The hover decision for one menu: which submenu (by row label) is shown.
 * `want` is what the pointer is over now (`null`: a plain row, or nowhere);
 * `move` feeds the trail; `set` is a click or a key, which never waits.
 * `panel` reads the open submenu's rect, `show` commits.
 */
export function menuAim(show: (row: string | null) => void, panel: () => Rect | undefined) {
  let shown: string | null = null, wanted: string | null = null, timer: ReturnType<typeof setTimeout> | undefined;
  const trail: Pt[] = [];
  const aiming = () => {
    const rect = panel();
    return !!rect && trail.length > 1 && aimsAt(trail[0]!, trail[trail.length - 1]!, rect);
  };
  const set = (row: string | null) => { clearTimeout(timer); wanted = shown = row; show(row); };
  const wait = (ms: number) => { clearTimeout(timer); timer = setTimeout(() => set(wanted), ms); };
  return {
    set,
    want(row: string | null) {
      wanted = row;
      if (row === shown) clearTimeout(timer);
      else wait(aiming() ? AIM_PAUSE : row ? OPEN_DELAY : CLOSE_GRACE);
    },
    /** True while a crossed row is being held off — the menu says so, so the
     *  row under the pointer does not light up as if it had been chosen. */
    move(at: Pt): boolean {
      trail.push(at);
      if (trail.length > 4) trail.shift();
      const held = wanted !== shown && aiming();
      if (held) wait(AIM_PAUSE);
      return held;
    },
    stop: () => clearTimeout(timer),
  };
}
