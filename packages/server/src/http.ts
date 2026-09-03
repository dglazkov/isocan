import { createReadStream, existsSync, promises as fs } from "node:fs";
import os from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  Actor,
  AttestOffer,
  AttestRequest,
  AttestResponse,
  BadgeSummary,
  BadgesResponse,
  CreateGrantRequest,
  DoorRequest,
  DoorResponse,
  FreeNameResponse,
  Capability,
  Grant,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  KillBadgeResponse,
  JoinCanvasRequest,
  HomesResponse,
  JoinCanvasResponse,
  MintPassRequest,
  MintPassResponse,
  Pass,
  PostOpRequest,
  Canvas,
  RcAskRequest,
  RedeemPassRequest,
  RedeemPassResponse,
  Space,
  SpacesResponse,
  SpaceResponse,
  CreateSpaceRequest,
  SpaceCanvasRequest,
  SpaceCanvasResponse,
  SpaceLinkRequest,
  SpaceLinkResponse,
  Group,
  GroupResponse,
  GroupsResponse,
  CreateGroupRequest,
  GroupMemberRequest,
  UndoRedoRequest, LogEntry } from "@isocan/core";
import {
  ATTEST_ROUTE,
  AUTH_ACTION_PATH,
  authActionOutcome,
  BAD_SPACE,
  CANVAS_IN_SPACE,
  isSpaceLive,
  sameSpaceName,
  SPACE_NAME_TAKEN,
  SPACE_NOT_FOUND,
  spaceNameRefusal,
  SPACES_ROUTE,
  BAD_GROUP,
  claimsActor,
  GROUP_NAME_TAKEN,
  GROUP_NOT_FOUND,
  groupIdOf,
  groupMemberRefusal,
  groupNameRefusal,
  GROUPS_ROUTE,
  groupSubject,
  groupViewOf,
  isGroupLive,
  isSpaceGrant,
  normalizeAttribute,
  sameGroupName,
  BADGE_RESTART_HINT,
  BADGES_ROUTE,
  cancelledSince,
  COMMAND_NAME,
  decodeFilename,
  DOOR_ROUTE,
  FILENAME_HEADER,
  fileOf,
  FREE_NAME_ROUTE,
  actorNameIn,
  attestationSatisfying,
  barSubjectRefusal,
  capabilityOf,
  grantSubjectRefusal,
  CANVAS_PATH_PREFIX,
  HOME_GC_ROUTE,
  HOME_JOIN_ROUTE,
  HOMES_ROUTE,
  NEWS_ROUTE,
  news,
  type NewsResponse,
  PRESENCE_WHERE_ROUTE,
  type PresenceWhere,
  type PresenceWhereResponse,
  isBar,
  isLive,
  isOpId,
  newId,
  normalizeSubject,
  NO_ATTESTER,
  NO_RC_CODE,
  NOT_YOUR_BADGE,
  OplogFencedError,
  OpValidationError,
  PARK_ADOPTED_CODE,
  parseCommandFile,
  AMBIGUOUS_HOME,
  atLeast,
  isCapability,
  LINK,
  ownerOf,
  WITHDRAWN,
  narrowed,
  normalizeHomeUrl,
  PASS_REDEEM_ROUTE,
  RUNGS,
  SERVING_ROUTE,
  DOC_EXPORT_ROUTE,
  googleDocId,
  googleDocExportUrl,
  googleDocUrl,
  docTitleFrom,
  staleClientRefusal,
  STALE_CLIENT_STATUS,
  CANVASES_REACH_PARAM,
  SHELF,
  UNKNOWN_ROUTE,
  frameVerdict,
  normalizeSiteUrl,
  bindVerdict,
  takenSentence,
} from "@isocan/core";
import { Engine, NothingToUndoError, CanvasNotFoundError } from "./engine.ts";
import { isocanHome } from "./paths.ts";
import { boundDirs, hashBound, pickList, readBound, readTree, writeBound } from "./tree.ts";
import {
  attestersOf,
  attesterRefusal,
  BadIdTokenError,
  googleSigningKeys,
  verifyIdToken,
  type AuthConfig,
  type SigningKeys,
} from "./attest.ts";
import { gcCanvases } from "./gc.ts";
import {
  admittingGrant,
  capabilityIn,
  heldCapability,
  heldRung,
  heldRungOnSpace,
  NOT_OWNER,
  NotAdmittedError,
  notOwnerMessage,
  ViewOnlyError,
} from "./grants.ts";
import {
  clientAddress,
  MINT_PER_MINUTE,
  TokenBuckets,
  TOO_MANY_BADGES,
  type MintRefusal,
} from "./meter.ts";
import { killAndSweep, sweepCanvas, sweepCanvases, sweepSpace, SweepHub } from "./sweep.ts";
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
import { buildRoot, buildStamp } from "./build.ts";
import { HomeRefusedError, HomeUnreachableError } from "./home-link.ts";
import type { HomeLinks } from "./home-links.ts";
import type { ParkCursors } from "./park.ts";
import { RcHolds } from "./rc-holds.ts";
import { registerContentRoutes } from "./content.ts";
import { bindableRoot, markerFile, readMarker, recordDir, writeMarker } from "./binding.ts";
import { personaRefusal, readPersonas, writePersona } from "./personas.ts";

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
/**
 * **What the static file server calls each thing it serves.**
 *
 * Exported so its guard can import it rather than restate it: a test that
 * spells the map out a second time is a test of its own copy
 * (`docs/reviews/lessons.md` #5). `packages/server/test/statictypes.test.ts`
 * holds it to every extension under `packages/web/public/`.
 */
export const STATIC_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  // The handwriting face and the licence that has to travel with it.
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/** Every route that is ABOUT one canvas, by its shape rather than by a list —
 * so `canvasId ∈ admissions` is re-asked on all of them, including the ones
 * a later phase adds. `/api/ops` is deliberately not here: its canvas is in
 * the body, and it says so itself. */
/** The canvas-scoped API prefix. `/api/projects/` is a deliberate holdout
 * (phase 13.5's rename): it is the wire between an installed CLI and a home. */
const CANVAS_API_ROUTE = /^\/api\/projects\/([^/?]+)/;

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
 * canvas's blobs, because the route is canvas-scoped and the `onRequest` hook
 * re-asks `canvasId ∈ admissions` on everything under `/api/projects/:id/`
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
  // Release notes. Nothing here is not already public, and a "what's new"
  // that needs a badge is one nobody reads on the day they most want to.
  if (method === "GET" && pathname === NEWS_ROUTE) return true;
  return false;
}

interface RouteOptions {
  /**
   * Where a sweep's per-badge outcomes go (roles design, "Reaching an open
   * socket"): the daemon hands the same hub to `ws.ts`, which tells the
   * re-rooted their new rung and closes the expelled. Absent in a test that
   * constructs routes alone, in which case one is made and nobody listens.
   */
  sweeps?: SweepHub;
  /** Where a canvas born here, naming nothing, is born — or null when it stays
   * here. What the health route reports as `home` (redefined in phase 10.3,
   * because `stalenessOf` and older CLIs read that key and the birth default
   * is the one whole-daemon answer that still exists), and what a `POST
   * /api/home/join` with no address falls back to. */
  birthHome?: string | null;
  /**
   * **Every home this daemon dials, and which canvas belongs to which.**
   *
   * It decides three things here: which canvas's writes and reads forward and
   * to where, whether a given page is served at this origin at all (see
   * `registerPages` — the one-origin rule is per canvas now), and what `GET
   * /api/homes` answers. Absent means a daemon that is the home of everything
   * it holds, which is every daemon a test constructs without one.
   */
  homes?: HomeLinks | null;
  /**
   * The content origin's base URL, or null/absent when none exists — which
   * is every daemon at stage 1 of the content-origin plan. The daemon sets
   * this from the content listener it actually started (stage 2), never from
   * configuration alone: an advertised base is a base that answers. It is
   * what `GET /api/serving` reports and nothing else reads it.
   */
  contentBase?: string | null;
  /**
   * **The attester this home has borrowed**, or null when it has borrowed
   * none — which is every local daemon and is not a defect.
   *
   * Configuration reaching the routes the way `homeUrl` does, and for the same
   * reason: what a home can VERIFY is innkeeper configuration, not a
   * per-invocation choice, and it must be answerable without a rebuild. It
   * decides three things: whether `email:` may be granted here, what the
   * browser is handed to sign in with, and which canvas a presented token is
   * checked against. See `attest.ts` for why that is one value and not a
   * boolean somebody could set wrongly.
   */
  auth?: AuthConfig | null;
  /**
   * Where the public keys a presented token is checked against come from.
   * Defaults to Google's published endpoint; see `SigningKeys` in `attest.ts`
   * for why this is configuration and what it buys.
   */
  signingKeys?: SigningKeys;
  /**
   * The durable park cursor (on-demand phase 1) — one row per actor per
   * canvas, adopted by the newest park. Absent only in a caller that wired
   * the routes by hand; the daemon always supplies one, and the park routes
   * answer 501 without it rather than inventing a home directory to write in.
   */
  park?: ParkCursors;
  /**
   * The rc hold/ask registry (agent-custody). Shared with the WS layer (which
   * mirrors what member daemons relay) and the home-links (which relay this
   * daemon's own holds up) — so the daemon supplies one instance; a caller
   * that wires routes by hand gets a private registry, which is the same
   * behavior the inline map gave it.
   */
  rc?: RcHolds;
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

  // What this home can verify, derived once from its configuration rather than
  // per request: it cannot change while the process is up, and a home that
  // recomputed it per call would invite somebody to make it a lookup that can
  // fail halfway through a request.
  const auth = options.auth ?? null;
  const attesters = attestersOf(auth);
  const signingKeys = options.signingKeys ?? googleSigningKeys;

  /**
   * **The door's meter** (phase 13.7 — `innkeeper.md`: badges are free to
   * mint, and free may not mean unmetered). One bucket per client, per
   * daemon, in memory — see `meter.ts` for what it protects and for the whole
   * argument about which address a bucket is keyed on.
   *
   * **One meter, and BOTH mint paths draw from it.** There are two: `POST
   * /api/door`, the explicit one, and the SPA fallback in `registerPages`,
   * which mints a cookie badge for any badge-less browser that loads a page.
   * A limit on only the first is one somebody walks around by requesting `/`
   * in a loop. They share a bucket rather than getting one each because they
   * spend the same resource — a desk row — and a caller that alternates
   * between them must not get twice the budget.
   *
   * What differs is the REFUSAL, not the accounting; the page path's own
   * comment says why.
   */
  const mintMeter = new TokenBuckets();
  const mayMint = (req: FastifyRequest): MintRefusal | null =>
    mintMeter.take(clientAddress(req.headers, req.ip, { loopback: loopbackBound(app) }));

