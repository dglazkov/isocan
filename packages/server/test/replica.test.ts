import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BADGE_COOKIE, DOOR_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { resolveHomeUrl } from "../src/config.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge } from "./badge.ts";

/**
 * The one-origin rule, in the code that enforces it: **a local daemon serves
 * ops to CLIs, never pages to persons** (offline-birth.md). `registerStaticWebApp`
 * is exactly the code a home needs and exactly what a replica must stop doing,
 * and which of the two a daemon is comes from configuration — never a flag,
 * and never a compiled-in default.
 *
 * Stage 1 does not dial the home. It stops serving pages and records the
 * address; the connection hangs off the same answer in stage 2.
 */

/**
 * A home address that is a STRING and nothing more.
 *
 * It used to be `https://dev.isocan.io`, which was harmless while a configured
 * home was only a thing the page server branched on. Stage 2 made a replica
 * DIAL its home, and these fixtures immediately started knocking on the real
 * dev home's door from the test suite — slow, impolite, and a test that would
 * fail on a laptop with no network for a reason it never mentions. `.invalid`
 * is reserved by RFC 2606 and can never resolve, which is exactly what a
 * fixture that is only ever echoed back should be.
 */
const HOME = "https://home.invalid";

/** Whether the web app has actually been built into `packages/web/dist`. A
 * home only serves pages when it has pages to serve, so the home half of the
 * page assertions is conditional and the replica half never is — a replica
 * refuses whether or not a build is sitting there. */
const distBuilt = existsSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist/index.html"),
);

let home: string;
let daemon: Daemon | null;
/** A second daemon, for the one test whose replica has to reach a home that
 * is actually there. Its own directory, torn down with everything else. */
let upstream: Daemon | null;
let upstreamHome: string | null;

async function boot(homeUrl: string | null): Promise<string> {
  daemon = await startDaemon({ port: 0, home, homeUrl });
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function realHome(): Promise<string> {
  upstreamHome = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-upstream-"));
  upstream = await startDaemon({ port: 0, home: upstreamHome, homeUrl: null });
  const address = upstream.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-replica-"));
  daemon = null;
  upstream = null;
  upstreamHome = null;
});

afterEach(async () => {
  await daemon?.close();
  await upstream?.close();
  await fs.rm(home, { recursive: true, force: true });
  if (upstreamHome) await fs.rm(upstreamHome, { recursive: true, force: true });
  delete process.env.ISOCAN_HOME_URL;
});

describe("where a daemon learns it is a replica", () => {
  it("is a home when nothing says otherwise — there is no baked-in address", async () => {
    // The load-bearing assertion of the whole mechanism: every daemon in this
    // repo today has no home configured, and must go on being a home. Baking
    // `isocan.io` in as a fallback would silently demote all of them; that
    // default belongs to phase 14, where setup writes the address on purpose.
    expect(await resolveHomeUrl(home)).toBeNull();
    daemon = await startDaemon({ port: 0, home });
    expect(daemon.homeUrl).toBeNull();
  });

  it("reads ISOCAN_HOME_URL from the environment", async () => {
    process.env.ISOCAN_HOME_URL = HOME;
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("falls back to config.json's `home`", async () => {
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: HOME }));
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("lets the environment win, because that is how a container is configured", async () => {
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: "https://elsewhere.example" }));
    process.env.ISOCAN_HOME_URL = HOME;
    expect(await resolveHomeUrl(home)).toBe(HOME);
  });

  it("treats a malformed config.json as no configuration, not as a crash", async () => {
    // config.json is hand-edited and already carries `harnessVars` and
    // `defaultProjectId`. One tolerant reader serves all three, so a stray
    // comma costs the file's settings and never a daemon that will not boot.
    await fs.writeFile(p.configFile(home), "{ not json ,");
    expect(await resolveHomeUrl(home)).toBeNull();
    await fs.writeFile(p.configFile(home), '"a string is not a config"');
    expect(await resolveHomeUrl(home)).toBeNull();
    await fs.writeFile(p.configFile(home), JSON.stringify({ home: "   " }));
    expect(await resolveHomeUrl(home)).toBeNull();
  });
});

