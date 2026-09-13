import type {
  Actor,
  ActorBindingRecord,
  ActorClaimOp,
  BadgesResponse,
  BlobUploadResponse,
  Capability,
  CanvasSnapshotResponse,
  CreateSessionResponse,
  GcReport,
  GcRequest,
  HomeGcReport,
  GrantResponse,
  GrantsResponse,
  GrantSubject,
  HomesResponse,
  JoinCanvasRequest,
  JoinCanvasResponse,
  KillBadgeResponse,
  LogEntry,
  MintPassResponse,
  PassResponse,
  Operation,
  PostOpResponse,
  PresenceSession,
  Canvas,
  RedeemPassResponse,
  UpdateSessionRequest,
  ParkAdvanceRequest,
  ParkClaimRequest,
  ParkClaimResponse,
  ParkDeliveredRequest,
  RcAnsweringResponse,
  RcHoldRequest,
  RcHoldResponse,
  WatchLogRequest,
  WatchLogResponse,
  ActorNames,
  ActorKinds,
  NewsResponse,
  PresenceWhereResponse,
  ServingResponse,
  SlashCommand,
  SpaceCanvasResponse,
  SpaceLinkRequest,
  SpaceLinkResponse,
  SpaceResponse,
  SpacesResponse,
  SeenMarksResponse,
  SeenResponse,
  GroupResponse,
  GroupAction,
  GroupsResponse,
  OperatorLogResponse,
  OperatorLookRequest,
  OperatorLookResponse,
  OperatorPurgeRequest,
  OperatorPurgeResponse,
  OperatorShowResponse,
  OperatorTakedownRequest,
  OperatorTakedownResponse,
  OperatorEndRequest,
  OperatorEndResponse,
  OperatorRevokeRequest,
  OperatorRevokeResponse,
  TakedownsResponse,
} from "@isocan/core";
import {
  BADGE_ENDED,
  CANVAS_GROUPS_FEATURE,
  CLIENT_FEATURES_HEADER,
  encodeFilename,
  groupActingRoute,
  groupMemberRoute,
  groupRoute,
  GROUPS_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_PROOF_HEADER,
  TAKEDOWNS_CANVAS_PARAM,
  TAKEDOWNS_ROUTE,
  spaceActingRoute,
  spaceCanvasRoute,
  spaceGrantRevokeRoute,
  spaceGrantsRoute,
  spaceLinkRoute,
  SEEN_ROUTE,
  seenRoute,
  spaceRoute,
  SPACES_ROUTE,
  FILENAME_HEADER,
  NEWS_ROUTE,
  PRESENCE_WHERE_ROUTE,
  ACTOR_KINDS_ROUTE,
  badgeRoute,
  BADGES_ROUTE,
  grantRevokeRoute,
  grantsRoute,
  healthPath,
  narrowed,
  HOME_GC_ROUTE,
  HOME_JOIN_ROUTE,
  HOMES_ROUTE,
  normalizeHomeUrl,
  PASS_REDEEM_ROUTE,
  passesRoute,
  passRoute,
  SERVING_ROUTE,
} from "@isocan/core";
import type { UpgradeVerdict } from "@isocan/core";
import type { BuildStamp, StoredBadge } from "@isocan/server";
import { askTheDoor, bearerHeader, readBadge, writeBadge } from "@isocan/server";

