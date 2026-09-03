import { describe, expect, it } from "vitest";
import type { Attestation, GrantSubject } from "../src/index.ts";
import {
  attestationSatisfying,
  attestedKindOf,
  barSubjectRefusal,
  grantRevokeRoute,
  grantRoute,
  grantSubjectOf,
  grantSubjectRefusal,
  groupIdOf,
  groupMemberRefusal,
  groupMemberRoute,
  groupNameRefusal,
  groupRoute,
  groupSubject,
  groupViewOf,
  isBar,
  isGroupSubject,
  LINK,
  normalizeAttribute,
  normalizeSubject,
  ownsGroup,
  upsertAttestation,
} from "../src/index.ts";

/**
 * **The grant subject, and what satisfies it** (identity desk, mechanism 3;
 * phase 9).
 *
 * Two halves that must agree, which is why they are one file. A grant's
 * subject and a badge's attestation are deliberately the same namespace, so
 * the door's test is string equality — and string equality is only honest if
 * both ends were written the same way. Everything here is about that agreement
 * failing invisibly: an invitation to `Jordan@Acme.Test` that never matches
 * the mailbox it names is a row that admits nobody while the dialog says
 * somebody was invited.
 *
 * Fixtures are synthetic: acme.test, and a made-up repository.
 */

const proof = (attribute: string, at = "2026-01-01T00:00:00.000Z"): Attestation => ({
  attribute,
  verifiedVia: "magic-link",
  at,
});

describe("what is a grant subject at all", () => {
  it("takes the three the design names", () => {
    expect(grantSubjectRefusal(LINK)).toBeNull();
    expect(grantSubjectRefusal("email:jordan@acme.test")).toBeNull();
    expect(grantSubjectRefusal("repo:github.com/acme/widgets")).toBeNull();
  });

  it("refuses shapes an attester could not be handed", () => {
    // An address, not a display name — the weakest check that still catches
    // somebody typing a person's name into a field that wants a mailbox.
    expect(grantSubjectRefusal("email:Jordan")).toMatch(/not an email address/);
    expect(grantSubjectRefusal("email:@acme.test")).toMatch(/not an email address/);
    expect(grantSubjectRefusal("email:jordan @acme.test")).toMatch(/not an email address/);
    // `<host>/<owner>/<name>` exactly: two segments would be ambiguous about
    // which host, and an ambiguous subject admits the wrong people.
    expect(grantSubjectRefusal("repo:acme/widgets")).toMatch(/not a repo/);
    expect(grantSubjectRefusal("repo:github.com//widgets")).toMatch(/not a repo/);
  });

  it("refuses a non-subject, and says what it expected", () => {
    expect(grantSubjectRefusal("")).toMatch(/a grant needs a subject/);
    expect(grantSubjectRefusal(undefined)).toMatch(/a grant needs a subject/);
    expect(grantSubjectRefusal("everyone")).toMatch(/not a grant subject/);
    // The PREFIX is our vocabulary and is never typed by a person, so a
    // mis-cased one is not a spelling of anything — see `normalizeAttribute`.
    expect(grantSubjectRefusal("EMAIL:jordan@acme.test")).toMatch(/not a grant subject/);
  });

  it("names which attester a subject needs, so a home can say what it lacks", () => {
    expect(attestedKindOf(LINK)).toBeNull();
    expect(attestedKindOf("email:jordan@acme.test")).toBe("email");
    expect(attestedKindOf("repo:github.com/acme/widgets")).toBe("repo");
  });

  it("takes a group by id, and only by id (roles phase 5)", () => {
    expect(grantSubjectRefusal(groupSubject("ppl_design"))).toBeNull();
    expect(isGroupSubject("group:ppl_design")).toBe(true);
    expect(groupIdOf("group:ppl_design")).toBe("ppl_design");
    expect(groupIdOf("email:jordan@acme.test")).toBeNull();
    // A name is what a person types and the CLI resolves; the wire carries
    // ids, because a route handed "design team" would have to guess whose.
    expect(grantSubjectRefusal("group:design team")).toMatch(/not a group id/);
    expect(grantSubjectRefusal("group:")).toMatch(/not a group id/);
    expect(grantSubjectRefusal("group:ppl_")).toMatch(/not a group id/);
    // `grp_` is a gesture group in the oplog, not a group of people.
    expect(grantSubjectRefusal("group:grp_1")).toMatch(/not a group id/);
  });

  it("is not an attested kind, so its id is never case-folded", () => {
    // `normalizeAttribute` lowercases every attested kind; an id must not
    // be, so `attestedKindOf` keeps answering null and the server's
    // `attesterRefusal` has a case of its own instead of leaning on that.
    expect(attestedKindOf("group:ppl_Ab")).toBeNull();
    expect(normalizeSubject("group:ppl_Ab")).toBe("group:ppl_Ab");
    // And core cannot answer it: membership needs the desk.
    expect(attestationSatisfying("group:ppl_1", [proof("group:ppl_1")])).toBeNull();
  });
});

