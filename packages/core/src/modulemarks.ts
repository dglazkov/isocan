import type { Item } from "./model.ts";
import type { ModuleMark } from "./modules.ts";

/** Whether a mark is offered on this item — its `offeredOn` properties all match. A mark already on is always offered, so it can come off. */
export function markOffered(mark: ModuleMark, item: Item): boolean {
  if (item.properties?.[mark.property]) return true;
  return Object.entries(mark.offeredOn ?? {}).every(([key, value]) => item.properties?.[key] === value);
}

/*
 * The lazy half of `ModuleMark` (`modules.ts`): what a gesture does and the
 * patch it sends. Its own file, apart from `moduleMarks()`, because the item
 * draws its marks on first paint and only the menu and the key write them —
 * an import is all it takes to pull a lazy half into the entry chunk
 * (`scripts/bundle-ceiling.mjs`, the `benchjoin.ts` lesson).
 */

/**
 * **What a mark gesture on a selection does** — `slideIntent`'s rule for any
 * mark: a mixed selection turns them all ON, and only one that is already all
 * marked turns off, so a gesture never throws away marks somebody meant.
 * `changing` is only the items that move.
 */
export function moduleMarkIntent(items: readonly Item[], property: string): { on: boolean; changing: Item[] } {
  const has = (item: Item) => Boolean(item.properties?.[property]);
  const on = !(items.length > 0 && items.every(has));
  return { on, changing: items.filter((item) => has(item) !== on) };
}

/**
 * The patch that puts a mark on or takes it off — `removeProperties`, because
 * `properties` merges. `who` is who put it on (an actor's id), recorded as
 * `<property>By` beside the mark; taking the mark off takes that too.
 */
export function moduleMarkPatch(property: string, on: boolean, who?: string): { properties: Record<string, string> } | { removeProperties: string[] } {
  const by = `${property}By`;
  if (!on) return { removeProperties: [property, by] };
  return { properties: who ? { [property]: "yes", [by]: who } : { [property]: "yes" } };
}

