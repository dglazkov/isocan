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
  contentPorts,
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

describe("which ports the content listener may try", () => {
  it("plans nothing for a wide-bound daemon, whatever the environment says", () => {
    // The one misconfiguration this function exists to make unreachable: a
    // badge-less blob listener facing the network.
    expect(contentPorts("0.0.0.0", undefined, 4441)).toEqual([]);
    expect(contentPorts("0.0.0.0", "4442", 4441)).toEqual([]);
    expect(contentPorts("::", undefined, 4441)).toEqual([]);
  });

  it("defaults to the neighbour port with an ephemeral fallback", () => {
    expect(contentPorts("127.0.0.1", undefined, 4441)).toEqual([4442, 0]);
    // A main port that was ephemeral has no meaningful neighbour.
    expect(contentPorts("127.0.0.1", undefined, 0)).toEqual([0]);
  });

  it("honours a pin, an explicit ephemeral, and the off switch", () => {
    expect(contentPorts("127.0.0.1", "5000", 4441)).toEqual([5000]);
    expect(contentPorts("127.0.0.1", "0", 4441)).toEqual([0]);
    expect(contentPorts("127.0.0.1", "off", 4441)).toEqual([]);
    // An unparseable value disables rather than guesses.
    expect(contentPorts("127.0.0.1", "auto", 4441)).toEqual([]);
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

  it("an unconfigured local daemon stands a content origin and advertises it", async () => {
    const res = await fetch(`${base}${SERVING_ROUTE}`, { headers: badge.headers });
    expect(res.status).toBe(200);
    const { contentBase } = (await res.json()) as { contentBase: string | null };
    // Advertised = actually listening: the base is derived from the listener
    // the daemon started, and the Daemon object reports the same one.
    expect(contentBase).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(contentBase).toBe(daemon.contentBase);
  });

  it("the content origin serves bytes badge-less, and without the app origin's CSP", async () => {
    const up = await fetch(`${base}/api/projects/prj_1/blobs`, {
      method: "POST",
      headers: { "Content-Type": "text/html", "X-Isocan-Filename": "b.html", ...badge.headers },
      body: "<h1>frame me</h1>",
    });
    const { blobHash } = (await up.json()) as { blobHash: string };
    // No badge, no cookie: the whole point of the origin is that it holds
    // nothing — and the loopback bind plus hash addressing is what makes
    // badge-less acceptable (the tree's three facts).
    const res = await fetch(`${daemon.contentBase}/api/projects/prj_1/blobs/${blobHash}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<h1>frame me</h1>");
    // The response-header sandbox stays on the APP origin only: here it
    // would re-impose the opaque origin and defeat the storage the split
    // grants. What this origin should send instead is stage 3's decision.
    expect(res.headers.get("content-security-policy")).toBe(null);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("the content origin answers nothing but blobs", async () => {
    for (const path of [SERVING_ROUTE, "/api/projects/prj_1/canvas", "/api/homes", "/"]) {
      const res = await fetch(`${daemon.contentBase}${path}`);
      expect(res.status).toBe(404);
    }
  });

  it("contentPort 'off' restores today exactly: no listener, null advertised", async () => {
    const offHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-content-off-"));
    const off = await startDaemon({ port: 0, home: offHome, contentPort: "off" });
    try {
      const address = off.app.server.address();
      const offBase = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
      const offBadge = await mintTestBadge(offBase);
      const res = await fetch(`${offBase}${SERVING_ROUTE}`, { headers: offBadge.headers });
      expect(await res.json()).toEqual({ contentBase: null });
      expect(off.contentBase).toBe(null);
    } finally {
      await off.close();
      await fs.rm(offHome, { recursive: true, force: true });
    }
  });
});
