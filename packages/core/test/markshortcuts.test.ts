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

import { afterEach, describe, expect, it } from "vitest";
import { markShortcuts, registerModule, shortcutsAsText, unregisterModule } from "../src/index.ts";
import { renderKeys } from "../src/shortcut.ts";

/**
 * **A module's mark key is a listed key** (24 Sep 2026): the wireframes' ⇧K
 * was in the app's help panel and missing from `isocan shortcuts`, because
 * the panel read the loaded modules' marks and the text list did not. Both
 * now read `markShortcuts`. Synthetic: an Acme module with a star mark.
 */

const ACME = "@acme/stars";

afterEach(() => unregisterModule(ACME));

describe("markShortcuts", () => {
  it("lists a loaded module's mark key, in the words the help panel uses, and nothing when none is loaded", () => {
    expect(markShortcuts().some((s) => s.keys.includes("⇧J"))).toBe(false);
    registerModule({ name: ACME, marks: [{ property: "acmeStar", emoji: "★", title: "Starred", on: "Star", off: "Unstar", key: "J" }] });
    expect(markShortcuts()).toContainEqual({ keys: ["⇧J"], does: "★ Star, or unstar — on the selection", group: "Items", note: "A property on the item, so anybody can take it off" });
    // The text list spells keys for the platform it runs on: ⇧J on a Mac,
    // Shift+J on the Linux runner (lessons #89). Red on CI four runs in a row
    // while green on every Mac that ran it.
    const key = renderKeys("⇧J").replace(/[+]/g, "\\+");
    expect(shortcutsAsText()).toMatch(new RegExp(`Items\\n[\\s\\S]*${key}\\s+★ Star, or unstar — on the selection`));
  });

  it("leaves out a mark with no key", () => {
    registerModule({ name: ACME, marks: [{ property: "acmeStar", emoji: "★", title: "Starred", on: "Star", off: "Unstar" }] });
    expect(markShortcuts().some((s) => s.does.startsWith("★"))).toBe(false);
  });
});
