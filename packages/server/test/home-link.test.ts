import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CanvasSnapshotResponse,
  LogEntry,
  GrantsResponse,
  MintPassResponse,
  Operation,
  PresenceSession,
  Canvas,
} from "@isocan/core";
import {
  grantRoute,
  grantsRoute,
  HOME_JOIN_ROUTE,
  PASS_REDEEM_ROUTE,
  passesRoute,
  canvasesRoute,
} from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { bearerHeader, readBadge } from "../src/badge-store.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * Phase 6's Proof, first half: **integration tests with two `ISOCAN_HOME`s
 * against a home.**
 *
 * Three daemons in one process, each with its own isocan home directory:
 *
 * - **H**, the home. No home address, so it serves pages and is the single
 *   writer of every canvas here.
 * - **A** and **B**, two replicas pointed at H. Each is a complete daemon —
 *   its own store, its own desk, its own badges — that has been DEMOTED: it
 *   forwards every write to H and applies what comes back with H's seqs
 *   verbatim.
 *
 * This is Scene 0's shape ("solo is the multiuser topology with one member",
 * and multi-device falls out) plus Scene 4's beat 7, the lid close. Three
 * daemons in one process rather than three spawned CLIs on purpose: the thing
 * under test is what the daemons say to each other, and an in-process test can
 * ask a replica what handshake it actually got — which is the assertion the
 * phase turns on and which no amount of CLI output would show.
 */

const priya = { id: "usr_priya", name: "Priya" };
const isaac = { id: "usr_isaac", name: "Isaac" };

const CANVAS = "prj_acme";

interface Node {
  daemon: Daemon;
  base: string;
  badge: TestBadge;
  dir: string;
}

let homeDir: string;
let aDir: string;
let bDir: string;
let H: Node;
let A: Node;
let B: Node;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

/** A replica: its own home directory, pointed at H, polling fast enough that
 * a test does not spend seconds waiting for a canvas list to be re-read. */
async function replica(dir: string, homeUrl: string): Promise<Daemon> {
  return startDaemon({ port: 0, home: dir, birthHome: homeUrl, homePollMs: 50 });
}

async function node(daemon: Daemon, dir: string, actor: { id: string; name: string }): Promise<Node> {
  const base = baseOf(daemon);
  const badge = await mintTestBadge(base);
  await badge.speakAs(actor);
  return { daemon, base, badge, dir };
}

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-home-"));
  aDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-a-"));
  bDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-b-"));
  H = await node(await startDaemon({ port: 0, home: homeDir }), homeDir, {
    id: "usr_home",
    name: "Home",
  });
  A = await node(await replica(aDir, H.base), aDir, priya);
  B = await node(await replica(bDir, H.base), bDir, isaac);
});

