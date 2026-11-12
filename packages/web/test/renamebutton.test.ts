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

const src = readFileSync(
  fileURLToPath(new URL("../src/components/IdentityMenu.tsx", import.meta.url)),
  "utf8",
);

/**
 * **Rename offers itself only when there is a rename to do.**
 *
 * The button was live whenever the field held anything, so it went blue and
 * pressable over a name nobody had touched — and pressing it just shut the
 * menu, because the submit handler had always known better: it returns
 * early when the name is unchanged.
 *
 * Two places asking the same question and only one of them acting on it is
 * how a control comes to promise something it will not do, which teaches
 * people not to believe the next one.
 */
describe("the Rename button", () => {
  it("asks one question, in one place", () => {
    expect(src).toContain('const renames = trimmed !== "" && trimmed !== current;');
  });

  it("compares against the name everybody sees, not the one this browser stored", () => {
    // A rename made elsewhere left the stored name behind: the field opened on
    // "Admiral One" under a hover card saying "Dion Almaer" (14 Oct 2026).
    expect(src).toContain("const current = actorNameIn(useActorNames(), actor);");
    expect(src).toContain("useState(current)");
  });

  it("is disabled unless the name actually changed", () => {
    expect(src).toContain("disabled={!renames}");
    // The old spelling let an untouched name look pressable.
    expect(src).not.toContain("disabled={!trimmed}");
  });

  it("and the form agrees, rather than deciding again", () => {
    expect(src).toContain("if (!renames) return onClose();");
  });
});
