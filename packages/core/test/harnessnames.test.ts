import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ISOCAN_NAMES, allocateName, harnessOf } from "../src/index.ts";

/** The C roster, read from the source so this file cannot drift from it. */
const INITIAL_NAMES_C = (() => {
  const src = readFileSync(fileURLToPath(new URL("../src/claims.ts", import.meta.url)), "utf8");
  const line = /\n  c: \[(.*?)\],/.exec(src);
  if (!line) throw new Error("could not read the C roster out of claims.ts");
  return line[1]!.split(",").map((n) => n.trim().replace(/"/g, ""));
})();
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
  const key = (harness: string, id = "s-1") => `${harness}:${id}`;

  it("gives Claude a C name", () => {
    expect(allocateName(ctx(), key("claude-code"))[0]).toBe("C");
  });

  it("gives the SECOND Claude another C name, not a numbered one", () => {
    // The whole reason a letter has a ROSTER rather than one name. Which C
    // name each gets is where its session key hashes in; that they differ, and
    // that neither is "Charlie 2", is the promise.
    const first = allocateName(ctx(), key("claude-code", "s-1"));
    const second = allocateName(ctx([first]), key("claude-code", "s-2"));
    expect(second[0]).toBe("C");
    expect(second).not.toBe(first);
    expect(second).not.toMatch(/ \d+$/);
  });

  it("seats eight Claudes before any of them is numbered", () => {
    // Eight per letter, so a real team of same-harness agents never sees a
    // numbered name. The ninth falls through to the isocan roster, which is
    // still not a number.
    const taken: string[] = [];
    for (let i = 0; i < 8; i++) {
      const name = allocateName(ctx(taken), key("claude-code", `s-${i}`));
      expect(name[0], `${name} left the C roster at agent ${i + 1}`).toBe("C");
      expect(taken, `${name} handed out twice`).not.toContain(name);
      taken.push(name);
    }
    expect(taken).toHaveLength(8);
  });

  it("lets two harnesses share a letter without a rule of their own", () => {
    // `claude-code` and `codex` both start with C. Skipping what is taken is
    // the only mechanism needed.
    const claude = allocateName(ctx(), key("claude-code"));
    const codex = allocateName(ctx([claude]), key("codex", "t-1"));
    expect(codex[0]).toBe("C");
    expect(codex).not.toBe(claude);
  });

  it("falls through to the isocan roster when a letter is used up", () => {
    // Allocation's one promise is that it always answers.
    const allC = INITIAL_NAMES_C;
    expect(ISOCAN_NAMES).toContain(allocateName(ctx(allC), key("claude-code")));
  });

  it("starts at the isocan roster for a harness with no letter of ours", () => {
    for (const k of [undefined, null, "", "7734:s-1", "  "]) {
      expect(ISOCAN_NAMES, JSON.stringify(k)).toContain(allocateName(ctx(), k));
    }
  });

  it("still answers when every name in sight is taken", () => {
    // The numbered rounds, and the guard against the roster introducing a path
    // where allocation produces nothing.
    const everything = ctx([...ISOCAN_NAMES, ...INITIAL_NAMES_C]);
    const name = allocateName(everything, key("claude-code"));
    expect(name).toBeTruthy();
    expect(everything.held.map((h) => h.actor.name)).not.toContain(name);
  });

  it("is case-insensitive about what is taken, like the rest of naming", () => {
    const first = allocateName(ctx(), key("claude-code"));
    expect(allocateName(ctx([first.toLowerCase()]), key("claude-code"))).not.toBe(first);
    expect(allocateName(ctx(), key("CLAUDE-CODE"))).toBe(first);
  });
});

/**
 * The half of the question that is new: allocation no longer walks from index
 * zero, so two claimants who cannot see each other do not both reach for the
 * same first name.
 */
describe("where allocation enters the roster", () => {
  it("spreads across the roster rather than always taking the head", () => {
    // Twenty distinct sessions into an EMPTY scope — nothing is taken, so
    // in-order allocation would hand every one of them the same name.
    const got = new Set(
      Array.from({ length: 20 }, (_, i) => allocateName(ctx(), `claude-code:s-${i}`)),
    );
    expect(got.size, `all twenty landed on ${[...got]}`).toBeGreaterThan(1);
    for (const name of got) expect(name[0]).toBe("C");
  });

  it("is stable: the same session key always gets the same name", () => {
    // Not `Math.random()`. A session that re-claims where its name is free
    // gets the name it had — and a test asserting a name is asserting
    // something real rather than the weather.
    const once = allocateName(ctx(), "claude-code:steady");
    for (let i = 0; i < 5; i++) {
      expect(allocateName(ctx(), "claude-code:steady")).toBe(once);
    }
  });

  it("still never hands out a name that is taken", () => {
    // The entry point moved; the skipping did not.
    const first = allocateName(ctx(), "gemini:a");
    const second = allocateName(ctx([first]), "gemini:a");
    expect(second).not.toBe(first);
  });
});
