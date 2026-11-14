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
import {
  appendTest, appendedTest, parseRecordAsk, parseRecording, parseStory, proposeExpects, rebased, recordedTest, storyOf, storyText, withRun,
  type RunReport,
} from "../src/story.ts";

/**
 * Exact phase 5: tests as storyboards — the pure half both surfaces share.
 * The states below are Acme Market's own `state` replies (Exact cbe553f6,
 * 14 Nov 2026), before and after `tap places-1`, `tap add-to-cart`, trimmed
 * to the slots and derives that matter.
 */
const BEFORE = {
  slots: { nav: { tab: "places", tabs: [{ name: "places", stack: [{ id: 0, name: "places" }] }], next: 2 }, saved: [], cart: [], buyer: "", sheetOpen: false },
  derives: { cartItems: [], cartTotal: 0, placesShown: [{ id: "1", name: "Acme Mug" }], savedShown: [] },
};
const AFTER = {
  slots: { nav: { tab: "places", tabs: [{ name: "places", stack: [{ id: 0, name: "places" }, { id: 2, name: "place" }] }], next: 3 }, saved: [], cart: ["1"], buyer: "", sheetOpen: true },
  derives: { cartItems: [{ id: "1", name: "Acme Mug", price: 12 }], cartTotal: 12, placesShown: [{ id: "1", name: "Acme Mug" }], savedShown: [] },
};

const FILE = `test "each tab keeps its own stack"
  tap "places-2"
  clock settle
  expect text "about-places" == "A canvas tote with an inside pocket."
`;

describe("a recording's expect lines, read off the state that changed", () => {
  it("writes each moved value as Exact's tests take it, whole values first", () => {
    expect(proposeExpects(BEFORE, AFTER)).toEqual([
      'expect state cart.0 == "1"',
      "expect state sheetOpen == true",
      "expect state cartTotal == 12",
      "expect state nav.next == 3",
    ]);
  });

  it("proposes nothing when nothing moved, and leaves lists of records to the person", () => {
    expect(proposeExpects(BEFORE, BEFORE)).toEqual([]);
    expect(proposeExpects(BEFORE, AFTER).some((l) => l.includes("cartItems"))).toBe(false);
  });

  it("writes the test from the drive: its start, each press settled, then the expects", () => {
    const test = recordedTest("add from browse", 'at "/"', [], ["tap places-1", "tap add-to-cart"], proposeExpects(BEFORE, AFTER).slice(0, 2));
    expect(test).toBe([
      'test "add from browse"',
      '  tap "places-1"',
      "  clock settle",
      '  tap "add-to-cart"',
      "  clock settle",
      '  expect state cart.0 == "1"',
      "  expect state sheetOpen == true",
    ].join("\n"));
    expect(recordedTest("t", 'at "/place/2"\ntap add-to-cart', ["back"], ['type buyer-name "Sam"'], [])).toContain('  at "/place/2"\n  tap "add-to-cart"\n  back\n  clock settle\n  type "buyer-name" "Sam"');
  });
});