describe("a replica does not serve pages", () => {
  it("answers an unmatched GET with a 404 that names the home", async () => {
    const base = await boot(HOME);
    for (const url of ["/", "/c/prj_1", "/index.html"]) {
      const res = await fetch(`${base}${url}`, { headers: { Accept: "text/html" } });
      expect(res.status, url).toBe(404);
      // Not silent: the failure-may-not-be-silent instinct runs through this
      // codebase, and an unexplained 404 from your own machine reads as a
      // broken daemon rather than as a design decision.
      expect(await res.text()).toContain(HOME);
    }
  });

  it("names the home in a header too, and does NOT redirect there", async () => {
    const base = await boot(HOME);
    const res = await fetch(`${base}/c/prj_1`, { redirect: "manual" });
    expect(res.headers.get("x-isocan-home")).toBe(HOME);
    // A Location would send a browser to the home carrying a path this daemon
    // invented — which is how a person lands on the home's own 404 wondering
    // what they did. The address is stated; the move is left to the person.
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(404);
  });

  it("answers a script in plain text rather than a wall of markup", async () => {
    const base = await boot(HOME);
    const res = await fetch(`${base}/`, { headers: { Accept: "*/*" } });
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(await res.text()).toBe(`this canvas lives at ${HOME} — open it there\n`);
  });

  it("mints no cookie badge, because the page that minted it is gone", async () => {
    // The SPA fallback is where a browser gets badged (`if (!req.badge)
    // mintBadge("cookie")`). A daemon that no longer serves pages must not go
    // on badging people it is not serving — leaving that half behind would
    // mint a badge per stray asset request to a page that does not exist.
    const base = await boot(HOME);
    const res = await fetch(`${base}/`);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).not.toContain(BADGE_COOKIE);
  });

  it("still serves ops to CLIs — that is the half it keeps", async () => {
    // A REAL home for this one, because stage 2 made the forward real: a write
    // on a replica now travels to its home, so a made-up address would have
    // this test asserting that an op reaches an address that does not exist.
    // The fixture changed; the assertions below did not.
    const upstream = await realHome();
    const base = await boot(upstream);
    // The door still opens (a CLI's bearer badge comes from here), health is
    // still answered, and the op vocabulary is untouched. "Ops to CLIs, never
    // pages to persons" is a statement about pages only.
    expect((await fetch(`${base}${DOOR_ROUTE}`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    const badge = await mintTestBadge(base);
    await badge.speakAs({ id: "usr_isaac", name: "Isaac" });
    const created = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        projectId: null,
        actor: { id: "usr_isaac", name: "Isaac" },
        op: { type: "project.create", projectId: "prj_1", title: "Acme Sprint Board" },
      }),
    });
    expect(created.status).toBe(200);
    const projects = await fetch(`${base}/api/projects`, { headers: badge.headers });
    expect(((await projects.json()) as { id: string }[]).map((p) => p.id)).toEqual(["prj_1"]);
  });

  it("records the address it is a replica of", async () => {
    // Stage 2's home connection dials exactly this. A daemon that could not
    // say which of the two things it is would be a daemon nothing could ask.
    await boot(HOME);
    expect(daemon!.homeUrl).toBe(HOME);
  });
});

describe("a home is unchanged", () => {
  it("serves the web app and badges the page load", async () => {
    if (!distBuilt) return; // no build here; the daemon correctly serves nothing
    const base = await boot(null);
    const res = await fetch(`${base}/c/prj_1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("set-cookie")).toContain(BADGE_COOKIE);
    expect(res.headers.get("x-isocan-home")).toBeNull();
  });
});
