import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startDaemon, type Daemon } from "../src/daemon.ts";

/**
 * **The entry point must never be guessed about.**
 *
 * Neither `index.html` nor the bundles carried a `Cache-Control` header, and
 * an absent header is not "do not cache" — with no directive and no validator
 * a browser applies its own heuristic. Chrome kept `index.html`, which is the
 * one file that must not be kept: it NAMES the content-hashed bundles, so a
 * stale copy pins a person to the entire previous build.
 *
 * It was reported the way this always gets reported — a deploy landed, the
 * page was reloaded, and nothing had changed. The reload was honest; it
 * re-read a cached entry point pointing at the old assets.
 *
 * The two halves are one design and are tested as one: `immutable` on the
 * bundles is only safe BECAUSE their names carry a content hash, and it is
 * what pays for revalidating the entry point on every load.
 */
describe("what the app server lets a browser keep", () => {
  let home: string;
  let daemon: Daemon;
  let base: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-cache-"));
    daemon = await startDaemon({ port: 0, home });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterEach(async () => {
    await daemon.close();
    await fs.rm(home, { recursive: true, force: true });
  });

  it("tells the browser to revalidate the page every time", async () => {
    const res = await fetch(`${base}/`);
    // A built tree is required for this to mean anything: with no dist the
    // route 404s and the assertion would pass by not running.
    expect(res.status, "run `npm run build` — this guards the served app").toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-cache");
  });

  it("lets the hashed bundles be kept forever, because their names change", async () => {
    const html = await (await fetch(`${base}/`)).text();
    const asset = html.match(/\/?assets\/[A-Za-z0-9._-]+\.(?:js|css)/)?.[0];
    expect(asset, "the built page should reference a hashed asset").toBeTruthy();
    const res = await fetch(`${base}/${asset!.replace(/^\//, "")}`);
    expect(res.status).toBe(200);
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toContain("immutable");
    expect(cc).toMatch(/max-age=\d{7,}/);
    // The whole justification for `immutable`, asserted rather than assumed:
    // the filename carries a content hash, so new bytes get a new name.
    expect(asset).toMatch(/-[A-Za-z0-9_-]{8,}\.(?:js|css)$/);
  });
});
