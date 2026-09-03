import type { Server } from "node:http";
import { Engine } from "./engine.js";
import type { Desk } from "./desk.js";
import { PresenceHub } from "./presence.js";
import type { RcHolds } from "./rc-holds.js";
import type { SweepHub } from "./sweep.js";
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
export declare function attachWebSockets(server: Server, engine: Engine, desk: Desk, presence: PresenceHub, rc?: RcHolds, options?: WebSocketOptions): () => void;
export {};