describe("what a group may hold", () => {
  it("takes an address or a repo, normalized like a subject", () => {
    expect(groupMemberRefusal("email:jordan@acme.test")).toBeNull();
    expect(groupMemberRefusal("repo:github.com/acme/widgets")).toBeNull();
  });

  it("never the link, never another group, never a non-subject", () => {
    expect(groupMemberRefusal(LINK)).toMatch(/not the link/);
    expect(groupMemberRefusal("group:ppl_1")).toMatch(/not other groups/);
    expect(groupMemberRefusal("everyone")).toMatch(/not a grant subject/);
    expect(groupMemberRefusal("email:Jordan")).toMatch(/not an email address/);
  });

  it("is named like a space, and viewed with its size for everybody and its members for its maker", () => {
    expect(groupNameRefusal("")).toMatch(/needs a name/);
    expect(groupNameRefusal("Design\nTeam")).toMatch(/one line/);
    expect(groupNameRefusal("Design team")).toBeNull();
    const group = {
      id: "ppl_1",
      name: "Design team",
      createdBy: "usr_priya",
      members: ["email:jordan@acme.test", "email:sam@acme.test"],
      at: "2026-01-01T00:00:00.000Z",
    };
    expect(groupViewOf(group, false)).toEqual({ ...group, members: undefined, size: 2 });
    expect("members" in groupViewOf(group, false)).toBe(false);
    expect(groupViewOf(group, true)).toMatchObject({ size: 2, members: group.members });
    expect(ownsGroup(group, "usr_priya")).toBe(true);
    expect(ownsGroup(group, "usr_sam")).toBe(false);
  });

  it("spells the routes once, with the member encoded on the path", () => {
    expect(groupRoute("ppl_1")).toBe("/api/groups/ppl_1");
    expect(groupMemberRoute("ppl_1", "email:jordan@acme.test")).toBe(
      "/api/groups/ppl_1/members/email%3Ajordan%40acme.test",
    );
  });
});

describe("what somebody typed, as a subject", () => {
  /**
   * `grantSubjectOf` lived in the CLI through phase 9 stage 1 with a note
   * saying it would move here "when the field lands — it is the same question
   * asked twice at that point". The Share dialog's "who" field landed in stage
   * 2, so it moved: two surfaces asking one question is exactly AGENTS.md's
   * rule about shared computation, at the smallest possible scale.
   */
  it("reads an address as an email and a three-part path as a repo", () => {
    expect(grantSubjectOf("jordan@acme.test")).toBe("email:jordan@acme.test");
    expect(grantSubjectOf("github.com/acme/widgets")).toBe("repo:github.com/acme/widgets");
    // Already spelled: left exactly as it was, so a caller that knows the
    // vocabulary is not second-guessed.
    expect(grantSubjectOf("email:jordan@acme.test")).toBe("email:jordan@acme.test");
    expect(grantSubjectOf("repo:github.com/acme/widgets")).toBe("repo:github.com/acme/widgets");
    expect(grantSubjectOf("  jordan@acme.test  ")).toBe("email:jordan@acme.test");
  });

  it("passes anything else through untouched, so the refusal is about what was typed", () => {
    // Guessing here would make the home's refusal about something the person
    // did not write. `grantSubjectRefusal` is the judge of shape.
    expect(grantSubjectOf("everyone")).toBe("everyone");
    expect(grantSubjectRefusal(grantSubjectOf("everyone"))).toMatch(/not a grant subject/);
    // And it does NOT normalize: that is `normalizeSubject`, applied at the
    // daemon, once, where the row is written.
    expect(grantSubjectOf("Jordan@Acme.Test")).toBe("email:Jordan@Acme.Test");
  });
});

describe("one spelling, both ends", () => {
  it("folds the value's case, because one mailbox is one person", () => {
    expect(normalizeSubject("email:Jordan@Acme.Test" as GrantSubject)).toBe(
      "email:jordan@acme.test",
    );
    expect(normalizeAttribute("repo:github.com/Acme/Widgets")).toBe(
      "repo:github.com/acme/widgets",
    );
    expect(normalizeAttribute("  email:jordan@acme.test  ")).toBe("email:jordan@acme.test");
  });

  it("leaves `link` and anything unrecognised exactly as it found them", () => {
    expect(normalizeSubject(LINK)).toBe(LINK);
    // Not ours to fold: an unrecognised string is passed through so the
    // refusal a caller reads is about what they actually wrote.
    expect(normalizeAttribute("Everyone")).toBe("Everyone");
  });
});