  /**
   * What a refused mint is written down as, for the reader who is neither the
   * caller nor in the room: the key it was charged to, the chain that key was
   * read out of, and how many distinct keys the meter holds.
   *
   * That last number is the instrument. A hosted home keyed correctly sees it
   * grow with its visitors; a home that has collapsed the whole internet into
   * its load balancer's address sees refusals climb while it sits at 1. Both
   * look identical from outside — 429s — which is exactly why the difference
   * has to be legible from inside.
   */
  const logRefusal = (req: FastifyRequest, what: string, refusal: MintRefusal) => {
    app.log.warn(
      {
        key: clientAddress(req.headers, req.ip, { loopback: loopbackBound(app) }),
        forwardedFor: req.headers["x-forwarded-for"] ?? null,
        socket: req.ip,
        distinctKeys: mintMeter.size,
        retryAfter: refusal.retryAfter,
      },
      what,
    );
  };

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof OpValidationError) {
      return reply.status(400).send({ error: err.message, code: err.code });
    }
    if (err instanceof CanvasNotFoundError) {
      return reply.status(404).send({ error: err.message, code: "unknown-canvas" });
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
      return reply
        .status(403)
        .send({ error: err.message, code: err.code, ...(err.reason ? { reason: err.reason } : {}) });
    }
    // 403 like `not-admitted`, one notch further in (#88): badged, admitted,
    // and the ledger says look-don't-touch. Its own code because the remedy is
    // different again — not the door, not the link, but being shared with for
    // editing.
    if (err instanceof ViewOnlyError) {
      return reply.status(403).send({ error: err.message, code: err.code });
    }
    // 400 and its own code, for `not-admitted`'s reason pointed the other way:
    // the caller's BADGE is fine and a 401 would send it to the door to throw
    // away a perfectly good credential. What is wrong is the token it
    // presented ON TOP of the badge, and the message says which of the three
    // assumptions failed, because they are three different things to fix.
    if (err instanceof BadIdTokenError) {
      return reply.status(400).send({ error: err.message, code: err.code });
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
   * This handler is where an unmatched non-GET lands. An unmatched GET is
   * `registerPages`'s, which is always registered now (phase 10.3 — a daemon
   * is no longer one of two things, so what it does with a page request is one
   * handler that asks per canvas) — and which takes the same `/api/` branch,
   * and answers this same sentence when there is no built web app to serve.
   * Two call sites, one answer, because a 404 that differs by which fallback
   * caught it is a 404 nobody can reason about.
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
    /**
     * **The birth default**, on the one call every client already makes — and
     * the marker a new canvas gets carries exactly this address
     * (offline-birth's "birth writes a promise").
     *
     * The key survived phase 10.3 with its meaning redefined rather than being
     * dropped or renamed. It used to be "the home this daemon answers to",
     * which is now a per-canvas question with no whole-daemon answer; the
     * birth default is the one whole-daemon answer that still exists, and it
     * is the one this key's readers want. `stalenessOf` reads this body, and
     * so does every CLI older than this daemon — dropping the key would break
     * them, and the transitional wrongness (an old CLI printing this address
     * for a canvas that does not live there) is the acceptable half of that
     * trade, made deliberately. Per-canvas questions go to `GET /api/homes`.
     */
    ...(options.birthHome ? { home: options.birthHome } : {}),
    ...buildStamp(),
    /**
     * **The third kind of stale** (auto-upgrade phase 2): this daemon's build
     * against the build its home runs.
     *
     * It rides this body because `makeCtx` already fetches it before every
     * command, so the CLI pays no round trip and an offline machine simply has
     * no field. The daemon did the asking, on its own hourly timer — see
     * `HomeLink.askBuild`. **Absent is absent**, never "you are current": a
     * spread of `{}` is what a homeless daemon, an unreachable home and a home
     * too old to name its own commit all produce.
     */
    ...(() => {
      const verdict = options.homes?.upgrade() ?? null;
      return verdict ? { upgrade: verdict } : {};
    })(),
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
  const sweeps = options.sweeps ?? new SweepHub();

  /** The creator's name, resolved the way the Share dialog resolves
   * `createdBy` — through the registry, so a rename reaches it. */
  const ownerName = async (project: { createdBy: { id: string; name: string } }): Promise<string> =>
    actorNameIn(await engine.actorNames(), project.createdBy);

  /**
   * The read-only refusal, naming the owner (roles journey 1 step 5: *ask
   * Priya, who owns it*). The snapshot is read for the name only on the
   * refusal itself — a rare path, and the engine holds the canvas already —
   * so the hook pays nothing for it on the requests it lets through. A
   * canvas that cannot be read says "whoever shared it", as before.
   */
  const viewOnly = async (canvasId: string): Promise<ViewOnlyError> => {
    const snapshot = await engine.getSnapshot(canvasId).catch(() => null);
    return new ViewOnlyError(canvasId, snapshot ? await ownerName(snapshot.project) : undefined);
  };

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
      // canvas-scoped route added later is covered by DEFAULT instead of by
      // somebody remembering.
      const scoped = CANVAS_API_ROUTE.exec(pathname)?.[1];
      if (scoped) {
        const canvasId = decodeSegment(scoped);
        await admit(req, canvasId);
        /**
         * The capability check, method-keyed and in the SAME hook (#88): an
         * admission below `edit` (`view`, `read`) reads everything and
         * changes nothing, and "changes" on an HTTP surface is any verb but
         * GET/HEAD. One line here covers undo, redo, blobs, gc, grants,
         * passes, sessions, bind, write — and whatever canvas-scoped route
         * gets added next month, which is this hook's whole argument about
         * coverage by default. `/api/ops` carries its canvas in the body and
         * takes the same test in its handler. The ladder's one comparison,
         * so `own` counts as editing and any rung below it does not.
         */
        if (
          req.method !== "GET" &&
          req.method !== "HEAD" &&
          !atLeast(capabilityIn(req.badge, canvasId) ?? "edit", "edit")
        ) {
          throw await viewOnly(canvasId);
        }
      }
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
   * **A client older than this home, told so** (phase 13.5 — see
   * `staleClientRefusal`, which is the whole test and the whole message).
   *
   * One hook rather than a line per route, for the door hook's reason: the
   * routes that carry a canvas in their body are `/api/ops`, `HOME_JOIN_ROUTE`
   * and whatever gets written next month, and a break that explains itself on
   * two of the three is a break that surprises somebody on the third.
   *
   * `/api/ops` was the one that actually bit — a pre-rename CLI READS fine
   * (a canvas travels in the path on a GET, and paths did not change) and dies
   * on its first write — but `HOME_JOIN_ROUTE` is the worse one: there the
   * caller is a pre-rename REPLICA rather than a person, so the refusal is
   * read by nobody and the canvas simply never arrives.
   *
   * `preValidation` because that is the first point the parsed body exists;
   * the badge hook still goes first, so a caller with no badge is told about
   * the badge, which is the thing it must fix before this answer would even
   * be reachable.
   */
  app.addHook("preValidation", async (req, reply) => {
    const body = req.body as { op?: unknown } | undefined;
    // The nested `op` too: `project.create` is the one op that carries the
    // canvas's id INSIDE the operation, so a pre-rename create is stale in two
    // places and would otherwise be caught only by the outer one's `null`.
    const stale = staleClientRefusal(
      body as Record<string, unknown> | undefined,
      body?.op as Record<string, unknown> | undefined,
    );
    // `{error, code}`, this file's shape for every refusal — the socket's
    // shorter sentence stays on the socket.
    if (stale) {
      return reply.status(STALE_CLIENT_STATUS).send({ error: stale.error, code: stale.code });
    }
  });

  /**
   * Mint a badge. `carrier` is STATED, never sniffed: `Origin` presence and
   * `Sec-Fetch-Mode` are guessable and wrong at the edges, and one field in a
   * body is honest and costs nothing.
   *
   * The door mints only for the badge-less. A caller that already holds a
   * valid badge is told its own id and handed no new secret, so a refresh
   * storm or a retry loop cannot mint a badge per request.
   *
   * **The meter runs after that branch and not before** (phase 13.7). The
   * limit is on MINTS, not on knocks: a client holding a badge that hammers
   * this route costs the desk nothing, and metering it would lock out the one
   * caller that is behaving. `mayMint` is therefore consulted at the exact
   * line below which a row gets written.
   */
  app.post(DOOR_ROUTE, async (req, reply) => {
    if (req.badge) return { badgeId: req.badge.badgeId } satisfies DoorResponse;
    const refusal = mayMint(req);
    if (refusal) {
      logRefusal(req, "the door refused a mint: metered", refusal);
      // `Retry-After` for the machine, the same seconds in the sentence for
      // the person, `{error, code}` for the agent reading it off the CLI —
      // one refusal, three readers. The message names the reuse the caller
      // should have done, because "wait" alone teaches a retry loop to wait.
      return reply
        .status(429)
        .header("Retry-After", String(refusal.retryAfter))
        .send({
          error:
            `too many new badges from here — this door mints ${MINT_PER_MINUTE} a minute per caller, ` +
            "and a badge is good for a year, so hold on to the one you were handed rather than " +
            `knocking again. Try again in ${refusal.retryAfter}s.`,
          code: TOO_MANY_BADGES,
        });
    }
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
   * **The door, and the point of phase 7.** `canvasId ∈ badge.admissions`,
   * re-asked on every canvas-scoped route (mechanism 5) — and, when the
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
   * lookup is `admittingGrant`, and because every canvas-scoped route passes
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
    if (req.badge.admissions.some((a) => a.canvasId === canvasId)) {
      // Already in — but an admission below `edit` re-asks the door, so
      // proving an email after entering by a view link lets the invitation
      // that names this person take effect (see `heldCapability`). Editors
      // return on the short-circuit as they always have; the snapshot read
      // for the creator's floor is paid only by the re-ask.
      const held = capabilityIn(req.badge, canvasId);
      if (held !== null && !atLeast(held, "edit")) {
        const snapshot = await engine.getSnapshot(canvasId).catch(() => null);
        await heldCapability(desk, canvasId, req.badge, snapshot?.project.createdBy.id ?? null);
      }
      return;
    }

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

    // The admitting grant's capability rides onto the admission (#88): the
    // door test short-circuits on the admission ever after, so this copy is
    // the one that gets enforced. Bootstrap is `edit` by construction —
    // making a canvas is editing it.
    let capability: Capability = "edit";
    if (!provenance) {
      // No canvas here at all — let the route answer 404 for itself. On a
      // replica this is also the ordinary shape of "not replicated yet".
      if (!(await store.canvasExists(canvasId))) return;
      // The snapshot is read for one field: the creator, so the door can
      // apply the floor (roles design) when no row admits. Once per badge per
      // canvas, which is what an admission costs.
      const snapshot = await engine.getSnapshot(canvasId).catch(() => null);
      if (!snapshot) return;
      const answer = await admittingGrant(desk, canvasId, req.badge, snapshot.project.createdBy.id);
      if (!answer) throw new NotAdmittedError(canvasId);
      provenance = answer.provenance;
      capability = answer.capability;
    }

    await desk.admit(req.badge.badgeId, canvasId, provenance, capability);
    req.badge.admissions = [
      ...req.badge.admissions,
      {
        canvasId,
        provenance,
        at: new Date().toISOString(),
        ...(narrowed(capability) ? { capability } : {}),
      },
    ];
  };

  app.post("/api/ops", async (req, reply) => {
    const body = req.body as PostOpRequest;
    /**
     * The idempotency key, shape-checked before it can reach the oplog
     * (phase 10). A caller that sends one gets exactly-once for this op; a
     * caller that sends nonsense is told so here rather than having it written
     * into the canvas's permanent history where every replica will carry it.
     *
     * Home-scoped ops are deliberately outside this: `actor.claim` and
     * `actor.setColor` land in the actors log, which has no per-canvas live
     * log to look a key up in, and neither is a queued write — a browser that
     * cannot reach the home cannot become somebody either. They ignore the
     * field, which is why the check is here and not below.
     */
    if (body.opId !== undefined && !isOpId(body.opId)) {
      return reply.status(400).send({ error: `not an op id: ${body.opId}`, code: "bad-op" });
    }
    /**
     * **`home` is a birth's address and nothing else** (phase 10.3), refused
     * here rather than quietly ignored below.
     *
     * The whole safety of putting an address beside the op is that it can only
     * ever say "the canvas I am creating right now is born at X" — write-once,
     * about one canvas, unable to re-point anything that exists. An address on
     * an `item.move` would mean nothing today and would be read as meaning
     * something the day somebody wired it up, which is how a bounded surface
     * stops being bounded. Ignoring it silently is the cheerful wrong answer;
     * saying so is the refusal.
     */
    if (body.home !== undefined && body.op?.type !== "project.create") {
      return reply.status(400).send({
        error:
          "`home` says where a canvas is being BORN, so it belongs only on project.create — " +
          "a canvas that already exists has a home, and no op re-points it (that is re-homing)",
        code: "bad-op",
      });
    }
    /**
     * **`spaceId` is a birth's space and nothing else** (roles phase 4),
     * refused beside anything but a create for `home`'s reason: request state
     * about one canvas coming into existence, never a way to move one. Moving
     * a canvas is `PUT /api/spaces/:id/canvases/:canvasId`.
     */
    if (body.spaceId !== undefined) {
      if (body.op?.type !== "project.create") {
        return reply.status(400).send({
          error:
            "`spaceId` says which space a canvas is being BORN in, so it belongs only on " +
            "project.create — a canvas that exists is moved with `isocan space add`",
          code: "bad-op",
        });
      }
      if (typeof body.spaceId !== "string" || body.spaceId === "") {
        return reply.status(400).send({ error: "`spaceId` names a space by id", code: BAD_SPACE });
      }
    }
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
    if (body.op?.type === "actor.setMark") {
      // Home-scoped like the colour beside it: the registry changes, not a
      // canvas, so it takes the same route and never reaches a reducer.
      const entry = await engine.setActorMark({
        op: body.op,
        actor: body.actor,
        badgeId: req.badge!.badgeId,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
    }
    if (body.op?.type === "actor.join") {
      // Home-scoped like the colour and the mark (multi-identity phase 5):
      // the registry changes, and the claim check is inside `joinActors`.
      const entry = await engine.joinActors({
        op: body.op,
        actor: body.actor,
        badgeId: req.badge!.badgeId,
        ...(body.clientId !== undefined ? { clientId: body.clientId } : {}),
      });
      return { seq: entry.seq, envelope: entry.envelope };
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
     * its path (`CANVAS_API_ROUTE` deliberately does not match it — "its canvas
     * is in the body, and it says so itself"), so the hook cannot cover it and
     * this call is the door for every op ever written. Under phase 2's policy
     * the admission was recorded AFTER the submit, which was harmless when it
     * could not refuse; a refusal that arrives after the op has landed is not
     * a refusal at all.
     */
    if (body.canvasId) {
      await admit(req, body.canvasId);
      // The capability check, at the one mutating route the hook cannot cover
      // (#88). BEFORE the submit for the door's own reason: a refusal that
      // arrives after the op has landed is not a refusal at all.
      if (!atLeast(capabilityIn(req.badge!, body.canvasId) ?? "edit", "edit")) {
        throw await viewOnly(body.canvasId);
      }
    }
    /**
     * **Born in a space** (roles design, "Born in a space"). Decided HERE
     * when this daemon is the birth home: the space is looked up, `own` on
     * it is asked of the actor, and the create is submitted with the birth
     * link grant suppressed, so a locked space stays locked as it grows. The
     * newborn is added to the space after the create lands, because a space
     * naming a canvas whose creation then failed would be a row about
     * nothing. When the birth goes to another home — a stated address, or
     * this machine's birth default — the id rides up with the op
     * (`forwardSubmit`) and that home decides, because the space is its desk
     * state and this one holds no row to check.
     */
    let bornInto: Space | null = null;
    if (body.spaceId !== undefined && body.op?.type === "project.create") {
      const bornAway = options.homes ? body.home !== undefined || options.homes.birth() !== null : false;
      if (!bornAway) {
        const owned = await ownedSpace(req, reply, body.spaceId, body.actor.id);
        if ("refused" in owned) return owned.refused;
        bornInto = owned.space;
      }
    }
    const entry = await engine.submit({
      ...(body as PostOpRequest & { actor: Actor }),
      badgeId: req.badge!.badgeId,
      ...(bornInto ? { withoutLinkGrant: true } : {}),
    });
    if (body.op?.type === "project.create") {
      // The bootstrap badge's first admission, and it can only be taken after
      // the fact: the canvas did not exist to be admitted to a moment ago. It
      // earned this one by making the canvas, which is the only provenance
      // that is not "somebody let me in".
      await admit(req, body.op.canvasId, true);
      if (bornInto) {
        // Re-read rather than reuse: another write may have moved the
        // space's list while the create was landing.
        const fresh = (await desk.space(bornInto.id)) ?? bornInto;
        if (!fresh.canvasIds.includes(body.op.canvasId)) {
          await desk.putSpace({ ...fresh, canvasIds: [...fresh.canvasIds, body.op.canvasId] });
        }
      }
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
   * open (the canvases page) — everything absent is derived from the id. */
  /**
   * **Can this site be shown in a frame?**
   *
   * "Add site" projects a live site into an item, and an item is an iframe.
   * Most of the public web refuses that — `X-Frame-Options` and CSP
   * `frame-ancestors` exist to stop exactly this — and the refusal was
   * SILENT: the item appeared, the browser declined to render it, and the
   * canvas showed a blank rectangle. "I tried yahoo.com and it didn't work."
   *
   * It has to be asked from HERE. A page cannot tell a blocked cross-origin
   * frame from a loaded one, so the headers are the only fact available and
   * only something making the request server-side can read them.
   *
   * A verdict is advice, never a gate: a site can answer differently to a
   * different agent, redirect, or simply be slow, so anything that goes wrong
   * here answers `ok` and lets the person try. The one thing this must not do
   * is refuse a site that would have worked.
   */
  app.get("/api/frameable", async (req) => {
    const raw = (req.query as { url?: string }).url ?? "";
    let target: string;
    try {
      target = normalizeSiteUrl(raw);
    } catch (err) {
      return { ok: true, unchecked: (err as Error).message };
    }
    try {
      const probe = await fetch(target, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      });
      const verdict = frameVerdict(probe.headers, null);
      // The address AFTER redirects: `yahoo.com` answers from elsewhere, and
      // naming the place that refused beats naming the place you typed.
      return { ...verdict, url: probe.url || target };
    } catch {
      // Unreachable, too slow, refused the probe: not our verdict to give.
      return { ok: true, unchecked: "could not be reached to check" };
    }
  });

  /**
   * **A Google Doc's markdown, fetched for the app**
   * (`docs/research/2026-09-02-google-docs-on-the-canvas.md`, stage 2). A
   * browser cannot read docs.google.com across origins, so the daemon does,
   * the way it reads framing headers for `/api/frameable` — and only for an
   * address core recognises as a doc, never as a general proxy. A doc that is
   * not shared by link answers with a sign-in page; that is refused by its
   * content type rather than handed back as if it were the document.
   */
  app.get(DOC_EXPORT_ROUTE, async (req, reply) => {
    const raw = (req.query as { url?: string }).url ?? "";
    const id = googleDocId(raw);
    if (!id) {
      reply.code(400);
      return { error: "not a Google Doc address", code: "not-a-doc" };
    }
    try {
      const res = await fetch(googleDocExportUrl(id), { redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || /text\/html/i.test(type)) {
        reply.code(403);
        return {
          error: "Google would not hand this document over anonymously — share it by link, or add it from a machine with a Drive token",
          code: "doc-not-public",
        };
      }
      const markdown = await res.text();
      return { id, source: googleDocUrl(id), markdown, title: docTitleFrom(markdown, id), fetchedAt: new Date().toISOString() };
    } catch (err) {
      reply.code(502);
      return { error: `could not reach Google: ${(err as Error).message}`, code: "doc-unreachable" };
    }
  });

  app.get("/api/colors", async () => engine.actorColors());

  /** Current names, for clients rendering words somebody wrote under a name
   * they no longer use — the canvases page paints them too. */
  app.get("/api/names", async () => engine.actorNames());
  /* The marks, beside the names, because they answer the same question: what
     goes in the disc. Kept a separate route rather than folded into `/names`
     so an older client reading names is unaffected. */
  app.get("/api/marks", async () => engine.actorMarks());

  /** How this home serves — today, only whether a content origin exists.
   * See `SERVING_ROUTE` in core for the contract and `content.ts` for the
   * role it advertises. */
  app.get(SERVING_ROUTE, async () => ({ contentBase: options.contentBase ?? null }));

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
   * route did not simply narrow. See {@link CanvasesReach}: two callers ask
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
    // (`canvasesRoute`) so that a caller cannot arrive here with a near-miss.
    const reach = query[CANVASES_REACH_PARAM];
    const narrow = reach === "admitted";
    /**
     * `?reach=here` — of the ones this badge may see, the canvases **this
     * daemon is the home of** (phase 10.3). What the web app's canvas list
     * asks, because its links are client-side navigations that never reach the
     * per-canvas page guard: without this the local origin would render a replica of
     * a canvas that lives at dev, giving that canvas two doors, two cookies,
     * two service workers and two browser replicas.
     *
     * It stacks ON the admissible answer rather than replacing it — being the
     * home of a canvas does not admit anybody to it, and a route that answered
     * "here" without the door's test would be a page server handing out a
     * roster of the machine.
     */
    const hereOnly = reach === "here";
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const visible: Canvas[] = [];
    /**
     * **The door's space reads, memoized for the wide list** (roles design,
     * "The door reads both"). One `spacesFor(badge)` — the bounded queries —
     * gives every space whose rows could admit this badge and the canvases
     * each holds; one `grantsForSpace` per such space, on first use. A canvas
     * in a space the badge cannot see is read as being in none, which is the
     * truth the door would reach the long way: no row on an unseen space
     * names this badge. So the list pays one query per visible space rather
     * than one `spaceOf` per canvas. Built lazily, because the narrow answer
     * runs no door test at all.
     */
    let canvasSpace: Map<string, Space> | null = null;
    const spaceRows = new Map<string, Promise<Grant[]>>();
    const groupReads = new Map<string, Promise<Group | null>>();
    const via = {
      spaceOf: async (canvasId: string): Promise<Space | null> => {
        if (!canvasSpace) {
          canvasSpace = new Map();
          for (const space of await desk.spacesFor(badge)) {
            for (const id of space.canvasIds) canvasSpace.set(id, space);
          }
        }
        return canvasSpace.get(canvasId) ?? null;
      },
      grantsForSpace: (spaceId: string): Promise<Grant[]> => {
        let rows = spaceRows.get(spaceId);
        if (!rows) {
          rows = desk.grantsForSpace(spaceId);
          spaceRows.set(spaceId, rows);
        }
        return rows;
      },
      // A group named on several canvases is one read for the whole list
      // (roles phase 5), for the same reason the space's rows are.
      group: (groupId: string): Promise<Group | null> => {
        let found = groupReads.get(groupId);
        if (!found) {
          found = desk.group(groupId);
          groupReads.set(groupId, found);
        }
        return found;
      },
    };
    for (const canvas of await engine.listCanvases()) {
      if (hereOnly && (options.homes?.homeOf(canvas.id) ?? null) !== null) continue;
      if (admitted.has(canvas.id)) visible.push(canvas);
      else if (!narrow && (await admittingGrant(desk, canvas.id, badge, canvas.createdBy.id, via))) {
        visible.push(canvas);
      }
    }
    return visible;
  });

  /**
   * **Which canvas lives where** — one read, and the only route that can
   * answer a per-canvas home question (phase 10.3).
   *
   * See `HOMES_ROUTE` in core for the four callers this exists for. The
   * reachability figures come from what each link last observed on its own
   * poll rather than from a probe made here: `isocan status` reads this, an
   * agent runs `isocan status` dozens of times, and a network round trip per
   * home per invocation is a cost nobody asked for.
   */
  /**
   * **Where everybody is, in one read** — see `PRESENCE_WHERE_ROUTE`.
   *
   * The admission test is the same two-step the canvas list runs, and it
   * matters more here than there: a canvas list you cannot see leaves you
   * merely uninformed, while a roster you cannot see tells you who is working
   * with whom. Rooms are filtered before anything about their occupants is
   * reported, not after.
   *
   * A room the badge may not enter contributes nothing — not an empty entry,
   * not a count. "Three people somewhere you cannot look" is still a fact
   * about somebody else's canvas.
   */
  /**
   * **What changed, for the person using this** — see `NEWS_ROUTE`.
   *
   * Read from the day files this build shipped with, so a home a week behind
   * has nothing newer to show, which is the honest answer and cost nothing to
   * arrange. Read per request rather than cached: these files change when a
   * build changes, a build change restarts the process, and a cache would be
   * a staleness bug in a feature whose entire job is saying what is current.
   */
  app.get(NEWS_ROUTE, async () => {
    /**
     * `WHATSNEW.md` at the package root — the one document written for the
     * person using this, and the only one that ships.
     *
     * The first version read `docs/changelog/`, and it was wrong twice.
     * `docs` is excluded from the production image on purpose, so the route
     * answered `{"days":[]}` on prod while working on a checkout; and even if
     * it had shipped, it would have put a document full of internal reasoning
     * one careless read away from being served.
     *
     * Read per request rather than cached: the file changes when a build
     * changes, a build change restarts the process, and a cache would be a
     * staleness bug in a feature whose whole job is saying what is current.
     */
    const text = await fs
      .readFile(path.join(buildRoot(), "WHATSNEW.md"), "utf8")
      .catch(() => "");
    // A build without the file has no news, which is a normal answer for a
    // stripped install rather than an error to raise.
    return { days: news(text) } satisfies NewsResponse;
  });

  app.get(PRESENCE_WHERE_ROUTE, async (req) => {
    const badge = req.badge!;
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const seen = new Map<string, boolean>();
    const maySee = async (canvasId: string): Promise<boolean> => {
      const known = seen.get(canvasId);
      if (known !== undefined) return known;
      // One grant query per ROOM, not per face: a canvas with nine agents on
      // it asked nine times before this cache.
      const allowed =
        admitted.has(canvasId) || Boolean(await admittingGrant(desk, canvasId, badge));
      seen.set(canvasId, allowed);
      return allowed;
    };
    const where: PresenceWhere[] = [];
    for (const { canvasId, session } of presence.everywhere()) {
      if (!(await maySee(canvasId))) continue;
      where.push({
        canvasId,
        actor: session.actor,
        kind: session.kind,
        harness: session.harness,
        status: session.status,
        statusSource: session.statusSource,
        lastSeen: session.lastSeen,
      });
    }
    return { where } satisfies PresenceWhereResponse;
  });

  app.get(HOMES_ROUTE, async () => {
    /**
     * **Every canvas this daemon HOLDS, not every row it has written down.**
     *
     * The two differ exactly where absent-means-local does its work, and
     * reading only the rows made this route the third place phase 10.3 quietly
     * disagreed with its own rule (phase 10.5 found all three). A machine that
     * predates `homes.json` holds canvases with no rows at all, so `isocan
     * home` listed nothing and `isocan status` called a daemon that is the
     * home of three canvases a replica of somewhere else — while it was
     * serving those canvases' pages perfectly well.
     *
     * So the answer is built from the canvas list, with each canvas's row
     * read through the same `?? null` rule the page server and the engine use.
     * A row naming a canvas this daemon does not hold is dropped rather than
     * reported: it is a record about nothing, and the question this route
     * answers is "who answers for the canvases here".
     */
    const rows = options.homes?.assignments() ?? {};
    const canvases: Record<string, string | null> = {};
    for (const canvas of await store.listCanvases()) {
      canvases[canvas.id] = rows[canvas.id] ?? null;
    }
    return {
      birth: options.birthHome ?? null,
      canvases,
      /**
       * `reachable` is the HTTP half — whether the last poll of this home was
       * answered. `canvases` is the half it cannot speak for: writes forward
       * over HTTP, but **presence rides only on the per-canvas socket**, so a
       * reachable home and a canvas whose face never leaves the machine are
       * not a contradiction. Reporting only the first is what let a broken
       * canvas link look identical to a quiet canvas.
       */
      links: (options.homes?.links() ?? []).map((link) => ({
        url: link.homeUrl,
        reachable: link.answering,
        canvases: link.canvasStates(),
      })),
    } satisfies HomesResponse;
  });

  app.get("/api/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    return snapshot.project;
  });

  // ---- grants: who may enter this canvas (identity desk, mechanisms 3 + 2) ----
  //
  // Three routes, canvas-scoped, so the `onRequest` hook has already asked
  // the door about the caller before any of them runs: **only an admitted
  // badge can read or change a canvas's grants**, with nothing per-route to
  // remember. One endpoint for both surfaces — stage 2's Share dialog and the
  // CLI verb drive exactly these.
  //
  // **Every write here asks `own`** (roles design, "What only an owner may
  // do"): inviting, revoking, the link and its rung. The reading routes stay
  // with anyone admitted — who may be here is worth knowing whoever you are.
  // Phase 7 deliberately left ownership out ("anyone in the doc can share the
  // doc"); the roles research argued that an editor who can invite is an
  // owner with extra steps, and roles phase 2 made every grant write an
  // owner's. `heldRung` is the question: the admission's rung, raised to
  // `own` if the badge claims the creator, and `own` is grantable like any
  // other rung, so a canvas changes hands by adding an owner.
  //
  // On a REPLICA all three forward to the home. A grant is desk state and does
  // not replicate, so the row that decides who may enter the canvas lives at
  // the home — and a verb that quietly edited the laptop's own copy would
  // report success while the link stayed on for everyone else.

  app.get("/api/projects/:id/grants", async (req) => {
    const { id } = req.params as { id: string };
    // THIS canvas's home (phase 10.3): a grant is desk state and the row
    // that decides who may enter lives at the home that answers the door for
    // this canvas, which under many homes is a per-canvas question.
    const home = options.homes?.for(id) ?? null;
    if (home) return home.grants(id);
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
    // The shape, in one place for this route and the space's (roles phase 4):
    // `bars: true` or nothing — written only when it says something, so a
    // caller sending `bars: false` is sending a shape this route has never
    // meant; a bar's own subject rule (never `link`, never a group) on top of
    // the shape every row must have; the ladder's four words and nothing
    // else (#88, widened by the roles ladder — a home from before a rung
    // refuses it here, which is what lets a newer client tell "this home
    // cannot" from "this row was not written"); and no rung on a bar,
    // because a "no" at Canvas Viewer is not a sentence.
    const shape = badGrantBody(body);
    if (shape) return reply.status(400).send({ error: shape, code: "bad-grant" });
    const bars = body.bars === true;
    const subject = normalizeSubject(body.subject!);
    const capability: Capability = body.capability ?? "edit";
    const actorId = await actingActor(req, body.actorId);
    // A REPLICA forwards without asking its own opinion, and the order of
    // these two lines is that decision. Shape is universal and refused above;
    // "can anything here verify that" is a fact about the home that OWNS the
    // grant, and a laptop that answered it locally would be a second copy of a
    // policy that is about to change — refusing an invitation the home would
    // have accepted, on the strength of its own configuration. Same reason
    // `isocan share <email>` has no client-side "not yet". The actor rides up
    // with it, so the home asks `own` of the person and not of the machine.
    const home = options.homes?.for(id) ?? null;
    if (home) return home.createGrant(id, subject, capability, await actorNamed(actorId), bars);
    const snapshot = await engine.getSnapshot(id);
    const live = liveGrants(await desk.grantsFor(id)).find((g) => g.subject === subject);
    // What already stands is handed back, for the toggle's reason: a bar
    // over a bar, or a rung over the same rung. A bar over an invitation, or
    // an invitation over a bar, is the replacement below.
    if (live && isBar(live) === bars && (bars || capabilityOf(live) === capability)) {
      return { grant: live } satisfies GrantResponse;
    }
    /**
     * **Writing a row is the owner's** (roles design, "What only an owner may
     * do") — inviting at any rung, and the link at any rung, alike. Until
     * roles phase 2 only the CAPABILITY was owner-only and any editor could
     * invite at edit or turn the link off; the research's argument stands,
     * that an editor who can invite is an owner with extra steps, and this is
     * the one deliberate change in behaviour for existing users. The refusal
     * names the remedy, which is a person.
     *
     * Checked here rather than in the client, and after the replica forward
     * above, so the home that owns the canvas is the one that answers.
     */
    if (!atLeast(await heldRung(desk, snapshot.project, req.badge!, actorId ?? null), "own")) {
      return reply
        .status(403)
        .send({ error: notOwnerMessage(await ownerName(snapshot.project)), code: NOT_OWNER });
    }
    /**
     * A row naming the creator's own address is refused as redundant: the
     * creator holds `own` without one, by the floor, and a row that admits
     * somebody the door already admits to more is a row that would only
     * confuse the table. Asked of every badge that claims the creator, since
     * the address is proved on a badge and the creator is a person.
     */
    if (await namesTheCreator(subject, snapshot.project)) {
      return reply.status(400).send({ error: await creatorRowRefusal(subject, snapshot.project, bars), code: "bad-grant" });
    }
    // After the owner's question, not before it: whether THIS home can
    // verify the address is the next thing wrong with the request, once the
    // caller is somebody who may write a row at all. A bar is held to it
    // too: a bar naming an address nobody here can prove keeps nobody out,
    // and a row with no effect is the thing this refusal exists to prevent.
    const unverifiable = attesterRefusal(subject, attesters);
    if (unverifiable) {
      return reply.status(400).send({ error: unverifiable, code: NO_ATTESTER });
    }
    // A group row names a LIVE group on this home (roles phase 5). Any
    // actor may make one and the wire carries ids, so the gate is that the
    // group exists and stands: a row pointing at a group nobody here can
    // produce would admit nobody while the dialog claimed the team was
    // invited. Its maker is not asked — handing a canvas owner the id is how
    // a group is lent, and what they learn of it is its name and size.
    const groupId = groupIdOf(subject);
    if (groupId !== null && !(await liveGroup(groupId))) return groupNotFound(reply, groupId);
    const grant: Grant = bars
      ? barRow(id, subject, req.badge!.badgeId)
      : {
          id: newId("gnt"),
          canvasId: id,
          subject,
          grantedBy: req.badge!.badgeId,
          at: new Date().toISOString(),
          ...(narrowed(capability) ? { capability } : {}),
        };
    /**
     * Same subject, different capability: a REPLACEMENT, in one gesture (#88).
     * The old row is tombstoned and the new one written BEFORE the sweep runs,
     * and that order is the mechanism: the sweep re-runs the door test on
     * every badge rooted at the dead row, finds the new grant, and re-roots
     * them at its capability — which is exactly how "the link can only view
     * now" reaches the people who are already inside, without expelling them.
     * Two rows and a sweep rather than an edit-in-place, because provenance
     * points at grant ids and an id whose meaning changed underneath its
     * admissions would be a capability nothing ever re-checked.
     *
     * A bar replaces a live row the same way — and it sweeps even when there
     * was no row to replace, because the person it names may be inside on
     * the link. The sweep carries the bar without a mechanism of its own: it
     * re-runs the door, and the door now says no (roles phase 3).
     */
    if (live) {
      await desk.revokeGrant(live.id, new Date().toISOString(), req.badge!.badgeId);
    }
    await desk.putGrant(grant);
    if (live || bars) {
      const swept = await sweepCanvas(desk, id, snapshot.project.createdBy.id, sweeps.report);
      return { grant, swept } satisfies GrantResponse;
    }
    return { grant } satisfies GrantResponse;
  });

  /** A bar row (roles design, "The bar"): a grant row with `bars: true` and
   * no capability, for the DELETE's `?bar=1` and the POST's `bars` alike. */
  const barRow = (canvasId: string, subject: GrantSubject, grantedBy: string): Grant => ({
    id: newId("gnt"),
    canvasId,
    subject,
    grantedBy,
    at: new Date().toISOString(),
    bars: true,
  });

  /** Why a row naming the creator's own address is not written — as an
   * invitation (redundant: the creator owns it without one) or as a bar (it
   * would do nothing: the door checks the floor before a bar takes effect). */
  const creatorRowRefusal = async (
    subject: GrantSubject,
    project: { createdBy: { id: string; name: string } },
    bars: boolean,
  ): Promise<string> =>
    `${subject} is ${await ownerName(project)}'s own address, and they made this canvas — ` +
    (bars ? "the creator cannot be kept out" : "the creator owns it without a row");

  /**
   * **Who is acting**, for a write that asks `own` (roles design, "Over a
   * replica, the write names the person"). The caller may say
   * (`CreateGrantRequest.actorId`, or `?actorId=` on a DELETE), and whoever
   * it names must be somebody this badge speaks for — mechanism 5's own
   * `requireActor`, on the replica and again on the home, which is the same
   * split a pass takes. A caller that says nothing and holds exactly one
   * claim is taken to be that person; one that holds several and says
   * nothing is judged by the badge as a whole, which is what every caller
   * from before the field asked for.
   */
  const actingActor = async (req: FastifyRequest, said: unknown): Promise<string | undefined> => {
    const actorId = typeof said === "string" && said ? said : undefined;
    if (actorId) {
      await engine.requireActor(req.badge!.badgeId, actorId);
      return actorId;
    }
    const claims = req.badge!.claims;
    return claims.length === 1 ? claims[0]!.actorId : undefined;
  };

  /** The actor with its name, for a forwarded write: the home may never have
   * heard of this person, and `HomeLink` claims before it asks. */
  const actorNamed = async (actorId: string | undefined): Promise<Actor | undefined> => {
    if (!actorId) return undefined;
    const names = await engine.actorNames();
    return { id: actorId, name: names[actorId] ?? "" };
  };

  /** Does this subject name an address the creator has proved, on any badge
   * that claims them? */
  const namesTheCreator = async (
    subject: GrantSubject,
    project: { createdBy: { id: string } },
  ): Promise<boolean> => {
    if (subject === LINK) return false;
    for (const { badgeId } of await desk.claimants(ownerOf(project))) {
      const holder = await desk.badge(badgeId);
      if (holder && attestationSatisfying(subject, holder.attestations ?? [])) return true;
    }
    return false;
  };

  /** The creator of a canvas, for a sweep that does not hold the snapshot —
   * `killAndSweep`'s shape, shared with the space sweeps. */
  const creatorOf = (canvasId: string): Promise<string | null> =>
    engine.getSnapshot(canvasId).then(
      (snapshot) => snapshot.project.createdBy.id,
      () => null,
    );

  /** An actor's name, through the registry, so a rename reaches it. */
  const nameOf = async (actorId: string): Promise<string> =>
    actorNameIn(await engine.actorNames(), { id: actorId, name: actorId });

  const spaceNotFound = (reply: FastifyReply, spaceId: string): FastifyReply =>
    reply.status(404).send({
      error: `no space ${spaceId} here that this badge may see`,
      code: SPACE_NOT_FOUND,
    });

  /**
   * **A space this badge may WRITE** (roles phase 4), or the refusal: 404
   * `space-not-found` for a space that is not here, is deleted, or that this
   * badge may not see at all — three answers alike, so a stranger learns
   * nothing about the space around a canvas — and 403 `not-owner`, naming
   * the space's creator, for somebody who may see it and holds less than
   * `own`. `heldRungOnSpace` is the question, with the actor narrowed the
   * way the grant routes narrow it.
   */
  const ownedSpace = async (
    req: FastifyRequest,
    reply: FastifyReply,
    spaceId: string,
    actorId: string | undefined,
  ): Promise<{ space: Space } | { refused: FastifyReply }> => {
    const space = await desk.space(spaceId);
    if (!space || !isSpaceLive(space)) return { refused: spaceNotFound(reply, spaceId) };
    const held = await heldRungOnSpace(desk, space, req.badge!, actorId ?? null);
    if (held === null) return { refused: spaceNotFound(reply, spaceId) };
    if (!atLeast(held, "own")) {
      return {
        refused: reply.status(403).send({
          error:
            `ask ${await nameOf(space.createdBy)}, who owns the space ${space.name} — only an ` +
            "owner of a space can change what is in it or who may enter its canvases",
          code: NOT_OWNER,
        }),
      };
    }
    return { space };
  };

  /** A space this badge may SEE — the read routes. Null answers like not found. */
  const visibleSpace = async (req: FastifyRequest, spaceId: string): Promise<Space | null> => {
    const space = await desk.space(spaceId);
    if (!space || !isSpaceLive(space)) return null;
    return (await heldRungOnSpace(desk, space, req.badge!)) === null ? null : space;
  };

  const groupNotFound = (reply: FastifyReply, groupId: string): FastifyReply =>
    reply.status(404).send({
      error: `no group ${groupId} here that this badge may see`,
      code: GROUP_NOT_FOUND,
    });

  /** A group that exists and stands — what a `group:` row may name. */
  const liveGroup = async (groupId: string): Promise<Group | null> => {
    const group = await desk.group(groupId);
    return group && isGroupLive(group) ? group : null;
  };

  /**
   * **A group this badge may SEE** (roles phase 5, "Who sees the members"),
   * and whether it OWNS it. Its maker sees it whole. Anybody else sees it —
   * name and size, never the members — only through a live grant naming it
   * that they can already see: a canvas row on a canvas they are admitted
   * to, or a space row on a space they may see. Otherwise null, which the
   * routes answer as not found, so a group stays a private list: knowing an
   * id is not knowing the group. `actorId` narrows the owner's question to
   * one person, as `heldRung` narrows it.
   */
  const visibleGroup = async (
    req: FastifyRequest,
    groupId: string,
    actorId?: string,
  ): Promise<{ group: Group; owner: boolean } | null> => {
    const group = await desk.group(groupId);
    if (!group || !isGroupLive(group)) return null;
    const claims = req.badge!.claims;
    if ((actorId === undefined || actorId === group.createdBy) && claimsActor(claims, group.createdBy)) {
      return { group, owner: true };
    }
    for (const row of await desk.grantsBySubject(groupSubject(groupId))) {
      if (isSpaceGrant(row)) {
        const space = await desk.space(row.spaceId);
        if (space && isSpaceLive(space) && (await heldRungOnSpace(desk, space, req.badge!)) !== null) {
          return { group, owner: false };
        }
      } else if (capabilityIn(req.badge!, row.canvasId) !== null) {
        return { group, owner: false };
      }
    }
    return null;
  };

  /** A group this badge may WRITE: its maker, narrowed to the acting actor.
   * 404 for one it may not see at all; 403 `not-owner`, naming the maker,
   * for one it sees through a row. */
  const ownedGroup = async (
    req: FastifyRequest,
    reply: FastifyReply,
    groupId: string,
    actorId: string | undefined,
  ): Promise<{ group: Group } | { refused: FastifyReply }> => {
    const seen = await visibleGroup(req, groupId, actorId);
    if (!seen) return { refused: groupNotFound(reply, groupId) };
    if (!seen.owner) {
      return {
        refused: reply.status(403).send({
          error:
            `ask ${await nameOf(seen.group.createdBy)}, who made the group ${seen.group.name} — only ` +
            "its maker can change who is in it",
          code: NOT_OWNER,
        }),
      };
    }
    return { group: seen.group };
  };

  /**
   * **Every canvas a group's rows reach** (roles design, "Adding and removing
   * a member both sweep"): a canvas row reaches its canvas, a space row
   * reaches the space's whole list, read from the live rows by subject.
   * De-duplicated, because a canvas can be named directly and through its
   * space.
   */
  const groupReach = async (groupId: string): Promise<string[]> => {
    const reached = new Set<string>();
    for (const row of await desk.grantsBySubject(groupSubject(groupId))) {
      if (isSpaceGrant(row)) {
        const space = await desk.space(row.spaceId);
        if (space && isSpaceLive(space)) for (const canvasId of space.canvasIds) reached.add(canvasId);
      } else {
        reached.add(row.canvasId);
      }
    }
    return [...reached];
  };

  /** A route's `:attribute`, as sent: the router decodes the path, and a
   * value that still carries an escape was encoded twice by a client. */
  const attributeParam = (raw: string): string => {
    try {
      return raw.includes("%") ? decodeURIComponent(raw) : raw;
    } catch {
      return raw;
    }
  };

  /**
   * The shape checks a grant body gets on a canvas and on a space alike:
   * `bars` is `true` or absent, the subject is one, the rung is one, and a
   * bar has no rung. One function, so the two POSTs cannot drift.
   */
  const badGrantBody = (body: Partial<CreateGrantRequest>): string | null => {
    if (body.bars !== undefined && body.bars !== true) {
      return "a bar is written as `bars: true`, or not at all";
    }
    const bars = body.bars === true;
    const refusal = bars ? barSubjectRefusal(body.subject) : grantSubjectRefusal(body.subject);
    if (refusal) return refusal;
    if (body.capability !== undefined && !isCapability(body.capability)) {
      return (
        `not a capability: ${String(body.capability)} (a grant admits to ` +
        `${RUNGS.map((rung) => `\`${rung}\``).join(", ")})`
      );
    }
    if (bars && body.capability !== undefined) {
      return "a bar has no rung — it keeps its subject out; drop `capability` or drop `bars`";
    }
    return null;
  };

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
    // On the query, not in a body: a DELETE with nothing to say sends no
    // content type (see `revokeGrant` in the web client), and the actor is
    // one id. `bar=1` rides the same way (`grantRevokeRoute` in core): revoke
    // and keep them out, in one request.
    const query = req.query as { actorId?: unknown; bar?: unknown };
    const actorId = await actingActor(req, query.actorId);
    const bar = query.bar === "1" || query.bar === "true";
    const home = options.homes?.for(id) ?? null;
    if (home) return home.revokeGrant(id, grantId, await actorNamed(actorId), bar);
    const snapshot = await engine.getSnapshot(id);
    // Read through this canvas's own rows, so a grant id belonging to another
    // canvas cannot be revoked through a canvas the caller happens to be in.
    const mine = (await desk.grantsFor(id)).find((g) => g.id === grantId);
    if (!mine) {
      return reply.status(404).send({ error: `no grant ${grantId} on ${id}`, code: "unknown-grant" });
    }
    // Revoking is a write to grants, and every write to grants is an owner's
    // (roles phase 2) — the link's off switch included.
    if (!atLeast(await heldRung(desk, snapshot.project, req.badge!, actorId ?? null), "own")) {
      return reply
        .status(403)
        .send({ error: notOwnerMessage(await ownerName(snapshot.project)), code: NOT_OWNER });
    }
    /**
     * **`?bar=1` — withdraw and keep them out** (roles design, "Withdrawing
     * versus barring"). Refused BEFORE anything is written when the bar
     * could not be: the link is never a bar's subject, a bar over a bar is
     * a second row saying the same thing, and the creator cannot be kept
     * out. A refusal here leaves the row exactly as it was, so the caller
     * can send the plain DELETE it meant.
     */
    if (bar) {
      const refusal = isBar(mine)
        ? `${grantId} is already a bar — revoking it lets them back in; there is nothing to keep out`
        : barSubjectRefusal(mine.subject);
      if (refusal) return reply.status(400).send({ error: refusal, code: "bad-grant" });
      if (await namesTheCreator(mine.subject, snapshot.project)) {
        return reply.status(400).send({
          error: await creatorRowRefusal(mine.subject, snapshot.project, true),
          code: "bad-grant",
        });
      }
    }
    const revoked = await desk.revokeGrant(grantId, new Date().toISOString(), req.badge!.badgeId);
    // The bar goes on the desk before the one sweep, for the replacement's
    // reason: the sweep re-runs the door, and the door has to meet the bar.
    const written = bar ? barRow(id, mine.subject, req.badge!.badgeId) : null;
    if (written) await desk.putGrant(written);
    // The creator rides along for the floor: turning the link off must not
    // expel the creator's own browser (roles journey 1, step 2).
    const swept = await sweepCanvas(desk, id, snapshot.project.createdBy.id, sweeps.report);
    /**
     * **What would still admit them**, read off the live rows AFTER the
     * revoke, so the dialog and the CLI can say *they can still enter by the
     * link* about the state that now obtains rather than the one that was.
     * `link` when the link is live and no live bar names the subject — which
     * is what a `?bar=1` just wrote, so that answer is absent by
     * construction. The link's own revocation asks nothing: the subject is
     * the link. Named `stillAdmittedBy` so roles phase 4 can add `space`.
     */
    const after = liveGrants(await desk.grantsFor(id));
    // The space's rows too (roles phase 4): a row on the space naming the
    // same subject means removing them here did not remove them, and the
    // remedy is the space's Share rather than a bar — said as `space`, which
    // wins over `link` because it is the more specific answer.
    const space = await desk.spaceOf(id);
    const onSpace = space ? liveGrants(await desk.grantsForSpace(space.id)) : [];
    const barred = [...after, ...onSpace].some((g) => isBar(g) && g.subject === mine.subject);
    const stillAdmittedBy =
      mine.subject === LINK || barred
        ? undefined
        : onSpace.some((g) => g.subject === mine.subject && !isBar(g))
          ? ("space" as const)
          : after.some((g) => g.subject === LINK && !isBar(g))
            ? ("link" as const)
            : undefined;
    return {
      grant: revoked ?? mine,
      swept,
      ...(written ? { bar: written } : {}),
      ...(stillAdmittedBy ? { stillAdmittedBy } : {}),
    } satisfies GrantResponse;
  });

  // ---- the space: a named set of canvases access is set on once (roles phase 4) ----
  //
  // All at the home. A space is desk state for a grant's reason — it is part
  // of what a grant means, and what a grant means does not travel — so a
  // REPLICA forwards every one of these through `homeScoped()` and refuses
  // on a mixed rig with the homes named (`refuseAmbiguousHome`), because a
  // space belongs to the home its creator made it at and this daemon holds
  // no row to answer from. Nothing here is canvas-scoped, so the door hook
  // has NOT asked about the caller: every route asks for itself, through
  // `heldRungOnSpace`, and a badge that may not see a space is told there is
  // none.

  /** The spaces this badge may see, each with its canvases — the canvas
   * list joins these to `GET /api/projects`, which does not change. */
  app.get(SPACES_ROUTE, async (req, reply) => {
    const stuck = refuseAmbiguousHome(reply, options.homes, "list spaces");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.spaces();
    // `spacesFor` is the bounded query; a bar on a space names the badge too,
    // and a space that only keeps you out is not one you may see.
    const spaces: Space[] = [];
    for (const space of await desk.spacesFor(req.badge!)) {
      if ((await heldRungOnSpace(desk, space, req.badge!)) !== null) spaces.push(space);
    }
    return { spaces } satisfies SpacesResponse;
  });

  /** Make one. Any actor may; the creator is the floor, and a space with no
   * rows is visible to nobody else, so this is a private act until it is
   * shared. The name is unique among the ones THIS actor owns. */
  app.post(SPACES_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<CreateSpaceRequest>;
    const refusal = spaceNameRefusal(body.name);
    if (refusal) return reply.status(400).send({ error: refusal, code: BAD_SPACE });
    const name = body.name!.trim();
    const stuck = refuseAmbiguousHome(reply, options.homes, "make a space");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.createSpace(name, await actorNamed(actorId));
    if (!actorId) {
      return reply.status(400).send({
        error:
          "a space needs a maker, and this badge did not say who — claim an actor first, or name " +
          "one of this badge's actors as `actorId`",
        code: BAD_SPACE,
      });
    }
    const mine = (await desk.spacesFor(req.badge!)).filter((space) => space.createdBy === actorId);
    const taken = mine.find((space) => sameSpaceName(space.name, name));
    if (taken) {
      return reply.status(409).send({
        error: `you already have a space called ${taken.name} (${taken.id}) — names are unique among the spaces you own`,
        code: SPACE_NAME_TAKEN,
      });
    }
    const space: Space = {
      id: newId("spc"),
      name,
      createdBy: actorId,
      canvasIds: [],
      at: new Date().toISOString(),
    };
    await desk.putSpace(space);
    return { space } satisfies SpaceResponse;
  });

  /**
   * Delete one: a tombstone, like a grant's. Every canvas stays where it was
   * with its own rows, and each is swept, because the space's rows stop
   * reaching it the moment `spaceOf` stops naming it. Idempotent: deleting a
   * deleted space answers with the tombstone and sweeps nothing.
   */
  app.delete(`${SPACES_ROUTE}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { actorId?: unknown };
    const stuck = refuseAmbiguousHome(reply, options.homes, "delete a space");
    if (stuck) return stuck;
    const actorId = await actingActor(req, query.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.deleteSpace(id, await actorNamed(actorId));
    const existing = await desk.space(id);
    if (!existing) return spaceNotFound(reply, id);
    if (!isSpaceLive(existing)) {
      // The tombstone's rows still say who may see it; an owner is told it
      // is already gone, a stranger that it is not here.
      const held = await heldRungOnSpace(desk, existing, req.badge!, actorId ?? null);
      if (held === null || !atLeast(held, "own")) return spaceNotFound(reply, id);
      return { space: existing, swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies SpaceCanvasResponse;
    }
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const gone: Space = { ...owned.space, deletedAt: new Date().toISOString() };
    await desk.putSpace(gone);
    const { expelled, rerooted, reached } = await sweepCanvases(desk, gone.canvasIds, creatorOf, sweeps.report);
    return { space: gone, swept: { expelled, rerooted }, reached } satisfies SpaceCanvasResponse;
  });

  /**
   * Add a canvas. `own` on BOTH: the space's, through `ownedSpace`, and the
   * canvas's, through the door and `heldRung` — this route is not
   * canvas-scoped, so the hook has not asked. Refused when the canvas is in
   * another space (`canvas-in-space`: a canvas is in at most one) or lives
   * at another home (a space holds only canvases whose home is this one).
   * The canvas keeps whatever rows it has and the space's apply from now,
   * which the sweep makes real for whoever is inside.
   */
  app.put(`${SPACES_ROUTE}/:id/canvases/:canvasId`, async (req, reply) => {
    const { id, canvasId } = req.params as { id: string; canvasId: string };
    const body = (req.body ?? {}) as Partial<SpaceCanvasRequest>;
    const stuck = refuseAmbiguousHome(reply, options.homes, "move a canvas into a space");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.addToSpace(id, canvasId, await actorNamed(actorId));
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const elsewhere = options.homes?.homeOf(canvasId) ?? null;
    if (elsewhere !== null) {
      return reply.status(400).send({
        error:
          `${canvasId} lives at ${elsewhere}, and a space holds only canvases whose home is ` +
          "this one — make the space there",
        code: BAD_SPACE,
      });
    }
    const snapshot = await engine.getSnapshot(canvasId); // 404 for a canvas that is not here
    await admit(req, canvasId); // the door, since the hook did not ask
    if (!atLeast(await heldRung(desk, snapshot.project, req.badge!, actorId ?? null), "own")) {
      return reply
        .status(403)
        .send({ error: notOwnerMessage(await ownerName(snapshot.project)), code: NOT_OWNER });
    }
    const current = await desk.spaceOf(canvasId);
    if (current && current.id !== owned.space.id) {
      return reply.status(409).send({
        error:
          `${snapshot.project.title} is already in the space ${current.name} (${current.id}) — a canvas ` +
          "is in at most one space; remove it there first",
        code: CANVAS_IN_SPACE,
      });
    }
    if (current) {
      // Already here: the gesture is "this canvas is in the space", and it is.
      return { space: owned.space, swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies SpaceCanvasResponse;
    }
    const next: Space = { ...owned.space, canvasIds: [...owned.space.canvasIds, canvasId] };
    await desk.putSpace(next);
    const swept = await sweepCanvas(desk, canvasId, snapshot.project.createdBy.id, sweeps.report);
    return { space: next, swept, reached: 1 } satisfies SpaceCanvasResponse;
  });

  /** Remove a canvas: `own` on the space; the canvas keeps its own rows and
   * is swept, so whoever was inside on the space's rows is put out or
   * re-rooted onto a row of the canvas's own. Idempotent. */
  app.delete(`${SPACES_ROUTE}/:id/canvases/:canvasId`, async (req, reply) => {
    const { id, canvasId } = req.params as { id: string; canvasId: string };
    const query = req.query as { actorId?: unknown };
    const stuck = refuseAmbiguousHome(reply, options.homes, "move a canvas out of a space");
    if (stuck) return stuck;
    const actorId = await actingActor(req, query.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.removeFromSpace(id, canvasId, await actorNamed(actorId));
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    if (!owned.space.canvasIds.includes(canvasId)) {
      return { space: owned.space, swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies SpaceCanvasResponse;
    }
    const next: Space = {
      ...owned.space,
      canvasIds: owned.space.canvasIds.filter((held) => held !== canvasId),
    };
    await desk.putSpace(next);
    const swept = await sweepCanvas(desk, canvasId, await creatorOf(canvasId), sweeps.report);
    return { space: next, swept, reached: 1 } satisfies SpaceCanvasResponse;
  });

  // The grants routes, scoped to the space. Reads for anybody who may see
  // it; writes for `own` on it; every write sweeps every canvas in it, and
  // the count reached rides back beside the sum.

  app.get(`${SPACES_ROUTE}/:id/grants`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stuck = refuseAmbiguousHome(reply, options.homes, "read a space's grants");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.spaceGrants(id);
    const space = await visibleSpace(req, id);
    if (!space) return spaceNotFound(reply, id);
    return { grants: liveGrants(await desk.grantsForSpace(id)) } satisfies GrantsResponse;
  });

  /**
   * Share the space. The canvas POST's rules, one scope wider, with one
   * refusal of its own: **`link` is not a space subject.** A space has no
   * address, so a link row on it would admit nobody and mean nothing;
   * **Every canvas in this space** (`POST …/link`) is what sets each canvas's
   * link. The space creator's own address is refused as redundant, like the
   * canvas creator's.
   */
  app.post(`${SPACES_ROUTE}/:id/grants`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<CreateGrantRequest>;
    const shape = badGrantBody(body);
    if (shape) return reply.status(400).send({ error: shape, code: "bad-grant" });
    const bars = body.bars === true;
    const subject = normalizeSubject(body.subject!);
    if (subject === LINK) {
      return reply.status(400).send({
        error:
          "a space has no address, so it has no link row — set every canvas's link at once " +
          "with `POST /api/spaces/:id/link` (`isocan share --space <name> --link …`)",
        code: BAD_SPACE,
      });
    }
    const capability: Capability = body.capability ?? "edit";
    const stuck = refuseAmbiguousHome(reply, options.homes, "share a space");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.createSpaceGrant(id, subject, capability, await actorNamed(actorId), bars);
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const space = owned.space;
    const live = liveGrants(await desk.grantsForSpace(id)).find((g) => g.subject === subject);
    if (live && isBar(live) === bars && (bars || capabilityOf(live) === capability)) {
      return { grant: live } satisfies GrantResponse;
    }
    if (await namesTheCreator(subject, { createdBy: { id: space.createdBy } })) {
      return reply.status(400).send({
        error:
          `${subject} is ${await nameOf(space.createdBy)}'s own address, and they made this space — ` +
          (bars ? "the creator cannot be kept out" : "the creator owns it without a row"),
        code: "bad-grant",
      });
    }
    const unverifiable = attesterRefusal(subject, attesters);
    if (unverifiable) return reply.status(400).send({ error: unverifiable, code: NO_ATTESTER });
    const groupId = groupIdOf(subject);
    if (groupId !== null && !(await liveGroup(groupId))) return groupNotFound(reply, groupId);
    const grant: Grant = {
      id: newId("gnt"),
      spaceId: id,
      subject,
      grantedBy: req.badge!.badgeId,
      at: new Date().toISOString(),
      ...(bars ? { bars: true as const } : narrowed(capability) ? { capability } : {}),
    };
    if (live) await desk.revokeGrant(live.id, new Date().toISOString(), req.badge!.badgeId);
    await desk.putGrant(grant);
    // Always swept, replacement or not: a new row on a space can RAISE people
    // already inside its canvases on a lower row, and the sweep is what
    // reaches their open sockets (journey 4, step 6).
    const { expelled, rerooted, reached } = await sweepSpace(desk, id, creatorOf, sweeps.report);
    return { grant, swept: { expelled, rerooted }, reached } satisfies GrantResponse;
  });

  /** Revoke one, `?bar=1` included — the canvas DELETE's rules, scoped to
   * the space, with the sweep over every canvas in it. No `stillAdmittedBy`:
   * a space has no link, and what its canvases' own rows would still admit is
   * each canvas's answer. */
  app.delete(`${SPACES_ROUTE}/:id/grants/:grantId`, async (req, reply) => {
    const { id, grantId } = req.params as { id: string; grantId: string };
    const query = req.query as { actorId?: unknown; bar?: unknown };
    const bar = query.bar === "1" || query.bar === "true";
    const stuck = refuseAmbiguousHome(reply, options.homes, "revoke a space's grant");
    if (stuck) return stuck;
    const actorId = await actingActor(req, query.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.revokeSpaceGrant(id, grantId, await actorNamed(actorId), bar);
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const mine = (await desk.grantsForSpace(id)).find((g) => g.id === grantId);
    if (!mine) {
      return reply.status(404).send({ error: `no grant ${grantId} on space ${id}`, code: "unknown-grant" });
    }
    if (bar) {
      const refusal = isBar(mine)
        ? `${grantId} is already a bar — revoking it lets them back in; there is nothing to keep out`
        : barSubjectRefusal(mine.subject);
      if (refusal) return reply.status(400).send({ error: refusal, code: "bad-grant" });
      if (await namesTheCreator(mine.subject, { createdBy: { id: owned.space.createdBy } })) {
        return reply.status(400).send({
          error: `${mine.subject} is the space creator's own address — the creator cannot be kept out`,
          code: "bad-grant",
        });
      }
    }
    const revoked = await desk.revokeGrant(grantId, new Date().toISOString(), req.badge!.badgeId);
    const written: Grant | null = bar
      ? {
          id: newId("gnt"),
          spaceId: id,
          subject: mine.subject,
          grantedBy: req.badge!.badgeId,
          at: new Date().toISOString(),
          bars: true,
        }
      : null;
    if (written) await desk.putGrant(written);
    const { expelled, rerooted, reached } = await sweepSpace(desk, id, creatorOf, sweeps.report);
    return {
      grant: revoked ?? mine,
      swept: { expelled, rerooted },
      reached,
      ...(written ? { bar: written } : {}),
    } satisfies GrantResponse;
  });

  /**
   * **Every canvas in this space** (roles journey 4, step 4). The floor is
   * not the ceiling: a canvas's own rows can only add to what the space
   * gives, so "turn the link off for the space" cannot be one row on the
   * space — it is the per-canvas link row written or revoked on every canvas
   * in a loop, each followed by that canvas's sweep, and the answer says how
   * many canvases it reached and how many it changed. Each canvas's own
   * link can be set again afterwards, which is journey 5.
   */
  app.post(`${SPACES_ROUTE}/:id/link`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Partial<SpaceLinkRequest>;
    const want = typeof body.capability === "string" ? body.capability.toLowerCase() : "";
    const capability: Capability | "off" | null =
      want === "off" ? "off" : isCapability(want) && want !== "own" ? want : null;
    if (capability === null) {
      return reply.status(400).send({
        error: "the every-canvas link takes `edit`, `read`, `view` or `off` — never `own`",
        code: BAD_SPACE,
      });
    }
    const stuck = refuseAmbiguousHome(reply, options.homes, "set a space's links");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.setSpaceLink(id, capability, await actorNamed(actorId));
    const owned = await ownedSpace(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const now = new Date().toISOString();
    let changed = 0;
    let expelled = 0;
    let rerooted = 0;
    for (const canvasId of owned.space.canvasIds) {
      const live = liveGrants(await desk.grantsFor(canvasId)).find((g) => g.subject === LINK);
      if (capability === "off") {
        if (!live) continue;
        await desk.revokeGrant(live.id, now, req.badge!.badgeId);
      } else {
        if (live && capabilityOf(live) === capability) continue;
        if (live) await desk.revokeGrant(live.id, now, req.badge!.badgeId);
        await desk.putGrant({
          id: newId("gnt"),
          canvasId,
          subject: LINK,
          grantedBy: req.badge!.badgeId,
          at: now,
          ...(narrowed(capability) ? { capability } : {}),
        });
      }
      changed += 1;
      const swept = await sweepCanvas(desk, canvasId, await creatorOf(canvasId), sweeps.report);
      expelled += swept.expelled;
      rerooted += swept.rerooted;
    }
    return {
      reached: owned.space.canvasIds.length,
      changed,
      canvasIds: [...owned.space.canvasIds],
      swept: { expelled, rerooted },
    } satisfies SpaceLinkResponse;
  });

  // ---- the group: a named set of people access is given to once (roles phase 5) ----
  //
  // All at the home, for the space's reason: a group is part of what a grant
  // means. A REPLICA forwards through `homeScoped()`. Membership is read at
  // the door and copied nowhere, so a member added or removed is one write
  // here followed by a sweep of every canvas every live row on the group
  // reaches — the same sweep a revoked link runs (journey 6).

  /** The groups this badge's actors made, members and all — the owner's
   * list. A group somebody is merely in is not listed; they meet it as a
   * row's name and size on the canvases it opens. */
  app.get(GROUPS_ROUTE, async (req, reply) => {
    const stuck = refuseAmbiguousHome(reply, options.homes, "list groups");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.groups();
    const groups = (await desk.groupsFor(req.badge!)).map((group) => groupViewOf(group, true));
    return { groups } satisfies GroupsResponse;
  });

  /** Make one. Any actor may; the maker is the floor. The name is unique
   * among the groups THIS actor owns. */
  app.post(GROUPS_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<CreateGroupRequest>;
    const refusal = groupNameRefusal(body.name);
    if (refusal) return reply.status(400).send({ error: refusal, code: BAD_GROUP });
    const name = body.name!.trim();
    const stuck = refuseAmbiguousHome(reply, options.homes, "make a group");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.createGroup(name, await actorNamed(actorId));
    if (!actorId) {
      return reply.status(400).send({
        error:
          "a group needs a maker, and this badge did not say who — claim an actor first, or name " +
          "one of this badge's actors as `actorId`",
        code: BAD_GROUP,
      });
    }
    const mine = (await desk.groupsFor(req.badge!)).filter((group) => group.createdBy === actorId);
    const taken = mine.find((group) => sameGroupName(group.name, name));
    if (taken) {
      return reply.status(409).send({
        error: `you already have a group called ${taken.name} (${taken.id}) — names are unique among the groups you own`,
        code: GROUP_NAME_TAKEN,
      });
    }
    const group: Group = {
      id: newId("ppl"),
      name,
      createdBy: actorId,
      members: [],
      at: new Date().toISOString(),
    };
    await desk.putGroup(group);
    return { group: groupViewOf(group, true) } satisfies GroupResponse;
  });

  /** One group: whole for its maker; name and size for somebody a live row
   * naming it lets see it; not found for everybody else. */
  app.get(`${GROUPS_ROUTE}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const stuck = refuseAmbiguousHome(reply, options.homes, "read a group");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.group(id);
    const seen = await visibleGroup(req, id);
    if (!seen) return groupNotFound(reply, id);
    return { group: groupViewOf(seen.group, seen.owner) } satisfies GroupResponse;
  });

  /**
   * Add a member. The attribute is normalized the way a grant's subject is
   * (`email:` lowercased), because the door compares it against a badge's
   * attestations by equality. Then the sweep, for journey 2's reason: a
   * change reaches an open socket — somebody already inside at `read` on a
   * canvas row is raised by it, and somebody not inside is admitted at the
   * door when they arrive. Idempotent: adding a member twice is one member.
   */
  app.put(`${GROUPS_ROUTE}/:id/members/:attribute`, async (req, reply) => {
    const { id, attribute: raw } = req.params as { id: string; attribute: string };
    const body = (req.body ?? {}) as Partial<GroupMemberRequest>;
    const attribute = attributeParam(raw);
    const refusal = groupMemberRefusal(attribute);
    if (refusal) return reply.status(400).send({ error: refusal, code: BAD_GROUP });
    const stuck = refuseAmbiguousHome(reply, options.homes, "add somebody to a group");
    if (stuck) return stuck;
    const actorId = await actingActor(req, body.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.addGroupMember(id, attribute, await actorNamed(actorId));
    const owned = await ownedGroup(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const member = normalizeAttribute(attribute);
    if (owned.group.members.includes(member)) {
      return { group: groupViewOf(owned.group, true), swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies GroupResponse;
    }
    const next: Group = { ...owned.group, members: [...owned.group.members, member] };
    await desk.putGroup(next);
    const { expelled, rerooted, reached } = await sweepCanvases(desk, await groupReach(id), creatorOf, sweeps.report);
    return { group: groupViewOf(next, true), swept: { expelled, rerooted }, reached } satisfies GroupResponse;
  });

  /** Remove a member: one write, then the sweep that puts them out of every
   * canvas the group's rows reach — and their agents with them, since a pass
   * root adopts its minter's outcome. Idempotent. */
  app.delete(`${GROUPS_ROUTE}/:id/members/:attribute`, async (req, reply) => {
    const { id, attribute: raw } = req.params as { id: string; attribute: string };
    const query = req.query as { actorId?: unknown };
    const attribute = attributeParam(raw);
    const stuck = refuseAmbiguousHome(reply, options.homes, "remove somebody from a group");
    if (stuck) return stuck;
    const actorId = await actingActor(req, query.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.removeGroupMember(id, attribute, await actorNamed(actorId));
    const owned = await ownedGroup(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const member = normalizeAttribute(attribute);
    if (!owned.group.members.includes(member)) {
      return { group: groupViewOf(owned.group, true), swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies GroupResponse;
    }
    const next: Group = { ...owned.group, members: owned.group.members.filter((held) => held !== member) };
    await desk.putGroup(next);
    const { expelled, rerooted, reached } = await sweepCanvases(desk, await groupReach(id), creatorOf, sweeps.report);
    return { group: groupViewOf(next, true), swept: { expelled, rerooted }, reached } satisfies GroupResponse;
  });

  /** Delete one: a tombstone. Its rows stay and stop admitting — the door
   * skips a deleted group — and the sweep puts out whoever was inside on
   * them. Idempotent for its maker; not there for anybody else. */
  app.delete(`${GROUPS_ROUTE}/:id`, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { actorId?: unknown };
    const stuck = refuseAmbiguousHome(reply, options.homes, "delete a group");
    if (stuck) return stuck;
    const actorId = await actingActor(req, query.actorId);
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.deleteGroup(id, await actorNamed(actorId));
    const existing = await desk.group(id);
    if (!existing) return groupNotFound(reply, id);
    if (!isGroupLive(existing)) {
      const owner =
        (actorId === undefined || actorId === existing.createdBy) && claimsActor(req.badge!.claims, existing.createdBy);
      if (!owner) return groupNotFound(reply, id);
      return { group: groupViewOf(existing, true), swept: { expelled: 0, rerooted: 0 }, reached: 0 } satisfies GroupResponse;
    }
    const owned = await ownedGroup(req, reply, id, actorId);
    if ("refused" in owned) return owned.refused;
    const gone: Group = { ...owned.group, deletedAt: new Date().toISOString() };
    await desk.putGroup(gone);
    const { expelled, rerooted, reached } = await sweepCanvases(desk, await groupReach(id), creatorOf, sweeps.report);
    return { group: groupViewOf(gone, true), swept: { expelled, rerooted }, reached } satisfies GroupResponse;
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
  app.get(BADGES_ROUTE, async (req, reply) => {
    const stuck = refuseAmbiguousHome(reply, options.homes, "list your surfaces");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.badges();
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
    const stuck = refuseAmbiguousHome(reply, options.homes, "end a badge");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.killBadge(badgeId);
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
    const outcome = await killAndSweep(
      desk,
      badgeId,
      req.badge!.badgeId,
      undefined,
      (canvasId) =>
        engine.getSnapshot(canvasId).then(
          (snapshot) => snapshot.project.createdBy.id,
          () => null,
        ),
      sweeps.report,
    );
    if (!outcome) {
      return reply
        .status(404)
        .send({ error: `${badgeId} is already ended`, code: "unknown-badge" });
    }
    return { killed: target, swept: outcome.swept } satisfies KillBadgeResponse;
  });

  // ---- attestations: what this holder has PROVED (identity desk, mech 3+6) ----
  //
  // **Borrow, never mint, as two verbs on one path.** `GET` says what this
  // home can verify, hands the browser what it needs to start a sign-in, and
  // reports what this badge has already proved and who that lets it be; `POST`
  // takes a token from the attester the `GET` named and writes the row.
  //
  // NOT canvas-scoped, and that is load-bearing rather than tidy: a badge
  // that is not admitted anywhere must still be able to prove its address,
  // because proving it is HOW it comes to be admitted. A canvas-scoped path
  // would be refused by the door hook before the handler could look at the
  // token — the same trap `POST /api/passes/redeem` had to step around, for
  // the same reason.
  //
  // **On a REPLICA both forward.** An attestation rides the badge, a badge at
  // the home is a different badge from the one at the laptop, and the door
  // that reads attestations is the home's. A laptop that wrote the row into
  // its own desk would have proved something to the only party that was
  // already trusting it, while the home went on refusing.

  app.get(ATTEST_ROUTE, async (req, reply) => {
    // Refused on an ambiguous rig like the POST beside it, and for the half of
    // this answer people forget it carries: not just "what can be verified"
    // but "what has this badge already proved", which is a fact about one
    // home's desk. Its caller is a dialog a person opened on purpose, and it
    // already renders the refusal it is handed — so this arrives as a sentence
    // in the dialog rather than a broken page load.
    const stuck = refuseAmbiguousHome(reply, options.homes, "ask what you have proved");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.attestOffer();
    return {
      attesters,
      auth,
      attestations: req.badge!.attestations ?? [],
      resumable: (await engine.resumable(req.badge!.badgeId)).map((row) => row.actor),
    } satisfies AttestOffer;
  });

  /**
   * **Verify a token, decorate the badge.** The whole of "borrowing an
   * attester", and the four lines it takes are worth reading in order.
   *
   * Nothing here creates an account, because isocan does not have any. The
   * badge the caller already carries gains one row. A holder that never signs
   * in is unaffected in every particular.
   *
   * The address is read out of the VERIFIED token and never out of the
   * request, which is why `AttestRequest` has no email field: a body that said
   * which mailbox to attest would be the caller attesting for itself with a
   * signature stapled on.
   *
   * The refusal when this home has borrowed nothing is deliberately the same
   * fact the Share dialog is told, from the other side. A home with no
   * attester answering "sure" to a token would be the cheerful wrong address
   * this codebase keeps meeting: the row would be written, the door would
   * never read it, and nobody could say why.
   */
  app.post(ATTEST_ROUTE, async (req, reply) => {
    const stuck = refuseAmbiguousHome(reply, options.homes, "write an attestation");
    if (stuck) return stuck;
    const home = options.homes?.homeScoped() ?? null;
    if (home) return home.attest((req.body ?? {}) as AttestRequest);
    if (!auth) {
      return reply.status(400).send({
        error:
          "this home has borrowed no attester, so there is nothing here to verify a sign-in " +
          "against. Sharing works by link; see docs/projects/multiuser/identity-desk.md.",
        code: NO_ATTESTER,
      });
    }
    const body = (req.body ?? {}) as Partial<AttestRequest>;
    const idToken = typeof body.idToken === "string" ? body.idToken : "";
    // No special case for an empty token: `verifyIdToken` refuses it as "not a
    // JWT", which is what it is, in the same voice as every other refusal.
    const attestation = await verifyIdToken(idToken, auth, await signingKeys());
    await desk.attest(req.badge!.badgeId, attestation);
    // Read back through the desk rather than assumed: the answer a surface
    // renders is what was WRITTEN, which is the discipline the sweep report
    // and the grant response both take.
    return {
      attestation,
      resumable: (await engine.resumable(req.badge!.badgeId)).map((row) => row.actor),
    } satisfies AttestResponse;
  });

  // ---- passes: what an admitted badge hands an unadmitted one (Scene 5) ----
  //
  // Two routes with deliberately different shapes, and the asymmetry is the
  // design rather than an accident of naming.
  //
  // **Minting is canvas-scoped** (`/api/projects/:id/passes`), the same
  // argument the three grant routes are written on: the `onRequest` hook has
  // already asked the door about this caller for anything under
  // `/api/projects/:id/`, so "only an admitted badge may mint a pass for this
  // canvas" costs nothing per-route and cannot be forgotten by a later edit.
  // The canvas comes from the address, so a pass is about the room the asker
  // was standing in rather than one it named in a body.
  //
  // **Redeeming is not** (`/api/passes/redeem`), and it cannot be: the whole
  // point of the redeemer is that it is NOT admitted to that canvas yet, so a
  // canvas-scoped path would be refused by the door hook before the handler
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
    // THIS canvas's home: a pass admits to one canvas, and single-use is only
    // a property of the desk that holds the row.
    const home = options.homes?.for(id) ?? null;
    if (home) {
      // The name rides up with the actor so the home can vouch for an actor it
      // has never heard of — `HomeLink.mintPass` claims before it asks, and
      // `reincarnate` refuses an unknown `as` with no name to go on.
      const names = actorId ? await engine.actorNames() : {};
      return home.mintPass(
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
  app.post(PASS_REDEEM_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<RedeemPassRequest>;
    // No special case for a missing token: `redeemPass` parses it, and an
    // empty string is not a pass in exactly the way a mangled one is not.
    const token = typeof body.token === "string" ? body.token : "";
    const badge = req.badge!;
    /**
     * **Which desk holds this pass's row.**
     *
     * `home` when the caller named one, because a pass is never handed over
     * alone — it arrives as `address#pass`, so the caller that has the token
     * has the address too (see `RedeemPassRequest.home`). This is the one act
     * `homeScoped` used to swallow that has a right answer, and presenting a
     * credential at the wrong desk reports a valid pass as invalid.
     *
     * **Never this daemon's own address**, or a daemon asked to redeem a pass
     * minted at itself would open a link to itself and become its own
     * replica. The CLI already declines to send its own base; this is the
     * server refusing to be talked into it by anybody else, which it can do
     * because `Host` is the one address a request always carries.
     *
     * Absent — every caller older than the field, and the browser at a home —
     * falls back to `homeScoped`, whose seam is named where it lives.
     */
    const asked = typeof body.home === "string" ? body.home.trim() : "";
    const askedHost = asked === "" ? null : hostOf(asked);
    const self = askedHost !== null && askedHost === String(req.headers.host ?? "");
    if (asked === "") {
      // Only when the caller named nothing: an address in the request IS the
      // answer, so a pass pasted with its address is never ambiguous. This is
      // the older caller, and the browser at a home.
      const stuck = refuseAmbiguousHome(reply, options.homes, "redeem a pass");
      if (stuck) return stuck;
    }
    const home =
      asked !== "" && !self
        ? (options.homes?.linkFor(normalizeHomeUrl(asked)) ?? null)
        : (options.homes?.homeScoped() ?? null);
    if (home) {
      const answer = await home.redeemPass(token);
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
   *
   * **Phase 10.3 made the address part of the request, and narrowed the
   * refusal to match.** The good case — the one the phase exists for — is a
   * marker naming a home this daemon has never dialled: a repo cloned onto a
   * second machine whose `.isocan/project.json` says the canvas lives at dev.
   * That used to be refused outright ("this daemon answers to X and that
   * canvas lives at Y"), because a daemon had one home and joining meant
   * re-pointing the whole machine. It does not any more: a new link is opened,
   * the badge comes from `identity.json`'s `auth` block or is knocked for, the
   * home runs its own door test, and the row is written. Nothing else on this
   * machine moves.
   *
   * So the refusal is now only about having nowhere at all to ask: no address
   * named AND no birth default. A door that refuses passes its own status and
   * code back untouched, as it always did.
   */
  app.post(HOME_JOIN_ROUTE, async (req, reply) => {
    const body = (req.body ?? {}) as Partial<JoinCanvasRequest>;
    const canvasId = typeof body.canvasId === "string" ? body.canvasId.trim() : "";
    if (!canvasId) {
      return reply.status(400).send({ error: "canvasId is required", code: "bad-request" });
    }
    const named = typeof body.home === "string" && body.home.trim() ? body.home.trim() : null;
    const address = named ?? options.birthHome ?? null;
    if (!address || !options.homes) {
      return reply.status(409).send({
        error:
          "no home was named and this daemon has no birth default, so there is nowhere to " +
          "fetch a canvas from. Say which home (the canvas's marker carries the address), " +
          "or `isocan home <url>` to set where canvases born here go.",
        code: "not-a-replica",
      });
    }
    const home = options.homes.linkFor(address);
    let canvas: Canvas;
    try {
      canvas = await home.join(canvasId);
    } catch (err) {
      // A link opened for a join that failed has nothing to do and nobody to
      // answer; leaving it polling would be a socket and a timer per typo'd
      // address, forever.
      await options.homes.dropIfUnused(address);
      throw err;
    }
    // The row is written only once the home has said yes. A join that the door
    // refused must leave nothing behind: a row naming a home that will not have
    // this machine would send every later write to a 403, and the CLI would
    // have to un-write it — which is the CLI writing `homes.json`, which is
    // exactly what ruling 1 forbids.
    await options.homes.bind(canvasId, address);
    return { canvas } satisfies JoinCanvasResponse;
  });

  app.get("/api/projects/:id/canvas", async (req) => {
    const { id } = req.params as { id: string };
    // No `admit` here any more: the hook took the door's test on the way in,
    // for this route and every other one shaped like it.
    const snapshot = await engine.getSnapshot(id);
    // The one fact about the READER that rides on the read (#88): a client
    // whose admission is not edit learns its rung here, with the canvas,
    // instead of discovering it as a refusal per gesture. Absent means edit,
    // so a pre-capability client parsing this response sees nothing new.
    const held = req.badge ? capabilityIn(req.badge, id) : null;
    if (held !== null && narrowed(held)) {
      return { ...snapshot, capability: held };
    }
    return snapshot;
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
        const unsubscribe = engine.onEvent((canvasId, message) => {
          if (canvasId === id && message.type === "op-applied") done();
        });
        req.raw.on("close", done);
      });
      entries = await engine.getLog(id, sinceSeq);
    }
    return entries;
  });

  /**
   * The oplog behind the oplog: what `gc` archived. A separate route rather
   * than a flag on the live one because the live route long-polls a moving
   * cursor and this reads a record that only ever grows at compaction time —
   * two access patterns, two handlers. Admission is the `onRequest` hook's,
   * like every canvas-scoped route.
   */
  app.get("/api/projects/:id/oplog/archive", async (req) => {
    const { id } = req.params as { id: string };
    return engine.getArchivedLog(id);
  });

  /**
   * The whole home's oplog, one cursor per canvas — what `isocan wait`
   * listens on. An on-call agent hears canvases it has never opened, so the
   * long poll must be woken by ANY canvas's op, and a canvas born while it
   * waits is streamed from its first entry.
   *
   * **Home-wide, and no longer a leak** (roles phase 1). "Canvases it has
   * never opened" is still the feature — a parked agent must hear a canvas
   * it was summoned to — and at a multi-tenant home that sentence used to
   * read as "hears everybody's": this route checked no admission at all, so
   * any badge on the home could read any canvas's oplog. It now runs the
   * same per-canvas door test as the listing above, per canvas in its list:
   * a canvas the badge is admitted to, or that a live row would admit it to,
   * is reported; any other is simply not in the answer. A summoned agent on
   * a canvas whose link is on still hears it, because the link is the row
   * that admits it. Nothing is written — hearing about a room is not
   * entering it, the same rule the listing keeps.
   */
  app.post("/api/oplog/watch", async (req) => {
    const body = (req.body ?? {}) as import("@isocan/core").WatchLogRequest;
    const { cursors } = body;
    const only = body.only ? new Set(body.only) : null;
    const badge = req.badge!;
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const judged = new Map<string, boolean>();
    const mayHear = async (canvas: Canvas): Promise<boolean> => {
      const known = judged.get(canvas.id);
      if (known !== undefined) return known;
      const allowed =
        admitted.has(canvas.id) ||
        Boolean(await admittingGrant(desk, canvas.id, badge, canvas.createdBy.id));
      judged.set(canvas.id, allowed);
      /**
       * **An expelled badge's next poll is refused, and told why** (roles
       * design, "Reaching an open socket"). A badge that was swept out of a
       * canvas it asked for by name is not quietly answered with nothing —
       * that is a parked agent hearing silence forever — but refused with
       * `not-admitted` and the reason `withdrawn`, which `isocan wait`
       * prints and exits on. Only for a canvas the caller NAMED: a home-wide
       * watch is not ended by one room. A badge admitted again is forgotten.
       */
      if (allowed) sweeps.forget(badge.badgeId, canvas.id);
      else if (only?.has(canvas.id) && sweeps.withdrew(badge.badgeId, canvas.id)) {
        throw new NotAdmittedError(canvas.id, WITHDRAWN);
      }
      return allowed;
    };

    const collect = async (): Promise<import("@isocan/core").WatchLogResponse> => {
      const entries: import("@isocan/core").WatchedLogEntry[] = [];
      const next: Record<string, number> = {};
      for (const canvas of await engine.listCanvases()) {
        if (only && !only.has(canvas.id)) continue;
        if (!(await mayHear(canvas))) continue;
        const since = cursors?.[canvas.id] ?? 0;
        // Seeding (no cursors at all) means "from now on" — tips, no entries.
        const log = cursors ? await engine.getLog(canvas.id, since) : [];
        const lastSeq = cursors
          ? (log[log.length - 1]?.seq ?? since)
          : (await engine.getSnapshot(canvas.id)).lastSeq;
        for (const entry of log) {
          entries.push({ ...entry, canvasId: canvas.id, canvasTitle: canvas.title });
        }
        next[canvas.id] = lastSeq;
      }
      entries.sort((a, b) => a.envelope.ts.localeCompare(b.envelope.ts) || a.seq - b.seq);
      return { entries, cursors: next };
    };

    // Subscribe BEFORE the first sweep: scanning every canvas takes long
    // enough that an op could land behind the reader and be missed until the
    // window closed. Sweeping many canvases is not atomic; this is.
    let landed = false;
    let wake: (() => void) | null = null;
    const unsubscribe = engine.onEvent((canvasId, message) => {
      if (message.type !== "op-applied") return;
      if (only && !only.has(canvasId)) return; // another canvas is not our business
      landed = true;
      wake?.();
    });
    // And on this badge's own expulsion from a canvas it named: the parked
    // agent is told within the sweep, not at the end of its poll window.
    // The wake runs `collect`, which is where the refusal is raised.
    const unsubscribeSweeps = sweeps.on((canvasId, badgeId, outcome) => {
      if (badgeId !== badge.badgeId || outcome.outcome !== "expelled") return;
      if (!only?.has(canvasId)) return;
      // The answer this request memoised for that canvas is now stale, and
      // so is the admission it read at the door; the re-run must ask again.
      judged.delete(canvasId);
      admitted.delete(canvasId);
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
      unsubscribeSweeps();
    }
  });

  // ---- the durable park cursor (on-demand phase 1) ----
  //
  // Three verbs on one row per actor per canvas — claim (adopt + read),
  // delivered (record a wake's high-water), advance (settle a quiet lap).
  // The state machine and the custody argument live in park.ts; what lives
  // here is only the wiring: the engine supplies "now" for a first park and
  // the completion evidence (did the actor author anything after the
  // delivery — the reply is the proof). Like the watch route these take the
  // canvas in the body, and like it they trust the caller about who they
  // park as — the same local-daemon posture, to be revisited with the same
  // multi-tenant narrowing the watch route's comment records.

  app.post("/api/park/claim", async (req, reply) => {
    const park = options.park;
    if (!park) return reply.code(501).send({ error: "this daemon holds no park cursors" });
    const body = req.body as import("@isocan/core").ParkClaimRequest;
    const claim = await park.claim(body.canvasId, body.actorId, {
      since: body.since,
      seedAt: body.seedAt,
      seed: async () => (await engine.getSnapshot(body.canvasId)).lastSeq,
      actorSpoke: async (afterSeq) => {
        const entries = await engine.getLog(body.canvasId, afterSeq);
        return entries.some((entry) => entry.envelope.actor.id === body.actorId);
      },
    });
    return claim;
  });

  app.post("/api/park/delivered", async (req, reply) => {
    const park = options.park;
    if (!park) return reply.code(501).send({ error: "this daemon holds no park cursors" });
    const body = req.body as import("@isocan/core").ParkDeliveredRequest;
    if (await park.delivered(body.canvasId, body.actorId, body.parkId, body.tip)) {
      return { ok: true };
    }
    return reply.code(409).send({
      error: "another park adopted this actor's cursor — stand down, it is answering now",
      code: PARK_ADOPTED_CODE,
    });
  });

  app.post("/api/park/advance", async (req, reply) => {
    const park = options.park;
    if (!park) return reply.code(501).send({ error: "this daemon holds no park cursors" });
    const body = req.body as import("@isocan/core").ParkAdvanceRequest;
    if (await park.advance(body.canvasId, body.actorId, body.parkId, body.to)) {
      return { ok: true };
    }
    return reply.code(409).send({
      error: "another park adopted this actor's cursor — stand down, it is answering now",
      code: PARK_ADOPTED_CODE,
    });
  });

  /**
   * **Connection-bound rc liveness** (agents-on-demand phase 6). Journey 7
   * pinned the hard half: "answerable" is never claimed while the rc that
   * would answer is dead — no window, no TTL lie. So the fact is the
   * CONNECTION: an rc holds this request open, its agents are answerable
   * exactly while a hold is open, and a dead rc's socket closes instantly.
   * The rc re-issues the hold back-to-back; the microsecond gap between
   * holds can only err toward "not answerable", which is the direction
   * journey 7 permits. In-memory, per process, like presence — a registry
   * that survived its daemon would be the lie again with extra steps.
   *
   * The registry moved to `rc-holds.ts` (agent-custody): the same holds now
   * carry the web's enrol asks back to the rc, and their liveness relays up
   * the home-link the way faces do.
   */
  const rc = options.rc ?? new RcHolds();
  app.post("/api/rc/hold", async (req) => {
    const body = (req.body ?? {}) as { canvasId?: string; actorIds?: string[]; waitMs?: number };
    const canvasId = body.canvasId ?? "";
    const actorIds = new Set((body.actorIds ?? []).filter((a) => typeof a === "string"));
    const hold = rc.hold(canvasId, actorIds, Math.min(Number(body.waitMs) || 0, 55_000));
    req.raw.on("close", hold.release);
    const asks = await hold.done;
    return { ok: true, asks };
  });

  /** Who answers here if summoned — the union of every open hold's agents,
   * local and relayed — and `parked`, the Web UI's add-agent gate. */
  app.get("/api/projects/:id/rc", async (req) => {
    const { id } = req.params as { id: string };
    return rc.answering(id);
  });

  /**
   * **The web's add-agent ask** (agent-custody mechanism 2). Carries a NAME
   * to a parked rc, which mints the actor on the machine that answers for it
   * — the same two moves `isocan agent add` makes, so the desk needs no new
   * rule and the relayed face vouches. This route only finds the rc: an open
   * local hold, or the socket of the member daemon whose `rc-relay` says one
   * is parked behind it. The dialog learns the outcome the way everything
   * else does — the `agent.enroll` op lands, or its countdown says nothing
   * answered.
   */
  app.post("/api/projects/:id/agents/ask", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as RcAskRequest;
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 64) {
      return reply.code(400).send({ error: "an agent needs a name (at most 64 characters)" });
    }
    if (!body.from?.id || typeof body.from.name !== "string") {
      return reply.code(400).send({ error: "the ask must say who is asking (`from`)" });
    }
    // Mechanism 5, same as an op: the asker must be an actor this badge may
    // speak as — the rc narrates "<from> asked to add …", and those words
    // must not be puttable in someone else's mouth.
    try {
      await engine.requireActor(req.badge!.badgeId, body.from.id);
    } catch {
      return reply.code(403).send({ error: `this badge may not speak as ${body.from.id}` });
    }
    const ask = { askId: newId("ask"), name, from: body.from };
    if (!rc.ask(id, ask)) {
      return reply.code(409).send({
        error:
          "no `isocan rc` is parked on this canvas — someone with the project checked out runs one, and this gesture appears",
        code: NO_RC_CODE,
      });
    }
    return { ok: true, askId: ask.askId };
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
    await engine.getSnapshot(id); // 404 unknown canvases
    const body = req.body as import("@isocan/core").CreateSessionRequest;
    // A face is an assertion about who is here, so it is checked like an op.
    await engine.requireActor(req.badge!.badgeId, body.actor.id);
    // "rc" is a parked `isocan rc` announcing itself (phase 2.5) — a process
    // fact riding the presence plane; "web" cannot be asked for here, browser
    // sessions are born on the socket.
    const session = presence.createSession(id, body.actor, body.kind === "rc" ? "rc" : "cli", {
      ...(body.label !== undefined ? { label: body.label } : {}),
      ...(body.harness !== undefined ? { harness: body.harness } : {}),
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
    // A session under a folded id is listed as the person it was folded into
    // (multi-identity phase 5), so `isocan who` shows one Dimitri.
    return engine.resolveSessions(presence.roster(id));
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

  /**
   * **Do the bytes agree with the ops?** — and make them, when asked.
   *
   * Canvas-scoped, so the `onRequest` admission hook covers it: a badge can
   * only reconcile a canvas it was let into. Reading is the default and
   * writing is opt-in (`push`), because "tell me what is wrong" and "change
   * something" are different asks and a diagnostic that repairs by surprise
   * is not one.
   */
  app.post("/api/projects/:id/blobs/reconcile", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { push?: boolean };
    return engine.reconcileBlobs(id, { push: body.push === true });
  });

  /**
   * **Send this canvas to another home**, or say what that would move.
   *
   * The whole gesture is one call because the ORDER is the safety: bytes,
   * then the log, then the routing row. Split across three requests, a caller
   * that stopped halfway would leave a canvas whose bytes are in one place
   * and whose ops are in another, and no single request could tell.
   *
   * `dryRun` is not politeness. Moving a canvas is the kind of act people
   * want to see the shape of first, and a report costs one listing and one
   * log read.
   */
  app.post("/api/projects/:id/teleport", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { to?: string; dryRun?: boolean };
    if (typeof body.to !== "string" || body.to.trim() === "") {
      return { error: "teleport needs a home to send it to (`--to <url>`)", code: "bad-op" };
    }
    return engine.teleport(id, body.to.trim(), { dryRun: body.dryRun === true });
  });

  /**
   * **Receive a canvas whole** — the far end of a teleport.
   *
   * Creates, never merges: `Engine.adopt` refuses a canvas this home already
   * has, which is what keeps this narrow enough to expose. The entries are
   * written verbatim, seq and timestamp included, because a canvas replayed
   * through the ordinary write path would arrive correctly ordered and
   * entirely re-dated.
   */
  app.post("/api/projects/:id/adopt", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { entries?: LogEntry[] };
    if (!Array.isArray(body.entries)) {
      return { error: "adopt takes the canvas's entries", code: "bad-op" };
    }
    return engine.adopt(id, body.entries);
  });

  app.post("/api/projects/:id/gc", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as import("@isocan/core").GcRequest;
    return engine.gc(id, body);
  });

  /**
   * **Collect the whole home** — the same policy, over many canvases at once
   * (phase 13.7). One `Engine.gc` per canvas, unchanged; what is new here is
   * an enumerating caller, never a second policy.
   *
   * **The admission question, which is the whole of this route.** `/api/gc`
   * carries no canvas in its path, so `CANVAS_API_ROUTE` does not match it and
   * the `onRequest` hook's `canvasId ∈ admissions` check never fires. A route
   * that then swept `store.listCanvases()` would be a badge deleting bytes on
   * canvases it was never let into — the door held for every other route and
   * walked around by this one. So the list is the badge's own admissions,
   * intersected with what this daemon actually holds: **"collect the whole
   * home" means "collect everything I can reach"**, which on a local daemon
   * (one person, admitted to everything) is the whole home, and at a hosted
   * one is your own work and nothing else. There is no home-wide sweep for
   * anybody at the door, and there does not need to be: the home's own timer
   * collects the rest, from inside the process, where no badge is involved.
   *
   * **Admissions, not `admittingGrant`** — the narrow answer, where `GET
   * /api/projects` takes the wide one. The wide answer is right for a LISTING
   * because listing is not acting: telling a person that a link-granted canvas
   * exists costs nothing. This route deletes bytes and rewrites oplogs, and
   * "every canvas I could have entered" is not a set anybody meant to hand a
   * chore. An admission is written the moment its holder actually enters, so
   * the sweep follows where someone has been rather than where they might go.
   *
   * The intersection with the held list is not belt-and-braces: an admission
   * outlives the canvas it names (a delete does not walk every badge), and
   * `Engine.gc` on an id this daemon does not hold would throw — which
   * `gcCanvases` would faithfully report as a per-canvas error, turning every
   * sweep after any delete into a report full of red.
   */
  app.post(HOME_GC_ROUTE, async (req) => {
    const badge = req.badge!;
    const body = (req.body ?? {}) as import("@isocan/core").GcRequest;
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const held = (await engine.listCanvases()).filter((canvas) => admitted.has(canvas.id));
    return gcCanvases(engine, held.map((canvas) => canvas.id), body);
  });

  app.post("/api/projects/:id/blobs", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 for unknown canvases
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
   * re-asks `canvasId ∈ admissions` before a single byte is signed for —
   * which since phase 9 is true of the blob GET beside it as well.
   */
  app.post("/api/projects/:id/blobs/upload-url", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // 404 for unknown canvases
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

  /**
   * The bound directory, read-only — the workbench's file tree, and the ONE
   * seam where the product serves the real disk rather than the canvas.
   *
   * **Owner-scoped, and deliberately NOT the admissions door.** Every canvas
   * is born with a link grant; a tree behind that door would hand anyone
   * with the link a listing of the owner's working directory, `.env`
   * included (the workbench security review's hardest line). The gate is:
   * this daemon bound to loopback, the peer ON loopback, and the canvas
   * living HERE — which on a loopback daemon is the owner at their own
   * machine, because a guest is remote by construction. A hosted home fails
   * all three and has no `dirs.json` anyway; it refuses with the same
   * sentence a canvas with no binding gets.
   *
   * The listing is not the content: `/tree` names files, `/tree/file` hands
   * one file's bytes to the owner's own browser so a person can ADD it to
   * the canvas through the ordinary upload + `item.add` path — content
   * enters the shared surface only by that explicit act. Nothing here
   * writes, and `tree.ts` jails and denies independently of this gate.
   */
  const treeGate = async (
    canvasId: string,
    req: { ip: string },
    reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  ): Promise<string[] | null> => {
    const local = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
    if (!loopbackBound(app) || !local || (options.homes?.homeOf(canvasId) ?? null) !== null) {
      reply.status(404).send({
        error:
          "this canvas's files live with its home daemon, on its owner's machine — " +
          "the tree is served only there, only locally",
        code: "no-directory",
      });
      return null;
    }
    const dirs = await boundDirs(isocanHome(), canvasId);
    if (dirs.length === 0) {
      reply.status(404).send({
        // The fact, and only the fact. It used to append "(isocan use
        // <canvas>)" — a remedy that reads as a dead end in the app, which
        // now offers the binding itself, and which each surface is better
        // placed to word for its own reader anyway.
        error: "no directory is bound to this canvas on this machine",
        code: "no-directory",
      });
      return null;
    }
    return dirs;
  };

  /**
   * **Bind a directory to this canvas, without a terminal** — what
   * `isocan use` does, asked for by the app
   * (`docs/research/2026-08-26-attaching-a-directory.md`).
   *
   * The browser cannot do this itself, and not for want of an API: a
   * `FileSystemHandle` exposes `kind` and `name` and never a path, by
   * design, so a directory picked in a page cannot be written into
   * `dirs.json` and cannot become a binding the CLI or an agent can see.
   * The daemon is the only party that can name a directory. So the browser
   * asks and this does it, through the very same functions the CLI calls —
   * one binding, two surfaces.
   *
   * **Every refusal is its own sentence**, deliberately unlike the tree's
   * single-sentence jail: this route is owner-scoped and loopback-only, the
   * caller is the person who typed the path, and "which rule refused me" is
   * exactly what they need to fix it. A path that is not there says so.
   */
  /**
   * **Directories to pick from** — the picker behind the app's Attach field.
   * One level, directory names only, jailed to `$HOME` (`pickList`), and
   * gated exactly like the bind it feeds: this daemon, this machine, loopback.
   */
  app.get("/api/projects/:id/pick", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const local = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
    if (!loopbackBound(app) || !local || (options.homes?.homeOf(id) ?? null) !== null) {
      return reply.status(404).send({
        error: "directories can only be browsed on the machine this canvas lives on",
        code: "no-directory",
      });
    }
    const at = (req.query as { at?: string }).at ?? null;
    const listing = await pickList(isocanHome(), at);
    // One sentence for every refusal here, unlike the bind route's: this one
    // enumerates, so "which rule refused" would describe the shape of a disk
    // the caller cannot see. Absent, outside the jail, a symlink, a file —
    // all of them are "there is nothing to list here".
    if (!listing) {
      return reply.status(404).send({ error: "there is nothing to list here", code: "no-directory" });
    }
    return listing;
  });

  app.post("/api/projects/:id/bind", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    // Same gate as the tree, and for the same reason: this is the owner's own
    // machine speaking to itself about its own disk.
    const local = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
    if (!loopbackBound(app) || !local || (options.homes?.homeOf(id) ?? null) !== null) {
      return reply.status(404).send({
        error:
          "a directory can only be bound on the machine this canvas lives on, and only locally",
        code: "no-directory",
      });
    }
    const asked = (req.body as { path?: string } | undefined)?.path;
    if (typeof asked !== "string" || asked.trim() === "") {
      return reply.status(400).send({ error: "which directory? give a path", code: "bad-op" });
    }
    // `~` is what a person types; nothing else expands it for them here.
    const home = isocanHome();
    const typed = asked.trim();
    const wanted = path.resolve(
      typed.startsWith("~") ? path.join(os.homedir(), typed.slice(1)) : typed,
    );

    const found = await fs.stat(wanted).catch(() => null);
    if (!found) {
      return reply.status(404).send({
        error: `there is nothing at ${wanted}`,
        code: "no-such-dir",
      });
    }
    if (!found.isDirectory()) {
      return reply.status(400).send({
        error: `${wanted} is a file — bind the directory that holds it`,
        code: "not-a-dir",
      });
    }
    // The git toplevel when there is one, exactly as `isocan use` chooses it:
    // the canvas is about the project rather than the checkout, so a marker
    // resolves the same from every subdirectory and every worktree.
    const root = await bindableRoot(wanted, home);
    if (!root) {
      return reply.status(400).send({
        error:
          `${wanted} cannot hold a binding — a home directory would claim every canvas under it`,
        code: "unbindable",
      });
    }
    // Already spoken for. The CLI overwrites here; a click is a cheaper
    // gesture than a typed command, so a mistake is cheaper to make and this
    // refuses instead — except when the marker already names THIS canvas,
    // which is the adoption case: a cloned repo carries its marker, and all
    // that is missing on this machine is the roster row.
    const existing = await readMarker(root);
    if (bindVerdict(existing, id) === "taken") {
      return reply.status(409).send({
        error: `${takenSentence(root, existing!)} — unbind it there first`,
        code: "bound-elsewhere",
      });
    }
    const livesAt = options.homes?.homeOf(id) ?? null;
    const canvas = (await engine.getSnapshot(id)).project;
    const file = existing
      ? markerFile(root)
      : await writeMarker(root, {
          canvasId: id,
          title: canvas.title,
          ...(livesAt ? { home: livesAt } : {}),
        });
    await recordDir(home, root, id);
    return { root, marker: file, adopted: Boolean(existing) };
  });

  /**
   * **Write an item out to the directory bound here** — the other direction
   * from `＋` (`docs/projects/workbench/files-on-disk.md`).
   *
   * Gated exactly like the tree, no weaker: a canvas link must never reach
   * somebody's disk. The jail is `writeBound`'s, which is `readBound`'s plus
   * the rules a WRITE needs — parent directories only where every segment is
   * listable, and drift refused rather than overwritten, because a bad read
   * leaks a listing and a bad write destroys work.
   */
  app.post("/api/projects/:id/write", async (req, reply) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    const dirs = await treeGate(id, req, reply);
    if (!dirs) return reply;
    const { itemId, force } = (req.body ?? {}) as { itemId?: string; force?: boolean };
    const item = itemId ? snapshot.canvas.items[itemId] : undefined;
    if (!item) return reply.status(404).send({ error: "no such item", code: "no-item" });
    const rel = fileOf(item);
    if (!rel) {
      return reply.status(400).send({
        error: `${item.title} is not backed by a file — give it one first`,
        code: "not-tracked",
      });
    }
    const current = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0];
    if (!current) return reply.status(400).send({ error: "that item has no version", code: "bad-op" });
    const stream = await store.openBlob(id, current.blobHash);
    if (!stream) return reply.status(404).send({ error: "those bytes are not here", code: "no-blob" });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
    const bytes = Buffer.concat(chunks);

    // The first bound root, as the tree's read already does. A canvas bound
    // to several directories on one machine is worktrees or clones, and
    // which one a write means is a question nobody has asked yet.
    const root = dirs[0]!;
    const hashOf = (data: Buffer) => createHash("sha256").update(data).digest("hex");
    // Everything this item has ever been. A file matching any of them was
    // written by this canvas and is safe to update; one matching none of
    // them is somebody else's work, and `force` is a person saying so.
    const ours = force
      ? [(await hashBound(root, rel, hashOf)) ?? ""]
      : item.versions.map((v) => v.blobHash);
    const result = await writeBound(root, rel, bytes, ours, hashOf);
    if (!result.ok) {
      const sentence: Record<string, string> = {
        "outside-root": `${rel} is outside the directory bound to this canvas`,
        "not-listable": `${rel} names something this canvas may not write — dotfiles and secret shapes are refused`,
        symlink: `${rel} passes through a symlink, which is never followed`,
        drifted: `${rel} has changed on disk since it was last written — save again to overwrite it`,
        unwritable: `${rel} could not be written`,
      };
      return reply
        .status(result.refusal === "drifted" ? 409 : 400)
        .send({ error: sentence[result.refusal ?? "unwritable"], code: result.refusal });
    }
    return { root, path: rel, wrote: current.blobHash };
  });

  /**
   * **What this machine's disk says about the canvas's tracked items** — the
   * derived half of `backingOf`, which the app and `isocan ls` both render.
   * Same gate; a listing of hashes is still a listing.
   */
  app.get("/api/projects/:id/backing", async (req, reply) => {
    const { id } = req.params as { id: string };
    const snapshot = await engine.getSnapshot(id);
    const local = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
    const bound =
      loopbackBound(app) && local && (options.homes?.homeOf(id) ?? null) === null
        ? await boundDirs(isocanHome(), id)
        : [];
    const hashOf = (data: Buffer) => createHash("sha256").update(data).digest("hex");
    const onDisk: Record<string, string> = {};
    if (bound.length > 0) {
      for (const item of Object.values(snapshot.canvas.items)) {
        const rel = fileOf(item);
        if (!rel || onDisk[rel] !== undefined) continue;
        const hash = await hashBound(bound[0]!, rel, hashOf);
        if (hash !== null) onDisk[rel] = hash;
      }
    }
    return { bound: bound.length > 0, onDisk };
  });

  app.get("/api/projects/:id/tree", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id); // unknown canvas answers as it always does
    const dirs = await treeGate(id, req, reply);
    if (!dirs) return reply;
    const roots = [];
    for (const dir of dirs) roots.push(await readTree(dir));
    return { roots };
  });

  /**
   * **The personas this canvas's directory holds.**
   *
   * Gated exactly like the tree — this daemon, this machine, loopback, a
   * verified binding — because it reads somebody's disk and nothing about a
   * markdown file makes that safer. It does NOT reuse the tree's jail: that
   * one refuses every dotted name, which is what keeps `.ssh` and `.env` out
   * of a listing, and personas live under `.agents/`. `personas.ts` has a
   * tighter jail instead, where the directory is fixed and the name is a stem
   * that cannot express a path.
   *
   * Parsed by core, so this and `isocan persona ls` cannot disagree about what
   * a persona says — and the raw text rides along, because an editor should
   * show what is actually in the file rather than a re-rendering of what we
   * understood from it.
   */
  app.get("/api/projects/:id/personas", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const dirs = await treeGate(id, req, reply);
    if (!dirs) return reply;
    const root = dirs[0]!;
    return { root, personas: await readPersonas(root) };
  });

  /** Save one. The name is a stem; the body is the whole file. */
  app.put("/api/projects/:id/personas/:name", async (req, reply) => {
    const { id, name } = req.params as { id: string; name: string };
    await engine.getSnapshot(id);
    const dirs = await treeGate(id, req, reply);
    if (!dirs) return reply;
    const text = (req.body as { text?: string } | undefined)?.text;
    if (typeof text !== "string") {
      return reply.status(400).send({ error: "what should it say?", code: "bad-op" });
    }
    const written = await writePersona(dirs[0]!, name, text);
    if (!written.ok) {
      return reply.status(400).send({ error: personaRefusal(written.refusal), code: written.refusal });
    }
    return written;
  });

  app.get("/api/projects/:id/tree/file", async (req, reply) => {
    const { id } = req.params as { id: string };
    await engine.getSnapshot(id);
    const dirs = await treeGate(id, req, reply);
    if (!dirs) return reply;
    const rel = (req.query as { path?: string }).path;
    if (!rel) return reply.status(400).send({ error: "path?", code: "bad-op" });
    for (const dir of dirs) {
      const bytes = await readBound(dir, rel);
      if (bytes !== null) {
        // Octet-stream on purpose: the browser hands it to the upload path,
        // never renders it — a served page here would be a second content
        // origin problem.
        return reply.header("Content-Type", "application/octet-stream").send(bytes);
      }
    }
    // One sentence for every refusal — absent, jailed, denied, oversize —
    // because which rule refused is what a probe would love to learn.
    return reply.status(404).send({ error: "no such file in the bound directory", code: "no-file" });
  });

  /**
   * The blob GET lives in `content.ts` now — the content role, mounted here
   * on the app origin exactly as the inline route always was (the door's
   * `onRequest` hook above still gates it, unchanged). Stage 2 of the
   * content-origin plan mounts the same function on a second loopback
   * listener; the extraction is the seam, not a behavior change.
   *
   * The CSP passed here is defense in depth for HTML blobs on THIS origin:
   * even outside the app's sandboxed iframe, a directly-opened blob document
   * is sandboxed and can't reach the daemon API with an origin.
   */
  registerContentRoutes(
    app,
    { engine, store, homes: options.homes ?? null },
    { csp: "sandbox allow-scripts" },
  );

  /**
   * **`GET /__/auth/action` — a Firebase-shaped path, answered by isocan.**
   *
   * Registered HERE, immediately above `registerPages`, so that the SPA
   * fallback cannot swallow it. That is what it was doing:
   * `https://dev.isocan.io/__/auth/action` answered **200 and the app shell**
   * on 2026-08-24, which is this codebase's oldest recurring failure — the
   * default answer to a wrong address is a cheerful one. (Fastify's router
   * prefers a static route to `/*` whatever the order, so the guard against a
   * later reordering is the test, not this line. The line is still where a
   * reader looks.)
   *
   * **Why isocan serves a path the provider named.** Sign-in mail was going to
   * spam: Identity Platform sends from `noreply@<project>.firebaseapp.com`,
   * with no SPF or DKIM alignment to `isocan.io`. Fixing that means a custom
   * sender domain, and the provider moves the From: address and the
   * action-link domain **together** — so the domain the mail claims has to
   * answer `/__/auth/action`. The alternative, `auth.isocan.io` on Firebase
   * Hosting, is the one-origin rule broken for the one link that most needs to
   * look like the product: a stranger's first sight of isocan would be a
   * hostname isocan does not use. Serving it here keeps one origin and removes
   * Firebase Hosting from the dependency chain.
   *
   * **This is a provider contract observed from outside, and it was measured
   * rather than read.** A real link was generated on 2026-08-24 through
   * `accounts:sendOobCode` with `returnOobLink: true`; the five parameters and
   * the unencoded `continueUrl` in `authaction.ts` are what came back. If
   * Firebase changes them, this breaks, and nothing warns us first — the
   * fixture in `packages/server/test/authaction.test.ts` is the record of what
   * was true on the day.
   *
   * The decision itself is `authActionOutcome` in core, not inline here: the
   * web app strips the same parameter list on landing, and a rule with two
   * homes has none (house rule 4, lessons.md #5).
   */
  app.get(AUTH_ACTION_PATH, async (req, reply) => {
    const outcome = authActionOutcome(req.query as Record<string, unknown>);
    /**
     * A legible 400, not a redirect and never a 200.
     *
     * `text/plain` because the only caller is a PERSON who clicked a link in a
     * mail client — nothing parses this, so the codebase's `{error}` envelope
     * would be a JSON blob rendered as a page. `nosniff` because the body
     * repeats a fragment of a query string and a browser that guessed `text/html`
     * would be a way in. `no-store` on both answers: a URL carrying a
     * single-use credential has nothing anybody should keep.
     */
    if ("refusal" in outcome) {
      return reply
        .status(400)
        .header("Content-Type", "text/plain; charset=utf-8")
        .header("X-Content-Type-Options", "nosniff")
        .header("Cache-Control", "no-store")
        .send(outcome.refusal);
    }
    // 302 and a same-origin PATH. `authActionOutcome` discards the host it was
    // given rather than checking it, so there is no absolute URL here to get
    // wrong — see the argument in `authaction.ts`.
    return reply.header("Cache-Control", "no-store").redirect(outcome.redirect, 302);
  });

  // The one-origin rule, per canvas since phase 10.3. See `registerPages`.
  // The meter travels with it: the SPA fallback is the second mint path, and
  // it draws on the same bucket the door does (phase 13.7).
  registerPages(app, desk, store, options, { mayMint, logRefusal });
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
    // Absent rather than empty when nothing has been proved, so the field a
    // client renders is the field the desk actually holds — an empty array and
    // "this home is older than attestations" would look the same otherwise.
    ...(record.attestations?.length
      ? { attested: record.attestations.map((row) => row.attribute) }
      : {}),
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