afterEach(async () => {
  await Promise.allSettled([A?.daemon.close(), B?.daemon.close()]);
  await H?.daemon.close();
  await Promise.allSettled(
    [homeDir, aDir, bDir].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

// ---- talking to a daemon ----

async function post(node: Node, url: string, body: unknown): Promise<Response> {
  return fetch(`${node.base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...node.badge.headers },
    body: JSON.stringify(body),
  });
}

async function op(
  node: Node,
  actor: { id: string; name: string },
  operation: Operation,
  canvasId: string | null = CANVAS,
): Promise<{ seq: number }> {
  const res = await post(node, "/api/ops", { canvasId, actor, op: operation });
  if (!res.ok) throw new Error(`${operation.type} refused by ${node.base}: ${await res.text()}`);
  return (await res.json()) as { seq: number };
}

async function get<T>(node: Node, url: string): Promise<T> {
  const res = await fetch(`${node.base}${url}`, { headers: node.badge.headers });
  if (!res.ok) throw new Error(`GET ${url} on ${node.base}: ${res.status}`);
  return (await res.json()) as T;
}

const canvas = (node: Node) => get<CanvasSnapshotResponse>(node, `/api/projects/${CANVAS}/canvas`);
const canvases = (node: Node) => get<Canvas[]>(node, "/api/projects");
const oplog = (node: Node) => get<LogEntry[]>(node, `/api/projects/${CANVAS}/oplog?since=0`);
const roster = (node: Node) =>
  get<PresenceSession[]>(node, `/api/projects/${CANVAS}/sessions`);

/** Replication is asynchronous by construction — a socket hop each way — so
 * every cross-daemon assertion polls. A fixed sleep would either be flaky or
 * be slower than the whole suite deserves. */
async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await fn().catch(() => null as T | null);
    if (value !== null && ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

const nv = (id: string) => ({
  id,
  blobHash: `h_${id}`,
  mimeType: "text/markdown",
  filename: `${id}.md`,
  size: 4,
});

/** The canvas, born through A. Because writes forward, this one call makes it
 * exist AT THE HOME; nothing else is done to arrange that. */
async function birthAtA(): Promise<void> {
  await op(
    A,
    priya,
    { type: "project.create", canvasId: CANVAS, title: "Acme Sprint Board" },
    null,
  );
  await op(A, priya, {
    type: "item.add",
    itemId: "itm_1",
    version: nv("ver_1"),
    width: 100,
    height: 80,
    placement: { x: 5, y: 6 },
  });
}

/**
 * **B is LET IN, which since phase 8 stage 4 is the only way it gets there.**
 *
 * Until that stage this helper did not exist and nothing stood in for it: B
 * discovered the canvas by enumerating H, because the canvas's standing link
 * grant would admit anybody and the home listed it to any badge that asked.
 * That is discovery by enumeration — phase 7 named it the wrong primitive —
 * and the same mechanism put a stranger's canvas on a laptop whenever a link
 * happened to be on.
 *
 * So a replica now mirrors what it was let into, and being let in is a pass:
 * minted at the home for this one canvas, redeemed through B's own daemon,
 * which forwards it (the row belongs to the desk that answers the door) and
 * comes back admitted. Every test below that waits for B to hold this canvas
 * says so with this line, and the ones that do not are asserting the opposite.
 *
 * The admission-only form — no `actorId` — because B already speaks as Isaac
 * and the identity half of a pass is Scene 5's, tested where it belongs.
 */
async function letBIn(): Promise<void> {
  const minted = await post(H, passesRoute(CANVAS), {});
  if (!minted.ok) throw new Error(`minting a pass at the home: ${await minted.text()}`);
  const { token } = (await minted.json()) as MintPassResponse;
  const redeemed = await post(B, PASS_REDEEM_ROUTE, { token });
  if (!redeemed.ok) throw new Error(`redeeming that pass at B: ${await redeemed.text()}`);
}

describe("a canvas born on a replica is born at the home", () => {
  it("exists at H, and reaches a B that was let in", async () => {
    await birthAtA();

    // At the home, because the write went there — not because anything
    // afterwards pushed it.
    const atHome = await canvases(H);
    expect(atHome.map((canvas) => canvas.id)).toEqual([CANVAS]);
    expect(atHome[0]!.title).toBe("Acme Sprint Board");

    // And at the OTHER replica, which never heard of it from anyone but H.
    // This is Scene 0's last line — "her laptop and her desktop show the same
    // canvas" — with the two laptops being A and B, and Scene 5's pass as what
    // makes the second one hers. See `letBIn`.
    await letBIn();
    const seen = await until(
      () => canvases(B),
      (list) => list.some((canvas) => canvas.id === CANVAS),
      "the canvas to reach B",
    );
    expect(seen.find((canvas) => canvas.id === CANVAS)!.title).toBe("Acme Sprint Board");
  }, 20_000);

  it("does NOT reach a B that was never let in, link grant or no link grant", async () => {
    /**
     * The regression phase 8 stage 4 exists to make impossible, asserted from
     * the far side.
     *
     * This canvas carries the standing LINK grant every canvas is born with,
     * and B's badge at the home can present the address any time it likes. It
     * is still not B's canvas: nobody handed it to this machine. Before this
     * stage the home listed it to B's badge anyway, B's sweep dialled it, and
     * a second person's laptop started mirroring somebody else's work because
     * a link happened to be on.
     *
     * A settled wait rather than one poll, because the failure this guards
     * against is asynchronous: the sweep runs every 50ms in these fixtures, so
     * a bare assertion would pass against the old behaviour purely by being
     * fast. Two seconds is forty sweeps.
     */
    await birthAtA();
    await until(() => canvas(A), (snap) => snap.lastSeq === 2, "A to settle");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(await B.daemon.engine.listCanvases()).toEqual([]);
    expect(await canvases(B)).toEqual([]);
    // And the home is not hiding it — it is there, and A holds it. What
    // changed is only what B is told when it asks what it carries.
    expect((await canvases(H)).map((canvas) => canvas.id)).toEqual([CANVAS]);
  }, 20_000);

  it("carries the same seqs, in the same order, on the replica that was there", async () => {
    await birthAtA();
    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });

    const atHome = await oplog(H);
    expect(atHome.map((entry) => entry.seq)).toEqual([1, 2, 3]);

    const theirs = await until(
      () => oplog(A),
      (entries) => entries.length === 3,
      "the whole log at A",
    );
    // Same seqs, same order, same ops, same op ids. A replica that renumbered
    // would still converge on state and would make every seq cursor
    // meaningless — which is why this asserts the numbers and not the picture.
    expect(theirs.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(theirs.map((entry) => entry.envelope.op.type)).toEqual(
      atHome.map((entry) => entry.envelope.op.type),
    );
    expect(theirs.map((entry) => entry.envelope.id)).toEqual(
      atHome.map((entry) => entry.envelope.id),
    );
  }, 20_000);

  it("gives a replica that arrived late the state, and history only from its arrival", async () => {
    /**
     * Worth pinning because it is a real and slightly surprising consequence
     * rather than an oversight.
     *
     * B has never held this canvas, so the only honest cursor it can present
     * is 0, and the only possible answer is a snapshot — the same answer a
     * fresh browser tab gets. A snapshot is STATE; it carries no ops. So B's
     * local live log starts at its arrival, and everything before that lives
     * only at the home (and at whichever replica was there when it happened).
     *
     * Nothing downstream needs it: undo and redo are the home's on a replica
     * (its stacks are rebuilt from ITS log), state converges exactly, and
     * `isocan wait`/`tail` are cursor-based and start from now. The line this
     * draws is that a replica's oplog is a cache of the home's from the moment
     * it joined, never a claim to the whole history.
     */
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to adopt the canvas");
    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 10, y: 10 });

    // The STATE is complete, which is the part that matters.
    const there = await until(() => canvas(B), (snap) => snap.lastSeq === 3, "B at seq 3");
    expect(there.canvas.items["itm_1"]).toMatchObject({ x: 10, y: 10, width: 100, height: 80 });
    expect(there.project.title).toBe("Acme Sprint Board");

    // The HISTORY is a suffix: contiguous, ending exactly where the home ends,
    // and starting wherever B happened to arrive — never at seq 1, which
    // happened before it existed. Asserted as a shape rather than as exact
    // seqs, because where B joins depends on when its first socket opened and
    // that is genuinely a race, not a contract.
    const late = await oplog(B);
    const seqs = late.map((entry) => entry.seq);
    expect(seqs).not.toContain(1);
    expect(seqs[seqs.length - 1]).toBe(3);
    expect(seqs).toEqual(seqs.map((_, index) => seqs[0]! + index));
    // And every entry it does hold is the home's, byte for byte.
    const atHome = new Map((await oplog(H)).map((entry) => [entry.seq, entry.envelope.id]));
    for (const entry of late) expect(entry.envelope.id).toBe(atHome.get(entry.seq));
  }, 20_000);

  it("writes the home's seqs into the replica's own store, verbatim", async () => {
    await birthAtA();
    await until(
      () => oplog(A),
      (entries) => entries.length === 2,
      "A to hold both entries",
    );

    // Not the API's answer — the file on A's disk. The seq a replica writes
    // down IS the home's, which is the whole reason a `?since=N` cursor means
    // the same thing at both ends of the socket.
    const lines = (await fs.readFile(p.oplogFile(aDir, CANVAS), "utf8"))
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LogEntry);
    expect(lines.map((entry) => entry.seq)).toEqual([1, 2]);
    expect(lines[1]!.envelope.actor).toEqual(priya);
    // The op is byte-for-byte the home's, including the op id it minted.
    expect(lines.map((entry) => entry.envelope.id)).toEqual(
      (await oplog(H)).map((entry) => entry.envelope.id),
    );
  }, 20_000);

  it("puts an op written at A onto B", async () => {
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");

    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 42, y: 43 });

    const there = await until(
      () => canvas(B),
      (snap) => snap.canvas.items["itm_1"]?.x === 42,
      "the move to reach B",
    );
    expect(there.lastSeq).toBe(3);
    expect(there.canvas.items["itm_1"]!.y).toBe(43);
  }, 20_000);

  it("lets each replica write, and orders both at the home", async () => {
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");

    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 1, y: 1 });
    await op(B, isaac, { type: "item.move", itemId: "itm_1", x: 2, y: 2 });
    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 3, y: 3 });

    for (const node of [H, A, B]) {
      const snap = await until(
        () => canvas(node),
        (value) => value.lastSeq === 5,
        `${node.base} to reach seq 5`,
      );
      expect(snap.canvas.items["itm_1"]!.x).toBe(3);
    }
    // Both actors are in the home's log under their own names: a forwarded op
    // keeps its actor verbatim, and badge ids stay out of envelopes.
    const authors = (await oplog(H)).map((entry) => entry.envelope.actor.id);
    expect(new Set(authors)).toEqual(new Set([priya.id, isaac.id]));
  }, 20_000);
});

/**
 * **What a replica carries, and what keeps it carrying it.**
 *
 * Phase 8 stage 4 changed the answer to the first question from "everything
 * its home will show it" to "what it was let into". These four are the
 * properties that answer has to have to be worth shipping — each one measured
 * against real daemons rather than reasoned about, which is the lesson phase 7
 * wrote on this exact code.
 */
describe("what a replica carries", () => {
  it("keeps a canvas it was let into across a restart, and catches up on what it missed", async () => {
    /**
     * An admission is desk state at the HOME, and a replica's badge is a
     * durable row in its own `identity.json` — so neither half of "B was let
     * in" lives in a process. This is the assertion that says so: B is
     * restarted on the same directory, holds the canvas without being let in
     * again, and takes the tail of what happened while it was down.
     */
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to adopt the canvas");

    await B.daemon.close();
    await op(A, priya, { type: "item.move", itemId: "itm_1", x: 77, y: 77 });
    B = await node(await replica(bDir, H.base), bDir, isaac);

    const back = await until(
      () => canvas(B),
      (snap) => snap.lastSeq === 3,
      "B to come back and catch up",
    );
    expect(back.canvas.items["itm_1"]).toMatchObject({ x: 77, y: 77 });
  }, 30_000);

  it("keeps a canvas born HERE, because the birth WROTE DOWN where it lives", async () => {
    /**
     * **This test's name changed in phase 10.3, and the change is the honest
     * signal that something load-bearing moved.**
     *
     * It used to assert TWO independent legs, either of which was enough:
     *
     * 1. *It is local.* The sweep's first line was "every canvas in this
     *    machine's store", so a forwarded `project.create` landing here put the
     *    canvas in the wanted set from the moment it existed.
     * 2. *The home admitted the badge that made it.* Creating a canvas is the
     *    one provenance that is not "somebody let me in" (`{root: "created"}`,
     *    `http.ts`'s bootstrap), written onto this daemon's badge AT THE HOME
     *    — the same badge the sweep asks with.
     *
     * **Phase 10.3 deleted leg 1**, deliberately: "everything on this disk"
     * was only ever the right set while a daemon had one home, and with two it
     * has a dev link dialling a prod canvas. What replaced it is better and is
     * what this test now asserts — **the birth wrote a ROW**, so the canvas is
     * this home's by the record rather than by being nearby. The old leg 1's
     * other job, "a home that is down cannot make a laptop forget", is
     * unchanged and got stronger: the row is a durable file rather than a
     * derived listing. (`does not forget what it holds when the home is
     * unreachable`, below, is where that half is measured.)
     *
     * Leg 2 is still asserted directly, with the replica's own home badge,
     * because it is the one a reader would doubt: it is invisible from this
     * machine, and it is what makes the canvas survive a store this daemon has
     * thrown away.
     */
    await birthAtA();

    // The row, on A's disk, naming H — written by the birth itself, before the
    // op was ever forwarded.
    expect(A.daemon.homes.assignments()).toEqual({ [CANVAS]: H.base });
    expect(JSON.parse(await fs.readFile(p.homesFile(aDir), "utf8"))).toEqual({
      [CANVAS]: H.base,
    });

    const badge = await readBadge(aDir, H.base);
    expect(badge, "A's daemon should hold a badge at the home").not.toBeNull();
    const narrow = await fetch(`${H.base}${canvasesRoute("admitted")}`, {
      headers: bearerHeader(badge!),
    });
    expect(((await narrow.json()) as Canvas[]).map((canvas) => canvas.id)).toEqual([CANVAS]);
    const admissions = (await H.daemon.desk.badge(badge!.badgeId))!.admissions;
    expect(admissions.map((a) => a.provenance.root)).toContain("created");

    // And the row outlives the process: restarted on the same directory, A
    // holds the canvas AND still knows whose it is, before any sweep has had a
    // chance to run.
    await A.daemon.close();
    A = await node(await replica(aDir, H.base), aDir, priya);
    expect((await A.daemon.engine.listCanvases()).map((canvas) => canvas.id)).toEqual([CANVAS]);
    expect(A.daemon.homes.homeOf(CANVAS)).toBe(H.base);
  }, 30_000);

  it("does not forget what it holds when the home is unreachable", async () => {
    /**
     * The rule the sweep's own comment has carried since phase 6, kept true
     * through a change that gave the sweep a different question to ask. A
     * narrowed listing that a dead home cannot answer at all is exactly the
     * shape that would quietly empty a laptop, and it must not: the home's
     * answer is best-effort ON TOP OF what this machine already holds, never
     * instead of it.
     */
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to adopt the canvas");

    await H.daemon.close();
    // Twenty poll intervals with every request to the home failing.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect((await canvases(B)).map((canvas) => canvas.id)).toEqual([CANVAS]);
    expect((await canvas(B)).canvas.items["itm_1"]).toMatchObject({ x: 5, y: 6 });
    expect((await canvases(A)).map((canvas) => canvas.id)).toEqual([CANVAS]);
  }, 30_000);
});

/**
 * **Asking for one canvas by name** — the other half of narrowing the sweep,
 * without which the narrowing would be a regression: a machine handed nothing
 * but an ADDRESS (a cloned marker, a pass-less `isocan setup`) used to get its
 * canvas because the home listed itself, and now has to say what it wants.
 * `HOME_JOIN_ROUTE` carries the argument.
 */
describe("fetching one canvas from the home by name", () => {
  it("brings it down when the home's door says yes, and only that one", async () => {
    await birthAtA();
    // A second canvas at the home that nobody handed to B. The join must not
    // be a listing wearing a different hat.
    await op(A, priya, { type: "project.create", canvasId: "prj_other", title: "Other" }, null);
    await until(() => canvases(H), (list) => list.length === 2, "both canvases at H");

    const asked = await post(B, HOME_JOIN_ROUTE, { canvasId: CANVAS });
    expect(asked.status, await asked.clone().text()).toBe(200);
    expect(((await asked.json()) as { canvas: Canvas }).canvas.title).toBe("Acme Sprint Board");

    const held = await until(
      () => B.daemon.engine.listCanvases(),
      (list) => list.length > 0,
      "the asked-for canvas to land on B",
    );
    expect(held.map((canvas) => canvas.id)).toEqual([CANVAS]);
    // Settle, then check again: the other canvas has a live link grant and is
    // one poll away at all times. Being let into one room is not being handed
    // the building.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect((await B.daemon.engine.listCanvases()).map((canvas) => canvas.id)).toEqual([CANVAS]);
  }, 30_000);

  it("passes the home's refusal back, so a person is told rather than left watching an empty replica", async () => {
    await birthAtA();
    // The link off, and B was never let in by anything else: the door has
    // nothing to admit it on.
    const { grants } = (await get<GrantsResponse>(H, grantsRoute(CANVAS)));
    const off = await fetch(`${H.base}${grantRoute(CANVAS, grants[0]!.id)}`, {
      method: "DELETE",
      headers: H.badge.headers,
    });
    expect(off.status).toBe(200);

    const asked = await post(B, HOME_JOIN_ROUTE, { canvasId: CANVAS });
    // The home's own status and code, unchanged by the hop — a replica is a
    // pass-through, not a re-interpreter, and `not-admitted` is the one
    // refusal whose remedy ("ask for a pass") depends on reading it exactly.
    expect(asked.status).toBe(403);
    expect(((await asked.json()) as { code: string }).code).toBe("not-admitted");
    expect(await B.daemon.engine.listCanvases()).toEqual([]);
  }, 20_000);

  it("is refused on a home, which has nowhere to fetch from", async () => {
    // Answering 200 to "go and get this from upstream" when there is no
    // upstream is the cheerful wrong answer this codebase keeps meeting. The
    // code is what a speculative caller branches on: the CLI asks this of
    // every unresolvable marker, and `not-a-replica` means "carry on".
    const asked = await post(H, HOME_JOIN_ROUTE, { canvasId: CANVAS });
    expect(asked.status).toBe(409);
    expect(((await asked.json()) as { code: string }).code).toBe("not-a-replica");
  }, 20_000);
});

describe("the lid close", () => {
  it("resumes from the seq it holds, and takes the tail rather than a snapshot", async () => {
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");

    // The lid shuts: A's connection to H dies with the daemon.
    await A.daemon.close();

    // Jordan keeps working — here, that is B, writing an evening's worth.
    for (const x of [10, 20, 30]) {
      await op(B, isaac, { type: "item.move", itemId: "itm_1", x, y: x });
    }
    await until(() => canvas(H), (snap) => snap.lastSeq === 5, "the home to hold the evening");

    // 9pm: the lid opens. A comes back on the same store, so it still holds
    // through seq 2 and says so.
    A = await node(await replica(aDir, H.base), aDir, priya);

    const caught = await until(
      () => canvas(A),
      (snap) => snap.lastSeq === 5,
      "A to catch up on reconnect",
    );
    expect(caught.canvas.items["itm_1"]!.x).toBe(30);

    // The assertion the phase is about: it was a RESUME. Without this the test
    // passes just as well against a replica that threw its canvas away and
    // took a full snapshot every time it reconnected — converging on the right
    // state while the seq cursor did nothing at all.
    const handshake = A.daemon.homes.link(H.base)!.handshakes(CANVAS);
    expect(handshake.snapshots).toBe(0);
    expect(handshake.resumed).toBeGreaterThanOrEqual(1);
    expect(handshake.last).toMatchObject({ type: "resumed", since: 2, lastSeq: 5 });

    // And the tail really was applied entry by entry — the replica's log has
    // the evening in it, not a hole with a snapshot on the far side.
    const entries = await oplog(A);
    expect(entries.map((entry) => entry.seq)).toEqual([1, 2, 3, 4, 5]);
  }, 30_000);

  it("takes a snapshot for a canvas it has never held", async () => {
    // The other half of the same contract, and not an error path: B has none
    // of this canvas, so `since=0` is the honest cursor and a snapshot is the
    // only possible answer.
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to adopt the canvas");
    expect(B.daemon.homes.link(H.base)!.handshakes(CANVAS).snapshots).toBeGreaterThanOrEqual(1);
    // Adopted whole: state, title, and the home's lastSeq.
    const snap = await canvas(B);
    expect(snap.project.title).toBe("Acme Sprint Board");
    expect(snap.canvas.items["itm_1"]!.x).toBe(5);
  }, 20_000);
});

describe("what a replica will and will not do on its own", () => {
  it("serves no page to a person", async () => {
    // The one-origin rule, asserted where the replica is a real replica of a
    // real home rather than of a configured string.
    const res = await fetch(`${A.base}/c/${CANVAS}`, { headers: { Accept: "text/html" } });
    expect(res.status).toBe(404);
    expect(res.headers.get("x-isocan-home")).toBe(H.base);
    expect(await res.text()).toContain(H.base);
  }, 20_000);

  it("says the home is unreachable rather than pretending a write landed", async () => {
    await birthAtA();
    await until(() => canvas(A), (snap) => snap.lastSeq === 2, "A to settle");
    const before = (await canvas(A)).lastSeq;

    await H.daemon.close();

    const res = await post(A, "/api/ops", {
      canvasId: CANVAS,
      actor: priya,
      op: { type: "item.move", itemId: "itm_1", x: 99, y: 99 },
    });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe("home-unreachable");
    // Naming the address is the difference between a message somebody can act
    // on and one that sends them reading source.
    expect(body.error).toContain(H.base);

    // And nothing was applied locally. A replica that fell back to writing
    // locally would be a second writer of one log — the disaster the whole
    // design forbids — and it would look exactly like success.
    expect((await canvas(A)).lastSeq).toBe(before);
    expect((await canvas(A)).canvas.items["itm_1"]!.x).toBe(5);
  }, 20_000);

  it("passes the home's refusal through with its own status and code", async () => {
    await birthAtA();
    // An op the home's reducer refuses. What matters is not which refusal it
    // is but that the replica does not re-interpret it: `writer-fenced` is a
    // 409 that a client must never retry, and a replica that flattened every
    // refusal to 500 would turn "do not retry" into "worth another go".
    const res = await post(A, "/api/ops", {
      canvasId: CANVAS,
      actor: priya,
      op: { type: "item.move", itemId: "itm_nope", x: 1, y: 1 },
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBeTruthy();
  }, 20_000);
});

describe("presence, carried both ways and written nowhere", () => {
  it("puts a replica's face on the home and on the other replica", async () => {
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");

    const session = (await (
      await post(A, `/api/projects/${CANVAS}/sessions`, { actor: priya, label: "at the keyboard" })
    ).json()) as { sessionId: string };

    // Up to the home…
    const atHome = await until(
      () => roster(H),
      (list) => list.some((s) => s.actor.id === priya.id),
      "Priya's face at the home",
    );
    expect(atHome.find((s) => s.actor.id === priya.id)).toMatchObject({
      sessionId: session.sessionId,
      // The session keeps its id, its kind and its label across the hop: a
      // parked agent has to read as a parked agent on the canvas, not as an
      // anonymous cursor.
      kind: "cli",
      label: "at the keyboard",
    });

    // …and down to the other replica, so `isocan who` on B's machine sees the
    // whole canvas rather than only B.
    await until(
      () => roster(B),
      (list) => list.some((s) => s.sessionId === session.sessionId),
      "Priya's face at B",
    );

    // Exactly one of her, on every machine including her own: a relayed face
    // that came back in the merged roster and was mirrored down again would
    // show her twice.
    for (const node of [H, A, B]) {
      const list = await roster(node);
      expect(list.filter((s) => s.actor.id === priya.id)).toHaveLength(1);
    }

    // The ephemeral plane stays ephemeral. Nothing about a face reaches a log
    // — journey rule, and the one thing presence must never do.
    expect((await oplog(H)).map((entry) => entry.envelope.op.type)).toEqual([
      "project.create",
      "item.add",
    ]);
    expect(await fs.readFile(p.oplogFile(homeDir, CANVAS), "utf8")).not.toContain(
      session.sessionId,
    );
  }, 20_000);

  it("takes the face down when the connection dies", async () => {
    await birthAtA();
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");
    await (await post(A, `/api/projects/${CANVAS}/sessions`, { actor: priya })).json();
    await until(
      () => roster(B),
      (list) => list.some((s) => s.actor.id === priya.id),
      "Priya's face at B",
    );

    // Scene 4's beat 7: the lid shuts, and her face fades from everybody's
    // pile. A ring that outlived its own connection would be presence lying,
    // which is the one thing the honest-presence rule forbids.
    await A.daemon.close();

    await until(
      () => roster(H),
      (list) => !list.some((s) => s.actor.id === priya.id),
      "Priya's face to fade at the home",
    );
    await until(
      () => roster(B),
      (list) => !list.some((s) => s.actor.id === priya.id),
      "Priya's face to fade at B",
    );
  }, 20_000);
});

describe("blobs follow the ops that name them", () => {
  it("uploads through the replica to the home, and reads back on the other one", async () => {
    await birthAtA();
    const bytes = Buffer.from("# Acme sprint notes\n");
    const uploaded = await fetch(`${A.base}/api/projects/${CANVAS}/blobs`, {
      method: "POST",
      headers: {
        ...A.badge.headers,
        "Content-Type": "text/markdown",
        "X-Isocan-Filename": "notes.md",
      },
      body: new Uint8Array(bytes),
    });
    expect(uploaded.status).toBe(200);
    const blob = (await uploaded.json()) as { blobHash: string };

    // At the home, because that is where every browser tab will read it from…
    const fromHome = await fetch(`${H.base}/api/projects/${CANVAS}/blobs/${blob.blobHash}`, {
      headers: H.badge.headers,
    });
    expect(await fromHome.text()).toBe(bytes.toString());

    // …and on B, which has never held these bytes: an op that named a hash
    // nobody else could resolve would replicate a list of broken items.
    await letBIn();
    await until(() => canvas(B), (snap) => snap.lastSeq === 2, "B to catch up");
    const fromB = await fetch(`${B.base}/api/projects/${CANVAS}/blobs/${blob.blobHash}`, {
      headers: B.badge.headers,
    });
    expect(fromB.status).toBe(200);
    expect(await fromB.text()).toBe(bytes.toString());
  }, 20_000);
});
