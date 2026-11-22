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
import type { FastifyInstance, FastifyRequest } from "fastify";
import { type ActorClaim } from "../../core/src/index.js";
import { type CredentialRef, type KeyEnv, type KeyProvider, type UserKeyPutResponse } from "../../core/src/keys.js";
import type { Engine } from "./engine.js";
import type { Workstation } from "./workstation.js";
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
export declare const USER_KEYS_SECRET_ENV = "ISOCAN_KEYS_SECRET";
/** Filename storing sealed per-user BYOK records inside the home directory. */
export declare const USER_KEYS_FILE_NAME = "user-keys.json";
/** Filename storing the local auto-generated master key when `ISOCAN_KEYS_SECRET` is unset. */
export declare const MASTER_KEY_FILE_NAME = "keys-master.key";
/** Thrown when per-user key storage is requested on a hosted home without `ISOCAN_KEYS_SECRET`. */
export declare class UserKeysUnavailableError extends Error {
    readonly code = "user-keys-unavailable";
    readonly status = 503;
    constructor(message?: string);
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
/**
 * **Sealed per-user key store** backed by `<dataDir>/user-keys.json` (mode `0600`, atomic rename).
 * Serializes writes on an internal promise chain and reads fresh per call.
 */
export declare class UserKeyStore {
    private readonly opts;
    readonly dataDir: string;
    readonly file: string;
    readonly masterKeyFile: string;
    private readonly hosted;
    private chain;
    constructor(opts: UserKeyStoreOptions);
    env(): KeyEnv;
    private enqueue;
    /**
     * Resolve the 32-byte AES-256 master key:
     * 1. `opts.secret` or `ISOCAN_KEYS_SECRET` env var;
     * 2. existing `0600` `<dataDir>/keys-master.key`;
     * 3. on local homes (`!hosted`), generate `<dataDir>/keys-master.key` atomically (`0600`) when `createIfLocal` is true;
     * 4. on hosted homes with neither, throw `UserKeysUnavailableError` (HTTP 503).
     */
    private masterKey;
    private ensureLocalMasterKey;
    /** Verify this home can seal/unseal per-user keys (throws 503 `UserKeysUnavailableError` on unconfigured hosted homes). */
    ensureConfigured(): Promise<void>;
    private readDisk;
    private writeDisk;
    /** Non-secret metadata for every provider stored by `userId`. */
    list(userId: string): Promise<Partial<Record<KeyProvider, UserKeyMeta>>>;
    /**
     * Unseal one caller's key for `provider`, or `null` if the caller has none.
     * Does not fail on an unconfigured hosted home when no `user-keys.json` exists.
     */
    get(userId: string, provider: KeyProvider): Promise<UnsealedUserKey | null>;
    /** Seal and store `plaintext` for `(userId, provider)`, bumping its monotonic version. */
    set(userId: string, provider: KeyProvider, plaintext: string): Promise<UserKeyPutResponse>;
    /** Remove `(userId, provider)`'s sealed key while preserving its monotonic version high-water mark. */
    delete(userId: string, provider: KeyProvider): Promise<boolean>;
}
/**
 * **Who is calling, for per-user keys.** Resolves from the verified badge:
 * 1. If `saidActorId` is provided AND claimed by this badge (through `actor.join`), its canonical actor id;
 * 2. Else the badge's `home:person` claim if present, or its first claimed actor (resolved through `actor.join`);
 * 3. Else the badge's first attested attribute (e.g. `email:priya@acme.test`);
 * 4. Else `null` (anonymous / un-identified badge).
 */
export declare function resolveCallerId(req: FastifyRequest, engine: Engine, claimsOf: ((badgeId: string) => Promise<ActorClaim[]>) | undefined, saidActorId?: string): Promise<string | null>;
interface UserKeyRouteScope {
    engine: Engine;
    workstation: Workstation | null | undefined;
    userKeys: UserKeyStore | null;
    claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
    notTheOwners: (req: FastifyRequest, keysHome: string | null) => Promise<{
        owner: string | null;
    } | null>;
}
/** Register `GET|PUT|DELETE /api/me/keys[/:provider]` in an isolated JSON-only Fastify scope. */
export declare function registerUserKeyRoutes(app: FastifyInstance, scope: UserKeyRouteScope): void;
export {};
