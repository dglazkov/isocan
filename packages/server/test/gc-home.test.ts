import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { GcRequest, HomeGcReport } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { BOOT_SWEEP_MS, firstSweepDelay, startGcSweeper } from "../src/gc.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import * as p from "../src/paths.ts";

/**
 * **Collecting a whole home** (phase 13.7): the daemon's own timer, and the
 * home-wide route.
 *
 * `gc.test.ts` next door owns the POLICY — what one canvas's sweep keeps and
 * what it reclaims — and nothing here re-tests it. These are tests of the two
 * enumerating callers: that the timer really fires and really reclaims bytes,
 * that it dies with `close()`, that one bad canvas costs only that canvas, and
 * that the route sweeps exactly what the calling badge is admitted to and not
 * one canvas more.
 *
 * Every sweep here is against a real daemon with real files: a test that
 * asserted "a function was called" would prove the wiring and not the chore.
 */

const alice = { id: "usr_alice", name: "Alice" };
const bob = { id: "usr_bob", name: "Bob" };

let home: string;
let daemon: Daemon | undefined;
let base: string;

afterEach(async () => {
  // Conditional because not every test in here starts a daemon: the boot-delay
  // question is a pure one, and a fixture that assumed a daemon would fail it
  // for a reason that has nothing to do with what it asserts.
  if (daemon) await daemon.close();
  daemon = undefined;
  if (home) await fs.rm(home, { recursive: true, force: true });
});

function baseOf(d: Daemon): string {
  const address = d.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function seedCanvas(badge: TestBadge, canvasId: string, actor = alice): Promise<void> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor,
      op: { type: "project.create", canvasId, title: "Acme" },
    }),
  });
  if (!res.ok) throw new Error(`could not create ${canvasId}: ${await res.text()}`);
}

/** An upload nothing references: garbage the moment it is out of grace. */
async function orphanBlob(badge: TestBadge, canvasId: string, body: string): Promise<string> {
  const res = await fetch(`${base}/api/projects/${canvasId}/blobs`, {
    method: "POST",
    headers: {
      "Content-Type": "text/markdown",
      "X-Isocan-Filename": "orphan.md",
      ...badge.headers,
    },
    body,
  });
  const { blobHash } = (await res.json()) as { blobHash: string };
  return blobHash;
}

/**
 * Backdate a canvas's blob bytes past the ten-minute grace period.
 *
 * The timer runs GC's DEFAULTS — that is the whole point of it, and a test
 * that reached in and set `graceMs: 0` would be measuring a policy no home
 * ever runs. A blob that is genuinely old is the honest way to be eligible,
 * and mtime is exactly what `FileStore.listBlobs` reports the age from.
 */
async function ageBlobs(canvasId: string, ms = 30 * 60 * 1000): Promise<void> {
  const dir = p.blobsDir(home, canvasId);
  const when = new Date(Date.now() - ms);
  for (const name of await fs.readdir(dir)) {
    await fs.utimes(path.join(dir, name), when, when);
  }
}

async function blobFileOf(canvasId: string, hash: string): Promise<string> {
  const index = JSON.parse(await fs.readFile(p.blobsIndexFile(home, canvasId), "utf8")) as Record<
    string,
    { file: string }
  >;
  return path.join(p.blobsDir(home, canvasId), index[hash]!.file);
}

async function exists(file: string): Promise<boolean> {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false);
}

/** Poll until true, or fail loudly — a sweep is asynchronous by nature and a
 * fixed sleep is either a flake or a slow suite. */
