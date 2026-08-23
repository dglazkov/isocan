import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Actor, DoorRequest, DoorResponse, PostOpRequest, UndoRedoRequest } from "@isocan/core";
import {
  BADGE_RESTART_HINT,
  cancelledSince,
  COMMAND_NAME,
  decodeFilename,
  DOOR_ROUTE,
  FILENAME_HEADER,
  OplogFencedError,
  OpValidationError,
  parseCommandFile,
} from "@isocan/core";
import { Engine, NothingToUndoError, ProjectNotFoundError } from "./engine.ts";
import type { BlobUploadRequest, Store } from "./store.ts";
import type { BadgeRecord, Desk, Provenance } from "./desk.ts";
import {
  badgeCookie,
  isSecureRequest,
  mintBadge,
  originAllowed,
  presentedBadge,
  resolveBadge,
} from "./badges.ts";
import { PresenceHub, SESSION_TTL_MS } from "./presence.ts";
import { buildStamp } from "./build.ts";
import { HomeRefusedError, HomeUnreachableError, type HomeConnection } from "./home-link.ts";

declare module "fastify" {
  interface FastifyRequest {
    /** The badge this request presented, resolved once by the door hook. */
    badge: BadgeRecord | null;
  }
}

const STARTED_AT = new Date().toISOString();

/** Routes that answer without a badge, and why each one cannot close.
 *
 * The health routes are the load balancer's probe and, internally, what
 * `daemonPidOn`, `ensureDaemon`'s startup poll, `warnIfStale` and
 * `stopDaemons` all call — before any badge could exist. The door obviously
 * cannot ask for what it hands out. The static web app is the page that SETS
 * the cookie; closing it is a bootstrap paradox. And the blob GET is the one
 * named hole — see `blobRoute` below.
 *
 * Everything else under `/api/*` and the `/ws` upgrade is refused, by one
 * hook with one allowlist, so a route added later is refused by DEFAULT
 * rather than by somebody remembering. */
const BLOB_ROUTE = /^\/api\/projects\/[^/]+\/blobs\/[^/?]+(\?|$)/;

/** TWO paths, one answer.
 *
 * `/healthz` is what every local caller uses and it is not going anywhere.
 * But a hosted home does not get to answer it: Google's frontend swallows
 * that exact path and returns its own branded 404 — measured on the dev home,
 * where `/`, `/healthz/` and `/HEALTHZ` all reach the container and `/healthz`
 * never appears in the request log at all. So the hosted probe needs a path
 * Google will forward.
 *
 * `/api/healthz` is that path, and it is under `/api/` on purpose: that is the
 * one prefix the SPA fallback does not answer with a cheerful 200 page to an
 * unbadged caller. If this handler ever disappears, a monitoring check on
 * `/api/healthz` gets a 401 and goes red; a check on some bare `/health` would
 * get `index.html`, 200, forever — a check that cannot fail is exactly the
 * defect this route exists to avoid.
 *
 * Both answer the same body from the same handler, `buildStamp()` and all, so
 * there is no second thing to keep in sync. */
const HEALTH_ROUTES = ["/healthz", "/api/healthz"] as const;

/** Every route that is ABOUT one canvas, by its shape rather than by a list —
 * so `projectId ∈ admissions` is re-asked on all of them, including the ones
 * a later phase adds. `/api/ops` is deliberately not here: its canvas is in
 * the body, and it says so itself. */
const PROJECT_ROUTE = /^\/api\/projects\/([^/?]+)/;

function isOpen(method: string, pathname: string): boolean {
  if ((HEALTH_ROUTES as readonly string[]).includes(pathname)) return true;
  if (!pathname.startsWith("/api/")) return true; // the web app and its assets
  if (method === "POST" && pathname === DOOR_ROUTE) return true;
  /**
   * The sandboxed HTML blob, deliberately. `ItemView` renders a blob in an
   * iframe with `sandbox="allow-scripts"` and no `allow-same-origin`, which
   * gives that document an OPAQUE ORIGIN — and a document with an opaque
   * origin has a null site-for-cookies, so nothing it then requests (a
   * relative `<img>`, a stylesheet, a `fetch`) carries a `SameSite` cookie at
   * all. The security comment in `ItemView.tsx` says this out loud as a
   * feature, and it is right; it just means an HTML blob with relative asset
   * references breaks the moment this route wants a badge.
   *
   * So it stays open, in writing. It is open today, so this changes nothing,
   * and the phase's outcome is recognition rather than policy. The honest
   * long-term answer is that a blob hash IS a capability — 256 bits of
   * content address, unguessable, already how the route is reasoned about —
   * and PHASE 3, which re-asks `projectId ∈ admissions` per route, is the
   * phase that decides whether that is capability enough or whether HTML
   * blobs get a per-blob token in the URL.
   */
  if (method === "GET" && BLOB_ROUTE.test(pathname)) return true;
  return false;
}

