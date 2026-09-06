import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("../src/cloud-desk.ts", import.meta.url)), "utf8");
const lines = source.split("\n");

/**
 * **Every write of a badge document goes through `denormalize()`.**
 *
 * Step 5 of `docs/research/2026-09-06-architecture-review.md`, and the reason
 * it is a test rather than a better sentence.
 *
 * The file used to promise "nothing writes a badge except `writeBadge`", and
 * by September that was false: `mutate`, `killBadge` and the claim transaction
 * had each grown a `tx.set` of their own — four write sites where the comment
 * said one. **The invariant had not broken; its statement had**, which is
 * worse than an ordinary stale comment, because the sentence went on to tell a
 * reviewer their whole job on the file was to confirm there is one writer.
 * Somebody doing that job would conclude the file was broken — or, having
 * satisfied themselves it was fine, add a fifth writer by yet another path.
 *
 * Phase 3's warning is what is actually at stake: `claimIds`, `claimKeys`,
 * `admittedTo` and `attested` are `array-contains` queries here and a
 * whole-table scan everywhere else, and a CloudDesk that does not write them
 * on every claim and every admission **passes the whole suite on a FileDesk
 * and answers nothing in the cloud**. A badge written without `denormalize`
 * would be exactly that, and no assertion through the `Desk` interface would
 * see it.
 *
 * `cloud-desk-arrays.test.ts` checks the arrays are RIGHT, by reading raw
 * documents — but it needs a Firestore emulator, so on most machines and most
 * pull requests it does not run at all. This one reads the source and needs
 * nothing, which is the point: the guard that catches a fifth writer has to
 * run where the fifth writer is written.
 */

/**
 * The badge document's write sites, resolved rather than grepped.
 *
 * Three shapes reach a document here and all three must be seen: a chained
 * `db.collection(BADGES).doc(id).set(…)`, a `tx.set(ref, …)` naming its ref as
 * the first ARGUMENT, and a plain `ref.set(…)`. Anything with `.set(` that
 * none of those explain comes back as **unresolved** rather than as "not a
 * badge write" — a resolver allowed to shrug is a guard that reports green
 * about code it never looked at, and the chained form was in fact invisible to
 * the first version of this.
 */
function writeSites(): { badge: string[]; unresolved: string[] } {
  const badge: string[] = [];
  const unresolved: string[] = [];
  // Every collection this file names, read out of it rather than restated, so
  // a new one added tomorrow resolves as itself instead of as a mystery.
  const collections = [...source.matchAll(/^export const ([A-Z_]+) = "/gm)].map((m) => m[1]!);
  for (const [i, text] of lines.entries()) {
    if (!text.includes(".set(")) continue;
    if (/^\s*(\*|\/\/)/.test(text)) continue; // prose about writes is not a write
    const at = `cloud-desk.ts:${i + 1}  ${text.trim()}`;
    // In-memory Maps, not documents.
    if (/\b(lastWrittenSeen|seen)\.set\(/.test(text)) continue;
    if (text.includes("BADGES")) {
      badge.push(at);
      continue;
    }
    // A chained write naming some other collection: resolved, and not a badge.
    if (collections.some((name) => text.includes(name))) continue;
    const named = /\btx\.set\((\w+),/.exec(text) ?? /\b(\w+)\.set\(/.exec(text);
    if (!named) {
      unresolved.push(at);
      continue;
    }
    const ref = named[1]!;
    let bound = false;
    for (let j = i - 1; j >= 0; j--) {
      if (!new RegExp(`const ${ref}\\s*=`).test(lines[j]!)) continue;
      bound = true;
      if (lines[j]!.includes("BADGES")) badge.push(at);
      break;
    }
    // A ref nobody can find the binding of is not a ref we may assume is safe.
    if (!bound) unresolved.push(at);
  }
  return { badge, unresolved };
}

/** `touch` merges `lastSeen` and nothing else — the one thing about a badge
 * that changes without any of the arrays changing, which is what makes a merge
 * safe there and nowhere else. Named here so the exception is a decision
 * rather than something the guard happens not to catch. */
const LAST_SEEN_MERGE = /\.set\(\{ lastSeen/;

describe("the badge document has one way in", () => {
  it("finds the write sites at all — the guard must not be vacuously green", () => {
    /**
     * The failure this test's own shape could have: a resolver that matches
     * nothing passes forever. There were four badge writes when this was
     * written; the assertion is "several", so adding a fifth legitimate one is
     * not a chore, but deleting them all is not silently fine either.
     */
    const { badge, unresolved } = writeSites();
    expect(badge.length, "no badge writes found — the resolver stopped working").toBeGreaterThanOrEqual(4);
    expect(unresolved, "the resolver could not classify these writes, so it cannot vouch for them").toEqual([]);
  });

  it("passes every badge write through denormalize()", () => {
    const skipped = writeSites().badge.filter(
      (w) => !w.includes("denormalize(") && !LAST_SEEN_MERGE.test(w),
    );
    expect(
      skipped,
      "these write a badge document without deriving its arrays. `claimIds`, `claimKeys`, " +
        "`admittedTo` and `attested` are queried with array-contains, so a badge written around " +
        "`denormalize` passes the whole suite on a FileDesk and answers nothing in the cloud.",
    ).toEqual([]);
  });

  it("names lastSeen as the one exception, and keeps it a leaf", () => {
    /**
     * `touch` merges `lastSeen` alone — the only thing about a badge that
     * changes without any of the arrays changing, which is what makes a merge
     * safe there and nowhere else. Written down here so the exception is a
     * decision rather than something the guard above happens not to catch.
     */
    const merge = lines.filter((l) => LAST_SEEN_MERGE.test(l));
    expect(merge, "the lastSeen merge moved or multiplied").toHaveLength(1);
    expect(merge[0]).toContain("{ merge: true }");
  });

  it("states the invariant a reviewer is asked to check", () => {
    /**
     * The comment is the interface to this rule for anybody who has not read
     * the review, so it is held to naming `denormalize` — not to avoiding the
     * old sentence, which the file quotes on purpose to say what changed.
     */
    expect(source, "the invariant is stated where a reviewer will read it").toContain(
      "every write of a badge document",
    );
    const stated = source.slice(source.indexOf("every write of a badge document"), source.indexOf("every write of a badge document") + 300);
    expect(stated, "and it names the function that enforces it").toContain("denormalize()");
  });
});
