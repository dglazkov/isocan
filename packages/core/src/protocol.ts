import { INSTALL_SPEC } from "./address.ts";
import type { ActorColors, ActorNames } from "./identity.ts";
import type { Actor, Canvas, CanvasContents } from "./model.ts";
import type { LogEntry, OpEnvelope, Operation } from "./ops.ts";

/** Default daemon port, localhost only. */
export const DEFAULT_PORT = 4441;

// ---- WebSocket ----

export type ServerMessage =
  /**
   * **Proof the connection is still there**, sent on a timer whether or not
   * anything happened.
   *
   * A WebSocket that dies without a close frame — a laptop lid, a wifi-to-
   * cellular hop, a proxy reaping an idle connection — leaves the browser
   * reporting `readyState === OPEN` forever, because nothing writes to it and
   * so nothing fails. Every recovery this system has is reactive: `onclose`
   * reconnects, a seq gap resyncs, the `online` event dials. **A socket that
   * has silently died delivers none of those events**, so the tab sits there
   * showing a canvas that stopped updating, saying "live", and only a reload
   * fixes it. That was reported.
   *
   * Silence is therefore the thing that has to become measurable, and this is
   * the only way to measure it from a browser: the WebSocket API exposes no
   * protocol-level ping or pong, so liveness has to be an ordinary message.
   * It carries nothing — a heartbeat that carried state would be a second way
   * to learn the canvas, and there is exactly one.
   *
   * A client too old to know this type ignores it, which is what makes adding
   * it safe: unknown message types already fall through.
   */
  | { type: "heartbeat" }
  | {
      type: "snapshot";
      project: Canvas;
      canvas: CanvasContents;
      lastSeq: number;
      /** Chosen identity colors, so the first paint is already right. */
      colors: ActorColors;
      /** Current names (actor id → name), so a rename reaches the words
       * somebody wrote before it. Absent entries keep the stamped name. */
      names: ActorNames;
    }
  /**
   * The other half of the connect handshake: "you already have through
   * `from`, here is what happened since." What follows is one `op-applied`
   * per entry in `from+1 … lastSeq`, in order, replayed through the same
   * reducer a crash recovery replays — because it IS that code path.
   *
   * A client asks for this with `?since=N` and must be ready for either
   * answer: the home sends `snapshot` instead whenever it cannot serve the
   * tail (the client is ahead of it, or the entries have been compacted out
   * of the live log). That is not an error path, it is the fallback half of
   * one contract, and a client that treats a `snapshot` where it expected a
   * `resumed` as a failure has misread it.
   *
   * `colors` and `names` ride along for the same reason `snapshot` carries
   * them: a rename or a recolour that happened while the lid was shut has to
   * reach the words that were written before it, and nothing in the op tail
   * carries identity's public face.
   */
  | {
      type: "resumed";
      /** The cursor the client presented — the last seq it already holds. */
      from: number;
      /** The last seq it will hold once the tail below has been applied. */
      lastSeq: number;
      colors: ActorColors;
      names: ActorNames;
    }
  | { type: "op-applied"; entry: LogEntry }
  | { type: "canvas-deleted" }
  /** The roster carries the chosen identity colors with it: they change about
   * as often as who is here, and every client that needs one is already
   * listening. A color nobody else can see is not an identity, so it travels
   * on the same channel as the faces it paints. */
  | {
      type: "presence-roster";
      sessions: PresenceSession[];
      colors: ActorColors;
      names: ActorNames;
    };

/** Client → server. Presence is the ephemeral plane: daemon memory + WS
 * fan-out only — never the oplog, never storage, never undo. */
export type ClientMessage =
  | {
      type: "presence";
      /** The tab's client id — doubles as its presence session id. */
      sessionId: string;
      actor: Actor;
      cursor: { x: number; y: number } | null;
      selection: string[];
    }
  /**
   * A whole roster, from a connection that speaks for several people at once.
   *
   * This is the daemon's beat, not a tab's: "one connection carries several
   * actors" is the case mechanism 1 drew the badge for — Priya's daemon
   * relaying its CLI self AND Isaac — and a per-session `presence` message
   * cannot express it, because one socket is one presence session by
   * construction there.
   *
   * A full set replaces what that connection last relayed, rather than a diff:
   * the sender already has the whole roster in hand (it is what its own hub
   * holds), and a diff protocol would be a second thing to get wrong for no
   * saving worth measuring on a plane that is already coalesced.
   *
   * Sessions keep their ids, their `kind`, their labels and their statuses, so
   * a parked agent on somebody's laptop shows on the home's canvas as a parked
   * agent — Scene 4's dimmed face with a dashed ring — rather than as an
   * anonymous cursor. The receiving daemon still checks EVERY actor in it
   * against the relaying badge's claims and drops the ones it cannot vouch
   * for; the sender's word for who is here is not the sender's word for who it
   * may speak as.
   */
  | { type: "presence-relay"; sessions: PresenceSession[] };

// ---- presence sessions ----