/**
 * **Which pages this origin serves, and which it signposts** — the one-origin
 * rule, made per-canvas by phase 10.3.
 *
 * It used to be one branch on one field: a daemon with a home configured
 * served no pages at all, a daemon without one served everything. Under many
 * homes a daemon is simultaneously the home of canvas 1 and a replica for
 * canvases 2 and 3, and that branch has no input.
 *
 * **The rule the one-origin constraint actually is:** a given CANVAS must have
 * exactly one door, so that per-viewer state for it — the badge cookie, the
 * service worker registration, the phase-10 IndexedDB replica — lives in one
 * origin's storage. A local daemon serving the shell for a canvas whose home
 * is dev.isocan.io would give that canvas two doors, two cookies, two service
 * workers and two browser replicas, the local one stale by construction:
 * `local-bridge.md`'s own worst case, *"two surfaces agreeing with each other
 * and both wrong."* But a canvas whose home IS this daemon has exactly one
 * origin already, and refusing to serve it would make every locally-born
 * canvas unopenable in a browser — which phase 10.5 explicitly promises does
 * not happen to Dion.
 *
 * So: **a daemon serves the app for the canvases whose home it is, and for no
 * others.** `GET /p/<id>` serves the shell when `homes.json` says that canvas
 * is local and signposts its actual home when it is not. `/` and the assets
 * are served unless this daemon is a PURE replica — a birth default set and
 * not one canvas of its own — which keeps a clean machine with no canvases
 * serving the app, and a fresh `isocan setup` depends on that.
 *
 * A pure home is byte-for-byte today's behaviour. A pure replica is
 * byte-for-byte today's behaviour. A mixed rig gets pages for what it hosts
 * and a legible signpost for what it does not — and that signpost is strictly
 * better than the one it replaces, which named the daemon's one home whether
 * or not the canvas lived there.
 *
 * Two rejected alternatives, recorded: "serve pages only when EVERY canvas is
 * local" stops Dion's rig serving pages the instant he joins one dev canvas,
 * which is the exact surprise 10.5 exists to prevent; "always serve pages"
 * abandons the rule.
 *
 * **One cost, recorded rather than waved through.** The SPA fallback mints a
 * cookie badge, so a mixed rig now mints them where a replica minted none. No
 * new authority — a person at the local origin already reaches everything on
 * that machine through the CLI — but the sentence that used to justify the
 * old shape ("a daemon that no longer serves pages must not go on minting
 * cookie badges for people it is not serving") has changed and is edited below
 * rather than left standing false: a daemon mints them only where it is
 * somebody's home.
 */