async function until(what: string, check: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for: ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("the home's own sweep, on a timer", () => {
  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-gc-timer-"));
  });

  it("fires by itself and reclaims bytes on every canvas the store holds", async () => {
    // Milliseconds instead of the hour a real home runs: this is what the
    // injectable interval exists for, and it is the only way a proof that the
    // timer FIRES can be measured rather than argued.
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 20 });
    base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(alice);

    await seedCanvas(badge, "prj_a");
    await seedCanvas(badge, "prj_b");
    const orphanA = await orphanBlob(badge, "prj_a", "# a\n");
    const orphanB = await orphanBlob(badge, "prj_b", "# b\n");
    await ageBlobs("prj_a");
    await ageBlobs("prj_b");

    const fileA = await blobFileOf("prj_a", orphanA);
    const fileB = await blobFileOf("prj_b", orphanB);
    // Nobody asked for this. No badge, no route, no request: the home is
    // collecting its own garbage on both canvases at once.
    await until("both orphans swept", async () => !(await exists(fileA)) && !(await exists(fileB)));
  });

  it("sweeps a home whose whole life is shorter than one interval", async () => {
    /**
     * **The defect this test exists for, and it was a live one.** The first
     * sweep used to be one full interval away, and the interval defaults to an
     * hour — while dev runs `MIN_INSTANCES=0` and Cloud Run reaps an idle
     * instance after about fifteen minutes. The mechanism would have run in
     * vitest and never once in production, and nothing would have said so:
     * green tests, and a silent log, because silence means "nothing to
     * collect".
     *
     * So: the REAL default interval, an hour, on a daemon that lives about a
     * second. If the only sweep is the interval's, nothing here is ever
     * collected.
     */
    // Garbage first, and left behind by a daemon that has already gone — which
    // is the shape scale-to-zero actually produces: the instance that made the
    // orphan is reaped, the bytes are not, and the collecting has to be done by
    // whichever instance comes next.
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 0 });
    base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await seedCanvas(badge, "prj_a");
    const orphan = await orphanBlob(badge, "prj_a", "# left behind\n");
    await ageBlobs("prj_a");
    const file = await blobFileOf("prj_a", orphan);
    await daemon.close();

    daemon = await startDaemon({
      port: 0,
      home,
      gcIntervalMs: 60 * 60 * 1000,
      gcFirstSweepMs: 25,
    });
    base = baseOf(daemon);
    await until("the boot sweep collected it", async () => !(await exists(file)), 2000);
  });

  it("puts the first sweep inside an instance's lifetime, not an interval away", () => {
    // The knob above is what a test can drive; this is what a home actually
    // ships with, so the proof is not merely "the option works". A minute is
    // inside the ~15 minutes an idle Cloud Run instance lingers; an hour is
    // not, and that is the whole reason the boot sweep exists.
    expect(firstSweepDelay(60 * 60 * 1000)).toBe(BOOT_SWEEP_MS);
    expect(BOOT_SWEEP_MS).toBeLessThan(15 * 60 * 1000);
    // A home told to sweep every ten seconds did not ask to wait a minute for
    // the first one.
    expect(firstSweepDelay(20)).toBe(20);
  });

  it("stops with close(), and never ticks again", async () => {
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 20 });
    base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await seedCanvas(badge, "prj_a");

    const swept = await orphanBlob(badge, "prj_a", "# swept while running\n");
    const survivor = await orphanBlob(badge, "prj_a", "# still fresh at close\n");
    const sweptFile = await blobFileOf("prj_a", swept);
    const survivorFile = await blobFileOf("prj_a", survivor);
    // Only the first is out of grace, so the running timer takes it and leaves
    // the second — which is what makes the second a clean witness.
    await fs.utimes(sweptFile, new Date(Date.now() - 30 * 60 * 1000), new Date(Date.now() - 30 * 60 * 1000));
    await until("the timer is demonstrably running", async () => !(await exists(sweptFile)));

    await daemon.close();

    // NOW make the survivor eligible. It became garbage only after the daemon
    // said it was shut, so a file still there after fifty intervals is a timer
    // that is really gone — not one that merely had nothing to do.
    await fs.utimes(survivorFile, new Date(Date.now() - 30 * 60 * 1000), new Date(Date.now() - 30 * 60 * 1000));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await exists(survivorFile)).toBe(true);
  });

  it("carries on past a canvas that throws, and ticks again after it", async () => {
    // The daemon's own timer is off (`0`), so the sweeper built below is the
    // only thing collecting anything and every observation belongs to it.
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 0 });
    base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await seedCanvas(badge, "prj_a");

    const first = await orphanBlob(badge, "prj_a", "# first\n");
    const firstFile = await blobFileOf("prj_a", first);
    await ageBlobs("prj_a");

    const logged: string[] = [];
    // A canvas id this daemon does not hold, FIRST in the list: `Engine.gc`
    // throws `CanvasNotFoundError` on it for real. The failure is a real one
    // from real code rather than a stubbed rejection, and it stands in for the
    // shape that matters on a hosted home — one canvas whose bytes cannot be
    // read while the rest are fine.
    const held = await daemon.store.listCanvases();
    const sweeper = startGcSweeper({
      engine: daemon.engine,
      canvases: async () => [{ ...held[0]!, id: "prj_ghost" }, ...held],
      intervalMs: 15,
      log: (message) => logged.push(message),
    });
    try {
      // The failure is reported once the sweep it happened in finishes, and
      // the bytes go during that same sweep — so wait for the later of the
      // two rather than assuming an order.
      await until("the sweep got past the bad canvas", async () => !(await exists(firstFile)));
      await until("the bad canvas was reported", async () =>
        logged.some((line) => line.includes("GC failed on prj_ghost")),
      );

      // And a tick that met a failure does not end the timer: a second orphan,
      // created after the first sweep, is collected by a later one.
      const second = await orphanBlob(badge, "prj_a", "# second\n");
      const secondFile = await blobFileOf("prj_a", second);
      await ageBlobs("prj_a");
      await until("a later tick swept the second orphan", async () => !(await exists(secondFile)));
    } finally {
      await sweeper.stop();
    }
  });
});

