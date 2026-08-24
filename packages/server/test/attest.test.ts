import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createSign } from "node:crypto";
import {
  attesterRefusal,
  attestersOf,
  BadIdTokenError,
  resolveAuth,
  verifyIdToken,
} from "../src/attest.ts";

/**
 * **Borrowing an attester** — the verification the whole of phase 9 stage 2
 * stands on (identity desk, mechanism 3).
 *
 * These sign REAL tokens with a REAL key pair and put them through the same
 * `verifyIdToken` an arrival from Identity Platform goes through. Nothing is
 * stubbed: the signature is checked, the issuer and audience are compared, the
 * expiry is judged. What is injected is the key SOURCE, because Node can parse
 * an X.509 certificate and not mint one — see `SigningKeys` in `attest.ts` for
 * why that seam exists and what it is deliberately not.
 *
 * The refusals are asserted one at a time rather than as "it throws", because
 * they are the whole point: a caller holding a token that will never work
 * needs to know WHICH of its assumptions is wrong, and "the wrong project",
 * "expired" and "the provider never confirmed that address" are three
 * different things to go and fix.
 */

const PROJECT = "isocan-io-dev";
const auth = { project: PROJECT, apiKey: "browser-key-not-a-secret" };

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "kid_1";
const keys = { [KID]: publicKey.export({ type: "spki", format: "pem" }) as string };

const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);

/** A token exactly as Identity Platform mints one, with whatever this test
 * wants to be wrong about it. */
function token(claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}): string {
  const head = b64({ alg: "RS256", kid: KID, typ: "JWT", ...header });
  const body = b64({
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: "uid_jordan",
    iat: Math.floor(NOW / 1000) - 60,
    exp: Math.floor(NOW / 1000) + 3600,
    email: "jordan@acme.test",
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    ...claims,
  });
  const signer = createSign("RSA-SHA256");
  signer.update(`${head}.${body}`);
  return `${head}.${body}.${signer.sign(privateKey).toString("base64url")}`;
}

const b64 = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");

const refused = async (raw: string, matching: RegExp): Promise<void> => {
  await expect(verifyIdToken(raw, auth, keys, NOW)).rejects.toThrow(BadIdTokenError);
  await expect(verifyIdToken(raw, auth, keys, NOW)).rejects.toThrow(matching);
};

