/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { BLOCKS } from "./blocks.ts";
import { PRIMITIVES } from "./primitives.ts";
import type { Component } from "./types.ts";

export * from "./archetypes.ts";
export * from "./intents.ts";
export * from "./templates.ts";
export * from "./words.ts";
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
