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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The lane's arithmetic is proved in `core/test/lane.test.ts`. This is the
 * drawing: that the panel asks core rather than working it out again, and
 * that the chip makes a claim the card beside it cannot.
 */
const panel = readFileSync(
  fileURLToPath(new URL("../src/components/MainThreadPanel.tsx", import.meta.url)),
  "utf8",
);

describe("the lane is drawn from the shared derivation", () => {
  it("asks core, and does not re-derive what a message made", () => {
    // A second derivation in the panel would agree with core until the day it
    // didn't, and `isocan comment` would then print a different lane from the
    // one on screen — the exact failure the isomorphism law exists to stop.
    expect(panel).toMatch(/laneFor\(canvas, thread, comment\)/);
    expect(panel, "no local rule about who made what").not.toMatch(/createdBy\.id === comment\.author/);
  });

  it("says nothing when a message made nothing", () => {
    // Most messages are conversation. A marker on every one of them is
    // furniture, and furniture is what people stop seeing.
    expect(panel).toMatch(/if \(made\.length === 0\) return null;/);
  });

  it("shows the version the message MADE, not the item's current one", () => {
    /**
     * The card below reads `v${item.versions.length}` — the top of the stack
     * now. The chip reads the version this message produced, which stops
     * changing when the author moves on. On any item worked since, the card
     * says v7 while the chip still says v2, and that difference is the whole
     * reason the chip earns its row rather than repeating the card.
     */
    // Scoped to the function: the first version of this searched the whole
    // file and matched `versions.length` down in `ItemCard`, which is where
    // it BELONGS. A guard that reads past its subject fails on correct code.
    const fn = panel.slice(panel.indexOf("function LaneChips("), panel.indexOf("export function MainThreadBody("));
    expect(fn, "the LaneChips function must exist to be checked").not.toBe("");
    expect(fn).toMatch(/v\{entry\.version\}/);
    expect(fn, "the chip must not read the live stack height").not.toMatch(/versions\.length/);
  });

  it("can be followed, because an arrow you cannot follow is punctuation", () => {
    expect(panel).toMatch(/onClick=\{\(\) => revealItem\(entry\.itemId\)\}/);
  });
});