export interface RouteOptions {
  /** The home this daemon replicates, or null when it is a home itself. The
   * only thing it decides here is whether pages are served at all — see
   * `registerStaticWebApp` and `registerHomeElsewhere` — plus saying so on the
   * health route, which is how a CLI learns there are no pages here. */
  homeUrl?: string | null;
  /** The live connection to that home. Routes need it for exactly one thing:
   * bytes this replica has never held (see the blob GET). Writes reach it
   * through the engine, never from here. */
  home?: HomeConnection | null;
}

export function registerRoutes(
  app: FastifyInstance,
  engine: Engine,
  store: Store,
  desk: Desk,
  presence: PresenceHub,
  options: RouteOptions = {},
): void {
  // Raw bodies for blob uploads; JSON stays JSON.
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => done(null, body));

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof OpValidationError) {
      return reply.status(400).send({ error: err.message, code: err.code });
    }
    if (err instanceof ProjectNotFoundError) {
      return reply.status(404).send({ error: err.message, code: "unknown-project" });
    }
    // 409, and its own code, because a client must NOT retry this: the op was
    // refused by another writer's claim on the seq, and the daemon has
    // already dropped that canvas's runtime. The next request re-loads and
    // numbers itself correctly; a blind retry with the same belief just
    // refuses again.
    if (err instanceof OplogFencedError) {
      app.log.error(err);
      return reply.status(409).send({ error: err.message, code: err.code });
    }
    if (err instanceof NothingToUndoError) {
      return reply.status(409).send({ error: err.message, code: "nothing-to-undo" });
    }
    // A replica is a PASS-THROUGH for a refusal, not a re-interpreter: the
    // home's status and the home's code, verbatim, so a `writer-fenced` 409
    // still says "do not retry" by the time it reaches the CLI. Flattening it
    // to a 500 would turn the one refusal a client must never retry into one
    // that looks worth retrying.
    if (err instanceof HomeRefusedError) {
      return reply
        .status(err.status)
        .send({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    }
    // The home is not there, and the write did NOT happen. 503 because it is
    // the truth and it is retryable BY A PERSON — nothing here retries it,
    // because a queue with no durability and no ordering story is the half-
    // built machinery phases 10 and 13 exist to do properly.
    if (err instanceof HomeUnreachableError) {
      return reply.status(503).send({ error: err.message, code: err.code });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "internal error" });
  });

  // The stamp is what lets a CLI notice it is talking to yesterday's daemon.
  // One handler, registered at both health paths — see HEALTH_ROUTES.
  const health = async () => ({
    ok: true,
    pid: process.pid,
    startedAt: STARTED_AT,
    // Which of the two things this daemon is, on the one call every client
    // already makes. A replica serves no pages, so `isocan open` and `isocan
    // setup` have to send a person somewhere else — and the marker a new
    // canvas gets has to carry the address (offline-birth's "birth writes a
    // promise"). Both need to find it out without a second route.
    ...(options.homeUrl ? { home: options.homeUrl } : {}),
    ...buildStamp(),
  });
  for (const route of HEALTH_ROUTES) app.get(route, health);

  // ---- the door (identity desk, mechanism 1) ----

  app.decorateRequest("badge", null);

  /**
   * One hook, run before every route: resolve the carrier, judge the Origin,
   * refuse the badge-less. Policy is untouched — the address still admits,
   * and getting a badge is free — so what this changes is RECOGNITION: from
   * here on trust attaches to the badge and never to the address again.
   */
  app.addHook("onRequest", async (req, reply) => {
    const pathname = (req.url ?? "/").split("?")[0]!;
    const presented = presentedBadge(req.headers);
    req.badge = await resolveBadge(desk, presented);

    // The Origin check, as the belt to SameSite's braces. Cookie-carried and
    // badge-less requests are judged; a bearer is exempt, because an
    // attacker's page cannot read a bearer token and so has nothing to ride.
    if (pathname.startsWith("/api/") && presented?.carrier !== "bearer") {
      const secure = isSecureRequest(req.headers, Boolean((req.raw.socket as { encrypted?: boolean }).encrypted));
      const allowed = originAllowed(
        Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin,
        { host: req.headers.host, secure },
        { loopback: loopbackBound(app) },
      );
      if (!allowed) {
        return reply.status(403).send({ error: "origin not allowed here", code: "bad-origin" });
      }
    }

    if (req.badge) {
      await desk.touch(req.badge.badgeId, new Date().toISOString());
      // The door's test, re-asked. One hook rather than a call in each
      // handler, for the same reason the badge check is one hook: a
      // project-scoped route added later is covered by DEFAULT instead of by
      // somebody remembering.
      const scoped = PROJECT_ROUTE.exec(pathname)?.[1];
      if (scoped) await admit(req, decodeSegment(scoped));
      return;
    }
    if (isOpen(req.method, pathname)) return;
    return presented
      ? reply
          .status(401)
          .send({ error: `this home does not know that badge — ask the door for a new one (POST ${DOOR_ROUTE})`, code: "bad-badge" })
      : reply
          .status(401)
          .send({ error: `a badge is required — ask the door for one (POST ${DOOR_ROUTE}); ${BADGE_RESTART_HINT}`, code: "no-badge" });
  });

  /**
   * Mint a badge. `carrier` is STATED, never sniffed: `Origin` presence and
   * `Sec-Fetch-Mode` are guessable and wrong at the edges, and one field in a
   * body is honest and costs nothing.
   *
   * The door mints only for the badge-less. A caller that already holds a
   * valid badge is told its own id and handed no new secret, so a refresh
   * storm or a retry loop cannot mint a badge per request.
   */
  app.post(DOOR_ROUTE, async (req, reply) => {
    if (req.badge) return { badgeId: req.badge.badgeId } satisfies DoorResponse;
    const carrier = ((req.body ?? {}) as DoorRequest).carrier ?? "bearer";
    const { record, token } = mintBadge(carrier === "cookie" ? "cookie" : "bearer");
    await desk.put(record);
    if (carrier === "cookie") {
      // The secret is NEVER in the body for the cookie carrier: the whole
      // value of HttpOnly is that page JavaScript cannot read the credential,
      // and returning it in JSON hands it straight back.
      const secure = isSecureRequest(req.headers, Boolean((req.raw.socket as { encrypted?: boolean }).encrypted));
      reply.header("Set-Cookie", badgeCookie(token, secure));
      return { badgeId: record.badgeId } satisfies DoorResponse;
    }
    return { badgeId: record.badgeId, secret: token.slice(record.badgeId.length + 1) } satisfies DoorResponse;
  });

  /**
   * `projectId ∈ badge.admissions`, re-asked on every project-scoped route —
   * the door's test, taken cheaply on each request rather than only at entry
   * (mechanism 5).
   *
   * Today it always passes, and saying so plainly is more useful than hiding
   * it: the door's POLICY is that the address admits, so a badge that is not
   * yet admitted here is admitted NOW and the admission is written down.
   * Phase 7 replaces the one marked line with the canvas's link grant, and
   * this becomes a refusal without another route having to be found and
   * edited.
   *
   * The payoff is already real, though, and it is mechanism 10's: because
   * every project-scoped route passes through here, a badge's admissions are
   * an accurate record of where it has been — which is exactly the scope the
   * narrowed name check and the narrowed color broadcast are judged against.
   */
  const admit = async (req: FastifyRequest, canvasId: string, provenance: Provenance = { root: "link" }) => {
    if (!req.badge) return; // an open route (the blob GET); nothing to admit
    if (req.badge.admissions.some((a) => a.canvasId === canvasId)) return;
    // ---- the policy point. Phase 7: consult the grant, and refuse. ----
    await desk.admit(req.badge.badgeId, canvasId, provenance);
    req.badge.admissions = [
      ...req.badge.admissions,
      { canvasId, provenance, at: new Date().toISOString() },
    ];
  };

  app.post("/api/ops", async (req, reply) => {
    const body = req.body as PostOpRequest;
    if (body.op?.type === "actor.claim") {
      // A claim resolves who is speaking, so it is the one op that arrives
      // without an actor; the response envelope carries the answer. It is
      // also "add an actor to THIS badge's claims", which is why the badge
      // travels with it.
      const entry = await engine.claim({
        op: body.op,
        badgeId: req.badge!.badgeId,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
    }
    if (!body.actor) {
      return reply.status(400).send({ error: "actor is required", code: "bad-op" });
    }
    if (body.op?.type === "actor.setColor") {
      // Home-scoped like a claim: the registry, not a canvas, is what changes.
      const entry = await engine.setActorColor({
        op: body.op,
        actor: body.actor,
        badgeId: req.badge!.badgeId,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
    }
    const entry = await engine.submit({
      ...(body as PostOpRequest & { actor: Actor }),
      badgeId: req.badge!.badgeId,
    });
    if (body.op?.type === "project.create") {
      // The bootstrap badge's first admission: it earned this one by making
      // the canvas, which is the only provenance that is not "somebody let
      // me in".
      await admit(req, body.op.projectId, { root: "created" });
    } else if (body.projectId) {
      await admit(req, body.projectId);
    }
    return { seq: entry.seq, envelope: entry.envelope };
  });

  // ---- the actor registry: who a session key speaks as (#57) ----

  /** Badge-scoped: a holder sees its own claims and nobody else's. */
  app.get("/api/actors", async (req) => {
    const { keys } = req.query as { keys?: string };
    return engine.actorBindings(req.badge!.badgeId, keys ? keys.split(",").filter(Boolean) : null);
  });

  /**
   * The recovery question, asked only about session keys the caller already
   * holds: is this key claimed on a badge that is not mine? A client whose
   * badge was lost or wiped is otherwise told it has no identity, while its
   * actor sits on an orphaned badge — true, useless, and pointing at `--name`,
   * which would mint a stranger. Answering does not adopt anything; coming
   * back is `--as`, and it stays deliberate.
   */
  app.get("/api/actors/orphaned", async (req) => {
    const { keys } = req.query as { keys?: string };
    return engine.orphanedClaims(
      req.badge!.badgeId,
      keys ? keys.split(",").filter(Boolean) : [],
    );
  });

  /** Chosen identity colors, for clients painting faces before a canvas is
   * open (the projects page) — everything absent is derived from the id. */
  app.get("/api/colors", async () => engine.actorColors());

  /** Current names, for clients rendering words somebody wrote under a name
   * they no longer use — the projects page paints them too. */
  app.get("/api/names", async () => engine.actorNames());

  // ---- slash commands: the work a message can ask for ----

  /** Every command available here — built-ins under this home's own. */
  app.get("/api/commands", async () => engine.commands());

  /** Write one. The body IS the file, so what you PUT is what a text editor
   * would have written, and `isocan command show` hands it straight back. */
  app.put("/api/commands/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    const text = typeof req.body === "string" ? req.body : String((req.body as { text?: string })?.text ?? "");
    if (!COMMAND_NAME.test(name)) {
      return reply.code(400).send({ error: `not a command name: ${name}` });
    }
    if (!parseCommandFile(name, text)) {
      return reply.code(400).send({ error: "a command needs instructions in its body" });
    }
    await engine.saveCommand(name, text);
    return reply.code(204).send();
  });

  /** Remove one. Removing a shadow gives the built-in back. */
  app.delete("/api/commands/:name", async (req, reply) => {
    const { name } = req.params as { name: string };
    if (!COMMAND_NAME.test(name)) {
      return reply.code(400).send({ error: `not a command name: ${name}` });
    }
    const removed = await engine.deleteCommand(name);
    if (!removed) return reply.code(404).send({ error: `no command of this home is called ${name}` });
    return reply.code(204).send();
  });

  app.get("/api/projects", async () => engine.listProjects());

  app.get("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    return snapshot.project;
  });

  app.get("/api/projects/:id/canvas", async (req) => {
    const { id } = req.params as { id: string };
    // No `admit` here any more: the hook took the door's test on the way in,
    // for this route and every other one shaped like it.
    return engine.getSnapshot(id);
  });

  app.get("/api/projects/:id/oplog", async (req) => {
    const { id } = req.params as { id: string };
    const { since, waitMs } = req.query as { since?: string; waitMs?: string };
    const sinceSeq = since ? Number(since) : 0;
    let entries = await engine.getLog(id, sinceSeq);

    // Long-poll: hold the request until an entry lands past `since` (or the
    // window closes). The seq cursor makes this restart-safe — the waiter is
    // resolved by the engine's op event, and a client abort cleans it up.
    const holdMs = Math.min(Number(waitMs) || 0, 55_000);
    if (entries.length === 0 && holdMs > 0) {
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          unsubscribe();
          req.raw.off("close", done);
          resolve();
        };
        const timer = setTimeout(done, holdMs);
        const unsubscribe = engine.onEvent((projectId, message) => {
          if (projectId === id && message.type === "op-applied") done();
        });
        req.raw.on("close", done);
      });
      entries = await engine.getLog(id, sinceSeq);
    }
    return entries;
  });

  /**
   * The whole home's oplog, one cursor per project — what `isocan wait`
   * listens on. An on-call agent hears canvases it has never opened, so the
   * long poll must be woken by ANY project's op, and a project born while it
   * waits is streamed from its first entry.
   */
  app.post("/api/oplog/watch", async (req) => {
    const body = (req.body ?? {}) as import("@isocan/core").WatchLogRequest;
    const { cursors } = body;
    const only = body.only ? new Set(body.only) : null;

    const collect = async (): Promise<import("@isocan/core").WatchLogResponse> => {
      const entries: import("@isocan/core").WatchedLogEntry[] = [];
      const next: Record<string, number> = {};
      for (const project of await engine.listProjects()) {
        if (only && !only.has(project.id)) continue;
        const since = cursors?.[project.id] ?? 0;
        // Seeding (no cursors at all) means "from now on" — tips, no entries.
        const log = cursors ? await engine.getLog(project.id, since) : [];
        const lastSeq = cursors
          ? (log[log.length - 1]?.seq ?? since)
          : (await engine.getSnapshot(project.id)).lastSeq;
        for (const entry of log) {
          entries.push({ ...entry, projectId: project.id, projectTitle: project.title });
        }
        next[project.id] = lastSeq;
      }
      entries.sort((a, b) => a.envelope.ts.localeCompare(b.envelope.ts) || a.seq - b.seq);
      return { entries, cursors: next };
    };

    // Subscribe BEFORE the first sweep: scanning every project takes long
    // enough that an op could land behind the reader and be missed until the
    // window closed. Sweeping many projects is not atomic; this is.
    let landed = false;
    let wake: (() => void) | null = null;
    const unsubscribe = engine.onEvent((projectId, message) => {
      if (message.type !== "op-applied") return;
      if (only && !only.has(projectId)) return; // another canvas is not our business
      landed = true;
      wake?.();
    });
    try {
      let result = await collect();
      const holdMs = Math.min(Number(body.waitMs) || 0, 55_000);
      if (result.entries.length === 0 && !landed && holdMs > 0) {
        await new Promise<void>((resolve) => {
          const done = () => {
            clearTimeout(timer);
            wake = null;
            req.raw.off("close", done);
            resolve();
          };
          const timer = setTimeout(done, holdMs);
          wake = done;
          req.raw.on("close", done);
        });
        result = await collect();
      }
      return result;
    } finally {
      unsubscribe();
    }
  });

  app.post("/api/projects/:id/undo", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as UndoRedoRequest;
    return engine.undo(id, body.actor, req.badge!.badgeId, body.clientId);
  });

  app.post("/api/projects/:id/redo", async (req) => {
    const { id } = req.params as { id: string };
    const body = req.body as UndoRedoRequest;
    return engine.redo(id, body.actor, req.badge!.badgeId, body.clientId);
  });

  // ---- presence sessions (ephemeral plane — no oplog, no storage) ----

  app.post("/api/projects/:id/sessions", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 unknown projects
    const body = req.body as import("@isocan/core").CreateSessionRequest;
    // A face is an assertion about who is here, so it is checked like an op.
    await engine.requireActor(req.badge!.badgeId, body.actor.id);
    const session = presence.createSession(id, body.actor, "cli", {
      ...(body.label !== undefined ? { label: body.label } : {}),
    });
    return { sessionId: session.sessionId, ttlMs: SESSION_TTL_MS };
  });

  app.put("/api/projects/:id/sessions/:sid", async (req, reply) => {
    const { id, sid } = req.params as { id: string; sid: string };
    const body = (req.body ?? {}) as import("@isocan/core").UpdateSessionRequest;
    // Every beat re-asserts who is holding the face (that is what makes a
    // rename re-label it live), so every beat is checked.
    if (body.actor) await engine.requireActor(req.badge!.badgeId, body.actor.id);
    if (!presence.touch(id, sid, body)) {
      return reply.status(404).send({ error: "session expired or unknown", code: "unknown-session" });
    }
    // Every command an agent runs beats on this endpoint, which makes it the
    // one place a cancellation can reach something MID-TURN. An agent is not
    // polling the canvas while it works — but it is running tools, and this is
    // what its tools already call.
    const on = presence.onThreadOf(id, sid);
    if (!on) return { ok: true };
    try {
      const { canvas } = await engine.getSnapshot(id);
      const thread = canvas.threads[on.threadId];
      const cancel = thread ? cancelledSince(thread, on.since) : null;
      if (!cancel) return { ok: true };
      return {
        ok: true,
        cancelled: {
          threadId: on.threadId,
          by: cancel.author.name,
          at: cancel.createdAt,
        },
      };
    } catch {
      return { ok: true }; // a canvas mid-delete cancels nothing
    }
  });

  app.delete("/api/projects/:id/sessions/:sid", async (req) => {
    const { id, sid } = req.params as { id: string; sid: string };
    // Taking a face DOWN names an actor too. A session that is already gone
    // names nobody, and ending it stays the no-op it has always been.
    const standing = presence.roster(id).find((session) => session.sessionId === sid);
    if (standing) await engine.requireActor(req.badge!.badgeId, standing.actor.id);
    presence.endSession(id, sid);
    return { ok: true };
  });

  app.get("/api/projects/:id/sessions", async (req) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    return presence.roster(id);
  });

  app.delete("/api/presence/actors/:actorId", async (req) => {
    const { actorId } = req.params as { actorId: string };
    const { kind } = req.query as { kind?: "web" | "cli" };
    // Ending an actor's sessions everywhere is as much an assertion about who
    // you are as putting a face up: without the check, one request would
    // silently blank anybody's face on any canvas.
    await engine.requireActor(req.badge!.badgeId, actorId);
    return { ended: presence.endActorSessions(actorId, kind) };
  });

  app.post("/api/projects/:id/gc", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as import("@isocan/core").GcRequest;
    return engine.gc(id, body);
  });

  app.post("/api/projects/:id/blobs", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 for unknown projects
    const data = req.body as Buffer;
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return reply.status(400).send({ error: "empty blob body", code: "bad-op" });
    }
    const mimeType = req.headers["content-type"] ?? "application/octet-stream";
    const filename = decodeFilename(req.headers[FILENAME_HEADER.toLowerCase()]);
    return engine.putBlob(id, data, { mimeType, filename });
  });

  /**
   * Ask for somewhere to put bytes too big to post (see
   * `MAX_DIRECT_UPLOAD_BYTES`). POST, so `isOpen`'s GET-only blob hole does
   * not cover it, and under `/api/projects/:id/…`, so the door re-asks
   * `projectId ∈ admissions` before a single byte is signed for.
   */
  app.post("/api/projects/:id/blobs/upload-url", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 for unknown projects
    const request = req.body as Partial<BlobUploadRequest> | undefined;
    const problem = badUploadRequest(request);
    if (problem) return reply.status(400).send({ error: problem, code: "bad-op" });
    const asked = request as BlobUploadRequest;

    // Already here? Then there is nothing to upload, and saying so is cheaper
    // for everyone than a round trip to a bucket that would dedup it anyway.
    const known = await store.blobMeta(id, asked.blobHash);
    if (known) {
      return { blob: { blobHash: asked.blobHash, mimeType: known.mimeType, size: known.size } };
    }
    const upload = await engine.beginUpload(id, asked);
    if (!upload) {
      return reply
        .status(409)
        .send({ error: "this home takes blob bytes directly — POST them", code: "bad-op" });
    }
    return { upload };
  });

  /** Name bytes that went straight to the object store. */
  app.post("/api/projects/:id/blobs/register", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const request = req.body as Partial<BlobUploadRequest> | undefined;
    const problem = badUploadRequest(request);
    if (problem) return reply.status(400).send({ error: problem, code: "bad-op" });
    return engine.registerBlob(id, request as BlobUploadRequest);
  });

  app.get("/api/projects/:id/blobs/:hash", async (req, reply) => {
    const { id, hash } = req.params as { id: string; hash: string };
    await engine.getSnapshot(id);
    const meta = await store.blobMeta(id, hash);
    /**
     * Bytes this replica has never held, read straight from the home.
     *
     * The ops replicate; the blobs they name do not follow on their own. So a
     * replica that applied somebody else's `item.add` knows the hash and has
     * nothing under it — and an item that renders as a broken version on the
     * one machine an agent's hands can reach is not a replica, it is a list of
     * hashes. The bytes are streamed through rather than mirrored to disk: a
     * read is not the moment to decide what this machine should keep, and
     * content addressing means the copy that arrives with the next upload is
     * the same copy either way.
     *
     * Range requests go up with the request, so seeking a video does not drag
     * the whole object across twice.
     */
    if (!meta && options.home) {
      const range = parseRange(req.headers.range, Number.MAX_SAFE_INTEGER);
      const remote = await options.home.openBlob(
        id,
        hash,
        range && range !== "unsatisfiable" ? range : undefined,
      );
      if (!remote) return reply.status(404).send({ error: "blob not found" });
      return reply
        .header("Content-Type", remote.mimeType)
        .header("Content-Security-Policy", "sandbox allow-scripts")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "immutable, max-age=31536000")
        .send(remote.stream);
    }
    if (!meta) return reply.status(404).send({ error: "blob not found" });

    // Defense in depth for HTML blobs: even outside the app's sandboxed
    // iframe, a directly-opened blob document is sandboxed and can't reach
    // the daemon API with an origin.
    reply
      .header("Content-Type", meta.mimeType)
      .header("Content-Security-Policy", "sandbox allow-scripts")
      .header("X-Content-Type-Options", "nosniff")
      .header("Cache-Control", "immutable, max-age=31536000")
      // Said unconditionally, so a player knows it may seek BEFORE it asks.
      .header("Accept-Ranges", "bytes");

    const range = parseRange(req.headers.range, meta.size);
    if (range === "unsatisfiable") {
      return reply.status(416).header("Content-Range", `bytes */${meta.size}`).send();
    }
    if (range) {
      const stream = await store.openBlob(id, hash, range);
      if (!stream) return reply.status(404).send({ error: "blob not found" });
      return reply
        .status(206)
        .header("Content-Range", `bytes ${range.start}-${range.end}/${meta.size}`)
        .header("Content-Length", String(range.end - range.start + 1))
        .send(stream);
    }
    const stream = await store.openBlob(id, hash);
    if (!stream) return reply.status(404).send({ error: "blob not found" });
    return reply.header("Content-Length", String(meta.size)).send(stream);
  });

  // The one-origin rule, in one branch. A daemon that knows a home is a
  // REPLICA: it serves ops to CLIs and never pages to persons, so the page
  // server — and, with it, the cookie badge the page server mints — does not
  // exist here at all. A daemon that knows no home is a home, which is every
  // daemon in this repo today and stays exactly as it was.
  if (options.homeUrl) registerHomeElsewhere(app, options.homeUrl);
  else registerStaticWebApp(app, desk);
}

