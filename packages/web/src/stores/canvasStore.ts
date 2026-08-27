import { create } from "zustand";
import type {
  Actor,
  ActorColors,
  CanvasContents,
  ClientMessage,
  OpEnvelope,
  Operation,
  PresenceSession,
  Canvas,
  CanvasState,
  ServerMessage,
  ActorNames,
  SlashCommand,
} from "@isocan/core";
import { applyOperation, newOpId, WS_NO_BADGE, WS_NO_CANVAS, WS_NOT_ADMITTED } from "@isocan/core";
import { ApiError, CLIENT_ID, homeAnswered, knockOnDoor, postOp, sendOp } from "../lib/api.ts";
import {
  flushReplicaWrites,
  forgetReplica,
  loadReplica,
  saveReplica,
  type StoredReplica,
} from "../lib/replica.ts";
import {
  adopt,
  foldQueue,
  newWrite,
  pendingWrites,
  queueable,
  retire,
  unsyncedCount,
  type QueuedWrite,
  type RefusedWrite,
} from "../lib/writequeue.ts";
import { useUiStore } from "./uiStore.ts";
import { markRead, noticeComment, syncCanvas } from "./unreadStore.ts";

/**
 * What the socket is doing — and, from phase 7, two answers that are FINAL.
 *
 * `refused` and `absent` are the door's two "no"s, and they are separate from
 * `reconnecting` because they are not a network condition: retrying cannot fix
 * either one. Before this, a 4402 (not admitted) and a 4404 (no such canvas)
 * both fell into the ordinary 800ms backoff, so a pasted link to a canvas that
 * had been shut off — or a mistyped id — showed "reconnecting" over an empty
 * canvas forever. That is the same silence the missing catch-all route made,
 * one layer down, and a share link's failure has to be legible.
 */
export type Connection =
  | "connecting"
  | "live"
  | "reconnecting"
  /**
   * The home is not reachable and this tab is working anyway (phase 10).
   *
   * Separate from `reconnecting` because it is a different sentence to a
   * person — "keep going, your work is being kept" rather than "hold on" —
   * and because it is the state in which writes go to a queue instead of to
   * a socket. It is not a claim about the network cable: it means every way
   * this tab has of reaching the home has failed, which covers a dead
   * network, a home that is down, and a tunnel.
   */
  | "offline"
  /** The canvas was deleted while this tab was on it. */
  | "gone"
  /** The door said no: a good badge, a canvas that will not have it. */
  | "refused"
  /** There is no canvas at this address here. */
  | "absent";

interface CanvasStore {
  canvasId: string | null;
  /**
   * What is on screen: the confirmed state with this tab's un-landed work
   * folded over it. Read by every component; written by nothing except the
   * two functions below `render`.
   */
  project: Canvas | null;
  canvas: CanvasContents | null;
  /**
   * **The home's own truth, at `lastSeq` and not one op further** (phase 10).
   *
   * The split that makes offline correct. `project`/`canvas` are a VIEW —
   * confirmed plus the queue — and the tail that arrives on reconnect is
   * applied to this, never to the view. Folding a tail onto an optimistic
   * state would embed this tab's guesses into what it then calls the home's
   * history, and the two would silently disagree forever after.
   */
  confirmed: CanvasState | null;
  /** Writes this tab has made that the home's history has not caught up with
   * — offline ones waiting to be sent, and sent ones waiting for the tail. */
  queue: QueuedWrite[];
  /** Writes the home would not take, kept until a person dismisses them.
   * Rolling an optimistic change back in silence is a lie; leaving the queue
   * stuck behind it is worse. See `flushQueue`. */
  refused: RefusedWrite[];
  /** One sentence about something that could not be done — an undo with no
   * home to ask, a file that cannot be added offline. Cleared on dismissal. */
  notice: string | null;
  lastSeq: number;
  connection: Connection;
  /** Remote presence sessions (own tab filtered out). Ephemeral plane. */
  sessions: PresenceSession[];
  /** Chosen identity colors (actor id → hex), from the daemon's actor
   * registry. Only the exceptions are here: everyone else wears the color
   * their id implies. See lib/colors.ts. */
  actorColors: ActorColors;
  /** The name each actor goes by NOW (actor id → name), from the same
   * registry. A comment carries the name its author wore when they wrote it;
   * this is what we show instead. See lib/names.ts. */
  actorNames: ActorNames;
  /** The slash-command menu, from the daemon. Null = not asked yet; the
   * built-ins stand in until it lands (lib/commands.ts). */
  commands: SlashCommand[] | null;
}

