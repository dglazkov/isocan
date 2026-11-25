/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { resolveActor, sameActor, type ActorClaim } from "@isocan/core";
import {
  envKeyFor,
  formatCredentialRef,
  isKeyProvider,
  KEY_PROVIDERS,
  USER_KEYS_IDENTITY_REQUIRED,
  USER_KEYS_ROUTE,
  USER_KEYS_UNAVAILABLE,
  type CredentialRef,
  type KeyEnv,
  type KeyProvider,
  type UserKeyDeleteResponse,
  type UserKeyPutResponse,
  type UserKeyRow,
  type UserKeysListing,
} from "@isocan/core/keys";
import { KeyFileRefused, readKeyFile } from "@isocan/core/keystore";
import type { Engine } from "./engine.ts";
import type { Workstation } from "./workstation.ts";

/**
 * **Per-user BYOK keys, sealed at rest in the home** (Open Stitch phase 0.3).
 *
 * Hosted homes (such as `isocan.io`) carry no operator Gemini key, so voice and
 * media routes 503 there unless a signed-in user brings their own key. This
 * module stores each caller's provider keys encrypted with AES-256-GCM in
 * `<dataDir>/user-keys.json` (mode `0600`, atomic rename), never writing
 * plaintext to disk and never returning plaintext over HTTP.
 *
 * - **Master key:** `ISOCAN_KEYS_SECRET` env var (derived via SHA-256 to 32
 *   bytes), or a generated `0600` `<dataDir>/keys-master.key` on local homes
 *   when the env var is unset. Hosted homes (`hosted: true`) refuse to
 *   auto-generate a local key file and answer 503 explaining that
 *   `ISOCAN_KEYS_SECRET` is required.
 * - **Authenticated encryption:** AES-256-GCM with a fresh 12-byte random IV
 *   per write and AAD binding `userId`, `provider`, and `v<version>`, so a
 *   sealed blob cannot be transplanted between users, providers, or versions.
 * - **Monotonic versions:** each `(userId, provider)` write increments a
 *   monotonic integer (`v1`, `v2`, …), preserved across deletes, stamped as
 *   `credentialRef` (`user:<actorId>:<provider>:v<version>`) on generated items.
 * - **Isolation:** every route and spender resolves the caller from the
 *   verified badge; user B cannot list, read, delete, or spend user A's key.
 */

/** Environment variable overriding the master encryption secret for sealed user keys. */
export const USER_KEYS_SECRET_ENV = "ISOCAN_KEYS_SECRET";
/** Filename storing sealed per-user BYOK records inside the home directory. */
export const USER_KEYS_FILE_NAME = "user-keys.json";
/** Filename storing the local auto-generated master key when `ISOCAN_KEYS_SECRET` is unset. */
export const MASTER_KEY_FILE_NAME = "keys-master.key";

/** The largest body accepted by `/api/me/keys/:provider`. */
const USER_KEY_BODY_LIMIT = 16 * 1024;
const GCM_ALGO = "aes-256-gcm";
const GCM_IV_BYTES = 12;
const modeChecked = process.platform !== "win32";

/** Thrown when per-user key storage is requested on a hosted home without `ISOCAN_KEYS_SECRET`. */
export class UserKeysUnavailableError extends Error {
  readonly code = USER_KEYS_UNAVAILABLE;
  readonly status = 503;
  constructor(message = `per-user keys are not configured on this home — the operator must set ${USER_KEYS_SECRET_ENV}`) {
    super(message);
    this.name = "UserKeysUnavailableError";
  }
}

/** Configuration for `UserKeyStore` (also exposed via `DaemonOptions.userKeys` for tests). */
interface UserKeyStoreOptions {
  /** Directory holding `user-keys.json` and (on local homes) `keys-master.key`. */
  dataDir: string;
  /** True on hosted homes (`ISOCAN_STORE=cloud` or `servesWorld`): requires `ISOCAN_KEYS_SECRET` instead of generating a local master key file. */
  hosted?: boolean;
  /** Explicit master secret override (tests); defaults to `env.ISOCAN_KEYS_SECRET`. */
  secret?: string;
  /** Environment for `ISOCAN_KEYS_SECRET` and env-fallback reporting. Default: `process.env`. */
  env?: KeyEnv;
  /** Clock for `updatedAt` timestamps. Default: `() => new Date()`. */
  now?: () => Date;
}

/** Options tests may pass into `startDaemon({ userKeys })` without having to repeat `dataDir` / `hosted`. */
export type DaemonUserKeyOptions = Partial<UserKeyStoreOptions>;

