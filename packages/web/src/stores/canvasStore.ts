import { create } from "zustand";
import type { CanvasState, Project, ProjectState, ServerMessage } from "@isocan/core";
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
  socket?.close();
  socket = null;
}

function open(projectId: string): void {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}/ws?projectId=${projectId}`);

  socket.onmessage = (event) => {
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
        socket?.close();
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

  socket.onclose = () => {
    if (currentProjectId !== projectId) return; // deliberate disconnect
    useCanvasStore.setState({ connection: "reconnecting" });
    reconnectTimer = setTimeout(() => {
      if (currentProjectId === projectId) open(projectId);
    }, 800);
  };
}