export interface PresenceSession {
  sessionId: string;
  actor: Actor;
  kind: "web" | "cli";
  /**
   * Which harness this agent is — `claude-code`, `codex`, `gemini`.
   *
   * The daemon has always KNOWN this (session keys are `<harness>:<id>`) and
   * never showed it, so the one question a person actually has about a row of
   * agents — which of these is which — had no answer anywhere. Names carry a
   * hint of it now (a Claude comes up as Charlie), but a hint is not a label,
   * and an agent that asked for its own name has none.
   *
   * Client-asserted like the rest of presence, and null for a person: a
   * browser tab is a person at a browser, and saying "web" twice is not a
   * fact. It lives on the SESSION rather than the actor because it is a
   * property of this run — the same agent resumed under another harness is
   * still that agent.
   */
  harness: string | null;
  /** Display override; fall back to actor.name. */
  label: string | null;
  cursor: { x: number; y: number } | null;
  selection: string[];
  status: string | null;
  /**
   * Who is speaking when `status` is set — the same tri-state the update
   * side has always carried (below), now surviving the trip. It used to be
   * folded into a private daemon boolean on arrival, which left a client
   * unable to tell a PARKED agent (`wait`'s lifecycle status) from a WORKING
   * one except by string-matching the wait copy — a lie waiting for the day
   * the copy changed. Null exactly when `status` is null.
   *
   * Self-asserted like every presence field: it is UX honesty, not a trust
   * boundary. The trustworthy row facts remain the vouched actor id, the
   * server-chosen color, `lastSeen`, and attributed ops.
   */
  statusSource: "explicit" | "lifecycle" | "inferred" | null;
  /** "Busy here" — anchored to an item OR a freestanding point. Clients
   * render the motion locally; the daemon only stores the fact. Cleared by
   * explicit cursor commands and by any piggybacked op (working resolves
   * into done). */
  activity: PresenceActivity | null;
  /**
   * The thread this session is answering, if it has picked one up.
   *
   * Deliberately NOT part of `activity`. That field says where somebody is
   * STANDING, and it changes constantly — an agent answering a thread spends
   * most of its time working on the items the thread is about, and every
   * `session work`, every `point`, and every applied op moves it. What it is
   * ANSWERING does not change when it walks across the canvas to do the work.
   * Folding the two together meant an agent vanished from the thread the
   * instant it started working, which is exactly when you most want to see it.
   *
   * Cleared by the receipt — posting a comment — because that is the answer.
   */
  onThread: string | null;
  lastSeen: string;
  /**
   * **Which side of the wire this face is on**, as the daemon answering the
   * question sees it: `null` for its own client, or the connection key it was
   * mirrored in through (`home:<url>`).
   *
   * Derived per read rather than stored, so it always means "relative to
   * whoever is telling you". A face that is local at the home is mirrored at
   * every replica, and both answers are correct where they are given.
   *
   * It exists because a roster with nobody from the home in it has two very
   * different causes — nobody else is on the canvas, or this machine's socket
   * to the home is not carrying anything — and they printed identically. A
   * reader that can see no face came from the home can say which.
   *
   * Optional on the wire: it is a report, and nothing constructs a session
   * FROM it.
   */
  via?: string | null;
}

export type PresenceActivity =
  | { kind: "working"; itemId: string }
  | { kind: "working"; x: number; y: number }
  /** On a THREAD: picked up what was asked there and working on it. The other
   * two say where on the canvas somebody is; this one says what they are
   * answering, which is the question the person who asked it is waiting on.
   * Rendering it from the cursor's position instead — "is this dot near that
   * pin?" — is a guess, and it is wrong the moment the agent goes to look at
   * the thing it was asked about. */
  | { kind: "working"; threadId: string };

export interface CreateSessionRequest {
  actor: Actor;
  label?: string;
  /** See `PresenceSession.harness`. */
  harness?: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  ttlMs: number;
}

export interface UpdateSessionRequest {
  /** Who is holding this session now. Sent on every update so renaming
   * yourself re-labels the live face instead of waiting out its TTL — the
   * same contract the web's presence beat carries over the socket. */
  actor?: Actor;
  cursor?: { x: number; y: number } | null;
  selection?: string[];
  status?: string | null;
  /** Who is speaking when `status` is set. "explicit" (default) — the actor
   * said it (`session say/work --say`); it sticks until they post a comment
   * or say something else. "lifecycle" — the choreography itself (parking on
   * `wait`, being woken); overrides anything. "inferred" — narration derived
   * from what a command is doing; never displaces an explicit status. */
  statusSource?: "explicit" | "lifecycle" | "inferred";
  activity?: PresenceActivity | null;
  /** Pick up a thread, or (null) put it down. Omit to leave it alone: the
   * whole point is that it survives everything else a session does. */
  onThread?: string | null;
}

// ---- watching the whole home ----

/**
 * The cross-canvas long-poll behind `isocan wait`. An on-call agent listens
 * to canvases it has never opened — including ones created while it waits —
 * so the cursor is a MAP of per-canvas seqs rather than one number.
 *
 * Omit `cursors` to seed: the daemon returns no entries and the current tip
 * of every canvas, which is "everything from now on". A canvas missing from
 * a supplied map is watched from its very first op — exactly right for a
 * canvas born mid-wait.
 */
export interface WatchLogRequest {
  cursors?: Record<string, number>;
  /** Watch exactly these canvases and no others — what `wait --canvas` uses.
   * Omit to watch the whole home, canvases yet to be created included. */
  only?: string[];
  /** Hold the request open this long when nothing has landed yet. */
  waitMs?: number;
}

export interface WatchedLogEntry extends LogEntry {
  canvasId: string;
  /** The canvas's title, so a waiter can name where it was summoned. */
  canvasTitle: string;
  /** Set by `wait` on an entry that was handed to a previous park whose turn
   * left no trace — it is being delivered AGAIN, and the turn reading it may
   * already have answered. Never set by the daemon's watch route itself. */
  redelivered?: boolean;
}

export interface WatchLogResponse {
  /** Across all watched canvases, oldest first. */
  entries: WatchedLogEntry[];
  /** Feed straight back into the next request. */
  cursors: Record<string, number>;
}

// ---- the durable park cursor (on-demand phase 1) ----