/** What a direct-upload request must carry, or the reason it does not. All
 * four fields are load-bearing: the hash is the object's name, the mime type
 * and filename are signed into the URL, and the size is what the register
 * will be checked against. */
function badUploadRequest(request: Partial<BlobUploadRequest> | undefined): string | null {
  if (!request || typeof request !== "object") return "expected an upload request body";
  if (typeof request.blobHash !== "string" || !/^[0-9a-f]{64}$/.test(request.blobHash)) {
    return "blobHash must be a sha256 hex digest";
  }
  if (typeof request.mimeType !== "string" || request.mimeType === "") return "mimeType is required";
  if (typeof request.filename !== "string" || request.filename === "") return "filename is required";
  if (typeof request.size !== "number" || !Number.isInteger(request.size) || request.size <= 0) {
    return "size must be a positive integer";
  }
  return null;
}

/**
 * One HTTP byte range, or null for "the whole thing", or "unsatisfiable".
 *
 * Deliberately narrow: a single range, which is every range a browser's media
 * element or a `curl -C -` ever sends. A multipart range response is a
 * different content type and a different body format, and nothing that talks
 * to a canvas asks for one — so an `Accept-Ranges: bytes` promise this route
 * cannot keep is not made. Anything unparseable is IGNORED (RFC 9110 says a
 * bad Range must be treated as absent), which is why a garbled header gets
 * the whole blob rather than a 416.
 */
