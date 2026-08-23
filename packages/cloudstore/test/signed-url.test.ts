import { createHash, createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Storage } from "@google-cloud/storage";
import { GcsObjects } from "../src/gcs-objects.ts";
import { blobKey } from "../src/naming.ts";

/**
 * The signed PUT URL, verified to the edge of the machine.
 *
 * There is no Firestore in this file and no network in it either: V4 signing
 * is local RSA over a canonical request whenever the credential carries a
 * private key, so a synthetic service account and a generated keypair are
 * enough to exercise the real `@google-cloud/storage` signer against the real
 * `GcsObjects`. That is why this suite runs on every machine, emulator or no.
 *
 * ## What is asserted, and why it is not a tautology
 *
 * The test re-derives the V4 canonical request FROM THE URL'S OWN QUERY
 * PARAMETERS and verifies the signature against the public half of a keypair
 * it generated. That asserts the daemon signed *this bucket*, *this object
 * name*, *this method*, *this expiry*, *these headers* — and that a holder of
 * the URL cannot move any of them without breaking the signature. Those are
 * exactly the mistakes this branch actually makes: signed the wrong object
 * name, signed a seven-day expiry, forgot to sign the precondition header.
 *
 * ## The one assertion that is NOT here, named rather than faked
 *
 * That Google's frontend accepts this signature, and that it honors
 * `x-goog-if-generation-match: 0` inside a signed request. No local artifact
 * can tell us either. Nor can anything here tell us whether a Cloud Run
 * service account — which has NO private key, and must therefore sign through
 * the IAM `signBlob` API — can sign at all; that needs
 * `roles/iam.serviceAccountTokenCreator`, which is a provisioning item and is
 * now written into Phase 5's Work. A mock that agreed with itself about any
 * of that would be worse than the gap, so the gap is what is recorded.
 */

const BUCKET = "isocan-test-bucket";
const CLIENT_EMAIL = "test@example.iam.gserviceaccount.com";

/** A keypair and a synthetic service account, minted here so no credential
 * ever has to exist for this to run. */
function signer(): { objects: GcsObjects; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const storage = new Storage({
    projectId: "demo-isocan",
    credentials: { client_email: CLIENT_EMAIL, private_key: privateKey },
  });
  return { objects: new GcsObjects(storage, BUCKET), publicKey };
}

/**
 * The V4 string-to-sign, rebuilt from nothing but the URL.
 *
 * This is the part that makes the assertion real: if it were built from the
 * same inputs the signer was given, it would prove only that RSA is
 * deterministic. Built from the URL, it proves the URL says what we meant.
 */
