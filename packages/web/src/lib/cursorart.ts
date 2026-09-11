import type { CanvasCursor } from "@isocan/core";
import { ARROW } from "./arrow.ts";

/**
 * **The shapes, in the surface that draws them, fetched only when one is
 * worn** (9 Sep 2026).
 *
 * > "A cursor should only be loaded if a theme is loaded"
 *
 * These paths lived in `@isocan/core/theme.ts`, which meant every first visit
 * downloaded seven of them and a canvas on the dot grid drew exactly one.
 * Core has no subpath exports — `@isocan/core` is one barrel — so there was no
 * way to make part of it arrive later; the honest fix was to move the drawing
 * to the only place that draws.
 *
 * Core kept the decision (`canvasCursorName`), which is the half both surfaces
 * need and the half carrying the rule that a seeded ground names its own
 * pointer. The CLI never drew a cursor at all, so it had been carrying seven
 * path strings in order to print sentences about grounds.
 *
 * **This module is `import()`ed, never imported statically** — by anything,
 * from anywhere. One static importer and a bundler merges all seven paths
 * back into the entry chunk, which is how the first attempt at this split
 * failed. The arrow lives in `arrow.ts` for exactly that reason.
 *
 * ## The paths, and what they cost to get
 *
 * Every one starts at `M1.5 0.5`, which is the hotspot: the tip has to be
 * where the pointer actually is, or the cursor lies about where you are
 * clicking. `owncursor.ts` and `cursorshape.test.ts` both hold that.
 *
 * **Three drawn for the library, and five rejected.** Every one was rendered
 * at 18, 24 and 32 on both grounds and looked at, because that is the only way
 * this is ever decided — #195 learned it from a rocket that never worked, and
 * the same failure came back twice: a PENCIL at 18 is a diagonal sliver, and a
 * PIN is an arrow with a notch. A BOLT was too thin to see at all.
 *
 * The subtler rejection is worth keeping: a LEAF and a PETAL both read
 * perfectly well, and both are the fish's silhouette without its tail. Two
 * entries in a library that look alike at the size they are used is a picker
 * that costs a decision and returns nothing.
 */

/** Every shape this build can draw, by the name core decided on. */
export const CURSOR_ART: Record<CanvasCursor, string> = {
  arrow: ARROW,
  // A four-point star whose upper-left ray is long enough to point with.
  // Space's cursor, and not a rocket: at 18px a rocket silhouette IS an arrow —
  // the fins never register — which #195 found by drawing one.
  sparkle:
    "M1.5 0.5 C6 6 7.5 7.5 13 10.5 C8.5 11.8 7.2 13 5.5 19 C4.6 13.4 3.4 11.8 0.6 10.2 C3.6 8.2 4.8 6.2 1.5 0.5 Z",
  // Nose at the hotspot, tail behind — it swims the way the pointer points.
  fish: "M1.5 0.5 C8 3 13 8 14.5 13.5 C10 14.5 5 12 1.8 7.5 Z M13.5 13 L17.5 12 L16 17 Z",
  // A summit flag: the pole's top is the tip, which is the one shape here that
  // was legible at 18px on the first try.
  flag: "M1.5 0.5 L3.1 0.9 L3.1 19 L1.5 19 Z M3.6 1.4 L13.5 4.6 L3.6 9.2 Z",
  // A teardrop hanging from the hotspot: the point IS the tip.
  drop: "M1.5 0.5 C1.5 0.5 13 9 13 13.5 A5.9 5.9 0 0 1 1.3 13.5 C1.3 10 1.5 0.5 1.5 0.5 Z",
  heart:
    "M1.5 0.5 C1.5 0.5 4.5 3.6 8.4 5.2 C12.6 6.9 15.6 9.4 14.4 13 C13.3 16.4 8.6 17.6 6 14.6 C4.6 18 0.8 17 0.6 13.4 C0.4 9.6 1.5 0.5 1.5 0.5 Z",
  // The upper horn is the hotspot, which makes this the sharpest tip of the
  // three — a crescent points better than it has any right to.
  crescent: "M1.5 0.5 C10.5 2.6 15.5 9 14 15.5 C13.4 18.2 10.4 19.4 8.2 18 C12.4 13.6 9.6 5.4 1.5 0.5 Z",
  /**
   * **The sheep #195 asked for on day one** (9 Sep 2026). A head that is a
   * WEDGE, and a fleece that is a ring of scallops.
   *
   * Both halves were found by drawing it wrong twice and looking. A fleece
   * with a tapered spike for a nose reads as a cloud with a stalk — the spike
   * is what every other cursor uses to point, and on a round body it looks
   * like a stray hair rather than an animal. Making the head its own wedge,
   * overlapping the fleece, is what turns the same blob into something with a
   * front. Seven scallops disappeared at 18px; six survive.
   *
   * It is the only shape in the library that is two subpaths meeting rather
   * than one outline, and that is the point: the join is the neck.
   */
  sheep:
    "M1.5 0.5 L9.9 6.1 L7.1 10.7 Z M10.9 7.7 A2.8 2.8 0 0 1 16.2 8.8 A2.8 2.8 0 0 1 17.9 13.9 A2.8 2.8 0 0 1 14.3 17.9 A2.8 2.8 0 0 1 9 16.8 A2.8 2.8 0 0 1 7.3 11.7 A2.8 2.8 0 0 1 10.9 7.7 Z",
};