function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (typeof header !== "string") return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (rawStart === "") {
    // A suffix range: the LAST n bytes. `bytes=-0` asks for nothing.
    const wanted = Number(rawEnd);
    if (wanted === 0) return "unsatisfiable";
    return { start: Math.max(0, size - wanted), end: size - 1 };
  }
  const start = Number(rawStart);
  if (start >= size) return "unsatisfiable";
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return "unsatisfiable";
  return { start, end };
}

/** The canvas id out of a path segment. A malformed percent escape is not
 * worth a 500 from a hook: it is not a canvas id either way, and the route
 * behind it will say so. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Is this daemon listening only to its own machine? Mechanism 5's "within a
 * machine, localhost trust stands" needs to know, and the hosted home (bound
 * to 0.0.0.0) must not take the clause. */
function loopbackBound(app: FastifyInstance): boolean {
  const address = app.server.address();
  if (!address || typeof address === "string") return false;
  return address.address === "127.0.0.1" || address.address === "::1";
}

/** Serve packages/web/dist (if built) so `isocan open` works without Vite. */
function registerStaticWebApp(app: FastifyInstance, desk: Desk): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../../web/dist");
  if (!existsSync(path.join(dist, "index.html"))) return;

  const send = (reply: { header: Function; send: Function; type: Function }, file: string) => {
    const types: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript",
      ".css": "text/css",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
    };
    reply.type(types[path.extname(file)] ?? "application/octet-stream");
    return reply.send(createReadStream(file));
  };

  app.get("/*", async (req, reply) => {
    const url = (req.params as { "*": string })["*"] ?? "";
    const resolved = path.resolve(dist, url);
    if (resolved.startsWith(dist) && url && existsSync(resolved)) {
      return send(reply, resolved);
    }
    // The browser is badged on the PAGE LOAD, not on a round trip — the
    // desk's Scene 3 diagram is literal about it: `GET /c/7f3a… → web app +
    // Set-Cookie`. So the app is badged before its first fetch, and the
    // 401-and-recover path in `api.ts` is belt-and-braces rather than the
    // way in. The guard matters: this handler is the SPA fallback for any
    // unmatched GET, so minting unconditionally would mint a badge per
    // stray asset request.
    if (!req.badge) {
      const { record, token } = mintBadge("cookie");
      await desk.put(record);
      const secure = isSecureRequest(req.headers, Boolean((req.raw.socket as { encrypted?: boolean }).encrypted));
      reply.header("Set-Cookie", badgeCookie(token, secure));
    }
    return send(reply, path.join(dist, "index.html")); // SPA fallback
  });
}

