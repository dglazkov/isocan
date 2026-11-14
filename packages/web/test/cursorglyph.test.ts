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
import { rules } from "./cssrules.ts";

/**
 * **The stylesheet half of `cursorhotspot.test.ts`**: a marked pointer's tip
 * stays on the hotspot because nothing in CSS is allowed to move it.
 */
describe("the stylesheet keeps the tip on the hotspot", () => {
  const all = rules();
  const body = (selector: string) => all.find((rule) => rule.selector === selector)?.body ?? "";

  it("shrinks the arrow in place — a size, never an offset", () => {
    // The arrow's point is at the top-left of its viewBox, so resizing it
    // about that corner keeps the point where it was; a margin, position or
    // transform here would move every pointer on the canvas off its target.
    for (const selector of [".remote-cursor.marked svg", ".own-cursor.marked svg"]) {
      const shrink = body(selector);
      expect(shrink, selector).toMatch(/width:\s*9px/);
      expect(shrink, selector).not.toMatch(/margin|transform|translate|position|left|top/);
    }
  });

  it("lays the glyph over the arrow's body, out of flow and a fixed screen size", () => {
    // Absolute, so it cannot push the tip; px rather than a calc over
    // `--scale`, because this layer is screen space and must not zoom.
    const glyph = body(".cursor-glyph");
    expect(glyph).toMatch(/position:\s*absolute/);
    expect(glyph).toMatch(/font-size:\s*22px/);
    expect(glyph).not.toContain("--scale");
  });
});