/**
 * The park's cursor, moved out of the parked process. One row per actor per
 * canvas, held by the daemon the park polls — the home when the canvas is
 * local, the replica when it is not, and either way a row of HOME seqs,
 * because a replica writes the home's seqs verbatim. A killed park resumes
 * from its stored row; `--since` becomes a repair tool nobody has to know
 * about.
 *
 * Claiming ADOPTS the row: one reader per row, newest wins. The `parkId` in
 * the response is a lease — the daemon refuses a delivery or advance carrying
 * a stale one with `PARK_ADOPTED_CODE`, which is how a displaced park learns
 * to stand down instead of double-delivering the same comment as new.
 */
export interface ParkClaimRequest {
  canvasId: string;
  actorId: string;
  /** Reset the row to this seq — what `wait --since` means now. */
  since?: number;
}

export interface ParkClaimResponse {
  /** The lease. Present it on every delivery and advance. */
  parkId: string;
  /** Where to read from — everything at or before this seq is settled. */
  cursor: number;
  /**
   * Entries at or before this seq (and after `cursor`) were handed to a
   * previous park whose turn left no trace, so they are being handed AGAIN:
   * present them marked redelivered, never as new — the turn may already
   * have answered. Null when nothing is outstanding.
   */
  redeliverUpTo: number | null;
}

/** A wake handed entries out: record the high-water WITHOUT advancing the
 * cursor. The cursor advances only when the turn's completion shows — see
 * the claim's state machine in `server/src/park.ts`. */
export interface ParkDeliveredRequest {
  canvasId: string;
  actorId: string;
  parkId: string;
  /** The batch's tip — the watch response's cursor for this canvas. */
  tip: number;
}

/** A lap matched nothing for this actor: everything up to `to` was noise,
 * safe to settle without a turn. */
export interface ParkAdvanceRequest {
  canvasId: string;
  actorId: string;
  parkId: string;
  to: number;
}

/** Another park claimed this actor's cursor row — the caller's lease is dead
 * and it must stand down, not retry. */
export const PARK_ADOPTED_CODE = "park-adopted";

// ---- a client older than this home ----

/**
 * **The keys phase 13.5 renamed on the wire, and what they used to be
 * called.** The pairs are `[what this build requires, what a pre-13.5 client
 * sends]`.
 *
 * The rename was taken as a BREAK — no shim, no both-spellings, no migration
 * — because the audience is three people and launch has not happened. What a
 * break still owes anyone who hits it is a sentence they can act on, and
 * without one this is the codebase's oldest recurring failure wearing a new
 * coat: a pre-rename CLI can still READ from a post-rename daemon (a `GET`
 * carries its canvas in the path, which did not change) and dies on the first
 * WRITE with `error: internal error`, because `projectId` is not `canvasId`,
 * so no canvas is named, and the engine throws where nothing is looking.
 *
 * `BADGE_RESTART_HINT` above is the same shape one phase earlier, and its
 * comment is the rule: *a break that explains itself is a different thing
 * from a break.*
 */
export const RENAMED_WIRE_KEYS: ReadonlyArray<readonly [now: string, before: string]> = [
  ["canvasId", "projectId"],
  ["canvasTitle", "projectTitle"],
];

/**
 * The wire code for it — branchable, like every other refusal here, and its
 * own word rather than `bad-request`: nothing the caller can put in the body
 * fixes this one, so a client that retries on `bad-request` must not retry on
 * this.
 */
export const STALE_CLIENT_CODE = "stale-client";

/**
 * **426, not 400**, and the difference is who has to change.
 *
 * The 400s around it (`bad-op`, `actor is required`, `canvasId is required`)
 * all say *fix your request and send it again* — a caller reading them edits a
 * field. There is no field to edit here: the request is well formed for the
 * protocol the client was BUILT against, and the only thing that makes it
 * legal is a different binary. 426 is the registered status for exactly that
 * sentence, so it is the one status a proxy, a log line or a future client can
 * read without also reading the body.
 *
 * (RFC 7231 pairs 426 with an `Upgrade` header naming a transport protocol to
 * switch to. There is none — the version that changed is the application's —
 * so the header is deliberately omitted rather than filled with an invented
 * token that an intermediary might act on. The `code` field is where a machine
 * looks; the status is for everyone who never gets that far.)
 */
export const STALE_CLIENT_STATUS = 426;

/** The socket half of {@link STALE_CLIENT_STATUS}, continuing ws.ts's
 * 4400/4401/4404/4500 convention of 4000 + the HTTP status it mirrors. */
export const WS_STALE_CLIENT = 4426;

/** A WebSocket close reason is capped at 123 BYTES by the protocol itself, and
 * a longer one throws rather than truncating — so the socket gets its own,
 * shorter, sentence and this is the limit it is measured against. */
export const WS_CLOSE_REASON_BYTES = 123;

export interface StaleClientRefusal {
  code: typeof STALE_CLIENT_CODE;
  /** The `error` field of the refusal body — what a person reads in their
   * terminal, because the CLI prints `error: <message>` and nothing else. */
  error: string;
  /** The same refusal inside {@link WS_CLOSE_REASON_BYTES}. */
  closeReason: string;
}

/** Present enough to have been *sent*: `{projectId: null}` is what a
 * pre-rename CLI puts on `project.create`, so null is present, not absent. */
function sent(carrier: Record<string, unknown> | URLSearchParams, key: string): boolean {
  if (carrier instanceof URLSearchParams) return (carrier.get(key) ?? "") !== "";
  return carrier[key] !== undefined;
}

