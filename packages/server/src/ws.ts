import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ServerMessage } from "@isocan/core";
import { Engine, ProjectNotFoundError } from "./engine.ts";

/**
 * Per-project rooms; server→client only. On connect a client gets a full
 * snapshot, then one op-applied per mutation. Clients that need to resync
 * simply reconnect.
 */
export function attachWebSockets(server: Server, engine: Engine): void {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Set<WebSocket>>();

  engine.onEvent((projectId, message) => {
    const room = rooms.get(projectId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const socket of room) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
    if (message.type === "project-deleted") {
      for (const socket of room) socket.close();
      rooms.delete(projectId);
    }
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return; // let other handlers (e.g. Vite HMR proxy) pass
    wss.handleUpgrade(request, socket, head, (ws) => {
      void handleConnection(ws, url.searchParams.get("projectId"));
    });
  });

  async function handleConnection(ws: WebSocket, projectId: string | null): Promise<void> {
    if (!projectId) {
      ws.close(4400, "projectId query parameter required");
      return;
    }
    try {
      const snapshot = await engine.getSnapshot(projectId);
      const message: ServerMessage = { type: "snapshot", ...snapshot };
      ws.send(JSON.stringify(message));
    } catch (err) {
      ws.close(err instanceof ProjectNotFoundError ? 4404 : 4500, String(err));
      return;
    }
    let room = rooms.get(projectId);
    if (!room) {
      room = new Set();
      rooms.set(projectId, room);
    }
    room.add(ws);
    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(projectId);
    });
  }
}
