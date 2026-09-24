import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { LogEntry } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { WriterChains } from "../src/writers.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **One writer queue per canvas.**
 *
 * The engine used to serialize every write on the daemon through one promise
 * chain, and a forwarded write holds its turn across the round trip to its
 * home. So one slow home paused every write on the machine — canvases homed
 * right here included. On 24 Sep 2026 a blob check held that chain for about
 * four minutes and every `isocan set` on the laptop waited behind it (lessons
 * #95); taking the chores off the chain fixed that instance, and this is the
 * structural half: each canvas has its own queue.
 *
 * Two real daemons. The replica holds one canvas homed HERE (`prj_local`) and
 * one homed at the other daemon (`prj_remote`); the home's socket is tapped so
 * a request can be held open, which is what a slow home looks like from the
 * replica.
 */

const LOCAL = "prj_local";
const REMOTE = "prj_remote";
const DION = { id: "usr_dion", name: "Dion" };

let homeDir: string;
let repDir: string;
let home: Daemon;
let replica: Daemon;
let repBadge: TestBadge;

const baseOf = (d: Daemon) => {
  const a = d.app.server.address();
  return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
};

const post = (body: unknown) =>
  fetch(`${baseOf(replica)}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...repBadge.headers },
    body: JSON.stringify(body),
  });

const rename = (canvasId: string, title: string) =>
  post({ canvasId, actor: DION, op: { type: "project.update", patch: { title } } }).then((res) => res.status);

/** `p`, or "stalled" if it has not settled within `ms`. */
const within = <T,>(p: Promise<T>, ms = 3000) =>
  Promise.race([p, new Promise<"stalled">((r) => setTimeout(() => r("stalled"), ms))]);

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-wq-home-"));
  repDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-wq-rep-"));
  home = await startDaemon({ port: 0, home: homeDir });
  const homeBadge = await mintTestBadge(baseOf(home));
  await homeBadge.speakAs({ id: "usr_home", name: "Home" });
  // No birth default: a canvas born here stays here unless its create names
  // a home — which is how one daemon comes to hold both kinds at once.
  replica = await startDaemon({ port: 0, home: repDir, homePollMs: 50 });
  repBadge = await mintTestBadge(baseOf(replica));
  await repBadge.speakAs(DION);
  const local = await post({ canvasId: null, actor: DION, op: { type: "project.create", canvasId: LOCAL, title: "Local" } });
  expect(local.status, await local.clone().text()).toBe(200);
  const remote = await post({
    canvasId: null,
    actor: DION,
    home: baseOf(home),
    op: { type: "project.create", canvasId: REMOTE, title: "Remote" },
  });
  expect(remote.status, await remote.clone().text()).toBe(200);
  expect(replica.homes.for(LOCAL), "prj_local must be homed on the replica").toBeNull();
  expect(replica.homes.for(REMOTE), "prj_remote must be homed at the other daemon").not.toBeNull();
});

afterEach(async () => {
  await replica?.close();
  await home?.close();
  await Promise.allSettled(
    [homeDir, repDir].map((d) => fs.rm(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })),
  );
});

describe("a write to one canvas never waits on another canvas's home", () => {
  it("lands a local write while a write to a remote canvas is held at its home", async () => {
    const { asked, release, heard } = tapHome(home).hold(/^POST \/api\/ops$/);
    const held = rename(REMOTE, "Remote, slowly");
    await asked;

    const outcome = await within(rename(LOCAL, "Local, promptly"));
    // Its own queue is idle; every queue together is not.
    const own = await within(replica.engine.settled(LOCAL), 500);
    const all = await within(replica.engine.settled(), 300);
    release();

    expect(outcome, "the local write waited on another canvas's round trip to its home").toBe(200);
    expect(own, "settled(prj_local) waited on prj_remote's queue").toBeUndefined();
    expect(all, "settled() is every queue, so it must wait for the held write").toBe("stalled");
    expect(await held).toBe(200);
    await replica.engine.settled();
    expect(heard().length).toBeGreaterThan(0);
    expect((await replica.engine.getSnapshot(LOCAL)).project.title).toBe("Local, promptly");
    expect((await replica.engine.getSnapshot(REMOTE)).project.title).toBe("Remote, slowly");
  });

  it("lands an identity write (a claim) while a remote canvas's write is held", async () => {
    const { asked, release } = tapHome(home).hold(/^POST \/api\/ops$/);
    const held = rename(REMOTE, "Remote, slowly");
    await asked;
    const stranger = await mintTestBadge(baseOf(replica));
    const claimed = await within(stranger.speakAs({ id: "usr_kim", name: "Kim" }).then(() => "claimed" as const));
    release();
    expect(claimed, "a claim waited on a canvas's round trip to its home").toBe("claimed");
    expect(await held).toBe(200);
  });
});

describe("writes within one canvas stay strictly ordered", () => {
  it("numbers concurrent writes to a local canvas in the order they were asked", async () => {
    const titles = Array.from({ length: 12 }, (_, i) => `Local ${i}`);
    const entries = await Promise.all(
      titles.map((title) =>
        replica.engine.submit({ canvasId: LOCAL, actor: DION, badgeId: repBadge.badgeId, op: { type: "project.update", patch: { title } } }),
      ),
    );
    const seqs = entries.map((entry) => entry.seq);
    expect(seqs).toEqual(seqs.map((_, i) => seqs[0]! + i));
    expect((await replica.engine.getSnapshot(LOCAL)).project.title).toBe("Local 11");
    const log = await replica.engine.getLog(LOCAL, seqs[0]! - 1);
    expect(log.map((entry) => (entry.envelope.op as { patch: { title: string } }).patch.title)).toEqual(titles);
  });

  it("queues a remote canvas's writes behind the held one, and lands them in order", async () => {
    const tap = tapHome(home);
    const { asked, release } = tap.hold(/^POST \/api\/ops$/);
    const titles = ["Remote 0", "Remote 1", "Remote 2", "Remote 3", "Remote 4"];
    const pending = titles.map((title) =>
      replica.engine.submit({ canvasId: REMOTE, actor: DION, badgeId: repBadge.badgeId, op: { type: "project.update", patch: { title } } }),
    );
    await asked;
    // A write to another canvas meanwhile, to prove the queue is the canvas's.
    expect(await within(rename(LOCAL, "Local, meanwhile"))).toBe(200);
    // Only the first has reached the home: the rest wait their turn on the
    // canvas's queue rather than racing each other up the wire.
    const forwards = tap.heard().filter((line) => line === "POST /api/ops");
    release();
    const entries: LogEntry[] = await Promise.all(pending);
    expect(forwards.length, "the remote canvas's writes went up in parallel").toBe(1);
    const seqs = entries.map((entry) => entry.seq);
    expect(seqs).toEqual(seqs.map((_, i) => seqs[0]! + i));
    expect((await replica.engine.getSnapshot(REMOTE)).project.title).toBe("Remote 4");
    expect((await home.engine.getSnapshot(REMOTE)).project.title).toBe("Remote 4");
  });
});

describe("an act that spans canvases waits for them, and nothing deadlocks", () => {
  it("runs a whole-daemon act after the held canvas and before what was asked after it", async () => {
    const { asked, release } = tapHome(home).hold(/^POST \/api\/ops$/);
    const order: string[] = [];
    const submit = (canvasId: string, title: string) =>
      replica.engine.submit({ canvasId, actor: DION, badgeId: repBadge.badgeId, op: { type: "project.update", patch: { title } } });
    const held = submit(REMOTE, "Remote, slowly").then(() => order.push("remote"));
    await asked;
    // A personal birth cannot name its canvases up front, so it takes the
    // whole writer — it must wait for the held write, not run beside it.
    const whole = replica.engine.personalWrite(async () => { order.push("whole"); });
    const after = submit(LOCAL, "Local, after").then(() => order.push("local"));
    expect(await within(whole, 300), "the whole-daemon act ran beside a held canvas write").toBe("stalled");
    expect(await within(after, 300), "a write asked after the whole-daemon act overtook it").toBe("stalled");
    release();
    expect(await within(Promise.all([held, whole, after]))).not.toBe("stalled");
    expect(order).toEqual(["remote", "whole", "local"]);
  });

  it("takes several queues at once in any order without deadlocking, and a failure releases them", async () => {
    const chains = new WriterChains();
    const order: string[] = [];
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const step = (name: string, wait?: Promise<void>) => async () => { if (wait) await wait; order.push(name); };
    const tasks = [
      chains.run(["canvas:a"], step("a1", gate)),
      chains.run(["canvas:b", "canvas:a"], step("ba")),
      chains.run(["canvas:a", "canvas:b"], step("ab")),
      chains.run(["canvas:b"], async () => { order.push("b-throws"); throw new Error("boom"); }),
      chains.run(["canvas:c"], step("c")),
      chains.run(["canvas:b"], step("b2")),
    ];
    // Only `c` is independent of the held `a1`.
    await within(tasks[4]!, 1000);
    expect(order).toEqual(["c"]);
    open();
    const settled = await within(Promise.allSettled(tasks));
    expect(settled, "the multi-key tasks deadlocked").not.toBe("stalled");
    expect(order).toEqual(["c", "a1", "ba", "ab", "b-throws", "b2"]);
    expect(await within(chains.idle())).toBeUndefined();
  });
});

describe("undo and op groups are what they were", () => {
  it("undoes a whole gesture in one step and redoes it, while another canvas is held", async () => {
    const { asked, release } = tapHome(home).hold(/^POST \/api\/ops$/);
    const held = rename(REMOTE, "Remote, slowly");
    await asked;
    const gesture = await Promise.all(
      ["A", "B", "C"].map((title) =>
        replica.engine.submit({ canvasId: LOCAL, actor: DION, badgeId: repBadge.badgeId, group: "gesture-1", op: { type: "project.update", patch: { title } } }),
      ),
    );
    expect(gesture.map((entry) => entry.group)).toEqual(["gesture-1", "gesture-1", "gesture-1"]);
    const undone = await within(replica.engine.undo(LOCAL, DION, repBadge.badgeId));
    expect(undone, "undo on a local canvas waited on another canvas's home").not.toBe("stalled");
    expect((await replica.engine.getSnapshot(LOCAL)).project.title).toBe("Local");
    const undos = (await replica.engine.getLog(LOCAL, gesture[2]!.seq)).map((entry) => entry.cause);
    expect(undos).toEqual([
      { kind: "undo", targetSeq: gesture[2]!.seq },
      { kind: "undo", targetSeq: gesture[1]!.seq },
      { kind: "undo", targetSeq: gesture[0]!.seq },
    ]);
    await replica.engine.redo(LOCAL, DION, repBadge.badgeId);
    expect((await replica.engine.getSnapshot(LOCAL)).project.title).toBe("C");
    release();
    expect(await held).toBe(200);
  });
});

/**
 * Wraps the home's own `request` listener so a request can be held until
 * released — a slow home, as the replica sees it — and so the test can count
 * what reached it. The same tap `reconcile.test.ts` uses.
 */
function tapHome(d: Daemon) {
  const server = d.app.server;
  const inner = server.listeners("request") as Array<(req: IncomingMessage, res: ServerResponse) => void>;
  server.removeAllListeners("request");
  const heard: string[] = [];
  let hold: { gate: Promise<void>; asked: () => void; match: RegExp } | null = null;
  server.on("request", (req: IncomingMessage, res: ServerResponse) => {
    heard.push(`${req.method} ${req.url}`);
    const pass = () => { for (const listener of inner) listener.call(server, req, res); };
    if (hold && hold.match.test(`${req.method} ${req.url}`)) {
      hold.asked();
      void hold.gate.then(pass);
      return;
    }
    pass();
  });
  const tap = {
    heard: () => [...heard],
    hold: (match: RegExp) => {
      let release!: () => void;
      let asked!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const askedOnce = new Promise<void>((r) => (asked = r));
      hold = { gate, asked, match };
      return { asked: askedOnce, heard: tap.heard, release: () => { hold = null; release(); } };
    },
  };
  return tap;
}
