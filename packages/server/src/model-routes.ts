import { promises as fs } from "node:fs";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { atLeast, newGroupId, newId, newItemId, newVersionId, sameActor, type ActorClaim, JUDGMENT_BAD_REQUEST, JUDGMENT_MAX_BYTES, JUDGMENT_RATE_LIMITED, JUDGMENT_ROUTE, JUDGMENT_TOO_LARGE, JUDGMENT_UNAVAILABLE, type JudgmentRequest } from "@isocan/core";
import { TEXT_BAD_REQUEST, TEXT_MAX_BYTES, TEXT_PICTURES_ROUTE, TEXT_RATE_LIMITED, TEXT_ROUTE, TEXT_TOO_LARGE, TEXT_UNAVAILABLE, type TextPictures, type TextRequest } from "@isocan/core/text";
import { JUDGMENT_OWNER_ONLY, LIVE_TOKEN_BAD_REQUEST, LIVE_TOKEN_OWNER_ONLY, LIVE_TOKEN_RATE_LIMITED, LIVE_TOKEN_ROUTE, LIVE_TOKEN_UNAVAILABLE, ownerOnlySentence, TEXT_OWNER_ONLY } from "@isocan/core/keys";
import { readKeyFile } from "@isocan/core/keystore";
import { deniedIn, IMAGE_BAD_REQUEST, IMAGE_OWNER_ONLY, IMAGE_RATE_LIMITED, IMAGE_REFUSED, IMAGE_ROUTE, IMAGE_UNAVAILABLE, IMAGE_UPSTREAM, isMoodDial, MOOD_DEFAULT_N, MOOD_DIALS, MOOD_MAX_N, MOOD_PROPS, MOOD_TILE, moodPrompt, moodPushPrompt, moodTray, spreadAxes, SWATCHES_ROUTE, type ImageRequest, type ImageResponse, type SwatchesRequest } from "@isocan/core/mood";
import type { Desk } from "./desk.ts";
import type { Engine } from "./engine.ts";
import { capabilityIn, type ViewOnlyError } from "./grants.ts";
import type { RouteOptions } from "./http.ts";
import { Judge } from "./judgment.ts";
import { LiveTokens } from "./live-token.ts";
import { ImageModel, type Drawn } from "./image.ts";
import { extractMoodSwatches } from "./mood-swatches.ts";
import { identityFile } from "./paths.ts";
import { RefusedError, TakenDownError, type Refusals } from "./takedowns.ts";
import { registerSummaryRoutes } from "./summaries.ts";
import type { Store } from "./store.ts";
import { TextModel } from "./text.ts";
import type { Workstation } from "./workstation.ts";

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
  const keysHomeOf = (explicit: string | null | undefined): string | null =>
    explicit !== undefined ? explicit : (workstation?.keysHome ?? null);
  const personFor = (keysHome: string): Promise<{ id: string; name: string } | null> =>
    workstation && keysHome === workstation.keysHome ? workstation.person() : personAt(keysHome);
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
   * four routes cannot drift (moodboard phase 0 made it a fourth).
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
    const source = judge.keySource();
    // The machine's person's own key, asked for by someone else with sharing
    // off: theirs to spend, not this badge's (owner-only spend). A canvas
    // homed elsewhere is asked there instead, under the home's own rule.
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
    const source = textModel.keySource();
    // The judgment route's owner-only rule, for words.
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
    const written = await textModel.write(asked);
    return reply.status(written.status).send(written.body);
  });
  /**
   * **`GET /api/text/pictures` — does the text model here look at pictures**
   * (Semantic Zoom design §11). What Settings' "look at pictures" row asks
   * before it offers itself: with a model that takes none, the row says so
   * and stays off. It names no key and spends nothing, so any badge may ask.
   */
  app.get(TEXT_PICTURES_ROUTE, async () => {
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
    options: options.summaries ?? {},
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
  const liveKeysHome = keysHomeOf(options.liveToken?.keysHome);
  const liveTokens = new LiveTokens({ keysHome: liveKeysHome, ...options.liveToken });
  app.post(LIVE_TOKEN_ROUTE, { bodyLimit: 4096 }, async (req, reply) => {
    const body = req.body as { canvasId?: unknown } | null;
    if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
      return reply.status(400).send({ error: "a voice token names the canvas it is for (`canvasId`)", code: LIVE_TOKEN_BAD_REQUEST });
    }
    const canvasId = body.canvasId;
    await door(req, canvasId);
    const home = homes?.for(canvasId) ?? null;
    const source = liveTokens.keySource();
    const refused = source === "file" ? await notTheOwners(req, liveKeysHome) : null;
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
  /**
   * **`POST /api/image` — a spread of mood-board pictures, drawn with this
   * home's Gemini key** (moodboard phase 0; `docs/projects/moodboard/design.md`
   * §2; `image.ts` holds the key and the rate). The person's words, wrapped in
   * core's template once per axis, `n` pictures (nine by default, twelve at
   * most), each uploaded as a blob and added as an image item carrying its
   * provenance (§1), laid out as a tray beside the canvas's content — all
   * one undoable group.
   *
   * The voice route's door in its order, with two refusals that cost nothing
   * ahead of it: the shape (an `n` past the cap is refused, never trimmed)
   * and the deny-list (`deniedIn`), so a request naming a brand is told so
   * before anything is spent. Then the door, then — for a canvas homed
   * elsewhere — that home's own route, then whose key it is, then that the
   * badge speaks for the actor the tiles are added as, then the key and the
   * badge's budget. A tile the model will not draw is reported with the
   * model's own words; when none is drawn, the first of them is the answer.
   */
  const imageKeysHome = keysHomeOf(options.image?.keysHome);
  const images = new ImageModel({ keysHome: imageKeysHome, ...options.image });
  app.post(IMAGE_ROUTE, { bodyLimit: 16 * 1024 }, async (req, reply) => {
    const body = req.body as Partial<ImageRequest> | null;
    if (!body || typeof body !== "object" || typeof body.canvasId !== "string" || !body.canvasId) {
      return reply.status(400).send({ error: "an image request names the canvas it is for (`canvasId`)", code: IMAGE_BAD_REQUEST });
    }
    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000) {
      return reply.status(400).send({ error: "an image request carries the person's words (`prompt`), at most 2000 characters", code: IMAGE_BAD_REQUEST });
    }
    const actor = body.actor;
    if (!actor || typeof actor !== "object" || typeof actor.id !== "string" || !actor.id || typeof actor.name !== "string") {
      return reply.status(400).send({ error: "an image request names who the tiles are added as (`actor`)", code: IMAGE_BAD_REQUEST });
    }
    const n = body.n ?? MOOD_DEFAULT_N;
    if (!Number.isInteger(n) || n < 1 || n > MOOD_MAX_N) {
      return reply.status(400).send({ error: `a spread is 1 to ${MOOD_MAX_N} images — ${String(body.n)} is past the per-run cap`, code: IMAGE_BAD_REQUEST });
    }
    if (body.parent !== undefined && (typeof body.parent !== "string" || !body.parent)) {
      return reply.status(400).send({ error: "`parent` names the image item the spread varies", code: IMAGE_BAD_REQUEST });
    }
    if (body.push !== undefined && !isMoodDial(body.push)) {
      return reply.status(400).send({ error: `\`push\` must be one of ${MOOD_DIALS.join(", ")} — got ${JSON.stringify(body.push)}`, code: IMAGE_BAD_REQUEST });
    }
    const denied = deniedIn(body.prompt);
    if (denied) return reply.status(422).send({ error: denied, code: IMAGE_REFUSED });
    const canvasId = body.canvasId;
    await door(req, canvasId);
    const asked: ImageRequest = {
      canvasId,
      actor: { id: actor.id, name: actor.name },
      prompt: body.prompt,
      n,
      ...(body.parent ? { parent: body.parent } : {}),
      ...(body.push ? { push: body.push } : {}),
    };
    const home = homes?.for(canvasId) ?? null;
    const source = images.keySource();
    const refused = source === "file" ? await notTheOwners(req, imageKeysHome) : null;
    if (home && (!source || refused)) return home.personalRequest("POST", IMAGE_ROUTE, asked, asked.actor);
    if (refused) return reply.status(403).send({ error: ownerOnlySentence(refused.owner), code: IMAGE_OWNER_ONLY });
    if (!source) {
      return reply.status(503).send({ error: "this home has no Gemini key — pictures can't be drawn here (`isocan keys set gemini`, or Model keys…, on the machine that holds this canvas)", code: IMAGE_UNAVAILABLE });
    }
    const badgeId = req.badge!.badgeId;
    await engine.requireActor(badgeId, asked.actor.id);
    const snapshot = await engine.getSnapshot(canvasId);
    let parentImage: { bytes: Buffer; mimeType: string } | undefined;
    if (asked.parent) {
      const item = snapshot.canvas.items[asked.parent];
      const version = item?.versions.find((v) => v.id === item.currentVersionId);
      if (!item || !version || !version.mimeType.startsWith("image/")) {
        return reply.status(400).send({ error: `${asked.parent} is not an image on this canvas — More like this varies a picture`, code: IMAGE_BAD_REQUEST });
      }
      const stream = await store.openBlob(canvasId, version.blobHash);
      if (!stream) return reply.status(404).send({ error: `the picture of ${asked.parent} is not at this home`, code: IMAGE_BAD_REQUEST });
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
      parentImage = { bytes: Buffer.concat(chunks), mimeType: version.mimeType };
    }
    if (!images.take(badgeId)) {
      return reply.status(429).send({ error: "this badge has explored enough this minute — wait a moment and ask again", code: IMAGE_RATE_LIMITED });
    }
    const model = images.model();
    const axes = spreadAxes(n);
    // Three at a time: a spread arrives in seconds, not a burst of twelve.
    const drawn: Drawn[] = new Array(axes.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(3, axes.length) }, async () => {
      while (next < axes.length) {
        const i = next++;
        const prompt = asked.push
          ? moodPushPrompt(asked.prompt, asked.push, axes[i]!.reach)
          : moodPrompt(asked.prompt, axes[i]!.reach);
        drawn[i] = await images.draw(prompt, parentImage);
      }
    }));
    const answer: ImageResponse = { run: newId("mood"), model, group: newGroupId(), items: [], refused: [] };
    const spots = moodTray(snapshot.canvas, drawn.filter((d) => d.ok).length);
    for (const [i, result] of drawn.entries()) {
      const { axis, reach } = axes[i]!;
      const axisLabel = asked.push ? `push: ${asked.push} · ${axis}` : asked.parent ? `more: ${axis}` : axis;
      const prompt = asked.push ? moodPushPrompt(asked.prompt, asked.push, reach) : moodPrompt(asked.prompt, reach);
      if (!result.ok) {
        answer.refused.push({ axis: axisLabel, why: result.why });
        continue;
      }
      const filename = `mood-${axis.replace(/\W+/g, "-")}.${result.mimeType === "image/jpeg" ? "jpg" : result.mimeType.split("/")[1] ?? "png"}`;
      const put = await engine.putBlob(canvasId, result.bytes, { mimeType: result.mimeType, filename }, undefined, badgeId);
      const itemId = newItemId();
      await engine.submit({
        canvasId, actor: asked.actor, badgeId, group: answer.group,
        op: {
          type: "item.add", itemId,
          version: { id: newVersionId(), blobHash: put.blobHash, mimeType: put.mimeType, filename, size: put.size },
          ...MOOD_TILE,
          placement: spots[answer.items.length]!,
          title: `${asked.prompt.trim().slice(0, 60)} — ${axisLabel}`,
          properties: {
            [MOOD_PROPS.mood]: "candidate",
            [MOOD_PROPS.prompt]: prompt,
            [MOOD_PROPS.axis]: axisLabel,
            [MOOD_PROPS.model]: model,
            [MOOD_PROPS.run]: answer.run,
            ...(asked.parent ? { [MOOD_PROPS.parent]: asked.parent } : {}),
          },
        },
      });
      answer.items.push({ itemId, axis: axisLabel });
    }
    if (answer.items.length === 0) {
      return reply.status(502).send({ error: answer.refused[0]?.why ?? "Google drew nothing", code: IMAGE_UPSTREAM });
    }
    return answer;
  });
  /**
   * **`POST /api/image/swatches` — read up to six dominant colour swatches
   * from an image item** (moodboard phase 2; `docs/projects/moodboard/design.md`
   * §4). Uses `sharp` when the home has it, or falls back to the home's
   * picture-capable text model (marking every swatch `estimated: true`).
   */
  app.post(SWATCHES_ROUTE, { bodyLimit: 4096 }, async (req, reply) => {
    const body = req.body as Partial<SwatchesRequest> | null;
    if (
      !body ||
      typeof body !== "object" ||
      typeof body.canvasId !== "string" ||
      !body.canvasId ||
      typeof body.itemId !== "string" ||
      !body.itemId
    ) {
      return reply.status(400).send({ error: "a swatches request names `canvasId` and `itemId`", code: IMAGE_BAD_REQUEST });
    }
    const { canvasId, itemId } = body;
    await door(req, canvasId);
    const home = homes?.for(canvasId) ?? null;
    if (home) return home.personalRequest("POST", SWATCHES_ROUTE, { canvasId, itemId });
    const snapshot = await engine.getSnapshot(canvasId);
    const item = snapshot.canvas.items[itemId];
    const version = item?.versions.find((v) => v.id === item.currentVersionId);
    if (!item || !version || !version.mimeType.startsWith("image/")) {
      return reply.status(400).send({ error: `${itemId} is not an image on this canvas`, code: IMAGE_BAD_REQUEST });
    }
    const stream = await store.openBlob(canvasId, version.blobHash);
    if (!stream) {
      return reply.status(404).send({ error: `the picture of ${itemId} is not at this home`, code: IMAGE_BAD_REQUEST });
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
    const bytes = Buffer.concat(chunks);
    const result = await extractMoodSwatches({
      bytes,
      mimeType: version.mimeType,
      loadSharpOption: options.image?.loadSharp,
      textModel,
      badgeId: req.badge!.badgeId,
      notTheOwners: () => notTheOwners(req, textKeysHome),
    });
    return reply.status(result.status).send(result.body);
  });
}
