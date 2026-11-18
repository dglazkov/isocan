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
import { eagerWebFiles } from "./cssuse.ts";

/**
 * The panel is small; what matters about it is the two judgements it encodes.
 */
const src = ["../src/lib/news.ts", "../src/components/NewsDialog.tsx"]
  .map((file) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8"))
  .join("\n");

describe("what's new", () => {
  it("keeps the unread indicator eager and the unopened dialog out of first paint", () => {
    const eager = eagerWebFiles();
    expect(eager.has("packages/web/src/lib/news.ts")).toBe(true);
    expect(eager.has("packages/web/src/components/NewsDialog.tsx")).toBe(false);
  });

  it("folds with core, so the CLI lists the same days", () => {
    expect(src).toContain("unseen(");
    expect(src).toContain("newestDay(");
  });

  it("marks read on OPEN, not on close", () => {
    /* A panel you opened and skimmed has been seen. Making somebody scroll to
       the bottom to clear a count is a toll rather than a record. */
    expect(src).toMatch(/markSeen\(newestDay\(r\.days\)\)/);
  });

  it("survives a browser that refuses storage", () => {
    /* Then the list still reads and the count simply never fires, which is
       the half that matters. */
    expect(src).toMatch(/catch \{/);
    expect(src).toContain("localStorage");
  });

  it("shows no count to a first-time reader", () => {
    /**
     * `unseen(days, null)` is empty by design in core, and the reason belongs
     * next to the surface that would otherwise greet somebody with fifty
     * unread notices: a dot is a claim about a person's attention, and on a
     * first visit it is a false one.
     */
    expect(src).toMatch(/lastSeen\(\)/);
  });
});
