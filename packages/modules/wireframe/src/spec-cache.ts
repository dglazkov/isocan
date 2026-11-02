import type { DesignDoc, Item } from "@isocan/core";
import { currentVersionOf } from "./port.ts";
import type { WireSpec } from "./spec.ts";

/**
 * **Every wire's spec the canvas has read, by its version's hash** — one
 * cache for everything the web half derives from what a file SAYS: the
 * arrows between kept screens, a selected prototype's lit screens, the
 * "behind" marks and the menu that offers the restyle. null: not a wire;
 * undefined: not read yet. A version's bytes never change, so an entry never
 * goes stale; a new version is a new hash.
 */
export const specs = new Map<string, WireSpec | null>();

/** A spec by its version's hash, as far as the canvas has read — null: not a wire; undefined: not read yet. */
export const cachedSpec = (hash: string): WireSpec | null | undefined => specs.get(hash);

/** A DESIGN.md version, parsed, by its hash — what the "behind" check compares a wire's roles against. null: unreadable. */
export const docs = new Map<string, DesignDoc | null>();

/** A system's current version as the canvas has read it — `behind.ts`'s `DocOf`. */
export const cachedDoc = (system: Item): DesignDoc | null | undefined => {
  const v = currentVersionOf(system);
  return v ? docs.get(v.blobHash) : null;
};
