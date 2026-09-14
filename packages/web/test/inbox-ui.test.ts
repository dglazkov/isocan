import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { InboxEntry } from "@isocan/core";
import { conversations } from "../src/components/Inbox.tsx";
import { EXPERIMENTS } from "../src/lib/experiments.ts";

/**
 * **What a row of the inbox owes a person** (14 Sep 2026).
 *
 * The panel shipped on 13 Sep answering two of the four questions a row is
 * asked — who and where, but not when, and not enough of what. This pins the
 * answers that were added, in the way this package pins rendering: the fold is
 * a pure function and is tested as one, and the rest is read off the source,
 * because there is no jsdom here and standing one up for four assertions would
 * be a bigger commitment than the thing it checks.
 */
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const inbox = source("../src/components/Inbox.tsx");
const navigation = source("../src/components/Navigation.tsx");
const canvasList = source("../src/pages/CanvasListPage.tsx");

const entry = (canvasId: string, threadId: string, id: string, body = "…"): InboxEntry => ({
  canvasId,
  threadId,
  reason: "mentioned",
  comment: {
    id,
    author: { id: "usr_priya", name: "Priya" },
    body,
    createdAt: "2026-09-14T09:00:00.000Z",
  },
});

describe("one row per conversation", () => {
  it("keeps the newest comment and counts what it stands for", () => {
    // Newest-first, as `inboxNewestFirst` hands them over: the first comment
    // seen for a thread is the one the row shows.
    const rows = conversations([
      entry("prj_lake", "thr_1", "cmt_3", "(and no rush — tomorrow is fine)"),
      entry("prj_lake", "thr_1", "cmt_2", "@Devon the dock sketch is up"),
      entry("prj_onb", "thr_9", "cmt_1", "@Devon ok?"),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.entry.comment.id).toBe("cmt_3");
    expect(rows[0]!.earlier).toBe(1);
    expect(rows[1]!.entry.comment.id).toBe("cmt_1");
    expect(rows[1]!.earlier).toBe(0);
  });

  it("never folds two canvases together, however the thread ids fall", () => {
    // Thread ids are unique per canvas and nothing promises they are unique
    // across them, so the key is the pair.
    const rows = conversations([entry("prj_a", "thr_1", "cmt_1"), entry("prj_b", "thr_1", "cmt_2")]);
    expect(rows).toHaveLength(2);
  });

  it("keeps the response's order — it folds, and decides nothing else", () => {
    const rows = conversations([entry("prj_b", "thr_2", "cmt_2"), entry("prj_a", "thr_1", "cmt_1")]);
    expect(rows.map((row) => row.entry.canvasId)).toEqual(["prj_b", "prj_a"]);
  });
});

describe("what a row says", () => {
  it("says how long ago, which the first cut left out entirely", () => {
    expect(inbox).toMatch(/\bago\(when, now\)/);
    // The short form is the glance; the full stamp is the hover, because "2h"
    // is not enough to answer "before or after the standup?".
    expect(inbox).toMatch(/title=\{new Date\(when\)\.toLocaleString\(\)\}/);
  });

  it("carries the whole message as the row's tooltip, since the body clamps", () => {
    expect(inbox).toMatch(/title=\{entry\.comment\.body\}/);
  });

  it("paints the author's own colour and marks an agent as one", () => {
    expect(inbox).toMatch(/faceMarkStyle\(colors, author\)/);
    expect(inbox).toMatch(/kinds\[author\.id\] === "agent"/);
  });
});

describe("behind the experiment", () => {
  it("is offered in Settings with a name and a sentence", () => {
    const experiment = EXPERIMENTS.find((e) => e.id === "inbox");
    expect(experiment).toBeDefined();
    expect(experiment!.name).toBe("Inbox");
    expect(experiment!.what.length).toBeGreaterThan(40);
  });

  it("shows neither the button nor the panel until it is on", () => {
    expect(navigation).toMatch(/\{inboxOn && pathname !== "\/"/);
    expect(navigation).toMatch(/\{inboxOn && open &&/);
    expect(canvasList).toMatch(/\{inboxOn && <Inbox actor=\{actor\} \/>\}/);
  });

  it("reads no canvas at this home while it is off", () => {
    // Off has to mean off: the poll is a whole-home read every thirty seconds,
    // and an experiment nobody asked for must not be spending it.
    expect(navigation).toMatch(/if \(!inboxOn\) return;/);
    expect(navigation).toMatch(/\}, \[actor\.id, setMode, inboxOn\]\);/);
  });
});
