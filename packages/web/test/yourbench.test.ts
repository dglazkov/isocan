import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BENCH_REACH } from "@isocan/core";
import { withoutComments } from "../../../test/source.ts";

/**
 * **Two surfaces, one derivation — the bench's half of it.**
 *
 * `agenttray.test.ts` guards the same thing one level down and says why: the
 * moment a panel works out for itself what a state means, the terminal and the
 * canvas can disagree about the same agent, and the person believes whichever
 * one they are looking at. The bench's whole claim in journey 1 is that *"the
 * same three rows, the same three states, because it is the same derivation"*
 * — so a panel that computed a state of its own would not be a bug in a
 * rendering, it would be the feature not existing.
 *
 * `benchRows()` in `@isocan/core` is that derivation, and it is a fourth
 * caller of `roster()` rather than a fourth implementation of it.
 */
const src = (rel: string) =>
  withoutComments(readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8"));
const panel = src("components/YourBench.tsx");
const cli = withoutComments(
  readFileSync(fileURLToPath(new URL("../../cli/src/bench.ts", import.meta.url)), "utf8"),
);

describe("Your bench shows what the terminal would print", () => {
  it("asks core for the rows, and for the words under each", () => {
    expect(panel).toMatch(/benchRows\(/);
    expect(panel).toMatch(/benchAgents\(/);
    expect(panel).toMatch(/benchWords\(row\)/);
    // The CLI reads the same one. Two callers of one function is the whole
    // design; two functions that agree today is the drift it prevents.
    expect(cli).toMatch(/benchRows\(/);
    expect(cli).toMatch(/benchWords\(/);
  });

  it("computes no state of its own — not the three words, not the fold beneath them", () => {
    /**
     * The panel may name `row.reach` (it puts it on a class) and must never
     * SPELL one of its values: a literal here is a branch, and a branch here
     * is a second derivation waiting to disagree with `isocan bench`.
     */
    for (const state of BENCH_REACH) {
      expect(panel, `the panel must not decide what "${state}" means`).not.toContain(`"${state}"`);
      expect(panel).not.toContain(`'${state}'`);
    }
    // And it must not reach past `benchRows` to the fold underneath: the
    // roster and the session state are core's business, asked once.
    expect(panel).not.toMatch(/\broster\(/);
    expect(panel).not.toMatch(/sessionState\(/);
  });

  it("passes what it can measure and claims nothing it cannot", () => {
    // The connection-bound holds are what a browser CAN see, and without them
    // every standing row reads `enrolled` and no bench row could ever be
    // ready — the exact bug `answerable.ts` exists to have fixed once.
    expect(panel).toMatch(/fetchRcAnswering\(/);
    expect(panel).toMatch(/answerable: new Set\(/);
    // The machine-local running half is not readable from a tab, so it is
    // passed empty rather than guessed at. `benchRows` is still the one that
    // decides what an empty set means.
    expect(panel).toMatch(/new Set<string>\(\)/);
  });

  it("hangs off the identity menu, which is where a person's own things live", () => {
    const menu = src("components/IdentityMenu.tsx");
    expect(menu).toMatch(/import \{ YourBench \}/);
    expect(menu).toContain("Your bench…");
    // No canvas in the condition: a bench belongs to a person, and the two
    // dialogs above it that DO need one say so (`terminal && canvasId`).
    expect(menu).toMatch(/if \(bench\) return <YourBench actor=\{actor\} onClose=\{onClose\} \/>;/);
  });
});