function registerPages(
  app: FastifyInstance,
  desk: Desk,
  store: Store,
  options: RouteOptions,
  /** The door's meter, handed in rather than built here: one bucket per
   * client covers both mint paths, and a second meter would be a second
   * budget for the same desk rows (phase 13.7). */
  meter: {
    mayMint: (req: FastifyRequest) => MintRefusal | null;
    logRefusal: (req: FastifyRequest, what: string, refusal: MintRefusal) => void;
  },
): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../../web/dist");
  const built = existsSync(path.join(dist, "index.html"));

  /**
   * Is this daemon a PURE replica — a birth default set, and not one canvas of
   * its own?
   *
   * Asked per request rather than computed at registration, because both
   * inputs change while the process runs: a canvas can be born locally, and a
   * canvas can be deleted. A boot-time answer would have a daemon that gained
   * its first local canvas go on refusing to serve the page for it until
   * somebody restarted, which is the shape of bug this codebase calls
   * cheerful.
   */
  const pureReplica = async (): Promise<boolean> => {
    // No birth default: this daemon is somebody's home by definition, and the
    // question is over before it costs anything. **This is also what keeps the
    // listing below off the hosted home's page path** — a hosted home has no
    // birth default, so it returns here and never reads its canvas list to
    // serve a page.
    if (!options.birthHome) return false;
    const rows = options.homes?.assignments() ?? {};
    /**
     * **Absent and `null` are the same answer, and this line used to disagree
     * with the rest of the codebase about that.**
     *
     * `homes.json`'s own doc says absent means "this daemon is that canvas's
     * home" — it is what makes phase 10.3 a no-op for a machine that predates
     * it. This predicate asked only about EXPLICIT nulls, so a daemon holding
     * canvases with no rows (Dion's, exactly) plus a birth default judged
     * itself a pure replica and answered a signpost for pages it was the home
     * of. Routing was right and serving was wrong, which is the confusing half
     * of a bug to meet.
     *
     * So the question is asked of what this daemon actually HOLDS, with the
     * rows read through the same absent-means-local rule everything else uses.
     * Zero canvases is still a pure replica: a clean machine pointed at a home
     * has nothing of its own to open, and sending that person to the home is
     * the honest answer.
     */
    const held = await store.listCanvases();
    return !held.some((canvas) => (rows[canvas.id] ?? null) === null);
  };

  /**
   * Where the canvas this request is about actually lives, or null when this
   * origin is the right one to answer.
   *
   * A path that names no canvas (`/`, an asset, anything the SPA routes
   * client-side) is judged by the daemon rather than by a canvas: a pure
   * replica has no pages of its own to serve and says so, and everybody else
   * serves. A path that DOES name a canvas is judged by that canvas's row —
   * including an id with no row at all, which means local, which is the same
   * sentence the marker has always carried.
   */
  const elsewhere = async (pathname: string): Promise<string | null> => {
    const canvasId = canvasIdIn(pathname);
    if (canvasId === null) return (await pureReplica()) ? (options.birthHome ?? null) : null;
    const home = options.homes?.homeOf(canvasId) ?? null;
    if (home !== null) return home;
    // No row: this canvas is this daemon's — unless this daemon serves no
    // pages at all, in which case there is nothing here to open and the birth
    // default is the honest place to send a person.
    return (await pureReplica()) ? (options.birthHome ?? null) : null;
  };

  const send = (reply: { header: Function; send: Function; type: Function }, file: string) => {
    const types = STATIC_TYPES;
    /**
     * **An unknown extension falls through to `application/octet-stream`, and
     * that is this codebase's oldest failure wearing a `Content-Type`.**
     *
     * The map is hand-rolled and had six entries. Phase 13.5 added the front
     * page's screenshot as the first `.webp` this tree has ever served, and it
     * went out as `application/octet-stream` — which RENDERS, because Chrome
     * sniffs an `<img>` body, so nothing looked broken. It would stop
     * rendering the day anything set `X-Content-Type-Options: nosniff` on
     * static assets, and the symptom would be a blank frame on the first page
     * a stranger sees, a long way from this line.
     *
     * `packages/server/test/statictypes.test.ts` is the guard: every extension
     * under `packages/web/public/` must be named here, so the next asset type
     * somebody adds fails the build instead of shipping a cheerful default.
     */
    reply.type(types[path.extname(file)] ?? "application/octet-stream");
    /**
     * **What may be remembered, and what must be asked for again.**
     *
     * Neither of these headers was sent at all, which does not mean "do not
     * cache" — with no `Cache-Control` and no validator, a browser applies
     * its own heuristic, and Chrome duly held on to `index.html`. That is the
     * worst possible file to guess about: it is the one that NAMES the hashed
     * bundles, so a stale copy pins a person to the whole previous build.
     * Reported as exactly that — a deploy landed, the page was reloaded, and
     * nothing had changed, because the reload re-read a cached entry point
     * pointing at last build's assets.
     *
     * So the standard pairing, and it is a pairing rather than one rule:
     *
     * - **`/assets/*` is immutable for a year.** Vite puts a content hash in
     *   every filename there, so the name changes whenever the bytes do. That
     *   is precisely the condition under which `immutable` is safe, and it is
     *   what makes the other half affordable.
     * - **Everything else revalidates.** `index.html` must, for the reason
     *   above. The rest of `public/` rides along rather than earning its own
     *   case: it is a favicon and a screenshot, and a few KB re-fetched is a
     *   cheaper mistake than a third caching rule nobody remembers.
     */
    const hashed = file.startsWith(path.join(dist, "assets") + path.sep);
    /**
     * A third case, and it is about NAMES rather than about content.
     *
     * `/assets/*` may be `immutable` because Vite hashes those names, so new
     * bytes always arrive as a new URL. A font in `public/` does not get that
     * — its name is stable — so `immutable` would pin a replaced font in
     * caches with no way to bust it. But `no-cache` is wrong too: re-fetching
     * 73KB of handwriting on every load is exactly the cost self-hosting was
     * supposed to remove.
     *
     * So: cached for a day. Long enough that the font is free in normal use,
     * short enough that replacing it takes effect without anybody being told
     * to clear anything.
     */
    const font = path.extname(file) === ".woff2";
    reply.header(
      "Cache-Control",
      hashed
        ? "public, max-age=31536000, immutable"
        : font
          ? "public, max-age=86400"
          : "no-cache",
    );
    return reply.send(createReadStream(file));
  };

  app.get("/*", async (req, reply) => {
    const url = (req.params as { "*": string })["*"] ?? "";
    const pathname = (req.url ?? "/").split("?")[0]!;
    // An unmatched `/api/` path is a MISSING ROUTE, not a page. This one line
    // is phase 7.5's finding: without it the SPA fallback answers 200 and the
    // web app to `GET /api/actors/free-name`, and a replica negotiating with an
    // older home is correct only because parsing HTML as JSON throws. It
    // matters just as much on the signposting side: telling a CLI "this canvas
    // lives at https://…" when it asked for a route that does not exist would
    // be the cheerful wrong address again, in HTML this time.
    if (`/${url}`.startsWith("/api/")) return apiNotFound(reply, req.method, `/${url}`);

    const home = await elsewhere(pathname);
    if (home !== null) return signpost(reply, req.headers.accept, home);

    // Nothing built to serve. A daemon with no `packages/web/dist` has always
    // answered the plain 404 its not-found handler answers; keep saying the
    // same sentence rather than inventing a second one.
    if (!built) {
      return reply.status(404).send({ error: `not found: ${req.method} ${pathname}` });
    }

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
    //
    // Phase 10.3 changed the sentence this used to be paired with. It read "a
    // daemon that no longer serves pages must not go on minting cookie badges
    // for people it is not serving"; a daemon is no longer one of two things,
    // so it reads: **a daemon mints them only where it is somebody's home**,
    // which is exactly where this line can be reached from — the signpost
    // above returns first for every canvas that lives elsewhere, and for every
    // request at all on a pure replica.
    //
    // **Metered, and metered by WITHHOLDING THE BADGE rather than the page**
    // (phase 13.7). This is the mint path a flood walks in through — a loop
    // on `/` with no cookie mints a desk row per request — so it cannot be
    // left unmetered. But the caller here asked for a PAGE, and refusing that
    // is the wrong refusal twice over: a bucket is per address, addresses are
    // shared (CGNAT, an office, a school), and a 429 where the app should be
    // is the front door of the product broken for somebody who did nothing.
    // Serving the page and minting nothing is the narrowest answer that still
    // protects what is actually scarce, and it degrades into a path that
    // already exists — the app arrives badge-less and takes `api.ts`'s
    // 401-and-recover route, which comes back here the moment the bucket
    // refills. The door, whose caller asked for the CREDENTIAL and can act on
    // being told to wait, answers 429 instead. Same accounting, two refusals,
    // because they are two different asks.
    if (!req.badge) {
      const refusal = meter.mayMint(req);
      if (refusal) {
        meter.logRefusal(req, "served a page without minting: metered", refusal);
      } else {
        const { record, token } = mintBadge("cookie");
        await desk.put(record);
        const secure = isSecureRequest(req.headers, Boolean((req.raw.socket as { encrypted?: boolean }).encrypted));
        reply.header("Set-Cookie", badgeCookie(token, secure));
      }
    }
    return send(reply, path.join(dist, "index.html")); // SPA fallback
  });
}