describe("when the first sweep happens", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * **The wiring, on fake time, because the real answer is a minute and no
   * test may wait one.** The two tests either side of this prove that a
   * daemon told to sweep early does, and that the DERIVED delay is inside an
   * instance's lifetime; neither proves the sweeper actually uses the
   * derivation when nobody hands it a number. This does — and it is the one
   * that fails if the first sweep goes back to being one interval away.
   */
  it("defaults to a minute after start, not to the interval", async () => {
    vi.useFakeTimers();
    let sweeps = 0;
    const sweeper = startGcSweeper({
      engine: { gc: async () => { throw new Error("no canvases, so never asked"); } },
      canvases: async () => {
        sweeps += 1;
        return [];
      },
      intervalMs: 60 * 60 * 1000,
    });
    await vi.advanceTimersByTimeAsync(59_000);
    expect(sweeps).toBe(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(sweeps).toBe(1);
    // And then the ordinary rhythm: the next one is an interval away, not
    // another minute.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sweeps).toBe(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(sweeps).toBe(2);
    await sweeper.stop();
  });
});

describe("the sweeper's own lifetime", () => {
  /**
   * `stop()` is a SHUTDOWN GUARANTEE, not tidiness: a sweep is a writer, and
   * `daemon.close()` awaits this before it closes the store the sweep is
   * writing to. These are stubbed at the policy (a slow `gc`, so "still
   * running" is something a test can stand inside) and real everywhere the
   * question actually lives — the timer, the re-arm, and `stop()` itself.
   *
   * **The regression this pins.** The sweeper used to be a `setInterval` that
   * assigned `inFlight = sweep()` on every tick, and `sweep()` opened by
   * returning early when one was already running. A tick that arrived mid-sweep
   * therefore replaced `inFlight` with an already-resolved promise, and `stop()`
   * awaited that one — returning while a sweep was mid-write, which is exactly
   * the thing it promises not to do. An interval of 10ms against a sweep of
   * 120ms is that condition, held open.
   */
  let gcCalls = 0;
  let finished = 0;
  const slowEngine = {
    gc: async () => {
      gcCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 120));
      finished += 1;
      return {
        dryRun: false,
        retainedEntries: 0,
        droppedEntries: 0,
        reachableBlobs: 0,
        reachableBytes: 0,
        sweptBlobs: 0,
        sweptBytes: 0,
        skippedRecentBlobs: 0,
      };
    },
  };

  beforeEach(async () => {
    gcCalls = 0;
    finished = 0;
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-gc-life-"));
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 0 });
    base = baseOf(daemon);
    const badge = await mintTestBadge(base);
    await badge.speakAs(alice);
    await seedCanvas(badge, "prj_a");
  });

  it("stop() does not return while a sweep is still writing", async () => {
    const canvases = () => daemon!.store.listCanvases();
    const sweeper = startGcSweeper({ engine: slowEngine, canvases, intervalMs: 10, firstSweepMs: 5 });
    await until("a sweep is under way", async () => gcCalls > 0);
    expect(finished).toBe(0); // we are standing inside one

    await sweeper.stop();
    // Not "eventually" — by the time stop() resolves. A resolved-promise await
    // would have come back here with `finished` still 0.
    expect(finished).toBe(1);

    // And nothing starts after it: the re-arm is what `stopped` cancels.
    const after = gcCalls;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(gcCalls).toBe(after);
  });

  it("stop() is safe twice, and safe before anything has fired", async () => {
    const canvases = () => daemon!.store.listCanvases();
    const early = startGcSweeper({ engine: slowEngine, canvases, intervalMs: 50_000 });
    await early.stop(); // nothing has swept yet — there is a pending timer and no promise
    await early.stop(); // and calling it again is not an error
    expect(gcCalls).toBe(0);

    const swept = startGcSweeper({ engine: slowEngine, canvases, intervalMs: 10, firstSweepMs: 5 });
    await until("a sweep is under way", async () => gcCalls > 0);
    await swept.stop();
    await swept.stop();
    expect(finished).toBe(1);
  });
});