/** Absent enough to be missing: a null `canvasId` is what `project.create` and
 * `actor.claim` legitimately send, and neither names a canvas. */
function missing(carrier: Record<string, unknown> | URLSearchParams, key: string): boolean {
  if (carrier instanceof URLSearchParams) return (carrier.get(key) ?? "") === "";
  return carrier[key] === undefined || carrier[key] === null;
}

/**
 * **"Is this caller speaking the protocol from before the rename?"** — asked
 * in one place, by every surface that would otherwise answer it differently.
 *
 * The honest signal is BOTH halves: the key this build requires is absent AND
 * the key it replaced is present. Sniffing the old key alone would be wrong
 * the moment anything ever sends both; sniffing nothing at all and inferring
 * from the failure would relabel every malformed request in the product as a
 * version problem, which is a worse lie than `internal error` because it is a
 * confident one. A request carrying NEITHER key is simply malformed, and it
 * keeps the refusal it already had.
 *
 * Pass every object the key could have arrived in — a JSON body, the nested
 * `op`, a socket's query string. The first pair that matches wins; the message
 * names the pair, so it stays true if this list ever grows.
 */
export function staleClientRefusal(
  ...carriers: Array<Record<string, unknown> | URLSearchParams | null | undefined>
): StaleClientRefusal | null {
  for (const carrier of carriers) {
    // A body that parsed to a string, a number or an array carries no keys and
    // is somebody else's refusal.
    if (!carrier || typeof carrier !== "object") continue;
    for (const [now, before] of RENAMED_WIRE_KEYS) {
      if (!missing(carrier, now) || !sent(carrier, before)) continue;
      return {
        code: STALE_CLIENT_CODE,
        error:
          `this home speaks isocan's post-rename protocol: it needs \`${now}\`, ` +
          `and this request sent \`${before}\` instead. Your isocan is older than this ` +
          `home — upgrade it with \`npx ${INSTALL_SPEC} setup\` and run this again.`,
        closeReason: `isocan: this home needs ${now}, not ${before}; upgrade: npx ${INSTALL_SPEC} setup`,
      };
    }
  }
  return null;
}

// ---- REST payloads ----

export interface PostOpRequest {
  /** null only for project.create and actor.claim. */
  canvasId: string | null;
  /** **One gesture, one undo** — see `LogEntry.group`. Ops sent under the
   *  same id are undone and redone as one act. Minted by the client, because
   *  a group is an intent no daemon can infer. */
  group?: string;
  /** Who is speaking. Optional for actor.claim only — a claim RESOLVES who
   * is speaking, and the response envelope carries the answer. */
  actor?: Actor;
  clientId?: string;
  /**
   * **This op's name, minted by the client — the idempotency key** (phase 10).
   *
   * The envelope id, sent up instead of being minted at the daemon, so that
   * SENDING an op twice and MEANING it twice are different sentences on the
   * wire. A queue that retries is at-least-once by construction: the tab
   * posted, the network died before the answer came back, and it has no way
   * to know whether the op landed. Supplying the id makes the retry
   * answerable — the engine finds the entry it already wrote and hands back
   * the same `{ seq, envelope }`, appending nothing.
   *
   * **What it is NOT for.** It does not stop a second item appearing; nothing
   * ever did, because the vocabulary is already duplicate-proof by
   * construction — `item.add` carries a client-minted `itemId`,
   * `thread.create` a `threadId`, `thread.reply` a `comment.id`, and the
   * reducer refuses each of those with `duplicate-id`. Everything else is
   * either absolute-valued (`item.move`, `item.resize`, `item.update`, and so
   * idempotent by shape) or refuses on the second pass (`item.delete` →
   * `unknown-item`). What the key buys is that a REPLAY IS NOT MISTAKEN FOR A
   * REFUSAL: without it, a retried `item.add` comes back 400 `duplicate-id`,
   * indistinguishable from the home genuinely rejecting the work, and the
   * honest thing a client does with a refusal — roll the optimistic change
   * back and tell the person — would be a lie about an item that is sitting
   * in the canvas.
   *
   * `clientId` cannot do this job and never could: it names a CLIENT, not an
   * op, and a browser mints a fresh one on every page load — including the
   * reload-while-offline this phase exists to survive.
   *
   * Optional, and absence means "mint me one", so every caller that predates
   * phase 10 is unchanged.
   */
  opId?: string;
  /**
   * **Where this canvas is being born** — `project.create` only (phase 10.3).
   *
   * The home is a property of the CANVAS, not of the daemon, and this is how
   * the daemon is told which one at the only moment it can be told: a birth.
   * The value is the address the CLI resolved once, from the directory's
   * marker if it has one and the birth default otherwise — so what travels is
   * **the marker's assertion**, committed configuration read out of
   * `.isocan/project.json`, and not a flag.
   *
   * **It sits here, beside `opId` and `clientId`, and NOT in the op
   * vocabulary**, and the refusal is worth stating where somebody would
   * otherwise propose the op. A home assignment is not canvas state: no
   * reducer produces it; a hosted home cannot state its own public address
   * (`homeUrl` means "the address I answer to", and dev.isocan.io's daemon has
   * none), so it could never write the field truthfully for a canvas born
   * there; and `adoptRemoteSnapshot` rewrites the local canvas record from
   * the home's copy, so a replicated field would be clobbered on exactly the
   * machine whose routing depends on it. Worst of all, a replicated field
   * would let one machine rewrite another machine's routing. This is request
   * metadata about one hop, the same category as `opId`.
   *
   * **Meaningful only for `project.create`, refused elsewhere, and
   * write-once.** It ESTABLISHES a row for a canvas coming into existence and
   * can never re-point one that exists, because a second create for a live id
   * is `duplicate-id` or a replay. That bound is what makes the surface an
   * agent can reach exactly "the canvas I am creating right now is born at X"
   * — the same authority `isocan setup <address>` already has — rather than
   * "point this machine somewhere else", which is what a `--home` flag would
   * be and which phase 7.5 refused.
   *
   * Absent means "wherever this daemon's birth default says", which for a
   * daemon with no default is right here.
   */
  home?: string;
  op: Operation;
}

