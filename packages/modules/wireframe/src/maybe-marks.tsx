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

import type { CSSProperties } from "react";
import type { UnderlayFacts } from "@isocan/core";
import { MAYBE_PROP, MAYBE_TOOLTIP, maybeItems, maybeTagNeed } from "./maybe.ts";

/**
 * **The maybe marks** (`maybe.ts`): under the items, in world units, OUTSIDE
 * each unkept maybe — a dashed blue outline a few screen px beyond its edge
 * and a *maybe* tag just above its top edge, right-aligned clear of the
 * version badge. Nothing is drawn over the screen, so nothing covers its
 * search field or its header. Keep it and the mark goes, because this reads
 * `wireKeep` on every render; unkeep it and the mark is back. The tag alone
 * takes the pointer, so hovering it says what to do (`MAYBE_TOOLTIP`).
 *
 * The tag fades out at the zoom where the item's top edge cannot hold the
 * item's own title strip, the tag and the badge side by side (the labels'
 * rule, `--w` world units against `--need` screen px); the outline stays.
 */
export function WireMaybes({ canvas }: Pick<UnderlayFacts, "canvas">) {
  const items = maybeItems(canvas);
  if (items.length === 0) return null;
  return (
    <>
      {items.map((item) => {
        const { x, y } = item;
        const p = item.properties?.[MAYBE_PROP] ?? "";
        return (
          <div key={item.id} data-wire-maybe={item.id} aria-hidden>
            <div className="wire-maybe" style={{ left: x, top: y, width: item.width, height: item.height }} />
            <div
              className="wire-maybe-anchor"
              style={{ left: x + item.width, top: y, "--w": item.width, "--need": maybeTagNeed(item.title ?? "") } as CSSProperties}
            >
              <span className="wire-maybe-tag" data-p={p} title={MAYBE_TOOLTIP}>maybe</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