/** The header a replica names its home in — a machine-readable copy of what
 * the body says, for a `curl` or a script that would rather not scrape prose.
 * Deliberately NOT `Location`, and deliberately not a 3xx: see below. */
export const HOME_HEADER = "X-Isocan-Home";

/**
 * What a replica answers a person with instead of the web app.
 *
 * This takes the place of `registerStaticWebApp` exactly — same `GET /*`
 * shape, same position as the last thing registered — so what a replica does
 * with an unmatched GET is *this* rather than whatever Fastify's default 404
 * happens to be. It replaces the page server's OTHER half too: the SPA
 * fallback is where a browser gets badged (`if (!req.badge) mintBadge`), and a
 * daemon that no longer serves pages must not go on minting cookie badges for
 * people it is not serving. That half is simply not here.
 *
 * **404, and no redirect.** The canvas genuinely is not at this address, so
 * 404 is the true status; and a `Location` would send a browser to the home
 * carrying a path this daemon invented, which is how a person ends up on a
 * home's 404 wondering what they did. The address is stated — in the body, and
 * in `X-Isocan-Home` — and the move is left to the person. Silence was the
 * other option and is the wrong one: an unexplained 404 from your own machine
 * reads as a broken daemon, and this codebase's instinct is that a failure may
 * not be silent.
 */