describe("POST /api/gc", () => {
  let alice_: TestBadge;
  let bob_: TestBadge;

  async function sweep(badge: TestBadge, request: GcRequest = {}): Promise<HomeGcReport> {
    const res = await fetch(`${base}/api/gc`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify(request),
    });
    expect(res.status).toBe(200);
    return (await res.json()) as HomeGcReport;
  }

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-gc-home-"));
    // No timer: this describe is about what the ROUTE sweeps, and a background
    // sweep collecting the same bytes would make every assertion here ambiguous.
    daemon = await startDaemon({ port: 0, home, gcIntervalMs: 0 });
    base = baseOf(daemon);
    alice_ = await mintTestBadge(base);
    await alice_.speakAs(alice);
    bob_ = await mintTestBadge(base);
    await bob_.speakAs(bob);
  });

  it("aggregates across every canvas the badge is admitted to", async () => {
    await seedCanvas(alice_, "prj_a");
    await seedCanvas(alice_, "prj_b");
    await orphanBlob(alice_, "prj_a", "# a\n");
    await orphanBlob(alice_, "prj_b", "# b\n");

    const report = await sweep(alice_, { graceMs: 0 });
    expect(report.canvases.map((row) => row.canvasId).sort()).toEqual(["prj_a", "prj_b"]);
    // The totals are the per-canvas reports added up, which is the only thing
    // a home-wide report can honestly mean.
    expect(report.totals.sweptBlobs).toBe(2);
    expect(report.canvases.every((row) => row.report?.sweptBlobs === 1)).toBe(true);
    expect(report.totals.sweptBytes).toBeGreaterThan(0);
  });

  it("sweeps only what the calling badge is admitted to", async () => {
    // Two badges, two canvases, and no acquaintance between them. Alice never
    // touches Bob's canvas and Bob never touches hers.
    await seedCanvas(alice_, "prj_a");
    const hers = await orphanBlob(alice_, "prj_a", "# hers\n");
    await seedCanvas(bob_, "prj_b", bob);
    await orphanBlob(bob_, "prj_b", "# his\n");

    const report = await sweep(bob_, { graceMs: 0 });
    // `/api/gc` carries no canvas in its path, so the `onRequest` hook's
    // admission check does not fire on it. If the route swept the store's own
    // list, this is the assertion that would fail — and it would fail as a
    // badge deleting another badge's bytes.
    expect(report.canvases.map((row) => row.canvasId)).toEqual(["prj_b"]);
    expect(report.totals.sweptBlobs).toBe(1);

    // Her bytes, asked for with HER badge: reading it with Bob's would admit
    // him to her canvas through the link grant and change what the next line
    // is even measuring.
    const still = await fetch(`${base}/api/projects/prj_a/blobs/${hers}`, {
      headers: alice_.headers,
    });
    await still.arrayBuffer().catch(() => {});
    expect(still.status).toBe(200);
    expect(await exists(await blobFileOf("prj_a", hers))).toBe(true);
  });

  it("refuses a badge-less caller like every other route", async () => {
    const res = await fetch(`${base}/api/gc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
  });
});
