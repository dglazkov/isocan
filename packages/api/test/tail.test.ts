import { afterEach, beforeEach, describe, expect, it } from "vitest";
import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { newCanvasId } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { ApiError, DaemonClient, connect, harnessVars, type CanvasHandle, type TailEntry } from "@isocan/api";

/**
 * **`tail()`, held to what journey 2 forces** (iso-api phase 3): the log as an
 * async iterator with the cursor in the caller's hand — `{ since }` in, each
 * entry's `seq` out, resuming across a killed consumer and a restarted daemon
 * on that seq alone. And the standing lesson inherited from auto-upgrade,
 * asserted rather than assumed: a dropped connection is a pause, never an
 * entry — a reconnect yields nothing, and only ops that actually landed do.
 *
 * House idiom: a real daemon, restarted for real on its own port. No mocks —
 * the behavior under test is precisely what only a real socket can refuse.
 */

let home: string;
let work: string;
let daemon: Daemon;
let port: number;
let base: string;
let cwdBefore: string;
/** Every tail in a test carries this signal, so a failed assertion cannot
 * leave a generator polling (and re-spawning daemons) behind the suite. */
let stop: AbortController;
const saved: Record<string, string | undefined> = {};

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tail-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tail-work-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  stop = new AbortController();
  saved.ISOCAN_HOME = process.env.ISOCAN_HOME;
  process.env.ISOCAN_HOME = home;
  for (const v of harnessVars) {
    saved[v] = process.env[v];
    delete process.env[v];
  }
  saved.ISOCAN_DIRECT = process.env.ISOCAN_DIRECT;
  delete process.env.ISOCAN_DIRECT;
  cwdBefore = process.cwd();
  process.chdir(work);
});

