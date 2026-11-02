import { afterEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { localModel } from "@isocan/core/local-judge";
import { modelPath, modelsDir } from "@isocan/core/modelstore";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { JUDGE_WORKER_POLICY, judgeWorkerPolicy } from "../src/model-files.ts";

/**
 * **`GET /models/<name>`** (local-judge phase 0): the local judge's model,
 * served from `<home>/models/` by name, to this machine only. The file here
 * is a SPARSE stand-in of the pinned length — the route checks the length,
 * not the hash (the verb checked that on the way in), and nothing in this
 * suite reads 164 MB.
 */

const nodes: Array<{ daemon: Daemon; dir: string }> = [];
afterEach(async () => {
  for (const node of nodes.splice(0).reverse()) {
    await node.daemon.close();
    await fs.rm(node.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

const model = localModel("embeddinggemma-2-text-270m")!;

async function setup(opts: { servesWorld?: boolean; fetched?: boolean } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-model-files-"));
  if (opts.fetched !== false) {
    await fs.mkdir(modelsDir(dir), { recursive: true });
    const fh = await fs.open(modelPath(dir, model), "w");
    await fh.truncate(model.bytes);
    await fh.close();
    await fs.writeFile(path.join(modelsDir(dir), "acme-other.bin"), "not served");
  }
  const daemon = await startDaemon({ home: dir, port: 0, contentPort: "off", birthHome: null, ...(opts.servesWorld ? { servesWorld: true } : {}) });
  nodes.push({ daemon, dir });
  const port = (daemon.app.server.address() as { port: number }).port;
  return { daemon, port, base: `http://127.0.0.1:${port}` };
}

/** Headers of a GET, without reading the body. */
function head(port: number, route: string, host?: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: route, headers: host ? { host } : {} }, (res) => {
      if (res.statusCode === 200) {
        res.destroy();
        return resolve({ status: 200, headers: res.headers, body: "" });
      }
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on("error", reject);
  });
}

describe("GET /models/<name>", () => {
  it("serves a fetched model to a loopback page with its type, exact length and a long cache, no badge needed", async () => {
    const { port } = await setup();
    const res = await head(port, `/models/${model.name}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-length"]).toBe(String(model.bytes));
    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("serves the bytes themselves", async () => {
    const { base } = await setup();
    const res = await fetch(`${base}/models/${model.name}`);
    const reader = res.body!.getReader();
    const first = await reader.read();
    await reader.cancel();
    expect(first.value!.byteLength).toBeGreaterThan(0);
  });

  it("serves known names only — no other file in the directory, no path, no listing", async () => {
    const { port } = await setup();
    for (const route of ["/models/acme-other.bin", "/models/..%2Fkeys.json", `/models/${model.file}`, "/models/"]) {
      const res = await head(port, route);
      expect(res.status, route).toBe(404);
      expect(res.body, route).not.toContain("not served");
    }
    // Bare `/models` is a page path like any other — the SPA's shell, never a listing.
    expect((await head(port, "/models")).body).not.toContain(model.file);
  });

  it("says which verb fetches a known model that is not on disk", async () => {
    const { port } = await setup({ fetched: false });
    const res = await head(port, `/models/${model.name}`);
    expect(res.status).toBe(404);
    expect(JSON.parse(res.body)).toMatchObject({ code: "model-not-fetched", error: expect.stringContaining(`isocan model fetch ${model.name}`) });
  });

  it("answers 404 on a daemon that serves the world, and to a request naming another host", async () => {
    const world = await setup({ servesWorld: true });
    expect((await head(world.port, `/models/${model.name}`)).status).toBe(404);
    const local = await setup();
    const rebound = await head(local.port, `/models/${model.name}`, "acme.example:4441");
    expect(rebound.status).toBe(404);
    expect(JSON.parse(rebound.body)).toMatchObject({ code: "model-not-here" });
  });
});

describe("the judge Worker's own Content-Security-Policy", () => {
  it("is sent with the lab build's judge-worker asset and nothing else", () => {
    expect(judgeWorkerPolicy("/repo/packages/web/dist/assets/judge-worker-CDXc8aAq.js")).toBe(JUDGE_WORKER_POLICY);
    for (const other of ["/dist/assets/worker-CDXc8aAq.js", "/dist/assets/judge-lab-B9rK2mZ8.js", "/dist/assets/judge-worker-x.js.map", "/dist/judge-lab.html", "/dist/index.html"]) {
      expect(judgeWorkerPolicy(other), other).toBeNull();
    }
  });

  it("lets the Worker reach its own origin and nothing else, and compile wasm — no wider", () => {
    expect(JUDGE_WORKER_POLICY).toContain("connect-src 'self'");
    expect(JUDGE_WORKER_POLICY).toContain("default-src 'none'");
    expect(JUDGE_WORKER_POLICY).not.toMatch(/'unsafe-eval'|'unsafe-inline'|\*|https?:/);
  });

  it("is not sent with an ordinary static file", async () => {
    const { base } = await setup({ fetched: false });
    const res = await fetch(`${base}/icon.svg`);
    expect(res.headers.get("content-security-policy")).toBeNull();
  });
});
