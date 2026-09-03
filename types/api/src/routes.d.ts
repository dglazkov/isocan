import type { Actor, ActorBindingRecord, ActorClaimOp, BadgesResponse, BlobUploadResponse, Capability, CanvasSnapshotResponse, CreateSessionResponse, GcReport, GcRequest, HomeGcReport, GrantResponse, GrantsResponse, GrantSubject, HomesResponse, KillBadgeResponse, LogEntry, MintPassResponse, Operation, PostOpResponse, PresenceSession, Canvas, RedeemPassResponse, UpdateSessionRequest, ParkAdvanceRequest, ParkClaimRequest, ParkClaimResponse, ParkDeliveredRequest, RcAnsweringResponse, RcHoldRequest, RcHoldResponse, WatchLogRequest, WatchLogResponse, ActorNames, ActorKinds, NewsResponse, PresenceWhereResponse, ServingResponse, SlashCommand, SpaceCanvasResponse, SpaceLinkRequest, SpaceLinkResponse, SpaceResponse, SpacesResponse, GroupResponse, GroupsResponse } from "../../core/src/index.js";
import type { UpgradeVerdict } from "../../core/src/index.js";
import type { BuildStamp } from "../../server/src/index.js";
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
export declare class ApiError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    /** Why, when the code alone does not say — `withdrawn` on a
     * `not-admitted` from a badge that had been inside. */
    readonly reason?: string | undefined;
    constructor(status: number, message: string, code?: string | undefined, 
    /** Why, when the code alone does not say — `withdrawn` on a
     * `not-admitted` from a badge that had been inside. */
    reason?: string | undefined);
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
export declare class DaemonRoutes {
    readonly base: string;
    readonly home: string;
    /** Loaded once per process, from `identity.json`'s `auth` block. */
    private badge;
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
    private reclaim;
    private reclaiming;
    constructor(base: string, home: string);
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
    private request;
    /** `Authorization: Bearer <badgeId>.<secret>`, when we hold one. */
    private authHeader;
    private storedBadge;
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
    private reBadge;
    /** How to prove who this command speaks as, if the home asks. Registered by
     * `resolveIdentity` the moment that is known. */
    reclaimWith(reclaim: () => Promise<void>): void;
    /** Claim the identity this command speaks as. False when there is nothing
     * to claim or the home refused, so a caller does not replay into the same
     * refusal twice. The guard is against the claim's OWN request coming back
     * around here. */
    private reclaimIdentity;
    /** The badge this client is presenting, for `whoami` to print. Never the
     * secret. */
    badgeId(): Promise<string | null>;
    health(timeoutMs?: number): Promise<boolean>;
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
    awaitHealth(deadlineMs?: number): Promise<boolean>;
    /** The daemon's own account of itself — pid, when it started, and which
     * copy of isocan it is running. Null when nothing answers.
     *
     * The path is a property of `this.base`, not a constant: against 127.0.0.1
     * it is `/healthz` as it has always been, and against a hosted home it is
     * `/api/healthz`, because Google's frontend swallows the bare path and this
     * one call sits under `health()`, `ensureDaemon`'s startup poll and
     * `warnIfStale` — all three of which would otherwise report a live home as
     * dead. See `healthPath`. */
    healthz(timeoutMs?: number): Promise<Health | null>;
    /** Name (or resume) the actor behind a session key — the one op sent
     * without an actor: the response envelope says who you are. */
    claimActor(op: ActorClaimOp): Promise<PostOpResponse>;
    /** Who the given session keys speak as (everyone, when omitted). */
    actorBindings(keys?: string[]): Promise<ActorBindingRecord[]>;
    /** Claims for these session keys held by a badge that is not this one —
     * what a client whose badge was lost needs in order to be told the truth
     * about why it has no identity. Never adopts; only reports. */
    orphanedActors(keys: string[]): Promise<ActorBindingRecord[]>;
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
    sendOp(canvasId: string | null, actor: Actor, op: Operation, clientId?: string, home?: string, 
    /** **One gesture, one undo** — see `LogEntry.group`. Ops sent under one
     *  id are undone together, so `isocan copy` writing eight items is one
     *  ⌘Z on the screen watching it. */
    group?: string): Promise<PostOpResponse>;
    createSession(canvasId: string, actor: Actor, label?: string, harness?: string, 
    /** "rc": a parked `isocan rc` announcing itself — a process fact on the
     * presence plane, rendered nowhere. Defaults to "cli". */
    kind?: "cli" | "rc"): Promise<CreateSessionResponse>;
    updateSession(canvasId: string, sessionId: string, patch: UpdateSessionRequest): Promise<{
        ok: true;
        cancelled?: {
            threadId: string;
            by: string;
            at: string;
        };
    }>;
    endSession(canvasId: string, sessionId: string): Promise<{
        ok: true;
    }>;
    listSessions(canvasId: string): Promise<PresenceSession[]>;
    /** End every session an actor holds — the daemon-side truth, for when the
     * local session pointer has been lost. */
    endActorSessions(actorId: string, kind?: "web" | "cli"): Promise<{
        ended: number;
    }>;
    listCanvases(): Promise<Canvas[]>;
    grants(canvasId: string): Promise<GrantsResponse>;
    createGrant(canvasId: string, subject: GrantSubject, capability?: Capability, 
    /** Who is acting — the CLI's actor. A write to grants asks `own`, which
     * a person holds, and a badge may speak for several. */
    actorId?: string): Promise<GrantResponse>;
    /**
     * Keep somebody out (roles phase 3): a bar, written directly. The same
     * POST as an invitation with `bars: true` and no rung; the home replaces
     * any live row naming them and sweeps, so a person inside on the link is
     * put out by the write.
     */
    bar(canvasId: string, subject: GrantSubject, actorId?: string): Promise<GrantResponse>;
    /** No body, deliberately: a DELETE that declares `application/json` and
     * sends nothing is a Fastify parse error, and a request with nothing to say
     * should not announce a content type. `bar` is `?bar=1` — revoke and keep
     * them out in one request (roles phase 3); the route's spelling is core's. */
    revokeGrant(canvasId: string, grantId: string, actorId?: string, bar?: boolean): Promise<GrantResponse>;
    spaces(): Promise<SpacesResponse>;
    createSpace(name: string, actorId?: string): Promise<SpaceResponse>;
    /** No body, for `revokeGrant`'s reason; the actor rides the query. */
    deleteSpace(spaceId: string, actorId?: string): Promise<SpaceCanvasResponse>;
    addToSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse>;
    removeFromSpace(spaceId: string, canvasId: string, actorId?: string): Promise<SpaceCanvasResponse>;
    spaceGrants(spaceId: string): Promise<GrantsResponse>;
    createSpaceGrant(spaceId: string, subject: GrantSubject, capability?: Capability, actorId?: string): Promise<GrantResponse>;
    barOnSpace(spaceId: string, subject: GrantSubject, actorId?: string): Promise<GrantResponse>;
    revokeSpaceGrant(spaceId: string, grantId: string, actorId?: string, bar?: boolean): Promise<GrantResponse>;
    /** **Every canvas in this space**: the link on each canvas set to a rung,
     * or turned off, in one request; the answer says how many it reached. */
    setSpaceLink(spaceId: string, capability: SpaceLinkRequest["capability"], actorId?: string): Promise<SpaceLinkResponse>;
    /** The groups this badge's actors made, members and all. */
    groups(): Promise<GroupsResponse>;
    createGroup(name: string, actorId?: string): Promise<GroupResponse>;
    /** One group: members for its maker; name and size for anybody a live
     * row naming it lets see it. */
    group(groupId: string): Promise<GroupResponse>;
    addGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse>;
    /** No body; the actor rides the query. */
    removeGroupMember(groupId: string, attribute: string, actorId?: string): Promise<GroupResponse>;
    deleteGroup(groupId: string, actorId?: string): Promise<GroupResponse>;
    badges(): Promise<BadgesResponse>;
    /** No body, for `revokeGrant`'s reason. */
    killBadge(badgeId: string): Promise<KillBadgeResponse>;
    /** Mint one for this canvas. `actorId` endows the claim; omitting it mints
     * the admission-only shape. The token comes back exactly once. */
    mintPass(canvasId: string, actorId?: string): Promise<MintPassResponse>;
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
    redeemPass(token: string, home?: string): Promise<RedeemPassResponse>;
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
    joinFromHome(canvasId: string, home?: string): Promise<Canvas>;
    /**
     * **Which canvas lives where, and which homes are answering.**
     *
     * The one read behind every per-canvas home question (`HOMES_ROUTE` in core
     * has the list). It replaces the health route's `home` field for everything
     * except "where would the next canvas be born", which is the only thing that
     * field still means.
     */
    homes(): Promise<HomesResponse>;
    snapshot(canvasId: string): Promise<CanvasSnapshotResponse>;
    /** How this home serves — today, only whether a content origin exists. */
    serving(): Promise<ServingResponse>;
    /** The name each actor goes by now. A snapshot already carries this; it is
     * fetched on its own for commands that print names without one. */
    actorNames(): Promise<ActorNames>;
    /** Who is an agent — actor id → "agent" for every actor whose last claim
     * came from a harness that is not a person's; people absent. A daemon from
     * before the route answers its SPA fallback, which parses to nothing. */
    actorKinds(): Promise<ActorKinds>;
    /** Who is on which canvas right now, across every room this daemon can see
     * and the caller may enter — see `PRESENCE_WHERE_ROUTE`. */
    presenceWhere(): Promise<PresenceWhereResponse>;
    /** What changed, for the person using this — release notes from the home
     *  this CLI is talking to, so what it lists is what that home is running. */
    news(): Promise<NewsResponse>;
    /** Every slash command available here: built-ins under this home's own. */
    commands(): Promise<SlashCommand[]>;
    /** Write one for this home. `text` is the file, frontmatter and all. */
    saveCommand(name: string, text: string): Promise<void>;
    /** Remove one of this home's; the built-in of that name comes back. */
    deleteCommand(name: string): Promise<void>;
    /** With waitMs, the daemon long-polls: holds until an entry lands past
     * `since` or the window closes (empty array). */
    /** The bound directory's listing — owner-scoped, answered only by the
     * canvas's own local daemon (`tree.ts` has the rules). */
    getTree(canvasId: string): Promise<{
        roots: Array<{
            root: string;
            entries: Array<{
                path: string;
                kind: "file" | "dir";
                size: number;
            }>;
            truncated: boolean;
        }>;
    }>;
    /** Write an item's current version out to the directory bound here — the
     * other direction from `＋` (`docs/projects/workbench/files-on-disk.md`). */
    writeItem(canvasId: string, itemId: string, force?: boolean): Promise<{
        root: string;
        path: string;
        wrote: string;
    }>;
    /** What this machine's disk says about the canvas's tracked items. */
    getBacking(canvasId: string): Promise<{
        bound: boolean;
        onDisk: Record<string, string>;
    }>;
    getLog(canvasId: string, since: number, waitMs?: number): Promise<LogEntry[]>;
    /** What `gc` compacted out of the live log, oldest first — empty until a
     * compaction has happened. `getLog` + this is the complete history. */
    getArchivedLog(canvasId: string): Promise<LogEntry[]>;
    /** Every canvas at once. Omit `cursors` to seed at "now"; otherwise the
     * daemon long-polls until an op lands on any canvas. `signal` aborts a held
     * poll — what lets `tail()` stop listening mid-window instead of after it. */
    watchLog(request: WatchLogRequest, signal?: AbortSignal): Promise<WatchLogResponse>;
    /** Adopt (or create) this actor's cursor row on a canvas. The returned
     * `parkId` is the lease every delivery and advance must carry. */
    parkClaim(request: ParkClaimRequest): Promise<ParkClaimResponse>;
    /** A wake handed entries out — record the high-water. Refused with
     * `PARK_ADOPTED_CODE` when another park has adopted the row. */
    parkDelivered(request: ParkDeliveredRequest): Promise<{
        ok: true;
    }>;
    /** A lap matched nothing — settle the noise without a turn. Same refusal. */
    parkAdvance(request: ParkAdvanceRequest): Promise<{
        ok: true;
    }>;
    /** The rc's connection-bound liveness (phase 6): held open for `waitMs`,
     * during which these agents read as answerable. Re-issue back-to-back;
     * the fact dies with the socket, which is the whole point. The response
     * carries any web asks that arrived while held (agent-custody) — the rc
     * enrolls each and keeps holding. */
    rcHold(request: RcHoldRequest): Promise<RcHoldResponse>;
    /** Who a live rc answers for on this canvas — and whether any is parked at
     * all, here or relayed from a member's machine. */
    rcAnswering(canvasId: string): Promise<RcAnsweringResponse>;
    undo(canvasId: string, actor: Actor): Promise<LogEntry>;
    redo(canvasId: string, actor: Actor): Promise<LogEntry>;
    /** Ask whether the home holds every blob this canvas names, and optionally
     *  send the ones it does not. */
    reconcileBlobs(canvasId: string, push: boolean): Promise<{
        home: string | null;
        checked: number;
        missing: string[];
        pushed: string[];
        unknown: string[];
    }>;
    /** Send a canvas to another home, or ask what that would move. */
    teleport(canvasId: string, to: string, dryRun: boolean): Promise<{
        canvasId: string;
        to: string;
        entries: number;
        blobs: number;
        bytes: number;
        moved: boolean;
    }>;
    gc(canvasId: string, request: GcRequest): Promise<GcReport>;
    /** Every canvas this badge is admitted to at this home, in one sweep — the
     * same per-canvas policy, aggregated (phase 13.7). Names no canvas, so it
     * works in a directory that is bound to none. */
    gcHome(request: GcRequest): Promise<HomeGcReport>;
    uploadBlob(canvasId: string, data: Buffer, mimeType: string, filename: string): Promise<BlobUploadResponse>;
    downloadBlob(canvasId: string, blobHash: string): Promise<Buffer>;
}