export interface PostOpResponse {
  seq: number;
  envelope: OpEnvelope;
}

export interface UndoRedoRequest {
  actor: Actor;
  clientId?: string;
}

export interface BlobUploadResponse {
  blobHash: string;
  mimeType: string;
  size: number;
}

/** The header a blob upload carries its filename in. */
export const FILENAME_HEADER = "X-Isocan-Filename";

/**
 * Above this, a blob does not go through the daemon.
 *
 * ONE number, here, because both clients branch on it and "the same
 * computation in two clients" is exactly what the house rules forbid. It is
 * below Cloud Run's 32 MiB HTTP/1 request-body cap with room to spare: a
 * hosted home physically cannot receive a larger body, so a client that
 * posted one would get a platform error with no isocan words in it. Under it
 * the bytes are posted to `POST /api/projects/:id/blobs` as they always have
 * been; over it the client asks for an upload ticket, PUTs straight to object
 * storage, and registers the hash.
 *
 * A `FileStore` home has no ticket to give and says so (`beginUpload` returns
 * null), so a local daemon keeps the single simple path at any size — the
 * split is the cloud backing's, not the protocol's.
 */
export const MAX_DIRECT_UPLOAD_BYTES = 24 * 1024 * 1024;

/** What the daemon hands back for a blob too big to post: where to PUT the
 * bytes, and the headers that were SIGNED into that URL — send them exactly,
 * or the upload is refused by the object store rather than by us. */
export interface UploadTicket {
  url: string;
  headers: Record<string, string>;
  /** ISO 8601. Short — minutes, not days. */
  expiresAt: string;
}

/** The daemon's answer to "I have a big blob": either a ticket, or the news
 * that these bytes are already here and no upload is needed. */
export type BeginUploadResponse =
  | { upload: UploadTicket; blob?: undefined }
  | { upload?: undefined; blob: BlobUploadResponse };

/**
 * Filenames travel percent-encoded, because a header value is a ByteString
 * and real filenames are not. Every macOS screenshot is named with U+202F
 * (narrow no-break space) before AM/PM, and handing that to `fetch` throws
 * before a request is ever made — which read, on the canvas, as a PNG that
 * silently refused to be dropped.
 */
export const encodeFilename = (filename: string): string => encodeURIComponent(filename);

/** Inverse of {@link encodeFilename}. A literal name from an older client or
 * a hand-rolled `curl` survives: only malformed escapes fall back. */
