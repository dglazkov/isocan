import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
// @ts-expect-error — a .mjs script with no types, imported for its folds on
// purpose: a second copy of "which findings are one question" is the thing
// this guard exists to prevent one level up.
import { MARKS, decisionsIn, openQuestions, slugOf, writeOutcomes } from "../scripts/docket.mjs";

/**
 * **The docket: the one thing decided ON the canvas** (#206 phases 2 and 3).
 *
 * #148 built the board and refused to make any panel editable, naming exactly
 * one fact that must be decided there — a finding's outcome — and leaving it
 * unbuilt: *"If the canvas only ever displays, it is a dashboard and will be
 * looked at twice."*
 *
 * It is buildable now because the two halves are separable. The measurement is
 * derived and regenerated; the verdict is a reaction, and a reaction is state
 * on an item rather than an op to catch — so reconciling twice writes the same
 * bytes, and a missed tail entry costs nothing.
 *
 * These fixtures are synthetic (AGENTS.md): nothing here is lifted from a
 * canvas anybody has.
 */
const page = (date: string, persona: string, findings: Array<{ what: string; outcome: string }>) => ({
  file: `${date}-${persona}.md`,
  date,
  persona,
  goals: [],
  findings,
});
const chunk = (n: number) => `the entry chunk a first visit downloads is ${n}, past 640000`;
const css = (n: number) => `CSS rule bodies copied word for word from elsewhere is ${n}, past 47`;

describe("what the docket asks", () => {
  it("is one item per QUESTION, not one per night", () => {
    /* A missed bound writes a row every night and `findingKey` already says
       those nights are one question. One item per row is the silting #148
       names as the most likely way this goes wrong in week two. */
    const asked = openQuestions([
      page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "unanswered" }]),
      page("2026-09-02", "performance", [{ what: chunk(710000), outcome: "unanswered" }]),
      page("2026-09-03", "performance", [{ what: chunk(722753), outcome: "unanswered" }]),
    ]);
    expect(asked).toHaveLength(1);
    expect(asked[0].nights, "and it says how long it has been asking").toBe(3);
    expect(asked[0].value, "carrying the newest reading").toBe(722753);
    expect(asked[0].since).toBe("2026-09-01");
  });

  it("drops a question somebody has answered", () => {
    const asked = openQuestions([
      page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "unanswered" }]),
      page("2026-09-02", "performance", [{ what: chunk(710000), outcome: "accepted — tracked in #185" }]),
    ]);
    expect(asked).toEqual([]);
  });

  it("asks a question again when it comes back after an answer", () => {
    // The answer covered the nights up to it; a later unanswered row is the
    // queue asking again, and the docket has to show it.
    const asked = openQuestions([
      page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "accepted" }]),
      page("2026-09-05", "performance", [{ what: chunk(900000), outcome: "unanswered" }]),
    ]);
    expect(asked).toHaveLength(1);
    expect(asked[0].value).toBe(900000);
  });

  it("leaves prose alone", () => {
    /* A finding somebody wrote in their own words has no identity beyond
       itself, so it is asked once and answered once — and an item per
       sentence is the wall this is trying not to become. */
    expect(
      openQuestions([
        page("2026-09-01", "copy", [{ what: "the header row jumps 7px on select", outcome: "unanswered" }]),
      ]),
    ).toEqual([]);
  });

  it("gives a question a slug that does not move when the number does", () => {
    const a = openQuestions([page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "unanswered" }])]);
    const b = openQuestions([page("2026-09-02", "performance", [{ what: chunk(999999), outcome: "unanswered" }])]);
    expect(slugOf(a[0].id)).toBe(slugOf(b[0].id));
    expect(slugOf(a[0].id)).toMatch(/^q-[a-z0-9-]+$/);
  });
});

