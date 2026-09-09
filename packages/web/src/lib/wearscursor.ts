import { useEffect, useState } from "react";
import { canvasCursorName } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { ARROW } from "./arrow.ts";

/**
 * **The path this canvas's cursor draws, fetched only if it is not the arrow**
 * (9 Sep 2026).
 *
 * > "A cursor should only be loaded if a theme is loaded"
 *
 * One hook rather than the same six lines in `CursorLayer` and `OwnCursor`,
 * which is not tidiness: those two draw the SAME pointer, one for everybody
 * else and one for you, and two copies of a lazy load is two chances for your
 * cursor and everybody's to disagree about what this canvas wears.
 *
 * ## It renders the arrow first, always
 *
 * A canvas with no ground draws the arrow and fetches nothing, which is the
 * whole point. A canvas WITH one draws the arrow for the frame or two the
 * import takes, then the real shape. That order is deliberate: a cursor which
 * is briefly plain is a small wrongness, and a cursor which is briefly absent
 * is a canvas where nobody appears to be — `CursorLayer` is how you see that
 * other people are here at all.
 *
 * ## Why the name comes from core and the path does not
 *
 * `canvasCursorName` carries the rule — a seeded ground names its own pointer
 * and a chosen one cannot override it — and both surfaces need that. Only this
 * surface needs the drawing. Same seam as the design system: core holds the
 * tokens, the surface renders them.
 */
export function useCanvasCursor(): string {
  const name = useCanvasStore((s) => canvasCursorName(s.project ?? {}));
  const [path, setPath] = useState(ARROW);

  useEffect(() => {
    if (name === "arrow") {
      setPath(ARROW);
      return;
    }
    let current = true;
    // The one dynamic import in the app that is about BYTES rather than about
    // a route: 6 shapes a canvas on the dot grid never draws.
    void import("./cursorart.ts").then((art) => {
      // The canvas can change grounds while this is in flight. Without the
      // guard, switching galaxy → none mid-import paints a sparkle onto a
      // canvas that has no ground, and it stays until the next render.
      if (current) setPath(art.CURSOR_ART[name] ?? ARROW);
    });
    return () => {
      current = false;
    };
  }, [name]);

  return path;
}
