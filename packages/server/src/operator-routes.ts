import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  actorAliases,
  barSubjectRefusal,
  capabilityOf,
  grantSubjectRefusal,
  isBar,
  isTakedownReason,
  LINK,
  NET_REFUSAL_DEFAULT_MS,
  newId,
  NO_OPERATOR_PROOF,
  normalizeAttribute,
  normalizeSubject,
  noticeOf,
  OPERATOR_END_ROUTE,
  OPERATOR_LOG_ROUTE,
  OPERATOR_LOOK_MS,
  OPERATOR_LOOK_ROUTE,
  OPERATOR_PROOF_HEADER,
  OPERATOR_PURGE_ROUTE,
  OPERATOR_REFUSE_ROUTE,
  OPERATOR_REVOKE_ROUTE,
  OPERATOR_SHOW_ROUTE,
  OPERATOR_TAKEDOWN_ROUTE,
  parseRefusalDuration,
  passExpired,
  purgeNeedsTakedown,
  refusalSentence,
  refusalSubjectOf,
  refusalSubjectRefusal,
  replicasHorizon,
  resolveActor,
  revokedSentence,
  SHELF,
  TAKEDOWNS_CANVAS_PARAM,
  TAKEDOWNS_ROUTE,
  TAKEN_DOWN,
  takedownReasonList,
  WS_NOT_ADMITTED,
  type Canvas,
  type CanvasTakedown,
  type CdnPurge,
  type EndedSurface,
  type Grant,
  type GrantSubject,
  type HomeRefusal,
  type OperatorAct,
  type OperatorEnd,
  type OperatorEndReach,
  type OperatorEndRequest,
  type OperatorEndResponse,
  type OperatorLogResponse,
  type OperatorLookResponse,
  type OperatorPurgeRequest,
  type OperatorPurgeResponse,
  type OperatorReach,
  type OperatorRefuseRequest,
  type OperatorRefuseResponse,
  type OperatorRevocation,
  type OperatorRevokeRequest,
  type OperatorRevokeResponse,
  type OperatorShowResponse,
  type OperatorTakedownRequest,
  type OperatorTakedownResponse,
  type RefusalReach,
  type TakedownNotice,
  type TakedownReach,
  type TakedownReason,
  type TakedownsResponse,
} from "@isocan/core";
import type { AuthConfig, SigningKeys } from "./attest.ts";
import { endOf } from "./badges.ts";
import type { BadgeRecord, Desk } from "./desk.ts";
import { CanvasNotFoundError, type Engine } from "./engine.ts";
import type { RouteOptions } from "./http.ts";
import { NO_PROOF_PRESENTED, proveOperator } from "./operator.ts";
import { mintPass } from "./passes.ts";
import type { PresenceHub } from "./presence.ts";
import { liveGrants } from "./route-helpers.ts";
import type { Store } from "./store.ts";
import { killAndSweep, sweepCanvas, sweepSpace, type SweepHub } from "./sweep.ts";
import type { Refusals } from "./takedowns.ts";

/**
 * **The operator's routes** — everything under `/api/operator/`, and the
 * public takedowns list beside them (operator phases 1–6).
 *
 * They lived inline in `registerRoutes` until cleanup TS-8 (27 Sep 2026),
 * which moved them here whole: a 6,000-line function is one nobody can hold
 * in their head, and these routes share almost nothing with the rest of it —
 * the dependencies below are the whole of what they read from its closure.
 * `registerRoutes` calls this at the point in its sequence where the section
 * used to begin, so registration order is exactly what it was.
 */
export interface OperatorRouteScope {
  engine: Engine;
  store: Store;
  desk: Desk;
  presence: PresenceHub;
  options: RouteOptions;
  auth: AuthConfig | null;
  signingKeys: SigningKeys;
  operators: readonly string[];
  refusals: Refusals;
  wakeWatchers: (canvasId: string) => number;
  cdnPurgeFor: (canvasId: string) => CdnPurge | null;
  sweeps: SweepHub;
  ownerName: (project: { createdBy: { id: string; name: string } }) => Promise<string>;
  sourceMutation: (req: FastifyRequest, canvasId: string) => Promise<void>;
  canvasDiscovery: (req: FastifyRequest) => (canvas: Canvas) => Promise<boolean>;
  barRow: (canvasId: string, subject: GrantSubject, grantedBy: string) => Grant;
  namesTheCreator: (subject: GrantSubject, project: { createdBy: { id: string } }) => Promise<boolean>;
  creatorOf: (canvasId: string) => Promise<string | null>;
}

/** The operator's routes, on `app`, at the point `registerRoutes` reaches them — so the
 * paths and the registration order are the ones they had inline. */
