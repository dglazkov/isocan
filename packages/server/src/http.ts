import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  Actor,
  BadgeSummary,
  BadgesResponse,
  CreateGrantRequest,
  DoorRequest,
  DoorResponse,
  FreeNameResponse,
  Grant,
  GrantResponse,
  GrantsResponse,
  KillBadgeResponse,
  JoinCanvasRequest,
  JoinCanvasResponse,
  MintPassRequest,
  MintPassResponse,
  Pass,
  PostOpRequest,
  Project,
  RedeemPassRequest,
  RedeemPassResponse,
  UndoRedoRequest,
} from "@isocan/core";
import {
  BADGE_RESTART_HINT,
  BADGES_ROUTE,
  cancelledSince,
  COMMAND_NAME,
  decodeFilename,
  DOOR_ROUTE,
  FILENAME_HEADER,
  FREE_NAME_ROUTE,
  grantSubjectRefusal,
  HOME_JOIN_ROUTE,
  isLive,
  newId,
  normalizeSubject,
  NOT_YOUR_BADGE,
  OplogFencedError,
  OpValidationError,
  parseCommandFile,
  PASS_REDEEM_ROUTE,
  PROJECTS_REACH_PARAM,
  SHELF,
  UNKNOWN_ROUTE,
} from "@isocan/core";
import { Engine, NothingToUndoError, ProjectNotFoundError } from "./engine.ts";
import { attesterRefusal } from "./attest.ts";
import { admittingGrant, NotAdmittedError } from "./grants.ts";
import { killAndSweep, sweepCanvas } from "./sweep.ts";
import { mintPass, PassRefusedError, redeemPass } from "./passes.ts";
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
 * the cookie; closing it is a bootstrap paradox.
 *
 * **The blob GET used to be here, and phase 9 closed it** — see `isOpen`.
 *
 * Everything else under `/api/*` and the `/ws` upgrade is refused, by one
 * hook with one allowlist, so a route added later is refused by DEFAULT
 * rather than by somebody remembering. */

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

/**
 * How a blob may be cached — and **`private` is phase 9's, not decoration.**
 *
 * A blob's bytes are immutable by construction (the URL is their hash), so a
 * year is the honest freshness. What changed is who may hold the copy. The
 * route now requires a badge and an admission, and the hosted home sits behind
 * a Cloud CDN backend running `--cache-mode=USE_ORIGIN_HEADERS`
 * (`infra/80-load-balancer.sh`) — which means *this header* is what decides
 * whether the edge keeps a copy. A shared cache holding a credentialed
 * response would hand a swept badge exactly the bytes it was just expelled
 * from, and it would do it without the request ever reaching the door: a
 * closed route with an open back gate.
 *
 * `private` keeps the browser cache, which is the one that matters for a
 * canvas full of images being panned around, and gives up the edge copy. That
 * is the cost of closing the route, paid in bandwidth rather than in
 * correctness, and it is the right way round.
 */
const CACHE_BLOB = "private, immutable, max-age=31536000";

/** Every route that is ABOUT one canvas, by its shape rather than by a list —
 * so `projectId ∈ admissions` is re-asked on all of them, including the ones
 * a later phase adds. `/api/ops` is deliberately not here: its canvas is in
 * the body, and it says so itself. */
const PROJECT_ROUTE = /^\/api\/projects\/([^/?]+)/;

/**
 * **The blob route is closed, and the argument that kept it open was wrong —
 * measured in Chrome, 2026-08-23.**
 *
 * Phases 2 and 3 left `GET /api/projects/:id/blobs/:hash` open to badge-less
 * callers, and the comment here argued why it had to be: `ItemView` renders an
 * HTML blob in an iframe with `sandbox="allow-scripts"` and no
 * `allow-same-origin`, which gives the document an opaque origin and a null
 * site-for-cookies, so "nothing it then requests carries a `SameSite` cookie
 * at all". `phases.md` recorded the consequence as the limit of revocation: a
 * sweep that expels somebody does not expel the hashes they wrote down.
 *
 * Every clause of that is true and the conclusion did not follow. The
 * measurement, against a server that logged the request headers a real Chrome
 * actually sent for each of the sub-requests the canvas makes:
 *
 * | request | `Sec-Fetch-Site` | badge cookie |
 * | --- | --- | --- |
 * | the sandboxed iframe's own load | `same-origin` | **SENT** |
 * | `<img>` / `<video>` from the page | `same-origin` | **SENT** |
 * | `fetch` from the app (markdown, uri-list) | `same-origin` | **SENT** |
 * | `pic.png` from INSIDE the sandboxed blob | `cross-site` | absent |
 *
 * The opaque origin governs what the loaded document may do AFTERWARDS. The
 * request that loads the iframe is issued by the PARENT page, same-site, on a
 * `Lax` cookie that is sent because it is not a cross-site request at all.
 * The old comment described row four and generalised it to row one.
 *
 * And row four is moot anyway, which was the second half of the hypothesis and
 * is also measured: a relative `<img src="pic.png">` inside a blob resolves
 * against the blob's own URL, so the browser asks for
 * `/api/projects/:id/blobs/pic.png` — which is not a content hash, and
 * `store.blobMeta` has never had anything to answer with. The relative-asset
 * case this route was held open for has never worked and cannot: blobs are
 * addressed by hash, and a hash is not a directory.
 *
 * **So the decision `phases.md` demanded is made: closed.** Expulsion now
 * reaches the bytes. A badge that is swept out of a canvas cannot fetch that
 * canvas's blobs, because the route is project-scoped and the `onRequest` hook
 * re-asks `projectId ∈ admissions` on everything under `/api/projects/:id/`
 * — the hash stops being a capability the moment the holder stops being
 * admitted. The alternative on the table was a per-blob short-lived token in
 * the URL, and it buys nothing here: the cookie already rides, and a token in
 * a URL is a credential in a place people copy and paste.
 *
 * **What closing it costs, stated so nobody rediscovers it as a bug.** A blob
 * URL pasted into a browser with no badge for this canvas is now a 401 or a
 * 403 rather than the bytes. That is the point of the change and it is also
 * the only behaviour anybody could have been relying on. Every in-app path
 * carries the cookie (rows one to three above), and every CLI and daemon path
 * carries a bearer.
 *
 * See also the `Cache-Control` on the route itself, which had to become
 * `private` in the same change: a credentialed response cached at a shared
 * edge is a closed route with an open back gate.
 */
