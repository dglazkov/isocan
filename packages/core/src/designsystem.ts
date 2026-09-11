import type { CanvasContents, Item } from "./model.ts";
import type { MetaPatch } from "./ops.ts";
import { areaOf, areasOf } from "./area.ts";

/**
 * The design system: what this canvas has decided things look like.
 *
 * Every agent that builds a screen is otherwise designing from scratch, which
 * is why a canvas fills up with screens that are individually fine and
 * collectively a jumble — six type scales, four blues, three ideas about
 * spacing. The fix is not better adjectives in a prompt ("clean, modern"
 * describes nothing); it is a written-down system with NUMBERS in it, that
 * every builder reads first.
 *
 * It lives on the canvas as an ordinary item rather than in a dotfile, and
 * that is the whole design: the design system sits beside the designs it
 * governs, both surfaces can read and edit it, it versions like everything
 * else, and a person can see it without knowing it exists. A hidden file is a
 * file nobody updates.
 *
 * The convention is one property, so nothing else has to learn a new kind.
 */

const ROLE_PROP = "role";
/** The `role` an item wears to BE this canvas's design system. */
export const DESIGN_SYSTEM_ROLE = "design-system";
/** What this was called for an afternoon. Canvases written in that window
 * still say it, and a rename that orphans somebody's file is not a rename. */
const LEGACY_DESIGN_ROLE = "house-style";

/** The properties that make an item this canvas's design system. */
export function designSystemProperties(): Record<string, string> {
  return { [ROLE_PROP]: DESIGN_SYSTEM_ROLE };
}

/** Is this item the design system — under either name it has been given? */
export function isDesignSystem(item: Item): boolean {
  const role = item.properties[ROLE_PROP];
  return role === DESIGN_SYSTEM_ROLE || role === LEGACY_DESIGN_ROLE;
}

/**
 * **The design system that governs a place on the canvas**, if there is one.
 *
 * With no `at`: the canvas's own — a design-system item in NO area. Most
 * recently updated wins: two at the same level are a mistake rather than a
 * feature, and the newest is the likelier answer to "which one is real".
 *
 * With `at` (11 Sep 2026, `docs/projects/design-competition/module-gaps.md`
 * §4): the one inside the smallest area containing that spot, else the
 * canvas's own. Scoped by geometry, the way area membership already is, so it
 * needs no property — moving a `DESIGN.md` out of an area makes it the
 * canvas's, visibly, in one undo.
 *
 * **Why the canvas-wide pick now ignores scoped ones**: it did not, and
 * "newest wins" over the whole canvas meant three lanes each holding a
 * `DESIGN.md` silently replaced the canvas's own system with whichever lane
 * was touched last — every later `design --css`, every audit on a screen's
 * arrival, every nudge. That was not a missing feature; it was a bug waiting
 * for the first canvas with two systems, and a canvas holding a marketing
 * site and an admin app has always been one.
 */
export function designSystem(canvas: CanvasContents, opts?: { at?: { x: number; y: number } | Item }): Item | null {
  const systems = Object.values(canvas.items).filter(isDesignSystem);
  if (systems.length === 0) return null;
  const areas = areasOf(canvas);
  const areaHolding = (item: Item) => areaOf(canvas, item);
  const newest = (list: Item[]) =>
    [...list].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0] ?? null;
  const at = opts?.at;
  if (at) {
    const point = "id" in at ? { x: at.x + at.width / 2, y: at.y + at.height / 2 } : at;
    const holding = areas
      .filter((a) => point.x >= a.x && point.x < a.x + a.width && point.y >= a.y && point.y < a.y + a.height)
      .sort((a, b) => a.width * a.height - b.width * b.height);
    for (const area of holding) {
      const here = newest(systems.filter((s) => areaHolding(s)?.id === area.id));
      if (here) return here;
    }
  }
  return newest(systems.filter((s) => areaHolding(s) === null));
}

/** Every design system that governs an area rather than the canvas, with
 *  the area it governs — what the Context view lists under each area. */
export function scopedDesignSystems(canvas: CanvasContents): { area: Item; item: Item }[] {
  return Object.values(canvas.items)
    .filter(isDesignSystem)
    .flatMap((item) => {
      const area = areaOf(canvas, item);
      return area ? [{ area, item }] : [];
    });
}

/**
 * **How many screens before a canvas should have written its style down.**
 *
 * Not one. One screen has nothing to be consistent WITH, and a system
 * written before anything exists is a system made of adjectives — the kind
 * that gets ignored, and the reason `/design-system` derives from what is
 * already there rather than inventing one up front.
 *
 * Two is where it starts to matter, because the second screen is the moment
 * a choice becomes a convention: it either copies the first — and the system
 * now exists, implicitly, unwritten and unversioned — or it does not, and
 * the canvas has begun to drift. Either way the decision has been made and
 * nobody has recorded it.
 */
export const DESIGN_SYSTEM_AFTER = 2;

