import type { FastifyInstance, FastifyRequest } from "fastify";
import { atLeast, JUDGMENT_BAD_REQUEST, JUDGMENT_MAX_BYTES, JUDGMENT_RATE_LIMITED, JUDGMENT_ROUTE, JUDGMENT_TOO_LARGE, JUDGMENT_UNAVAILABLE, type JudgmentRequest } from "@isocan/core";
import { TEXT_BAD_REQUEST, TEXT_MAX_BYTES, TEXT_RATE_LIMITED, TEXT_ROUTE, TEXT_TOO_LARGE, TEXT_UNAVAILABLE, type TextRequest } from "@isocan/core/text";
import type { Engine } from "./engine.ts";
import { capabilityIn, type ViewOnlyError } from "./grants.ts";
import type { RouteOptions } from "./http.ts";
import { Judge } from "./judgment.ts";
import { RefusedError, TakenDownError, type Refusals } from "./takedowns.ts";
import { TextModel } from "./text.ts";

/**
 * **The two routes that spend the home's keys** — `POST /api/judgment` (the
 * judge, wireframes phase 5) and `POST /api/text` (the text model, copy-edit
 * phase 0.5). Moved out of `registerRoutes` together on 2 Oct 2026 when the
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
}

/** The judgment and text routes, on `app`, at the point `registerRoutes` reaches them. */
export function registerModelRoutes(app: FastifyInstance, scope: ModelRouteScope): void {
  const { engine, options, refusals, admit, viewOnly } = scope;
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
   * elsewhere — that home's own judgment, then the key and the badge's budget.
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
    if (home && !judge.available()) return home.personalRequest("POST", JUDGMENT_ROUTE, { canvasId, ...question });
    // No judgment for a canvas that is not here: the door's test admits by
    // badge, and a canvas nobody holds has no editors to spend on.
    if (!home) await engine.getSnapshot(canvasId);
    if (!judge.available()) {
      return reply.status(503).send({ error: "this home has no judge — nothing can be asked here (the innkeeper sets TYPESAFE_API_KEY)", code: JUDGMENT_UNAVAILABLE });
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
   * model, then the key and the badge's budget.
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
    if (home && !textModel.available()) return home.personalRequest("POST", TEXT_ROUTE, { canvasId, ...asked });
    // Nothing is written for a canvas that is not here.
    if (!home) await engine.getSnapshot(canvasId);
    if (!textModel.available()) {
      return reply.status(503).send({ error: "this home has no text model — words can't be written here (the innkeeper sets ISOCAN_TEXT_API_KEY)", code: TEXT_UNAVAILABLE });
    }
    if (!textModel.take(req.badge!.badgeId)) {
      return reply.status(429).send({ error: "this badge has asked for enough words this minute — wait a moment and ask again", code: TEXT_RATE_LIMITED });
    }
    const written = await textModel.write(asked);
    return reply.status(written.status).send(written.body);
  });
}