/**
 * The canvas a page request is about, or null when it is about no canvas.
 *
 * Built from `canvasPath` in core rather than from a literal `/p/`, because
 * that is the whole reason `address.ts` exists: the `/c/` bug was one spelling
 * of a canvas address drifting from another, and a guard that knew about the
 * prefix independently would be that bug wearing a different hat.
 */
/**
 * **Refuse a home-scoped act this daemon cannot place**, or null to carry on.
 *
 * Badges, attestations and (before it learned to carry its own address) pass
 * redemption are facts about a DESK, and a desk belongs to a home. On a mixed
 * rig with two homes and no birth default there is no true answer, and the
 * available wrong ones are both bad: forwarding to whichever link sorted first
 * asks a stranger's desk about you, and answering from the local desk hands
 * back this laptop's own ledger as though it were the home's.
 *
 * The local-desk fallback is the one that would have shipped, because it is
 * what the code did when a daemon had one home and the branch simply never
 * fired. It is a short, plausible, completely wrong list delivered in silence
 * — the cheerful wrong address, about a credential. So: 409, both homes named,
 * and the person chooses.
 */
function refuseAmbiguousHome(
  reply: FastifyReply,
  homes: HomeLinks | null | undefined,
  act: string,
): FastifyReply | null {
  const contested = homes?.homeScopedAmbiguity() ?? null;
  if (contested === null) return null;
  return reply.status(409).send({
    error:
      `this machine holds work at ${contested.join(" and ")}, and no birth default to break ` +
      `the tie — so "${act}" has more than one true answer and none of them is this laptop's ` +
      "own ledger. A badge belongs to a home's desk, and nothing in this request names one. " +
      "Pick a home for new canvases (`isocan home <address>`) and this asks that one, or " +
      "run the command against the home you mean.",
    code: AMBIGUOUS_HOME,
  });
}

