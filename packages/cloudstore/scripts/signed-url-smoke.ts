/**
 * The three assertions phase 4 could not make, made.
 *
 * Phase 4 verified the signed-PUT branch to the edge of the machine: the V4
 * signature is re-derived from the URL's own query parameters and checked
 * against a generated public key, and the upload-and-register round trip runs
 * against an in-process object store. What no local artifact can tell you is
 * whether Google's frontend agrees. Three things were left explicitly
 * unproven, and this script is where they get proven:
 *
 *   1. GCS ACCEPTS A SIGNATURE THE SERVICE MINTED.
 *      A PUT to the ticket's URL, with exactly the ticket's headers, returns
 *      200. Not 403 SignatureDoesNotMatch.
 *
 *   2. `x-goog-if-generation-match: 0` IS HONORED INSIDE A SIGNED REQUEST.
 *      This is the one phase 4 was least sure of, and it is what makes blob
 *      writes create-only: a leaked ticket must not be able to replace bytes
 *      an item already points at. A SECOND PUT to the same ticket must be
 *      REFUSED — 412 Precondition Failed. A 200 here is a failure of this
 *      test, and a security property lost.
 *
 *   3. A SERVICE ACCOUNT WITH NO PRIVATE KEY CAN SIGN AT ALL.
 *      A Cloud Run service account holds no key, so `getSignedUrl` cannot sign
 *      locally; google-auth-library falls back to the IAM `signBlob` API,
 *      which `roles/iam.serviceAccountTokenCreator` gates. This script REFUSES
 *      TO CLAIM assertion 3 unless it can establish that no private key was in
 *      play — see `signingIdentity` below. Run from a laptop holding a
 *      downloaded key file, 1 and 2 pass and 3 is reported UNPROVEN, because
 *      that run says nothing at all about the deployed service.
 *
 * It exercises `GcsObjects.signedPutUrl` — the real code `CloudStore.beginUpload`
 * delegates to — rather than re-deriving a URL here. A smoke test that built
 * its own request would prove that this file and GCS agree, which is not the
 * question.
 *
 * There is no Firestore in this script. `registerBlob` (which writes
 * `blobmeta/{hash}`) is covered by the emulator suites; what needs a real
 * bucket is the signing and the precondition, and that is all this touches.
 *
 * Usage — `infra/signed-url-smoke.sh` is the one-command wrapper that fills
 * these in from `infra/config.sh`:
 *
 *   tsx packages/cloudstore/scripts/signed-url-smoke.ts \
 *       --bucket=isocan-io-dev-canvas --project=isocan-io-dev
 *
 *   --keep   leave the object behind (default: delete it on the way out)
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GcsObjects } from "../src/gcs-objects.ts";
import { blobKey } from "../src/naming.ts";

// ---------------------------------------------------------------- arguments

function arg(name: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
const flag = (name: string) => process.argv.slice(2).includes(`--${name}`);

const bucket = arg("bucket") ?? process.env.ISOCAN_BUCKET;
const project = arg("project") ?? process.env.ISOCAN_GCP_PROJECT;
const keep = flag("keep");

if (!bucket) {
  console.error("signed-url-smoke: need --bucket=NAME (or ISOCAN_BUCKET)");
  process.exit(2);
}

// A synthetic canvas id and a random hash, in the real key layout, so what is
// written lands exactly where a real blob would and nothing collides with a
// real one. AGENTS.md's rule about synthetic names applies to a bucket too.
const canvasId = `smoke-${randomBytes(4).toString("hex")}`;
const fakeHash = randomBytes(32).toString("hex");
const key = blobKey(canvasId, `${fakeHash}.bin`);
const CONTENT_TYPE = "application/octet-stream";
const bytes = randomBytes(1024);
const otherBytes = randomBytes(1024);

// ------------------------------------------------------- the signing identity
//
// Assertion 3 is a claim about HOW the signature was produced, and the only
// honest way to make it is to establish that no private key was available to
// produce it locally. Three situations where that is true by construction, and
// one where it is false:
//
//   K_SERVICE set                    → running inside Cloud Run. Metadata-server
//                                      credentials; no key exists. PROVES 3.
//   ADC is impersonated_service_account
//                                    → the source credential does not sign;
//                                      the target signs through IAM. PROVES 3.
//   GCE/metadata reachable, no ADC   → a VM's attached service account; no key.
//                                      PROVES 3.
//   ADC or GOOGLE_APPLICATION_CREDENTIALS is a service_account JSON with a
//   private_key                      → signed locally with RSA. Says NOTHING
//                                      about the deployed service. 3 UNPROVEN.
//
// This reads the credential files rather than importing google-auth-library,
// which is a transitive dependency here and not a declared one. It is a
// deliberately conservative reading: anything it cannot positively classify is
// reported as unknown, and unknown does not prove assertion 3.

type Signing = { keyless: boolean; how: string };

function adcPath(): string | undefined {
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicit) return explicit;
  const configDir =
    process.env.CLOUDSDK_CONFIG ??
    (process.platform === "win32"
      ? path.join(process.env.APPDATA ?? "", "gcloud")
      : path.join(os.homedir(), ".config", "gcloud"));
  const file = path.join(configDir, "application_default_credentials.json");
  return existsSync(file) ? file : undefined;
}

function signingIdentity(): Signing {
  if (process.env.K_SERVICE) {
    return { keyless: true, how: `inside Cloud Run service "${process.env.K_SERVICE}" — metadata-server credentials, no private key exists` };
  }
  const file = adcPath();
  if (file && existsSync(file)) {
    try {
      const adc = JSON.parse(readFileSync(file, "utf8")) as {
        type?: string;
        client_email?: string;
        private_key?: string;
        service_account_impersonation_url?: string;
      };
      if (adc.type === "impersonated_service_account" || adc.service_account_impersonation_url) {
        const target = adc.service_account_impersonation_url?.match(/serviceAccounts\/([^:]+):/)?.[1];
        return {
          keyless: true,
          how: `impersonating ${target ?? "a service account"} — the target holds no key, so signing goes through IAM signBlob`,
        };
      }
      if (adc.type === "service_account" && adc.private_key) {
        return {
          keyless: false,
          how: `a downloaded service-account KEY FILE (${adc.client_email ?? "unknown"}) at ${file} — signing is local RSA`,
        };
      }
      if (adc.type === "authorized_user") {
        return { keyless: false, how: `a plain user login at ${file} — this cannot sign at all; see the wrapper script's instructions` };
      }
      return { keyless: false, how: `an application-default credential of unrecognized type "${adc.type ?? "?"}" at ${file}` };
    } catch {
      return { keyless: false, how: `an unreadable credential at ${file}` };
    }
  }
  if (process.env.GCE_METADATA_HOST || process.env.GOOGLE_CLOUD_PROJECT) {
    return { keyless: true, how: "an attached compute service account — no private key exists" };
  }
  return { keyless: false, how: "an identity this script could not classify — assume nothing" };
}

// --------------------------------------------------------------- the record

type Verdict = "PASS" | "FAIL" | "UNPROVEN";
const results: { n: number; claim: string; verdict: Verdict; detail: string }[] = [];
const record = (n: number, claim: string, verdict: Verdict, detail: string) => {
  results.push({ n, claim, verdict, detail });
  const mark = verdict === "PASS" ? "✓" : verdict === "FAIL" ? "✗" : "?";
  console.log(`\n  ${mark} ${verdict}  assertion ${n}: ${claim}\n      ${detail}`);
};

const extras: string[] = [];

async function main(): Promise<number> {
  const signing = signingIdentity();

  console.log("signed-URL smoke test — the three assertions phase 4 could not make");
  console.log("─".repeat(72));
  console.log(`  bucket    gs://${bucket}`);
  console.log(`  project   ${project ?? "(inferred from the credential)"}`);
  console.log(`  object    ${key}`);
  console.log(`  signing   ${signing.how}`);
  console.log("─".repeat(72));

  const objects = GcsObjects.open(bucket!, project);

  // ---- mint the ticket, through the exact code CloudStore.beginUpload calls
  const started = Date.now();
  let ticket;
  try {
    ticket = await objects.signedPutUrl(key, {
      contentType: CONTENT_TYPE,
      expiresMs: 5 * 60_000,
      ifGenerationMatch0: true,
    });
  } catch (err) {
    const message = (err as Error).message;
    record(3, "a service account with no private key can sign", "FAIL",
      `signing threw: ${message}`);
    if (/serviceAccountTokenCreator|iam\.serviceAccounts\.signBlob|PERMISSION_DENIED/i.test(message)) {
      console.log("\n      ^ THAT IS PHASE 4'S FIRST DEBT, unpaid. The identity above needs");
      console.log("        roles/iam.serviceAccountTokenCreator ON ITSELF, and");
      console.log("        iamcredentials.googleapis.com enabled. infra/40-service-account.sh");
      console.log("        grants exactly that.");
    }
    record(1, "GCS accepts a signature the service minted", "UNPROVEN", "no ticket was minted");
    record(2, "x-goog-if-generation-match: 0 is honored inside a signed request", "UNPROVEN", "no ticket was minted");
    return 1;
  }
  const signMs = Date.now() - started;

  const signedAs = new URL(ticket.url).searchParams.get("X-Goog-Credential")?.split("/")[0];
  console.log(`\n  minted a ticket in ${signMs}ms, signed as ${signedAs ?? "?"}`);
  console.log(`  expires ${ticket.expiresAt}`);
  console.log(`  headers the client must send exactly: ${Object.keys(ticket.headers).join(", ")}`);

  // ---- assertion 3, decided by how the signature was produced
  if (signing.keyless) {
    record(3, "a service account with no private key can sign", "PASS",
      `signed as ${signedAs} through the IAM signBlob path in ${signMs}ms (${signing.how})`);
  } else {
    record(3, "a service account with no private key can sign", "UNPROVEN",
      `this run signed with ${signing.how}. That is the LOCAL path, and it says nothing about the deployed service. Re-run impersonating the runtime service account, or run it inside Cloud Run.`);
  }

  // ---- assertion 1: GCS accepts the signature
  const first = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: bytes });
  const firstBody = first.ok ? "" : await first.text().catch(() => "");
  if (first.ok) {
    record(1, "GCS accepts a signature the service minted", "PASS",
      `PUT ${first.status} — ${bytes.length} bytes stored at ${key}`);
  } else {
    record(1, "GCS accepts a signature the service minted", "FAIL",
      `PUT ${first.status} ${first.statusText} — ${firstBody.slice(0, 400)}`);
    record(2, "x-goog-if-generation-match: 0 is honored inside a signed request", "UNPROVEN",
      "the first PUT never landed, so there is nothing for a second one to collide with");
    return 1;
  }

  // ---- assertion 2: the SECOND PUT must be refused
  //
  // Same ticket, different bytes — different bytes on purpose, so that a
  // wrongly-accepted second PUT is visible in the object and not merely
  // theoretical.
  const second = await fetch(ticket.url, { method: "PUT", headers: ticket.headers, body: otherBytes });
  const secondBody = second.ok ? "" : await second.text().catch(() => "");
  if (second.status === 412) {
    record(2, "x-goog-if-generation-match: 0 is honored inside a signed request", "PASS",
      "the second PUT was refused with 412 Precondition Failed — blob writes are create-only, and a leaked ticket cannot replace bytes an item already points at");
  } else if (second.ok) {
    record(2, "x-goog-if-generation-match: 0 is honored inside a signed request", "FAIL",
      `the second PUT SUCCEEDED (${second.status}). The precondition was not enforced, and the object was OVERWRITTEN. Blob writes are not create-only. This is the assertion phase 4 was least certain of, and it just came back wrong.`);
  } else {
    record(2, "x-goog-if-generation-match: 0 is honored inside a signed request", "FAIL",
      `the second PUT failed with ${second.status} ${second.statusText}, which is not the 412 the precondition produces — ${secondBody.slice(0, 400)}`);
  }

  // ---- extras: cheap, clearly separate from the three named assertions
  //
  // The precondition header is SIGNED, not advice. A client that drops it must
  // be refused by Google for signature reasons, not quietly allowed to write.
  const bare = { ...ticket.headers };
  delete bare["x-goog-if-generation-match"];
  const cheeky = await fetch(ticket.url, { method: "PUT", headers: bare, body: otherBytes });
  extras.push(
    cheeky.status === 403
      ? `✓ dropping the precondition header breaks the signature (403) — it is signed, not advisory`
      : `! dropping the precondition header returned ${cheeky.status}, expected 403`,
  );

  // An expired-looking or moved object name should also break the signature.
  const moved = ticket.url.replace(fakeHash, randomBytes(32).toString("hex"));
  const elsewhere = await fetch(moved, { method: "PUT", headers: ticket.headers, body: otherBytes });
  extras.push(
    elsewhere.status === 403
      ? `✓ changing the object name in the URL breaks the signature (403) — the ticket names one object`
      : `! changing the object name returned ${elsewhere.status}, expected 403`,
  );

  // ---- what is actually in the bucket now
  const stat = await objects.stat(key);
  extras.push(
    stat && stat.size === bytes.length
      ? `✓ the object is ${stat.size} bytes — the FIRST PUT's bytes, untouched`
      : `! the object is ${stat ? `${stat.size} bytes, not the ${bytes.length} the first PUT wrote` : "missing"}`,
  );

  if (!keep) {
    await objects.delete(key);
    extras.push(`· cleaned up gs://${bucket}/${key} (--keep to leave it)`);
  } else {
    extras.push(`· left behind: gs://${bucket}/${key}`);
  }

  return results.some((r) => r.verdict === "FAIL") ? 1 : 0;
}

main()
  .then((code) => {
    console.log("\n" + "─".repeat(72));
    console.log("  extras (not among the three):");
    for (const line of extras) console.log(`    ${line}`);
    console.log("─".repeat(72));
    const tally = (v: Verdict) => results.filter((r) => r.verdict === v).length;
    console.log(
      `  RECORD:  ${tally("PASS")} passed   ${tally("FAIL")} failed   ${tally("UNPROVEN")} unproven` +
        `   (of ${results.length} assertions)`,
    );
    for (const r of results.sort((a, b) => a.n - b.n)) {
      console.log(`    ${r.n}. ${r.verdict.padEnd(8)} ${r.claim}`);
    }
    if (tally("UNPROVEN") > 0) {
      console.log("\n  An UNPROVEN is not a pass. Phase 5's Work is not discharged until all three read PASS");
      console.log("  in one run, and the run that counts is the one signing as the deployed runtime account.");
    }
    console.log("");
    process.exit(code || (tally("UNPROVEN") > 0 ? 3 : 0));
  })
  .catch((err: unknown) => {
    console.error(`\nsigned-url-smoke: ${(err as Error).stack ?? String(err)}`);
    process.exit(1);
  });
