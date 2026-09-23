import { createRequire as __isocanCreateRequire } from "node:module";
const require = __isocanCreateRequire(import.meta.url);
import {
  designRequestsRoute
} from "./chunk-U4ZPMZI4.mjs";
import {
  designRepairsRoute
} from "./chunk-PKQBK4R5.mjs";
import {
  designDecisionsRoute
} from "./chunk-KEV4Z5CD.mjs";
import {
  ACTOR_KINDS_ROUTE,
  ApiError,
  BADGES_ROUTE,
  BADGE_ENDED,
  CLIENT_FEATURES_HEADER,
  CURRENT_CLIENT_FEATURES,
  FILENAME_HEADER,
  GROUPS_ROUTE,
  HOMES_ROUTE,
  HOME_GC_ROUTE,
  HOME_JOIN_ROUTE,
  NEWS_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_PROOF_HEADER,
  PASS_REDEEM_ROUTE,
  PRESENCE_WHERE_ROUTE,
  PUBLIC_CANVASES_ROUTE,
  SERVING_ROUTE,
  SOURCE_ACCESS_ROUTE,
  SOURCE_POLICY_HEADER,
  SPACES_ROUTE,
  TAKEDOWNS_CANVAS_PARAM,
  TAKEDOWNS_ROUTE,
  askTheDoor,
  badgeRoute,
  bearerHeader,
  canvasContextRoute,
  commentContextRoute,
  encodeFilename,
  grantRevokeRoute,
  grantsRoute,
  groupActingRoute,
  groupMemberRoute,
  groupRoute,
  healthPath,
  inboxRoute,
  narrowed,
  normalizeHomeUrl,
  parseSourcePolicyHeader,
  passRoute,
  passesRoute,
  personalCanvasRoute,
  personalDelegatesRoute,
  personalRoute,
  publicListingRoute,
  questionnaireActorsRoute,
  rcAnsweringRoute,
  recapHeadRoute,
  seenMarksRoute,
  seenRoute,
  sourceClassificationRoute,
  sourcePolicyHeader,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  spaceRoute
} from "./chunk-JM775MAC.mjs";