afterEach(async () => {
  stop.abort();
  process.chdir(cwdBefore);
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await daemon.close().catch(() => {});
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

/** A canvas with its handle and a way to write to it as somebody else. */
async function opened(): Promise<{
  canvas: CanvasHandle;
  write: (title: string) => Promise<number>;
}> {
  const client = new DaemonClient(base, home);
  await client.claimActor({
    type: "actor.claim",
    sessionKey: "acme:acme-watch",
    name: "Watcher",
  });
  // The other hand: an actor of its own, so the tail hears somebody else.
  const other = (
    await client.claimActor({ type: "actor.claim", sessionKey: "acme:acme-other", name: "Other" })
  ).envelope.actor;
  const h = await connect({ port, identity: { session: "acme-watch", harness: "acme" } });
  const canvasId = newCanvasId();
  await h.ctx.client.sendOp(null, h.actor, {
    type: "project.create",
    canvasId,
    title: "Acme Panels",
  });
  const canvas = await h.canvas(canvasId);
  // Each write hands back the seq it landed at — the ruler every assertion
  // below measures against.
  const write = async (title: string) => {
    const { seq } = await client.sendOp(canvasId, other, {
      type: "project.update",
      patch: { title },
    });
    return seq;
  };
  return { canvas, write };
}

/** The next yield, with a name for the timeout instead of a hang. */
async function nextOf(
  iterator: AsyncGenerator<TailEntry>,
  what: string,
  ms = 15_000,
): Promise<TailEntry> {
  const result = await Promise.race([
    iterator.next(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms),
    ),
  ]);
  if (result.done) throw new Error(`the tail ended while waiting for ${what}`);
  return result.value;
}

describe("canvas.tail()", () => {
  it("since is exclusive, entries arrive in order, and each carries its seq", async () => {
    const { canvas, write } = await opened();
    const first = await write("one");
    const second = await write("two");

    const seen: TailEntry[] = [];
    for await (const entry of canvas.tail({ since: 0, signal: stop.signal })) {
      seen.push(entry);
      if (entry.seq === second) break;
    }
    // The whole live log replays from 0 — creation included — in seq order,
    // contiguous, and the flattened opType is the envelope's own.
    expect(seen.map((e) => e.seq)).toEqual(seen.map((_, i) => seen[0]!.seq + i));
    expect(seen[0]!.opType).toBe("project.create");
    expect(seen.at(-1)!.opType).toBe("project.update");
    expect(seen.at(-1)!.envelope.op).toMatchObject({ patch: { title: "two" } });
    expect(seen.some((e) => e.seq === first)).toBe(true);
  });

  it("kill after entry N, resume with N: the first entry yielded is N+1", async () => {
    const { canvas, write } = await opened();
    await write("one");
    const n = await write("two");

    // The first consumer reads through N, then dies (return(), the orderly
    // spelling of a kill — the cursor lives outside it either way).
    const one = canvas.tail({ since: 0, signal: stop.signal });
    let last = 0;
    for await (const entry of one) {
      last = entry.seq;
      if (entry.seq === n) break;
    }
    expect(last).toBe(n);

    // The world moves while nobody is listening…
    const third = await write("three");
    const fourth = await write("four");

    // …and the resume is the seq alone: no --since folklore, no daemon-side
    // row, just the last handled entry handed back.
    const two = canvas.tail({ since: n, signal: stop.signal });
    const resumed = await nextOf(two, "the first entry after N");
    expect(resumed.seq).toBe(n + 1);
    expect(resumed.seq).toBe(third);
    const after = await nextOf(two, "the entry after N+1");
    expect(after.seq).toBe(fourth);
    await two.return(undefined);
  });

  it("a daemon restart mid-poll is a pause, not an entry", async () => {
    const { canvas, write } = await opened();
    const before = await write("before");

    const tail = canvas.tail({ since: before, signal: stop.signal });
    // Park the tail in a held poll, then restart the daemon under it.
    const pending = nextOf(tail, "the first entry after the restart", 20_000);
    await new Promise((r) => setTimeout(r, 200));
    await daemon.close();
    daemon = await startDaemon({ port, home });

    // The reconnect itself must surface as NOTHING. The only way to prove a
    // negative here is to land a real entry and see it arrive alone, seq
    // contiguous with the last one before the restart — a phantom wake would
    // either resolve `pending` before this write or break the chain.
    const after = await write("after");
    const woke = await pending;
    expect(woke.seq).toBe(after);
    expect(woke.seq).toBe(before + 1);
    expect(woke.opType).toBe("project.update");

    // And the tail is still live on the restarted daemon: the next write is
    // the next yield, exactly once.
    const again = await write("again");
    expect((await nextOf(tail, "the entry after the restart survivor")).seq).toBe(again);
    await tail.return(undefined);
  });

  it("with no since, the tail starts at the tip — history is not replayed", async () => {
    const { canvas, write } = await opened();
    await write("history");

    const tail = canvas.tail({ signal: stop.signal });
    const pending = nextOf(tail, "the first live entry");
    // The seed races the writes on purpose: keep landing fresh ops until the
    // tail wakes, then check it woke for one of THOSE, never for history.
    let done = false;
    const writes: number[] = [];
    void pending.then(
      () => (done = true),
      () => (done = true),
    );
    while (!done) {
      writes.push(await write(`live ${writes.length}`));
      await new Promise((r) => setTimeout(r, 150));
    }
    const first = await pending;
    expect(writes).toContain(first.seq);
    expect((first.envelope.op as { patch: { title: string } }).patch.title).toMatch(/^live /);
    await tail.return(undefined);
  });

  it("a refusal is thrown, not retried — an ApiError means somebody said no", async () => {
    const { canvas } = await opened();
    await daemon.close();
    // Somebody IS there, and they say no: a server that answers the port with
    // a refusal, which must end the tail rather than joining the retry loop a
    // silent socket gets.
    const refuser = http.createServer((_req, res) => {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    });
    await new Promise<void>((resolve) => refuser.listen(port, "127.0.0.1", resolve));
    try {
      const tail = canvas.tail({ since: 0, signal: stop.signal });
      const refusal = await tail.next().then(
        () => null,
        (err: unknown) => err,
      );
      expect(refusal).toBeInstanceOf(ApiError);
      expect((refusal as ApiError).status).toBe(404);
    } finally {
      refuser.closeAllConnections();
      await new Promise<void>((resolve) => refuser.close(() => resolve()));
    }
  });

  it("aborting the signal ends the iteration cleanly, even from inside a held poll", async () => {
    const { canvas, write } = await opened();
    const since = await write("quiet");
    const tail = canvas.tail({ since, signal: stop.signal });
    const pending = tail.next();
    await new Promise((r) => setTimeout(r, 200));
    stop.abort();
    const result = await Promise.race([
      pending,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("the abort did not end the held poll")), 5_000),
      ),
    ]);
    expect(result.done).toBe(true);
  });
});
