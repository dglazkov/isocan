import { promises as fs } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_PORT } from "@isocan/core";
import { Engine } from "./engine.ts";
import { registerRoutes } from "./http.ts";
import { attachWebSockets } from "./ws.ts";
import { Store } from "./store.ts";
import { PresenceHub } from "./presence.ts";
import { daemonFile, isocanHome } from "./paths.ts";

export interface DaemonOptions {
  port?: number;
  home?: string;
}

export interface Daemon {
  app: FastifyInstance;
  engine: Engine;
  store: Store;
  port: number;
  close: () => Promise<void>;
}

export async function startDaemon(options: DaemonOptions = {}): Promise<Daemon> {
  const port = options.port ?? DEFAULT_PORT;
  const home = options.home ?? isocanHome();

  const store = new Store(home);
  await store.init();
  const engine = new Engine(store);
  const presence = new PresenceHub();

  // Op piggyback: an op bound to a session (clientId === sessionId) moves
  // that session's cursor to the op's locus — presence traces real work.
  engine.onEvent((projectId, message) => {
    if (message.type !== "op-applied") return;
    void engine
      .getSnapshot(projectId)
      .then((snapshot) =>
        presence.opApplied(
          projectId,
          message.entry.envelope.clientId,
          message.entry.envelope.actor,
          message.entry.envelope.op,
          snapshot.canvas,
        ),
      )
      .catch(() => {});
  });

  // forceCloseConnections: shutdown must not hang on a browser's idle
  // keep-alive sockets or a half-read blob stream.
  const app = Fastify({ bodyLimit: 512 * 1024 * 1024, forceCloseConnections: true });
  registerRoutes(app, engine, store, presence);
  await app.listen({ port, host: "127.0.0.1" });
  const closeWebSockets = attachWebSockets(app.server, engine, presence);

  await fs.writeFile(
    daemonFile(home),
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }, null, 2),
  );

  const close = async () => {
    presence.close();
    closeWebSockets();
    await app.close();
    // Only remove the pidfile if it is still OURS — a stop-then-serve race
    // otherwise lets the dying daemon delete its replacement's pidfile.
    try {
      const current = JSON.parse(await fs.readFile(daemonFile(home), "utf8")) as { pid: number };
      if (current.pid === process.pid) await fs.rm(daemonFile(home), { force: true });
    } catch {
      // already gone or unreadable — nothing to clean
    }
  };

  return { app, engine, store, port, close };
}

/** Long-running entrypoint with signal handling. */
export async function runDaemon(options: DaemonOptions = {}): Promise<void> {
  const daemon = await startDaemon(options);
  console.log(`isocan daemon listening on http://127.0.0.1:${daemon.port}`);
  const shutdown = () => {
    void daemon.close().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
