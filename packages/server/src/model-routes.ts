import { promises as fs } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { atLeast, sameActor, type ActorClaim, JUDGMENT_BAD_REQUEST, JUDGMENT_MAX_BYTES, JUDGMENT_RATE_LIMITED, JUDGMENT_ROUTE, JUDGMENT_TOO_LARGE, JUDGMENT_UNAVAILABLE, type JudgmentRequest } from "@isocan/core";
import { TEXT_BAD_REQUEST, TEXT_MAX_BYTES, TEXT_RATE_LIMITED, TEXT_ROUTE, TEXT_TOO_LARGE, TEXT_UNAVAILABLE, type TextRequest } from "@isocan/core/text";
import { JUDGMENT_OWNER_ONLY, LIVE_TOKEN_BAD_REQUEST, LIVE_TOKEN_OWNER_ONLY, LIVE_TOKEN_RATE_LIMITED, LIVE_TOKEN_ROUTE, LIVE_TOKEN_UNAVAILABLE, ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { defaultKeysHome, readKeyFile } from "@isocan/core/keystore";
import type { Engine } from "./engine.ts";
import { capabilityIn, type ViewOnlyError } from "./grants.ts";
import type { RouteOptions } from "./http.ts";
import { Judge } from "./judgment.ts";
import { LiveTokens } from "./live-token.ts";
import { identityFile } from "./paths.ts";
import { RefusedError, TakenDownError, type Refusals } from "./takedowns.ts";
import { TextModel } from "./text.ts";

/**
 * **The routes that spend the home's keys** — `POST /api/judgment` (the
 * judge, wireframes phase 5), `POST /api/text` (the text model, copy-edit
 * phase 0.5) and, since keys phase 4, `POST /api/voice/token` (a Gemini Live
 * token for the talk module). Moved out of `registerRoutes` together on 2 Oct 2026 when the
 * second landed, so `registerRoutes` stays under its agreed length
 * (`register-routes.test.ts`) and the twins sit side by side. They read the
 * same closures — the takedown list, the admission, the view-only refusal —
 * handed in by `registerRoutes` where the judgment route used to begin, so
 * registration order is what it was.
 */
interface ModelRouteScope {
  engine: Engine;
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
  const { engine, options, refusals, admit, viewOnly, claimsOf } = scope;
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
  const notTheOwners = async (req: FastifyRequest, keysHome: string): Promise<{ owner: string | null } | null> => {
    const shared = await readKeyFile(keysHome).then((file) => file.share, () => false);
    if (shared) return null;
    const person = await personAt(keysHome);
    if (!person) return { owner: null };
    const [joined, claims] = await Promise.all([engine.actorJoins(), claimsOf(req.badge!.badgeId)]);
    return claims.some((row) => sameActor(joined, row.actorId, person.id)) ? null : { owner: person.name };
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
  const judge = new Judge(options.judgment ?? {});
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
    const down = refusals.of(canvasId);
    if (down) throw new TakenDownError(down);
    const refusedBadge = refusals.refusingAttestation(req.badge?.attestations ?? []);
    if (refusedBadge) throw new RefusedError(refusedBadge);
    await admit(req, canvasId);
    if (!atLeast(capabilityIn(req.badge!, canvasId) ?? "edit", "edit")) throw await viewOnly(canvasId);
    const question = { ...(body.model !== undefined ? { model: body.model } : {}), state: body.state, questions: body.questions };
    // A canvas homed elsewhere is judged there — with that home's key, against
    // that home's budget — unless this machine holds a key of its own.
    const home = options.homes?.for(canvasId) ?? null;
    const source = judge.keySource();
    // The machine's person's own key, asked for by someone else with sharing
    // off: theirs to spend, not this badge's (owner-only spend). A canvas
    // homed elsewhere is asked there instead, under the home's own rule.
    const refused = source === "file" ? await notTheOwners(req, options.judgment?.keysHome ?? defaultKeysHome()) : null;
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
    const answered = await judge.ask(question);
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
  const textModel = new TextModel(options.text ?? {});
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
    const down = refusals.of(canvasId);
    if (down) throw new TakenDownError(down);
    const refusedBadge = refusals.refusingAttestation(req.badge?.attestations ?? []);
    if (refusedBadge) throw new RefusedError(refusedBadge);
    await admit(req, canvasId);
    if (!atLeast(capabilityIn(req.badge!, canvasId) ?? "edit", "edit")) throw await viewOnly(canvasId);
    const asked = { prompt: body.prompt, schema: body.schema };
    // A canvas homed elsewhere is written for there — with that home's key,
    // against that home's budget — unless this machine holds a key of its own.
    const home = options.homes?.for(canvasId) ?? null;
    const source = textModel.keySource();
    // The judgment route's owner-only rule, for words.
    const refused = source === "file" ? await notTheOwners(req, options.text?.keysHome ?? defaultKeysHome()) : null;
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
    const written = await textModel.write(asked);
    return reply.status(written.status).send(written.body);
  });
  /**
   * **`POST /api/voice/token` — a short-lived Gemini Live token, minted with
   * this home's key** (keys phase 4; `live-token.ts` holds the key and the
   * rate). What the talk module asks once per session, so the browser opens
   * the Live socket with a one-use token and never holds a key. The text
   * route's door in the text route's order: the shape, the takedown and the
   * refused badge, the admission and the edit rung (a voice session acts on
   * the canvas), then — for a canvas homed elsewhere — that home's own token,
   * then whose key it is, then the key and the badge's budget.
   */
  const liveTokens = new LiveTokens(options.liveToken ?? {});
  app.post(LIVE_TOKEN_ROUTE, { bodyLimit: 4096 }, async (req, reply) => {
    const body = req.body as { canvasId?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
      return reply.status(400).send({ error: "a voice token names the canvas it is for (`canvasId`)", code: LIVE_TOKEN_BAD_REQUEST });
    }
    const canvasId = body.canvasId;
    const down = refusals.of(canvasId);
    if (down) throw new TakenDownError(down);
    const refusedBadge = refusals.refusingAttestation(req.badge?.attestations ?? []);
    if (refusedBadge) throw new RefusedError(refusedBadge);
    await admit(req, canvasId);
    if (!atLeast(capabilityIn(req.badge!, canvasId) ?? "edit", "edit")) throw await viewOnly(canvasId);
    const home = options.homes?.for(canvasId) ?? null;
    const source = liveTokens.keySource();
    const refused = source === "file" ? await notTheOwners(req, options.liveToken?.keysHome ?? defaultKeysHome()) : null;
    if (home && (!source || refused)) return home.personalRequest("POST", LIVE_TOKEN_ROUTE, { canvasId });
    if (!home) await engine.getSnapshot(canvasId);
    if (refused) return reply.status(403).send({ error: ownerOnlySentence(refused.owner), code: LIVE_TOKEN_OWNER_ONLY });
    if (!source) {
      return reply.status(503).send({ error: "this home has no Gemini key — voice can't start here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)", code: LIVE_TOKEN_UNAVAILABLE });
    }
    if (!liveTokens.take(req.badge!.badgeId)) {
      return reply.status(429).send({ error: "this badge has started enough voice sessions this minute — wait a moment and press again", code: LIVE_TOKEN_RATE_LIMITED });
    }
    const minted = await liveTokens.mint();
    return reply.status(minted.status).send(minted.body);
  });
}
