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

import type { CoreModule } from "@isocan/core";
import { wireframeModule } from "./record.ts";
import { KEEP_MARK } from "./keep.ts";
import { followOnWeb } from "./follow.ts";
import { WIRE_COMMAND, WIRE_PROPERTY_KEYS } from "./wire-command.ts";
import { prototypeWalkFlow } from "./walk-flow.ts";

export { WIRE_COMMAND };

/**
 * The record with the command's skill and the property keys it owns — what
 * both loaded halves register. The keys live here rather than on the record
 * first paint carries (`record.ts`) because nothing on the web reads them:
 * they are the CLI's manifest and the daemon's, forever, and namespaced.
 * `wireKeepBy` (who put a screen in the prototype, keep.ts), `wireLinks`
 * (a person's overrides, links.ts — since phase 8 one
 * `wireLink:<hotspot>` each, link-override.ts), `wirePrototype`
 * (prototype.ts) and `wirePrototypeAt` (kept-flows.ts) are spelled out.
 *
 * The keep mark gains its `follow` here, not on the record: the prototype
 * re-versioning when a screen is used or removed (follow.ts) is lazy code,
 * so first paint carries none of it, and the shell reads the mark off the
 * registry once this half has registered in the record's place.
 */
export const wireframeCore: CoreModule = {
  ...wireframeModule,
  marks: [{ ...KEEP_MARK, follow: followOnWeb }],
  propertyKeys: [...WIRE_PROPERTY_KEYS],
  commands: [WIRE_COMMAND],
  // A walk follows a prototype's links (proactive-agent phase 9).
  walkFlow: prototypeWalkFlow,
};
