import { BLOCKS } from "./blocks.ts";
import { PRIMITIVES } from "./primitives.ts";
import type { Component } from "./types.ts";

export * from "./archetypes.ts";
export * from "./intents.ts";
export type * from "./types.ts";
export { BLOCKS } from "./blocks.ts";
export { PRIMITIVES } from "./primitives.ts";

/**
 * **The catalog, as one lookup.** Blocks and primitives share one id space
 * because a recipe's section can offer either (`button | button-group`), and
 * a spec's `block` names whichever was chosen.
 */
export const COMPONENTS: ReadonlyMap<string, Component> = new Map([...PRIMITIVES, ...BLOCKS].map((c) => [c.id, c]));

export function component(id: string): Component {
  const found = COMPONENTS.get(id);
  if (!found) throw new Error(`no component "${id}" in the wireframe catalog`);
  return found;
}
