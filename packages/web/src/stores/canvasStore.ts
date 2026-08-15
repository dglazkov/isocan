import { create } from "zustand";
import type {
  Actor,
  CanvasState,
  Operation,
  Project,
  ProjectState,
  ServerMessage,
} from "@isocan/core";
import { applyOperation } from "@isocan/core";

export type Connection = "connecting" | "live" | "reconnecting" | "gone";

interface CanvasStore {
  projectId: string | null;
  project: Project | null;
  canvas: CanvasState | null;
  lastSeq: number;
  connection: Connection;
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
}));

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

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentProjectId: string | null = null;

export function connectToProject(projectId: string): void {
  disconnect();
  currentProjectId = projectId;
  useCanvasStore.setState({
    projectId,
    project: null,
    canvas: null,
    lastSeq: 0,
    connection: "connecting",
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

function open(projectId: string): void {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws?projectId=${projectId}`);
  socket = ws;
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
      const next = applyOperation(state, message.entry.envelope);
      if (next === null) return; // project.delete arrives as project-deleted too
      useCanvasStore.setState({
        project: next.project,
        canvas: next.canvas,
        lastSeq: message.entry.seq,
      });
    } else if (message.type === "project-deleted") {
      useCanvasStore.setState({ connection: "gone" });
      disconnect();
    }
  };

  ws.onclose = () => {
    if (stale()) return; // superseded or deliberately disconnected
    socket = null;
    useCanvasStore.setState({ connection: "reconnecting" });
    reconnectTimer = setTimeout(() => {
      if (currentProjectId === projectId && socket === null) open(projectId);
    }, 800);
  };
}
