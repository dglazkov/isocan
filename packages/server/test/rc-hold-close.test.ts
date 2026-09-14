import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs, readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **A hold ends when its connection does** (agent-custody mechanism 1, "the
 * connection IS the fact"). The route released on `req.raw`'s `close`, but a
 * POST's IncomingMessage closes as soon as its body has been read — before
 * the handler's first await returns — so the listener never heard the
 * socket's later close and a dead rc stayed answerable for the rest of its
 * `waitMs`. Found by sheep's collie walk (9 s from abort to nobody listening,
 * 14 Sep 2026). What a hold is held by is the response, which closes with the
 * socket.
 *
 * The client here is plain `node:http`, destroyed mid-hold: the same close a
 * killed `isocan rc` makes. And because this was the second route to make the
 * mistake (the log watch's comment already named it), the last case reads the
 * server's sources for a listener on a request's `close` (lessons.md #68).
 */

const CANVAS = "prj_acme";
const ADA = { id: "usr_ada", name: "Ada" };
const PERCY = { id: "act_percy", name: "Percy" };

let home: string;
let daemon: Daemon;
let port: number;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-hold-close-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(ADA);
  await badge.speakAs(PERCY, "agent:Percy");
  const created = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId: null, actor: ADA, op: { type: "project.create", canvasId: CANVAS, title: "Acme Board" } }),
  });
  expect(created.status).toBe(200);
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Open a hold from a raw HTTP client; the returned request is the socket. */
function openHold(body: unknown): http.ClientRequest {
  const payload = JSON.stringify(body);
  const req = http.request({
    host: "127.0.0.1",
    port,
    method: "POST",
    path: "/api/rc/hold",
    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...badge.headers },
  });
  req.on("error", () => {}); // the destroy below is the point, not a failure
  req.end(payload);
  return req;
}

async function answering(): Promise<{ parked: boolean; actorIds: string[] }> {
  const res = await fetch(`${base}/api/projects/${CANVAS}/rc`, { headers: badge.headers });
  return (await res.json()) as { parked: boolean; actorIds: string[] };
}

/** Poll until `predicate` holds, or give up at `withinMs` and say how long it took. */
async function until(predicate: () => Promise<boolean>, withinMs: number): Promise<number> {
  const started = Date.now();
  while (Date.now() - started < withinMs) {
    if (await predicate()) return Date.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return Number.POSITIVE_INFINITY;
}

describe("POST /api/rc/hold: the connection is the fact", () => {
  it("a hold naming an agent is released within a second of its client going away", async () => {
    const client = openHold({ canvasId: CANVAS, actorIds: [PERCY.id], waitMs: 10_000 });
    expect(await until(async () => (await answering()).parked, 2_000)).toBeLessThan(2_000);
    expect((await answering()).actorIds).toEqual([PERCY.id]);
    // Still open while the client is: nothing released it early either.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await answering()).parked).toBe(true);

    client.destroy();
    const released = await until(async () => !(await answering()).parked, 1_000);
    expect(released).toBeLessThan(1_000);
    expect((await answering()).actorIds).toEqual([]);
  });

  it("a hold naming nobody is held while its client stays, and released when it leaves", async () => {
    const client = openHold({ canvasId: CANVAS, actorIds: [], waitMs: 10_000 });
    expect(await until(async () => (await answering()).parked, 2_000)).toBeLessThan(2_000);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await answering()).parked).toBe(true);

    client.destroy();
    expect(await until(async () => !(await answering()).parked, 1_000)).toBeLessThan(1_000);
  });
});

describe("no route waits on a request's close", () => {
  it("every close listener in the server's sources is on the response", () => {
    const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
    const offenders: string[] = [];
    let listeners = 0;
    for (const name of readdirSync(src, { recursive: true }) as string[]) {
      if (!/\.ts$/.test(name)) continue;
      // By LINE, never by span (lessons.md #66): a comment line goes, code stays.
      for (const [i, text] of readFileSync(path.join(src, name), "utf8").split("\n").entries()) {
        const lead = text.trimStart();
        if (lead.startsWith("//") || lead.startsWith("*") || lead.startsWith("/*")) continue;
        if (/\.raw\.(on|once)\("close"/.test(text)) listeners++;
        if (/\b(req|request)\.raw\.(on|once)\("close"/.test(text)) offenders.push(`${name}:${i + 1}: ${lead}`);
      }
    }
    // The sweep found the listeners it exists to judge, so it is reading code.
    expect(listeners).toBeGreaterThanOrEqual(5);
    expect(offenders, `a POST's request closes once its body is read; listen on reply.raw:\n${offenders.join("\n")}`).toEqual([]);
  });
});
