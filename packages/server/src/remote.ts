import { promises as fs } from "node:fs";
import { createSign } from "node:crypto";

/**
 * Talking to the host's own Firebase project (#70).
 *
 * The daemon writes two things and reads nothing: op documents into Firestore
 * and blob bytes into Cloud Storage, both as the `isocan-host` service account
 * #69 minted. That is a small enough surface to do over plain REST, and doing it
 * over plain REST is what keeps `@isocan/server` on fastify and ws — which
 * matters more than it sounds, because a `github:` install resolves the ROOT
 * package's dependencies, so every megabyte of SDK here is a megabyte in
 * everyone's install of a canvas they may never share.
 *
 * The seam is `Remote`, the same shape and for the same reason as `Cloud` in the
 * CLI's provisioning script: everything that leaves the machine goes through one
 * interface, so the mirror can be driven end to end against a Firestore that
 * lives in a variable.
 */

/** A Google service-account key, as `gcloud iam service-accounts keys create`
 * writes it. Only the three fields we spend. */
export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id: string;
}

/** One document to write. `path` is relative to the database root — e.g.
 * `canvases/prj_1/ops/000000000042`. */
export interface RemoteWrite {
  path: string;
  fields: Record<string, RemoteValue>;
}

/** The slice of Firestore's typed-value tree the mirror actually uses. */
export type RemoteValue = { stringValue: string } | { integerValue: string };

export class RemoteError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never got an answer. A 4xx that is
     * not 429 is permanent: retrying a malformed write or a revoked credential
     * only makes the same mistake more often. */
    readonly status: number,
  ) {
    super(message);
    this.name = "RemoteError";
  }

  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 429;
  }
}

/**
 * Everything the mirror can do to the outside world. Both calls are
 * idempotent by construction — a document write is addressed by a path the
 * caller chose, and a blob is addressed by its own hash — so a retry after an
 * ambiguous failure is always safe.
 */
export interface Remote {
  /** Write documents. Fewer round trips than one call each, and Firestore
   * applies a commit atomically, so a batch either lands or doesn't. */
  commit(writes: RemoteWrite[]): Promise<void>;
  /** Put bytes at `blobs/{hash}` in the project's default bucket. */
  upload(path: string, bytes: Buffer, contentType: string): Promise<void>;
  sleep(ms: number): Promise<void>;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIRESTORE_API = "https://firestore.googleapis.com/v1";
const UPLOAD_API = "https://storage.googleapis.com/upload/storage/v1";

const SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/devstorage.read_write",
].join(" ");

/**
 * Firestore's own limits are 500 writes and 10MB per commit. We stay under
 * both with room to spare: a `LogEntry` for a batch op over a hundred items is
 * not a small document, and the request that discovers the ceiling is the one
 * that has already wasted a round trip.
 */
const MAX_WRITES_PER_COMMIT = 400;
const MAX_COMMIT_BYTES = 8 * 1024 * 1024;

export async function readServiceAccountKey(file: string): Promise<ServiceAccountKey> {
  const key = JSON.parse(await fs.readFile(file, "utf8")) as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) {
    throw new RemoteError(`${file} is not a service-account key`, 400);
  }
  return key as ServiceAccountKey;
}

/**
 * The signed assertion a service account trades for an access token — Google's
 * "JWT bearer" flow, which is how a daemon authenticates with no browser and no
 * refresh token anywhere.
 *
 * Pulled out of `systemRemote` and exported for one reason: it is the only part
 * of this file whose mistakes are invisible until the day someone shares a real
 * canvas. A malformed claim set does not throw — it comes back as a 400 from an
 * endpoint that will not say which field it disliked.
 */
export function signAssertion(key: ServiceAccountKey, nowSeconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      scope: SCOPES,
      aud: TOKEN_URL,
      iat: nowSeconds,
      // An hour is the maximum Google will honour; asking for more is refused
      // outright rather than quietly shortened.
      exp: nowSeconds + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(key.private_key);
  return `${signingInput}.${signature.toString("base64url")}`;
}

/**
 * The real thing: a signed-JWT credential, an access token cached until it is
 * nearly stale, and the two calls.
 *
 * Google's "JWT bearer" flow is what a service account uses without a browser
 * anywhere: sign an assertion with the key's private half, hand it to the token
 * endpoint, get an hour of access back. No refresh tokens, no interactive
 * anything, and nothing to keep beyond the key file the dance already wrote.
 */
export function systemRemote(options: {
  key: ServiceAccountKey;
  firebaseProject: string;
  bucket?: string;
}): Remote {
  const { key, firebaseProject, bucket } = options;
  let cached: { token: string; expiresAt: number } | null = null;

  async function token(): Promise<string> {
    // A minute of slack: a token that expires mid-flight fails the request it
    // was minted for, and the clock we are comparing against is not Google's.
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const assertion = signAssertion(key, Math.floor(Date.now() / 1000));

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok || !body.access_token) {
      throw new RemoteError(
        `could not get an access token for ${key.client_email}: ${
          body.error_description ?? res.statusText
        }`,
        res.status,
      );
    }
    cached = {
      token: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return cached.token;
  }

  return {
    async commit(writes) {
      if (writes.length === 0) return;
      const prefix = `projects/${firebaseProject}/databases/(default)/documents`;
      const res = await fetch(`${FIRESTORE_API}/${prefix}:commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          writes: writes.map((write) => ({
            update: { name: `${prefix}/${write.path}`, fields: write.fields },
          })),
        }),
      });
      if (!res.ok) {
        throw new RemoteError(
          `Firestore refused ${writes.length} write(s): ${await detail(res)}`,
          res.status,
        );
      }
    },

    async upload(path, bytes, contentType) {
      if (!bucket) {
        // Not reachable through the mirror, which checks first — but a Remote
        // handed round without a bucket should say so rather than 404 obscurely.
        throw new RemoteError(`${firebaseProject} has no blob bucket`, 400);
      }
      const url = `${UPLOAD_API}/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(path)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await token()}`,
          "Content-Type": contentType || "application/octet-stream",
        },
        body: new Uint8Array(bytes),
      });
      if (!res.ok) {
        throw new RemoteError(`Cloud Storage refused ${path}: ${await detail(res)}`, res.status);
      }
    },

    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

/**
 * Cut a run of writes into commits that fit. Pure, so the limits are testable
 * without a Firestore: an entry that is on its own too big for a commit still
 * gets its own commit rather than being dropped or silently merged — Firestore
 * will refuse it, and a refusal naming one document is a bug report, while a
 * refusal naming four hundred is a mystery.
 */
export function batchWrites(writes: RemoteWrite[]): RemoteWrite[][] {
  const batches: RemoteWrite[][] = [];
  let batch: RemoteWrite[] = [];
  let bytes = 0;
  for (const write of writes) {
    const size = sizeOf(write);
    if (batch.length > 0 && (batch.length >= MAX_WRITES_PER_COMMIT || bytes + size > MAX_COMMIT_BYTES)) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }
    batch.push(write);
    bytes += size;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

function sizeOf(write: RemoteWrite): number {
  let bytes = write.path.length;
  for (const value of Object.values(write.fields)) {
    bytes += "stringValue" in value ? Buffer.byteLength(value.stringValue) : 20;
  }
  return bytes;
}

function base64url(text: string): string {
  return Buffer.from(text, "utf8").toString("base64url");
}

async function detail(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON — the raw body is the most honest thing we have.
  }
  return text.slice(0, 300) || res.statusText;
}
