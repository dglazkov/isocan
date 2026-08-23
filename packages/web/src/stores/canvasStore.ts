import { create } from "zustand";
import type {
  Actor,
  ActorColors,
  CanvasState,
  ClientMessage,
  OpEnvelope,
  Operation,
  PresenceSession,
  Project,
  ProjectState,
  ServerMessage,
  ActorNames,
  SlashCommand,
} from "@isocan/core";
import { applyOperation, WS_NO_BADGE, WS_NO_CANVAS, WS_NOT_ADMITTED } from "@isocan/core";
import { CLIENT_ID, knockOnDoor } from "../lib/api.ts";
import { useUiStore } from "./uiStore.ts";
import { markRead, noticeComment, syncProject } from "./unreadStore.ts";

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
  /** The canvas was deleted while this tab was on it. */
  | "gone"
  /** The door said no: a good badge, a canvas that will not have it. */
  | "refused"
  /** There is no canvas at this address here. */
  | "absent";

interface CanvasStore {
  projectId: string | null;
  project: Project | null;
  canvas: CanvasState | null;
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
  projectId: null,
  project: null,
  canvas: null,
  lastSeq: 0,
  connection: "connecting",
  sessions: [],
  actorColors: {},
  actorNames: {},
  commands: null,
}));

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
  const { projectId, canvas } = useCanvasStore.getState();
  if (projectId && canvas) syncProject(projectId, canvas, actor.id);
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
 * Optimistically fold a gesture's final op into the replica, so releasing a
 * drag doesn't render the pre-gesture position for the frames until the WS
 * echo lands. Only used for absolute-valued gesture commits (move/resize):
 * the echo re-applies the same values idempotently and owns the lastSeq
 * bookkeeping (which this deliberately does not touch — the echo must still
 * pass the gap check). Any divergence is corrected by the echo or the next
 * snapshot.
 */
export function applyLocalEcho(op: Operation, actor: Actor): void {
  const { project, canvas } = useCanvasStore.getState();
  if (!project || !canvas) return;
  try {
    const next = applyOperation(
      { project, canvas },
      { id: "op_local", projectId: project.id, actor, ts: new Date().toISOString(), op },
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

export function connectToProject(projectId: string, actor: Actor): void {
  disconnect();
  currentProjectId = projectId;
  presenceActor = actor;
  useCanvasStore.setState({
    projectId,
    project: null,
    canvas: null,
    lastSeq: 0,
    connection: "connecting",
    sessions: [],
  });
  open(projectId);
}

export function disconnect(): void {
  currentProjectId = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  // Null the module ref BEFORE closing: the doomed socket's async onclose
  // must see itself as stale and stay silent.
  const doomed = socket;
  socket = null;
  doomed?.close();
}

function wsUrl(projectId: string, since: number): string {
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
  return `${protocol}//${host}/ws?projectId=${projectId}&since=${since}`;
}

/**
 * The cursor to reconnect with: the last seq this tab actually holds, or 0
 * when it holds nothing for this canvas.
 *
 * Both halves of the guard matter. `projectId` must match, because a store
 * still carrying the last canvas's `lastSeq` would ask a DIFFERENT canvas for
 * a tail from a seq that means nothing there — the home would happily serve
 * one, and the tab would apply another canvas's ops to this one's state.
 * `project`/`canvas` must both be present, because a cursor is a claim to hold
 * the state that seq describes; without the state the seq is a number about
 * nothing, and only a snapshot is an answer.
 */
function resumeCursor(projectId: string): number {
  const { projectId: held, project, canvas, lastSeq } = useCanvasStore.getState();
  return held === projectId && project && canvas ? lastSeq : 0;
}

function open(projectId: string): void {
  const ws = new WebSocket(wsUrl(projectId, resumeCursor(projectId)));
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
  // Events from any socket that is no longer THE socket are ignored. Without
  // this, StrictMode's double-mount let a superseded socket's late onclose
  // schedule a reconnect and leave TWO live sockets — every broadcast then
  // processed twice, tripping the seq-gap check and flapping "reconnecting".
  const stale = () => socket !== ws || currentProjectId !== projectId;

  ws.onmessage = (event) => {
    if (stale()) return;
    const message = JSON.parse(event.data as string) as ServerMessage;
    if (message.type === "snapshot") {
      useCanvasStore.setState({
        project: message.project,
        canvas: message.canvas,
        lastSeq: message.lastSeq,
        connection: "live",
        actorColors: message.colors,
        actorNames: message.names,
      });
      syncProject(projectId, message.canvas, presenceActor?.id);
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
      const { project, canvas, lastSeq } = useCanvasStore.getState();
      if (!project || !canvas) return;
      if (message.entry.seq !== lastSeq + 1) {
        // Gap — simplest correct policy: resync via a fresh snapshot.
        ws.close();
        return;
      }
      const state: ProjectState = { project, canvas };
      let next: ProjectState | null;
      try {
        next = applyOperation(state, message.entry.envelope);
      } catch {
        // An op this build cannot apply — a tab left open across a daemon
        // upgrade. Same policy as a gap: resync from a server snapshot.
        ws.close();
        return;
      }
      if (next === null) return; // project.delete arrives as project-deleted too
      useCanvasStore.setState({
        project: next.project,
        canvas: next.canvas,
        lastSeq: message.entry.seq,
      });
      if (message.entry.seq > replayThrough) announceComment(message.entry.envelope);
    } else if (message.type === "project-deleted") {
      useCanvasStore.setState({ connection: "gone" });
      disconnect();
    }
  };

  ws.onclose = (event) => {
    if (stale()) return; // superseded or deliberately disconnected
    socket = null;
    useCanvasStore.setState({ connection: "reconnecting" });
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
        if (currentProjectId === projectId && socket === null) open(projectId);
      });
      return;
    }
    reconnectTimer = setTimeout(() => {
      if (currentProjectId === projectId && socket === null) open(projectId);
    }, 800);
  };
}