function registerHomeElsewhere(app: FastifyInstance, homeUrl: string): void {
  app.get("/*", async (req, reply) => {
    const accepts = String(req.headers.accept ?? "");
    reply.status(404).header(HOME_HEADER, homeUrl).header("Cache-Control", "no-store");
    // A person gets a page; a script gets a line. Not content negotiation for
    // its own sake — `curl` and an agent's `fetch` are the callers most likely
    // to reach a local daemon by accident, and a wall of markup is a worse
    // answer to them than one sentence.
    if (!accepts.includes("text/html")) {
      return reply
        .type("text/plain; charset=utf-8")
        .send(`this canvas lives at ${homeUrl} — open it there\n`);
    }
    const safe = escapeHtml(homeUrl);
    return reply.type("text/html; charset=utf-8").send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>This canvas lives elsewhere</title></head><body>` +
        `<h1>This canvas lives at <a href="${safe}">${safe}</a></h1>` +
        `<p>Open it there. This is a local isocan daemon: it serves ops to the ` +
        `<code>isocan</code> CLI and to agents on this machine, and never pages ` +
        `to people — everyone sits at the one origin.</p>` +
        `</body></html>\n`,
    );
  });
}

/** Enough escaping for a configured address dropped into markup. The value
 * comes from this machine's own environment or config file rather than from a
 * request, so this is belt to that braces — but a home address is the one
 * string here that a person types by hand. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
