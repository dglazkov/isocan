import { markOffered, moduleMarkPatch, readingOrder, type CanvasContents, type Item, type ModuleMark } from "@isocan/core";
import { NEEDS_YES } from "./compose.ts";
import { wireframeModule } from "./record.ts";

/**
 * **Marking the keepers** (design §6, journey scene 4) — a property, as a
 * slide is: `wireKeep = "yes"` through `item.update`, so no op is new, one
 * undo takes a mark back, and anybody can take it off (a reaction would be
 * its reactor's alone). The web app draws it as 📐 and offers it from the
 * item menu and ⇧K through the record's `marks` ("Use in prototype");
 * `isocan wire keep|unkeep` (and `use|unuse`) send the same patch. Kept
 * screens read in reading order, as slides do.
 *
 * **Who put it on** rides beside it as `wireKeepBy` (24 Sep 2026): the
 * actor's id when a person or an agent used a screen — ⇧K, the menu, the
 * CLI — and the answerer (`jev`, `stub`) when a composed flow put its first
 * choices in the prototype itself. A person swapping in a variation, or
 * taking one of Jev's picks out, is the calibration signal, so the two must
 * read apart.
 */
export const KEEP_MARK: ModuleMark = wireframeModule.marks![0]!;

/*
 * Read off the record rather than imported from it: the record rides the
 * entry chunk, and every constant a lazy chunk imports from there is one more
 * export first paint carries (`scripts/bundle-ceiling.mjs`). The record is
 * exported already, so reading through it costs nothing.
 */
/** The keep mark's property, `wireKeep`. */
export const KEEP_PROP = KEEP_MARK.property;
/** The keep mark's emoji, 📐. */
export const KEEP_EMOJI = KEEP_MARK.emoji;

/** Who put the mark on: `<property>By`, as core's `moduleMarkPatch` writes it. */
export const KEEP_BY_PROP = `${KEEP_PROP}By`;

/** The answerers whose picks a flow makes on its own — a `wireKeepBy` holding one of these is a machine's choice. */
export const AUTO_KEEPERS: readonly string[] = ["jev", "stub"];

export function isKept(item: Item): boolean {
  return Boolean(item.properties?.[KEEP_PROP]);
}

/** Can this item wear the mark — a wireframe screen, or one already kept. */
export function keepable(item: Item): boolean {
  return markOffered(KEEP_MARK, item);
}

/** The patch that puts a screen in the prototype or takes it out; `who` — an actor's id, or an answerer — is recorded as `wireKeepBy`. */
export function keepPatch(on: boolean, who?: string): { properties: Record<string, string> } | { removeProperties: string[] } {
  return moduleMarkPatch(KEEP_PROP, on, who);
}

/**
 * Who put a kept screen in the prototype: the answerer whose first choice it
 * was (`auto`), or the actor who used it by hand — or nothing, for a screen
 * kept before the mark said who.
 */
export function keptBy(item: Pick<Item, "properties">): { auto: true; answerer: string } | { auto: false; actorId: string } | null {
  const by = item.properties?.[KEEP_BY_PROP];
  if (!item.properties?.[KEEP_PROP] || !by) return null;
  return AUTO_KEEPERS.includes(by) ? { auto: true, answerer: by } : { auto: false, actorId: by };
}

/**
 * **The screens a composed flow puts in its prototype by itself**: the first
 * choice of every row round 1 was confident of (P(yes) ≥ `NEEDS_YES`) —
 * never a maybe, which waits for a person, and never a variation, which is a
 * second choice by construction.
 */
export function firstChoices<S extends { spec: { maybe?: true; need?: number; variantOf?: string } }>(screens: readonly S[]): S[] {
  return screens.filter((s) => !s.spec.variantOf && !s.spec.maybe && (s.spec.need ?? 1) >= NEEDS_YES);
}

/** The kept screens, in reading order — rows top to bottom, each left to right. */
export function kept(canvas: CanvasContents): Item[] {
  return readingOrder(Object.values(canvas.items).filter(isKept));
}
