import { promises as fs } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import { DEFAULT_PORT } from "@isocan/core";
import { Engine } from "./engine.ts";
import { registerRoutes } from "./http.ts";
import { attachWebSockets } from "./ws.ts";
import { Store } from "./store.ts";
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

  const app = Fastify({ bodyLimit: 512 * 1024 * 1024 });
  registerRoutes(app, engine, store);
  await app.listen({ port, host: "127.0.0.1" });
  attachWebSockets(app.server, engine);

  await fs.writeFile(
    daemonFile(home),
    JSON.stringify({ pid: process.pid, port, startedAt: new Date().toISOString() }, null, 2),
  );

  const close = async () => {
    await app.close();
    await fs.rm(daemonFile(home), { force: true });
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
