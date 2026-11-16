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
import { DESK_OF_PROP, deskOf, deskTitle } from "../src/sprint.ts";

/**
 * **The desk** (sprint phase 3): a private canvas that knows its sprint.
 * The record is one property on the desk canvas; the privacy is the door's
 * (link off, one pass), which the CLI test proves over the wire.
 */
describe("a desk knows its sprint", () => {
  it("reads the sprint off the canvas record, and nothing off a canvas that is not a desk", () => {
    expect(deskOf({ properties: { [DESK_OF_PROP]: "prj_sprint" } })).toBe("prj_sprint");
    expect(deskOf({ properties: {} })).toBeNull();
    expect(deskOf({})).toBeNull();
  });

  it("is named for its sketcher", () => {
    expect(deskTitle("Theo")).toBe("Theo's desk");
    expect(deskTitle("  Nia ")).toBe("Nia's desk");
    // The one rule of English possessives the name has to survive.
    expect(deskTitle("Ross")).toBe("Ross' desk");
  });
});