// packages/api/src/routes.ts
var OPERATIONS_ROUTE = "/api/ops";
var platformFetch = (input, init) => fetch(input, init);
var DaemonRoutes = class {
  constructor(base, badgeStore, lifetime, sourceContext) {
    this.base = base;
    this.badgeStore = badgeStore;
    this.lifetime = lifetime;
    if (sourceContext) this.sourceContext = Object.freeze({
      ...parseSourcePolicyHeader(sourcePolicyHeader(sourceContext)),
      ...sourceContext.signal ? { signal: sourceContext.signal } : {}
    });
  }
  base;
  badgeStore;
  lifetime;
  /** Loaded once per instance, from the badge store it was handed. */
  badge;
  /**
   * How to make the home vouch for whoever this command speaks as: claim the
   * actor under the session key it belongs to. Registered by
   * `resolveIdentity` — knowing who you are is knowing how to prove it.
   *
   * Two refusals need it, and they are the two landmines mechanism 5 laid:
   *
   * - **401.** The door mints a badge whose claims are EMPTY, and the request
   *   about to be replayed asserts an actor. Re-claim, then replay.
   * - **`not-your-actor`.** The home identity in `~/.isocan/identity.json` is
   *   a local file that nothing ever claimed — so the first time a machine
   *   speaks for its person, the home has never heard the claim. Making it on
   *   demand is what turns "refused, for every solo human at once" into one
   *   extra round trip, once per badge, that nobody sees.
   */
  reclaim = null;
  reclaiming = false;
  /** The last observed mode is captured into each request body before retries.
   * Callers holding an older placement preview pass its mode explicitly. */
  observedGroupModes = /* @__PURE__ */ new Map();
  sourceContext;
  requestSignal(signal) {
    const signals = [this.lifetime, this.sourceContext?.signal, signal].filter((value) => !!value);
    return signals.length > 1 ? AbortSignal.any(signals) : signals[0];
  }
  policyHeaders() {
    return this.sourceContext ? { [SOURCE_POLICY_HEADER]: sourcePolicyHeader(this.sourceContext) } : {};
  }
  /**
   * **The fetch this surface makes its requests with**, so that the half of
   * the client which is allowed to know about Node can bound them.
   *
   * It is a field rather than an import for the reason the whole class exists
   * (`boundary.test.ts`): a connect deadline is `undici`, `undici` is Node,
   * and the moment this file imports it the browser build of the transport
   * kernel stops being possible. So the mechanism lives in `client.ts` —
   * `DaemonClient` replaces this with a connect-bounded, bounded-retry fetch
   * when the base is loopback — and what is written here is only that the
   * requests go through something replaceable.
   *
   * The default is the platform's own fetch, which is what every surface
   * without a Node half keeps: one attempt, no deadline, exactly today.
   */
  fetcher = platformFetch;
  /**
   * Every request carries the badge, and a refused one heals itself and comes
   * straight back. This is what makes neither the door nor the membership
   * check a breaking change: a CLI that has never seen a badge, whose home was
   * wiped, or whose person the home has never been told about, recovers in one
   * extra round trip with nobody told anything.
   *
   * Exactly one recovery per request, and never a loop: a 401 goes to the
   * door (which re-claims on the way back), and a `not-your-actor` claims.
   */
  async request(method, url, body, signal, extra) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const send = async () => {
      const headers = { ...await this.authHeader(), [CLIENT_FEATURES_HEADER]: CURRENT_CLIENT_FEATURES, ...extra, ...this.policyHeaders() };
      signal?.throwIfAborted();
      if (body !== void 0) headers["Content-Type"] = "application/json";
      return this.fetcher(`${this.base}${url}`, {
        method,
        ...signal !== void 0 ? { signal } : {},
        ...Object.keys(headers).length > 0 ? { headers } : {},
        ...body !== void 0 ? { body: JSON.stringify(body) } : {}
      });
    };
    let res = await send();
    let json = await res.json().catch(() => null);
    signal?.throwIfAborted();
    if (res.status === 401 && json?.code === BADGE_ENDED && json?.reason === "operator") {
      throw new ApiError(401, json.error, BADGE_ENDED, "operator");
    }
    const recovered = res.status === 401 ? await this.reBadge(signal) : json?.code === "not-your-actor" && await this.reclaimIdentity();
    if (recovered) {
      signal?.throwIfAborted();
      res = await send();
      json = await res.json().catch(() => null);
    }
    signal?.throwIfAborted();
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
    }
    return json;
  }
  /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
  async authHeader() {
    const badge = await this.storedBadge();
    return badge ? bearerHeader(badge) : {};
  }
  async storedBadge() {
    if (this.badge === void 0) this.badge = await this.badgeStore.read();
    return this.badge;
  }
  /** Go to the door and keep what it hands over. Returns false if the door
   * itself refused, so a caller does not loop.
   *
   * **A definitive door refusal is reported**: a metered door's 429 (phase
   * 13.7) or an operator's network refusal, 403. Printing the original 401 —
   * "a badge is required — ask the door for one" — would advise repeating
   * the act the door just refused. Carry its status, code and words instead;
   * other recovery failures leave the original answer intact. */
  async reBadge(signal = this.lifetime) {
    signal?.throwIfAborted();
    const answer = await askTheDoor(this.base, 1e4, signal);
    signal?.throwIfAborted();
    if ("refused" in answer) {
      if (answer.refused.status === 403 || answer.refused.status === 429) {
        throw new ApiError(answer.refused.status, answer.refused.error, answer.refused.code);
      }
      return false;
    }
    const badge = answer.badge;
    this.badge = badge;
    await this.badgeStore.keep(badge);
    signal?.throwIfAborted();
    await this.reclaimIdentity();
    return true;
  }
  /** How to prove who this command speaks as, if the home asks. Registered by
   * `resolveIdentity` the moment that is known. */
  reclaimWith(reclaim) {
    this.reclaim = reclaim;
  }
  /** Claim the identity this command speaks as. False when there is nothing
   * to claim or the home refused, so a caller does not replay into the same
   * refusal twice. The guard is against the claim's OWN request coming back
   * around here. */
  async reclaimIdentity() {
    if (!this.reclaim || this.reclaiming) return false;
    this.reclaiming = true;
    try {
      await this.reclaim();
      return true;
    } catch {
      return false;
    } finally {
      this.reclaiming = false;
    }
  }
  /** The badge this client is presenting, for `whoami` to print. Never the
   * secret. */
  async badgeId() {
    return (await this.storedBadge())?.badgeId ?? null;
  }
  async health(timeoutMs = 300) {
    return await this.healthz(timeoutMs) !== null;
  }
  /**
   * **Wait for a daemon that is coming back, rather than asking once.**
   *
   * `health()` is a single probe, and a single probe is the right question
   * for "is anything there right now". It is the WRONG question after
   * something restarted the daemon, because the honest answer for the next
   * second or two is "not yet" — and a caller that treats that as "no" goes
   * on to skip whatever it was going to do.
   *
   * `isocan setup` did exactly that: it restarted the daemon to point it at a
   * home, asked once with a 2s budget, and on a busy machine got `false` — so
   * it skipped redeeming the pass, wrote no identity, admitted nobody, and
   * exited 0. Found through a flaky test that was a witness rather than a
   * nuisance.
   *
   * Polls to a deadline, the way `ensureDaemon`'s own startup loop does, and
   * deliberately starts nothing: this is for a daemon that already exists and
   * is on its way up, and spawning a second one to race it is how a restart
   * becomes two daemons fighting for a port.
   */
  async awaitHealth(deadlineMs = 1e4) {
    const deadline = Date.now() + deadlineMs;
    for (; ; ) {
      if (await this.health(1e3)) return true;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  /** The daemon's own account of itself — pid, when it started, and which
   * copy of isocan it is running. Null when nothing answers.
   *
   * The path is a property of `this.base`, not a constant: against 127.0.0.1
   * it is `/healthz` as it has always been, and against a hosted home it is
   * `/api/healthz`, because Google's frontend swallows the bare path and this
   * one call sits under `health()`, `ensureDaemon`'s startup poll and
   * `warnIfStale` — all three of which would otherwise report a live home as
   * dead. See `healthPath`. */
  async healthz(timeoutMs = 300) {
    try {
      this.lifetime?.throwIfAborted();
      const res = await fetch(`${this.base}${healthPath(this.base)}`, {
        signal: AbortSignal.any([AbortSignal.timeout(timeoutMs), ...this.lifetime ? [this.lifetime] : []])
      });
      return res.ok ? await res.json() : null;
    } catch {
      this.lifetime?.throwIfAborted();
      return null;
    }
  }
  /** Name (or resume) the actor behind a session key — the one op sent
   * without an actor: the response envelope says who you are. */
  claimActor(op) {
    return this.request("POST", OPERATIONS_ROUTE, { canvasId: null, op });
  }
  /** Who the given session keys speak as (everyone, when omitted). */
  actorBindings(keys) {
    const query = keys?.length ? `?keys=${keys.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors${query}`);
  }
  /** Claims for these session keys held by a badge that is not this one —
   * what a client whose badge was lost needs in order to be told the truth
   * about why it has no identity. Never adopts; only reports. */
  orphanedActors(keys) {
    const query = keys.length ? `?keys=${keys.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors/orphaned${query}`);
  }
  /**
   * One op, to this daemon.
   *
   * `home` is **where a canvas being born belongs** and is meaningful for
   * nothing else — the daemon refuses it on any other op rather than ignoring
   * it (`PostOpRequest.home` carries the whole argument). What the CLI puts
   * there is never a flag: it is the directory marker's own assertion, or the
   * birth default when the marker makes none. Phase 7.5 refused a
   * per-invocation `--home` override and that refusal stands — this is the
   * committed configuration of the directory a command is standing in, which
   * is why an agent can say "the canvas I am creating right now is born at X"
   * and can never say "send this command somewhere else".
   */
  sendOp(canvasId, actor, op, clientId, home, group, originGroupMode, spaceId, opId) {
    const origin = originGroupMode ?? (canvasId ? this.observedGroupModes.get(canvasId) : void 0);
    return this.request("POST", OPERATIONS_ROUTE, {
      canvasId,
      actor,
      op,
      ...clientId !== void 0 ? { clientId } : {},
      ...home !== void 0 ? { home } : {},
      ...spaceId !== void 0 ? { spaceId } : {},
      ...opId !== void 0 ? { opId } : {},
      ...group !== void 0 ? { group } : {},
      ...origin !== void 0 ? { originGroupMode: origin } : {}
    });
  }
  /** Refusing questionnaire acts retain their canonical type and caller-owned retry ID. */
  questionnaire(canvasId, actor, op, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } });
  }
  /** Writer-resolved eligibility; a missing agent display badge does not imply a human. */
  questionnaireActors(canvasId) {
    return this.request("GET", questionnaireActorsRoute(canvasId));
  }
  /** Only canonical admitted records contribute continuation, budget and lifecycle eligibility. */
  designRequests(canvasId, signal) {
    return this.request("GET", designRequestsRoute(canvasId), void 0, signal);
  }
  /** Canonical comparisons and decision history keep actual authorship separate from currentness. */
  designDecisions(canvasId, signal) {
    return this.request("GET", designDecisionsRoute(canvasId), void 0, signal);
  }
  /** Canonical repair history includes archived acceptances and current continuation standing. */
  designRepairs(canvasId, signal) {
    return this.request("GET", designRepairsRoute(canvasId), void 0, signal);
  }
  /** Stable comparison, non-adopting response and paired adoption intents use the existing writer. */
  designDecision(canvasId, actor, op, opId, signal) {
    const origin = this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } }, signal);
  }
  /** Stable public request/receipt intent reaches the ordinary serialized operation writer. */
  designRecord(canvasId, actor, op, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    return this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op, opId, ...origin === void 0 ? {} : { originGroupMode: origin } });
  }
  // ---- presence sessions ----
  /** Semantic group request; canonical resolved patches belong to the
   * authoritative writer. Pass a stable opId when retrying one intent. */
  async changeGroup(canvasId, actor, action, opId, originGroupMode) {
    const origin = originGroupMode ?? this.observedGroupModes.get(canvasId);
    const response = await this.request("POST", OPERATIONS_ROUTE, { canvasId, actor, op: { type: "group.change", action }, ...opId ? { opId } : {}, ...origin !== void 0 ? { originGroupMode: origin } : {} });
    const op = response.envelope?.op;
    if (op?.type === "group.change" && op.action.kind === "apply" && op.action.change.migration) this.observedGroupModes.set(canvasId, op.action.change.migration.mode);
    return response;
  }
  /** Authoritative, read-only legacy conversion plan, including the undo boundary. */
  async groupMigrationPreview(canvasId) {
    const preview = await this.request("GET", `/api/projects/${encodeURIComponent(canvasId)}/groups/migration`);
    this.observedGroupModes.set(canvasId, preview.fromMode);
    return preview;
  }
  createSession(canvasId, actor, label, harness, kind) {
    return this.request("POST", `/api/projects/${canvasId}/sessions`, {
      actor,
      ...label !== void 0 ? { label } : {},
      ...harness !== void 0 ? { harness } : {},
      ...kind !== void 0 ? { kind } : {}
    });
  }
  updateSession(canvasId, sessionId, patch) {
    return this.request("PUT", `/api/projects/${canvasId}/sessions/${sessionId}`, patch);
  }
  endSession(canvasId, sessionId) {
    return this.request("DELETE", `/api/projects/${canvasId}/sessions/${sessionId}`);
  }
  listSessions(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/sessions`);
  }
  /** End every session an actor holds — the daemon-side truth, for when the
   * local session pointer has been lost. */
  endActorSessions(actorId, kind) {
    const query = kind ? `?kind=${kind}` : "";
    return this.request("DELETE", `/api/presence/actors/${actorId}${query}`);
  }
  /** Authoritative inbox entries and seen marks across the canvases held here. */
  inbox(actorId, options = {}) {
    return this.request("GET", inboxRoute(actorId, options));
  }
  listCanvases() {
    return this.request("GET", "/api/projects");
  }
  // ---- what you have already seen (#147, #134) ----
  //
  // Desk state at the home, so this asks the daemon rather than keeping a
  // local record: the point of the feature is that your other machine finds
  // what this one saw. `docs/research/2026-09-12-seen-marks.md`.
  /** Your own marks, or one canvas's prior mark at its authoritative home.
   *  There is deliberately no way to ask for anybody else's. */
  seen(actorId, canvasId) {
    return this.request("GET", seenMarksRoute(actorId, canvasId));
  }
  /** Move the mark for one canvas to the head you had in front of you. The
   *  answer may be AHEAD of what you sent: another machine of yours may have
   *  got further, and the merge never goes backwards. */
  markSeen(canvasId, seq, actorId) {
    return this.request("PUT", seenRoute(canvasId), {
      seq,
      ...actorId ? { actorId } : {}
    });
  }
  // ---- who may enter a canvas: `isocan share`'s three calls ----
  //
  // The same three routes the Share dialog drives, built from the same core
  // helpers — house rule 2's "button and verb, one endpoint", taken literally
  // enough that neither surface spells a URL. On a replica the daemon forwards
  // all three to the home, because the row that decides who may enter lives
  // there; nothing here has to know that.
  /** Classify before automatic previews or target resolution; unknown remains redacted. */
  classifySource(request, signal) {
    return this.request("GET", sourceClassificationRoute(request), void 0, signal);
  }
  /** Check an explicit tool source without borrowing a stored badge admission. */
  sourceAccess(request, signal) {
    return this.request("POST", SOURCE_ACCESS_ROUTE, request, signal);
  }
  /** Inspect the selected person's binding without creating a canvas. */
  personalStatus(actorId, signal, destinationCanvasId) {
    return this.request("GET", personalRoute(actorId, destinationCanvasId), void 0, signal);
  }
  /** Lazily reserve and create the person's private source at this home. */
  ensurePersonal(actorId, signal, destinationCanvasId) {
    return this.request("POST", `${personalRoute()}/ensure`, { actorId, ...destinationCanvasId ? { destinationCanvasId } : {} }, signal);
  }
  /** Visible personal cards and this caller's current availability, without source bytes. */
  personalLinks(canvasId, actorId, signal) {
    return this.request("GET", personalCanvasRoute(canvasId, void 0, actorId), void 0, signal);
  }
  /** One concrete consent and one undoable native operation per new link. */
  linkPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "link"), request, signal);
  }
  /** Delete the concrete card while retaining its identity-bound consent for undo. */
  unlinkPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "unlink"), request, signal);
  }
  /** The selected owner's source-specific agent access controls. */
  personalDelegates(sourceCanvasId, actorId, signal) {
    return this.request("GET", personalDelegatesRoute(sourceCanvasId, void 0, actorId), void 0, signal);
  }
  /** Explicitly allow or revoke one agent on this exact dataset. */
  setPersonalDelegate(sourceCanvasId, agentId, request, signal) {
    return this.request("PUT", personalDelegatesRoute(sourceCanvasId, agentId), request, signal);
  }
  /** Authoritative owner/delegate reading, with a blob-free summary mode. */
  readPersonal(canvasId, request, signal) {
    return this.request("POST", personalCanvasRoute(canvasId, "read"), request, signal);
  }
  /** The connected home's catalogue, without canvas admission or identity claims. */
  publicCanvases() {
    return this.request("GET", PUBLIC_CANVASES_ROUTE);
  }
  /** Publish or unlist the concrete link an owner inspected. */
  setPublicListing(canvasId, grantId, listed, actorId) {
    return this.request("PUT", publicListingRoute(canvasId, grantId), {
      listed,
      ...actorId ? { actorId } : {}
    });
  }
  grants(canvasId) {
    return this.request("GET", grantsRoute(canvasId));
  }
  createGrant(canvasId, subject, capability, actorId) {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      // Sent whenever it is not edit (`narrowed`), so an older home never
      // meets the field for the one value it has always meant by omission.
      ...narrowed(capability) ? { capability } : {},
      ...actorId ? { actorId } : {}
    });
  }
  /**
   * Keep somebody out (roles phase 3): a bar, written directly. The same
   * POST as an invitation with `bars: true` and no rung; the home replaces
   * any live row naming them and sweeps, so a person inside on the link is
   * put out by the write.
   */
  bar(canvasId, subject, actorId) {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      bars: true,
      ...actorId ? { actorId } : {}
    });
  }
  /** No body, deliberately: a DELETE that declares `application/json` and
   * sends nothing is a Fastify parse error, and a request with nothing to say
   * should not announce a content type. `bar` is `?bar=1` — revoke and keep
   * them out in one request (roles phase 3); the route's spelling is core's. */
  revokeGrant(canvasId, grantId, actorId, bar) {
    return this.request(
      "DELETE",
      grantRevokeRoute(canvasId, grantId, { ...actorId ? { actorId } : {}, ...bar ? { bar } : {} })
    );
  }
  // ---- the space: a named set of canvases access is set on once (roles phase 4) ----
  //
  // The same routes the canvas list's headings and the space's Share dialog
  // drive, built from core's spellings. All at the home; on a replica the
  // daemon forwards through its one home and refuses on a mixed rig.
  spaces() {
    return this.request("GET", SPACES_ROUTE);
  }
  createSpace(name, actorId) {
    return this.request("POST", SPACES_ROUTE, { name, ...actorId ? { actorId } : {} });
  }
  /** No body, for `revokeGrant`'s reason; the actor rides the query. */
  deleteSpace(spaceId, actorId) {
    return this.request("DELETE", spaceActingRoute(spaceRoute(spaceId), actorId));
  }
  addToSpace(spaceId, canvasId, actorId) {
    return this.request("PUT", spaceCanvasRoute(spaceId, canvasId), actorId ? { actorId } : {});
  }
  removeFromSpace(spaceId, canvasId, actorId) {
    return this.request("DELETE", spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actorId));
  }
  spaceGrants(spaceId) {
    return this.request("GET", spaceGrantsRoute(spaceId));
  }
  createSpaceGrant(spaceId, subject, capability, actorId) {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      ...narrowed(capability) ? { capability } : {},
      ...actorId ? { actorId } : {}
    });
  }
  barOnSpace(spaceId, subject, actorId) {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      bars: true,
      ...actorId ? { actorId } : {}
    });
  }
  revokeSpaceGrant(spaceId, grantId, actorId, bar) {
    return this.request(
      "DELETE",
      spaceGrantRevokeRoute(spaceId, grantId, { ...actorId ? { actorId } : {}, ...bar ? { bar } : {} })
    );
  }
  /** **Every canvas in this space**: the link on each canvas set to a rung,
   * or turned off, in one request; the answer says how many it reached. */
  setSpaceLink(spaceId, capability, actorId) {
    return this.request("POST", spaceLinkRoute(spaceId), {
      capability,
      ...actorId ? { actorId } : {}
    });
  }
  // ---- the group: a named set of people access is given to once (roles phase 5) ----
  //
  // `isocan group` and `isocan share group:<name>` drive these; the Groups
  // panel on the canvas list and the Share dialog's picker drive the same
  // routes. All at the home.
  /** The groups this badge's actors made, members and all. */
  groups() {
    return this.request("GET", GROUPS_ROUTE);
  }
  createGroup(name, actorId) {
    return this.request("POST", GROUPS_ROUTE, { name, ...actorId ? { actorId } : {} });
  }
  /** One group: members for its maker; name and size for anybody a live
   * row naming it lets see it. */
  group(groupId) {
    return this.request("GET", groupRoute(groupId));
  }
  addGroupMember(groupId, attribute, actorId) {
    return this.request("PUT", groupMemberRoute(groupId, attribute), actorId ? { actorId } : {});
  }
  /** No body; the actor rides the query. */
  removeGroupMember(groupId, attribute, actorId) {
    return this.request("DELETE", groupActingRoute(groupMemberRoute(groupId, attribute), actorId));
  }
  deleteGroup(groupId, actorId) {
    return this.request("DELETE", groupActingRoute(groupRoute(groupId), actorId));
  }
  // ---- your own surfaces: kill-a-badge (phase 9) ----
  //
  // Not canvas-scoped, unlike the grant routes above, because a badge is not
  // about one canvas: ending one ends that holder's recognition everywhere at
  // once. On a replica the daemon forwards both to the home, which is where
  // the badge that matters lives — see `HomeConnection.badges`.
  badges() {
    return this.request("GET", BADGES_ROUTE);
  }
  /** No body, for `revokeGrant`'s reason. */
  killBadge(badgeId) {
    return this.request("DELETE", badgeRoute(badgeId));
  }
  // ---- passes: the escalation credential (Scene 5) ----
  //
  // Two routes, deliberately different shapes, and the CLI does not get to
  // decide which: `passesRoute` is canvas-scoped so the door has already
  // asked whether this badge may mint for this canvas, and `PASS_REDEEM_ROUTE`
  // is flat because the redeemer is BY DEFINITION not admitted yet. Both
  // spellings come from `@isocan/core`, like the grant routes above and for
  // the same reason — stage 3's dialog drives the identical pair.
  //
  // On a replica both forward to the home. That is not an optimization: a pass
  // is desk state, single-use is only single across the desk that holds the
  // row, and the badge a redeemed pass endows has to be the one the HOME will
  // see presented. Nothing here has to know that, which is the point.
  /** Mint one for this canvas. `actorId` endows the claim; omitting it mints
   * the admission-only shape. The token comes back exactly once. */
  mintPass(canvasId, actorId) {
    return this.request("POST", passesRoute(canvasId), actorId ? { actorId } : {});
  }
  /** One pass this badge minted, read back without its secret: whether it
   * was spent, and by which badge (`redeemedBy`). `unknown-pass` for any
   * pass this badge did not mint. */
  pass(canvasId, passId) {
    return this.request("GET", passRoute(canvasId, passId));
  }
  /**
   * Redeem one: this daemon's badge comes away admitted at the home and, when
   * the pass named a claim, holding it.
   *
   * **The answer is the only announcement there will ever be.** The handoff
   * row carries no session key by design, and `GET /api/actors` is keyed by
   * session key — so a caller that throws this response away cannot ask for
   * it again, and the identity the pass endowed becomes unreachable from this
   * machine even though the badge still holds it. Replica setup opts into
   * local adoption so the daemon saves it alongside its badge writes. Direct
   * setup leaves the remote machine alone and saves it in the CLI process.
   */
  redeemPass(token, home, adoptIdentity = false) {
    const elsewhere = home !== void 0 && normalizeHomeUrl(home) !== normalizeHomeUrl(this.base);
    return this.request("POST", PASS_REDEEM_ROUTE, {
      token,
      ...adoptIdentity ? { adoptIdentity: true } : {},
      ...elsewhere ? { home: normalizeHomeUrl(home) } : {}
    });
  }
  /**
   * Ask this daemon to fetch one canvas from its home — the arrival that
   * carries an ADDRESS and no admission (a cloned marker, a pass-less
   * `setup`). `HOME_JOIN_ROUTE` in core carries the reasoning.
   *
   * Refuses `not-a-replica` (409) on a home, which is a fine answer to get:
   * callers that ask speculatively — binding resolution does — carry on and
   * report whatever they were going to report anyway.
   *
   * **`home` is the address the MARKER names**, and passing it is what makes
   * phase 10.3's good case work: a repo cloned onto a machine that has never
   * dialled the home its `.isocan/project.json` names. That used to be refused
   * outright, because joining meant repointing the whole machine; now the
   * daemon opens a link to that address, is tested at its door, and writes the
   * row — and nothing else on this machine moves. Omitting it falls back to
   * the birth default, which is what a marker naming no home deserves.
   */
  async joinFromHome(canvasId, home) {
    const { canvas } = await this.request("POST", HOME_JOIN_ROUTE, {
      canvasId,
      ...home !== void 0 ? { home } : {}
    });
    return canvas;
  }
  /**
   * **Which canvas lives where, and which homes are answering.**
   *
   * The one read behind every per-canvas home question (`HOMES_ROUTE` in core
   * has the list). It replaces the health route's `home` field for everything
   * except "where would the next canvas be born", which is the only thing that
   * field still means.
   */
  homes() {
    return this.request("GET", HOMES_ROUTE);
  }
  /** Complete current scope; omitted roots read ambient pins. Reads never move presence. */
  contextManifest(canvasId, request) {
    const query = new URLSearchParams();
    if (request) {
      query.set("roots", request.rootIds.join(","));
      if (request.includeExcluded !== void 0) query.set("includeExcluded", String(request.includeExcluded));
      if (request.expectedRevision !== void 0) query.set("expectedRevision", String(request.expectedRevision));
    }
    return this.request("GET", `${canvasContextRoute(canvasId)}${query.size ? `?${query}` : ""}`);
  }
  /** Frozen provenance belongs to the saved comment, not today's membership. */
  commentContext(canvasId, threadId, commentId) {
    return this.request("GET", commentContextRoute(canvasId, threadId, commentId));
  }
  contextContentPage(canvasId, options) {
    if (!!options.threadId !== !!options.commentId) throw new Error("a saved context requires both thread and comment IDs");
    if (options.threadId && (options.rootIds !== void 0 || options.includeExcluded !== void 0 || options.expectedRevision !== void 0)) throw new Error("saved context already fixes its roots, exclusion policy and revision");
    if (!options.threadId && options.expectedRevision === void 0) throw new Error("live context paging requires expectedRevision from its manifest");
    const query = new URLSearchParams();
    if (options.rootIds !== void 0) query.set("roots", options.rootIds.join(","));
    for (const field of ["offset", "limit", "face", "includeExcluded", "expectedRevision"]) {
      if (options[field] !== void 0) query.set(field, String(options[field]));
    }
    const route = options.threadId ? commentContextRoute(canvasId, options.threadId, options.commentId) : canvasContextRoute(canvasId);
    return this.request("GET", `${route}/content${query.size ? `?${query}` : ""}`);
  }
  /** A bounded ordinary-source history head; the authority refuses personal sources before reads. */
  recapHead(canvasId, signal) {
    return this.request("GET", recapHeadRoute(canvasId), void 0, signal);
  }
  async snapshot(canvasId, signal) {
    const snapshot = await this.request("GET", `/api/projects/${canvasId}/canvas`, void 0, signal);
    this.observedGroupModes.set(canvasId, snapshot.project.groupMode ?? "legacy");
    return snapshot;
  }
  /** How this home serves — today, only whether a content origin exists. */
  serving() {
    return this.request("GET", SERVING_ROUTE);
  }
  /** The name each actor goes by now. A snapshot already carries this; it is
   * fetched on its own for commands that print names without one. */
  actorNames() {
    return this.request("GET", "/api/names");
  }
  /** Who is an agent — actor id → "agent" for every actor whose last claim
   * came from a harness that is not a person's; people absent. A daemon from
   * before the route answers its SPA fallback, which parses to nothing. */
  actorKinds() {
    return this.request("GET", ACTOR_KINDS_ROUTE);
  }
  /** Who is on which canvas right now, across every room this daemon can see
   * and the caller may enter — see `PRESENCE_WHERE_ROUTE`. */
  presenceWhere() {
    return this.request("GET", PRESENCE_WHERE_ROUTE);
  }
  /** What changed, for the person using this — release notes from the home
   *  this CLI is talking to, so what it lists is what that home is running. */
  news() {
    return this.request("GET", NEWS_ROUTE);
  }
  /** Every slash command available here: built-ins under this home's own. */
  commands() {
    return this.request("GET", `/api/commands`);
  }
  /** Write one for this home. `text` is the file, frontmatter and all. */
  saveCommand(name, text) {
    return this.request("PUT", `/api/commands/${encodeURIComponent(name)}`, { text });
  }
  /** Remove one of this home's; the built-in of that name comes back. */
  deleteCommand(name) {
    return this.request("DELETE", `/api/commands/${encodeURIComponent(name)}`);
  }
  /** With waitMs, the daemon long-polls: holds until an entry lands past
   * `since` or the window closes (empty array). */
  /** The bound directory's listing — owner-scoped, answered only by the
   * canvas's own local daemon (`tree.ts` has the rules). */
  getTree(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/tree`);
  }
  /** Write an item's current version out to the directory bound here — the
   * other direction from `＋` (`docs/projects/workbench/files-on-disk.md`). */
  writeItem(canvasId, itemId, force = false) {
    return this.request("POST", `/api/projects/${canvasId}/write`, { itemId, force });
  }
  /** What this machine's disk says about the canvas's tracked items. */
  getBacking(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/backing`);
  }
  getLog(canvasId, since, waitMs) {
    const wait = waitMs !== void 0 ? `&waitMs=${waitMs}` : "";
    return this.request("GET", `/api/projects/${canvasId}/oplog?since=${since}${wait}`);
  }
  /** What `gc` compacted out of the live log, oldest first — empty until a
   * compaction has happened. `getLog` + this is the complete history. */
  getArchivedLog(canvasId) {
    return this.request("GET", `/api/projects/${canvasId}/oplog/archive`);
  }
  /** Every canvas at once. Omit `cursors` to seed at "now"; otherwise the
   * daemon long-polls until an op lands on any canvas. `signal` aborts a held
   * poll — what lets `tail()` stop listening mid-window instead of after it. */
  watchLog(request, signal) {
    return this.request("POST", "/api/oplog/watch", request, signal);
  }
  // ---- the durable park cursor (on-demand phase 1) ----
  /** Adopt (or create) this actor's cursor row on a canvas. The returned
   * `parkId` is the lease every delivery and advance must carry. */
  parkClaim(request) {
    return this.request("POST", "/api/park/claim", request);
  }
  /** A wake handed entries out — record the high-water. Refused with
   * `PARK_ADOPTED_CODE` when another park has adopted the row. */
  parkDelivered(request) {
    return this.request("POST", "/api/park/delivered", request);
  }
  /** A lap matched nothing — settle the noise without a turn. Same refusal. */
  parkAdvance(request) {
    return this.request("POST", "/api/park/advance", request);
  }
  /** The rc's connection-bound liveness (phase 6): held open for `waitMs`,
   * during which these agents read as answerable. Re-issue back-to-back;
   * the fact dies with the socket, which is the whole point. The response
   * carries any web asks that arrived while held (agent-custody) — the rc
   * enrolls each and keeps holding. */
  rcHold(request, signal) {
    return this.request("POST", "/api/rc/hold", request, signal);
  }
  /** Explicit release when an rc stops (issue #308), beside socket close:
   * on a hosted home an aborted fetch's close can take seconds to cross
   * Cloud Run's front end, so `stop()` releases the hold at once before
   * aborting its long polls. */
  rcRelease(request) {
    return this.request("POST", "/api/rc/release", request);
  }
  /** Who a live rc answers for on this canvas — and whether any is parked at
   * all — as the canvas's home has it: a daemon that is not the home asks the
   * home and folds in its own holds (issue #306). */
  rcAnswering(canvasId) {
    return this.request("GET", rcAnsweringRoute(canvasId));
  }
  undo(canvasId, actor) {
    return this.request("POST", `/api/projects/${canvasId}/undo`, { actor });
  }
  redo(canvasId, actor) {
    return this.request("POST", `/api/projects/${canvasId}/redo`, { actor });
  }
  /** Ask whether the home holds every blob this canvas names, and optionally
   *  send the ones it does not. */
  reconcileBlobs(canvasId, push) {
    return this.request("POST", `/api/projects/${canvasId}/blobs/reconcile`, { push });
  }
  /** Send a canvas to another home, or ask what that would move. */
  teleport(canvasId, to, dryRun) {
    return this.request("POST", `/api/projects/${canvasId}/teleport`, { to, dryRun });
  }
  /** Hand a home a whole canvas as somebody else's log — teleport's far end,
   *  and what `isocan import` restores a backup through. Creates, never
   *  merges: a canvas already at the home is refused. */
  adopt(canvasId, entries) {
    return this.request("POST", `/api/projects/${canvasId}/adopt`, { entries });
  }
  gc(canvasId, request) {
    return this.request("POST", `/api/projects/${canvasId}/gc`, request);
  }
  /** Every canvas this badge is admitted to at this home, in one sweep — the
   * same per-canvas policy, aggregated (phase 13.7). Names no canvas, so it
   * works in a directory that is bound to none. */
  gcHome(request) {
    return this.request("POST", HOME_GC_ROUTE, request);
  }
  // ---- the operator (docs/projects/operator/design.md, phase 1) ----
  //
  // **Two reads, and each one presents a proof that was made a moment ago in a
  // browser.** They are here, on the typed route surface, rather than in the
  // CLI's own `fetch`, for this class's whole reason: everything a surface can
  // ask a daemon is one method with one shape, and a second spelling of the
  // proof header is a second place for it to drift from the server's.
  //
  // Nothing here holds the token. It is a parameter, used for one request and
  // dropped with the stack frame — decision D2's "the CLI holds the token in
  // memory for one invocation", expressed as the absence of a field.
  /** What this home holds under that id (journey 1 step 4). Changes nothing. */
  async operatorShow(canvasId, proof) {
    return this.request(
      "GET",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}`,
      void 0,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /** The ledger, newest first — the operator reads it and nobody else does. */
  async operatorLog(proof, options = {}) {
    const query = new URLSearchParams();
    if (options.target) query.set("target", options.target);
    if (options.limit !== void 0) query.set("limit", String(options.limit));
    const suffix = query.toString();
    return this.request(
      "GET",
      `${OPERATOR_LOG_ROUTE}${suffix ? `?${suffix}` : ""}`,
      void 0,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  // ---- operator phase 2: the look and the takedown ----
  //
  // The first operator methods that CHANGE anything, so they are POSTs, and
  // they carry the proof in exactly the header the two reads above carry it
  // in. Nothing here holds the token: a parameter, one request, dropped with
  // the stack frame (decision D2).
  /** Mint the look — a pass this home redeems into the operator's browser as
   * an admission at `view` until `until`. The address to open is built by
   * `operatorLookUrl` in core, from the home the caller proved at. */
  async operatorLook(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/look`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /** Take it down, or lift it. One method and one route for both, because
   * they are one act with a direction: the reach, the row and the refusals are
   * the same shape either way, and a second verb would be a second place for
   * the ledger's `act` to be spelled. */
  async operatorTakedown(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/takedown`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **End a surface** (operator phase 4) — by badge id, actor id or
   * `email:` address, which is the id a report names. Sent twice by the verb:
   * once with `preview` to read the reach, once to act on it. Same header,
   * same proof, same shape as the takedown.
   */
  async operatorEnd(target, proof, request) {
    return this.request(
      "POST",
      `/api/operator/end/${encodeURIComponent(target)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Turn off a grant** (operator phase 5) — on a canvas or a space, by the
   * subject a report names, with `bar` to keep them out as the owner's
   * `?bar=1` does. Same header, same proof, same shape as the takedown.
   */
  async operatorRevoke(target, proof, request) {
    return this.request(
      "POST",
      `/api/operator/revoke/${encodeURIComponent(target)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Refuse at the door** (operator phase 6) — a subject a report names:
   * `email:…`, `repo:…`, `actor:…` or `net:<cidr>`, with `for` to expire it
   * and `lift` to end it early. Same header, same proof, same shape as the
   * takedown. The subject rides in the path, URL-encoded, because a `net:`
   * carries a slash.
   */
  async operatorRefuse(subject, proof, request) {
    return this.request(
      "POST",
      `/api/operator/refuse/${encodeURIComponent(subject)}`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **Erase the bytes** (operator phase 3) — the one operator act that cannot
   * be lifted, and the one whose body is a single word. The route refuses
   * without `force`, and refuses on a canvas that is not taken down whatever
   * `force` says. Same header, same proof, same shape as the takedown.
   */
  async operatorPurge(canvasId, proof, request) {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/purge`,
      request,
      void 0,
      { [OPERATOR_PROOF_HEADER]: proof }
    );
  }
  /**
   * **The sentence, for the people it happened to** — not an operator read.
   *
   * With a canvas id: that one, answered to anybody, because the door already
   * says it in its refusal. Without: the ones in force among the canvases this
   * badge may see, which is what a canvas list draws beside its rows.
   */
  async takedowns(canvasId) {
    const suffix = canvasId ? `?${TAKEDOWNS_CANVAS_PARAM}=${encodeURIComponent(canvasId)}` : "";
    return this.request("GET", `${TAKEDOWNS_ROUTE}${suffix}`);
  }
  async uploadBlob(canvasId, data, mimeType, filename, signal) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const send = async () => {
      const auth = await this.authHeader();
      signal?.throwIfAborted();
      return this.fetcher(`${this.base}/api/projects/${canvasId}/blobs`, {
        method: "POST",
        headers: {
          ...auth,
          ...this.policyHeaders(),
          "Content-Type": mimeType,
          [FILENAME_HEADER]: encodeFilename(filename)
        },
        body: new Uint8Array(data),
        ...signal ? { signal } : {}
      });
    };
    let res = await send();
    if (res.status === 401 && await this.reBadge(signal)) res = await send();
    const json = await res.json().catch(() => null);
    signal?.throwIfAborted();
    if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    return json;
  }
  async downloadBlob(canvasId, blobHash, signal) {
    signal = this.requestSignal(signal);
    signal?.throwIfAborted();
    const send = async () => {
      const headers = { ...await this.authHeader(), ...this.policyHeaders() };
      signal?.throwIfAborted();
      return this.fetcher(`${this.base}/api/projects/${canvasId}/blobs/${blobHash}`, {
        headers,
        ...signal ? { signal } : {}
      });
    };
    let res = await send();
    if (res.status === 401 && await this.reBadge(signal)) res = await send();
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      throw new ApiError(res.status, json?.error ?? `blob not found: ${blobHash}`, json?.code, json?.reason);
    }
    return new Uint8Array(await res.arrayBuffer());
  }
};

export {
  OPERATIONS_ROUTE,
  platformFetch,
  DaemonRoutes
};
