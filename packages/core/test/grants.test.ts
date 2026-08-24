import { describe, expect, it } from "vitest";
import type { Attestation, GrantSubject } from "../src/index.ts";
import {
  attestationSatisfying,
  attestedKindOf,
  grantSubjectRefusal,
  LINK,
  normalizeAttribute,
  normalizeSubject,
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