/**
 * The synced replica. Mutations never write here directly — components POST
 * ops to the daemon and the change arrives over the WebSocket, applied by the
 * SAME reducer the daemon runs. That shared function is the client half of
 * the isomorphism guarantee.
 */
export const useCanvasStore = create<CanvasStore>(() => ({
  canvasId: null,
  project: null,
  canvas: null,
  confirmed: null,
  queue: [],
  refused: [],
  notice: null,
  lastSeq: 0,
  connection: "connecting",
  sessions: [],
  actorColors: {},
  actorNames: {},
  commands: null,
}));

// ---- the confirmed state, the queue, and the view over both (phase 10) ----

/**
 * Adopt what the home said, retire everything its history now covers, and
 * re-render.
 *
 * The one door through which the confirmed state ever moves — a snapshot, a
 * resumed tail, or a single broadcast op all arrive here — so there is exactly
 * one place where "the truth advanced" and "the view was rebuilt" happen
 * together, and no path that can do one without the other.
 */
function confirm(state: CanvasState, lastSeq: number): void {
  const queue = retire(useCanvasStore.getState().queue, lastSeq);
  const view = foldQueue(state, queue);
  useCanvasStore.setState({
    confirmed: state,
    lastSeq,
    queue,
    project: view?.project ?? state.project,
    canvas: view?.canvas ?? state.canvas,
  });
  persist();
}

/** Re-fold the queue over the confirmed state — after a write is queued,
 * refused, or dropped. */
function render(): void {
  const { confirmed, queue } = useCanvasStore.getState();
  if (!confirmed) return;
  const view = foldQueue(confirmed, queue);
  useCanvasStore.setState({
    project: view?.project ?? confirmed.project,
    canvas: view?.canvas ?? confirmed.canvas,
  });
}

/** Write the replica down. Immediate when there is work in the queue: a
 * queued op is the only copy of a person's gesture in the world. */
function persist(): void {
  const { canvasId, confirmed, lastSeq, queue } = useCanvasStore.getState();
  if (!canvasId || !confirmed) return;
  const record: StoredReplica = {
    canvasId,
    project: confirmed.project,
    canvas: confirmed.canvas,
    lastSeq,
    queue: queue.map(({ opId, actor, op, at, seq }) => ({
      opId,
      actor,
      op,
      at,
      ...(seq !== undefined ? { seq } : {}),
    })),
    savedAt: new Date().toISOString(),
  };
  saveReplica(record, queue.length > 0);
}

/**
 * **A write with nobody to send it to.** Called from `api.sendOp` through the
 * hook it registers below, once a POST has failed for want of a network.
 *
 * Returns false when the op cannot wait in a queue at all (`queueable` says
 * which and why) — the caller then throws, so the person is told rather than
 * watching a gesture evaporate.
 */
export function queueOfflineWrite(
  canvasId: string | null,
  actor: Actor,
  op: Operation,
  opId: string,
): boolean {
  const { canvasId: open, confirmed, queue } = useCanvasStore.getState();
  if (!queueable(canvasId, open) || !confirmed) return false;
  useCanvasStore.setState({
    queue: [...queue, newWrite(opId, actor, op)],
    // The socket may still think it is alive — a POST discovers the truth
    // first, because it is the thing that actually asked.
    connection: "offline",
  });
  render();
  persist();
  return true;
}