describe("only a kept recording reaches the disk, and only as a recording", () => {
  const test = recordedTest("add from browse", 'at "/"', [], ["tap places-1"], ["expect state sheetOpen == false"]);
  const kept = appendTest(FILE, test);

  it("accepts the file it was recorded against with one recorded test appended", () => {
    expect(appendedTest(FILE, kept)).toEqual({ test });
  });

  it("refuses an edit above the test, a line a recording never writes, and no test at all", () => {
    expect("refused" in appendedTest(FILE, kept.replace("places-2", "places-3"))).toBe(true);
    expect(appendedTest(FILE, appendTest(FILE, `${test}\n  screenshot "/etc/x.png"`))).toMatchObject({ refused: expect.stringContaining("screenshot") });
    expect(appendedTest(FILE, appendTest(FILE, `${test}\n  expect state x == {"a":1}`))).toMatchObject({ refused: expect.stringContaining("line a recording does not write") });
    expect(appendedTest(FILE, FILE)).toMatchObject({ refused: expect.any(String) });
  });

  it("reads a record ask and a recording only in their closed shapes", () => {
    const ask = { seq: 1, by: "Sam", host: "web", size: "390x844", scheme: "light", shots: 'at "/"', before: [], ops: ["tap places-1"], file: "app.test.contract", name: "add from browse" };
    expect(parseRecordAsk(JSON.stringify(ask))?.ops).toEqual(["tap places-1"]);
    expect(parseRecordAsk(JSON.stringify({ ...ask, ops: ["screenshot /tmp/x.png"] }))).toBeNull();
    expect(parseRecordAsk(JSON.stringify({ ...ask, file: "../app.test.contract" }))).toBeNull();
    expect(parseRecordAsk(JSON.stringify({ ...ask, name: 'a "quoted" name' }))).toBeNull();
    expect(parseRecording(JSON.stringify({ file: "app.test.contract", base: "0".repeat(64), test: "t", host: "web", seq: 1 }))?.file).toBe("app.test.contract");
    expect(parseRecording(JSON.stringify({ file: "x.contract", base: "0".repeat(64), test: "t" }))).toBeNull();
  });
});

describe("a storyboard keeps each host's last run, frames inside", () => {
  const story = storyOf({ id: "dev.acme.market", name: "Acme Market" }, "app.test.contract", FILE, {
    name: "each tab keeps its own stack",
    steps: [{ op: "tap", line: 2 }, { op: "clock", line: 3 }, { op: "expect-text", line: 4 }],
  });
  const frame = (sha: string) => ({ sha256: sha, png: Buffer.from(sha).toString("base64") });
  const report = (host: string, verdict: RunReport["verdict"], shas: string[]): RunReport => ({
    ok: true, host, file: "app.test.contract", test: story.test.name, verdict, said: [], ms: 1,
    steps: shas.map((s, i) => ({ line: 2 + i, state: verdict === "fail" && i === 2 ? "fail" : "ok", frame: frame(s) })),
    failed: verdict === "fail" ? { line: 4, reason: "no", frame: frame(shas[2]!), tree: [{ depth: 0, type: "View", testId: "app" }], reply: null } : null,
    end: null,
  });

  it("reads the steps as written, under their test line", () => {
    expect(story.test.line).toBe(1);
    expect(story.test.steps.map((s) => s.text)).toEqual(['tap "places-2"', "clock settle", 'expect text "about-places" == "A canvas tote with an inside pocket."']);
  });

  it("stores a frame two steps share once, and drops a host's old frames with its old run", () => {
    const a = withRun(story, report("web", "ok", ["a", "b", "b"]), (f) => f.png ?? null, "t1");
    expect(Object.keys(a.frames).sort()).toEqual(["a", "b"]);
    const b = withRun(a, report("macos", "fail", ["a", "c", "d"]), (f) => f.png ?? null, "t2");
    expect(Object.keys(b.frames).sort()).toEqual(["a", "b", "c", "d"]);
    expect(b.runs.macos?.failed?.line).toBe(4);
    const c = withRun(b, report("macos", "ok", ["a", "a", "a"]), (f) => f.png ?? null, "t3");
    expect(Object.keys(c.frames).sort()).toEqual(["a", "b"]);
    expect(parseStory(storyText(c))).toEqual(c);
  });

  it("keeps the runs when only the lines moved, and drops them when the steps changed", () => {
    const ran = withRun(story, report("web", "ok", ["a", "b", "b"]), (f) => f.png ?? null, "t1");
    const moved = storyOf(story.app, story.file, `// a comment\n${FILE}`, { name: story.test.name, steps: [{ op: "tap", line: 3 }, { op: "clock", line: 4 }, { op: "expect-text", line: 5 }] });
    expect(rebased(ran, moved).runs.web?.steps.map((s) => s.line)).toEqual([3, 4, 5]);
    const changed = storyOf(story.app, story.file, FILE.replace("places-2", "places-3"), { name: story.test.name, steps: [{ op: "tap", line: 2 }, { op: "clock", line: 3 }, { op: "expect-text", line: 4 }] });
    expect(rebased(ran, changed).runs).toEqual({});
  });
});
