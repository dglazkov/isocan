/**
 * **Still is always there** (living grounds, design.md §5).
 *
 * A living ground is drawn by WebGL2 when it can be and should be, and by its
 * painted still frame otherwise — the same JPEG-on-a-tile mechanism as the
 * four painted grounds, so a viewer who gets the still is standing on the same
 * field, just not a moving one. The reasons are listed in one place so the
 * layer, the host and the tests cannot hold three different ideas of them.
 */

/** How a living ground is drawn: by WebGL2, or as its painted still. */
type GroundMode = "living" | "still";

/** Everything that decides `groundMode` — what the viewer asked for and what
 *  the browser could do. */
interface GroundConditions {
  /** `prefers-reduced-motion: reduce`. Decided before the WebGL chunk is
   *  even fetched — a viewer who asked for no motion downloads none of it. */
  reducedMotion: boolean;
  /** Did `getContext("webgl2")` hand back a context? `null` = not tried yet. */
  webgl2: boolean | null;
  /** Did every shader compile and link? `null` = not tried yet. */
  compiled: boolean | null;
  /** How many times the context has been lost since the ground mounted. */
  losses: number;
}

/** A context lost once is rebuilt on `webglcontextrestored`; lost twice, the
 *  machine is telling us something, and the still frame is the answer. */
export const MAX_LOSSES = 2;

/** Living, or the still frame: still whenever any one reason says so. */
export function groundMode(c: GroundConditions): GroundMode {
  if (c.reducedMotion) return "still";
  if (c.webgl2 === false) return "still";
  if (c.compiled === false) return "still";
  if (c.losses >= MAX_LOSSES) return "still";
  return "living";
}