/**
 * The host[:port] of an address, or null when it is not one at all.
 *
 * Its one caller compares against a request's `Host` header, which carries no
 * scheme — so this deliberately compares hosts and not origins. A daemon
 * reached over http at the address a marker spells with https is still the
 * same daemon, and the question here is only ever "is this me".
 */
function hostOf(address: string): string | null {
  try {
    return new URL(address).host || null;
  } catch {
    return null;
  }
}

function canvasIdIn(pathname: string): string | null {
  const parts = pathname.replace(/\/+$/, "").split("/");
  if (parts.length !== 3 || parts[0] !== "" || `/${parts[1]}` !== CANVAS_PATH_PREFIX) return null;
  const id = decodeURIComponent(parts[2] ?? "");
  return id || null;
}

/** The header a replica names its home in — a machine-readable copy of what
 * the body says, for a `curl` or a script that would rather not scrape prose.
 * Deliberately NOT `Location`, and deliberately not a 3xx: see below. */
export const HOME_HEADER = "X-Isocan-Home";

/**
 * What this origin answers a person with, when the canvas they asked for is
 * not this daemon's to serve.
 *
 * It sits inside the one `GET /*` handler now (phase 10.3) rather than
 * replacing it, because the answer is per canvas: the same daemon serves the
 * app for what it hosts and shows this for what it does not. **The address it
 * names is THAT CANVAS's home** — which is strictly better than what it
 * replaced, a signpost that named the daemon's one configured home whether or
 * not the canvas lived there.
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
function signpost(
  reply: FastifyReply,
  accept: string | undefined,
  homeUrl: string,
): FastifyReply {
  const accepts = String(accept ?? "");
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
      `<code>isocan</code> CLI and to agents on this machine, and serves pages ` +
      `only for the canvases it is the home of — every canvas has one door.</p>` +
      `</body></html>\n`,
  );
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
