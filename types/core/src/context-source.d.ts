import type { CanvasContents, Item } from "./model.js";
/**
 * **Where a copied piece came from** (`docs/projects/memory/pin-from-source.md`).
 *
 * The record half of pin-from-source, kept in its own module on purpose.
 * Local Context reads it on every canvas — so it is in the first paint — while
 * the eligibility rules and the copy decoration beside it in `context-pin.ts`
 * are only ever wanted by a picker somebody opened. `scripts/bundle-ceiling.mjs`
 * has learned this twice (`arrow.ts`, `facts.ts`): **the eager half of a
 * feature has to be a separate file from the lazy half**, because a bundler
 * hoists a module two chunks share into the one that loads first.
 */
/** `contextSource=<json>` — durable provenance, written once by the copy.
 *
 * It is a RECORD, never a capability: it names where these bytes came from so
 * a reader can say so, and it is read by nothing that fetches. A link that
 * kept following the source is what inheritance already is. */
export declare const CONTEXT_SOURCE_PROP = "contextSource";
/** Where a copied item came from, frozen at the moment it was copied.
 *
 * Deliberately six plain facts and no seventh: no badge, no token, no actor,
 * nothing private. A copied card travels — into an export, into another
 * project, into somebody else's snapshot — and everything this property says
 * is already visible to anyone who could read the source. */
export interface ContextSource {
    /** The authoritative home the source was read from. */
    home: string;
    canvasId: string;
    canvasTitle: string;
    itemId: string;
    itemTitle: string;
    /** The source item's current version at the moment of the copy. */
    versionId: string;
}
/**
 * Provenance as read back, or null.
 *
 * **Malformed provenance is ignored as metadata rather than refused.** A
 * property is a string anyone can set, and an item whose `contextSource` is
 * nonsense is still a perfectly good item — the honest answer is to say
 * nothing about where it came from, not to break the view that lists it.
 * Unknown keys are dropped for the same reason this type has exactly six:
 * what a reader repeats should be what the copy decided to record.
 */
export declare function parseContextSource(raw: unknown): ContextSource | null;
/** What this item says about where it was copied from, or nothing. */
export declare function contextSourceOf(item: Item): ContextSource | null;
/** The local items that were copied from a source, in reading order — what
 *  Context lists beside its pins so the copy's origin stays visible here. */
export declare function copiedContextItems(canvas: CanvasContents): Array<{
    item: Item;
    source: ContextSource;
}>;
