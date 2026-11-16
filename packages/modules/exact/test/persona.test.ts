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
import { parsePersonaRun, personaSummary, type PersonaRun } from "../src/persona.ts";

/** Exact phase 9: persona runs. The runs themselves are real agents' (`scratchpad/p9`); here, what the card says of them. */

const run = (name: string, verdict: "reached" | "stuck", ops: string[], note: string, broke: number | null = null): PersonaRun => ({
  name, goal: `${name}'s goal`, verdict, note, by: name, host: "web", url: "/", first: "ver_0", broke, at: "2026-11-15T00:00:00Z",
  steps: ops.map((op, i) => ({ op, ok: broke === null || i < broke, said: broke === i ? "no view matches it" : null, frame: `ver_${i + 1}` })),
});

describe("persona runs (journey Scene 9)", () => {
  it("reads a run, and refuses one without a verdict", () => {
    const r = run("Lee", "stuck", ["tap places-3"], "No way to buy it.");
    expect(parsePersonaRun(JSON.stringify(r))).toEqual(r);
    expect(parsePersonaRun(JSON.stringify({ ...r, verdict: "maybe" }))).toBeNull();
    expect(parsePersonaRun("summary")).toBeNull();
  });

  it("summarises every run: who reached, who got stuck and why, and the steps they shared", () => {
    const md = personaSummary("Acme Market", [
      run("Maya", "reached", ["tap places-1", "tap add-to-cart"], "Quick."),
      run("Sam", "reached", ["tap places-1", "tap save-places"], "Easy."),
      run("Lee", "stuck", ["tap places-1", "tap nope"], "No way to buy it.", 1),
    ]);
    expect(md).toContain("3 runs: 2 reached the goal, 1 got stuck");
    expect(md).toContain("Where they agreed: every persona took `tap places-1`.");
    expect(md).toContain("Where they got stuck: Lee — No way to buy it.");
    expect(md).not.toContain("it..");
    expect(md).toContain("the driver could not do step 2: `tap nope`");
  });
});
