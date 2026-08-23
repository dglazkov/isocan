import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "@isocan/core";
import { WS_BAD_ORIGIN, WS_NO_BADGE } from "@isocan/core";
import { Engine, ProjectNotFoundError } from "./engine.ts";
import type { Desk } from "./desk.ts";
import { isSecureRequest, originAllowed, presentedBadge, resolveBadge } from "./badges.ts";
import { PresenceHub } from "./presence.ts";

/**
 * Per-project rooms. Server→client: snapshot on connect, op-applied per
 * mutation, presence rosters. Client→server (web only): presence updates —
 * the tab's clientId doubles as its presence session id.
 */
/** Returns a closer that terminates all live sockets — upgraded connections
 * are hijacked from the HTTP server, so Fastify's forceCloseConnections
 * cannot reach them and shutdown would hang otherwise. */
export function attachWebSockets(
  server: Server,
  engine: Engine,
  desk: Desk,
  presence: PresenceHub,
): () => void {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Set<WebSocket>>();

  function broadcast(projectId: string, message: ServerMessage): void {
    const room = rooms.get(projectId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const socket of room) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  engine.onEvent((projectId, message) => {
    broadcast(projectId, message);
    if (message.type === "project-deleted") {
      const room = rooms.get(projectId);
      if (room) {
        for (const socket of room) socket.close();
        rooms.delete(projectId);
      }
    }
  });

  // Coalesce roster broadcasts — cursor streams would otherwise flood.
  const pendingRoster = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleRoster = (projectId: string) => {
    if (pendingRoster.has(projectId)) return;
    pendingRoster.set(
      projectId,
      setTimeout(() => {
        pendingRoster.delete(projectId);
        void Promise.all([engine.actorColors(), engine.actorNames()]).then(
          ([colors, names]) => {
            broadcast(projectId, {
              type: "presence-roster",
              sessions: presence.roster(projectId),
              colors,
              names,
            });
          },
        );
      }, 40),
    );
  };

  // A chosen color repaints faces, cursors, pins, and outlines, and a new
  // name re-letters everything that actor ever said. Both belong to the
  // actor, not to one room — but not to every room either: this used to
  // repaint every open canvas on the home, which on a multi-tenant home is a
  // stranger's identity arriving in your room (mechanism 10). It now reaches
  // exactly the rooms where that actor appears — by history as well as by
  // presence, because a rename has to reach the comments they wrote before
  // it. On a solo home every room is one of theirs, so nothing changes.
  engine.onColors((_colors, actorId) => {
    void engine
      .appearances(actorId, [...rooms.keys()])
      .then((projectIds) => {
        for (const projectId of projectIds) scheduleRoster(projectId);
      })
      .catch(() => {});
  });
  presence.onChange((projectId) => scheduleRoster(projectId));

  /**
   * The upgrade carries the badge like every other request. A browser CANNOT
   * set headers on a WebSocket handshake at all, so the cookie is its only
   * carrier here — which is the other reason that cookie is `Path=/`. CLIs and
   * daemons set `Authorization`.
   *
   * The Origin check matters more here than anywhere: browsers do not enforce
   * CORS on WebSockets, so this is the one case the same-origin machinery does
   * not cover on its own.
   *
   * Refusal upgrades first and then closes with a code, rather than writing a
   * raw `HTTP/1.1 401`: it matches this file's existing 4400/4404/4500
   * convention, and the web client's reconnect loop can read it and go to the
   * door.
   */
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") return; // let other handlers (e.g. Vite HMR proxy) pass
    const projectId = url.searchParams.get("projectId");
    void (async () => {
      const badge = await admitted(request, projectId);
      wss.handleUpgrade(request, socket, head, (ws) => {
        if ("code" in badge) {
          ws.on("error", () => {});
          ws.close(badge.code, badge.reason);
          return;
        }
        void handleConnection(ws, projectId, badge.badgeId);
      });
    })();
  });

  /**
   * The upgrade's own door check, plus mechanism 5's `projectId ∈
   * admissions`: a socket is a project-scoped route that happens to stay
   * open, so it re-asks the door's test exactly like the HTTP routes do.
   * Today the address admits, so being here writes the admission down.
   */
  async function admitted(
    request: IncomingMessage,
    projectId: string | null,
  ): Promise<{ badgeId: string } | { code: number; reason: string }> {
    const presented = presentedBadge(request.headers);
    if (presented?.carrier !== "bearer") {
      const secure = isSecureRequest(
        request.headers,
        Boolean((request.socket as { encrypted?: boolean }).encrypted),
      );
      const address = server.address();
      const loopback =
        !!address &&
        typeof address !== "string" &&
        (address.address === "127.0.0.1" || address.address === "::1");
      const origin = Array.isArray(request.headers.origin)
        ? request.headers.origin[0]
        : request.headers.origin;
      if (!originAllowed(origin, { host: request.headers.host, secure }, { loopback })) {
        return { code: WS_BAD_ORIGIN, reason: "origin" };
      }
    }
    const badge = await resolveBadge(desk, presented);
    if (!badge) return { code: WS_NO_BADGE, reason: "badge required" };
    await desk.touch(badge.badgeId, new Date().toISOString());
    if (projectId && !badge.admissions.some((a) => a.canvasId === projectId)) {
      // ---- the policy point, as in http.ts. Phase 7: refuse instead. ----
      await desk.admit(badge.badgeId, projectId, { root: "link" });
    }
    return { badgeId: badge.badgeId };
  }

  async function handleConnection(
    ws: WebSocket,
    projectId: string | null,
    badgeId: string,
  ): Promise<void> {
    // Without a listener, an abrupt client death (ECONNRESET) raises an
    // unhandled 'error' event on the EventEmitter and would crash the daemon.
    // 'close' always follows, which is where cleanup lives.
    ws.on("error", () => {});
    if (!projectId) {
      ws.close(4400, "projectId query parameter required");
      return;
    }
    try {
      const snapshot = await engine.getSnapshot(projectId);
      const hello: ServerMessage = { type: "snapshot", ...snapshot };
      ws.send(JSON.stringify(hello));
      const roster: ServerMessage = {
        type: "presence-roster",
        sessions: presence.roster(projectId),
        colors: snapshot.colors,
        names: snapshot.names,
      };
      ws.send(JSON.stringify(roster));
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

    // This connection's presence session, created lazily on its first
    // presence message and torn down with the socket.
    let sessionId: string | null = null;
    /**
     * The actors this socket has already been shown to speak for.
     *
     * Relayed presence is checked PER ACTOR — one connection may carry
     * several, and each of them has to be in the badge's claims (mechanism
     * 5). Cursor beats arrive by the hundred under one unchanging actor, so
     * the answer is remembered: the check costs a desk read the first time an
     * actor appears on this socket and nothing after that. Switching persona
     * names a new actor, which is a new question.
     */
    const vouched = new Set<string>();

    ws.on("message", (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data)) as ClientMessage;
      } catch {
        return;
      }
      if (message.type !== "presence" || !message.sessionId || !message.actor?.id) return;
      const actor = message.actor;
      const beat = () => {
        if (sessionId === null) {
          sessionId = message.sessionId;
          presence.createSession(projectId!, actor, "web", { sessionId });
        }
        presence.touch(projectId!, sessionId, {
          // Every beat re-asserts who is holding the tab, so renaming
          // yourself or switching identities re-labels the face live (#43).
          actor,
          cursor: message.cursor,
          selection: Array.isArray(message.selection) ? message.selection : [],
        });
      };
      if (vouched.has(actor.id)) return beat();
      void engine
        .requireActor(badgeId, actor.id)
        .then(() => {
          vouched.add(actor.id);
          beat();
        })
        // A beat naming an actor this badge does not claim is DROPPED, not a
        // closed socket: the tab is mid-claim, or its badge was replaced and
        // it is on its way back to the door. The face simply does not go up.
        .catch(() => {});
    });

    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(projectId);
      if (sessionId !== null) presence.endSession(projectId, sessionId);
    });
  }

  return () => {
    for (const timer of pendingRoster.values()) clearTimeout(timer);
    pendingRoster.clear();
    for (const socket of wss.clients) socket.terminate();
  };
}
