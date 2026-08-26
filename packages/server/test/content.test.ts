import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { SERVING_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import {
  CONTENT_BLOB_ROUTE,
  isContentRequest,
  registerContentRoutes,
  type ContentDeps,
} from "../src/content.ts";

/**
 * Stage 1 of the content-origin plan
 * (`docs/projects/atlas/content-origin-plan.md`): the role exists, nothing is
 * routed to it, and the app origin is byte-identical to before the
 * extraction. Invariants 1 and 4 as tests.
 */

describe("invariant 4: the content role answers blobs and nothing else", () => {
  it("registers exactly one route", async () => {
    const routes: Array<{ method: unknown; url: string }> = [];
    const app = Fastify();
    app.addHook("onRoute", (r) => {
      routes.push({ method: r.method, url: r.url });
    });
    // Registration never touches the deps — only a handled request would —
    // so the table can be enumerated without standing a daemon up.
    registerContentRoutes(app, { engine: null, store: null, homes: null } as unknown as ContentDeps, {
      csp: null,
    });
    await app.ready();
    // Fastify mirrors every GET with a HEAD; both answer bytes for a hash.
    // Anything beyond that — a listing, a canvas question, a door — is the
    // role becoming a second API, which is the thing this test refuses.
    const urls = [...new Set(routes.map((r) => r.url))];
    expect(urls).toEqual([CONTENT_BLOB_ROUTE]);
    const methods = routes.flatMap((r) => (Array.isArray(r.method) ? r.method : [r.method]));
    for (const m of methods) expect(["GET", "HEAD"]).toContain(m);
    await app.close();
  });
});

describe("the hosted role is recognized by Host header", () => {
  it("answers only when a content host is configured and matches", () => {
    expect(isContentRequest(undefined, null)).toBe(false);
    expect(isContentRequest("isocan.io", null)).toBe(false);
    expect(isContentRequest(undefined, "content.example")).toBe(false);
    expect(isContentRequest("isocan.io", "content.example")).toBe(false);
    expect(isContentRequest("content.example", "content.example")).toBe(true);
    // The header may carry a port and any casing; the configured host is a
    // bare domain — the load balancer owns ports on the hosted shape.
    expect(isContentRequest("Content.Example:443", "content.example")).toBe(true);
  });
});

describe("invariant 1: the app origin after the extraction is the app origin before it", () => {
  const alice = { id: "usr_alice", name: "Alice" };
  let home: string;
  let daemon: Daemon;
  let base: string;
  let badge: TestBadge;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-content-"));
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: alice,
        op: { type: "project.create", canvasId: "prj_1", title: "P" },
      }),
    });
    expect(res.status).toBe(200);
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true });
  });

  it("blob responses keep every header the inline route sent", async () => {
    const up = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "a.html", ...badge.headers },
      body: "<h1>hi</h1>",
    });
    expect(up.status).toBe(200);
    const { blobHash } = (await up.json()) as { blobHash: string };
    const res = await fetch(`${base}/api/projects/prj_1/blobs/${blobHash}`, {
      headers: badge.headers,
    });
    expect(res.status).toBe(200);
    // The defense-in-depth CSP for directly-opened HTML blobs on THIS origin
    // — the content role takes it as an option, and the app origin must keep
    // passing exactly this until stage 3 decides the content role's own.
    expect(res.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("private, immutable, max-age=31536000");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(await res.text()).toBe("<h1>hi</h1>");
  });

  it("an unconfigured home advertises no content origin", async () => {
    const res = await fetch(`${base}${SERVING_ROUTE}`, { headers: badge.headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ contentBase: null });
  });
});
