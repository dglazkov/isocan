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

import type { CanvasContents, Item } from "@isocan/core";
import { currentVersionOf } from "./port.ts";
import { PROTOTYPE_PROP } from "./prototype.ts";

/**
 * Whether *Choose a voice…* is offered on an item, from the specs the canvas
 * has already read (`spec-cache.ts`): a wire screen, or a prototype, whose
 * flow has a fleshed screen. Synchronous — a menu cannot wait — so a flow
 * not read yet offers nothing rather than a guess.
 */
export function offersFlowVoice(canvas: CanvasContents, item: Item, specOf: (hash: string) => { flow: string; content?: unknown; variantOf?: string } | null | undefined): boolean {
  if (item.properties?.fidelity !== "wireframe") return false;
  const proto = item.properties?.[PROTOTYPE_PROP];
  let flow: string | undefined = proto;
  if (flow === undefined) {
    const v = currentVersionOf(item);
    const spec = v ? specOf(v.blobHash) : null;
    if (!spec) return false;
    flow = spec.flow || item.id;
  }
  return Object.values(canvas.items).some((i) => {
    if (i.properties?.fidelity !== "wireframe" || i.properties?.[PROTOTYPE_PROP] !== undefined) return false;
    const v = currentVersionOf(i);
    const spec = v ? specOf(v.blobHash) : null;
    return !!spec && (spec.flow || i.id) === flow && spec.content !== undefined && (!spec.variantOf || spec.variantOf === i.id);
  });
}
