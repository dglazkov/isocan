import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, PresenceSession, ServerMessage } from "@isocan/core";
import { newId, WS_BAD_ORIGIN, WS_NO_BADGE } from "@isocan/core";
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
    const since = parseCursor(url.searchParams.get("since"));
    void (async () => {
      const badge = await admitted(request, projectId);
      wss.handleUpgrade(request, socket, head, (ws) => {
        if ("code" in badge) {
          ws.on("error", () => {});
          ws.close(badge.code, badge.reason);
          return;
        }
        void handleConnection(ws, projectId, badge.badgeId, since, badge.bearer);
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
  ): Promise<{ badgeId: string; bearer: boolean } | { code: number; reason: string }> {
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
    return { badgeId: badge.badgeId, bearer: presented?.carrier === "bearer" };
  }

  async function handleConnection(
    ws: WebSocket,
    projectId: string | null,
    badgeId: string,
    since: number,
    bearer: boolean,
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
      /**
       * "I have through N" — the lid-close beat, and the reason this is worth
       * a branch at all: a tab (and, from phase 6, a local daemon's home
       * connection) that has been away for an evening does not need the whole
       * canvas back, it needs the evening. The tail is replayed through the
       * same reducer crash recovery replays, which is what makes this cheap to
       * be right about: there is no second application path to keep honest.
       *
       * The tail is read AFTER the snapshot on purpose. An op landing between
       * the two is not yet broadcast to this socket (it joins the room below),
       * so reading the log second means that op arrives in the tail rather
       * than falling into the gap between "what the snapshot knew" and "what
       * the room has broadcast since".
       */
      const tail = since > 0 ? await engine.getLog(projectId, since) : [];
      /**
       * Four ways this is not servable, all of them ordinary rather than
       * exceptional:
       *
       * - `since > lastSeq` — the client is AHEAD of us. A home restored from
       *   a backup behind its own replicas produces exactly this, and it must
       *   answer with a snapshot rather than throw: the client is the one that
       *   has to be corrected, and a snapshot is the correction.
       * - the tail is not contiguous from `since + 1` — `Engine.gc` compacts
       *   the live log to an undo horizon, and `chooseRetained` keeps whatever
       *   undo/redo chains reach back to, so what survives compaction is a SET
       *   and not a suffix. A client whose cursor fell behind that horizon
       *   cannot be caught up from the live log at all.
       * - the tail does not REACH `lastSeq`, even when every entry in it is
       *   contiguous. Contiguity alone is not enough, and `every()` is the
       *   reason it looks like it is: it is vacuously true on an empty array,
       *   so a tail compacted away to nothing (`chooseRetained` returns `[]`
       *   for `keepOps <= 0`, straight off `POST /api/projects/:id/gc`) would
       *   pass the check and be answered `resumed` with a `lastSeq` of
       *   `since` — the client told it is current while missing every seq in
       *   `since + 1 … lastSeq`, with no event left to correct it once the
       *   canvas goes quiet. Completeness is the other half of the condition:
       *   the tail must carry at least `lastSeq - since` entries. `>=` and not
       *   `===` on purpose — an op landing between the two reads makes the
       *   tail legitimately run one past the snapshot (see above).
       * - `since === 0` or absent — no cursor, today's behaviour, untouched.
       *
       * The fallback is the other half of the contract, not a failure: every
       * client must handle either answer, which is also what lets a home
       * decline to resume for any reason a later backing invents.
       */
      const resumable =
        since > 0 &&
        since <= snapshot.lastSeq &&
        since + tail.length >= snapshot.lastSeq &&
        tail.every((entry, index) => entry.seq === since + index + 1);
      const hello: ServerMessage = resumable
        ? {
            type: "resumed",
            from: since,
            // Not `snapshot.lastSeq`: if an op landed while we were reading
            // the log, it is in the tail and the client will hold it.
            lastSeq: tail.length > 0 ? tail[tail.length - 1]!.seq : since,
            colors: snapshot.colors,
            names: snapshot.names,
          }
        : { type: "snapshot", ...snapshot };
      ws.send(JSON.stringify(hello));
      if (resumable) {
        for (const entry of tail) {
          const applied: ServerMessage = { type: "op-applied", entry };
          ws.send(JSON.stringify(applied));
        }
      }
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

    /**
     * The key this socket's RELAYED roster is held under, if it relays one.
     *
     * A replica's whole local roster arrives on one connection, so the faces
     * belong to the connection rather than to a session of it — which is what
     * makes them go away together when it drops. `newId` rather than the badge
     * id: one badge may hold two connections (a daemon reconnecting before its
     * old socket has finished closing), and keying on the badge would let the
     * dying one wipe the live one's faces on its way out.
     */
    const relayOrigin = `relay:${newId("rel")}`;

    ws.on("message", (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data)) as ClientMessage;
      } catch {
        return;
      }
      /**
       * A whole roster, from a daemon speaking for several people.
       *
       * **Bearer only.** A browser cannot set headers on a WS handshake, so a
       * cookie-carried socket is by definition a page — and a page must not be
       * able to publish a roster of faces it merely asserts. The carrier is
       * the honest discriminator here for the same reason the Origin check
       * exempts it above: an attacker's page cannot read a bearer token, so
       * nothing it can reach speaks with one.
       *
       * Every actor is checked against this badge's claims and the ones it
       * cannot vouch for are DROPPED rather than closing the socket —
       * mechanism 5's "a daemon's relayed presence, where one connection
       * carries several actors and each must be in the badge's claims", with
       * the same forgiveness the single-session path already has: a face that
       * cannot be vouched for simply does not go up.
       */
      if (message.type === "presence-relay") {
        if (!bearer || !Array.isArray(message.sessions)) return;
        void (async () => {
          const allowed: PresenceSession[] = [];
          for (const session of message.sessions) {
            if (!session?.sessionId || !session.actor?.id) continue;
            if (!vouched.has(session.actor.id)) {
              const ok = await engine.requireActor(badgeId, session.actor.id).then(
                () => true,
                () => false,
              );
              if (!ok) continue;
              vouched.add(session.actor.id);
            }
            allowed.push(session);
          }
          presence.mirror(projectId!, relayOrigin, allowed);
        })();
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
      // A dropped connection takes the faces it was relaying with it. Scene
      // 4's beat 7 is exactly this: Priya shuts the lid, her daemon's
      // connection dies, and "one presence-TTL later her face — AND ISAAC'S
      // RING — fade from Jordan's pile". A sleeping laptop's agent cannot
      // wake, so a ring that said "summonable" would lie.
      presence.dropMirror(relayOrigin);
    });
  }

  return () => {
    for (const timer of pendingRoster.values()) clearTimeout(timer);
    pendingRoster.clear();
    for (const socket of wss.clients) socket.terminate();
  };
}

/**
 * `?since=N`, the seq a connecting client says it already holds.
 *
 * Anything that is not a whole number ≥ 0 means "no cursor" and gets today's
 * full snapshot — including `0` itself, which is what a client that has never
 * seen this canvas sends. Garbage in a query string must not be able to
 * produce a WRONG answer here: a snapshot is always correct, so every
 * unreadable cursor lands on it.
 */
function parseCursor(raw: string | null): number {
  if (raw === null) return 0;
  const since = Number(raw);
  return Number.isInteger(since) && since > 0 ? since : 0;
}
