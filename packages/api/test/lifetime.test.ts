import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { DaemonClient } from "../src/client.ts";

it.each(["health", "door"] as const)("cancels held %s setup HTTP without starting a daemon or retrying", async (stage) => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-lifetime-"));
  const paths: string[] = [];
  let held = 0;
  let closed = 0;
  const server = createServer((req, res) => {
    paths.push(req.url!);
    if (req.url === "/api/projects") {
      res.writeHead(401, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "badge required" }));
      return;
    }
    held++;
    res.on("close", () => { held--; closed++; });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  const controller = new AbortController();
  const client = new DaemonClient(base, home, controller.signal);
  try {
    const pending = stage === "health" ? client.ensureDaemon() : client.listCanvases();
    const cancelled = expect(pending).rejects.toThrow("Stopped setup");
    await expect.poll(() => held).toBe(1);
    controller.abort(new Error("Stopped setup"));
    await cancelled;
    await expect.poll(() => held).toBe(0);
    expect(closed).toBe(1);
    expect(paths).toEqual(stage === "health" ? ["/healthz"] : ["/api/projects", "/api/door"]);
    expect(await fs.readdir(home)).toEqual([]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
