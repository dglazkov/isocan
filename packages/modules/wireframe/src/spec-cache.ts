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
