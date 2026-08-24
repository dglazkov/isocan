import { describe, expect, it } from "vitest";
import { ISOCAN_NAMES, allocateName, harnessOf } from "../src/index.ts";
import type { ClaimContext, NameHolder } from "../src/claims.ts";

/**
 * **A name that starts the way your harness does.**
 *
 * Three agents called Isaac, Kenny and Nico tell a person nothing about which
 * is which, and the person is the one who has to @-mention the right one.
 *
 * The initial only, never the vendor's name: `--agent-help` is emphatic that
 * "Claude", "GPT" and "Gemini" are all wrong as names, and any harness must be
 * able to run that guide. The cost is real and was taken deliberately — after
 * a week "Charlie" does read as "the Claude one" — so what these cases pin
 * down is that it stays a HINT: the roster is the agent's, the fallbacks hold,
 * and nothing about allocation stops answering.
 */

function ctx(taken: string[] = [], preferred?: string): ClaimContext {
  const held: NameHolder[] = taken.map((name, i) => ({
    actor: { id: `usr_${i}`, name },
    canvas: "Acme",
    live: true,
  }));
  return {
    held,
    scoped: [],
    registry: { names: {} },
    now: "2026-08-24T00:00:00.000Z",
    ...(preferred !== undefined ? { preferred } : {}),
  } as unknown as ClaimContext;
}

describe("the harness out of the session key", () => {
  it("reads the half before the colon", () => {
    // Keys are `<harness>:<session id>` — no new field on the op, and every
    // replica replaying the same claim derives the same letter, which is what
    // keeps allocation deterministic on both surfaces.
    expect(harnessOf("claude-code:abc-123")).toBe("claude-code");
    expect(harnessOf("gemini:xyz")).toBe("gemini");
  });

  it("answers null rather than guessing when there is no harness in it", () => {
    for (const key of [undefined, "", ":", "  :x"]) {
      expect(harnessOf(key), JSON.stringify(key)).toBeNull();
    }
  });
});

describe("a name that starts the way the harness does", () => {
  it("gives Claude a C name", () => {
    expect(allocateName(ctx(), "claude-code")).toBe("Charlie");
  });

  it("gives the SECOND Claude the next C name, not a numbered one", () => {
    // The whole reason the letter has a roster rather than one name.
    expect(allocateName(ctx(["Charlie"]), "claude-code")).toBe("Cass");
    expect(allocateName(ctx(["Charlie", "Cass"]), "claude-code")).toBe("Cleo");
  });

  it("lets two harnesses share a letter without a rule of their own", () => {
    // `claude-code` and `codex` both start with C. Skipping what is taken is
    // the only mechanism needed.
    const withClaudes = ctx(["Charlie", "Cass"]);
    expect(allocateName(withClaudes, "codex")).toBe("Cleo");
  });

  it("falls through to the isocan roster when a letter is used up", () => {
    // Allocation's one promise is that it always answers.
    const full = ctx(["Charlie", "Cass", "Cleo"]);
    expect(ISOCAN_NAMES).toContain(allocateName(full, "claude-code"));
  });

  it("starts at the isocan roster for a harness with no letter of ours", () => {
    for (const harness of [undefined, null, "", "7734", "  "]) {
      expect(allocateName(ctx(), harness), JSON.stringify(harness)).toBe(ISOCAN_NAMES[0]);
    }
  });

  it("still answers when every name in sight is taken", () => {
    // The numbered rounds. A guard against the letter roster introducing a
    // path where allocation can fail to produce anything.
    const everything = ctx([...ISOCAN_NAMES, "Charlie", "Cass", "Cleo"]);
    const name = allocateName(everything, "claude-code");
    expect(name).toBeTruthy();
    expect(everything.held.map((h) => h.actor.name)).not.toContain(name);
  });

  it("is case-insensitive about what is taken, like the rest of naming", () => {
    expect(allocateName(ctx(["charlie"]), "claude-code")).toBe("Cass");
    expect(allocateName(ctx(), "CLAUDE-CODE")).toBe("Charlie");
  });
});

describe("the home's answer still outranks the initial", () => {
  it("takes `preferred` over a letter name", () => {
    // `preferred` is the home's answer about a namespace this machine cannot
    // see — a replica's local scope makes every roster name look free. A
    // legible initial is not worth handing out a name that is taken where it
    // counts.
    expect(allocateName(ctx([], "Nico"), "claude-code")).toBe("Nico");
  });

  it("but not a `preferred` that is already taken here", () => {
    // The promise allocation keeps even when the home's answer went stale.
    expect(allocateName(ctx(["Nico"], "Nico"), "claude-code")).toBe("Charlie");
  });
});
