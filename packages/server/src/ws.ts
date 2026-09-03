import type { IncomingMessage, Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { Capability, ClientMessage, PresenceSession, ServerMessage } from "@isocan/core";
import {
  atLeast,
  narrowed,
  newId,
  staleClientRefusal,
  WS_BAD_ORIGIN,
  WS_NO_BADGE,
  WS_BEHIND,
  WS_NO_CANVAS,
  WS_NOT_ADMITTED,
  WS_STALE_CLIENT,
  WITHDRAWN,
} from "@isocan/core";
import { Engine, CanvasNotFoundError } from "./engine.ts";
import type { Desk } from "./desk.ts";
import { admittingGrant, heldCapability } from "./grants.ts";
import { isSecureRequest, originAllowed, presentedBadge, resolveBadge } from "./badges.ts";
import { PresenceHub } from "./presence.ts";
import type { RcHolds } from "./rc-holds.ts";
import type { SweepHub } from "./sweep.ts";

/**
 * Per-canvas rooms. Server→client: snapshot on connect, op-applied per
 * mutation, presence rosters. Client→server (web only): presence updates —
 * the tab's clientId doubles as its presence session id.
 */
/** Returns a closer that terminates all live sockets — upgraded connections
 * are hijacked from the HTTP server, so Fastify's forceCloseConnections
 * cannot reach them and shutdown would hang otherwise. */
interface WebSocketOptions {
  /** The beat interval. 25 s in production (see `beatMs` below); a test that
   * has to see two beats sets it low rather than waiting a minute. */
  heartbeatMs?: number;
  /** Which build of the home this is — Cloud Run's revision, else the commit
   * — stamped on the hello and the heartbeat so a client can tell which
   * instance it is talking to (#85). Absent means "do not say". */
  revision?: string;
  /**
   * The sweep's outcomes, per badge (roles design, "Reaching an open
   * socket"). Subscribed to once, like `engine.onEvent`: a re-rooted badge's
   * sockets on the canvas are sent `standing`, an expelled badge's are
   * closed with `WS_NOT_ADMITTED` and the reason `withdrawn`. Absent means
   * nothing reaches an open socket, which is every test that attaches
   * sockets without a daemon.
   */
  sweeps?: SweepHub;
}

/**
 * One socket in a room: whose it is, and what it may do. The room is a map
 * from socket to this — "a canvas's sockets, each knowing whose it is" — and
 * that is the whole index a rung change needs to find its person.
 */
interface Member {
  badgeId: string;
  /** Tell this connection its rung changed. */
  standing: (capability: Capability) => void;
}

export function attachWebSockets(
  server: Server,
  engine: Engine,
  desk: Desk,
  presence: PresenceHub,
  rc?: RcHolds,
  options: WebSocketOptions = {},
): () => void {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map<string, Map<WebSocket, Member>>();
  const revision = options.revision !== undefined ? { revision: options.revision } : {};

  /**
   * **The beat, and the reaping.**
   *
   * Two different jobs that happen on the same timer, for two different dead
   * sockets.
   *
   * `heartbeat` is for the CLIENT: a browser cannot see protocol pings or
   * pongs, so the only way a tab can tell a live-but-quiet connection from a
   * dead one is an ordinary message arriving on a schedule. Without it a
   * socket that died without a close frame — a lid closing, a wifi-to-cellular
   * hop, a proxy reaping an idle connection — leaves the tab reporting itself
   * live forever, showing a canvas that stopped updating. Reported exactly
   * that way: "nothing happened, I reloaded, and the agent had been working".
   *
   * `ping`/`isAlive` is for the SERVER, and is the mirror image: a room that
   * keeps a socket nobody is on the other end of goes on broadcasting into it
   * and holds a presence face up for somebody who left. `ws` answers pings
   * automatically at protocol level, so a client that is genuinely there stays
   * marked alive without doing anything, and a client that is not gets
   * terminated on the next sweep — which fires the same `close` handler a
   * clean disconnect does, so presence and rooms clean up by the existing
   * path rather than a second one.
   *
   * 25 seconds because the shortest idle timeout worth surviving in front of
   * this is a proxy's 30, and a beat that only just fits inside one is a beat
   * that is sometimes late.
   */
  const alive = new WeakSet<WebSocket>();
  const beatMs = options.heartbeatMs ?? 25_000;
  const bareBeat = JSON.stringify({ type: "heartbeat", ...revision } satisfies ServerMessage);
  /**
   * **The beat says how far the canvas has got** (#85), and where that number
   * comes from is the fix.
   *
   * It is read from the STORE, never counted along the broadcast path and —
   * since the root cause was found — never from the engine's cache either.
   * The failure it exists to catch is broadcasts stopping while the socket
   * stays up, and the shape that actually happened was a rollout: this
   * instance draining, holding every socket opened before the new revision
   * took the traffic, with a cache nothing would ever invalidate because
   * nothing wrote through it. A tip from that cache agreed with the frozen
   * tab. The store is what the other instance writes to. One small read per
   * room per beat.
   *
   * And when the read says this instance is behind, the engine drops its
   * cache and `onBehind` below hangs up on the room, so the tab is not the
   * one that has to notice.
   */
  const beat = async (): Promise<void> => {
    const beaten = new Set<WebSocket>();
    for (const [canvasId, room] of rooms) {
      const open = [...room.keys()].filter((s) => s.readyState === WebSocket.OPEN);
      if (open.length === 0) continue;
      const tip = await engine.tipSeq(canvasId);
      const payload =
        tip === null
          ? bareBeat
          : JSON.stringify({ type: "heartbeat", canvasId, tip, ...revision } satisfies ServerMessage);
      for (const socket of open) {
        socket.send(payload);
        beaten.add(socket);
      }
    }
    // A socket that has not joined a room yet still needs proof of life; it
    // has no canvas to be behind on, so it gets the beat without a tip.
    for (const socket of wss.clients) {
      if (beaten.has(socket) || socket.readyState !== WebSocket.OPEN) continue;
      socket.send(bareBeat);
    }
  };
  const beating = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        // Missed the whole window: no pong since the last sweep. Terminate
        // rather than close — a half-open socket will not answer a handshake
        // either, and `close()` on one waits for a reply that never comes.
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      if (socket.readyState !== WebSocket.OPEN) continue;
      socket.ping();
    }
    // Beats are async now (the tip is a read), so they are sent after the
    // reaping rather than inside it. A beat that cannot be produced is
    // skipped rather than thrown: the socket is fine, and a heartbeat that
    // raised would take down the one mechanism meant to be steady.
    void beat().catch(() => {});
  }, beatMs);
  // Never hold the process open for a heartbeat: a daemon whose last tab
  // closed should still exit.
  beating.unref?.();

  function broadcast(canvasId: string, message: ServerMessage): void {
    const room = rooms.get(canvasId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const socket of room.keys()) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }

  /**
   * **A change reaches the room** (roles design, "Reaching an open socket";
   * journey 2 step 1, journey 3 step 2). The sweep says what it did to each
   * badge; this finds that badge's sockets on the canvas — and only those —
   * and tells them. Raised or lowered: `standing`, and the page re-picks its
   * surface without a reload. Expelled: closed with the code the door uses
   * and the one word that makes it a different sentence, because the person
   * was inside.
   */
  options.sweeps?.on((canvasId, badgeId, outcome) => {
    const room = rooms.get(canvasId);
    if (!room) return;
    for (const [socket, member] of room) {
      if (member.badgeId !== badgeId) continue;
      if (outcome.outcome === "expelled") {
        if (socket.readyState === WebSocket.OPEN) socket.close(WS_NOT_ADMITTED, WITHDRAWN);
      } else {
        member.standing(outcome.capability);
      }
    }
  });

  /**
   * **The instance hangs up on a room it has fallen behind on** (#85). Every
   * client redials — the tab and the replica daemons alike — through the load
   * balancer, which routes to the current instance; one that lands back here
   * is answered from the store, because the engine dropped the cache before
   * telling us. `WS_BEHIND` rather than a plain close so the client knows to
   * dial again at once rather than backing off from a failure it did not
   * cause.
   */
  engine.onBehind((canvasId) => {
    const room = rooms.get(canvasId);
    if (!room) return;
    for (const socket of room.keys()) {
      if (socket.readyState === WebSocket.OPEN) socket.close(WS_BEHIND, "behind the store — redial");
    }
  });

  engine.onEvent((canvasId, message) => {
    broadcast(canvasId, message);
    if (message.type === "canvas-deleted") {
      const room = rooms.get(canvasId);
      if (room) {
        for (const socket of room.keys()) socket.close();
        rooms.delete(canvasId);
      }
    }
  });

  // Coalesce roster broadcasts — cursor streams would otherwise flood.
  const pendingRoster = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleRoster = (canvasId: string) => {
    if (pendingRoster.has(canvasId)) return;
    pendingRoster.set(
      canvasId,
      setTimeout(() => {
        pendingRoster.delete(canvasId);
        void Promise.all([
          engine.actorColors(),
          engine.actorNames(),
          engine.actorJoins(),
          engine.resolveSessions(presence.roster(canvasId)),
        ]).then(([colors, names, joined, sessions]) => {
          broadcast(canvasId, {
            type: "presence-roster",
            sessions,
            colors,
            names,
            joined,
          });
        });
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
      .then((canvasIds) => {
        for (const canvasId of canvasIds) scheduleRoster(canvasId);
      })
      .catch(() => {});
  });
  presence.onChange((canvasId) => scheduleRoster(canvasId));

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
    const canvasId = url.searchParams.get("canvasId");
    const since = parseCursor(url.searchParams.get("since"));
    /**
     * **`?projectId=` is a client older than this home** (phase 13.5), and it
     * is worth its own close code rather than the 4400 it would otherwise
     * get: "canvasId query parameter required" is true and useless to somebody
     * whose client believes it sent one.
     *
     * The socket carries the SHORT sentence — a close reason is capped at 123
     * bytes by the protocol and a longer one throws — but it names the same
     * cause and the same command as the HTTP body does, from the same place.
     */
    const stale = staleClientRefusal(url.searchParams);
    void (async () => {
      const badge = stale
        ? { code: WS_STALE_CLIENT, reason: stale.closeReason }
        : await admitted(request, canvasId);
      wss.handleUpgrade(request, socket, head, (ws) => {
        if ("code" in badge) {
          ws.on("error", () => {});
          ws.close(badge.code, badge.reason);
          return;
        }
        void handleConnection(ws, canvasId, badge.badgeId, since, badge.bearer, badge.capability);
      });
    })();
  });

  /**
   * The upgrade's own door check, plus mechanism 5's `canvasId ∈
   * admissions`: a socket is a canvas-scoped route that happens to stay
   * open, so it asks the door's test exactly like the HTTP routes do — the
   * same test, from `grants.ts`, because two copies of a policy is two
   * policies.
   *
   * The refusal is a close code rather than a status: this file's
   * 4400/4401/4404/4500 convention, and `WS_NOT_ADMITTED` is 4402 because
   * `WS_BAD_ORIGIN` already holds 4403. A reconnect loop that cannot tell
   * "your origin is wrong" from "you are not admitted here" is a reconnect
   * loop that retries the one it cannot fix.
   *
   * A canvas this daemon does not hold falls THROUGH the door rather than
   * being refused by it, exactly as in `http.ts`: `handleConnection` closes
   * 4404 a moment later, which is the true answer and the one `HomeLink`
   * already knows how to stop dialling on.
   */
  async function admitted(
    request: IncomingMessage,
    canvasId: string | null,
  ): Promise<
    | { badgeId: string; bearer: boolean; capability: Capability }
    | { code: number; reason: string }
  > {
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
    let capability: Capability = "edit";
    if (canvasId && !badge.admissions.some((a) => a.canvasId === canvasId)) {
      // The snapshot first, for the creator's floor: a canvas that is not
      // here at all falls through to `handleConnection`, which closes 4404.
      // A replica dialling a canvas its home has deleted takes this path,
      // and 4404 is what makes it stop dialling.
      const snapshot = await engine.getSnapshot(canvasId).catch(() => null);
      const answer = snapshot
        ? await admittingGrant(desk, canvasId, badge, snapshot.project.createdBy.id)
        : null;
      if (answer) {
        // Provenance is revocation's grip: the grant that actually admitted
        // this socket (or the creator's floor), so phase 9's sweep can find
        // it. The capability rides with it (#88), because the door test
        // short-circuits on the admission ever after.
        capability = answer.capability;
        await desk.admit(badge.badgeId, canvasId, answer.provenance, capability);
      } else if (snapshot) {
        return { code: WS_NOT_ADMITTED, reason: "not admitted" };
      }
    } else if (canvasId) {
      // Already admitted — the same re-ask an admission below edit gets at
      // the HTTP door, so a socket opened after proving an email connects as
      // the editor the invitation makes them (see `heldCapability`).
      const snapshot = await engine.getSnapshot(canvasId).catch(() => null);
      capability =
        (await heldCapability(desk, canvasId, badge, snapshot?.project.createdBy.id ?? null)) ??
        "edit";
    }
    return { badgeId: badge.badgeId, bearer: presented?.carrier === "bearer", capability };
  }

  async function handleConnection(
    ws: WebSocket,
    canvasId: string | null,
    badgeId: string,
    since: number,
    bearer: boolean,
    admittedAt: Capability,
  ): Promise<void> {
    /**
     * What this connection may do. Set by the admission on the way in and
     * MOVED by the sweep listener below (`Member.standing`) when a grant
     * changes under it — so a `view` socket raised to `read` starts accepting
     * beats, and a `read` one lowered to `view` stops, on the same socket.
     */
    let capability: Capability = admittedAt;
    // Without a listener, an abrupt client death (ECONNRESET) raises an
    // unhandled 'error' event on the EventEmitter and would crash the daemon.
    // 'close' always follows, which is where cleanup lives.
    ws.on("error", () => {});
    if (!canvasId) {
      ws.close(4400, "canvasId query parameter required");
      return;
    }
    try {
      const snapshot = await engine.getSnapshot(canvasId);
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
      const tail = since > 0 ? await engine.getLog(canvasId, since) : [];
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
      // The reader's one fact, on the hello (#88, widened by the roles
      // ladder): stated whenever it is not edit, so a client from before the
      // field reads the hello it always read.
      const rung = narrowed(capability) ? { capability } : {};
      const hello: ServerMessage = resumable
        ? {
            type: "resumed",
            ...revision,
            from: since,
            // Not `snapshot.lastSeq`: if an op landed while we were reading
            // the log, it is in the tail and the client will hold it.
            lastSeq: tail.length > 0 ? tail[tail.length - 1]!.seq : since,
            colors: snapshot.colors,
            names: snapshot.names,
            ...(snapshot.joined !== undefined ? { joined: snapshot.joined } : {}),
            ...rung,
          }
        : { type: "snapshot", ...revision, ...snapshot, ...rung };
      ws.send(JSON.stringify(hello));
      if (resumable) {
        for (const entry of tail) {
          const applied: ServerMessage = { type: "op-applied", entry };
          ws.send(JSON.stringify(applied));
        }
      }
      const roster: ServerMessage = {
        type: "presence-roster",
        sessions: await engine.resolveSessions(presence.roster(canvasId)),
        colors: snapshot.colors,
        names: snapshot.names,
        ...(snapshot.joined !== undefined ? { joined: snapshot.joined } : {}),
      };
      ws.send(JSON.stringify(roster));
    } catch (err) {
      ws.close(err instanceof CanvasNotFoundError ? WS_NO_CANVAS : 4500, String(err));
      return;
    }
    // This connection's presence session, created lazily on its first
    // presence message and torn down with the socket.
    let sessionId: string | null = null;

    let room = rooms.get(canvasId);
    if (!room) {
      room = new Map();
      rooms.set(canvasId, room);
    }
    room.set(ws, {
      badgeId,
      standing: (next) => {
        if (next === capability) return;
        capability = next;
        if (ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({ type: "standing", capability } satisfies ServerMessage));
        // The presence session carries the rung it was made at, so a face
        // marked *reading* would go on saying so after the toolbar appeared.
        // Ended here; the next beat makes a new one at the new rung, which is
        // also what puts a raised viewer INTO presence and takes a lowered
        // reader out of it.
        if (sessionId !== null) {
          presence.endSession(canvasId, sessionId);
          sessionId = null;
        }
      },
    });
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
       * A `view` connection is fan-out and nothing up (#88). The deck sends
       * no beats, so anything arriving here is a client asserting a presence
       * its admission does not carry — dropped with the same forgiveness an
       * unvouched actor gets below, rather than a closed socket: the socket
       * is doing its legitimate job, which is watching. A `read` connection
       * is the one rung up and DOES appear in presence, marked as reading:
       * a person looking over your shoulder is a fact about the room (roles
       * journey 1).
       */
      if (!atLeast(capability, "read")) return;
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
          presence.mirror(canvasId!, relayOrigin, allowed);
        })();
        return;
      }
      /**
       * The rc-liveness half of the daemon's beat (agent-custody mechanism
       * 1). Bearer only, for `presence-relay`'s reason. Each relayed actor id
       * is checked against the badge's claims the way relayed faces are —
       * "answerable" is a claim about who this machine may speak for, and an
       * id the badge cannot vouch is dropped, never mirrored. The mirror dies
       * with the socket, in the close handler below.
       */
      if (message.type === "rc-relay") {
        if (!bearer || !rc) return;
        const parked = message.parked === true;
        const ids = Array.isArray(message.actorIds)
          ? message.actorIds.filter((id): id is string => typeof id === "string")
          : [];
        void (async () => {
          const allowed = new Set<string>();
          for (const actorId of ids) {
            if (!vouched.has(actorId)) {
              const ok = await engine.requireActor(badgeId, actorId).then(
                () => true,
                () => false,
              );
              if (!ok) continue;
              vouched.add(actorId);
            }
            allowed.add(actorId);
          }
          rc.mirror(relayOrigin, canvasId!, {
            parked,
            actorIds: allowed,
            // The return path for an ask: down this socket, to become a local
            // ask at the daemon whose rc is actually parked.
            sendAsk: (ask) => {
              if (ws.readyState !== WebSocket.OPEN) return false;
              ws.send(
                JSON.stringify({ type: "rc-ask", askId: ask.askId, name: ask.name, from: ask.from }),
              );
              return true;
            },
          });
        })();
        return;
      }
      if (message.type !== "presence" || !message.sessionId || !message.actor?.id) return;
      const actor = message.actor;
      const beat = () => {
        if (sessionId === null) {
          sessionId = message.sessionId;
          // The rung rides the session from the admission, never from the
          // beat — see `PresenceSession.capability`.
          presence.createSession(canvasId!, actor, "web", { sessionId, capability });
        }
        presence.touch(canvasId!, sessionId, {
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

    /* Marked alive at birth so the first sweep does not reap a socket that has
       simply not been asked yet, and on every pong thereafter. `ws` sends the
       pong itself, so a browser needs no cooperation to stay marked. */
    alive.add(ws);
    ws.on("pong", () => void alive.add(ws));

    ws.on("close", () => {
      room.delete(ws);
      if (room.size === 0) rooms.delete(canvasId);
      if (sessionId !== null) presence.endSession(canvasId, sessionId);
      // A dropped connection takes the faces it was relaying with it. Scene
      // 4's beat 7 is exactly this: Priya shuts the lid, her daemon's
      // connection dies, and "one presence-TTL later her face — AND ISAAC'S
      // RING — fade from Jordan's pile". A sleeping laptop's agent cannot
      // wake, so a ring that said "summonable" would lie.
      presence.dropMirror(relayOrigin);
      // And the rc liveness it relayed: home-side "answerable" dies the
      // instant the laptop's connection does (agent-custody mechanism 1).
      rc?.dropMirror(relayOrigin);
    });
  }

  return () => {
    clearInterval(beating);
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
