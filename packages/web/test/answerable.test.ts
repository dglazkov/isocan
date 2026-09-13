import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const poll = read("../src/lib/answerable.ts");
const row = read("../src/components/AgentRow.tsx");
const css = read("../src/styles.css");

/**
 * **Evidence with an age, and two states that stop looking alike** (#197
 * phase 2, D1 and D3).
 *
 * The note's complaint, in its own words: the roster's dot is "a claim about a
 * held socket rather than about anybody answering", and the strongest fact an
 * agent row can carry — a summons WILL land — read at a glance exactly like
 * the weakest, nobody is home.
 */
describe("the roster says what it knows, with an age on it", () => {
  it("keeps the moment the poll last answered", () => {
    // The poll always knew this and always threw it away, which is what let
    // "answers if you comment" read the same eight seconds after a good read
    // as four minutes after the daemon stopped answering.
    expect(poll).toMatch(/at: Date\.now\(\)/);
    expect(poll).toContain("export function useAnsweredAt");
  });

  it("shows the age beside the promise, not instead of it", () => {
    /* "answers if you comment" is still the claim; the age is the evidence
       for it. Dropping the claim would make the row a timestamp, which says
       nothing about whether a summons lands. */
    expect(row).toContain("answers if you comment · heard ${heardFrom} ago");
  });

  it("falls back to the bare promise before the first answer lands", () => {
    // A row that rendered "heard  ago" on the first paint would be worse than
    // the sentence it replaced.
    expect(row).toMatch(/heardFrom\s*\?/);
  });

  it("moves, because a timestamp rendered once is the same overstatement slower", () => {
    // The shared one-second tick, which also stops while the tab is hidden.
    expect(row).toContain("useClockSecond()");
  });

  it("gives answerable a dot of its own", () => {
    /* D3: "the difference a person acts on must be visible without reading."
       A centre fills the ring — something is in there — and it stays the
       actor's colour, so the dot still says WHO as well as what. */
    /* …and since owner-only summons (11 Sep 2026), only for a reader whose
       word it takes: to somebody outside the gate "a summons WILL land" is
       the one thing that is false. */
    expect(row).toMatch(/wb-dot hollow\$\{row\.state === "answerable" && !shut \? " ready" : ""\}/);
    expect(css).toContain(".wb-dot.hollow.ready");
    const rule = css.slice(css.indexOf(".wb-dot.hollow.ready"), css.indexOf(".wb-dot.hollow.ready") + 120);
    expect(rule, "the actor's colour, not a new one").toContain("currentColor");
  });

  it("carries whose word each agent takes, on the same poll (owner-only summons)", () => {
    // The rc announces its policy with its hold; the row reads THAT — the
    // value dispatch applies — and the add dialog reads whose rc it is.
    expect(poll).toMatch(/policies: r\.policies \?\? \{\}/);
    expect(poll).toContain("export function useRcPolicies");
    expect(poll).toContain("export function useRcOwners");
    expect(row).toMatch(/policyWords\(policy, nameOf, viewer, joined\)/);
    // No promise to a reader the rc will turn away: who it answers, and who
    // can change that, instead of "answers if you comment".
    expect(row).toMatch(/shut\s*\?/);
    expect(row).toContain("to let you in");
    // The owner's widening is offered to the owner only.
    expect(row).toMatch(/owns && onListen/);
  });

  it("does not make them differ by text alone", () => {
    // The state word and the sub-line were the whole difference before, and
    // both are read rather than scanned.
    const block = css.slice(css.indexOf(".wb-dot.hollow.ready"));
    expect(block.slice(0, 200)).toMatch(/box-shadow|background/);
  });
});
