import type { Server } from "node:http";
import { Engine } from "./engine.js";
import type { Desk } from "./desk.js";
import { PresenceHub } from "./presence.js";
import type { RcHolds } from "./rc-holds.js";
/**
 * Per-canvas rooms. Server→client: snapshot on connect, op-applied per
 * mutation, presence rosters. Client→server (web only): presence updates —
 * the tab's clientId doubles as its presence session id.
 */
/** Returns a closer that terminates all live sockets — upgraded connections
 * are hijacked from the HTTP server, so Fastify's forceCloseConnections
 * cannot reach them and shutdown would hang otherwise. */
export declare function attachWebSockets(server: Server, engine: Engine, desk: Desk, presence: PresenceHub, rc?: RcHolds): () => void;