describe("what satisfies a grant", () => {
  it("matches an attestation of the same attribute, however either was cased", () => {
    expect(
      attestationSatisfying("email:jordan@acme.test", [proof("email:Jordan@Acme.Test")]),
    ).toMatchObject({ verifiedVia: "magic-link" });
    expect(
      attestationSatisfying("repo:github.com/acme/widgets" as GrantSubject, [
        proof("repo:github.com/Acme/Widgets"),
      ]),
    ).not.toBeNull();
  });

  it("is equality and never a family resemblance", () => {
    // A `repo:` subject is "can read exactly this repository", not "is in this
    // org" — an org-wide reading would silently widen every marker anybody
    // ever committed.
    expect(
      attestationSatisfying("repo:github.com/acme/widgets" as GrantSubject, [
        proof("repo:github.com/acme/other"),
      ]),
    ).toBeNull();
    expect(
      attestationSatisfying("email:jordan@acme.test", [proof("email:jordan@other.test")]),
    ).toBeNull();
    expect(attestationSatisfying("email:jordan@acme.test", [])).toBeNull();
  });

  it("never answers for `link`, which is about the request and not the holder", () => {
    // Presenting the address is its own proof, and this function only ever
    // sees the holder. `server/grants.ts` keeps that branch where the request
    // is, and a badge that somehow attested "link" gets nothing for it.
    expect(attestationSatisfying(LINK, [proof(LINK)])).toBeNull();
  });
});

describe("a badge accumulates proofs without piling them up", () => {
  it("replaces an earlier proof of the same attribute, and keeps the others", () => {
    let held = upsertAttestation(undefined, proof("email:jordan@acme.test"));
    held = upsertAttestation(held, proof("repo:github.com/acme/widgets"));
    held = upsertAttestation(held, {
      attribute: "email:Jordan@Acme.Test",
      verifiedVia: "google",
      at: "2026-02-01T00:00:00.000Z",
    });

    expect(held).toHaveLength(2);
    const email = held.find((row) => row.attribute === "email:jordan@acme.test")!;
    // One proof and a fresher date, never two rows — the second is not a
    // second proof, it is a stale copy of the first.
    expect(email.verifiedVia).toBe("google");
    expect(email.at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("normalizes on the way in, so the door never folds anything at request time", () => {
    const held = upsertAttestation([], proof("  email:Jordan@Acme.Test  "));
    expect(held[0]!.attribute).toBe("email:jordan@acme.test");
  });
});

/**
 * **The bar** (roles design, "The bar"; roles phase 3): a row that says no.
 * Its subject rule is the invitation's plus two refusals of its own, and the
 * two come FIRST so that a subject the shape check does not know yet is
 * still refused as a bar when it arrives.
 */
describe("what a bar may name", () => {
  it("takes an address or a repo, like an invitation", () => {
    expect(barSubjectRefusal("email:sam@acme.test")).toBeNull();
    expect(barSubjectRefusal("repo:github.com/acme/widgets")).toBeNull();
  });

  it("never the link — that is the link turned off", () => {
    expect(barSubjectRefusal(LINK)).toMatch(/link cannot be kept out/);
  });

  it("never a group, whether or not the shape check likes it", () => {
    // Barring a group is un-inviting it. The bar's refusal came before
    // `group:` was a grant subject at all (roles phase 5) and never leaned
    // on the shape check, so a well-formed id and a malformed one are
    // refused alike.
    expect(barSubjectRefusal("group:ppl_1")).toMatch(/group cannot be kept out/);
    expect(barSubjectRefusal("group:design team")).toMatch(/group cannot be kept out/);
  });

  it("still refuses what is not a subject at all", () => {
    expect(barSubjectRefusal("everyone")).toMatch(/not a grant subject/);
    expect(barSubjectRefusal("email:Sam")).toMatch(/not an email address/);
  });

  it("is `bars: true` or nothing", () => {
    expect(isBar({ bars: true })).toBe(true);
    expect(isBar({})).toBe(false);
  });
});

describe("the revoke route carries what a bodiless DELETE has to say", () => {
  it("is the plain route with nothing to say", () => {
    expect(grantRevokeRoute("prj_a", "gnt_1")).toBe(grantRoute("prj_a", "gnt_1"));
  });

  it("spells the actor and the bar once, for the browser, the CLI and the forwarder", () => {
    expect(grantRevokeRoute("prj_a", "gnt_1", { actorId: "usr_p" })).toBe(
      `${grantRoute("prj_a", "gnt_1")}?actorId=usr_p`,
    );
    expect(grantRevokeRoute("prj_a", "gnt_1", { bar: true })).toBe(`${grantRoute("prj_a", "gnt_1")}?bar=1`);
    expect(grantRevokeRoute("prj_a", "gnt_1", { actorId: "usr_p", bar: true })).toBe(
      `${grantRoute("prj_a", "gnt_1")}?actorId=usr_p&bar=1`,
    );
    expect(grantRevokeRoute("prj_a", "gnt_1", { bar: false })).toBe(grantRoute("prj_a", "gnt_1"));
  });
});