export function decodeFilename(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  if (!value) return "upload.bin";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export interface CanvasSnapshotResponse {
  project: Canvas;
  canvas: CanvasContents;
  lastSeq: number;
  /** Chosen identity colors (actor id → hex); absent entries are derived. */
  colors: ActorColors;
  /** Current names (actor id → name); absent entries keep the name that
   * was stamped on the comment or op being rendered. */
  names: ActorNames;
}

/**
 * **Does this copy of isocan disagree with the home it is talking to?**
 * Auto-upgrade phase 2's whole output: one comparison, reported and nothing
 * else.
 *
 * `stalenessOf` already knows two ways to be stale — another copy holds the
 * port, and this copy changed under a running daemon. This is the third and
 * the one that matters across machines: the op vocabulary is the isomorphism
 * contract, and the home is the other end of it.
 *
 * **Absent means no verdict, and absent is not "you are current."** The field
 * is omitted entirely when either side cannot say which build it is — an
 * offline daemon, a home that has never answered, a pre-phase-1 image whose
 * `commit` is null. An oracle that cannot answer must produce no verdict; a
 * check that cannot fail is the defect `/api/healthz` exists to prevent.
 */
export interface UpgradeVerdict {
  /**
   * The two builds are known and they differ. False is a real answer — the
   * home was asked and this copy is running what it runs — and it is why the
   * field is present at all in that case rather than omitted.
   */
  available: boolean;
  /**
   * Which side is older, when both dates say so; null when they cannot.
   *
   * **Shas identify builds, dates order them**, and neither measures how far
   * apart two builds are. `behind` is the ordinary case (the home is newer).
   * `ahead` is a home pinned or lagging behind its own CLIs — a notice, never
   * a downgrade.
   */
  direction: "behind" | "ahead" | null;
  /** The home this verdict came from. A machine can answer to several, so a
   * verdict that did not name one would be unattributable. */
  home: string;
  /** The build the home runs, and when it was cut. */
  homeCommit: string;
  homeBuiltAt: string | null;
  /** The build this copy runs, and when it was cut. */
  mine: string;
  mineBuiltAt: string | null;
  /** The comparison in one sentence of facts, naming both builds. Empty when
   * nothing differs. */
  why: string;
}

export interface HealthResponse {
  ok: true;
  pid: number;
  version: string;
  startedAt: string;
  /**
   * The home this daemon is a REPLICA of, when it is one; absent when the
   * daemon IS a home (every daemon before phase 6, and every daemon nobody has
   * configured).
   *
   * On the health route because that is the one call every client already
   * makes before it does anything else, and because the answer changes what a
   * client may say to a person: a replica serves no pages, so `isocan open`
   * and `isocan setup` must send them to this address instead of to
   * `127.0.0.1`, and the marker a new canvas gets must carry it.
   */
  home?: string;
  /**
   * **This daemon disagrees with its home about which build to be** — or,
   * when `available` is false, has asked and does not.
   *
   * On the health route because that is the one call every client already
   * makes (`makeCtx` fetches it before every command), so the CLI pays no
   * round trip for it and an offline machine simply has no field. The daemon
   * is what asks the home, on a timer of its own — see `HomeLink.askBuild`.
   */
  upgrade?: UpgradeVerdict;
}

/** Loopback, by the two literals a URL can produce plus the whole 127/8
 * block RFC 1122 reserves. `new URL()` hands IPv6 hosts back in brackets,
 * so `::1` arrives as `[::1]` and has to be recognized in that shape. */
const LOOPBACK = /^(\[::1\]|::1|localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

/**
 * WHICH health path to ask a daemon at this address for.
 *
 * The daemon answers `/healthz` and `/api/healthz` from one handler with one
 * body, so this is never a second thing to keep in sync — it is a choice of
 * which door to knock on, and the choice belongs to the ADDRESS rather than
 * to the caller.
 *
 * Why it existed, and why it stays after that reason expired. Phase 5 measured
 * Google's frontend claiming the exact path `/healthz` on the dev home and
 * answering its own branded 404, never reaching the container — so a probe
 * that had only ever spoken to 127.0.0.1 (`daemonPidOn`, `ensureDaemon`'s
 * startup poll, `warnIfStale`, `stopDaemons`, `isocan status`) would read a
 * live hosted home as DEAD the first time it was pointed at one. Phase 6
 * pointed all of them at one, and then re-measured: `/healthz` on that same
 * home now returns the daemon's own body. Something between the two days
 * changed, and which end of the wire it was is not established.
 *
 * The function stays, for the reason that never depended on the frontend:
 * `/api/` is the one prefix the SPA fallback does not answer with a cheerful
 * 200. `/healthz/` and `/HEALTHZ` come back as `index.html` at 200 — a check
 * on a near-miss path is green forever and cannot fail for the right reason.
 * So this is now DEFENSIVE rather than necessary, which is the honest way to
 * hold a guard against behaviour that went away without notice and can return
 * the same way.
 *
 * Loopback keeps `/healthz` deliberately: no frontend stands between a CLI and
 * its own daemon, every one of those callers works exactly as it does today,
 * and this stays an addition rather than a rename. `/api/healthz` is the other
 * answer because `/api/` is the one prefix the SPA fallback does not answer
 * with a cheerful 200 — a check that cannot fail is the defect the pair of
 * routes exists to avoid.
 *
 * Anything unparseable is treated as remote. That is the safe way to be wrong:
 * `/api/healthz` is answered on loopback too, so a mistake here costs nothing,
 * while guessing "loopback" about an address we could not read would resurrect
 * the exact failure this function exists to prevent.
 */
export function healthPath(base: string): string {
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    try {
      // A bare `127.0.0.1:4441` or `dev.isocan.io` — no scheme, still an
      // address somebody meant. Parsing it is cheaper than refusing it.
      host = new URL(`http://${base}`).hostname;
    } catch {
      return "/api/healthz";
    }
  }
  return LOOPBACK.test(host) ? "/healthz" : "/api/healthz";
}

// ---- the canvas listing: two callers, two questions, one route ----

/**
 * How far `GET /api/projects` may see — **stated by the caller**, never
 * inferred from who is calling.
 *
 * Two clients poll this route and they are not asking the same thing:
 *
 * - A **browser** asks "what can I open from here?" That is a person looking
 *   at their own home's front page, and the honest answer includes a canvas
 *   they have never been in but could walk into by clicking it — which on a
 *   solo home is most of them, because a canvas created from the CLI is
 *   admitted to the CLI's BEARER badge while the tab carries a COOKIE badge
 *   that has never been in it. Narrow this and the person opens `/` and
 *   cannot see the canvas their own agent just made.
 * - A **replica** asks "what am I supposed to be carrying?" A replica that
 *   answers that with "everything a door would let me through" mirrors a
 *   stranger's canvas onto a laptop because a link grant happened to be on —
 *   which is discovery by enumeration, and phase 7 named it the wrong
 *   primitive.
 *
 * So the route answers both and the CALLER says which. Sniffing the carrier
 * would be the obvious shortcut and it is the one this codebase already
 * refuses (`BadgeCarrier`: stated, never sniffed) — a bearer holder is a CLI
 * as often as it is a replica, and the day a browser holds a bearer the
 * sniff silently changes what a person can see.
 *
 * The vocabulary is deliberately the SAME two words `claimContext` already
 * uses for the same distinction one layer down (`NameReach` in the server's
 * engine), because it is the same distinction: what a badge has been let
 * into, versus what the door would let it into if it knocked.
 *
 * - `"admissible"` — admitted ∪ what a grant would admit. **The default**,
 *   which is what makes this change backwards compatible in the direction
 *   that matters: an OLD replica polling a new home sends no parameter and
 *   gets exactly the answer it always got. A NEW replica polling an old home
 *   sends one that home ignores, and over-replicates the way it does today —
 *   a known, pre-existing behaviour rather than a new failure.
 * - `"admitted"` — admissions and nothing else. What a replica asks.
 * - `"here"` — of the admissible ones, the canvases **this daemon is the home
 *   of** (phase 10.3). A third question rather than a narrowing of the other
 *   two, and it exists because of a real hole: the web app's canvas list
 *   links to a canvas with a react-router `<Link>`, which is a client-side
 *   navigation that never touches the server, so the per-canvas page guard on
 *   `GET /p/<id>` is simply bypassed for anything in that list. A local origin
 *   would then happily render a replica of a canvas that lives at dev —
 *   two doors onto one canvas, two cookies, two service workers, two browser
 *   replicas, the local one stale by construction, which is `local-bridge.md`'s
 *   own worst case: *"two surfaces agreeing with each other and both wrong."*
 *   The list route learns the question instead, and — per this route's own
 *   standing rule — **the caller states which, the route never sniffs who
 *   called**.
 */
export type CanvasesReach = "admitted" | "admissible" | "here";

/** The query parameter carrying a {@link CanvasesReach}. One spelling, so a
 * caller cannot get it subtly wrong and silently receive the wide answer. */
export const CANVASES_REACH_PARAM = "reach";

/** `GET /api/projects`, optionally narrowed. Built here rather than spelled at
 * each caller for `grantRoute`/`passesRoute`'s reason: the one place a route
 * is written is the one place it can be got wrong. */
/** `/api/projects` is a deliberate holdout (phase 13.5) — see `grantsRoute`. */
export function canvasesRoute(reach?: CanvasesReach): string {
  return reach ? `/api/projects?${CANVASES_REACH_PARAM}=${reach}` : "/api/projects";
}

// ---- joining one canvas at the home ----

/**
 * **"Fetch me this one canvas from my home."** POST `{canvasId}` at a
 * replica; the replica asks its home about that canvas with its own badge,
 * and the home's door decides.
 *
 * This is the other half of narrowing the sweep, and without it the narrowing
 * would be a regression rather than a fix. Two shipped, documented arrivals
 * carry a canvas's ADDRESS but no admission:
 *
 * - a **cloned marker** — `.isocan/project.json` committed to git and checked
 *   out on a second machine (Scene 0's multi-device beat, `second-device`), and
 * - a **pass-less `isocan setup <address>`** — arriving thin from a terminal,
 *   under the canvas's standing link grant.
 *
 * Both used to work by accident: the replica enumerated its home and the
 * canvas was in the list, so the sweep dialled it. Enumeration is what phase 7
 * named the wrong primitive, so the arrival has to say what it wants instead —
 * which it can, because in both cases somebody handed this machine an id.
 *
 * **It is not a new privilege.** The home runs exactly the door test it always
 * ran; the admission it writes is the same `{root: "grant"}` row that dialling
 * the canvas would have written a second later. What changes is only that the
 * home is asked about ONE canvas by name instead of being asked to list
 * itself.
 *
 * Outside `/api/projects/` deliberately, for `PASS_REDEEM_ROUTE`'s reason: a
 * route under that prefix runs the LOCAL door test, and the whole premise here
 * is a canvas this machine does not have yet.
 */
export const HOME_JOIN_ROUTE = "/api/home/join";

export interface JoinCanvasRequest {
  canvasId: string;
  /**
   * **Which home to fetch it from** (phase 10.3) — the marker's address, or
   * the one a person pasted into `isocan setup`.
   *
   * Before many homes there was one possible answer and the field would have
   * been noise. Now the good case is precisely a marker naming a home this
   * daemon has never dialled: a repo checked out on a new machine, whose
   * `.isocan/project.json` says the canvas lives at dev. That must WORK rather
   * than refuse — a new link, a badge from `identity.json`'s `auth` block or
   * knocked for, the home's own door test, and a row written — which is what
   * makes "the marker decides" true rather than aspirational.
   *
   * Absent falls back to the birth default, which is what a pre-10.3 caller
   * sends and what keeps `fetchFromHome`'s speculative ask working unchanged.
   */
  home?: string;
}

/** The home's own row for that canvas — title included, so a caller can say
 * what arrived rather than echoing back the id it already had. */
export interface JoinCanvasResponse {
  canvas: Canvas;
}

/**
 * **Which canvas lives where, and which homes are answering** — the one read
 * behind everything `isocan` needs to say about homes (phase 10.3).
 *
 * One round trip answers four questions that used to be one field on the
 * health route and are now genuinely plural: `isocan home`'s per-canvas
 * report, `isocan status`'s role line, the CLI's per-canvas URL building (the
 * cheerful-wrong-address hazard in its 10.3 form is printing
 * `dev.isocan.io/p/<a canvas that lives on this laptop>`), and — named here so
 * phase 12.7 finds it — **the value the local bridge's `frame-ancestors` lock
 * and its `postMessage` origin check must derive from.** Those two were
 * specified against "the home this daemon answers to", a value that no longer
 * exists; they derive from the SERVED CANVAS's home, and this is the route
 * that answers it.
 *
 * The health payload keeps its `home` key, redefined as the birth default,
 * because `stalenessOf` and older CLIs already read that body and the birth
 * default is the one whole-daemon answer that survives. Per-canvas questions
 * come here.
 */
export const HOMES_ROUTE = "/api/homes";

/**
 * **`GET /api/serving` — how this home serves, advertised to the app.**
 *
 * The first (and so far only) fact it carries: the content origin's base URL,
 * or null when no content origin exists — which is every home until the
 * content-origin plan's stage 2 (`docs/projects/atlas/content-origin-plan.md`).
 * The app treats an absent, null, or failed answer identically: frames stay
 * on the app origin under today's sandbox. The advertisement is derived from
 * the listener the daemon actually started, never from configuration alone,
 * so a base that is advertised is a base that answers.
 */
export const SERVING_ROUTE = "/api/serving";

export interface ServingResponse {
  /** Origin (scheme://host[:port], no trailing slash) serving item content,
   * or null: content is served from the app's own origin, as it always was. */
  contentBase: string | null;
}

export interface HomesResponse {
  /** Where a canvas born here, naming nothing, would be born. Null: here. */
  birth: string | null;
  /** Every canvas this daemon holds → its home, or null for "this daemon is
   * its home". Absent rows and null rows mean the same thing; this map spells
   * them all out so a caller does not have to know that. */
  canvases: Record<string, string | null>;
  /** Every home this daemon is dialling. `reachable` is null until the first
   * poll has been answered — the daemon reports what it last observed rather
   * than probing per request, because `isocan status` asks this often. */
  links: { url: string; reachable: boolean | null; canvases: CanvasLinkState[] }[];
}

/**
 * **Whether one canvas's socket to its home is actually carrying anything.**
 *
 * The question `reachable` above cannot answer, and the reason this type
 * exists. A home's reachability is measured on the HTTP poll, and writes are
 * forwarded over HTTP too — so a canvas can be born at a reachable home, take
 * every op it is given, serve its URL, and still have no live socket. Presence
 * rides ONLY on that socket. When it is not up, a face never leaves the
 * machine, the roster on this side looks like a canvas nobody else is on, and
 * before this type there was no way to tell that from an empty room.
 *
 * `opens: 0` is the sharpest field here: presence for this canvas has never
 * once moved.
 */
export interface CanvasLinkState {
  canvasId: string;
  /** The socket is open right now. */
  connected: boolean;
  /** How many times it has opened, ever — see above. */
  opens: number;
  connectedAt: string | null;
  /** When this daemon last told the home who is here, and how many faces it
   * named. Null: never. */
  relayedAt: string | null;
  facesRelayed: number;
  /** Consecutive failed attempts since the last open. */
  failures: number;
  /** How the last attempt ended: a close code, or the error that stopped it
   * before there was a socket at all. */
  lastFailure: string | null;
}

export interface ApiError {
  error: string;
  code?: string;
}

/**
 * **There is no such route under `/api/` on this daemon** — and saying so is
 * phase 8 closing phase 7.5's open finding.
 *
 * An unmatched `/api/` path used to fall through to the SPA handler and answer
 * **200 with the web app**: the fourth instance of "this system's default
 * answer to a wrong address is a cheerful one", after `/healthz/`, the blank
 * page a mistyped canvas address rendered, and a socket refusal
 * indistinguishable from a network blip. This one had
 * teeth beyond legibility, because it is how one VERSION of this code talks to
 * another: a replica asking an older home for a route that home does not have
 * got HTML, and the fallback worked *only because parsing HTML as JSON
 * throws*. Correct by accident is not correct — and phase 8 is the moment it
 * stops being theoretical, because a replica now asks its home to redeem a
 * pass, and a home that predates this phase has no such route.
 *
 * The code is exported here, rather than spelled in the server, because it is
 * the answer a CLIENT reads to tell "this home is too old for that" from "this
 * home refused me". Nothing branches on it today: the callers that meet it
 * fall back for any refusal, which is the right shape. It is here so that the
 * first caller that WANTS to branch has a name to branch on rather than a
 * status code shared with four other meanings.
 */
export const UNKNOWN_ROUTE = "unknown-route";

// ---- blob garbage collection (maintenance; not an Operation) ----

export interface GcRequest {
  /** How many recent oplog entries to keep (the undo horizon). */
  keepOps?: number;
  /** Report only; delete and rewrite nothing. */
  dryRun?: boolean;
  /** Blobs younger than this are never swept (covers the upload→item.add gap). */
  graceMs?: number;
}

export interface GcReport {
  dryRun: boolean;
  retainedEntries: number;
  droppedEntries: number;
  reachableBlobs: number;
  reachableBytes: number;
  sweptBlobs: number;
  sweptBytes: number;
  /** Unreachable but inside the grace period — left for a later run. */
  skippedRecentBlobs: number;
}

/**
 * **Collect the whole home** — one sweep over many canvases (phase 13.7).
 *
 * Wanted by two callers who agree on nothing else: a person or agent who has
 * just emptied a lot of trash and does not want to name every canvas it
 * touched, and the daemon's own hourly timer, which has nobody to name them
 * for it. Both run the same per-canvas policy — `Engine.gc`, unchanged — so
 * this is an ENUMERATING CALLER and never a second policy.
 *
 * The request body is a plain {@link GcRequest}: whatever it says applies to
 * every canvas in the sweep, because a horizon that meant one thing on one
 * canvas and another on the next would be a report nobody could read.
 *
 * Outside `/api/projects/` deliberately, and that is the whole security
 * question: the `onRequest` hook's canvas-scoped admission check reads the
 * canvas out of the path and so does not fire here. The route answers it
 * itself — see `http.ts`, where the argument is written down beside the code
 * that performs it.
 */
export const HOME_GC_ROUTE = "/api/gc";

/** One canvas's outcome in a home-wide sweep. */
export interface HomeGcCanvas {
  canvasId: string;
  /** Null exactly when this canvas's sweep threw; `error` then says what. One
   * canvas's failure is reported, never propagated — the sweep carries on to
   * the next, because the alternative is one broken canvas keeping a whole
   * home un-collected forever. */
  report: GcReport | null;
  error?: string;
}

/**
 * What a home-wide sweep did, per canvas and in total.
 *
 * `totals` is a {@link GcReport} rather than a new shape so that both clients
 * can render a home-wide sweep with the code they already have for one canvas
 * — the sum of dry runs is a dry run, and every other field adds.
 */
export interface HomeGcReport {
  canvases: HomeGcCanvas[];
  totals: GcReport;
}