describe("verifying an ID token", () => {
  it("turns a good one into an attestation in the grant-subject namespace", async () => {
    const attestation = await verifyIdToken(token(), auth, keys, NOW);
    // `email:<addr>`, not a bare address: a grant's subject IS an attribute,
    // so the door's question is string equality over one namespace.
    expect(attestation.attribute).toBe("email:jordan@acme.test");
    expect(attestation.at).toBe(new Date(NOW).toISOString());
  });

  it("normalizes the address, because the door compares by equality", async () => {
    // `Jordan@Acme.Test` and `jordan@acme.test` are one mailbox. A door that
    // compared them raw would refuse the person it had just invited, and would
    // do it invisibly — the row is there, the attestation is there, nothing
    // matches.
    const attestation = await verifyIdToken(
      token({ email: "Jordan@Acme.Test" }),
      auth,
      keys,
      NOW,
    );
    expect(attestation.attribute).toBe("email:jordan@acme.test");
  });

  it("names the attester in this codebase's words, not the provider's", async () => {
    // `password` is Identity Platform's name for the provider FAMILY that
    // email-link sign-in belongs to. Recording it verbatim would be a lie
    // about a home that has `passwordRequired: false` — there is no password.
    expect((await verifyIdToken(token(), auth, keys, NOW)).verifiedVia).toBe("magic-link");
    expect(
      (
        await verifyIdToken(
          token({ firebase: { sign_in_provider: "google.com" } }),
          auth,
          keys,
          NOW,
        )
      ).verifiedVia,
    ).toBe("google");
    expect(
      (
        await verifyIdToken(
          token({ firebase: { sign_in_provider: "github.com" } }),
          auth,
          keys,
          NOW,
        )
      ).verifiedVia,
    ).toBe("github");
    // Anything unrecognised passes through: the roster of attesters is
    // configuration, not a type, and a union would need editing every time a
    // home borrowed a new one.
    expect(
      (
        await verifyIdToken(
          token({ firebase: { sign_in_provider: "apple.com" } }),
          auth,
          keys,
          NOW,
        )
      ).verifiedVia,
    ).toBe("apple.com");
  });

  it("refuses a token signed by anybody else", async () => {
    const impostor = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const head = b64({ alg: "RS256", kid: KID, typ: "JWT" });
    const body = b64({
      iss: `https://securetoken.google.com/${PROJECT}`,
      aud: PROJECT,
      exp: Math.floor(NOW / 1000) + 3600,
      email: "jordan@acme.test",
      email_verified: true,
    });
    const signer = createSign("RSA-SHA256");
    signer.update(`${head}.${body}`);
    const forged = `${head}.${body}.${signer.sign(impostor.privateKey).toString("base64url")}`;
    await refused(forged, /signature/);
  });

  it("refuses a token from SOMEBODY ELSE'S project, however well signed", async () => {
    // The check that makes the configuration mean something. Anybody can
    // create an Identity Platform project and mint perfectly valid tokens in
    // it; without this, "an attester says so" would mean "any Google project
    // says so", which is not an attester at all.
    await refused(token({ iss: "https://securetoken.google.com/somebody-else" }), /only trusts/);
    await refused(token({ aud: "somebody-else" }), /different project/);
  });

  it("refuses an expired one, with a minute of skew in the generous direction", async () => {
    await refused(token({ exp: Math.floor(NOW / 1000) - 120 }), /expired/);
    // Thirty seconds past, which is a clock and not a replay.
    await expect(
      verifyIdToken(token({ exp: Math.floor(NOW / 1000) - 30 }), auth, keys, NOW),
    ).resolves.toBeTruthy();
  });

  it("refuses an address the provider has not confirmed", async () => {
    // The attribute is *controls this mailbox*. A GitHub account carrying an
    // unverified address has proved that somebody signed in, not that they
    // read that inbox — and an `email:` grant names the second thing.
    await refused(token({ email_verified: false }), /not confirmed/);
    await refused(token({ email: "" }), /no email address/);
  });

  it("refuses a key it does not know, and says why that can happen", async () => {
    await refused(token({}, { kid: "kid_rotated" }), /rotates/);
  });

  it("refuses something that is not a token at all", async () => {
    await refused("", /not a JWT/);
    await refused("just.two", /not a JWT/);
    await refused("aaa.bbb.ccc", /not readable/);
  });

  it("pins the algorithm rather than reading it from the header", async () => {
    // `alg: none` is the oldest JWT attack and the header is the attacker's to
    // write. The verifier never reads `alg`, so a token claiming one is
    // checked as RS256 like every other and fails on its signature.
    await refused(token({}, { alg: "none" }).replace(/\.[^.]+$/, "."), /signature/);
  });
});

describe("what a home has borrowed", () => {
  it("is configuration, and both halves are needed", () => {
    expect(resolveAuth({})).toBeNull();
    // Half-configured is a home whose browser cannot start a sign-in, so
    // offering `email:` grants there would write rows nobody can satisfy.
    expect(resolveAuth({ ISOCAN_AUTH_PROJECT: PROJECT })).toBeNull();
    expect(resolveAuth({ ISOCAN_AUTH_API_KEY: "k" })).toBeNull();
    expect(resolveAuth({ ISOCAN_AUTH_PROJECT: PROJECT, ISOCAN_AUTH_API_KEY: "k" })).toEqual({
      project: PROJECT,
      apiKey: "k",
    });
  });

  it("decides what may be granted, and repo is honestly refused", () => {
    expect(attestersOf(null)).toEqual([]);
    expect(attestersOf(auth)).toEqual(["email"]);

    // A home with no attester refuses both, and says what to do instead.
    expect(attesterRefusal("link", [])).toBeNull();
    expect(attesterRefusal("email:jordan@acme.test", [])).toMatch(/borrowed none/);
    expect(attesterRefusal("email:jordan@acme.test", [])).toMatch(/Share the link/);

    // A home WITH one takes the email and still refuses the repo — which is
    // the thing that must stay true while `repo:` is deferred: a grant that
    // could be written and admitted nobody would be a dialog that lies.
    expect(attesterRefusal("email:jordan@acme.test", ["email"])).toBeNull();
    expect(attesterRefusal("repo:github.com/acme/widgets", ["email"])).toMatch(/GitHub/);
    // `link` needs no attester anywhere, which is why it is the subject a
    // canvas is born with.
    expect(attesterRefusal("link", ["email"])).toBeNull();
  });
});
