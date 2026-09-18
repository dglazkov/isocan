import type { CanvasContents, Item } from "./model.ts";
import type { MetaPatch } from "./ops.ts";
import { areasOf, isArea } from "./area.ts";
import { canvasScopes } from "./canvas-scope.ts";

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
 * The same properties with any governing design role taken off.
 *
 * A deliberate copy of another canvas's design note is a REFERENCE here, not
 * this canvas's system: `role=design-system` is what makes an item govern, so
 * a copy that kept it would silently replace the design every screen on this
 * canvas is checked against. Both spellings come off, because a canvas written
 * in the `house-style` window still says that one.
 */
export function withoutDesignRole(properties: Record<string, string>): Record<string, string> {
  const role = properties[ROLE_PROP];
  if (role !== DESIGN_SYSTEM_ROLE && role !== LEGACY_DESIGN_ROLE) return properties;
  const { [ROLE_PROP]: _role, ...rest } = properties;
  return rest;
}

/**
 * **The design system that governs a place on the canvas**, if there is one.
 *
 * With no `at`: the canvas's own — a design-system item in NO scope. Most
 * recently updated wins: two at the same level are a mistake rather than a
 * feature, and the newest is the likelier answer to "which one is real".
 *
 * With `at` (11 Sep 2026, `docs/projects/design-competition/module-gaps.md`
 * §4): an item follows direct group membership and then its ancestors, else
 * the canvas's own. Legacy items and point queries use geometric areas.
 * Detaching a `DESIGN.md` from its group makes it the canvas's in one undo.
 *
 * **Why the canvas-wide pick now ignores scoped ones**: it did not, and
 * "newest wins" over the whole canvas meant three lanes each holding a
 * `DESIGN.md` silently replaced the canvas's own system with whichever lane
 * was touched last — every later `design --css`, every audit on a screen's
 * arrival, every nudge. That was not a missing feature; it was a bug waiting
 * for the first canvas with two systems, and a canvas holding a marketing
 * site and an admin app has always been one.
 */
export function designSystem(canvas: CanvasContents, opts?: DesignScopeOptions): Item | null {
  return selectDesignSystem(canvas, opts).item;
}

/** An existing item or legacy point has scope; a proposed screen can explicitly name its group or canvas root. */
export interface DesignScopeOptions { at?: { x: number; y: number } | Item; groupId?: string | null }
/** The winning local level keeps all its candidates visible, while preserving the existing newest-item rule. */
export interface DesignSystemSelection {
  status: "selected" | "none" | "unavailable";
  item: Item | null;
  level: "scope" | "canvas" | "none";
  scopeId: string | null;
  scopeDepth: number | null;
  candidates: Item[];
  reason: string;
}
/** Scope resolution is shared by winner selection and per-target screen counts, including planned membership. */
export function designTargetScopes(canvas: CanvasContents, opts: DesignScopeOptions = {}): { scopes: Item[]; unavailable?: string } {
  if (opts.groupId !== undefined) {
    if (opts.groupId === null) return { scopes: [] };
    const group = canvas.items[opts.groupId];
    if (!group || group.properties.kind !== "group" && !isArea(group)) return { scopes: [], unavailable: `The requested design scope ${opts.groupId} is unavailable.` };
    return { scopes: canvasScopes(canvas, group) };
  }
  const at = opts.at;
  if (!at) return { scopes: [] };
  if ("id" in at) {
    const current = canvas.items[at.id];
    if (!current) return { scopes: [], unavailable: `The design target ${at.id} is unavailable.` };
    return { scopes: canvasScopes(canvas, current) };
  }
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return { scopes: [], unavailable: "The proposed design location is invalid." };
  return { scopes: areasOf(canvas).filter((area) => at.x >= area.x && at.x < area.x + area.width && at.y >= area.y && at.y < area.y + area.height).sort((a, b) => a.width * a.height - b.width * b.height) };
}
/** Explains direct scope, ancestor and canvas selection without treating another lane as coverage. */
export function selectDesignSystem(canvas: CanvasContents, opts: DesignScopeOptions = {}): DesignSystemSelection {
  const target = designTargetScopes(canvas, opts);
  const empty = { item: null, level: "none" as const, scopeId: null, scopeDepth: null, candidates: [] };
  if (target.unavailable) return { ...empty, status: "unavailable", reason: target.unavailable };
  const systems = Object.values(canvas.items).filter(isDesignSystem);
  const pick = (items: Item[], scope: Item | null, depth: number | null): DesignSystemSelection | null => {
    const candidates = [...items].sort((a, b) => a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0);
    if (!candidates.length) return null;
    const location = scope ? `${depth === 0 ? "direct scope" : "ancestor scope"} “${scope.title}”` : "canvas level";
    return { status: "selected", item: candidates[0]!, level: scope ? "scope" : "canvas", scopeId: scope?.id ?? null, scopeDepth: depth, candidates, reason: `Selected the newest system at ${location}.${candidates.length > 1 ? ` ${candidates.length} systems compete at this level.` : ""}` };
  };
  for (const [depth, scope] of target.scopes.entries()) {
    const selected = pick(systems.filter((item) => canvasScopes(canvas, item)[0]?.id === scope.id), scope, depth);
    if (selected) return selected;
  }
  return pick(systems.filter((item) => !canvasScopes(canvas, item).length), null, null) ?? { ...empty, status: "none", reason: "No local design system governs this target." };
}

/** Every design system that governs an area rather than the canvas, with
 *  the area it governs — what the Context view lists under each area. */
export function scopedDesignSystems(canvas: CanvasContents): { area: Item; item: Item }[] {
  return Object.values(canvas.items)
    .filter(isDesignSystem)
    .flatMap((item) => {
      const area = canvasScopes(canvas, item)[0];
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
  // A numeric caller cannot prove coverage of individual scopes. Actual-item
  // callers use designScopeStanding; this compatibility wrapper recognizes
  // only a canvas-wide incumbent and retains the original numeric thresholds.
  if (designSystem(canvas)) return "fine";
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
