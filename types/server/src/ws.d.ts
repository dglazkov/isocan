import type { Server } from "node:http";
import { Engine } from "./engine.js";
import type { Desk } from "./desk.js";
import { PresenceHub } from "./presence.js";
import { type RcHolds } from "./rc-holds.js";
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
    /**
     * **The hosted content origin's host** (`ISOCAN_CONTENT_HOST`), or absent
     * on every shape that has none.
     *
     * A socket upgrade never passes through Fastify's hooks — it is hijacked
     * off the raw server — so the door hook's "this Host gets blob bytes and
     * nothing else" does not cover it, and invariant 4 would have a hole in
     * exactly the place nobody looks. A browser could not use it (no cookie
     * travels to that origin), but a bearer holder could, and "the content
     * origin answers nothing but blobs" must be true of every listener on it,
     * not of the routed half.
     */
    contentHost?: string | null;
    /**
     * **Where the room map lets itself be counted** (operator phase 1).
     *
     * `isocan operator show` prints how many sockets are open on a canvas right
     * now, and the rooms below are the only place that is known: presence
     * undercounts, because a socket below `read` never registers a face
     * (`atLeast(capability, "read")` further down), and a viewer watching a
     * canvas is exactly the kind of connection an abuse report is about.
     *
     * A census handed IN rather than a count handed out, because
     * `attachWebSockets` returns its closer and nothing else — one seam instead
     * of a second return value every existing caller would have to unpack.
     * Absent in every test that attaches sockets without a daemon, and then the
     * number is simply not available rather than wrong.
     */
    census?: SocketCensus;
}
/**
 * **How many sockets are open on one canvas, at THIS instance.**
 *
 * The bound is stated rather than hidden: the hub is in-process, so a home
 * running two revisions during a rollout counts only the half that answered
 * the request — the same bound the sweep lives with (design, "What it
 * reaches"). A number that quietly meant "some of them" would be worse than
 * one the verb labels honestly, which is why the CLI prints it as *open here*.
 */
export declare class SocketCensus {
    private read;
    /** Registered once, by the socket layer, over its own room map. */
    servedBy(read: (canvasId: string) => number): void;
    /** Open sockets on that canvas, or 0 when no socket layer is attached. */
    open(canvasId: string): number;
}
export declare function attachWebSockets(server: Server, engine: Engine, desk: Desk, presence: PresenceHub, rc?: RcHolds, options?: WebSocketOptions): () => void;
export {};