/** Unsealed per-user key returned to server spenders (never sent over HTTP or logged). */
interface UnsealedUserKey {
  key: string;
  version: number;
  updatedAt: string;
  credentialRef: CredentialRef;
}

/** Non-secret metadata for one stored per-user key. */
interface UserKeyMeta {
  version: number;
  updatedAt: string;
}

interface SealedBlob {
  version: number;
  updatedAt: string;
  iv: string;
  tag: string;
  ciphertext: string;
}

interface UserKeysDisk {
  schemaVersion: 1;
  users: Record<string, Partial<Record<KeyProvider, SealedBlob>>>;
  versions: Record<string, Partial<Record<KeyProvider, number>>>;
}

function deriveMasterKey(raw: string): Buffer {
  return createHash("sha256").update("isocan-user-keys-v1:", "utf8").update(raw, "utf8").digest();
}

function aadFor(userId: string, provider: KeyProvider, version: number): Buffer {
  return Buffer.from(`${userId}\0${provider}\0v${version}`, "utf8");
}

function refuseLoose(file: string, mode: number): void {
  if (modeChecked && (mode & 0o777) !== 0o600) throw new KeyFileRefused(file, mode & 0o777);
}

function sealSecret(masterKey: Buffer, userId: string, provider: KeyProvider, version: number, plaintext: string, updatedAt: string): SealedBlob {
  const iv = randomBytes(GCM_IV_BYTES);
  const cipher = createCipheriv(GCM_ALGO, masterKey, iv);
  cipher.setAAD(aadFor(userId, provider, version));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    version,
    updatedAt,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
  };
}

