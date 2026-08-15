import Fastify from "fastify";
import { DEFAULT_PORT } from "@isocan/core";

export interface DaemonOptions {
  port?: number;
}

export async function startDaemon(options: DaemonOptions = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const app = Fastify();

  app.get("/healthz", async () => ({
    ok: true,
    pid: process.pid,
    version: "0.1.0",
    startedAt: new Date().toISOString(),
  }));

  await app.listen({ port, host: "127.0.0.1" });
  console.log(`isocan daemon listening on http://127.0.0.1:${port}`);
  return app;
}