/**
 * Does this canvas have designs and no written system for them?
 *
 * The question a canvas can ask ITSELF, which is the point. "Read the design
 * system before you build a screen" has been in the agent guide all along,
 * and a norm in a document is a rule somebody has to remember. This is the
 * canvas noticing instead — and it deliberately notices the absence rather
 * than preventing anything: the first screen is the design system whether or
 * not it was written down, so the useful moment is not a gate before the
 * work but a prompt to capture what the work already decided.
 *
 * Counting is left to the caller, which knows what a screen is on its
 * surface — this stays a rule about numbers so both can apply the same one.
 */
export function needsDesignSystem(
  canvas: CanvasContents,
  screens: number,
  project?: HasProperties,
): boolean {
  return designStanding(canvas, screens, project) !== "fine";
}

/**
 * **How many screens before the note stops being a note** (8 Sep 2026).
 *
 * `DESIGN_SYSTEM_AFTER` has been printing a courtesy line on both surfaces
 * since the feature landed, and measured across six live canvases it has
 * changed nothing: **37 of 61 screens sit on a canvas with no design system**,
 * including one at 24 screens and one at 7. A note that has been ignored
 * twenty-four times is not a note, it is decoration — which is this repo's own
 * oldest finding, in the words `bundle-ceiling.mjs` uses about the size gate it
 * replaced: *"seven raises teach somebody to edit a number without reading
 * it"*.
 *
 * So the shape is that gate's, deliberately: **a creep asks, a jump blocks.**
 * Past `DESIGN_SYSTEM_AFTER` a canvas is told; past this, adding another
 * screen is refused until somebody either writes a system or says out loud
 * that this canvas does not want one.
 *
 * **Three times the point where the rule already applies**, and the ratio is
 * borrowed rather than invented: `test/review-queue.test.ts` reddens a finding
 * asked three nights running, on the argument that a question asked a third
 * time needs a guard rather than a fourth mention. Same argument, same three.
 */
export const DESIGN_SYSTEM_LIMIT = DESIGN_SYSTEM_AFTER * 3;

/**
 * Where this canvas stands: nothing owed, owed, or past the point where it is
 * still a suggestion.
 *
 * One function rather than two booleans, because the two surfaces must not be
 * able to disagree about which of the three a canvas is in — and because a
 * caller that has to combine `needsDesignSystem` with a comparison of its own
 * is a caller that will get the boundary wrong in one place.
 */
type DesignStanding = "fine" | "owed" | "overdue";

/**
 * **The two halves of the answer live on two objects, and that is why this
 * takes both.**
 *
 * The design system is an ITEM, so it is in `CanvasContents`. The decision not
 * to have one is a canvas PROPERTY, so it is on the project — the same place
 * `themeOf` reads from. A caller holding only one of them cannot answer the
 * question, and the shape that makes that impossible to get wrong is one
 * function asking for both.
 *
 * `project` is optional only because the answer without it is the safe one: a
 * caller that cannot see the properties reports the standing as if nobody had
 * opted out, which asks for a system that may not be wanted rather than
 * silently skipping one that is.
 */
interface HasProperties {
  properties?: Record<string, string>;
}

/** Which of the three this canvas is in. See `DesignStanding` above for why
 *  it takes both the contents and the project. */
export function designStanding(
  canvas: CanvasContents,
  screens: number,
  project?: HasProperties,
): DesignStanding {
  // ANY written system counts — the canvas's own or one scoped to an area. A
  // canvas whose every lane carries its own `DESIGN.md` has written its style
  // down; asking it for a canvas-wide one on top would be a nudge about a
  // shape, not about the thing the nudge exists for.
  if (Object.values(canvas.items).some(isDesignSystem)) return "fine";
  if (project !== undefined && designSkipped(project)) return "fine";
  if (screens >= DESIGN_SYSTEM_LIMIT) return "overdue";
  return screens >= DESIGN_SYSTEM_AFTER ? "owed" : "fine";
}

/**
 * **Saying no, on the canvas, where the next person can see it.**
 *
 * A gate with no way past it is a gate people route around, and the route
 * around a CLI refusal is a flag — which leaves no trace, has to be passed
 * every time, and tells the next person nothing. This is a canvas PROPERTY
 * instead: it versions, both surfaces can read it, and "this canvas has
 * decided it does not want a design system" is a fact about the canvas rather
 * than a habit of whoever is typing.
 *
 * It is the same shape as `themePatch` and for the same reason — a property on
 * `project.update`'s `MetaPatch`, not a new operation to add to the vocabulary.
 *
 * Some canvases genuinely should take it. A canvas of historical pages, each
 * reproducing a different era on purpose, has screens that are SUPPOSED to
 * disagree; a system derived from them would be a system made of averages.
 */
const DESIGN_SKIP_PROP = "design";
const DESIGN_SKIP_VALUE = "none";

/** Has this canvas said, on the record, that it does not want one? */
export function designSkipped(canvas: { properties?: Record<string, string> }): boolean {
  return canvas.properties?.[DESIGN_SKIP_PROP] === DESIGN_SKIP_VALUE;
}

/** This canvas does not want one, deliberately. */
export function designSkipPatch(): MetaPatch {
  return { properties: { [DESIGN_SKIP_PROP]: DESIGN_SKIP_VALUE } };
}

/** Take the decision back — the note and the gate return. */
export function designUnskipPatch(): MetaPatch {
  return { removeProperties: [DESIGN_SKIP_PROP] };
}