function stringToSign(url: URL, headers: Record<string, string>): string {
  const rawQuery = url.search
    .slice(1)
    .split("&")
    .filter((pair) => !pair.startsWith("X-Goog-Signature="));
  const params = new URLSearchParams(url.search);
  const signedHeaders = params.get("X-Goog-SignedHeaders")!.split(";");
  const canonicalHeaders = signedHeaders
    .map((name) => `${name}:${(headers[name] ?? "").trim()}\n`)
    .join("");
  const canonicalRequest = [
    "PUT",
    url.pathname,
    rawQuery.join("&"),
    canonicalHeaders,
    signedHeaders.join(";"),
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  // `X-Goog-Credential` is `<email>/<scope>`; the scope is the rest.
  const credential = params.get("X-Goog-Credential")!;
  const scope = credential.slice(credential.indexOf("/") + 1);
  return [
    "GOOG4-RSA-SHA256",
    params.get("X-Goog-Date")!,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
}

function signatureIsGood(url: URL, headers: Record<string, string>, publicKey: string): boolean {
  const signature = new URLSearchParams(url.search).get("X-Goog-Signature")!;
  return verify(
    "RSA-SHA256",
    Buffer.from(stringToSign(url, headers)),
    createPublicKey(publicKey),
    Buffer.from(signature, "hex"),
  );
}

describe("the signed PUT URL", () => {
  const key = blobKey("prj_1", `${"e".repeat(64)}.mp4`);

  it("signs THIS object, THIS method, THIS content type, and a short expiry", async () => {
    const { objects, publicKey } = signer();
    const ticket = await objects.signedPutUrl(key, {
      contentType: "video/mp4",
      expiresMs: 15 * 60 * 1000,
      ifGenerationMatch0: true,
    });
    const url = new URL(ticket.url);

    expect(url.host).toBe("storage.googleapis.com");
    expect(url.pathname).toBe(`/${BUCKET}/${encodeURI(key)}`);
    const params = new URLSearchParams(url.search);
    expect(params.get("X-Goog-Algorithm")).toBe("GOOG4-RSA-SHA256");
    expect(params.get("X-Goog-Credential")!.startsWith(`${CLIENT_EMAIL}/`)).toBe(true);
    // Minutes, not days. V4 allows seven days; a capability that lives that
    // long is a capability somebody will still be holding next week.
    expect(Number(params.get("X-Goog-Expires"))).toBe(900);
    expect(Date.parse(ticket.expiresAt) - Date.now()).toBeLessThanOrEqual(900_000);

    // The precondition is SIGNED, not advised — which is what makes a leaked
    // ticket unable to replace bytes an item already points at.
    const signed = params.get("X-Goog-SignedHeaders")!.split(";");
    expect(signed).toContain("content-type");
    expect(signed).toContain("host");
    expect(signed).toContain("x-goog-if-generation-match");
    expect(ticket.headers["x-goog-if-generation-match"]).toBe("0");

    // And the signature verifies against the canonical request re-derived
    // from the URL itself.
    expect(
      signatureIsGood(
        url,
        {
          host: url.host,
          "content-type": "video/mp4",
          "x-goog-if-generation-match": "0",
        },
        publicKey,
      ),
    ).toBe(true);
  });

  it("cannot be moved: change the object, the method or a header and it stops verifying", async () => {
    const { objects, publicKey } = signer();
    const ticket = await objects.signedPutUrl(key, {
      contentType: "video/mp4",
      expiresMs: 15 * 60 * 1000,
      ifGenerationMatch0: true,
    });
    const url = new URL(ticket.url);
    const honest = {
      host: url.host,
      "content-type": "video/mp4",
      "x-goog-if-generation-match": "0",
    };
    expect(signatureIsGood(url, honest, publicKey)).toBe(true);

    // A different object in the same bucket.
    const moved = new URL(url.toString());
    moved.pathname = `/${BUCKET}/${encodeURI(blobKey("prj_other", "someone-elses.mp4"))}`;
    expect(signatureIsGood(moved, honest, publicKey)).toBe(false);

    // A different bucket.
    const rebucketed = new URL(url.toString());
    rebucketed.pathname = url.pathname.replace(BUCKET, "somebody-elses-bucket");
    expect(signatureIsGood(rebucketed, honest, publicKey)).toBe(false);

    // A longer life.
    const extended = new URL(url.toString());
    extended.searchParams.set("X-Goog-Expires", "604800");
    expect(signatureIsGood(extended, honest, publicKey)).toBe(false);

    // The create-only precondition, quietly dropped.
    expect(signatureIsGood(url, { ...honest, "x-goog-if-generation-match": "" }, publicKey)).toBe(
      false,
    );

    // A different content type than the one that was signed.
    expect(signatureIsGood(url, { ...honest, "content-type": "text/html" }, publicKey)).toBe(false);
  });

  it("without the precondition, nothing about it is signed either", async () => {
    const { objects, publicKey } = signer();
    const ticket = await objects.signedPutUrl(key, {
      contentType: "text/plain",
      expiresMs: 60_000,
      ifGenerationMatch0: false,
    });
    const url = new URL(ticket.url);
    expect(new URLSearchParams(url.search).get("X-Goog-SignedHeaders")).not.toContain(
      "x-goog-if-generation-match",
    );
    expect(ticket.headers["x-goog-if-generation-match"]).toBeUndefined();
    expect(
      signatureIsGood(url, { host: url.host, "content-type": "text/plain" }, publicKey),
    ).toBe(true);
  });
});
