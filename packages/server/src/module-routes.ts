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

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { moduleSlug, type Actor, type ActorClaim, type ModuleResponse, type ServerHost, type ServerModule, type ServerRoute } from "@isocan/core";
import { formatCredentialRef, type CredentialRef, type KeyProvider, type ResolvedServerKey, ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { readKeyFile, resolveKey } from "@isocan/core/keystore";
import { TEXT_RATE_LIMITED, TEXT_UNAVAILABLE } from "@isocan/core/text";
import type { Engine } from "./engine.ts";
import type { RouteOptions } from "./http.ts";
import type { JobManager } from "./jobs.ts";
import { SERVER_MODULES } from "./server-modules.ts";
import type { Store } from "./store.ts";
import { pictureToSend } from "./summary-pictures.ts";
import { type TextModel, warnRefusedKeys } from "./text.ts";
import { resolveCallerId, type UserKeyStore } from "./user-keys.ts";
import type { Workstation } from "./workstation.ts";

/**
 * **`/api/m/<module>/<path>` — the routes a module's server half owns**
 * (Open Stitch phase 0.1, 19 Nov 2026; `ServerModule` in core's
 * `modules.ts`). The door is the model routes' door, run by the home before
 * any handler and in the order `/api/text` runs it, so a module cannot
 * forget one and two modules cannot drift:
 *
 * 1. the route's own `check` — refusals that cost nothing (the shape, a
 *    deny-list) — then that a canvas is named at all;
 * 2. the door: the takedown and the refused badge, the admission, the edit
 *    rung (a model is spent on a canvas only by someone who may edit it);
 * 3. for a canvas homed elsewhere, that home's own route — with that home's
 *    key, against that home's budget — unless this machine holds a key the
 *    badge may spend (`spend: "none"` always goes to the home: the canvas is
 *    not here);
 * 4. whose key it is: owner-only spend, in the route's words;
 * 5. that there is a key at all;
 * 6. the badge's rate, counted only now, so a refusal never costs a token;
 * 7. the handler, with a host whose `keyFor` answers what step 4 decided.
 *
 * Nothing here knows a module by name: the list is `server-modules.ts`, the
 * third twin of the web's and the CLI's, and `test/modules.test.ts` holds
 * the three to one.
 */

/**
 * **The seams the home hands a module's routes** — what a test fakes the
 * provider through, and what the daemon's own options always carried for the
 * routes that moved here (`RouteOptions.liveToken`, `.image`). The named
 * members are the pipeline's; anything else is the module's own, read from
 * `host.options` (mood's `model`, its `loadSharp`).
 */
export interface ModuleSeams {
  /** The route's key, read per call. Handed in, it counts as the environment's (the operator's). */
  key?: () => string | undefined;
  /** Whose `keys.json` the default key reads: the daemon's home, or `null` when this daemon has no workstation. */
  keysHome?: string | null | undefined;
  /** The transport — the seam a test fakes the provider through. */
  fetch?: typeof fetch;
  /** Asks per badge per minute, over the route's own number. */
  perMinute?: number;
  now?: () => number;
  [seam: string]: unknown;
}

/** One line of the server list: the module, where its seams come from, and the old paths the home still answers for one release. */
export interface ServerModuleEntry {
  module: ServerModule;
  seams?: (options: RouteOptions) => ModuleSeams | undefined;
  /** Route path → the absolute path it used to answer at. The same handler, registered twice. */
  aliases?: Readonly<Record<string, string>>;
}

interface ModuleRouteScope {
  engine: Engine;
  store: Store;
  jobs: JobManager;
  workstation: Workstation | null | undefined;
  options: RouteOptions;
  /** The home's text model and the keys home it reads, for `host.text`. */
  textModel: TextModel;
  textKeysHome: string | null;
  /** Per-user BYOK key store (`user-keys.ts`), overriding env and home keys per call. */
  userKeys: UserKeyStore | null;
  /** A badge's claim rows, for resolving per-user BYOK identity. */
  claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
  /** The model routes' door, owner-only rule, person lookup and keys-home default — handed in so they are the same closures. */
  door: (req: FastifyRequest, canvasId: string) => Promise<void>;
  notTheOwners: (req: FastifyRequest, keysHome: string | null) => Promise<{ owner: string | null } | null>;
  personFor: (keysHome: string) => Promise<{ id: string; name: string } | null>;
  keysHomeOf: (explicit: string | null | undefined) => string | null;
}

/** How `sharp` is reached, when a seam lends it: the real import, or (in a test) one that fails as it does where the package is absent. */
type LoadSharp = () => Promise<{ default: typeof import("sharp").default }>;

/** Where a module's route answers: `/api/m/<slug>/<path>`. Spelled once, here and in core's route constants. */
function moduleRoutePath(moduleName: string, path: string): string {
  return `/api/m/${moduleSlug(moduleName)}/${path.replace(/^\/+/, "")}`;
}

const WINDOW_MS = 60_000;

/** A per-badge token bucket, the shape `LiveTokens.take` and `ImageModel.take` had. */
class Rate {
  private asked = new Map<string, number[]>();
  constructor(private readonly perMinute: number, private readonly now: () => number) {}
  take(badgeId: string): boolean {
    const now = this.now();
    const recent = (this.asked.get(badgeId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length >= this.perMinute) {
      this.asked.set(badgeId, recent);
      return false;
    }
    recent.push(now);
    this.asked.set(badgeId, recent);
    return true;
  }
}

function queryOf(req: FastifyRequest): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries((req.query ?? {}) as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  return out;
}

/** The canvas an ask names: `canvasId` in a POST body, `?canvasId=` on a GET. */
function canvasIdOf(route: ServerRoute, body: unknown, query: Readonly<Record<string, string>>): string | null {
  const named = route.method === "GET" ? query.canvasId : (body as { canvasId?: unknown } | null)?.canvasId;
  return typeof named === "string" && named ? named : null;
}

/** The actor an ask is made as, when its body names one — forwarded with it so the home claims it first, as the image route always did. */
function actorOf(body: unknown): Actor | undefined {
  const actor = (body as { actor?: { id?: unknown; name?: unknown } } | null)?.actor;
  return actor && typeof actor.id === "string" && typeof actor.name === "string" ? { id: actor.id, name: actor.name } : undefined;
}

/** Mount every server module's `/api/m/<slug>/*` routes and async job runners onto Fastify. */
export function registerModuleRoutes(app: FastifyInstance, scope: ModuleRouteScope, entries: readonly ServerModuleEntry[] = SERVER_MODULES): void {
  const { engine, store, jobs, workstation, options, textModel, textKeysHome, userKeys, claimsOf, door, notTheOwners, personFor, keysHomeOf } = scope;
  const homes = workstation?.homes ?? null;
  for (const entry of entries) {
    const seams = entry.seams?.(options) ?? {};
    const keysHome = keysHomeOf(seams.keysHome);
    const now = seams.now ?? Date.now;
    const transport = seams.fetch ?? fetch;
    const slug = moduleSlug(entry.module.name);
    if (entry.module.jobs) {
      for (const [kind, runner] of Object.entries(entry.module.jobs)) {
        jobs.registerRunner(kind, runner, seams);
      }
    }
    for (const route of entry.module.routes) {
      const spend = route.spend ?? "owner";
      const provider = route.provider;
      if (spend !== "none" && !provider) throw new Error(`${entry.module.name}'s route ${route.path} spends a key and names no provider`);
      const words = route.says ?? {};
      const rate = route.rate ? new Rate(seams.perMinute ?? route.rate.perMinute, now) : null;
      const path = moduleRoutePath(entry.module.name, route.path);
      /** Per-user BYOK key FIRST, else env (a handed-in seam key counts as env), else keys.json under `keysHome`. */
      const resolve = async (
        of: KeyProvider,
        callerId: string | null,
      ): Promise<{ key: string; source: "user" | "env" | "file"; credentialRef: CredentialRef } | undefined> => {
        if (callerId && userKeys) {
          const mine = await userKeys.get(callerId, of).catch(() => null);
          if (mine) return { key: mine.key, source: "user", credentialRef: mine.credentialRef };
        }
        if (seams.key && of === provider) {
          const key = seams.key()?.trim();
          return key ? { key, source: "env", credentialRef: formatCredentialRef({ scope: "env", provider: of }) } : undefined;
        }
        const found = warnRefusedKeys(() => resolveKey(of, { home: keysHome }));
        if (!found) return undefined;
        return {
          key: found.key,
          source: found.source,
          credentialRef: formatCredentialRef({ scope: found.source === "env" ? "env" : "home", provider: of }),
        };
      };
      /** May this badge spend a key of this source, under the route's `spend`? The owner's name when not, else null. */
      const refusedFor = async (req: FastifyRequest, source: "user" | "env" | "file"): Promise<{ owner: string | null } | null> => {
        if (source === "user" || source === "env" || !keysHome) return null;
        if (spend === "owner") return notTheOwners(req, keysHome);
        // `shared`: the owner's own badge is no exception — a stored key serves only once its owner shared it.
        const shared = await readKeyFile(keysHome).then((file) => file.share, () => false);
        return shared ? null : { owner: (await personFor(keysHome))?.name ?? null };
      };
      const handler = async (req: FastifyRequest, reply: FastifyReply): Promise<unknown> => {
        const body = route.method === "POST" ? req.body : undefined;
        const query = queryOf(req);
        const early = route.check?.({ body, query }) ?? null;
        if (early) return reply.status(early.status).send(early.body);
        const canvasId = canvasIdOf(route, body, query);
        if (!canvasId) {
          const said = words.badRequest ?? { code: "module-bad-request", error: `${slug}/${route.path} names the canvas it is for (\`canvasId\`)` };
          return reply.status(400).send({ error: said.error, code: said.code });
        }
        await door(req, canvasId);
        const home = homes?.for(canvasId) ?? null;
        const callerId = await resolveCallerId(req, engine, claimsOf, actorOf(body)?.id);
        const resolved = spend === "none" ? undefined : await resolve(provider!, callerId);
        const refused = resolved ? await refusedFor(req, resolved.source) : null;
        // A canvas homed elsewhere is served there — with that home's key, against that home's budget — unless this machine holds a key the badge may spend.
        if (home && (spend === "none" || !resolved || refused)) return home.personalRequest(route.method, path, body, actorOf(body));
        // Nothing is spent on a canvas that is not here: the door admits by badge, and a canvas nobody holds has no editors to spend on.
        if (!home) await engine.getSnapshot(canvasId);
        if (refused) return reply.status(403).send({ error: ownerOnlySentence(refused.owner), code: words.ownerOnly ?? "module-owner-only" });
        if (spend !== "none" && !resolved) {
          const said = words.unavailable ?? { code: "module-unavailable", error: `this home has no ${provider} key — ${slug} can't do this here (\`isocan keys set ${provider}\`, or Model keys…, on the machine that holds this canvas)` };
          return reply.status(503).send({ error: said.error, code: said.code });
        }
        const badgeId = req.badge!.badgeId;
        if (rate && !rate.take(badgeId)) {
          const said = words.rateLimited ?? { code: "module-rate-limited", error: `this badge has asked ${slug} for enough this minute — wait a moment and ask again` };
          return reply.status(429).send({ error: said.error, code: said.code });
        }
        const userTextKey = callerId && userKeys
          ? ((await userKeys.get(callerId, "anthropic").catch(() => null))
            ?? (await userKeys.get(callerId, "openai").catch(() => null)))
          : null;
        const userTextOverride = userTextKey
          ? { key: userTextKey.key, provider: (userTextKey.credentialRef.includes(":openai:") ? "openai" : "anthropic") as "anthropic" | "openai" }
          : null;
        const resolveForHost = async (of: KeyProvider): Promise<ResolvedServerKey | null> => {
          if (of === provider && resolved) return { key: resolved.key, credentialRef: resolved.credentialRef };
          const other = await resolve(of, callerId);
          if (!other) return null;
          return (await refusedFor(req, other.source)) ? null : { key: other.key, credentialRef: other.credentialRef };
        };
        const host: ServerHost = {
          module: entry.module.name,
          badgeId,
          speaksFor: (actorId) => engine.requireActor(badgeId, actorId),
          defaultActor: async () => {
            const bindings = await engine.actorBindings(badgeId, null);
            return bindings[0]?.actor ?? null;
          },
          keyFor: async (of) => (await resolveForHost(of))?.key ?? null,
          resolveKey: resolveForHost,
          canvas: (id) => engine.getSnapshot(id),
          listCanvases: async () => {
            const admitted = new Set(req.badge!.admissions.map((a) => a.canvasId));
            return (await engine.listCanvases()).filter((canvas) => admitted.has(canvas.id));
          },
          readBlob: async (id, blobHash) => {
            const stream = await store.openBlob(id, blobHash);
            if (!stream) return null;
            const chunks: Buffer[] = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
            return Buffer.concat(chunks);
          },
          putBlob: (id, bytes, meta) => engine.putBlob(id, Buffer.from(bytes), meta, undefined, badgeId),
          submit: async (ask) => {
            await engine.submit({ canvasId: ask.canvasId, actor: ask.actor, badgeId, op: ask.op, ...(ask.group ? { group: ask.group } : {}) });
          },
          startJob: (ask) => jobs.start(ask.canvasId, ask.actor, ask.spec, badgeId),
          text: {
            available: () => Boolean(userTextOverride) || textModel.available(),
            takesImages: () => (userTextOverride ? userTextOverride.provider === "anthropic" : textModel.takesImages()),
            write: async (ask, pictures): Promise<ModuleResponse> => {
              const source = userTextOverride ? "user" : textModel.keySource();
              const notOwners = source === "file" ? await notTheOwners(req, textKeysHome) : null;
              if (notOwners) return { status: 403, body: { error: ownerOnlySentence(notOwners.owner), code: TEXT_OWNER_ONLY } };
              const images: { mediaType: string; data: string }[] = [];
              for (const picture of pictures ?? []) {
                const ready = await pictureToSend(Buffer.from(picture.bytes), picture.mimeType, seams.loadSharp as LoadSharp | undefined);
                if (!ready) return { status: 503, body: { error: "this picture cannot be prepared without sharp at this home", code: TEXT_UNAVAILABLE } };
                images.push({ mediaType: ready.mediaType, data: ready.data });
              }
              if (!textModel.take(badgeId)) return { status: 429, body: { error: "this badge has asked for enough words this minute — wait a moment and ask again", code: TEXT_RATE_LIMITED } };
              const written = await textModel.write(ask, {
                ...(images.length ? { images } : {}),
                ...(userTextOverride ? { overrideKey: userTextOverride } : {}),
              });
              return { status: written.status, body: written.body };
            },
          },
          fetch: transport,
          now,
          options: { ...(keysHome ? { dataDir: keysHome } : {}), ...seams },
          log: (line) => console.warn(`[isocan] ${slug}: ${line}`),
        };
        const answer = await route.handler({ canvasId, body, query, badgeId }, host);
        return reply.status(answer.status).send(answer.body);
      };
      const opts = route.method === "POST" ? { bodyLimit: route.bodyLimit ?? 16 * 1024 } : {};
      const urls = [path, ...(entry.aliases?.[route.path] ? [entry.aliases[route.path]!] : [])];
      for (const url of urls) {
        if (route.method === "POST") app.post(url, opts, handler);
        else app.get(url, handler);
      }
    }
  }
}
