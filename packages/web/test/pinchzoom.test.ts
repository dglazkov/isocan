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

import { describe, expect, it } from "vitest";
import { pinchFactor } from "../src/lib/viewport.ts";

/**
 * **A trackpad pinch zooms like Figma** (8 Oct 2026, "part of it is how MUCH
 * it zooms"). The rate is tldraw's and Excalidraw's; the cap keeps a ⌃-held
 * mouse wheel, ~100 a notch, from tripling the zoom in one click.
 */
describe("one pinch event's zoom", () => {
  it("zooms in for a negative delta and out for a positive one, symmetrically", () => {
    expect(pinchFactor(-4)).toBeGreaterThan(1);
    expect(pinchFactor(4)).toBeLessThan(1);
    expect(pinchFactor(-4) * pinchFactor(4)).toBeCloseTo(1, 10);
  });

  it("is twice the old rate: a typical pinch of 100 px of deltas zooms about 3×", () => {
    let factor = 1;
    for (let i = 0; i < 25; i++) factor *= pinchFactor(-4);
    expect(factor).toBeGreaterThan(2.9);
    expect(factor).toBeLessThan(3.1);
  });

  it("caps one event, so a ⌃ mouse-wheel notch is a step, not a leap", () => {
    expect(pinchFactor(-100)).toBe(pinchFactor(-40));
    expect(pinchFactor(-100)).toBeLessThan(1.6);
  });

  it("reads Firefox's lines as 16 px each", () => {
    expect(pinchFactor(-1, 1)).toBeCloseTo(pinchFactor(-16), 10);
  });
});
