import { reservePort } from "../../../test/ports.ts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";

/**
 * **What the daemon asks its home, and how often** — auto-upgrade phase 2's
 * cost claim, counted rather than reasoned about.
 *
 * The design's central decision is that the build question does NOT ride the
 * poll: `DEFAULT_POLL_MS` is 2000, and asking there would be 1,800 requests an
 * hour for an answer that changes about twice a day. That is a claim about
 * request counts, so this file counts requests. It is also where the
 * reconnect trigger is proved — the half that makes an hourly interval
 * tolerable, and the half `upgrade-notice.test.ts` cannot see from the CLI.
 *
 * The home is a stub that speaks just enough to be a home: the door hands out
 * a badge, the canvas list is empty, and the health route says which build it
 * is. Enough for `answering` to be true, which is the state this file toggles.
 */

/**
 * This daemon's own build, set before anything calls `buildStamp()` — the
 * stamp is computed once and cached for the life of the process. Without it a
 * checkout on reftable reports `commit: null`, and every assertion about the
 * verdict below would pass by asserting nothing, which is the shape of check
 * this project's lessons exist to forbid.
 */
const MINE = "aaaaaaa";
process.env.ISOCAN_BUILD_SHA = MINE;
process.env.ISOCAN_BUILD_DATE = "2026-08-12T09:00:00.000Z";

let homeDir: string;
let stub: http.Server;
let homeBase: string;
let daemon: Daemon | null = null;

/** Every health request the stub has answered. The number under test. */
let probes = 0;
/** Sweeps the stub has answered — the poll, for contrast with `probes`. */
let sweeps = 0;
/** When false the canvas list refuses, which is how `answering` goes false. */
let listing = true;

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-probe-"));
  probes = 0;
  sweeps = 0;
  listing = true;
  stub = http.createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (pathname === "/healthz" || pathname === "/api/healthz") {
      probes++;
      return json(200, {
        ok: true,
        pid: 1,
        startedAt: "2026-08-25T09:30:00.000Z",
        version: "0.1.0",
        commit: "bbbbbbb",
        builtAt: "2026-08-25T09:00:00.000Z",
      });
    }
    if (pathname === "/api/door") return json(200, { badgeId: "bdg_stub", secret: "s3cret" });
    if (pathname === "/api/projects") {
      sweeps++;
      return listing ? json(200, []) : json(503, { error: "the home is redeploying" });
    }
    return json(404, { error: "this stub only answers the door, the list and health" });
  });
  await new Promise<void>((resolve) => stub.listen(0, "127.0.0.1", resolve));
  homeBase = `http://127.0.0.1:${(stub.address() as net.AddressInfo).port}`;
});

afterEach(async () => {
  await daemon?.close().catch(() => {});
  daemon = null;
  await new Promise<void>((resolve) => stub.close(() => resolve()));
  await fs.rm(homeDir, { recursive: true, force: true });
});

/** A replica that sweeps briskly and would not probe again for an hour, so
 * every probe this file counts after boot had a reason other than the timer. */
async function replica(): Promise<Daemon> {
  daemon = await startDaemon({
    port: await reservePort(),
    home: homeDir,
    birthHome: homeBase,
    homePollMs: 25,
    homeProbeMs: 60 * 60 * 1000,
  });
  return daemon;
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the build probe is not on the poll", () => {
  /**
   * **One number, guarding two things**, and both of them were bugs this
   * counting found (2026-08-28):
   *
   * - The probe must not ride the poll. The sweep runs many times across this
   *   window and the probe runs once; if the two ever move together, the
   *   design's one measured cost claim is false.
   * - `HomeLink.start()` must be idempotent. `HomeLinks.linkFor` fires
   *   `start()` on a link the moment it creates one and `HomeLinks.start()`
   *   then awaits `start()` on every address it dials, so a link created at
   *   boot ran `boot()` TWICE — two probes here, and two poll intervals of
   *   which `close()` could only clear one.
   *
   * Both regressions show up as the same failure, `2` instead of `1`, which
   * is why one assertion is enough and a second would only look like more.
   * (A rate check on the sweeps is NOT enough and was tried: `sync()`
   * coalesces, so two intervals produce nowhere near twice the requests and
   * the doubling hides.)
   */
  it("asks its home exactly once at boot, however many times it sweeps", async () => {
    await replica();
    await settle(600);
    expect(sweeps).toBeGreaterThan(5);
    expect(probes).toBe(1);
  });
});

describe("a home that starts answering again is re-asked at once", () => {
  it("re-reads the build on reconnect rather than waiting out the hour", async () => {
    await replica();
    await settle(400);
    expect(probes).toBe(1);

    // The home goes away — a redeploy, a lid closing. The sweep notices; the
    // probe is an hour off and notices nothing.
    listing = false;
    await settle(300);
    expect(probes).toBe(1);

    // And it comes back. THIS is what makes an hourly probe tolerable: a
    // machine that reconnects does not carry a stale answer, or no answer,
    // until the top of the next hour.
    listing = true;
    await settle(400);
    expect(probes).toBe(2);
  });

  it("carries the verdict on its own health body, naming the home it came from", async () => {
    const replicaDaemon = await replica();
    const address = replicaDaemon.app.server.address() as net.AddressInfo;
    const body = (await (await fetch(`http://127.0.0.1:${address.port}/healthz`)).json()) as {
      commit?: string;
      upgrade?: Record<string, unknown>;
    };
    // The rig first: if the stamp did not take, every assertion below would
    // pass by being skipped.
    expect(body.commit).toBe(MINE);
    // A machine can answer to several homes, so a verdict that did not name
    // one would be unattributable.
    expect(body.upgrade).toMatchObject({
      available: true,
      direction: "behind",
      home: homeBase,
      homeCommit: "bbbbbbb",
      mine: MINE,
    });
  });
});