function isOpen(method: string, pathname: string): boolean {
  if ((HEALTH_ROUTES as readonly string[]).includes(pathname)) return true;
  if (!pathname.startsWith("/api/")) return true; // the web app and its assets
  if (method === "POST" && pathname === DOOR_ROUTE) return true;
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
    // 403, and its own code, because this caller's badge is FINE. A 401 would
    // send it back to the door for a fresh badge, which would be refused here
    // in exactly the same way — a refresh loop minting credentials that cannot
    // help. `not-admitted` is a different recovery: ask for the link.
    if (err instanceof NotAdmittedError) {
      return reply.status(403).send({ error: err.message, code: err.code });
    }
    // The pass said no, and each reason is its own status and its own code —
    // 404 unknown, 409 spent, 410 expired (see `PassRefusedError`). A single
    // collapsed refusal would send "you mistyped it", "you already used it"
    // and "it timed out" to the same unhelpful place, which is phase 7's
    // cheerful-wrong-address finding wearing its most personal face: the
    // caller here is a human who just pasted a command into a terminal.
    if (err instanceof PassRefusedError) {
      return reply.status(err.status).send({ error: err.message, code: err.code });
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
    // Fastify's OWN refusals, restored to the 4xx they already are.
    //
    // Fastify tags a caller's mistake with a `statusCode` and an `FST_ERR_*`
    // code and hands it to this handler; every branch above matches on our
    // error classes, so those tagged errors fell through to the 500 below and
    // were reported as our failure. The loudest instance: a `DELETE` that
    // declares `Content-Type: application/json` and sends no body. Fastify
    // will not parse an empty JSON body — `FST_ERR_CTP_EMPTY_JSON_BODY`, 400 —
    // and the caller was told `internal error`, which is a lie that gets
    // debugged from the wrong end.
    //
    // This is PRE-EXISTING, not a phase 7 regression: `DELETE /api/commands/:id`
    // and `DELETE /api/presence/actors/:id` have both done it since they were
    // written. It surfaces now because stage 1 adds the grant revoke, which
    // stage 2 calls from two surfaces — the Share dialog and the CLI verb —
    // and plenty of HTTP clients set a JSON content-type unconditionally on
    // every request, body or no body.
    //
    // The gate is the status code, not the message: 4xx means the error is
    // ABOUT the request, so its own message is safe to repeat and useful to
    // read. 5xx keeps falling through, because a server-side failure's message
    // is ours and stays ours.
    const tagged = err as { statusCode?: unknown; code?: unknown; message?: unknown };
    if (typeof tagged.statusCode === "number" && tagged.statusCode >= 400 && tagged.statusCode < 500) {
      return reply.status(tagged.statusCode).send({
        error: typeof tagged.message === "string" ? tagged.message : "bad request",
        ...(typeof tagged.code === "string" ? { code: tagged.code } : {}),
      });
    }
    app.log.error(err);
    return reply.status(500).send({ error: "internal error" });
  });

  /**
   * Nothing matched. **Under `/api/`, say so in JSON with a code** — phase
   * 7.5's open finding, closed (see `apiNotFound`).
   *
   * This handler is where an unmatched non-GET lands, and — on a daemon with
   * no built web app — an unmatched GET too, because `registerStaticWebApp`
   * registers nothing when `packages/web/dist` is absent. The two `GET /*`
   * handlers below shadow it for GETs when they ARE registered, so each of
   * them takes the same `/api/` branch: three call sites, one answer, because
   * a 404 that differs by which fallback caught it is a 404 nobody can reason
   * about.
   *
   * Non-`/api/` paths keep the plain 404 they always had, in this codebase's
   * `{error}` shape rather than Fastify's own — the SPA fallback for a person
   * loading a page is untouched, and this is what a `POST /nope` gets.
   */
  app.setNotFoundHandler((req, reply) => {
    const pathname = (req.url ?? "/").split("?")[0]!;
    if (pathname.startsWith("/api/")) return apiNotFound(reply, req.method, pathname);
    return reply.status(404).send({ error: `not found: ${req.method} ${pathname}` });
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
   * **The door, and the point of phase 7.** `projectId ∈ badge.admissions`,
   * re-asked on every project-scoped route (mechanism 5) — and, when the
   * answer is no, the design's flowchart run in order:
   *
   *   already admitted → creating the canvas (bootstrap) → a grant is
   *   satisfied → **refused**
   *
   * (The design's flowchart has a fourth branch, "it bears a valid pass".
   * Phase 8 built it as its own route rather than a branch here — see the
   * comment inside `admit` where a reader would look for it.)
   *
   * Phase 2 left this line saying "the address admits" and merely writing the
   * admission down; phase 3 marked it as the place the grant lookup goes. The
   * lookup is `admittingGrant`, and because every project-scoped route passes
   * through the one `onRequest` hook, replacing it here turns the check into
   * a refusal without a single route having to be found and edited.
   *
   * **Provenance is written correctly or phase 9 is broken.** `{root:
   * "grant", grantId}` for an ordinary admission, `{root: "created"}` for the
   * bootstrap. The sweep that expels a revoked grant's badges walks exactly
   * these roots, so an admission mis-rooted here is one no revocation can
   * ever find.
   *
   * **A canvas that is not here is a 404, not a 403.** The refusal is for
   * canvases that exist and will not have you; anything else would turn every
   * mistyped id in the suite — and in the wild — into a "you are not admitted"
   * about a canvas that was never there. It does mean an unadmitted caller
   * can tell "exists" from "does not exist", which is a real disclosure and a
   * small one: ids are 10 characters of nanoid, and the whole premise of the
   * link grant is that knowing the id is what gets you in.
   */
  const admit = async (req: FastifyRequest, canvasId: string, bootstrap = false) => {
    // Nothing to admit. It used to mean "an open route (the blob GET)"; phase
    // 9 closed that one, so the only callers left here already hold a badge
    // and this is the belt on `/api/ops`, whose canvas is in its body.
    if (!req.badge) return;
    if (req.badge.admissions.some((a) => a.canvasId === canvasId)) return;

    // The bootstrap: this badge is creating the canvas, and it is the only
    // provenance that is not "somebody let me in". Nothing to consult — there
    // are no grants on a canvas one line old.
    let provenance: Provenance | null = bootstrap ? { root: "created" } : null;

    /**
     * **Phase 8's branch is real now, and it deliberately does not live here.**
     *
     * The design's flowchart puts "it bears a valid pass" between the
     * bootstrap and the grants, as a third thing the door tests on an ordinary
     * request. It is not one, because a pass is not a credential a caller
     * carries around: it is redeemed ONCE, at `POST /api/passes/redeem`, which
     * spends the row and writes the admission itself — with `{root: "pass",
     * badgeId}` naming the minter, so phase 9's sweep can walk the chain. By
     * the time a pass-enrolled badge reaches this function it is already
     * admitted and answered by the first line above, exactly like every other
     * admitted badge.
     *
     * Testing a pass here instead would mean carrying the token on every
     * request (a single-use credential presented repeatedly is not single-use)
     * or looking one up per unadmitted arrival (a desk query for a row that is
     * almost never there). Redemption is a gesture with its own moment, and it
     * has its own route.
     */

    if (!provenance) {
      const grant = await admittingGrant(desk, canvasId, req.badge);
      if (grant) provenance = { root: "grant", grantId: grant.id };
    }

    if (!provenance) {
      // No canvas here at all — let the route answer 404 for itself. On a
      // replica this is also the ordinary shape of "not replicated yet".
      if (!(await store.projectExists(canvasId))) return;
      throw new NotAdmittedError(canvasId);
    }

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
    /**
     * The door, BEFORE the write, and the order is the whole point.
     *
     * `/api/ops` is the one route that is about a canvas without saying so in
     * its path (`PROJECT_ROUTE` deliberately does not match it — "its canvas
     * is in the body, and it says so itself"), so the hook cannot cover it and
     * this call is the door for every op ever written. Under phase 2's policy
     * the admission was recorded AFTER the submit, which was harmless when it
     * could not refuse; a refusal that arrives after the op has landed is not
     * a refusal at all.
     */
    if (body.projectId) await admit(req, body.projectId);
    const entry = await engine.submit({
      ...(body as PostOpRequest & { actor: Actor }),
      badgeId: req.badge!.badgeId,
    });
    if (body.op?.type === "project.create") {
      // The bootstrap badge's first admission, and it can only be taken after
      // the fact: the canvas did not exist to be admitted to a moment ago. It
      // earned this one by making the canvas, which is the only provenance
      // that is not "somebody let me in".
      await admit(req, body.op.projectId, true);
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

  /**
   * "Hand me a name that is free HERE" — asked by a REPLICA, on behalf of a
   * claimant who supplied none.
   *
   * A replica cannot answer this one for itself: names are judged in the
   * presenting badge's scope, and a fresh replica's badge has no admissions,
   * so every roster name looks free to it right up until the home refuses the
   * announcement. Allocation is the only part of a claim that crosses the wire
   * — `Engine.preferredName` says why, and why a claim itself still does not.
   *
   * Badge-scoped like everything on this desk, and it hands back ONE name
   * rather than the names in use. A route that answered "who is taken here"
   * would be the home listing its rosters to anyone who knocked, which is
   * exactly what `/api/actors/orphaned` is shaped to avoid.
   */
  app.get(FREE_NAME_ROUTE, async (req) => {
    return { name: await engine.freeName(req.badge!.badgeId) } satisfies FreeNameResponse;
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

  /**
   * The canvases this badge may see — phase 6's inherited debt, and phase 8
   * stage 4 paying the rest of it.
   *
   * Phase 6 found this route home-wide and named the consequence: "the moment
   * a home has two members a replica pulls down canvases it was never
   * admitted to", because `HomeLink.sweep` polls exactly this list and dials
   * everything in it. Phase 7 narrowed it to the DOOR'S OWN TEST, asked per
   * canvas — a badge sees what it is admitted to, plus what a grant would
   * admit it to — and recorded why it could not go further: a fresh replica's
   * badge has no admissions, so narrowing to admissions alone left it
   * discovering nothing at all. That was measured, not reasoned.
   *
   * **What changed:** the pass. Redeeming one writes an admission onto the
   * redeeming badge (`passes.ts`), so a replica can now be TOLD what it holds
   * instead of being SHOWN what exists. The narrowing that broke replicas in
   * phase 7 is the right answer for a replica in phase 8.
   *
   * **But it is still the wrong answer for a browser**, which is why this
   * route did not simply narrow. See {@link ProjectsReach}: two callers ask
   * two questions here, the caller states which, and the wide answer stays
   * the default so that a person opening `/` on their own home still sees the
   * canvas their CLI just made under a different badge. A route that guessed
   * from the carrier would be sniffing, which this codebase refuses.
   *
   * **What the narrow answer closes.** A replica asking `?reach=admitted`
   * mirrors what it was let into and nothing else: a canvas whose link grant
   * is merely ON no longer lands on a machine nobody handed it, which is the
   * last gap phase 7 left open and could not close. The wide answer still
   * lists a link-granted canvas to anyone, and that is not a bug in it — a
   * link grant says "anyone presenting the address may enter", so for a
   * person browsing their own home "the ones you may enter" IS the home.
   *
   * The cost of the wide answer is one grant query per canvas the badge has
   * not been in; the narrow answer costs none at all, because admissions are
   * on the badge record the request already resolved.
   */
  app.get("/api/projects", async (req) => {
    const badge = req.badge!;
    const query = req.query as Record<string, string | undefined>;
    // Anything other than the one narrowing word means the default. A typo
    // must not silently hand a replica the wide list under a name that reads
    // like the narrow one — it is spelled in exactly one place
    // (`projectsRoute`) so that a caller cannot arrive here with a near-miss.
    const narrow = query[PROJECTS_REACH_PARAM] === "admitted";
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const visible: Project[] = [];
    for (const project of await engine.listProjects()) {
      if (admitted.has(project.id)) visible.push(project);
      else if (!narrow && (await admittingGrant(desk, project.id, badge))) visible.push(project);
    }
    return visible;
  });

  app.get("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    return snapshot.project;
  });

  // ---- grants: who may enter this canvas (identity desk, mechanisms 3 + 2) ----
  //
  // Three routes, project-scoped, so the `onRequest` hook has already asked
  // the door about the caller before any of them runs: **only an admitted
  // badge can read or change a canvas's grants**, with nothing per-route to
  // remember. One endpoint for both surfaces — stage 2's Share dialog and the
  // CLI verb drive exactly these.
  //
  // What is deliberately NOT here is a notion of OWNERSHIP: any admitted badge
  // may share or un-share. The design leaves roles open ("whether grants may
  // carry roles waits for a scene that forces it"), and inventing an owner
  // here would invent it in the one place hardest to change later — the door.
  // On a solo home this is exactly today's posture; on a shared one it is the
  // familiar "anyone in the doc can share the doc", stated rather than
  // stumbled into.
  //
  // On a REPLICA all three forward to the home. A grant is desk state and does
  // not replicate, so the row that decides who may enter the canvas lives at
  // the home — and a verb that quietly edited the laptop's own copy would
  // report success while the link stayed on for everyone else.

  app.get("/api/projects/:id/grants", async (req) => {
    const { id } = req.params as { id: string };
    if (options.home) return options.home.grants(id);
    await engine.getSnapshot(id); // 404 for unknown canvases, like every route here
    return { grants: liveGrants(await desk.grantsFor(id)) } satisfies GrantsResponse;
  });

  /**
   * Share it. **Two refusals, and they are different questions on purpose.**
   *
   * `grantSubjectRefusal` (core) asks whether this is a grant subject at all —
   * a shape question, the same answer on every home. `attesterRefusal`
   * (`attest.ts`) asks whether THIS home can verify it: `email:` and `repo:`
   * are satisfied by attestations, an attestation needs a borrowed attester,
   * and a home that has borrowed none would be writing a row that admits
   * nobody while the dialog claimed somebody had been invited. Phase 7 refused
   * these subjects with the same argument and a different reason ("phase 9
   * owns attesters"); phase 9 owns them now, and what is left is a fact about
   * one home's configuration rather than about the vocabulary. A caller told
   * "not a subject" about a perfectly good address goes hunting for a typo
   * that is not there, which is why these did not stay one function.
   *
   * The subject is NORMALIZED before it is written, and that is load-bearing
   * rather than tidiness: the door satisfies these rows by string equality
   * against a badge's attestations, so `Jordan@Acme.Test` written raw is a row
   * that never matches the mailbox it names. One spelling, in core, both ends.
   *
   * Re-granting a subject that is already live hands back the row that is
   * already there rather than writing a second one. The gesture is a TOGGLE,
   * two people can flip it at once, and two live link grants on one canvas
   * would mean revoking the link left the link on.
   */
  app.post("/api/projects/:id/grants", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<CreateGrantRequest>;
    const refusal = grantSubjectRefusal(body.subject);
    if (refusal) return reply.status(400).send({ error: refusal, code: "bad-grant" });
    const subject = normalizeSubject(body.subject!);
    // A REPLICA forwards without asking its own opinion, and the order of
    // these two lines is that decision. Shape is universal and refused above;
    // "can anything here verify that" is a fact about the home that OWNS the
    // grant, and a laptop that answered it locally would be a second copy of a
    // policy that is about to change — refusing an invitation the home would
    // have accepted, on the strength of its own configuration. Same reason
    // `isocan share <email>` has no client-side "not yet".
    if (options.home) return options.home.createGrant(id, subject);
    const unverifiable = attesterRefusal(subject);
    if (unverifiable) {
      return reply.status(400).send({ error: unverifiable, code: "no-attester" });
    }
    await engine.getSnapshot(id);
    const live = liveGrants(await desk.grantsFor(id)).find((g) => g.subject === subject);
    if (live) return { grant: live } satisfies GrantResponse;
    const grant: Grant = {
      id: newId("gnt"),
      canvasId: id,
      subject,
      grantedBy: req.badge!.badgeId,
      at: new Date().toISOString(),
    };
    await desk.putGrant(grant);
    return { grant } satisfies GrantResponse;
  });

  /**
   * Un-share it — "turn off the link", and the same gesture for every other
   * subject. **Both halves, since phase 9.**
   *
   * Phase 7 shipped the first half and said in this comment where the second
   * would go: the row stops admitting NEW arrivals, and *"badges ALREADY
   * admitted under this grant keep their admissions until phase 9's provenance
   * sweep, which is not a shortcut — the sweep has to RE-RUN the door test per
   * badge and re-root the ones another grant still covers, or turning off the
   * link would expel the very people who were invited by name."*
   *
   * That is now `sweepCanvas`, called here and nowhere else on the revocation
   * path, and the ORDER is the whole of it: revoke first, sweep second. The
   * sweep asks the door about roots that no longer stand, so it has to run
   * against a desk where this row is already a tombstone — sweeping first
   * would find every root standing and expel nobody.
   *
   * **The report rides back on the response.** A gesture whose point is
   * expulsion has to be able to say who it expelled: "the link is off" and
   * "the link is off and four people just lost this canvas" are different
   * sentences, and both surfaces print the second one.
   *
   * On a REPLICA this forwards, sweep and all — the row that decides who may
   * enter lives at the home, so the expulsion does too, and what a laptop
   * gets back is the home's own count.
   */
  app.delete("/api/projects/:id/grants/:grantId", async (req, reply) => {
    const { id, grantId } = req.params as { id: string; grantId: string };
    if (options.home) return options.home.revokeGrant(id, grantId);
    await engine.getSnapshot(id);
    // Read through this canvas's own rows, so a grant id belonging to another
    // canvas cannot be revoked through a canvas the caller happens to be in.
    const mine = (await desk.grantsFor(id)).find((g) => g.id === grantId);
    if (!mine) {
      return reply.status(404).send({ error: `no grant ${grantId} on ${id}`, code: "unknown-grant" });
    }
    const revoked = await desk.revokeGrant(grantId, new Date().toISOString(), req.badge!.badgeId);
    const swept = await sweepCanvas(desk, id);
    return { grant: revoked ?? mine, swept } satisfies GrantResponse;
  });

  // ---- your own surfaces: kill-a-badge (identity desk, mechanism 1) ----
  //
  // The enforcement primitive the badge was always going to need: *"not yet
  // 'revoke Jordan', but 'end that holder's recognition' exists."* Phase 9
  // makes it exist, and makes it something a person and an agent can actually
  // perform — which needs a way to NAME a badge, so there are two routes and
  // not one.
  //
  // **Who may kill what, and why it is not "any admitted badge".** The grant
  // routes take the deliberately flat posture ("anyone in the doc can share
  // the doc"), and the same posture here would be a much bigger hammer: a
  // stranger admitted by a link could end the recognition of the person who
  // shared it, on every canvas at once, because a badge is not scoped to a
  // room. So the rule is narrower and needs no notion of ownership either:
  // **you may end a surface that shares an identity with you.** A badge
  // holding a claim on an actor this badge also claims IS one of your
  // surfaces — that is what a claim means — and it is exactly the
  // stolen-laptop case: Jordan, on her phone, ending the laptop that is her.
  // A stranger has no claim in common with anybody, so this is unreachable
  // for them by construction rather than by a check somebody has to remember.
  //
  // It composes with grant revocation rather than duplicating it, as the
  // design says. Killing does not un-invite: a killed holder that knocks
  // again gets a fresh badge and, under a live link grant, gets back in as a
  // STRANGER — with none of the claims, so it cannot speak as anybody. That
  // is the property that matters ("a badge bounds a compromise"), and
  // stopping the re-entry is the other gesture, on the grant.

  /**
   * Your surfaces. One query — every badge holding a claim on an actor this
   * badge claims — plus this badge itself, which is always in the list and
   * always marked, because the row a person most needs warning about is the
   * one that signs them out of the tab they are reading.
   *
   * A badge with no claims sees exactly itself, which is correct: it has no
   * identity in common with anything, so nothing else is one of its surfaces.
   */
  app.get(BADGES_ROUTE, async (req) => {
    if (options.home) return options.home.badges();
    return { badges: await mySurfaces(desk, engine, req.badge!) } satisfies BadgesResponse;
  });

  /**
   * End one. `killAndSweep`, because ending a holder unstands the root of
   * everybody that holder passed onto a canvas — see the argument there.
   *
   * The authorization is a membership test against the list above rather than
   * a second spelling of the rule, so "what you may kill" and "what you are
   * shown" cannot drift apart. Killing an already-dead badge is a 404 and not
   * an error: the caller wanted that holder gone and it is.
   */
  app.delete(`${BADGES_ROUTE}/:badgeId`, async (req, reply) => {
    const { badgeId } = req.params as { badgeId: string };
    if (options.home) return options.home.killBadge(badgeId);
    const mine = await mySurfaces(desk, engine, req.badge!);
    const target = mine.find((row) => row.badgeId === badgeId);
    if (!target) {
      return reply.status(403).send({
        error:
          `${badgeId} is not one of your surfaces — you can end a badge that shares an ` +
          "identity with yours, which is what makes this the stolen-laptop gesture and " +
          "not a way to expel other people",
        code: NOT_YOUR_BADGE,
      });
    }
    const outcome = await killAndSweep(desk, badgeId, req.badge!.badgeId);
    if (!outcome) {
      return reply
        .status(404)
        .send({ error: `${badgeId} is already ended`, code: "unknown-badge" });
    }
    return { killed: target, swept: outcome.swept } satisfies KillBadgeResponse;
  });

  // ---- passes: what an admitted badge hands an unadmitted one (Scene 5) ----
  //
  // Two routes with deliberately different shapes, and the asymmetry is the
  // design rather than an accident of naming.
  //
  // **Minting is project-scoped** (`/api/projects/:id/passes`), the same
  // argument the three grant routes are written on: the `onRequest` hook has
  // already asked the door about this caller for anything under
  // `/api/projects/:id/`, so "only an admitted badge may mint a pass for this
  // canvas" costs nothing per-route and cannot be forgotten by a later edit.
  // The canvas comes from the address, so a pass is about the room the asker
  // was standing in rather than one it named in a body.
  //
  // **Redeeming is not** (`/api/passes/redeem`), and it cannot be: the whole
  // point of the redeemer is that it is NOT admitted to that canvas yet, so a
  // project-scoped path would be refused by the door hook before the handler
  // could look at the pass — the door answering `not-admitted` to the one
  // request whose purpose is to become admitted.
  //
  // On a REPLICA both forward. A pass is desk state and desk state does not
  // replicate: the row lives at the home that minted it, single use is only
  // single across the desk that holds it, and a laptop that minted its own
  // passes would be handing out admissions to a canvas it does not own.

  /**
   * Mint one. The token comes back exactly once — there is no route that
   * reads a pass back out, and the desk keeps only its hash.
   *
   * `actorId` is optional and both shapes are real (see `Pass.actorId`): with
   * it the redeemer arrives being somebody, without it the redeemer arrives
   * admitted and claims its own actor. The claim a pass may name must be one
   * this badge HOLDS, checked by mechanism 5's own `requireActor` rather than
   * by a second spelling of the same rule — a pass hands over an identity its
   * minter already is, and endowing somebody else's is impersonation with a
   * wrapper on it.
   *
   * The design widens the mintable set by exactly one hop — a badge may also
   * endow an *agent's* actor that it SPONSORED into existence, which is how
   * Inna resumes Sonia after the sandbox that held Sonia's badge is gone. That
   * hop is deliberately NOT built here: sponsorship is a fact the desk would
   * have to record (the provenance parent of a badge), it exists to serve
   * standing registrations minting with nobody at the keyboard, and both of
   * those are the innkeeper's half of launch custody — mechanism 11, phase 9.
   * Half-building it here would mean inferring sponsorship from provenance at
   * exactly the moment nobody is watching.
   *
   * On a replica the check runs TWICE, which is mechanism 5's split working as
   * designed: this daemon verifies session-level (the local badge holds that
   * claim) because only it can, and the home verifies badge-level (its own
   * badge at the home holds it) because that is all it can honestly see.
   */
  app.post("/api/projects/:id/passes", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<MintPassRequest>;
    const actorId = typeof body.actorId === "string" && body.actorId ? body.actorId : undefined;
    if (actorId) await engine.requireActor(req.badge!.badgeId, actorId);
    if (options.home) {
      // The name rides up with the actor so the home can vouch for an actor it
      // has never heard of — `HomeLink.mintPass` claims before it asks, and
      // `reincarnate` refuses an unknown `as` with no name to go on.
      const names = actorId ? await engine.actorNames() : {};
      return options.home.mintPass(
        id,
        actorId ? { id: actorId, name: names[actorId] ?? "" } : undefined,
      );
    }
    await engine.getSnapshot(id); // 404 for unknown canvases, like every route here
    const { record, token } = mintPass({
      canvasId: id,
      mintedBy: req.badge!.badgeId,
      ...(actorId !== undefined ? { actorId } : {}),
    });
    await desk.putPass(record);
    return { pass: withoutSecret(record), token } satisfies MintPassResponse;
  });

  /**
   * Redeem one — **the presenting badge is the one that gets endowed.**
   *
   * This diverges from the desk design's diagram, which has the home minting a
   * third badge (`H-->>D: badge B₃`), and the divergence is argued at length
   * in `passes.ts` rather than taken quietly. The short of it: a browser
   * already holds a cookie badge before it can ask for anything, the door
   * deliberately never returns a cookie's secret in a body, and every client
   * here already knocks on the door when it is 401'd — so "mint a second
   * badge" would mean re-setting the one cookie and dropping its admissions.
   * The design's substance is preserved exactly: a badge that arrived knowing
   * nothing leaves knowing its person, and leaves admitted. Only who did the
   * minting moved.
   *
   * **On a replica, redemption forwards AND writes locally, and both halves
   * are necessary.** The forwarding is what spends the pass and endows this
   * daemon's badge AT THE HOME — which is what makes the canvas appear in that
   * badge's admissions, and therefore in `GET /api/projects`, and therefore in
   * the sweep that dials it: the pass is how a replica stops discovering
   * canvases by enumerating a home (phase 7's finding, and the question phase
   * 8 inherited). The local write is the claim row for the badge in front of
   * us, because the CLI on this machine speaks to THIS daemon and mechanism
   * 5's local half checks the local claims table — without it, Jordan's agent
   * would be admitted to a canvas at the home and be told `not-your-actor` by
   * her own laptop.
   *
   * What is deliberately NOT written locally is an admission. A replicated
   * canvas already gets a local link grant when it lands (`ensureHomeLinkGrant`
   * — "who on THIS machine may reach the local copy"), so the local door
   * admits this badge the first time it asks; writing a second, pass-rooted
   * local admission would put provenance in a ledger whose grants are a
   * different sentence, pointing at a badge id that means nothing on this
   * machine.
   */
  app.post(PASS_REDEEM_ROUTE, async (req) => {
    const body = (req.body ?? {}) as Partial<RedeemPassRequest>;
    // No special case for a missing token: `redeemPass` parses it, and an
    // empty string is not a pass in exactly the way a mangled one is not.
    const token = typeof body.token === "string" ? body.token : "";
    const badge = req.badge!;
    if (options.home) {
      const answer = await options.home.redeemPass(token);
      if (answer.actor) await engine.endowClaim(badge.badgeId, answer.actor, answer.canvasId);
      return answer;
    }
    const pass = await redeemPass(desk, token, badge);
    if (pass.actorId === undefined) {
      return { canvasId: pass.canvasId } satisfies RedeemPassResponse;
    }
    // The name as of NOW, not as of minting: a person who renamed herself
    // between copying the command and pasting it is handed the name she goes
    // by, which is also the name the canvas already shows on her work.
    const names = await engine.actorNames();
    const actor: Actor = { id: pass.actorId, name: names[pass.actorId] ?? "" };
    await engine.endowClaim(badge.badgeId, actor, pass.canvasId);
    return { canvasId: pass.canvasId, actor } satisfies RedeemPassResponse;
  });

  /**
   * **"Fetch me this canvas from my home."** The other half of narrowing the
   * replica's sweep to admissions — `HOME_JOIN_ROUTE` in core carries the
   * argument for why it exists at all, and `HomeLink.join` what it does.
   *
   * A REPLICA-only route, refused on a home rather than quietly succeeding: a
   * home has no home to fetch from, and answering 200 to "go get this from
   * upstream" when there is no upstream is the cheerful wrong answer this
   * codebase keeps meeting. The refusal is a 409 — the request is well formed
   * and the daemon is simply not that kind of daemon — with a code a caller
   * can branch on, because the CLI's binding resolution asks this
   * speculatively and must be able to tell "not a replica" (fine, carry on)
   * from "your home would not have you" (stop and say so).
   *
   * No local door test, on purpose. The canvas is by construction one this
   * machine does not hold, so there is nothing local to be admitted to; the
   * badge that gets tested is this DAEMON's badge at the home, by the home,
   * which is the only desk with an opinion worth having about it. What a local
   * caller can do with this route is ask its own machine to go and fetch a
   * canvas whose id it already knows — and knowing the id is exactly what the
   * link grant it will be tested against is about.
   */
  app.post(HOME_JOIN_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<JoinCanvasRequest>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) {
      return reply.status(400).send({ error: "projectId is required", code: "bad-request" });
    }
    if (!options.home) {
      return reply.status(409).send({
        error:
          "this daemon is a home, not a replica — there is nowhere to fetch a canvas from. " +
          "`isocan home <url>` points it at one.",
        code: "not-a-replica",
      });
    }
    return { project: await options.home.join(projectId) } satisfies JoinCanvasResponse;
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
   *
   * **Still home-wide, and it is the sibling of the leak `GET /api/projects`
   * just closed.** "Canvases it has never opened" is the feature — a parked
   * agent must hear a canvas it was summoned to — and at a multi-tenant home
   * that same sentence reads as "hears everybody's". Narrowing it is the same
   * per-canvas door test as the listing above; what stops it happening here
   * is that a parked `isocan wait` is exactly the caller whose badge has no
   * admissions yet, so the narrowing has to be designed WITH the wake-up
   * (phase 11's thin agent and phase 12's dispatch), not bolted on the poll.
   * Recorded here so the next person meets a decision rather than a surprise.
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
   * `MAX_DIRECT_UPLOAD_BYTES`). Under `/api/projects/:id/…`, so the door
   * re-asks `projectId ∈ admissions` before a single byte is signed for —
   * which since phase 9 is true of the blob GET beside it as well.
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
        .header("Cache-Control", CACHE_BLOB)
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
      .header("Cache-Control", CACHE_BLOB)
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

/**
 * **Your own surfaces** — every badge that shares an identity with this one,
 * with this one first.
 *
 * "A surface of yours" has a definition rather than a policy: a badge holding
 * a claim on an actor this badge also claims. That is what a claim IS — the
 * home vouching that this holder may speak as that actor — so two badges
 * holding one is the home already saying they are the same person's. Jordan's
 * phone and Jordan's laptop, Priya's daemon and Priya's tab.
 *
 * It is ONE query per actor this badge claims (`Desk.claimants`, an indexed
 * `array-contains` over `claimIds`) and one document read per surface found.
 * A badge claims a handful of actors and a person has a handful of surfaces,
 * so this is small — and it is small for a reason worth keeping: **there is no
 * shape of this call that lists the home.** Every badge it can return was
 * reached through an actor the caller already speaks as, which is the same
 * narrowing `orphanedClaims` is built on and for the same reason. A route that
 * could enumerate badges would be a roster of people to kill.
 *
 * The shelf is skipped: a shelved row belongs to no badge, so there is nothing
 * to name and nothing to end.
 *
 * Self is always included and always marked, even for a badge with no claims
 * at all — a person is entitled to end the surface they are sitting at, and
 * the marking is what stops them doing it by accident.
 */
async function mySurfaces(
  desk: Desk,
  engine: Engine,
  badge: BadgeRecord,
): Promise<BadgeSummary[]> {
  const found = new Map<string, BadgeRecord>([[badge.badgeId, badge]]);
  for (const actorId of new Set(badge.claims.map((claim) => claim.actorId))) {
    for (const holder of await desk.claimants(actorId)) {
      if (holder.badgeId === SHELF || found.has(holder.badgeId)) continue;
      const record = await desk.badge(holder.badgeId);
      if (record) found.set(record.badgeId, record);
    }
  }
  const names = await engine.actorNames();
  return [...found.values()]
    .map((record) => summarize(record, record.badgeId === badge.badgeId, names))
    // Self first, then most-recently-seen: the surface you are reading this
    // on, then the one you used yesterday, then the one you are trying to
    // remember owning — which is the order that puts a stolen laptop at the
    // bottom of the list, where somebody looking for it will look.
    .sort((a, b) => (a.self === b.self ? b.lastSeen.localeCompare(a.lastSeen) : a.self ? -1 : 1));
}

function summarize(
  record: BadgeRecord,
  self: boolean,
  names: Record<string, string>,
): BadgeSummary {
  return {
    badgeId: record.badgeId,
    kind: record.kind,
    createdAt: record.createdAt,
    lastSeen: record.lastSeen,
    self,
    // De-duplicated by actor: one badge can hold several rows for one actor
    // (a keyed claim and a handed-over one), and a person reading a list of
    // their own surfaces does not want to see themselves twice on one line.
    actors: [...new Map(record.claims.map((c) => [c.actorId, c])).values()].map((claim) => ({
      id: claim.actorId,
      name: names[claim.actorId] ?? "",
    })),
    canvases: record.admissions.length,
  };
}

/**
 * A pass as the wire may see it. The hash stays behind the desk seam — the
 * same split the badge has, and the reason is the same: what leaves this
 * process must never be enough to redeem anything.
 */
function withoutSecret(record: Pass & { secretHash: string }): Pass {
  const { secretHash: _hash, ...pass } = record;
  return pass;
}

/**
 * **There is no such route here** — a JSON 404 with a code, for anything
 * unmatched under `/api/`.
 *
 * Phase 7.5's open finding, closed. An unmatched `/api/` path fell through to
 * the SPA handler and answered 200 with the web app, which made a replica's
 * version negotiation with an older home correct BY ACCIDENT — it worked
 * because `res.json()` threw on HTML. Phase 8 is when that stops being
 * theoretical: a replica now asks its home to redeem a pass, and a home
 * deployed before this phase has no such route.
 *
 * Deliberately narrow. Only `/api/` answers this way; an unmatched path
 * anywhere else is still the SPA's, because the web app owns its own routing
 * and a client-side route is not a missing one.
 */
function apiNotFound(reply: FastifyReply, method: string, pathname: string): FastifyReply {
  return reply.status(404).send({
    error: `no route ${method} ${pathname} on this daemon — if you are a newer client, this home is older than the route you asked for`,
    code: UNKNOWN_ROUTE,
  });
}

/** The rows still admitting, oldest first — what a person means by "who can
 * get in". Tombstones stay on the desk for provenance and audit (see
 * `Grant.revokedAt`) and are nobody's answer to that question. */
function liveGrants(grants: Grant[]): Grant[] {
  return grants.filter(isLive).sort((a, b) => a.at.localeCompare(b.at));
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
    // An unmatched `/api/` path is a MISSING ROUTE, not a page. This one line
    // is phase 7.5's finding: without it the SPA fallback answers 200 and the
    // web app to `GET /api/actors/free-name`, and a replica negotiating with an
    // older home is correct only because parsing HTML as JSON throws.
    if (`/${url}`.startsWith("/api/")) return apiNotFound(reply, req.method, `/${url}`);
    const resolved = path.resolve(dist, url);
    if (resolved.startsWith(dist) && url && existsSync(resolved)) {
      return send(reply, resolved);
    }
    // The browser is badged on the PAGE LOAD, not on a round trip — the
    // desk's Scene 3 diagram is literal about it: `GET /p/7f3a… → web app +
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
    // The same `/api/` branch the page server takes. A replica answers API
    // calls for real — it is a daemon, not a signpost — so an unmatched one
    // here is a missing route, and telling a CLI "this canvas lives at
    // https://…" when it asked for a route that does not exist would be the
    // cheerful wrong address again, in HTML this time.
    const pathname = (req.url ?? "/").split("?")[0]!;
    if (pathname.startsWith("/api/")) return apiNotFound(reply, req.method, pathname);
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