function unsealSecret(masterKey: Buffer, userId: string, provider: KeyProvider, blob: SealedBlob): string {
  const iv = Buffer.from(blob.iv, "hex");
  const tag = Buffer.from(blob.tag, "hex");
  const ciphertext = Buffer.from(blob.ciphertext, "hex");
  const decipher = createDecipheriv(GCM_ALGO, masterKey, iv);
  decipher.setAAD(aadFor(userId, provider, blob.version));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function emptyDisk(): UserKeysDisk {
  return { schemaVersion: 1, users: {}, versions: {} };
}

function parseDisk(file: string, text: string): UserKeysDisk {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`${file} is not valid JSON — fix or remove it before storing per-user keys`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyDisk();
  const obj = raw as Record<string, unknown>;
  const users: UserKeysDisk["users"] = {};
  const versions: UserKeysDisk["versions"] = {};
  if (obj.users && typeof obj.users === "object" && !Array.isArray(obj.users)) {
    for (const [userId, providers] of Object.entries(obj.users as Record<string, unknown>)) {
      if (!userId || !providers || typeof providers !== "object" || Array.isArray(providers)) continue;
      const kept: Partial<Record<KeyProvider, SealedBlob>> = {};
      for (const [provider, entry] of Object.entries(providers as Record<string, unknown>)) {
        if (!isKeyProvider(provider) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        const b = entry as Record<string, unknown>;
        if (
          typeof b.version === "number" &&
          Number.isInteger(b.version) &&
          b.version >= 1 &&
          typeof b.updatedAt === "string" &&
          typeof b.iv === "string" &&
          typeof b.tag === "string" &&
          typeof b.ciphertext === "string"
        ) {
          kept[provider] = {
            version: b.version,
            updatedAt: b.updatedAt,
            iv: b.iv,
            tag: b.tag,
            ciphertext: b.ciphertext,
          };
        }
      }
      if (Object.keys(kept).length > 0) users[userId] = kept;
    }
  }
  if (obj.versions && typeof obj.versions === "object" && !Array.isArray(obj.versions)) {
    for (const [userId, providers] of Object.entries(obj.versions as Record<string, unknown>)) {
      if (!userId || !providers || typeof providers !== "object" || Array.isArray(providers)) continue;
      const kept: Partial<Record<KeyProvider, number>> = {};
      for (const [provider, ver] of Object.entries(providers as Record<string, unknown>)) {
        if (isKeyProvider(provider) && typeof ver === "number" && Number.isInteger(ver) && ver >= 1) {
          kept[provider] = ver;
        }
      }
      if (Object.keys(kept).length > 0) versions[userId] = kept;
    }
  }
  return { schemaVersion: 1, users, versions };
}

/**
 * **Sealed per-user key store** backed by `<dataDir>/user-keys.json` (mode `0600`, atomic rename).
 * Serializes writes on an internal promise chain and reads fresh per call.
 */
export class UserKeyStore {
  readonly dataDir: string;
  readonly file: string;
  readonly masterKeyFile: string;
  private readonly hosted: boolean;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly opts: UserKeyStoreOptions) {
    this.dataDir = opts.dataDir;
    this.file = path.join(opts.dataDir, USER_KEYS_FILE_NAME);
    this.masterKeyFile = path.join(opts.dataDir, MASTER_KEY_FILE_NAME);
    this.hosted = opts.hosted === true;
  }

  env(): KeyEnv {
    return this.opts.env ?? process.env;
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  /**
   * Resolve the 32-byte AES-256 master key:
   * 1. `opts.secret` or `ISOCAN_KEYS_SECRET` env var;
   * 2. existing `0600` `<dataDir>/keys-master.key`;
   * 3. on local homes (`!hosted`), generate `<dataDir>/keys-master.key` atomically (`0600`) when `createIfLocal` is true;
   * 4. on hosted homes with neither, throw `UserKeysUnavailableError` (HTTP 503).
   */
  private async masterKey(createIfLocal: boolean): Promise<Buffer> {
    const fromEnv = (this.opts.secret ?? this.env()[USER_KEYS_SECRET_ENV])?.trim();
    if (fromEnv) return deriveMasterKey(fromEnv);
    try {
      const stat = await fs.stat(this.masterKeyFile);
      refuseLoose(this.masterKeyFile, stat.mode);
      const raw = (await fs.readFile(this.masterKeyFile, "utf8")).trim();
      if (raw) return deriveMasterKey(raw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    if (this.hosted) throw new UserKeysUnavailableError();
    if (!createIfLocal) return deriveMasterKey(await this.ensureLocalMasterKey());
    return deriveMasterKey(await this.ensureLocalMasterKey());
  }

  private async ensureLocalMasterKey(): Promise<string> {
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const generated = randomBytes(32).toString("hex");
    try {
      await fs.writeFile(this.masterKeyFile, `${generated}\n`, { mode: 0o600, flag: "wx" });
      if (modeChecked) await fs.chmod(this.masterKeyFile, 0o600);
      return generated;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "EEXIST") {
        const stat = await fs.stat(this.masterKeyFile);
        refuseLoose(this.masterKeyFile, stat.mode);
        const existing = (await fs.readFile(this.masterKeyFile, "utf8")).trim();
        if (existing) return existing;
      }
      throw err;
    }
  }

  /** Verify this home can seal/unseal per-user keys (throws 503 `UserKeysUnavailableError` on unconfigured hosted homes). */
  async ensureConfigured(): Promise<void> {
    await this.masterKey(true);
  }

  private async readDisk(): Promise<UserKeysDisk> {
    try {
      refuseLoose(this.file, (await fs.stat(this.file)).mode);
      return parseDisk(this.file, await fs.readFile(this.file, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyDisk();
      throw err;
    }
  }

  private async writeDisk(data: UserKeysDisk): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.dataDir, `.${USER_KEYS_FILE_NAME}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
    try {
      await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600, flag: "wx" });
      if (modeChecked) await fs.chmod(tmp, 0o600);
      await fs.rename(tmp, this.file);
    } catch (err) {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw err;
    }
  }

  /** Non-secret metadata for every provider stored by `userId`. */
  async list(userId: string): Promise<Partial<Record<KeyProvider, UserKeyMeta>>> {
    const data = await this.readDisk();
    const row = data.users[userId];
    if (!row) return {};
    const out: Partial<Record<KeyProvider, UserKeyMeta>> = {};
    for (const provider of KEY_PROVIDERS) {
      const entry = row[provider];
      if (entry) out[provider] = { version: entry.version, updatedAt: entry.updatedAt };
    }
    return out;
  }

  /**
   * Unseal one caller's key for `provider`, or `null` if the caller has none.
   * Does not fail on an unconfigured hosted home when no `user-keys.json` exists.
   */
  async get(userId: string, provider: KeyProvider): Promise<UnsealedUserKey | null> {
    const data = await this.readDisk();
    const blob = data.users[userId]?.[provider];
    if (!blob) return null;
    const key = await this.masterKey(false);
    const plaintext = unsealSecret(key, userId, provider, blob);
    return {
      key: plaintext,
      version: blob.version,
      updatedAt: blob.updatedAt,
      credentialRef: formatCredentialRef({ scope: "user", actorId: userId, provider, version: blob.version }),
    };
  }

  /** Seal and store `plaintext` for `(userId, provider)`, bumping its monotonic version. */
  async set(userId: string, provider: KeyProvider, plaintext: string): Promise<UserKeyPutResponse> {
    const trimmed = plaintext.trim();
    if (!trimmed) throw new Error(`no key given for ${provider}`);
    if (/\s/.test(trimmed)) throw new Error(`a ${provider} key has no spaces or line breaks in it`);
    return this.enqueue(async () => {
      const master = await this.masterKey(true);
      const data = await this.readDisk();
      const prevVersion = Math.max(
        data.versions[userId]?.[provider] ?? 0,
        data.users[userId]?.[provider]?.version ?? 0,
      );
      const version = prevVersion + 1;
      const updatedAt = (this.opts.now ?? (() => new Date()))().toISOString();
      const sealed = sealSecret(master, userId, provider, version, trimmed, updatedAt);
      (data.users[userId] ??= {})[provider] = sealed;
      (data.versions[userId] ??= {})[provider] = version;
      await this.writeDisk(data);
      return {
        provider,
        version,
        credentialRef: formatCredentialRef({ scope: "user", actorId: userId, provider, version }),
      };
    });
  }

  /** Remove `(userId, provider)`'s sealed key while preserving its monotonic version high-water mark. */
  async delete(userId: string, provider: KeyProvider): Promise<boolean> {
    return this.enqueue(async () => {
      await this.ensureConfigured();
      const data = await this.readDisk();
      const existing = data.users[userId]?.[provider];
      if (!existing) return false;
      (data.versions[userId] ??= {})[provider] = Math.max(data.versions[userId]?.[provider] ?? 0, existing.version);
      delete data.users[userId]![provider];
      if (Object.keys(data.users[userId]!).length === 0) delete data.users[userId];
      await this.writeDisk(data);
      return true;
    });
  }
}

/**
 * **Who is calling, for per-user keys.** Resolves from the verified badge:
 * 1. If `saidActorId` is provided AND claimed by this badge (through `actor.join`), its canonical actor id;
 * 2. Else the badge's `home:person` claim if present, or its first claimed actor (resolved through `actor.join`);
 * 3. Else the badge's first attested attribute (e.g. `email:priya@acme.test`);
 * 4. Else `null` (anonymous / un-identified badge).
 */
export async function resolveCallerId(
  req: FastifyRequest,
  engine: Engine,
  claimsOf: ((badgeId: string) => Promise<ActorClaim[]>) | undefined,
  saidActorId?: string,
): Promise<string | null> {
  const badge = req.badge;
  if (!badge) return null;
  const [joins, claims] = await Promise.all([engine.actorJoins(), claimsOf ? claimsOf(badge.badgeId) : Promise.resolve([])]);
  if (saidActorId) {
    if (claims.some((c) => sameActor(joins, c.actorId, saidActorId))) {
      return resolveActor(joins, saidActorId);
    }
    // Caller named an actor this badge does not speak for: never resolve another user's keys.
    return null;
  }
  if (claims.length > 0) {
    const person = claims.find((c) => c.sessionKey === "home:person");
    if (person) return resolveActor(joins, person.actorId);
    return resolveActor(joins, claims[0]!.actorId);
  }
  const attested = badge.attestations?.[0]?.attribute;
  return attested || null;
}

interface UserKeyRouteScope {
  engine: Engine;
  workstation: Workstation | null | undefined;
  userKeys: UserKeyStore | null;
  claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
  notTheOwners: (req: FastifyRequest, keysHome: string | null) => Promise<{ owner: string | null } | null>;
}

/** Register `GET|PUT|DELETE /api/me/keys[/:provider]` in an isolated JSON-only Fastify scope. */
export function registerUserKeyRoutes(app: FastifyInstance, scope: UserKeyRouteScope): void {
  const { engine, workstation, userKeys, claimsOf, notTheOwners } = scope;
  const keysHome = workstation?.keysHome ?? null;

  const requireCaller = async (req: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
    if (!req.badge) {
      reply.status(401).send({ error: "authentication is required to manage per-user keys", code: "no-badge" });
      return null;
    }
    const query = (req.query ?? {}) as { actorId?: unknown };
    const said = typeof query.actorId === "string" && query.actorId.trim() ? query.actorId.trim() : undefined;
    const callerId = await resolveCallerId(req, engine, claimsOf, said);
    if (!callerId) {
      reply.status(401).send({
        error: "sign in or claim an identity before managing per-user keys",
        code: USER_KEYS_IDENTITY_REQUIRED,
      });
      return null;
    }
    return callerId;
  };

  const requireStore = (reply: FastifyReply): UserKeyStore | null => {
    if (!userKeys) {
      reply.status(503).send({
        error: `per-user keys are not configured on this home — the operator must set ${USER_KEYS_SECRET_ENV}`,
        code: USER_KEYS_UNAVAILABLE,
      });
      return null;
    }
    return userKeys;
  };

  const providerIn = (req: FastifyRequest, reply: FastifyReply): KeyProvider | null => {
    const raw = String((req.params as { provider?: string }).provider ?? "").toLowerCase();
    if (isKeyProvider(raw)) return raw;
    // Never echo raw param: a secret pasted into the path is still a secret.
    reply.status(400).send({ error: `that is not a provider — the providers are ${KEY_PROVIDERS.join(", ")}`, code: "bad-provider" });
    return null;
  };

  const sendStoreError = (reply: FastifyReply, err: unknown, secretToScrub?: string): FastifyReply => {
    const scrub = (msg: string) => (secretToScrub ? msg.split(secretToScrub).join("[key]") : msg);
    if (err instanceof UserKeysUnavailableError) {
      return reply.status(503).send({ error: scrub(err.message), code: err.code });
    }
    if (err instanceof KeyFileRefused) {
      return reply.status(409).send({ error: scrub(err.message), code: "keys-file-refused" });
    }
    return reply.status(500).send({ error: scrub((err as Error).message || "failed to update per-user keys"), code: "user-keys-failed" });
  };

  void app.register(async (meKeys) => {
    // One JSON parser that never echoes a malformed body (which might carry a secret).
    meKeys.removeAllContentTypeParsers();
    meKeys.addContentTypeParser("application/json", { parseAs: "string", bodyLimit: USER_KEY_BODY_LIMIT }, (_req, body, done) => {
      if (body === "" || body === undefined) return done(null, undefined);
      try {
        done(null, JSON.parse(body as string));
      } catch {
        done(Object.assign(new Error('the body is not JSON — send { "key": "…" } as application/json'), { statusCode: 400 }), undefined);
      }
    });

    meKeys.get(USER_KEYS_ROUTE, async (req, reply) => {
      const callerId = await requireCaller(req, reply);
      if (!callerId) return reply;
      const store = requireStore(reply);
      if (!store) return reply;
      try {
        await store.ensureConfigured();
        const mine = await store.list(callerId);
        const env = store.env();
        const homeFile = keysHome ? await readKeyFile(keysHome).catch(() => null) : null;
        const canSpendHome = homeFile && keysHome ? (await notTheOwners(req, keysHome)) === null : false;
        const rows: UserKeyRow[] = KEY_PROVIDERS.map((provider) => {
          const entry = mine[provider];
          if (entry) {
            return { provider, present: true, version: entry.version, updatedAt: entry.updatedAt, source: "user" };
          }
          if (envKeyFor(provider, env)) {
            return { provider, present: false, source: "env" };
          }
          if (canSpendHome && homeFile?.keys[provider]) {
            return { provider, present: false, source: "home" };
          }
          return { provider, present: false, source: "none" };
        });
        reply.header("Cache-Control", "no-store");
        return { keys: rows } satisfies UserKeysListing;
      } catch (err) {
        return sendStoreError(reply, err);
      }
    });

    meKeys.put(`${USER_KEYS_ROUTE}/:provider`, async (req, reply) => {
      const callerId = await requireCaller(req, reply);
      if (!callerId) return reply;
      const store = requireStore(reply);
      if (!store) return reply;
      const provider = providerIn(req, reply);
      if (!provider) return reply;
      const body = req.body as { key?: unknown } | undefined;
      const key = typeof body?.key === "string" ? body.key.trim() : "";
      if (!key) {
        return reply.status(400).send({ error: `no key given for ${provider} — send { "key": "…" }; nothing was stored`, code: "bad-key" });
      }
      if (/\s/.test(key)) {
        return reply.status(400).send({ error: `a ${provider} key has no spaces or line breaks in it — nothing was stored`, code: "bad-key" });
      }
      try {
        const saved = await store.set(callerId, provider, key);
        reply.header("Cache-Control", "no-store");
        return saved satisfies UserKeyPutResponse;
      } catch (err) {
        return sendStoreError(reply, err, key);
      }
    });

    meKeys.delete(`${USER_KEYS_ROUTE}/:provider`, async (req, reply) => {
      const callerId = await requireCaller(req, reply);
      if (!callerId) return reply;
      const store = requireStore(reply);
      if (!store) return reply;
      const provider = providerIn(req, reply);
      if (!provider) return reply;
      try {
        const removed = await store.delete(callerId, provider);
        reply.header("Cache-Control", "no-store");
        if (!removed) {
          return reply.status(404).send({
            error: `no stored ${provider} key for your account`,
            code: "no-user-key",
            provider,
            removed: false,
          });
        }
        return { provider, removed: true } satisfies UserKeyDeleteResponse;
      } catch (err) {
        return sendStoreError(reply, err);
      }
    });
  });
}