/**
 * **The crux, in one function: the queue lands in the home's order BEFORE the
 * tail comes down.**
 *
 * Called by `open()` and awaited before the socket is dialled, which is the
 * entire ordering guarantee. Each write goes up carrying the idempotency key
 * it was minted with, so a write that was already sent — and whose answer was
 * lost with the connection — comes back as the entry it already became rather
 * than as a `duplicate-id` refusal (see `PostOpRequest.opId`). That is what
 * makes it safe to retry the whole queue, which is what makes it safe to have
 * a queue at all.
 *
 * Returns false when the home is still unreachable, so the caller waits
 * instead of opening a socket that would only fail as well.
 *
 * **A refusal is not the end of the queue.** The home may take four of five
 * writes; the fifth is moved to `refused`, its optimistic effect drops out of
 * the view on the next render, and the other four go up regardless. A queue
 * that stopped at the first refusal would strand later work behind a decision
 * that had nothing to do with it.
 */
let flushing: Promise<boolean> | null = null;

function flushQueue(): Promise<boolean> {
  // One flush at a time. Two `open()` calls can race — a retry timer and the
  // browser's `online` event, say — and two concurrent flushes would post the
  // same write twice. The idempotency key makes that harmless rather than
  // duplicating anything, which is exactly the safety net it is for; this
  // keeps it from being needed in the first place.
  if (flushing) return flushing;
  flushing = drainQueue().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function drainQueue(): Promise<boolean> {
  for (;;) {
    const { canvasId, queue } = useCanvasStore.getState();
    if (!canvasId) return true;
    const next = pendingWrites(queue)[0];
    if (!next) return true;
    try {
      const answer = await postOp(canvasId, next.actor, next.op, next.opId);
      // Not removed — marked. It retires when the tail reaches its seq, so the
      // view never rewinds between the answer and the history that carries it.
      useCanvasStore.setState({
        queue: useCanvasStore
          .getState()
          .queue.map((write) =>
            write.opId === next.opId ? { ...write, seq: answer.seq } : write,
          ),
      });
      persist();
    } catch (err) {
      if (!(err instanceof ApiError)) return false; // the home never answered
      refuse(next, err);
    }
  }
}

/** The home said no to something a person already saw happen. */
function refuse(write: QueuedWrite, err: ApiError): void {
  const { queue, refused } = useCanvasStore.getState();
  useCanvasStore.setState({
    queue: queue.filter((other) => other.opId !== write.opId),
    refused: [
      ...refused,
      {
        opId: write.opId,
        opType: write.op.type,
        message: err.message,
        ...(err.code !== undefined ? { code: err.code } : {}),
        at: Date.now(),
      },
    ],
  });
  render();
  persist();
}

/** How many of this tab's changes the home has not confirmed. */
export function unsynced(): number {
  return unsyncedCount(useCanvasStore.getState().queue);
}

/** The person has read the refusals. The changes are already gone from the
 * canvas — this only clears the notice. */
export function dismissRefusals(): void {
  useCanvasStore.setState({ refused: [] });
}

/** Say something that could not be done, once. */
export function setNotice(notice: string | null): void {
  useCanvasStore.setState({ notice });
}

// ---- presence publishing (throttled, trailing-edge) ----

let presenceActor: Actor | null = null;
let lastCursor: { x: number; y: number } | null = null;
let presenceTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlush = 0;
const PRESENCE_INTERVAL_MS = 33;

export function publishCursor(cursor: { x: number; y: number } | null): void {
  lastCursor = cursor;
  schedulePresenceFlush();
}

/**
 * You became someone else (renamed, or switched identities entirely). The
 * socket stays; the next presence beat carries the new actor and the daemon
 * adopts it, so the facepile, cursor label, and "@" menu on every other
 * screen follow within a frame. Read state is per viewer AND per person, so
 * the new identity reads its own watermarks.
 */
export function setPresenceActor(actor: Actor): void {
  presenceActor = actor;
  const { canvasId, canvas } = useCanvasStore.getState();
  if (canvasId && canvas) syncCanvas(canvasId, canvas, actor.id);
  flushPresence();
}

export function publishSelection(): void {
  schedulePresenceFlush();
}

function schedulePresenceFlush(): void {
  if (presenceTimer) return;
  const wait = Math.max(0, PRESENCE_INTERVAL_MS - (Date.now() - lastFlush));
  presenceTimer = setTimeout(flushPresence, wait);
}

function flushPresence(): void {
  presenceTimer = null;
  lastFlush = Date.now();
  if (!presenceActor || !socket || socket.readyState !== WebSocket.OPEN) return;
  const message: ClientMessage = {
    type: "presence",
    sessionId: CLIENT_ID,
    actor: presenceActor,
    cursor: lastCursor,
    selection: useUiStore.getState().selectedItemIds,
  };
  socket.send(JSON.stringify(message));
}

/**
 * **A gesture commit: shown at once, and it stays shown.**
 *
 * Dropping a drag, letting go of a resize, wearing a mark — the op is posted
 * the instant the gesture ends, and the person must see the result now rather
 * than after a round trip. This puts it in the QUEUE as an in-flight write and
 * posts it, which is the only arrangement that keeps it on screen.
 *
 * **The version before this wrote the view directly and did not use the
 * queue.** Its comment argued the case and named the cost — "if somebody
 * ELSE's op lands in the same few milliseconds, `confirm` re-folds the view
 * from the confirmed state and this echo is gone for one frame" — and the
 * argument was right about the mechanism and wrong about the size. The view is
 * recomputed from `confirmed + queue` on EVERY landing, the echo is in
 * neither, and the gap is not a frame: it runs until this op's own entry comes
 * down the socket. So a canvas with a second person on it, or an agent
 * working, rewound the item you had just dropped back to where it came from
 * and then snapped it forward again — the visible flinch that `writequeue.ts`
 * rule 3 exists to prevent, arriving through the one door that was not using
 * the queue.
 *
 * The objection that kept it out of the queue is answered rather than
 * ignored: a write posted a millisecond ago is not "unsynced", and marking it
 * so would be a lie in the other direction. `inflight` is what makes both true
 * at once — folded like every other write, invisible to the unsynced count,
 * never re-posted by a flush, retired by `seq` like the rest.
 */
export async function sendEchoed(canvasId: string, actor: Actor, op: Operation): Promise<void> {
  const { confirmed } = useCanvasStore.getState();
  // No confirmed state means no queue to join — nothing has been folded yet.
  if (!confirmed) {
    await sendOp(canvasId, actor, op);
    return;
  }
  const opId = newOpId();
  const write: QueuedWrite = { ...newWrite(opId, actor, op), inflight: true };
  useCanvasStore.setState({ queue: [...useCanvasStore.getState().queue, write] });
  render();
  persist();
  try {
    const answer = await postOp(canvasId, actor, op, opId);
    // Marked, not removed — it retires when the tail reaches its seq, so the
    // view never rewinds between the answer and the history that carries it.
    useCanvasStore.setState({
      queue: useCanvasStore
        .getState()
        .queue.map((other) => (other.opId === opId ? { ...other, seq: answer.seq } : other)),
    });
    persist();
  } catch (err) {
    if (err instanceof ApiError && homeAnswered(err)) {
      // The home said no to something the person already saw happen.
      refuse(write, err);
      render();
      persist();
      return;
    }
    // The home never answered. It stops being in-flight and starts being
    // work this tab is holding — which is the moment "not synced" is true.
    useCanvasStore.setState({
      queue: useCanvasStore
        .getState()
        .queue.map((other) => (other.opId === opId ? { ...other, inflight: false } : other)),
      connection: "offline",
    });
    render();
    persist();
  }
}

/**
 * Fold an op into the VIEW only, sending nothing.
 *
 * The one caller is the arrow-key nudge, and it is the one gesture that
 * cannot use `sendEchoed`: it re-echoes an absolute position on every
 * keypress and posts once when the keys stop, so that a held arrow is one op
 * and one undo step rather than thirty. Its exposure to the rewind above is
 * bounded by that flush (a third of a second) and self-corrects on the next
 * press; the commit it finally makes goes through `sendEchoed` like every
 * other.
 */
export function applyLocalEcho(op: Operation, actor: Actor): void {
  const { project, canvas } = useCanvasStore.getState();
  if (!project || !canvas) return;
  try {
    const next = applyOperation(
      { project, canvas },
      { id: "op_local", canvasId: project.id, actor, ts: new Date().toISOString(), op },
    );
    if (next) useCanvasStore.setState({ project: next.project, canvas: next.canvas });
  } catch {
    // Validation failed locally (state raced ahead) — let the server decide.
  }
}

/** Someone else's comment landing is the one op worth interrupting for. */
function announceComment(envelope: OpEnvelope): void {
  const { op, actor } = envelope;
  if (op.type !== "thread.create" && op.type !== "thread.reply") return;
  if (actor.id === presenceActor?.id) return;
  // Landing in the main thread while its panel is open: you're looking right
  // at it — no toast, the watermark moves instead (same rule as open popovers).
  const thread = useCanvasStore.getState().canvas?.threads[op.threadId];
  if (thread?.main && useUiStore.getState().mainPanelOpen) {
    markRead(op.threadId);
    return;
  }
  noticeComment({
    id: op.comment.id,
    threadId: op.threadId,
    author: actor,
    body: op.comment.body,
    at: Date.now(),
  });
}

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentProjectId: string | null = null;

export function connectToCanvas(canvasId: string, actor: Actor): void {
  disconnect();
  currentProjectId = canvasId;
  presenceActor = actor;
  useCanvasStore.setState({
    canvasId,
    project: null,
    canvas: null,
    confirmed: null,
    queue: [],
    refused: [],
    notice: null,
    lastSeq: 0,
    connection: "connecting",
    sessions: [],
  });
  void restoreThenOpen(canvasId);
}

/**
 * **What this browser already holds, before it asks for anything** (phase 10).
 *
 * The disk read goes first and the socket waits for it — a handful of
 * milliseconds on a hit, less on a miss — and that ordering is the whole
 * feature. A tab that dialled first would present `since=0`, be handed a
 * snapshot it did not need, and (offline) show a blank canvas over a perfectly
 * good replica sitting in IndexedDB. Presenting the cursor is only possible
 * once the state that cursor is a claim about has been loaded, which is
 * exactly `HomeLink.localSeq`'s reasoning from the daemon's end: *"a cursor
 * has to be a fact."*
 */
async function restoreThenOpen(canvasId: string): Promise<void> {
  const stored = await loadReplica(canvasId);
  if (currentProjectId !== canvasId) return; // navigated away mid-read
  if (stored && useCanvasStore.getState().confirmed === null) {
    const confirmed = { project: stored.project, canvas: stored.canvas };
    // `adopt`: a stored write cannot still be this tab's in-flight post — the
    // tab that posted it is gone. They become ordinary pending work and go up
    // again, which the idempotency key makes free if they already landed.
    const queue = adopt(stored.queue as QueuedWrite[]);
    const view = foldQueue(confirmed, queue);
    useCanvasStore.setState({
      confirmed,
      queue,
      lastSeq: stored.lastSeq,
      project: view?.project ?? confirmed.project,
      canvas: view?.canvas ?? confirmed.canvas,
    });
    syncCanvas(canvasId, view?.canvas ?? confirmed.canvas, presenceActor?.id);
  }
  void open(canvasId);
}

export function disconnect(): void {
  currentProjectId = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  backoffMs = RECONNECT_MIN_MS;
  failedDials = 0;
  // Whatever is sitting on the replica's debounce goes down now: leaving a
  // canvas is exactly the moment the last few ops would otherwise be lost.
  flushReplicaWrites();
  // Null the module ref BEFORE closing: the doomed socket's async onclose
  // must see itself as stale and stay silent.
  const doomed = socket;
  socket = null;
  doomed?.close();
}

function wsUrl(canvasId: string, since: number): string {
  // In dev the page is served by Vite but the daemon owns /ws — connect
  // straight to the daemon. Proxying WebSockets through Vite added a flaky
  // hop that spammed "ws proxy error: write EPIPE" whenever either end tore
  // down mid-write (tsx watch restarts, tab closes, socket replacement).
  //
  // `location.hostname`, not a literal `127.0.0.1`: cookies are scoped by
  // HOST and ignore port, so a badge cookie stored for `localhost` (where
  // Vite serves the page) is happily sent to `localhost:4441` — and not at
  // all to `127.0.0.1`, which is a different host. Hardcoding the literal
  // meant the dev handshake arrived badge-less the moment the upgrade
  // started asking for one.
  const devPort = import.meta.env.DEV ? (import.meta.env.VITE_ISOCAN_PORT ?? "4441") : null;
  const host = devPort ? `${location.hostname}:${devPort}` : location.host;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  // `since=0` is "no cursor" on the wire and the daemon reads it as such, so
  // a fresh connect says the same thing whether it says it or stays silent.
  return `${protocol}//${host}/ws?canvasId=${canvasId}&since=${since}`;
}

/**
 * The cursor to reconnect with: the last seq this tab actually holds, or 0
 * when it holds nothing for this canvas.
 *
 * Both halves of the guard matter. `canvasId` must match, because a store
 * still carrying the last canvas's `lastSeq` would ask a DIFFERENT canvas for
 * a tail from a seq that means nothing there — the home would happily serve
 * one, and the tab would apply another canvas's ops to this one's state.
 * `project`/`canvas` must both be present, because a cursor is a claim to hold
 * the state that seq describes; without the state the seq is a number about
 * nothing, and only a snapshot is an answer.
 *
 * **Phase 10 moved the second half from the view to the CONFIRMED state**, and
 * the distinction is the phase in miniature: `lastSeq` describes what the home
 * said, so the state it is a claim about is the state the home said it. The
 * view has this tab's un-landed guesses folded in and is a claim about
 * nothing anybody else can check.
 */
function resumeCursor(canvasId: string): number {
  const { canvasId: held, confirmed, lastSeq } = useCanvasStore.getState();
  return held === canvasId && confirmed ? lastSeq : 0;
}

/** Between reconnect attempts, growing while the home stays away. The daemon's
 * `HomeLink` reconnects on exactly this shape (`RECONNECT_MIN_MS` /
 * `RECONNECT_MAX_MS`) for exactly this reason — fast enough that a dropped
 * socket is invisible to a person, backing off far enough that a home that is
 * down is not hammered by every replica on the internet at once. Before phase
 * 10 this was a flat 800ms, which was fine for a blip and wrong for a laptop
 * that has been shut for an hour. */
const RECONNECT_MIN_MS = 800;
const RECONNECT_MAX_MS = 10_000;
let backoffMs = RECONNECT_MIN_MS;

/**
 * Dials that closed without the home ever saying hello.
 *
 * The difference between "hold on" and "keep going, your work is being kept",
 * and there is no other way to tell: a socket that never connected and a
 * socket that dropped both arrive as `onclose` with 1006. A dial that got a
 * `snapshot` or a `resumed` resets this; two in a row that got nothing means
 * the home is not there. Two rather than one so an ordinary blip — which
 * reconnects on the next try — never flashes the word offline at anybody.
 *
 * Measured, not reasoned: with the daemon stopped and nothing queued, a tab
 * restored from its own replica sat on "reconnecting" indefinitely. Truthful
 * about the socket, and the wrong thing to tell a person looking at a
 * perfectly good canvas they are about to write to.
 */
let failedDials = 0;
const OFFLINE_AFTER_FAILED_DIALS = 2;

/**
 * **Flush, then dial.** The one ordering the phase is about.
 *
 * Queued ops go up first and are ordered by the home; only then is the socket
 * opened with the cursor this tab confirmedly holds, so the tail it streams is
 * computed AFTER those ops landed and carries them in the home's order.
 * Opening first and flushing after would apply a tail computed before this
 * tab's work existed, and then fold that work on top of it — which looks
 * right, converges wrong, and is exactly what the second browser profile in
 * the Proof is there to catch.
 *
 * If the flush cannot reach the home there is no point dialling: stay offline
 * and try the whole gesture again after the backoff.
 */
async function open(canvasId: string): Promise<void> {
  if (currentProjectId !== canvasId || socket) return;
  if (!(await flushQueue())) {
    if (currentProjectId !== canvasId) return;
    useCanvasStore.setState({ connection: "offline" });
    return retryLater(canvasId);
  }
  if (currentProjectId !== canvasId || socket) return;
  openSocket(canvasId);
}

function retryLater(canvasId: string): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const wait = backoffMs;
  backoffMs = Math.min(backoffMs * 2, RECONNECT_MAX_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (currentProjectId === canvasId && socket === null) void open(canvasId);
  }, wait);
}