/** The health route: who is holding the port, and which build they are. */
export interface Health extends Partial<BuildStamp> {
  ok: true;
  pid: number;
  startedAt: string;
  /**
   * **The BIRTH DEFAULT** — where a canvas born on this daemon, naming
   * nothing, is born. Absent means it is born right here.
   *
   * The key is older than that meaning. Until phase 10.3 it said "the home
   * this daemon is a replica of", which was a whole-daemon fact because a
   * daemon had one home; now the home is a property of the canvas and that
   * sentence has no referent. The key survived with its meaning redefined
   * rather than dropped, because `stalenessOf` reads this body and so does
   * every CLI older than the daemon answering it — and the birth default is
   * the one whole-daemon answer that still exists.
   *
   * **Never use it to build a canvas's address.** That is now
   * `Ctx.homeOf(canvasId)`, off `GET /api/homes`: on a machine with two
   * homes this value is where the NEXT canvas goes, and printing it for a
   * canvas that lives somewhere else is the cheerful wrong address in the one
   * string a person pastes to another person.
   */
  home?: string;
  /**
   * **This daemon disagrees with the home it is talking to about which build
   * to be** (auto-upgrade phase 2) — or, with `available: false`, has asked
   * and does not.
   *
   * Absent is the ordinary case and it means NO VERDICT: a homeless daemon, a
   * home that is not answering, a home too old to name its own commit, or a
   * daemon older than this field. It never means "you are current"; the field
   * says that itself when it can.
   */
  upgrade?: UpgradeVerdict;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    /** Why, when the code alone does not say — `withdrawn` on a
     * `not-admitted` from a badge that had been inside. */
    readonly reason?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * **The typed route surface** — every request the daemon answers, typed, and
 * nothing about how a daemon comes to exist.
 *
 * This class is the half of the Node client that the unsolved browser-kernel
 * twist depends on staying separable (iso-api design.md, "the surfaces stay in
 * lockstep"): it constructs requests and heals refused ones, and it never
 * imports the Node-only half — no `node:child_process`, no daemon spawn, no
 * `homes.json`. `DaemonClient` in `client.ts` extends it with exactly that
 * half, and `packages/api/test/boundary.test.ts` is what keeps the line a
 * fact rather than an intention.
 */
export class DaemonRoutes {
  /** Loaded once per process, from `identity.json`'s `auth` block. */
  private badge: StoredBadge | null | undefined;

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
  private reclaim: (() => Promise<void>) | null = null;
  private reclaiming = false;

  constructor(
    readonly base: string,
    readonly home: string,
  ) {}

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
  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    signal?: AbortSignal,
    /**
     * Headers beside the badge, for the one caller that has a second thing to
     * present: the operator's proof (`OPERATOR_PROOF_HEADER`). It rides HERE
     * rather than replacing `Authorization` because the request still carries
     * its badge through the door unchanged — two credentials answering two
     * different questions, which is what keeps operator standing off the badge.
     */
    extra?: Record<string, string>,
  ): Promise<T> {
    const send = async () => {
      const headers: Record<string, string> = { ...(await this.authHeader()), [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE, ...extra };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      return fetch(`${this.base}${url}`, {
        method,
        ...(signal !== undefined ? { signal } : {}),
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    };
    let res = await send();
    let json = (await res.json().catch(() => null)) as any;
    /**
     * **An end by the operator is not recovered from** (operator phase 4;
     * journey 7 step 4: *Sam's CLI does not quietly knock for a new badge and
     * speak as his old name. It prints the sentence and stops.*).
     *
     * The 401 carries the tombstone's reason. `holder` — a sign-out, a lost
     * laptop ended from the phone — keeps the quiet re-badge below, which is
     * what lost-badge recovery is: knock, re-claim, replay, nobody told. But a
     * re-badge after the OPERATOR ended this surface would reclaim the same
     * actor under a fresh badge a second later, and the engine's vouch would
     * allow it, because no live badge holds the name any more. So the
     * sentence is thrown as the answer, in the home's own words. The person
     * can still knock as a stranger by choosing to — ending is not refusing,
     * and the verb that ended them said so.
     */
    if (res.status === 401 && json?.code === BADGE_ENDED && json?.reason === "operator") {
      throw new ApiError(401, json.error, BADGE_ENDED, "operator");
    }
    const recovered =
      res.status === 401
        ? await this.reBadge()
        : json?.code === "not-your-actor" && (await this.reclaimIdentity());
    if (recovered) {
      res = await send();
      json = (await res.json().catch(() => null)) as any;
    }
    if (!res.ok) {
      throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code, json?.reason);
    }
    return json as T;
  }

  /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
  private async authHeader(): Promise<Record<string, string>> {
    const badge = await this.storedBadge();
    return badge ? bearerHeader(badge) : {};
  }

  private async storedBadge(): Promise<StoredBadge | null> {
    if (this.badge === undefined) this.badge = await readBadge(this.home, this.base);
    return this.badge;
  }

  /** Go to the door and keep what it hands over. Returns false if the door
   * itself refused, so a caller does not loop.
   *
   * **One refusal is not silent: a metered door** (phase 13.7). The rest stay
   * false and let the original refusal be the one reported — but a 429 must
   * not, because the sentence the caller would otherwise print is the 401 this
   * recovery was launched from: *"a badge is required — ask the door for
   * one."* That is advice to repeat the thing that was just refused. Throwing
   * the door's own words instead ends the command with what actually happened
   * and how long to wait, in `{error, code}` an agent can read. */
  private async reBadge(): Promise<boolean> {
    const answer = await askTheDoor(this.base);
    if ("refused" in answer) {
      if (answer.refused.status === 429) {
        throw new ApiError(429, answer.refused.error, answer.refused.code);
      }
      return false;
    }
    const badge = answer.badge;
    this.badge = badge;
    await writeBadge(this.home, this.base, badge);
    // Re-claim, THEN replay. Without this the recovery path is a 401
    // followed by a `not-your-actor`: the door mints a badge whose claims
    // are empty while the client goes on asserting the actor it has held
    // all along.
    await this.reclaimIdentity();
    return true;
  }

  /** How to prove who this command speaks as, if the home asks. Registered by
   * `resolveIdentity` the moment that is known. */
  reclaimWith(reclaim: () => Promise<void>): void {
    this.reclaim = reclaim;
  }

  /** Claim the identity this command speaks as. False when there is nothing
   * to claim or the home refused, so a caller does not replay into the same
   * refusal twice. The guard is against the claim's OWN request coming back
   * around here. */
  private async reclaimIdentity(): Promise<boolean> {
    if (!this.reclaim || this.reclaiming) return false;
    this.reclaiming = true;
    try {
      await this.reclaim();
      return true;
    } catch {
      // The actor is somebody else's now, or the name collides. The replay's
      // refusal says so in the caller's own words rather than this one's.
      return false;
    } finally {
      this.reclaiming = false;
    }
  }

  /** The badge this client is presenting, for `whoami` to print. Never the
   * secret. */
  async badgeId(): Promise<string | null> {
    return (await this.storedBadge())?.badgeId ?? null;
  }

  async health(timeoutMs = 300): Promise<boolean> {
    return (await this.healthz(timeoutMs)) !== null;
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
  async awaitHealth(deadlineMs = 10_000): Promise<boolean> {
    const deadline = Date.now() + deadlineMs;
    for (;;) {
      if (await this.health(1000)) return true;
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
  async healthz(timeoutMs = 300): Promise<Health | null> {
    try {
      const res = await fetch(`${this.base}${healthPath(this.base)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
      return res.ok ? ((await res.json()) as Health) : null;
    } catch {
      return null;
    }
  }

  /** Name (or resume) the actor behind a session key — the one op sent
   * without an actor: the response envelope says who you are. */
  claimActor(op: ActorClaimOp): Promise<PostOpResponse> {
    return this.request("POST", "/api/ops", { canvasId: null, op });
  }

  /** Who the given session keys speak as (everyone, when omitted). */
  actorBindings(keys?: string[]): Promise<ActorBindingRecord[]> {
    const query = keys?.length ? `?keys=${keys.map(encodeURIComponent).join(",")}` : "";
    return this.request("GET", `/api/actors${query}`);
  }

  /** Claims for these session keys held by a badge that is not this one —
   * what a client whose badge was lost needs in order to be told the truth
   * about why it has no identity. Never adopts; only reports. */
  orphanedActors(keys: string[]): Promise<ActorBindingRecord[]> {
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
  sendOp(
    canvasId: string | null,
    actor: Actor,
    op: Operation,
    clientId?: string,
    home?: string,
    /** **One gesture, one undo** — see `LogEntry.group`. Ops sent under one
     *  id are undone together, so `isocan copy` writing eight items is one
     *  ⌘Z on the screen watching it. */
    group?: string,
  ): Promise<PostOpResponse> {
    return this.request("POST", "/api/ops", {
      canvasId,
      actor,
      op,
      ...(clientId !== undefined ? { clientId } : {}),
      ...(home !== undefined ? { home } : {}),
      ...(group !== undefined ? { group } : {}),
    });
  }

  // ---- presence sessions ----

  /** Semantic group request; canonical resolved patches belong to the
   * authoritative writer. Pass a stable opId when retrying one intent. */
  changeGroup(
    canvasId: string,
    actor: Actor,
    action: Exclude<GroupAction, { kind: "apply" }>,
    opId?: string,
  ): Promise<PostOpResponse> {
    return this.request("POST", "/api/ops", { canvasId, actor, op: { type: "group.change", action }, ...(opId ? { opId } : {}) });
  }

  createSession(
    canvasId: string,
    actor: Actor,
    label?: string,
    harness?: string,
    /** "rc": a parked `isocan rc` announcing itself — a process fact on the
     * presence plane, rendered nowhere. Defaults to "cli". */
    kind?: "cli" | "rc",
  ): Promise<CreateSessionResponse> {
    return this.request("POST", `/api/projects/${canvasId}/sessions`, {
      actor,
      ...(label !== undefined ? { label } : {}),
      ...(harness !== undefined ? { harness } : {}),
      ...(kind !== undefined ? { kind } : {}),
    });
  }

  updateSession(
    canvasId: string,
    sessionId: string,
    patch: UpdateSessionRequest,
  ): Promise<{ ok: true; cancelled?: { threadId: string; by: string; at: string } }> {
    return this.request("PUT", `/api/projects/${canvasId}/sessions/${sessionId}`, patch);
  }

  endSession(canvasId: string, sessionId: string): Promise<{ ok: true }> {
    return this.request("DELETE", `/api/projects/${canvasId}/sessions/${sessionId}`);
  }

  listSessions(canvasId: string): Promise<PresenceSession[]> {
    return this.request("GET", `/api/projects/${canvasId}/sessions`);
  }

  /** End every session an actor holds — the daemon-side truth, for when the
   * local session pointer has been lost. */
  endActorSessions(actorId: string, kind?: "web" | "cli"): Promise<{ ended: number }> {
    const query = kind ? `?kind=${kind}` : "";
    return this.request("DELETE", `/api/presence/actors/${actorId}${query}`);
  }

  listCanvases(): Promise<Canvas[]> {
    return this.request("GET", "/api/projects");
  }

  // ---- what you have already seen (#147, #134) ----
  //
  // Desk state at the home, so this asks the daemon rather than keeping a
  // local record: the point of the feature is that your other machine finds
  // what this one saw. `docs/research/2026-09-12-seen-marks.md`.

  /** Your own marks, every canvas, one read. There is deliberately no way to
   *  ask for anybody else's. */
  seen(actorId?: string): Promise<SeenMarksResponse> {
    const query = actorId ? `?actorId=${encodeURIComponent(actorId)}` : "";
    return this.request("GET", `${SEEN_ROUTE}${query}`);
  }

  /** Move the mark for one canvas to the head you had in front of you. The
   *  answer may be AHEAD of what you sent: another machine of yours may have
   *  got further, and the merge never goes backwards. */
  markSeen(canvasId: string, seq: number, actorId?: string): Promise<SeenResponse> {
    return this.request("PUT", seenRoute(canvasId), {
      seq,
      ...(actorId ? { actorId } : {}),
    });
  }

  // ---- who may enter a canvas: `isocan share`'s three calls ----
  //
  // The same three routes the Share dialog drives, built from the same core
  // helpers — house rule 2's "button and verb, one endpoint", taken literally
  // enough that neither surface spells a URL. On a replica the daemon forwards
  // all three to the home, because the row that decides who may enter lives
  // there; nothing here has to know that.

  grants(canvasId: string): Promise<GrantsResponse> {
    return this.request("GET", grantsRoute(canvasId));
  }

  createGrant(
    canvasId: string,
    subject: GrantSubject,
    capability?: Capability,
    /** Who is acting — the CLI's actor. A write to grants asks `own`, which
     * a person holds, and a badge may speak for several. */
    actorId?: string,
  ): Promise<GrantResponse> {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      // Sent whenever it is not edit (`narrowed`), so an older home never
      // meets the field for the one value it has always meant by omission.
      ...(narrowed(capability) ? { capability } : {}),
      ...(actorId ? { actorId } : {}),
    });
  }

  /**
   * Keep somebody out (roles phase 3): a bar, written directly. The same
   * POST as an invitation with `bars: true` and no rung; the home replaces
   * any live row naming them and sweeps, so a person inside on the link is
   * put out by the write.
   */
  bar(canvasId: string, subject: GrantSubject, actorId?: string): Promise<GrantResponse> {
    return this.request("POST", grantsRoute(canvasId), {
      subject,
      bars: true,
      ...(actorId ? { actorId } : {}),
    });
  }

  /** No body, deliberately: a DELETE that declares `application/json` and
   * sends nothing is a Fastify parse error, and a request with nothing to say
   * should not announce a content type. `bar` is `?bar=1` — revoke and keep
   * them out in one request (roles phase 3); the route's spelling is core's. */
  revokeGrant(
    canvasId: string,
    grantId: string,
    actorId?: string,
    bar?: boolean,
  ): Promise<GrantResponse> {
    return this.request(
      "DELETE",
      grantRevokeRoute(canvasId, grantId, { ...(actorId ? { actorId } : {}), ...(bar ? { bar } : {}) }),
    );
  }

  // ---- the space: a named set of canvases access is set on once (roles phase 4) ----
  //
  // The same routes the canvas list's headings and the space's Share dialog
  // drive, built from core's spellings. All at the home; on a replica the
  // daemon forwards through its one home and refuses on a mixed rig.

  spaces(): Promise<SpacesResponse> {
    return this.request("GET", SPACES_ROUTE);
  }

  createSpace(name: string, actorId?: string): Promise<SpaceResponse> {
    return this.request("POST", SPACES_ROUTE, { name, ...(actorId ? { actorId } : {}) });
  }

  /** No body, for `revokeGrant`'s reason; the actor rides the query. */
  deleteSpace(spaceId: string, actorId?: string): Promise<SpaceCanvasResponse> {
    return this.request("DELETE", spaceActingRoute(spaceRoute(spaceId), actorId));
  }

  addToSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse> {
    return this.request("PUT", spaceCanvasRoute(spaceId, canvasId), actorId ? { actorId } : {});
  }

  removeFromSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse> {
    return this.request("DELETE", spaceActingRoute(spaceCanvasRoute(spaceId, canvasId), actorId));
  }

  spaceGrants(spaceId: string): Promise<GrantsResponse> {
    return this.request("GET", spaceGrantsRoute(spaceId));
  }

  createSpaceGrant(
    spaceId: string,
    subject: GrantSubject,
    capability?: Capability,
    actorId?: string,
  ): Promise<GrantResponse> {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      ...(narrowed(capability) ? { capability } : {}),
      ...(actorId ? { actorId } : {}),
    });
  }

  barOnSpace(spaceId: string, subject: GrantSubject, actorId?: string): Promise<GrantResponse> {
    return this.request("POST", spaceGrantsRoute(spaceId), {
      subject,
      bars: true,
      ...(actorId ? { actorId } : {}),
    });
  }

  revokeSpaceGrant(
    spaceId: string,
    grantId: string,
    actorId?: string,
    bar?: boolean,
  ): Promise<GrantResponse> {
    return this.request(
      "DELETE",
      spaceGrantRevokeRoute(spaceId, grantId, { ...(actorId ? { actorId } : {}), ...(bar ? { bar } : {}) }),
    );
  }

  /** **Every canvas in this space**: the link on each canvas set to a rung,
   * or turned off, in one request; the answer says how many it reached. */
  setSpaceLink(
    spaceId: string,
    capability: SpaceLinkRequest["capability"],
    actorId?: string,
  ): Promise<SpaceLinkResponse> {
    return this.request("POST", spaceLinkRoute(spaceId), {
      capability,
      ...(actorId ? { actorId } : {}),
    } satisfies SpaceLinkRequest);
  }

  // ---- the group: a named set of people access is given to once (roles phase 5) ----
  //
  // `isocan group` and `isocan share group:<name>` drive these; the Groups
  // panel on the canvas list and the Share dialog's picker drive the same
  // routes. All at the home.

  /** The groups this badge's actors made, members and all. */
  groups(): Promise<GroupsResponse> {
    return this.request("GET", GROUPS_ROUTE);
  }

  createGroup(name: string, actorId?: string): Promise<GroupResponse> {
    return this.request("POST", GROUPS_ROUTE, { name, ...(actorId ? { actorId } : {}) });
  }

  /** One group: members for its maker; name and size for anybody a live
   * row naming it lets see it. */
  group(groupId: string): Promise<GroupResponse> {
    return this.request("GET", groupRoute(groupId));
  }

  addGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse> {
    return this.request("PUT", groupMemberRoute(groupId, attribute), actorId ? { actorId } : {});
  }

  /** No body; the actor rides the query. */
  removeGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse> {
    return this.request("DELETE", groupActingRoute(groupMemberRoute(groupId, attribute), actorId));
  }

  deleteGroup(groupId: string, actorId?: string): Promise<GroupResponse> {
    return this.request("DELETE", groupActingRoute(groupRoute(groupId), actorId));
  }

  // ---- your own surfaces: kill-a-badge (phase 9) ----
  //
  // Not canvas-scoped, unlike the grant routes above, because a badge is not
  // about one canvas: ending one ends that holder's recognition everywhere at
  // once. On a replica the daemon forwards both to the home, which is where
  // the badge that matters lives — see `HomeConnection.badges`.

  badges(): Promise<BadgesResponse> {
    return this.request("GET", BADGES_ROUTE);
  }

  /** No body, for `revokeGrant`'s reason. */
  killBadge(badgeId: string): Promise<KillBadgeResponse> {
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
  mintPass(canvasId: string, actorId?: string): Promise<MintPassResponse> {
    return this.request("POST", passesRoute(canvasId), actorId ? { actorId } : {});
  }

  /** One pass this badge minted, read back without its secret: whether it
   * was spent, and by which badge (`redeemedBy`). `unknown-pass` for any
   * pass this badge did not mint. */
  pass(canvasId: string, passId: string): Promise<PassResponse> {
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
   * machine even though the badge still holds it. `isocan setup` writes it
   * into `identity.json` for exactly that reason.
   */
  redeemPass(token: string, home?: string): Promise<RedeemPassResponse> {
    /**
     * `home` is the address the pass was pasted with, and it is sent only when
     * it is not this daemon's own base — a daemon told to redeem a pass minted
     * "at itself" would open a link to itself and become its own replica.
     * Omitted, the daemon decides (`HomeLinks.homeScoped`), which is right for
     * the pure home and the pure replica and is what every caller did before
     * phase 10.3.
     */
    const elsewhere =
      home !== undefined && normalizeHomeUrl(home) !== normalizeHomeUrl(this.base);
    return this.request("POST", PASS_REDEEM_ROUTE, {
      token,
      ...(elsewhere ? { home: normalizeHomeUrl(home!) } : {}),
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
  async joinFromHome(canvasId: string, home?: string): Promise<Canvas> {
    const { canvas } = await this.request<JoinCanvasResponse>("POST", HOME_JOIN_ROUTE, {
      canvasId,
      ...(home !== undefined ? { home } : {}),
    } satisfies JoinCanvasRequest);
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
  homes(): Promise<HomesResponse> {
    return this.request("GET", HOMES_ROUTE);
  }

  snapshot(canvasId: string): Promise<CanvasSnapshotResponse> {
    return this.request("GET", `/api/projects/${canvasId}/canvas`);
  }

  /** How this home serves — today, only whether a content origin exists. */
  serving(): Promise<ServingResponse> {
    return this.request("GET", SERVING_ROUTE);
  }

  /** The name each actor goes by now. A snapshot already carries this; it is
   * fetched on its own for commands that print names without one. */
  actorNames(): Promise<ActorNames> {
    return this.request("GET", "/api/names");
  }

  /** Who is an agent — actor id → "agent" for every actor whose last claim
   * came from a harness that is not a person's; people absent. A daemon from
   * before the route answers its SPA fallback, which parses to nothing. */
  actorKinds(): Promise<ActorKinds> {
    return this.request("GET", ACTOR_KINDS_ROUTE);
  }

  /** Who is on which canvas right now, across every room this daemon can see
   * and the caller may enter — see `PRESENCE_WHERE_ROUTE`. */
  presenceWhere(): Promise<PresenceWhereResponse> {
    return this.request("GET", PRESENCE_WHERE_ROUTE);
  }

  /** What changed, for the person using this — release notes from the home
   *  this CLI is talking to, so what it lists is what that home is running. */
  news(): Promise<NewsResponse> {
    return this.request("GET", NEWS_ROUTE);
  }

  /** Every slash command available here: built-ins under this home's own. */
  commands(): Promise<SlashCommand[]> {
    return this.request("GET", `/api/commands`);
  }

  /** Write one for this home. `text` is the file, frontmatter and all. */
  saveCommand(name: string, text: string): Promise<void> {
    return this.request("PUT", `/api/commands/${encodeURIComponent(name)}`, { text });
  }

  /** Remove one of this home's; the built-in of that name comes back. */
  deleteCommand(name: string): Promise<void> {
    return this.request("DELETE", `/api/commands/${encodeURIComponent(name)}`);
  }

  /** With waitMs, the daemon long-polls: holds until an entry lands past
   * `since` or the window closes (empty array). */
  /** The bound directory's listing — owner-scoped, answered only by the
   * canvas's own local daemon (`tree.ts` has the rules). */
  getTree(canvasId: string): Promise<{ roots: Array<{ root: string; entries: Array<{ path: string; kind: "file" | "dir"; size: number }>; truncated: boolean }> }> {
    return this.request("GET", `/api/projects/${canvasId}/tree`);
  }

  /** Write an item's current version out to the directory bound here — the
   * other direction from `＋` (`docs/projects/workbench/files-on-disk.md`). */
  writeItem(
    canvasId: string,
    itemId: string,
    force = false,
  ): Promise<{ root: string; path: string; wrote: string }> {
    return this.request("POST", `/api/projects/${canvasId}/write`, { itemId, force });
  }

  /** What this machine's disk says about the canvas's tracked items. */
  getBacking(canvasId: string): Promise<{ bound: boolean; onDisk: Record<string, string> }> {
    return this.request("GET", `/api/projects/${canvasId}/backing`);
  }

  getLog(canvasId: string, since: number, waitMs?: number): Promise<LogEntry[]> {
    const wait = waitMs !== undefined ? `&waitMs=${waitMs}` : "";
    return this.request("GET", `/api/projects/${canvasId}/oplog?since=${since}${wait}`);
  }

  /** What `gc` compacted out of the live log, oldest first — empty until a
   * compaction has happened. `getLog` + this is the complete history. */
  getArchivedLog(canvasId: string): Promise<LogEntry[]> {
    return this.request("GET", `/api/projects/${canvasId}/oplog/archive`);
  }

  /** Every canvas at once. Omit `cursors` to seed at "now"; otherwise the
   * daemon long-polls until an op lands on any canvas. `signal` aborts a held
   * poll — what lets `tail()` stop listening mid-window instead of after it. */
  watchLog(request: WatchLogRequest, signal?: AbortSignal): Promise<WatchLogResponse> {
    return this.request("POST", "/api/oplog/watch", request, signal);
  }

  // ---- the durable park cursor (on-demand phase 1) ----

  /** Adopt (or create) this actor's cursor row on a canvas. The returned
   * `parkId` is the lease every delivery and advance must carry. */
  parkClaim(request: ParkClaimRequest): Promise<ParkClaimResponse> {
    return this.request("POST", "/api/park/claim", request);
  }

  /** A wake handed entries out — record the high-water. Refused with
   * `PARK_ADOPTED_CODE` when another park has adopted the row. */
  parkDelivered(request: ParkDeliveredRequest): Promise<{ ok: true }> {
    return this.request("POST", "/api/park/delivered", request);
  }

  /** A lap matched nothing — settle the noise without a turn. Same refusal. */
  parkAdvance(request: ParkAdvanceRequest): Promise<{ ok: true }> {
    return this.request("POST", "/api/park/advance", request);
  }

  /** The rc's connection-bound liveness (phase 6): held open for `waitMs`,
   * during which these agents read as answerable. Re-issue back-to-back;
   * the fact dies with the socket, which is the whole point. The response
   * carries any web asks that arrived while held (agent-custody) — the rc
   * enrolls each and keeps holding. */
  rcHold(request: RcHoldRequest): Promise<RcHoldResponse> {
    return this.request("POST", "/api/rc/hold", request);
  }

  /** Who a live rc answers for on this canvas — and whether any is parked at
   * all, here or relayed from a member's machine. */
  rcAnswering(canvasId: string): Promise<RcAnsweringResponse> {
    return this.request("GET", `/api/projects/${canvasId}/rc`);
  }

  undo(canvasId: string, actor: Actor): Promise<LogEntry> {
    return this.request("POST", `/api/projects/${canvasId}/undo`, { actor });
  }

  redo(canvasId: string, actor: Actor): Promise<LogEntry> {
    return this.request("POST", `/api/projects/${canvasId}/redo`, { actor });
  }

  /** Ask whether the home holds every blob this canvas names, and optionally
   *  send the ones it does not. */
  reconcileBlobs(
    canvasId: string,
    push: boolean,
  ): Promise<{
    home: string | null;
    checked: number;
    missing: string[];
    pushed: string[];
    unknown: string[];
  }> {
    return this.request("POST", `/api/projects/${canvasId}/blobs/reconcile`, { push });
  }

  /** Send a canvas to another home, or ask what that would move. */
  teleport(
    canvasId: string,
    to: string,
    dryRun: boolean,
  ): Promise<{
    canvasId: string;
    to: string;
    entries: number;
    blobs: number;
    bytes: number;
    moved: boolean;
    /** Blobs the far home did not take after the log landed; the old home,
     *  a replica now, sends them on its next blob sweep or on `isocan blobs --push`. */
    behind: number;
  }> {
    return this.request("POST", `/api/projects/${canvasId}/teleport`, { to, dryRun });
  }

  /** Hand a home a whole canvas as somebody else's log — teleport's far end,
   *  and what `isocan import` restores a backup through. Creates, never
   *  merges: a canvas already at the home is refused. */
  adopt(canvasId: string, entries: readonly LogEntry[]): Promise<{ seqs: number }> {
    return this.request("POST", `/api/projects/${canvasId}/adopt`, { entries });
  }

  gc(canvasId: string, request: GcRequest): Promise<GcReport> {
    return this.request("POST", `/api/projects/${canvasId}/gc`, request);
  }

  /** Every canvas this badge is admitted to at this home, in one sweep — the
   * same per-canvas policy, aggregated (phase 13.7). Names no canvas, so it
   * works in a directory that is bound to none. */
  gcHome(request: GcRequest): Promise<HomeGcReport> {
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
  async operatorShow(canvasId: string, proof: string): Promise<OperatorShowResponse> {
    return this.request(
      "GET",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}`,
      undefined,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /** The ledger, newest first — the operator reads it and nobody else does. */
  async operatorLog(
    proof: string,
    options: { target?: string | null; limit?: number } = {},
  ): Promise<OperatorLogResponse> {
    const query = new URLSearchParams();
    if (options.target) query.set("target", options.target);
    if (options.limit !== undefined) query.set("limit", String(options.limit));
    const suffix = query.toString();
    return this.request(
      "GET",
      `${OPERATOR_LOG_ROUTE}${suffix ? `?${suffix}` : ""}`,
      undefined,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
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
  async operatorLook(
    canvasId: string,
    proof: string,
    request: OperatorLookRequest,
  ): Promise<OperatorLookResponse> {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/look`,
      request,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /** Take it down, or lift it. One method and one route for both, because
   * they are one act with a direction: the reach, the row and the refusals are
   * the same shape either way, and a second verb would be a second place for
   * the ledger's `act` to be spelled. */
  async operatorTakedown(
    canvasId: string,
    proof: string,
    request: OperatorTakedownRequest,
  ): Promise<OperatorTakedownResponse> {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/takedown`,
      request,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /**
   * **End a surface** (operator phase 4) — by badge id, actor id or
   * `email:` address, which is the id a report names. Sent twice by the verb:
   * once with `preview` to read the reach, once to act on it. Same header,
   * same proof, same shape as the takedown.
   */
  async operatorEnd(
    target: string,
    proof: string,
    request: OperatorEndRequest,
  ): Promise<OperatorEndResponse> {
    return this.request(
      "POST",
      `/api/operator/end/${encodeURIComponent(target)}`,
      request,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /**
   * **Turn off a grant** (operator phase 5) — on a canvas or a space, by the
   * subject a report names, with `bar` to keep them out as the owner's
   * `?bar=1` does. Same header, same proof, same shape as the takedown.
   */
  async operatorRevoke(
    target: string,
    proof: string,
    request: OperatorRevokeRequest,
  ): Promise<OperatorRevokeResponse> {
    return this.request(
      "POST",
      `/api/operator/revoke/${encodeURIComponent(target)}`,
      request,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /**
   * **Erase the bytes** (operator phase 3) — the one operator act that cannot
   * be lifted, and the one whose body is a single word. The route refuses
   * without `force`, and refuses on a canvas that is not taken down whatever
   * `force` says. Same header, same proof, same shape as the takedown.
   */
  async operatorPurge(
    canvasId: string,
    proof: string,
    request: OperatorPurgeRequest,
  ): Promise<OperatorPurgeResponse> {
    return this.request(
      "POST",
      `/api/operator/canvases/${encodeURIComponent(canvasId)}/purge`,
      request,
      undefined,
      { [OPERATOR_PROOF_HEADER]: proof },
    );
  }

  /**
   * **The sentence, for the people it happened to** — not an operator read.
   *
   * With a canvas id: that one, answered to anybody, because the door already
   * says it in its refusal. Without: the ones in force among the canvases this
   * badge may see, which is what a canvas list draws beside its rows.
   */
  async takedowns(canvasId?: string): Promise<TakedownsResponse> {
    const suffix = canvasId
      ? `?${TAKEDOWNS_CANVAS_PARAM}=${encodeURIComponent(canvasId)}`
      : "";
    return this.request("GET", `${TAKEDOWNS_ROUTE}${suffix}`);
  }

  async uploadBlob(
    canvasId: string,
    data: Buffer,
    mimeType: string,
    filename: string,
  ): Promise<BlobUploadResponse> {
    // Blobs bypass `request` (raw bytes, no JSON), so they need the badge and
    // the recovery retry spelled out — easy to miss, and a 401 on an upload
    // would read as a broken drop.
    const send = async () =>
      fetch(`${this.base}/api/projects/${canvasId}/blobs`, {
        method: "POST",
        headers: {
          ...(await this.authHeader()),
          "Content-Type": mimeType,
          [FILENAME_HEADER]: encodeFilename(filename),
        },
        body: new Uint8Array(data),
      });
    let res = await send();
    if (res.status === 401 && (await this.reBadge())) res = await send();
    const json = (await res.json().catch(() => null)) as any;
    if (!res.ok) throw new ApiError(res.status, json?.error ?? `HTTP ${res.status}`, json?.code);
    return json as BlobUploadResponse;
  }

  async downloadBlob(canvasId: string, blobHash: string): Promise<Buffer> {
    const send = async () =>
      fetch(`${this.base}/api/projects/${canvasId}/blobs/${blobHash}`, {
        headers: await this.authHeader(),
      });
    let res = await send();
    if (res.status === 401 && (await this.reBadge())) res = await send();
    if (!res.ok) throw new ApiError(res.status, `blob not found: ${blobHash}`);
    return Buffer.from(await res.arrayBuffer());
  }
}