describe("what the canvas answers", () => {
  const item = (slug: string, reactions: Record<string, string[]>) => ({
    id: "itm_1",
    title: "a question",
    properties: { docket: slug },
    reactions,
  });
  const names = { usr_di: "Di" };

  it("reads a verdict from a reaction, and says who", () => {
    /* No new op: `item.react` has existed since long before this, so the
       vocabulary stays at 33 and the decision carries its author for free —
       which is what makes "humans and agents working on it together"
       auditable at all. */
    const [d] = decisionsIn([item("q-chunk", { "✅": ["usr_di"] })], names);
    expect(d).toMatchObject({ slug: "q-chunk", verdict: "accepted", who: ["Di"] });
    expect(decisionsIn([item("q-chunk", { "❌": ["usr_di"] })], names)[0].verdict).toBe("rejected");
  });

  it("refuses to break a tie", () => {
    /**
     * Both marks is not a tie to resolve — it is two people disagreeing, and
     * writing either answer into the repository would be this tool picking a
     * side. It stays on the docket, where the disagreement is visible.
     */
    expect(decisionsIn([item("q-chunk", { "✅": ["usr_di"], "❌": ["usr_kenny"] })], names)).toEqual([]);
  });

  it("ignores everything that is not one of its two marks", () => {
    // A docket where six emoji mean six things is one nobody can read at a
    // glance, so a 🎉 on a question is applause, not an answer.
    expect(decisionsIn([item("q-chunk", { "🎉": ["usr_di"], "👀": ["usr_di"] })], names)).toEqual([]);
    expect(Object.keys(MARKS)).toEqual(["✅", "❌"]);
  });

  it("ignores an item that is not on the docket", () => {
    expect(decisionsIn([{ id: "itm_2", title: "a panel", properties: { board: "build" }, reactions: { "✅": ["usr_di"] } }], names)).toEqual([]);
  });
});

describe("the canvas decides; the repo keeps", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "isocan-docket-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const write = (file: string, findings: string[]) =>
    writeFileSync(
      path.join(dir, file),
      ["# a run", "", "scripts/persona-run.mjs", "", "## Findings", "", "| Finding | Outcome |", "| --- | --- |", ...findings, ""].join("\n"),
    );

  it("writes the verdict into EVERY page still asking, not just the newest", () => {
    /**
     * The queue treats the nights of one question as one question
     * (`findUnanswered`'s settled map), so answering the newest and leaving
     * five older rows open would leave the suite red for a question somebody
     * had answered — which is the whole failure this is meant to end.
     */
    const pages = [
      page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "unanswered" }]),
      page("2026-09-02", "performance", [{ what: chunk(710000), outcome: "unanswered" }]),
    ];
    write("2026-09-01-performance.md", [`| ${chunk(700000)} | unanswered |`]);
    write("2026-09-02-performance.md", [`| ${chunk(710000)} | unanswered |`]);

    const changed = writeOutcomes(
      [{ slug: slugOf(`the entry chunk a first visit downloads|640000`), verdict: "accepted", who: ["Di"] }],
      dir,
      pages,
    );
    expect(changed.sort()).toEqual(["2026-09-01-performance.md", "2026-09-02-performance.md"]);
    for (const f of changed) {
      const text = readFileSync(path.join(dir, f), "utf8");
      expect(text).toContain("accepted — decided on the canvas by Di");
      expect(text, "and the finding itself is untouched").toContain("the entry chunk a first visit downloads is");
    }
  });

  it("never touches a row somebody already answered", () => {
    /* The queue is not a backlog to be cleared. An answered row is the record
       of what was decided, and a canvas reaction must not overwrite it. */
    const pages = [page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "rejected — measures evidence, not proof" }])];
    write("2026-09-01-performance.md", [`| ${chunk(700000)} | rejected — measures evidence, not proof |`]);
    expect(writeOutcomes([{ slug: slugOf(`the entry chunk a first visit downloads|640000`), verdict: "accepted", who: ["Di"] }], dir, pages)).toEqual([]);
    expect(readFileSync(path.join(dir, "2026-09-01-performance.md"), "utf8")).toContain("rejected — measures evidence");
  });

  it("leaves a different question alone", () => {
    const pages = [
      page("2026-09-01", "performance", [
        { what: chunk(700000), outcome: "unanswered" },
        { what: css(60), outcome: "unanswered" },
      ]),
    ];
    write("2026-09-01-performance.md", [`| ${chunk(700000)} | unanswered |`, `| ${css(60)} | unanswered |`]);
    writeOutcomes([{ slug: slugOf(`the entry chunk a first visit downloads|640000`), verdict: "accepted", who: ["Di"] }], dir, pages);
    const text = readFileSync(path.join(dir, "2026-09-01-performance.md"), "utf8");
    expect(text).toContain("accepted — decided on the canvas by Di");
    expect(text.split("\n").find((l) => l.includes("CSS rule bodies"))).toContain("| unanswered |");
  });

  it("writes nothing when there is nothing to decide", () => {
    // What makes it safe to run on every canvas change: no decision, no diff,
    // no commit.
    const pages = [page("2026-09-01", "performance", [{ what: chunk(700000), outcome: "unanswered" }])];
    write("2026-09-01-performance.md", [`| ${chunk(700000)} | unanswered |`]);
    expect(writeOutcomes([], dir, pages)).toEqual([]);
  });
});
