import { describe, expect, it } from "vitest";
import {
  cidrContains,
  parseCidr,
  parseRefusalDuration,
  refusalInForce,
  refusalSentence,
  refusalSubjectOf,
  refusalSubjectRefusal,
  refusalUntil,
  subjectShown,
  type HomeRefusal,
} from "../src/refusal.ts";

/**
 * **The pure half of "refuse at the door"** (operator phase 6) — what a
 * subject is, whether an address is inside a network, how long `--for` lasts,
 * and the sentence the refused person reads. The acting is walked against a
 * real daemon in `packages/server/test/operator-refuse.test.ts`; this is the
 * arithmetic those tests stand on.
 *
 * Fixtures are synthetic: example.test, 203.0.113.0/24 (TEST-NET-3), 2001:db8.
 */

describe("what a refusal subject is", () => {
  it("normalizes an address the way the door and attestations do", () => {
    expect(refusalSubjectOf("email:Sam@Example.test")).toEqual({
      subject: "email:sam@example.test",
      kind: "email",
    });
    expect(refusalSubjectOf("repo:GitHub.com/Acme/Site")).toEqual({
      subject: "repo:github.com/acme/site",
      kind: "repo",
    });
  });

  it("keeps an actor id case-sensitive — ppl_Ab and ppl_ab are two rows", () => {
    expect(refusalSubjectOf("actor:usr_Ab12")).toEqual({ subject: "actor:usr_Ab12", kind: "actor" });
    // Needs an id shape, not a bare word.
    expect(refusalSubjectOf("actor:nobody")).toBeNull();
  });

  it("parses and re-spells a network from its bits, so one row covers the range", () => {
    expect(refusalSubjectOf("net:203.0.113.7/24")).toEqual({
      subject: "net:203.0.113.0/24",
      kind: "net",
    });
    expect(refusalSubjectOf("net:2001:db8:abcd::1/32")).toEqual({
      subject: "net:2001:db8::/32",
      kind: "net",
    });
    // A bare address is that address alone.
    expect(refusalSubjectOf("net:203.0.113.7")?.subject).toBe("net:203.0.113.7/32");
  });

  it("refuses what it cannot read, and says which kind was wrong", () => {
    expect(refusalSubjectOf("net:garbage")).toBeNull();
    expect(refusalSubjectRefusal("net:garbage")).toContain("not a network");
    expect(refusalSubjectRefusal("actor:nope")).toContain("not an actor id");
    expect(refusalSubjectRefusal("email:not-an-address")).toContain("not an address");
    expect(refusalSubjectRefusal("just-a-word")).toContain("one of four things");
    expect(refusalSubjectRefusal("email:sam@example.test")).toBeNull();
  });
});

describe("a network as a range", () => {
  it("contains the addresses inside it and no others", () => {
    const cidr = parseCidr("203.0.113.0/24")!;
    expect(cidrContains(cidr, "203.0.113.7")).toBe(true);
    expect(cidrContains(cidr, "203.0.113.255")).toBe(true);
    expect(cidrContains(cidr, "203.0.114.1")).toBe(false);
    // A v6 address is never inside a v4 network, and a malformed one never is.
    expect(cidrContains(cidr, "2001:db8::1")).toBe(false);
    expect(cidrContains(cidr, "not-an-ip")).toBe(false);
  });

  it("reads an IPv4-mapped IPv6 address as the v4 it wraps", () => {
    const cidr = parseCidr("203.0.113.0/24")!;
    // A dual-stack socket can report this shape for a v4 client.
    expect(cidrContains(cidr, "::ffff:203.0.113.9")).toBe(true);
  });

  it("contains inside a v6 network", () => {
    const cidr = parseCidr("2001:db8::/32")!;
    expect(cidrContains(cidr, "2001:db8:1234::abcd")).toBe(true);
    expect(cidrContains(cidr, "2001:db9::1")).toBe(false);
  });
});

describe("--for as a duration", () => {
  it("reads one unit and a whole number", () => {
    expect(parseRefusalDuration("30s")).toBe(30_000);
    expect(parseRefusalDuration("10m")).toBe(600_000);
    expect(parseRefusalDuration("24h")).toBe(86_400_000);
    expect(parseRefusalDuration("7d")).toBe(604_800_000);
  });
  it("refuses a duration that is zero, bare, or misspelled", () => {
    expect(parseRefusalDuration("0m")).toBeNull();
    expect(parseRefusalDuration("10")).toBeNull();
    expect(parseRefusalDuration("soon")).toBeNull();
    expect(parseRefusalDuration("10 m")).toBeNull();
  });
});

describe("in force, judged against a clock", () => {
  const at = "2026-09-12T00:00:00.000Z";
  const expiresAt = "2026-09-12T00:10:00.000Z"; // ten minutes on
  it("is in force before the horizon and not after", () => {
    expect(refusalInForce({ expiresAt }, Date.parse("2026-09-12T00:05:00Z"))).toBe(true);
    expect(refusalInForce({ expiresAt }, Date.parse("2026-09-12T00:11:00Z"))).toBe(false);
  });
  it("a lifted row is never in force, whatever the clock says", () => {
    expect(refusalInForce({ liftedAt: at }, 0)).toBe(false);
  });
  it("a row with no horizon is in force until it is lifted", () => {
    expect(refusalInForce({}, Number.MAX_SAFE_INTEGER)).toBe(true);
  });
});

describe("the sentence the refused person reads", () => {
  const base: HomeRefusal = {
    subject: "email:sam@example.test",
    kind: "email",
    at: "2026-09-12T09:00:00.000Z",
    reason: "harassment",
    by: "email:olu@example.test",
    actId: "opr_1",
  };
  it("names the address, the date, the category and who to write to", () => {
    const said = refusalSentence(base);
    expect(said).toContain("will not admit sam@example.test");
    expect(said).toContain("12 September 2026");
    expect(said).toContain("harassment");
    expect(said).toContain("Write to olu@example.test");
  });
  it("says the network and when it ends", () => {
    const said = refusalSentence({
      ...base,
      subject: "net:203.0.113.0/24",
      kind: "net",
      expiresAt: "2026-09-13T09:15:00.000Z",
    });
    expect(said).toContain("will not admit 203.0.113.0/24");
    expect(said).toContain("the network");
    expect(said).toContain("13 September 2026 09:15 UTC");
  });
  it("subjectShown drops the kind prefix and refusalUntil carries the minute", () => {
    expect(subjectShown({ subject: "actor:usr_ab", kind: "actor" })).toBe("usr_ab");
    expect(refusalUntil("2026-09-13T09:05:00.000Z")).toBe("13 September 2026 09:05 UTC");
  });
});
