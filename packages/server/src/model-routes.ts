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

import { promises as fs } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { atLeast, sameActor, type ActorClaim, JUDGMENT_BAD_REQUEST, JUDGMENT_MAX_BYTES, JUDGMENT_RATE_LIMITED, JUDGMENT_ROUTE, JUDGMENT_TOO_LARGE, JUDGMENT_UNAVAILABLE, type JudgmentRequest } from "@isocan/core";
import { TEXT_BAD_REQUEST, TEXT_MAX_BYTES, TEXT_PICTURES_ROUTE, TEXT_RATE_LIMITED, TEXT_ROUTE, TEXT_TOO_LARGE, TEXT_UNAVAILABLE, type TextPictures, type TextRequest } from "@isocan/core/text";
import { JUDGMENT_OWNER_ONLY, ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { readKeyFile } from "@isocan/core/keystore";
import type { Desk } from "./desk.ts";
import type { Engine } from "./engine.ts";
import { capabilityIn, type ViewOnlyError } from "./grants.ts";
import type { RouteOptions } from "./http.ts";
import { JobManager, registerJobRoutes } from "./jobs.ts";
import { Judge } from "./judgment.ts";
import { registerModuleRoutes } from "./module-routes.ts";
import { identityFile } from "./paths.ts";
import { RefusedError, TakenDownError, type Refusals } from "./takedowns.ts";
import { registerSummaryRoutes } from "./summaries.ts";
import type { Store } from "./store.ts";
import { TextModel } from "./text.ts";
import { registerUserKeyRoutes, resolveCallerId } from "./user-keys.ts";
import type { Workstation } from "./workstation.ts";

/**
 * **The routes that spend the home's keys** — `POST /api/judgment` (the
 * judge, wireframes phase 5) and `POST /api/text` (the text model, copy-edit
 * phase 0.5). Moved out of `registerRoutes` together on 2 Oct 2026 when the
 * second landed, so `registerRoutes` stays under its agreed length
 * (`register-routes.test.ts`) and the twins sit side by side. They read the
 * same closures — the takedown list, the admission, the view-only refusal —
 * handed in by `registerRoutes` where the judgment route used to begin, so
 * registration order is what it was. The talk module's voice token and the
 * mood module's pictures lived here too (keys phase 4, moodboard phases 0
 * and 2) until 19 Nov 2026, when modules could own a route: they are the
 * modules' now (`module-routes.ts`), behind this file's door.
 */
interface ModelRouteScope {
  engine: Engine;
  /** The canvas's blobs, which Semantic Zoom's make route reads a note's words from. */
  store: Store;
  /** The home's desk, where Semantic Zoom's summary budget lives. */
  desk: Desk;
  /** The local workstation (`keys.json`, `identity.json`, `homes`), or null on a hosted home. */
  workstation: Workstation | null | undefined;
  options: RouteOptions;
  refusals: Refusals;
  admit: (req: FastifyRequest, canvasId: string) => Promise<unknown>;
  viewOnly: (canvasId: string) => Promise<ViewOnlyError>;
  /** A badge's claim rows — the actors it speaks for, which owner-only spend compares with this machine's person. */
  claimsOf: (badgeId: string) => Promise<ActorClaim[]>;
}

/** This machine's person: `identity.json` beside the keys.json being spent. Null when the machine has not said who it is. */
async function personAt(home: string): Promise<{ id: string; name: string } | null> {
  try {
    const raw = JSON.parse(await fs.readFile(identityFile(home), "utf8")) as { id?: unknown; name?: unknown };
    return typeof raw.id === "string" && raw.id && typeof raw.name === "string" ? { id: raw.id, name: raw.name } : null;
  } catch {
    return null;
  }
}

/** The judgment and text routes, on `app`, at the point `registerRoutes` reaches them. */
export function registerModelRoutes(app: FastifyInstance, scope: ModelRouteScope): void {
  const { engine, store, desk, workstation, options, refusals, admit, viewOnly, claimsOf } = scope;
  const homes = workstation?.homes ?? null;
  const userKeys = options.userKeys ?? null;
  const keysHomeOf = (explicit: string | null | undefined): string | null =>
    explicit !== undefined ? explicit : (workstation?.keysHome ?? null);
  const personFor = (keysHome: string): Promise<{ id: string; name: string } | null> =>
    workstation && keysHome === workstation.keysHome ? workstation.person() : personAt(keysHome);
  const userTextKeyFor = async (callerId: string | null): Promise<{ key: string; provider: "anthropic" | "openai" } | null> => {
    if (!callerId || !userKeys) return null;
    const named = (userKeys.env().ISOCAN_TEXT_PROVIDER ?? "").trim().toLowerCase();
    const order: Array<"anthropic" | "openai"> = named === "openai" ? ["openai", "anthropic"] : ["anthropic", "openai"];
    for (const p of order) {
      const found = await userKeys.get(callerId, p).catch(() => null);
      if (found) return { key: found.key, provider: p };
    }
    return null;
  };
  /**
   * **Owner-only spend** (keys phase 3; `docs/projects/keys/design.md`). A key
   * from keys.json is this machine's person's own, and pays only for them:
   * the request's badge must claim an actor that resolves, through
   * `actor.join`, to the `identity.json` beside that keys.json — unless the
   * owner turned sharing on (`isocan keys share on`, or the switch in *Model
   * keys*). A key from the environment is the operator's and is not asked
   * this: a hosted home and CI serve every editor, as before. Read per
   * request, like the key, so turning sharing on needs no restart.
   *
   * The answer is the owner's name when the badge is not theirs, else null.
   */
  const notTheOwners = async (req: FastifyRequest, keysHome: string | null): Promise<{ owner: string | null } | null> => {
    if (!keysHome) return null;
    const shared = await readKeyFile(keysHome).then((file) => file.share, () => false);
    if (shared) return null;
    const person = await personFor(keysHome);
    if (!person) return { owner: null };
    const [joined, claims] = await Promise.all([engine.actorJoins(), claimsOf(req.badge!.badgeId)]);
    return claims.some((row) => sameActor(joined, row.actorId, person.id)) ? null : { owner: person.name };
  };
  /**
   * **The door every spending route opens with**, in this order: the takedown
   * and the refused badge, the admission, and the edit rung — a model is
   * spent on a canvas only by someone who may edit it. One function so the
   * routes cannot drift (moodboard phase 0 made it a fourth; the modules'
   * routes read the same closure, handed in).
   */
  const door = async (req: FastifyRequest, canvasId: string): Promise<void> => {
    const down = refusals.of(canvasId);
    if (down) throw new TakenDownError(down);
    const refusedBadge = refusals.refusingAttestation(req.badge?.attestations ?? []);
    if (refusedBadge) throw new RefusedError(refusedBadge);
    await admit(req, canvasId);
    if (!atLeast(capabilityIn(req.badge!, canvasId) ?? "edit", "edit")) throw await viewOnly(canvasId);
  };
  /**
   * **`POST /api/judgment` — a typed question, answered with this home's key**
   * (`@isocan/core`'s `judgment.ts`; `judgment.ts` here holds the key and the
   * rate). What the web's wireframe composer asks through, so the key never
   * reaches a browser, and what a CLI with no key of its own asks through too.
   *
   * The door is `/api/ops`'s, spelled the same way and for its reason: the
   * canvas travels in the BODY, so the hook cannot cover this route, and a
   * judgment is spent on a canvas only by someone who may edit it. In order:
   * the size (a refusal that costs nothing), the shape, the takedown and the
   * refused badge, the admission and the edit rung, then — for a canvas homed
   * elsewhere — that home's own judgment, then whose key it is (owner-only
   * spend), then the key and the badge's budget.
   */
  const judgmentKeysHome = keysHomeOf(options.judgment?.keysHome);
  const judge = new Judge({ keysHome: judgmentKeysHome, ...options.judgment });
  app.post(JUDGMENT_ROUTE, { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const declared = Number(req.headers["content-length"]);
    const size = Number.isFinite(declared) && declared > 0 ? declared : Buffer.byteLength(JSON.stringify(req.body ?? null));
    if (size > JUDGMENT_MAX_BYTES) {
      return reply.status(413).send({ error: `a question file is at most ${JUDGMENT_MAX_BYTES} bytes — this one is ${size}`, code: JUDGMENT_TOO_LARGE });
    }
    const body = req.body as Partial<JudgmentRequest> | null;
    if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
      return reply.status(400).send({ error: "a judgment names the canvas it is for (`canvasId`)", code: JUDGMENT_BAD_REQUEST });
    }
    if (!body.questions || typeof body.questions !== "object" || Array.isArray(body.questions) || Object.keys(body.questions).length === 0 || !("state" in body)) {
      return reply.status(400).send({ error: "a judgment is a question file: one `state` and named `questions`", code: JUDGMENT_BAD_REQUEST });
    }
    if (body.model !== undefined && typeof body.model !== "string") {
      return reply.status(400).send({ error: "`model` names the judge's model", code: JUDGMENT_BAD_REQUEST });
    }
    const canvasId = body.canvasId;
    await door(req, canvasId);
    const question = { ...(body.model !== undefined ? { model: body.model } : {}), state: body.state, questions: body.questions };
    // A canvas homed elsewhere is judged there — with that home's key, against
    // that home's budget — unless this machine holds a key of its own.
    const home = homes?.for(canvasId) ?? null;
    const callerId = await resolveCallerId(req, engine, claimsOf);
    const userKey = callerId && userKeys ? await userKeys.get(callerId, "typesafe").catch(() => null) : null;
    const source = userKey ? "user" : judge.keySource();
    // The machine's person's own key, asked for by someone else with sharing
    // off: theirs to spend, not this badge's (owner-only spend). A per-user
    // key overrides home/env keys and always belongs to the caller.
    const refused = source === "file" ? await notTheOwners(req, judgmentKeysHome) : null;
    if (home && (!source || refused)) return home.personalRequest("POST", JUDGMENT_ROUTE, { canvasId, ...question });
    // No judgment for a canvas that is not here: the door's test admits by
    // badge, and a canvas nobody holds has no editors to spend on.
    if (!home) await engine.getSnapshot(canvasId);
    if (refused) return reply.status(403).send({ error: ownerOnlySentence(refused.owner), code: JUDGMENT_OWNER_ONLY });
    if (!source) {
      return reply.status(503).send({ error: "this home has no judge — nothing can be asked here (the innkeeper sets TYPESAFE_API_KEY, or `isocan keys set typesafe` on the machine it runs on)", code: JUDGMENT_UNAVAILABLE });
    }
    if (!judge.take(req.badge!.badgeId)) {
      return reply.status(429).send({ error: "this badge has asked for enough judgments this minute — wait a moment and ask again", code: JUDGMENT_RATE_LIMITED });
    }
    const answered = await judge.ask(question, userKey?.key);
    return reply.status(answered.status).send(answered.body);
  });
  /**
   * **`POST /api/text` — a prompt and a schema, written with this home's key**
   * (`@isocan/core`'s `text.ts`; `text.ts` here holds the key and the rate).
   * The judgment route's twin, for words: what the web's `/wire copy`, `/wire
   * name` and a content `/wire edit` write through, so the key never reaches
   * a browser. The same door in the same order, for the same reasons: the
   * size, the shape, the takedown and the refused badge, the admission and
   * the edit rung, then — for a canvas homed elsewhere — that home's own text
   * model, then whose key it is, then the key and the badge's budget.
   */
  const textKeysHome = keysHomeOf(options.text?.keysHome);
  const textModel = new TextModel({ keysHome: textKeysHome, ...options.text });
  app.post(TEXT_ROUTE, { bodyLimit: 1024 * 1024 }, async (req, reply) => {
    const declared = Number(req.headers["content-length"]);
    const size = Number.isFinite(declared) && declared > 0 ? declared : Buffer.byteLength(JSON.stringify(req.body ?? null));
    if (size > TEXT_MAX_BYTES) {
      return reply.status(413).send({ error: `a text request is at most ${TEXT_MAX_BYTES} bytes — this one is ${size}`, code: TEXT_TOO_LARGE });
    }
    const body = req.body as Partial<TextRequest> | null;
    if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
      return reply.status(400).send({ error: "a text request names the canvas it is for (`canvasId`)", code: TEXT_BAD_REQUEST });
    }
    if (typeof body.prompt !== "string" || !body.prompt.trim() || !body.schema || typeof body.schema !== "object" || Array.isArray(body.schema) || typeof body.schema.type !== "string") {
      return reply.status(400).send({ error: "a text request is a `prompt` and the JSON `schema` its answer must satisfy", code: TEXT_BAD_REQUEST });
    }
    const canvasId = body.canvasId;
    await door(req, canvasId);
    const asked = { prompt: body.prompt, schema: body.schema };
    // A canvas homed elsewhere is written for there — with that home's key,
    // against that home's budget — unless this machine holds a key of its own.
    const home = homes?.for(canvasId) ?? null;
    const callerId = await resolveCallerId(req, engine, claimsOf);
    const userTextKey = await userTextKeyFor(callerId);
    const source = userTextKey ? "user" : textModel.keySource();
    // The judgment route's owner-only rule, for words. A per-user key overrides home/env keys.
    const refused = source === "file" ? await notTheOwners(req, textKeysHome) : null;
    if (home && (!source || refused)) return home.personalRequest("POST", TEXT_ROUTE, { canvasId, ...asked });
    // Nothing is written for a canvas that is not here.
    if (!home) await engine.getSnapshot(canvasId);
    if (refused) return reply.status(403).send({ error: ownerOnlySentence(refused.owner), code: TEXT_OWNER_ONLY });
    if (!source) {
      return reply.status(503).send({ error: "this home has no text model — words can't be written here (the innkeeper sets ISOCAN_TEXT_API_KEY, or `isocan keys set anthropic` on the machine it runs on)", code: TEXT_UNAVAILABLE });
    }
    if (!textModel.take(req.badge!.badgeId)) {
      return reply.status(429).send({ error: "this badge has asked for enough words this minute — wait a moment and ask again", code: TEXT_RATE_LIMITED });
    }
    const written = await textModel.write(asked, userTextKey ? { overrideKey: userTextKey } : {});
    return reply.status(written.status).send(written.body);
  });
  /**
   * **`GET /api/text/pictures` — does the text model here look at pictures**
   * (Semantic Zoom design §11). What Settings' "look at pictures" row asks
   * before it offers itself: with a model that takes none, the row says so
   * and stays off. It names no key and spends nothing, so any badge may ask.
   */
  app.get(TEXT_PICTURES_ROUTE, async (req) => {
    const userKey = await userTextKeyFor(await resolveCallerId(req, engine, claimsOf));
    if (userKey) {
      if (userKey.provider !== "anthropic") return { pictures: false, why: "Your text model key takes no pictures, so this stays off." } satisfies TextPictures;
      return { pictures: true } satisfies TextPictures;
    }
    if (!textModel.available()) return { pictures: false, why: "This home has no text model, so nothing is summarised here." } satisfies TextPictures;
    if (!textModel.takesImages()) return { pictures: false, why: "This home's text model takes no pictures, so this stays off." } satisfies TextPictures;
    return { pictures: true } satisfies TextPictures;
  });
  /**
   * **Semantic Zoom's summaries** (`summaries.ts`): read by anyone who may
   * view, made through this text model and this owner-only rule, in-process
   * — `/api/text`'s guards, with a summary's own system line and model.
   */
  registerSummaryRoutes(app, {
    engine, store, desk, homes, refusals, admit, viewOnly, textModel,
    notTheOwners: (req) => notTheOwners(req, textKeysHome),
    keyOwner: async () => (textKeysHome ? (await personFor(textKeysHome))?.id ?? null : null),
    userTextKey: async (req) => {
      const callerId = await resolveCallerId(req, engine, claimsOf);
      const found = await userTextKeyFor(callerId);
      return found && callerId ? { ...found, callerId } : null;
    },
    options: options.summaries ?? {},
  });
  /**
   * **The modules' own routes** (`module-routes.ts`; Open Stitch phase 0.1,
   * 19 Nov 2026): talk's voice token and mood's pictures and swatches, which
   * lived here as `POST /api/voice/token`, `/api/image` and
   * `/api/image/swatches` until the module seam existed. The same door, the
   * same owner-only rule, the same closures — handed in, so a module's route
   * and the home's cannot drift — mounted at `/api/m/<module>/…`, with the
   * old paths answering for one release.
   */
  const jobs = options.jobs ?? new JobManager({ engine, store, keysHome: workstation?.keysHome ?? null });
  registerModuleRoutes(app, {
    engine, store, jobs, workstation, options, textModel, textKeysHome, userKeys, claimsOf,
    door, notTheOwners, personFor, keysHomeOf,
  });
  // Per-user BYOK key routes (`GET|PUT|DELETE /api/me/keys`), active on both local and hosted homes.
  registerUserKeyRoutes(app, { engine, workstation, userKeys, claimsOf, notTheOwners });
  registerJobRoutes(app, { jobs, engine, homes });
}
