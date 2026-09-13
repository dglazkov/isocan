import { promises as fs } from "node:fs";
import { createServer, request } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { DaemonClient, harnessVars } from "@isocan/api";
import { newCanvasId } from "@isocan/core";
import { startDaemon } from "@isocan/server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

it("releases stalled identity and known-ID admission HTTP on stdio timeout and cancellation", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-setup-"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-mcp-setup-work-"));
  const daemon = await startDaemon({ home, port: 0, contentPort: "off", auth: null, birthHome: null });
  const address = daemon.app.server.address();
  const base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  let stall: "identity" | "canvas" | null = null;
  let held = 0;
  let released = 0;
  const proxy = createServer((req, res) => {
    if ((stall === "identity" && req.url?.startsWith("/api/actors?")) || (stall === "canvas" && req.url?.endsWith("/canvas"))) {
      held++;
      res.on("close", () => { held--; released++; });
      return;
    }
    const upstream = request(`${base}${req.url}`, { method: req.method, headers: req.headers }, (answer) => {
      res.writeHead(answer.statusCode!, answer.headers); answer.pipe(res);
    });
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
  const proxyAddress = proxy.address();
  const origin = `http://127.0.0.1:${typeof proxyAddress === "object" && proxyAddress ? proxyAddress.port : 0}`;
  const routes = new DaemonClient(origin, home);
  const actor = (await routes.claimActor({ type: "actor.claim", sessionKey: "mcp:setup", name: "Acme Setup" })).envelope.actor;
  const canvas = newCanvasId();
  await routes.sendOp(null, actor, { type: "project.create", canvasId: canvas, title: "Acme setup", groupMode: "groups" });
  const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  for (const key of harnessVars) delete env[key];
  Object.assign(env, { ISOCAN_HOME: home, ISOCAN_DIRECT: origin });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url)), "mcp"], cwd: work, env, stderr: "pipe" });
  transport.stderr?.on("data", () => {});
  const host = new Client({ name: "acme-setup-host", version: "1" });
  const watch = vi.spyOn(daemon.engine, "onEvent");
  try {
    await host.connect(transport);
    for (const stage of ["identity", "canvas"] as const) {
      stall = stage;
      const pending = host.callTool({ name: "wait_for_feedback", arguments: { canvas, session: "setup", cursor: 7, timeoutMs: 500 } });
      const result = await Promise.race([pending, new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))]);
      expect(result, `${stage} setup exceeded the feedback deadline`).not.toBeNull();
      expect(JSON.parse((result!.content as Array<{ text: string }>)[0]!.text)).toEqual({ status: "timeout", cursor: 7, entries: [] });
      await expect.poll(() => held).toBe(0);
      expect(released).toBe(stage === "identity" ? 1 : 3);

      const controller = new AbortController();
      const waiting = host.callTool({ name: "wait_for_feedback", arguments: { canvas, session: "setup", timeoutMs: 60000 } }, undefined, { signal: controller.signal });
      const cancelled = expect(waiting).rejects.toThrow();
      await expect.poll(() => held).toBe(1);
      controller.abort();
      await cancelled;
      await expect.poll(() => held).toBe(0);
    }
    expect(released).toBe(4);
    expect(watch).not.toHaveBeenCalled();
    expect(daemon.presence.roster(canvas)).toEqual([]);
    expect(await routes.seen()).toEqual({ marks: {} });
  } finally {
    await host.close();
    proxy.closeAllConnections();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
    watch.mockRestore(); await daemon.close();
    for (const dir of [home, work]) await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}, 15_000);