function openSocket(canvasId: string): void {
  const ws = new WebSocket(wsUrl(canvasId, resumeCursor(canvasId)));
  socket = ws;
  /**
   * While a resumed tail is streaming, this is the seq it ends at.
   *
   * The tail is delivery, not arrival — Scene 4's lid-close beat is explicit
   * that reopening at 9pm shows unread badges and a dimmed face-with-a-count,
   * and that "no toast queue replays". Unread badges are computed from the
   * canvas state against local watermarks, so they survive this suppression
   * untouched; toasts are for arrival-while-here, and every comment in this
   * tail arrived while this tab was away. Without the flag, switching the
   * reconnect from a snapshot to a resume would have turned a two-minute
   * network blip into a burst of toasts for comments the tab had never shown.
   */
  let replayThrough = 0;
  /** Did this socket ever get a hello? A dial that did not is a home that is
   * not answering, not a connection that dropped — see `failedDials`. */
  let greeted = false;
  // Events from any socket that is no longer THE socket are ignored. Without
  // this, StrictMode's double-mount let a superseded socket's late onclose
  // schedule a reconnect and leave TWO live sockets — every broadcast then
  // processed twice, tripping the seq-gap check and flapping "reconnecting".
  const stale = () => socket !== ws || currentProjectId !== canvasId;

  ws.onmessage = (event) => {
    if (stale()) return;
    const message = JSON.parse(event.data as string) as ServerMessage;
    if (message.type === "snapshot") {
      backoffMs = RECONNECT_MIN_MS;
      failedDials = 0;
      greeted = true;
      useCanvasStore.setState({
        connection: "live",
        actorColors: message.colors,
        actorNames: message.names,
      });
      // Through `confirm`, like every other move of the truth: the snapshot IS
      // the home's state at `lastSeq`, and anything this tab has queued past it
      // is re-folded on top rather than thrown away. A tab that came back to a
      // home that could not serve its tail must not lose the four things it
      // drew on a plane.
      confirm({ project: message.project, canvas: message.canvas }, message.lastSeq);
      const view = useCanvasStore.getState().canvas!;
      syncCanvas(canvasId, view, presenceActor?.id);
      // Announce this tab's presence immediately so it shows up in rosters
      // (and `isocan who`) even before the mouse moves.
      schedulePresenceFlush();
    } else if (message.type === "resumed") {
      // The other answer to the same question, and deliberately NOT a place
      // that touches `project`/`canvas`: the whole point of resuming is that
      // this tab keeps the state it already has and the tail is applied ON
      // TOP of it. Clearing them here — the way a fresh connect does — would
      // unmount the canvas for as long as the tail took to arrive.
      replayThrough = message.lastSeq;
      backoffMs = RECONNECT_MIN_MS;
      failedDials = 0;
      greeted = true;
      useCanvasStore.setState({
        connection: "live",
        actorColors: message.colors,
        actorNames: message.names,
      });
      schedulePresenceFlush();
    } else if (message.type === "presence-roster") {
      useCanvasStore.setState({
        sessions: message.sessions.filter((session) => session.sessionId !== CLIENT_ID),
        actorColors: message.colors,
        actorNames: message.names,
      });
    } else if (message.type === "op-applied") {
      // **The tail is applied to the CONFIRMED state, never to the view.**
      // Phase 10's one-line change with the whole phase in it: the view has
      // this tab's un-landed work folded into it, and applying the home's
      // history on top of a guess is how two replicas end up disagreeing about
      // a canvas neither of them can tell is wrong. `confirm` re-folds the
      // queue afterwards, so what a person sees is still their work over the
      // home's order — which is the only arrangement that converges.
      const { confirmed, lastSeq } = useCanvasStore.getState();
      if (!confirmed) return;
      if (message.entry.seq !== lastSeq + 1) {
        // Gap — simplest correct policy: resync via a fresh snapshot.
        ws.close();
        return;
      }
      let next: CanvasState | null;
      try {
        next = applyOperation(confirmed, message.entry.envelope);
      } catch {
        // An op this build cannot apply — a tab left open across a daemon
        // upgrade. Same policy as a gap: resync from a server snapshot.
        ws.close();
        return;
      }
      if (next === null) return; // project.delete arrives as canvas-deleted too
      confirm(next, message.entry.seq);
      if (message.entry.seq > replayThrough) announceComment(message.entry.envelope);
    } else if (message.type === "canvas-deleted") {
      useCanvasStore.setState({ connection: "gone" });
      // A replica of a canvas that no longer exists is how a tab shows a
      // person work nobody else can see.
      void forgetReplica(canvasId);
      disconnect();
    }
  };

  ws.onclose = (event) => {
    if (stale()) return; // superseded or deliberately disconnected
    socket = null;
    // "Reconnecting" is what a blip is; "offline" is what a tab that has work
    // to keep is. The queue decides, not `navigator.onLine` — which is true
    // behind a captive portal and true when the home itself is down, and this
    // phase's Proof is actuated by stopping the home.
    if (!greeted) failedDials += 1;
    useCanvasStore.setState({
      connection:
        unsynced() > 0 ||
        failedDials >= OFFLINE_AFTER_FAILED_DIALS ||
        (typeof navigator !== "undefined" && navigator.onLine === false)
          ? "offline"
          : "reconnecting",
    });
    // The home refused the handshake for want of a badge. A browser cannot
    // set headers on a WS handshake, so the cookie is the only carrier here:
    // go to the door and come straight back rather than waiting out the
    // ordinary backoff.
    // The door's two final answers. Neither is retried: a badge that is not
    // admitted would be refused identically forever, and a canvas that is not
    // here does not appear because somebody asked twice.
    if (event.code === WS_NOT_ADMITTED || event.code === WS_NO_CANVAS) {
      useCanvasStore.setState({
        connection: event.code === WS_NOT_ADMITTED ? "refused" : "absent",
      });
      disconnect();
      return;
    }
    if (event.code === WS_NO_BADGE) {
      void knockOnDoor().then(() => {
        if (currentProjectId === canvasId && socket === null) void open(canvasId);
      });
      return;
    }
    retryLater(canvasId);
  };
}

/**
 * The browser saying the network came back — worth acting on immediately.
 *
 * A hint rather than a truth (it is true behind a captive portal, and it says
 * nothing about whether the HOME is up), so it only shortens the wait: it
 * cancels the backoff and dials now, and the ordinary retry loop is still what
 * gets there in the end. Registered once, at module load, because a tab can be
 * anywhere in the app when the wifi comes back.
 */
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (!currentProjectId || socket) return;
    backoffMs = RECONNECT_MIN_MS;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    void open(currentProjectId);
  });
  // The last reliable moment a tab gets. `unload` is not one, and a laptop
  // lid closing on four queued ops is precisely the scene.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushReplicaWrites();
  });
}