export function registerOperatorRoutes(app: FastifyInstance, scope: OperatorRouteScope): void {
  const {
    engine, store, desk, presence, options, auth, signingKeys, operators, refusals,
    wakeWatchers, cdnPurgeFor, sweeps, ownerName, sourceMutation, canvasDiscovery,
    barRow, namesTheCreator, creatorOf,
  } = scope;

  // **The operator is a proof, not a credential.** An address this home's
  // configuration names, proved fresh for each act by the attester the home
  // already borrows, carried in one header and stored nowhere. Everything
  // under `/api/operator/` is refused without that proof and writes its ledger
  // row before it answers.
  //
  // **Not canvas-scoped, and that is the point rather than a convenience.**
  // `CANVAS_API_ROUTE` matches `/api/projects/:id/`, so the door's admission
  // hook does not run here — which is exactly journey 1's first act: *show on
  // a canvas the operator was never admitted to*. The badge still travels and
  // is still resolved; what it does NOT do is decide anything, because
  // operator standing is not on it and never will be (decision D2). And
  // journey 12 stands: Olu's badge is an ordinary badge, and opening a canvas
  // he is not admitted to still refuses him like anyone.

  /**
   * **The proof, judged and written down — or the refusal, judged and written
   * down.** Every operator route's first line.
   *
   * It answers `null` when it has already sent the reply, which is the shape
   * `refuseAmbiguousHome` (`route-helpers.ts`) uses: the caller writes `const proven =
   * await proveAct(...); if (!proven) return;` and cannot proceed by
   * forgetting an `if`.
   *
   * **The ledger row goes down BEFORE the act runs**, which is the operator
   * project's one rule for every phase — *a power that exists before its
   * record does is the Firestore hand edit again*. So the order here is:
   * verify, write `attempted`, hand back the id, and let the caller settle it.
   * A crash between the row and the answer leaves a row that says an act was
   * attempted, which is the whole reason it is two writes.
   *
   * **A refusal is written too**, and this is the decision worth stating.
   * `not-operator` is somebody who signed in, at a moment, and asked this home
   * to act — the single most interesting thing an operator ledger could
   * record. Nothing is written for a token that does not VERIFY: there is no
   * address to name and nobody proved anything, so a row would be a record of
   * a stranger's ability to post a string.
   */
  const proveAct = async (
    req: FastifyRequest,
    reply: FastifyReply,
    /** The reason and the note ride into the row here, rather than being
     * written onto it by the act afterwards, for the phase rule's sake: the
     * row goes down BEFORE the act runs, and a row that gained its reason only
     * on the way out would be a crash-time record of an act with no account of
     * why. A refused act keeps them too — somebody asked this home to take a
     * canvas down for a reason, and that it was refused does not make the
     * reason uninteresting. */
    what: { act: string; target: string | null; reason?: string; note?: string },
  ): Promise<OperatorAct | null> => {
    const header = req.headers[OPERATOR_PROOF_HEADER];
    const token = (Array.isArray(header) ? header[0] : header)?.trim() ?? "";
    if (!token) {
      await reply.status(403).send({ error: NO_PROOF_PRESENTED, code: NO_OPERATOR_PROOF });
      return null;
    }
    // `auth` is non-null here: the door hook refuses the whole prefix when it
    // is not, with the sentence that says why.
    const verdict = await proveOperator({ token, auth: auth!, keys: signingKeys, operators });
    const row: OperatorAct = {
      id: newId("opr"),
      act: what.act,
      target: what.target,
      ...(what.reason !== undefined ? { reason: what.reason } : {}),
      ...(what.note !== undefined ? { note: what.note } : {}),
      proof: verdict.ok ? verdict.proof : verdict.proof!,
      badgeId: req.badge?.badgeId ?? null,
      at: new Date().toISOString(),
      outcome: verdict.ok ? "attempted" : verdict.code,
    };
    await desk.recordOperatorAct(row);
    if (!verdict.ok) {
      await reply.status(403).send({ error: verdict.error, code: verdict.code });
      return null;
    }
    return row;
  };

  /**
   * **What this home holds under that id** (journey 1 step 4), and nothing
   * that would be a roster.
   *
   * Counts and one name. "No names of people other than the maker" is the
   * journey's own line and it is the same rule `http.ts`'s badge comment gives:
   * a listing would be a roster of people to act against. So the badges are a
   * number, the sockets are a number, and the only person named is the one
   * whose canvas it is.
   *
   * **Nothing is changed**, which is what makes `show` the right first verb:
   * the whole proof path, the whole ledger path and the whole refusal path are
   * exercised by an act that cannot hurt anybody if any of them is wrong.
   */
  const reachOf = async (canvasId: string): Promise<OperatorReach> => {
    /**
     * **The canvas record rather than the snapshot, when the snapshot cannot
     * be loaded** — operator phase 2, closing phase 1's open finding that
     * `show` on a canvas that is not servable is a 404.
     *
     * A taken-down canvas is exactly the one the operator most needs to be
     * able to read the reach of: he took it down, Kai has written back, and
     * `--lift` is the next decision. `load` refuses it — that is what a
     * takedown IS — so `getSnapshot` throws, and everything `show` prints
     * except the title and the maker comes from the desk and the blob index
     * anyway. Those two come from `listCanvases`, which reads the canvas
     * record and is untouched by a takedown.
     *
     * A soft-DELETED canvas is still a 404 here, and that is right: the file
     * backing has moved the directory and there is no record left to read.
     * Phase 3's purge is where the tombstone's own shape gets decided.
     */
    const project =
      (await engine
        .getSnapshot(canvasId)
        .then((loaded) => loaded.project)
        .catch(() => null)) ??
      (await store.listCanvases()).find((canvas) => canvas.id === canvasId) ??
      null;
    if (!project) throw new CanvasNotFoundError(canvasId);
    const grants = liveGrants(await desk.grantsFor(canvasId));
    const link = grants.find((grant) => grant.subject === LINK);
    const blobs = await store.listBlobs(canvasId);
    /**
     * **Which replicas are relaying for this canvas right now**, which is a
     * narrower fact than journey 1's "which replicas are linked" and is the
     * honest one this home can tell.
     *
     * A member daemon relaying presence stamps every face it sends with a
     * relay origin, and the distinct origins on a canvas are its live relay
     * connections. There is no registry of machines that have ever linked —
     * `home-links.ts` is the REPLICA's table of the homes it dials, and the
     * home keeps no mirror of it — so a laptop that is linked and asleep is
     * not here. The verb prints these as *relaying now* rather than as
     * *linked*, because the difference is the whole difference between a
     * takedown's reach and a guess at it.
     */
    const relays = new Set(
      presence
        .roster(canvasId)
        .map((session) => session.via)
        .filter((via): via is string => typeof via === "string"),
    );
    return {
      canvasId,
      title: project.title,
      madeBy: {
        id: project.createdBy.id,
        name: await ownerName(project),
      },
      at: project.createdAt,
      link: link ? capabilityOf(link) : null,
      grants: grants.length,
      badges: (await desk.badgesIn(canvasId)).length,
      sockets: options.sockets?.open(canvasId) ?? 0,
      files: blobs.length,
      bytes: blobs.reduce((total, blob) => total + blob.meta.size, 0),
      replicas: [...relays],
    };
  };

  app.get(OPERATOR_SHOW_ROUTE, async (req, reply) => {
    const { id } = req.params as { id: string };
    /**
     * **An operator act is never forwarded**, and a replica says so instead of
     * relaying one.
     *
     * Every other canvas-scoped route hands its request to the home that owns
     * the canvas. This one must not, and the reason is the proof: it was made
     * at THIS origin, for a list THIS home's configuration names, and a
     * daemon that passed it up would be asking another home to honour a
     * credential minted against a different project — or, worse, would honour
     * one on behalf of a home whose ledger never heard about it. The ledger
     * belongs to the home that acted, so the act has to be sent there.
     */
    if (refuseIfReplica(id, reply)) return;
    const proven = await proveAct(req, reply, { act: "show", target: id });
    if (!proven) return;
    const reach = await reachOf(id);
    /**
     * **`show` answers for a canvas this home has taken down** (operator phase
     * 2, closing phase 1's open finding that it 404s on one).
     *
     * It is the read the operator makes when Kai writes back, or before a
     * `--lift`, so a takedown is precisely the state it must be able to
     * describe. The row rides on the reach rather than being a second call,
     * because "what does this home hold under that id" now has a second half
     * that a reader would otherwise have to know to go and ask for.
     */
    const down = await desk.takedownFor(id);
    const answer: OperatorShowResponse = {
      reach,
      ...(down ? { takedown: down } : {}),
    };
    await desk.settleOperatorAct(proven.id, "done", reach);
    return answer;
  });

  /**
   * **The ledger, read by the operator and nobody else** (design, "The
   * record").
   *
   * Innkeeper-private like every desk ledger, and enforced the same way every
   * operator act is: by the proof, not by a second rule. That a look at the
   * ledger is in the ledger is the property the design asks for one section
   * later, about the LOOK: *an act is never unrecorded, even when it is
   * unannounced*.
   *
   * **So the newest row in the answer is this read itself, saying
   * `attempted`** — because the row goes down before the act runs, and this
   * act is the reading. That is the one-rule-for-every-phase made visible
   * rather than an artefact to hide: filtering the row out would mean the
   * ledger showed one thing to its reader and another to the disk.
   */
  app.get(OPERATOR_LOG_ROUTE, async (req, reply) => {
    const query = (req.query ?? {}) as { target?: string; limit?: string };
    const target = typeof query.target === "string" && query.target ? query.target : null;
    const proven = await proveAct(req, reply, { act: "log", target });
    if (!proven) return;
    const limit = Number.parseInt(query.limit ?? "", 10);
    const acts = await desk.operatorActs({
      target,
      limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, 500) : 100,
    });
    await desk.settleOperatorAct(proven.id, "done", { rows: acts.length });
    return { acts } satisfies OperatorLogResponse;
  });

  /**
   * **An operator act is never forwarded** — the phase-1 branch every phase-2
   * verb needs, in one place rather than copied into each.
   *
   * A proof is made at ONE origin, against ONE attester project, and honoured
   * by that home only. A daemon that passed one up would be asking another
   * home to honour a credential minted against a different project — or, worse,
   * would honour one on behalf of a home whose ledger never heard about it. So
   * a replica answers 409 naming the home, and the act is sent there.
   */
  const refuseIfReplica = (canvasId: string, reply: FastifyReply): boolean => {
    const elsewhere = options.homes?.homeOf(canvasId) ?? null;
    if (!elsewhere) return false;
    void reply.status(409).send({
      error:
        `this daemon is a replica of ${canvasId}, not its home — an operator proof is made at ` +
        `one home and honoured by that home only. Ask ${elsewhere}.`,
      code: "not-this-home",
    });
    return true;
  };

  /**
   * **`isocan operator look` — the pass, minted after the proof** (operator
   * phase 2; design, "The look").
   *
   * The operator must judge a report and the canvas may be closed to the
   * address, so he needs a way in that is not *being let in by somebody*. What
   * this mints is the ordinary pass every other hand-over in this system uses,
   * with one field: `look: {until}`, which makes its redemption write `{root:
   * "operator", until}` at `view` instead of the minter's rung.
   *
   * **Why a pass rather than an admission written straight onto a badge.** The
   * proof is made in a TERMINAL, and the canvas has to open in a BROWSER — two
   * surfaces, two badges, and the terminal cannot write on the browser's. A
   * pass is exactly the shape this system already has for "hand a way in to a
   * surface that is not this one": `<address>#<token>`, redeemed by whatever
   * tab the link is opened in. Nothing new had to be invented, and nothing new
   * can be got wrong.
   *
   * **The reason is required.** A look is unannounced — nobody in the room
   * sees him arrive — and the ledger is the counterweight (design, "The
   * look"). A look with no reason recorded would be exactly the thing the
   * ledger exists to prevent.
   */
  app.post(OPERATOR_LOOK_ROUTE, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (refuseIfReplica(id, reply)) return;
    const body = (req.body ?? {}) as { reason?: string };
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const proven = await proveAct(req, reply, {
      act: "look",
      target: id,
      ...(reason ? { reason } : {}),
    });
    if (!proven) return;
    if (!reason) {
      await desk.settleOperatorAct(proven.id, "no-reason");
      return reply.status(400).send({
        error:
          "a look needs a reason, because a look is unannounced: nobody on the canvas is told " +
          "you arrived, and the ledger row is the only record that it happened. " +
          "`--reason \"report from …\"`.",
        code: "no-reason",
      });
    }
    /**
     * **The canvas has to be here**, and the refusal is the ordinary 404 the
     * route would give anyway — asked BEFORE the pass is minted so that a
     * mistyped id does not leave a redeemable pass for a canvas that does not
     * exist. A canvas this home has TAKEN DOWN cannot be looked at either, and
     * that is right rather than awkward: the operator took it down, `show`
     * still answers for it, and looking at what is no longer served would be a
     * door this act quietly re-opened.
     */
    const reach = await reachOf(id);
    const at = new Date();
    const until = new Date(at.getTime() + OPERATOR_LOOK_MS).toISOString();
    const { record, token } = mintPass({
      canvasId: id,
      mintedBy: req.badge!.badgeId,
      look: { until },
    });
    await sourceMutation(req, id);
    await desk.putPass(record);
    /**
     * The token and the window, and **not a URL**: the address to open is the
     * home the CLI proved at, which it holds and this process can only guess
     * at from behind a proxy. `operatorLookUrl` in core builds it, so the one
     * caller that needs it spells it the same way the web app spells every
     * other canvas address.
     */
    const answer: OperatorLookResponse = { until, token, reach };
    await desk.settleOperatorAct(proven.id, "done", { until, canvasId: id });
    return answer;
  });

  /**
   * **`isocan operator takedown` and `--lift`** (operator phase 2; design,
   * "Take a canvas down").
   *
   * **Taking down is not deleting, and the order of the writes is what makes
   * that true under a crash.** A delete is the owner's: an op, into the log,
   * broadcast as `canvas-deleted`, erasing the copy on every linked daemon and
   * tab. This is the home's, and every step below is careful to leave every
   * replica's copy exactly where it is.
   *
   * The order:
   *
   * 1. **The ledger row**, before anything (`proveAct`) — the project's one
   *    rule for every phase.
   * 2. **The desk row**, which holds the reason the surfaces show and the note
   *    they do not. Before the flag, so a crash between them leaves a canvas
   *    still being served with a row saying why it should not be — which is
   *    recoverable by reading the row. The other order leaves a canvas refused
   *    with nothing to say about it, which is the *not found* the design names
   *    as the one thing a takedown must never look like.
   * 3. **The store flag**, which is what actually stops it being served, on
   *    both backings, where `load` refuses `deleted`.
   * 4. **The registry**, so the door and the socket layer answer at once
   *    rather than at the next boot.
   * 5. **What is already open**: the engine's copy dropped, the sockets closed
   *    with a reason that is NOT `canvas-deleted`, the parked rc holds ended.
   *    The parked `isocan wait` needs nothing here — it re-collects when its
   *    poll wakes, meets the door, and is refused with the sentence.
   *
   * A lift walks it backwards, and is the whole of "nothing is irreversible
   * until purge": no op was ever appended, so the log replays as it was.
   */
  app.post(OPERATOR_TAKEDOWN_ROUTE, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (refuseIfReplica(id, reply)) return;
    const body = (req.body ?? {}) as OperatorTakedownRequest;
    const lifting = body.lift === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const proven = await proveAct(req, reply, {
      act: lifting ? "lift" : "takedown",
      target: id,
      ...(reason ? { reason } : {}),
      ...(note ? { note } : {}),
    });
    if (!proven) return;
    const refuse = async (code: string, error: string, status = 400) => {
      await desk.settleOperatorAct(proven.id, code);
      return reply.status(status).send({ error, code });
    };

    const standing = refusals.of(id);
    if (lifting) {
      if (!standing) {
        return refuse(
          "not-taken-down",
          `${id} is not taken down at this home, so there is nothing to lift.`,
          409,
        );
      }
      /**
       * **A purged canvas is never lifted** (operator phase 3). The store
       * refuses to load it whatever the flag says, so a lift here could only
       * clear a flag on a tombstone and tell the operator the canvas was
       * served again when nothing is. The id stays taken; the sentence stays.
       */
      if (standing.purgedAt) {
        return refuse(
          "purged",
          `${id} was purged at this home on ${standing.purgedAt.slice(0, 10)}: there is ` +
            "nothing under the id to bring back, and the id stays taken.",
          409,
        );
      }
      const lifted = { at: new Date().toISOString(), by: proven.proof.attribute, actId: proven.id };
      await desk.liftTakedown(id, lifted);
      await store.setTakenDown(id, null);
      // The engine's copy was dropped when it came down and there is nothing
      // cached to correct; the next read loads it from the backing, which now
      // answers. Replicas come back on their own — the home link re-dials a
      // refused canvas at the slowest backoff, which is journey 5 step 2.
      const row = (await desk.takedownFor(id))!;
      refusals.remember(row);
      const answer: OperatorTakedownResponse = {
        takedown: row,
        reach: { sockets: 0, waits: 0, holds: 0, relays: 0, files: 0, bytes: 0 },
        cdn: null,
      };
      await desk.settleOperatorAct(proven.id, "done", answer.reach);
      return answer;
    }

    if (standing) {
      return refuse(
        "already-taken-down",
        `${id} was already taken down at this home on ${standing.at.slice(0, 10)}: ` +
          `${standing.reason}. \`--lift\` brings it back.`,
        409,
      );
    }
    if (!reason || !isTakedownReason(reason)) {
      return refuse(
        "no-reason",
        `a takedown needs a reason from this list, because the reason is what the people on ` +
          `that canvas are shown: ${takedownReasonList()}. The --note is yours and nobody ` +
          "else's.",
      );
    }
    /**
     * The reach is read BEFORE the canvas stops being servable, because after
     * it the snapshot cannot be loaded at all — and the counts are the answer
     * to journey 3 step 2, which the operator pastes into a reply to Kai.
     */
    const reach = await reachOf(id);
    /** Narrowed by `isTakedownReason` above, and NAMED here: the field the
     * affected people are shown is a category from a closed list, never the
     * string a terminal happened to send. */
    const category: TakedownReason = reason;
    const row: CanvasTakedown = {
      canvasId: id,
      at: new Date().toISOString(),
      reason: category,
      ...(note ? { note } : {}),
      by: proven.proof.attribute,
      actId: proven.id,
    };
    await desk.recordTakedown(row);
    await store.setTakenDown(id, row.at);
    refusals.remember(row);
    engine.drop(id);
    const sockets = options.sockets?.close(id, WS_NOT_ADMITTED, TAKEN_DOWN) ?? 0;
    const holds = options.rc?.endCanvas(id) ?? 0;
    /**
     * **The parked waits, woken.** A `/api/oplog/watch` is a long poll holding
     * a promise, and nothing in `engine.onEvent` reaches it for a takedown —
     * the watch subscriber filters to `op-applied`, and a takedown is
     * deliberately not an op. So they are woken here, and what wakes them is a
     * re-collection that goes through the door and meets the refusal with the
     * sentence. The CLI exits non-zero and does not re-park.
     */
    const waits = wakeWatchers(id);
    /** What it actually reached, counted at the moment of acting rather than
     * estimated — journey 3 step 2's *two tabs closed, one wait ended, one
     * replica told*, which the operator pastes into a reply. */
    const reached: TakedownReach = {
      sockets,
      waits,
      holds,
      relays: reach.replicas.length,
      files: reach.files,
      bytes: reach.bytes,
    };
    const answer: OperatorTakedownResponse = {
      takedown: row,
      reach: reached,
      cdn: cdnPurgeFor(id),
    };
    await desk.settleOperatorAct(proven.id, "done", answer.reach);
    return answer;
  });

  /**
   * **`isocan operator purge --force`** (operator phase 3; design, "Purge: the
   * bytes"; journey 6).
   *
   * **The second of two deliberate acts, and the first irreversible one.**
   * Refused unless the canvas is taken down — at this route with the
   * journey's sentence, and again at the store, which throws on a canvas it
   * still serves, so that no wiring above the seam can make an erasure the
   * first act on a canvas. Everything before this lifts; this does not, and
   * the honest thing it can do about that is say exactly what is gone and
   * exactly what is not.
   *
   * The same proof, the same ledger row before anything, the same preflight
   * and the same replica refusal as every other verb: a purge is not a
   * different kind of act, it is the takedown's second half, and it does not
   * get a second path.
   *
   * The order:
   *
   * 1. **The ledger row**, before anything (`proveAct`).
   * 2. **The refusals** — no `force`, not taken down, already purged — each
   *    settled onto the row, because somebody asked this home to erase
   *    something and that is what a ledger is for.
   * 3. **The reach**, read while the tombstone can still say who made it and
   *    how many replicas were relaying — the fourth horizon's number.
   * 4. **The store's purge**, which is the act. It marks the tombstone
   *    FIRST, so a crash mid-way leaves a canvas `load` already refuses.
   * 5. **The desk row**, marked purged with the counts — the record journey 6
   *    step 3 says stays — and the registry, so a lift is refused at once.
   *
   * Nothing here reaches sockets, waits or holds: the takedown already did,
   * and anything that arrived since met the door's refusal. The engine's copy
   * is dropped again anyway, because a purge that trusted the takedown to have
   * done it would be a purge that could serve bytes it just erased.
   */
  app.post(OPERATOR_PURGE_ROUTE, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (refuseIfReplica(id, reply)) return;
    const body = (req.body ?? {}) as OperatorPurgeRequest;
    const proven = await proveAct(req, reply, { act: "purge", target: id });
    if (!proven) return;
    const refuse = async (code: string, error: string, status = 400) => {
      await desk.settleOperatorAct(proven.id, code);
      return reply.status(status).send({ error, code });
    };
    if (body.force !== true) {
      return refuse(
        "no-force",
        `a purge erases what this home holds under ${id} and cannot be lifted. Say so: ` +
          "`--force`.",
      );
    }
    const standing = refusals.of(id);
    if (!standing) return refuse("not-taken-down", purgeNeedsTakedown(id), 409);
    if (standing.purgedAt) {
      return refuse(
        "already-purged",
        `${id} was already purged at this home on ${standing.purgedAt.slice(0, 10)}.`,
        409,
      );
    }
    const reach = await reachOf(id);
    engine.drop(id);
    const report = await store.purgeCanvas(id);
    const { keeps, ...erased } = report;
    const at = new Date().toISOString();
    await desk.markPurged(id, { at, actId: proven.id, counts: erased });
    const row = (await desk.takedownFor(id))!;
    refusals.remember(row);
    const answer: OperatorPurgeResponse = {
      takedown: row,
      erased,
      survives: [...keeps, replicasHorizon(reach.replicas.length)],
    };
    await desk.settleOperatorAct(proven.id, "done", { erased, survives: answer.survives });
    return answer;
  });

  /**
   * **`isocan operator end`** (operator phase 4; design, "End a badge";
   * journey 7).
   *
   * The owner's path, `killAndSweep`, with the `mySurfaces` check replaced by
   * the proof — and the four gaps that path had are already closed for
   * everyone by the first half of this phase, so what this route adds is the
   * TARGET and the RECORD. Targets resolve by the id a report names: a badge
   * id; an actor, through `actor.join`'s `resolveActor`, so a folded identity
   * is one target; or an address, through `badgesAttesting`. The reach is
   * read and answered BEFORE anything is ended, on a `preview`, so the verb
   * lists what the id reaches — the badges, the actors they claim, the rooms
   * they are in, and the enrolments those badges' passes let in — and asks
   * whether to end the enrolments too (journey 7 step 2).
   *
   * **Not a listing.** Every badge described here was reached through the id
   * the operator named, and a badge that no id names is not describable —
   * the same narrowing `mySurfaces` has, for the same reason.
   *
   * **The tombstone carries the operator's half**: the reason category, the
   * address that acted, and the act id, written by `killBadge` in the same
   * write as the stamp, so the sentence every surface reads is rendered from
   * one record — *This surface was ended by the operator of this home on
   * <date>: <reason>. Write to <address>.* Ending is not refusing: the person
   * can knock again as a stranger, and the verb says so.
   *
   * The same proof, the same ledger row before anything, the same preflight
   * as phases 1–3. A preview is an act too — somebody with a proof asked this
   * home what an address reaches — and settles as `previewed`.
   */
  app.post(OPERATOR_END_ROUTE, async (req, reply) => {
    const { target } = req.params as { target: string };
    const body = (req.body ?? {}) as OperatorEndRequest;
    const previewing = body.preview === true;
    const withEnrolments = body.withEnrolments === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const proven = await proveAct(req, reply, {
      act: "end",
      target,
      ...(reason ? { reason } : {}),
      ...(note ? { note } : {}),
    });
    if (!proven) return;
    const refuse = async (code: string, error: string, status = 400) => {
      await desk.settleOperatorAct(proven.id, code);
      return reply.status(status).send({ error, code });
    };

    /**
     * **The target, resolved to live badges.** A badge id names one; an
     * address names every live badge that proved it; anything else is an
     * actor id, folded to the person who answers for it now and widened to
     * every alias that folds into them, so a report naming `Dimitri 2` ends
     * Dimitri's surfaces and not half of them.
     */
    const found = new Map<string, BadgeRecord>();
    let kind: OperatorEndReach["target"]["kind"];
    if (target.startsWith("bdg_")) {
      kind = "badge";
      const badge = await desk.badge(target);
      if (badge) found.set(badge.badgeId, badge);
    } else if (target.includes(":")) {
      kind = "address";
      const attribute = normalizeAttribute(target);
      if (!attribute) {
        return refuse("bad-target", `${target} is not an address this home can read — say email:<address>.`);
      }
      for (const badge of await desk.badgesAttesting(attribute)) found.set(badge.badgeId, badge);
    } else {
      kind = "actor";
      const joins = await engine.actorJoins();
      for (const alias of actorAliases(joins, resolveActor(joins, target))) {
        for (const holder of await desk.claimants(alias)) {
          if (holder.badgeId === SHELF || found.has(holder.badgeId)) continue;
          const badge = await desk.badge(holder.badgeId);
          if (badge) found.set(badge.badgeId, badge);
        }
      }
    }

    /**
     * **What those badges left behind**: every live badge whose admission to
     * some room is rooted in a pass one of them minted — the enrolments
     * innkeeper.md says outlive their creating badge — and the passes still
     * outstanding. Read from the rooms the targets are in, which is where a
     * pass-rooted admission can be, and where the sweep would walk anyway.
     */
    const enrolled = new Map<string, BadgeRecord>();
    const rooms = new Set<string>();
    for (const badge of found.values()) for (const a of badge.admissions) rooms.add(a.canvasId);
    for (const canvasId of rooms) {
      for (const other of await desk.badgesIn(canvasId)) {
        if (found.has(other.badgeId) || enrolled.has(other.badgeId)) continue;
        const byPass = other.admissions.some(
          (a) => a.canvasId === canvasId && a.provenance.root === "pass" && found.has(a.provenance.badgeId),
        );
        if (byPass) enrolled.set(other.badgeId, other);
      }
    }
    const now = new Date().toISOString();
    let passes = 0;
    for (const badge of found.values()) {
      for (const pass of await desk.passesMintedBy(badge.badgeId)) {
        if (pass.redeemedAt === undefined && !passExpired(pass, now)) passes += 1;
      }
    }
    const names = await engine.actorNames();
    const surface = (record: BadgeRecord): EndedSurface => ({
      badgeId: record.badgeId,
      kind: record.kind,
      actors: [...new Map(record.claims.map((c) => [c.actorId, c])).keys()].map((id) => ({
        id,
        name: names[id] ?? "",
      })),
      canvases: record.admissions.length,
      lastSeen: record.lastSeen,
    });
    const reach: OperatorEndReach = {
      target: { kind, id: target },
      badges: [...found.values()].map(surface),
      enrolments: [...enrolled.values()].map(surface),
      passes,
    };

    if (previewing) {
      const answer: OperatorEndResponse = {
        reach,
        ended: [],
        reached: { sockets: 0, waits: 0 },
        swept: { expelled: 0, rerooted: 0 },
        sentence: null,
      };
      await desk.settleOperatorAct(proven.id, "previewed", reach);
      return answer;
    }
    if (found.size === 0) {
      return refuse(
        "nothing-to-end",
        `${target} names no live badge at this home — it was never here, or it is already ended. ` +
          "`isocan operator log --target " + target + "` says which.",
        404,
      );
    }
    if (!reason || !isTakedownReason(reason)) {
      return refuse(
        "no-reason",
        `an end needs a reason from this list, because the reason is what the person is shown: ` +
          `${takedownReasonList()}. The --note is yours and nobody else's.`,
      );
    }
    const category: TakedownReason = reason;
    const end: OperatorEnd = { reason: category, by: proven.proof.attribute, actId: proven.id };
    const ended: string[] = [];
    const reached = { sockets: 0, waits: 0 };
    const swept = { expelled: 0, rerooted: 0 };
    const targets = [...found.values(), ...(withEnrolments ? enrolled.values() : [])];
    for (const badge of targets) {
      const outcome = await killAndSweep(
        desk,
        badge.badgeId,
        req.badge!.badgeId,
        now,
        (canvasId) =>
          engine.getSnapshot(canvasId).then(
            (snapshot) => snapshot.project.createdBy.id,
            () => null,
          ),
        sweeps.report,
        sweeps.ended,
        end,
      );
      if (!outcome) continue; // ended by somebody between the reach and the act
      ended.push(badge.badgeId);
      reached.sockets += outcome.reached.sockets;
      reached.waits += outcome.reached.waits;
      swept.expelled += outcome.swept.expelled;
      swept.rerooted += outcome.swept.rerooted;
    }
    const answer: OperatorEndResponse = {
      reach,
      ended,
      reached,
      swept,
      sentence: endOf({ ...targets[0]!, killedAt: now, killedBy: req.badge!.badgeId, end }).sentence,
    };
    await desk.settleOperatorAct(proven.id, "done", { ended, reached, swept, reach });
    return answer;
  });

  /**
   * **`isocan operator revoke`** (operator phase 5; design, "Turn off a
   * grant"; journey 8).
   *
   * The owner's revoke with `own` replaced by the proof: the same
   * `desk.revokeGrant`, the same sweep of the canvas — or of every canvas in
   * the space — and the same `?bar=1`, reached through the owner's own route
   * helpers rather than a second path, so what the operator can turn off is
   * exactly what an owner can, one scope at a time, by the subject a report
   * names. The target is the id the report names too: a canvas or a space,
   * told apart by their prefixes, because the ledger's `target` column is
   * what `isocan operator log --target` is asked about afterwards.
   *
   * **What is different is the tombstone.** The row gains `revokedVia:
   * "operator"` and the operator's half — reason, address, act id — in the
   * same desk write as the stamp, so the Share dialog and `isocan share`
   * render *turned off by the operator of this home on <date>: <reason>*
   * instead of a badge id. The socket the sweep closes still reads
   * `withdrawn`, deliberately: the person inside lost their access, which is
   * what `withdrawn` has meant since roles phase 2, and the owner's Share is
   * where the account of why lives. `taken-down` stays the canvas's word.
   *
   * **The owner can turn it back on**, and this route does nothing to stop
   * her: her re-grant is `POST …/grants`, an ordinary owner's write with no
   * proof, no ledger row and a new row on the desk. The operator's row stays
   * a tombstone under it, which is why `operatorTurnedOff` stops showing the
   * sentence the moment a live row names the subject again.
   *
   * The same proof, the same ledger row before anything, the same preflight
   * and the same replica refusal as phases 1–4. A bar the operator lifted
   * would be a grant of access, so a bar is refused as a target.
   */
  app.post(OPERATOR_REVOKE_ROUTE, async (req, reply) => {
    const { target } = req.params as { target: string };
    const kind: OperatorRevokeResponse["target"]["kind"] = target.startsWith("spc_") ? "space" : "canvas";
    if (kind === "canvas") {
      if (refuseIfReplica(target, reply)) return;
    } else {
      // A space's rows live at the home the space routes forward to; an
      // operator act is never forwarded (phase 1), so a replica says so.
      const elsewhere = options.homes?.homeScoped()?.homeUrl ?? null;
      if (elsewhere) {
        return reply.status(409).send({
          error:
            `this daemon forwards its spaces to ${elsewhere}, and an operator proof is made at one ` +
            `home and honoured by that home only. Ask ${elsewhere}.`,
          code: "not-this-home",
        });
      }
    }
    const body = (req.body ?? {}) as Partial<OperatorRevokeRequest>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const bar = body.bar === true;
    const proven = await proveAct(req, reply, {
      act: "revoke",
      target,
      ...(reason ? { reason } : {}),
      ...(note ? { note } : {}),
    });
    if (!proven) return;
    const refuse = async (code: string, error: string, status = 400) => {
      await desk.settleOperatorAct(proven.id, code);
      return reply.status(status).send({ error, code });
    };

    const badSubject = grantSubjectRefusal(body.subject);
    if (badSubject) return refuse("bad-grant", badSubject);
    const subject = normalizeSubject(body.subject as GrantSubject);

    /** The scope's creator, for the bar's refusal and the sweep's floor. */
    let creator: string;
    if (kind === "space") {
      const space = await desk.space(target);
      if (!space) return refuse("unknown-space", `no space ${target} at this home.`, 404);
      creator = space.createdBy;
    } else {
      const project =
        (await engine
          .getSnapshot(target)
          .then((loaded) => loaded.project)
          .catch(() => null)) ??
        (await store.listCanvases()).find((canvas) => canvas.id === target) ??
        null;
      if (!project) return refuse("unknown-canvas", `no canvas ${target} at this home.`, 404);
      creator = project.createdBy.id;
    }
    const rows = kind === "space" ? await desk.grantsForSpace(target) : await desk.grantsFor(target);
    const live = liveGrants(rows).find((row) => row.subject === subject);
    if (!live) {
      return refuse(
        "nothing-to-revoke",
        `${subject} has no live row on ${target} — it was never granted there, or it is already off. ` +
          "`isocan operator log --target " + target + "` says which.",
        404,
      );
    }
    if (isBar(live)) {
      return refuse(
        "is-a-bar",
        `${subject} is kept out of ${target}, not let in: that row is a bar, and revoking it would ` +
          "let them back in, which is the owner's to do.",
        409,
      );
    }
    if (!reason || !isTakedownReason(reason)) {
      return refuse(
        "no-reason",
        `a revoke needs a reason from this list, because the reason is what the owner is shown: ` +
          `${takedownReasonList()}. The --note is yours and nobody else's.`,
      );
    }
    if (bar) {
      const refusal = barSubjectRefusal(subject);
      if (refusal) return refuse("bad-grant", refusal);
      if (await namesTheCreator(subject, { createdBy: { id: creator } })) {
        return refuse("bad-grant", `${subject} is the creator's own address — the creator cannot be kept out`);
      }
    }

    const category: TakedownReason = reason;
    const now = new Date().toISOString();
    const via: OperatorRevocation = { reason: category, by: proven.proof.attribute, actId: proven.id };
    const revoked = (await desk.revokeGrant(live.id, now, req.badge!.badgeId, via)) ?? live;
    // The bar goes on the desk before the sweep, for the owner's route's
    // reason: the sweep re-runs the door, and the door has to meet the bar.
    const written: Grant | null = bar
      ? kind === "canvas"
        ? barRow(target, subject, req.badge!.badgeId)
        : { id: newId("gnt"), spaceId: target, subject, grantedBy: req.badge!.badgeId, at: now, bars: true }
      : null;
    if (written) await desk.putGrant(written);
    const swept =
      kind === "canvas"
        ? { ...(await sweepCanvas(desk, target, creator, sweeps.report)), reached: 1 }
        : await sweepSpace(desk, target, creatorOf, sweeps.report);
    const answer: OperatorRevokeResponse = {
      target: { kind, id: target },
      grant: revoked,
      ...(written ? { bar: written } : {}),
      reached: swept.reached,
      swept: { expelled: swept.expelled, rerooted: swept.rerooted },
      sentence: revokedSentence(revoked) ?? "",
    };
    await desk.settleOperatorAct(proven.id, "done", {
      subject,
      grantId: live.id,
      ...(written ? { bar: written.id } : {}),
      reached: swept.reached,
      swept: answer.swept,
    });
    return answer;
  });

  /**
   * **`isocan operator refuse` and `--lift`** (operator phase 6; design,
   * "Refuse at the door"; journey 9).
   *
   * The roles bar moved to home scope: one desk row the operator writes,
   * lifts and reads, loaded into the door's registry and re-read on write. It
   * shares everything with the phase-2 takedown — the proof, the ledger row
   * before anything, the same preflight — and the two things that are its own:
   *
   * - **Refusing an address ends every badge that proved it, in the same act**
   *   (journey 9 step 1). `killAndSweep` per badge, phase 4's machinery, with
   *   the operator's half of the tombstone so each ended person reads the
   *   *ended* sentence, not silence. A name and a network end no badge — a
   *   name refusal stops it coming BACK, and a network is not a badge.
   * - **A network refusal expires by default** (journey 9 step 3), a day, so
   *   the row carries `expiresAt`; `--for` sets it on any subject.
   *
   * Never forwarded, like every operator act: a replica says so. A refusal is
   * a home fact, and `net:` in particular is about knocks THIS home's meter
   * sees.
   */
  app.post(OPERATOR_REFUSE_ROUTE, async (req, reply) => {
    const { subject: raw } = req.params as { subject: string };
    const body = (req.body ?? {}) as OperatorRefuseRequest;
    const lifting = body.lift === true;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const proven = await proveAct(req, reply, {
      act: "refuse",
      target: raw,
      ...(reason ? { reason } : {}),
      ...(note ? { note } : {}),
    });
    if (!proven) return;
    const refuse = async (code: string, error: string, status = 400) => {
      await desk.settleOperatorAct(proven.id, code);
      return reply.status(status).send({ error, code });
    };

    const parsed = refusalSubjectOf(raw);
    if (!parsed) return refuse("bad-subject", refusalSubjectRefusal(raw)!);
    const { subject, kind } = parsed;
    // The registry's clock, so the horizon this act WRITES and the horizon the
    // door READS are one clock — the acceptance's movable `--for 10m`.
    const nowMs = refusals.nowMs();
    const now = new Date(nowMs).toISOString();

    /**
     * **The lift** — a rewrite of the one row, never a second. It does NOT
     * un-end the badges an address refusal ended: ending is `killAndSweep`,
     * and a lifted refusal means the address may prove again and be admitted,
     * not that the surfaces ended by the refusal come back. The verb says so.
     */
    if (lifting) {
      const standing = refusals.refusalOf(subject);
      if (!standing) {
        return refuse(
          "nothing-to-lift",
          `${raw} is not refused at this home — it was never refused, or the refusal is already ` +
            `gone. \`isocan operator log --target ${raw}\` says which.`,
          409,
        );
      }
      await desk.liftRefusal(subject, { at: now, by: proven.proof.attribute, actId: proven.id });
      const lifted = await desk.refusalFor(subject);
      if (lifted) refusals.rememberRefusal(lifted);
      const answer: OperatorRefuseResponse = {
        refusal: lifted ?? standing,
        reach: { kind, ended: [], reached: { sockets: 0, waits: 0 }, swept: { expelled: 0, rerooted: 0 }, holders: 0 },
        sentence: null,
      };
      await desk.settleOperatorAct(proven.id, "done", { subject, lifted: true });
      return answer;
    }

    if (!reason || !isTakedownReason(reason)) {
      return refuse(
        "no-reason",
        `a refusal needs a reason from this list, because the reason is what the person is shown: ` +
          `${takedownReasonList()}. The --note is yours and nobody else's.`,
      );
    }
    const category: TakedownReason = reason;

    /** `--for`, or a day for a network, or nothing. */
    let expiresAt: string | undefined;
    if (typeof body.for === "string" && body.for.trim()) {
      const ms = parseRefusalDuration(body.for.trim());
      if (ms === null) {
        return refuse("bad-duration", `not a duration: \`${body.for}\` — say 10m, 24h or 7d.`);
      }
      expiresAt = new Date(nowMs + ms).toISOString();
    } else if (kind === "net") {
      expiresAt = new Date(nowMs + NET_REFUSAL_DEFAULT_MS).toISOString();
    }

    const row: HomeRefusal = {
      subject,
      kind,
      at: now,
      reason: category,
      ...(note ? { note } : {}),
      by: proven.proof.attribute,
      actId: proven.id,
      ...(expiresAt ? { expiresAt } : {}),
    };
    await desk.recordRefusal(row);
    refusals.rememberRefusal(row);

    /**
     * **Ending every badge that proved the address** (journey 9 step 1). Only
     * for `email:`/`repo:`, which a badge can attest; a name and a network end
     * nothing here. `killAndSweep` reaches the dead badge's own sockets and
     * parked waits (phase 4) and sweeps its rooms, so the ended people read
     * the *ended* sentence and the enrolments are handled as they always are.
     */
    const ended: string[] = [];
    const reached = { sockets: 0, waits: 0 };
    const swept = { expelled: 0, rerooted: 0 };
    let holders = 0;
    if (kind === "email" || kind === "repo") {
      const end: OperatorEnd = { reason: category, by: proven.proof.attribute, actId: proven.id };
      for (const badge of await desk.badgesAttesting(subject)) {
        const outcome = await killAndSweep(
          desk,
          badge.badgeId,
          req.badge!.badgeId,
          now,
          (canvasId) => engine.getSnapshot(canvasId).then((s) => s.project.createdBy.id, () => null),
          sweeps.report,
          sweeps.ended,
          end,
        );
        if (!outcome) continue;
        ended.push(badge.badgeId);
        reached.sockets += outcome.reached.sockets;
        reached.waits += outcome.reached.waits;
        swept.expelled += outcome.swept.expelled;
        swept.rerooted += outcome.swept.rerooted;
      }
    } else if (kind === "actor") {
      // A name refusal stops the name coming back; the badges holding it now
      // are `isocan operator end`'s to end. The verb prints this count so the
      // operator sees what a refusal did NOT do.
      const joins = await engine.actorJoins();
      for (const alias of actorAliases(joins, resolveActor(joins, subject.slice("actor:".length)))) {
        for (const holder of await desk.claimants(alias)) {
          if (holder.badgeId !== SHELF) holders += 1;
        }
      }
    }

    const reach: RefusalReach = { kind, ended, reached, swept, holders };
    const answer: OperatorRefuseResponse = {
      refusal: row,
      reach,
      sentence: refusalSentence(row),
    };
    await desk.settleOperatorAct(proven.id, "done", { subject, ended, reached, swept, holders });
    return answer;
  });

  /**
   * **Where the affected people read the sentence** (design, "The record").
   *
   * Not an operator route, and the only route in this phase that is not: the
   * operator reads the ledger, and everybody else reads one sentence about
   * what happened to a canvas they were on.
   *
   * Two shapes, and the caller says which by naming a canvas or not.
   * `?canvas=<id>` answers anybody — a member, a stranger with the address, a
   * replica that has just been refused — because the door already tells them
   * in the refusal, and a second read that refused to repeat it would make
   * *this was removed, and here is who to ask* depend on which surface you
   * were standing on. The listing is narrowed to what the badge may see,
   * because a listing that was not would be a roster of this home's
   * takedowns.
   */
  app.get(TAKEDOWNS_ROUTE, async (req) => {
    const query = (req.query ?? {}) as Record<string, string | undefined>;
    const one = query[TAKEDOWNS_CANVAS_PARAM];
    if (one) {
      const notice = refusals.notice(one);
      return { takedowns: notice ? [notice] : [] } satisfies TakedownsResponse;
    }
    const badge = req.badge;
    if (!badge) return { takedowns: [] } satisfies TakedownsResponse;
    const admitted = new Set(badge.admissions.map((a) => a.canvasId));
    const mine: TakedownNotice[] = [];
    const mayDiscover = canvasDiscovery(req);
    for (const row of refusals.all()) {
      if (admitted.has(row.canvasId)) {
        mine.push(noticeOf(row));
        continue;
      }
      /**
       * A member who has never opened it on this surface is still a member: the
       * door's own test, asked against the canvas's grants, which a takedown
       * leaves exactly where they were. The creator is read from the store's
       * canvas record rather than from a snapshot, because a snapshot is what
       * a taken-down canvas cannot produce.
       */
      const canvas = (await store.listCanvases()).find((c) => c.id === row.canvasId);
      if (!canvas) continue;
      if (await mayDiscover(canvas)) {
        mine.push(noticeOf(row));
      }
    }
    return { takedowns: mine } satisfies TakedownsResponse;
  });
}
