import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  CanvasSnapshotResponse,
  HomesResponse,
  LogEntry,
  Operation,
  PresenceSession,
  Canvas,
} from "@isocan/core";
import { BADGES_ROUTE, HOMES_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { readBadge, writeBadge } from "../src/badge-store.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Phase 10.3's Proof: one machine, one daemon, canvases at two homes and at
 * home itself — every write flowing to the right home, and refused across
 * lines.**
 *
 * The shape that could not be expressed before this phase, and that is the
 * point of writing it down. A configured home used to demote the WHOLE daemon:
 * one connection, every canvas on the disk forwarded to it, and a canvas that
 * was local while a home existed was offline birth (phase 13's) rather than an
 * ordinary Tuesday. Dion's rig is exactly that shape and always was — canvases
 * born local beside work that belongs at dev — and so is every developer's the
 * moment prod and dev both exist.
 *
 * So: **D**, one daemon with no birth default, holding three canvases —
 * `prj_local` born naming nothing, `prj_one` born naming H1, `prj_two` born
 * naming H2. Two real homes in the same process, because the assertions are
 * about what daemons say to each other and no amount of CLI output would show
 * them.
 *
 * On `home-link.test.ts`'s harness deliberately: same `mintTestBadge`/
 * `speakAs`, same `op()`/`get()`/`post()`/`until()`. That file measures one
 * replica of one home; this one measures the plural.
 */

const dion = { id: "usr_dion", name: "Dion" };

const LOCAL = "prj_local";
const ONE = "prj_one";
const TWO = "prj_two";

interface Node {
  daemon: Daemon;
  base: string;
  badge: TestBadge;
  dir: string;
}

let h1Dir: string;
let h2Dir: string;
let dDir: string;
let H1: Node;
let H2: Node;
let D: Node;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

async function node(daemon: Daemon, dir: string, actor: { id: string; name: string }): Promise<Node> {
  const base = baseOf(daemon);
  const badge = await mintTestBadge(base);
  await badge.speakAs(actor);
  return { daemon, base, badge, dir };
}

/** D: no birth default at all, which is the honest fixture for the mixed rig —
 * nothing about this machine says "canvases go to X", and each canvas's home is
 * a fact about that canvas. */
async function bootD(): Promise<Node> {
  const daemon = await startDaemon({ port: 0, home: dDir, birthHome: null, homePollMs: 50 });
  return node(daemon, dDir, dion);
}

beforeEach(async () => {
  h1Dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-h1-"));
  h2Dir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-h2-"));
  dDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-d-"));
  H1 = await node(await startDaemon({ port: 0, home: h1Dir, birthHome: null }), h1Dir, {
    id: "usr_h1",
    name: "Acme Home",
  });
  H2 = await node(await startDaemon({ port: 0, home: h2Dir, birthHome: null }), h2Dir, {
    id: "usr_h2",
    name: "Widget Home",
  });
  D = await bootD();
});

afterEach(async () => {
  await D?.daemon.close().catch(() => {});
  await Promise.allSettled([H1?.daemon.close(), H2?.daemon.close()]);
  await Promise.allSettled(
    [h1Dir, h2Dir, dDir].map((dir) => fs.rm(dir, { recursive: true, force: true })),
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
  canvasId: string | null,
  operation: Operation,
  extra: { home?: string } = {},
): Promise<{ seq: number }> {
  const res = await post(node, "/api/ops", {
    canvasId,
    actor: dion,
    op: operation,
    ...extra,
  });
  if (!res.ok) throw new Error(`${operation.type} refused by ${node.base}: ${await res.text()}`);
  return (await res.json()) as { seq: number };
}

async function get<T>(node: Node, url: string): Promise<T> {
  const res = await fetch(`${node.base}${url}`, { headers: node.badge.headers });
  if (!res.ok) throw new Error(`GET ${url} on ${node.base}: ${res.status}`);
  return (await res.json()) as T;
}

const canvas = (node: Node, id: string) =>
  get<CanvasSnapshotResponse>(node, `/api/projects/${id}/canvas`);
const oplog = (node: Node, id: string) =>
  get<LogEntry[]>(node, `/api/projects/${id}/oplog?since=0`);
const roster = (node: Node, id: string) =>
  get<PresenceSession[]>(node, `/api/projects/${id}/sessions`);

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

const item = (id: string, x: number): Operation => ({
  type: "item.add",
  itemId: id,
  version: nv(`ver_${id}`),
  width: 100,
  height: 80,
  placement: { x, y: x },
});

/**
 * The three canvases, born on the one daemon.
 *
 * **Nothing here does anything special to arrange where they land.** Each
 * `project.create` states an address (or does not), the daemon writes the row
 * and forwards through the link for it, and the canvas is at that home because
 * that is where its birth went. Which is the phase in one function: what
 * travels is the marker's assertion, beside the op, at a birth.
 */
async function birthAll(): Promise<void> {
  await op(D, null, { type: "project.create", canvasId: LOCAL, title: "Scratch Notes" });
  await op(
    D,
    null,
    { type: "project.create", canvasId: ONE, title: "Acme Sprint Board" },
    { home: H1.base },
  );
  await op(
    D,
    null,
    { type: "project.create", canvasId: TWO, title: "Widget Redesign" },
    { home: H2.base },
  );
}

describe("one daemon, many homes", () => {
  it("writes down where each canvas lives, at its birth, including the local one", async () => {
    await birthAll();
    // The record, in memory and on disk. `prj_local`'s explicit `null` is not
    // cosmetic: it is what stops either link's sweep later claiming a
    // locally-born canvas under the "this id has no row, so it must be mine"
    // rule, which is the one branch of the arbitration that WRITES.
    expect(D.daemon.homes.assignments()).toEqual({
      [LOCAL]: null,
      [ONE]: H1.base,
      [TWO]: H2.base,
    });
    expect(JSON.parse(await fs.readFile(p.homesFile(dDir), "utf8"))).toEqual({
      [LOCAL]: null,
      [ONE]: H1.base,
      [TWO]: H2.base,
    });
  }, 30_000);

  it("sends every write to the right home, and never to the other one", async () => {
    await birthAll();
    await op(D, LOCAL, item("itm_local", 1));
    await op(D, ONE, item("itm_one", 2));
    await op(D, TWO, item("itm_two", 3));

    // Each home holds its own canvas…
    const atH1 = await until(
      () => H1.daemon.engine.listCanvases(),
      (list) => list.some((canvas) => canvas.id === ONE),
      "prj_one at H1",
    );
    const atH2 = await until(
      () => H2.daemon.engine.listCanvases(),
      (list) => list.some((canvas) => canvas.id === TWO),
      "prj_two at H2",
    );
    // …and only its own. Not the other home's canvas, and — the assertion the
    // whole phase turns on — **neither home ever holds the local one**. A
    // daemon with a home used to forward every write on its disk; a canvas
    // born here and staying here was not a thing it could hold.
    expect(atH1.map((canvas) => canvas.id)).toEqual([ONE]);
    expect(atH2.map((canvas) => canvas.id)).toEqual([TWO]);
    expect((await H1.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(TWO);
    expect((await H1.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(LOCAL);
    expect((await H2.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(ONE);
    expect((await H2.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(LOCAL);

    // The state really travelled, rather than merely the canvas row.
    expect((await canvas(H1, ONE)).canvas.items["itm_one"]).toMatchObject({ x: 2, y: 2 });
    expect((await canvas(H2, TWO)).canvas.items["itm_two"]).toMatchObject({ x: 3, y: 3 });
    expect((await canvas(D, LOCAL)).canvas.items["itm_local"]).toMatchObject({ x: 1, y: 1 });

    // And the seqs are the HOME's, verbatim, on the machine that wrote them —
    // which is what makes a `?since=N` cursor mean the same thing at both ends
    // of two different sockets at once.
    const oneAtHome = await oplog(H1, ONE);
    const oneHere = await until(
      () => oplog(D, ONE),
      (entries) => entries.length === oneAtHome.length,
      "D to hold prj_one's whole log",
    );
    expect(oneHere.map((entry) => entry.seq)).toEqual(oneAtHome.map((entry) => entry.seq));
    expect(oneHere.map((entry) => entry.envelope.id)).toEqual(
      oneAtHome.map((entry) => entry.envelope.id),
    );
  }, 30_000);

  /**
   * **(a) One home down refuses exactly one canvas.**
   *
   * The phase's central claim and the single strongest assertion available,
   * because it is a sentence that could not be written at all a phase ago: a
   * daemon whose home was unreachable refused EVERY write, on every canvas,
   * including ones that had nothing to do with that home.
   */
  it("refuses writes to the home that is down, and only those — the rest keep working", async () => {
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await until(() => canvas(H1, ONE), (snap) => snap.lastSeq === 2, "H1 to settle");

    await H1.daemon.close();

    const refused = await post(D, "/api/ops", {
      canvasId: ONE,
      actor: dion,
      op: { type: "item.move", itemId: "itm_one", x: 99, y: 99 },
    });
    expect(refused.status).toBe(503);
    const body = (await refused.json()) as { error: string; code: string };
    expect(body.code).toBe("home-unreachable");
    // Naming WHICH home is the difference between a message a person can act on
    // and one that sends them reading source — and on a machine with three
    // homes, "the home is unreachable" is unanswerable.
    expect(body.error).toContain(H1.base);

    // In the same breath: the other home's canvas takes a write, and so does
    // the one that lives right here.
    await op(D, TWO, item("itm_two_b", 7));
    await op(D, LOCAL, item("itm_local_b", 8));
    expect((await canvas(D, TWO)).canvas.items["itm_two_b"]).toMatchObject({ x: 7 });
    expect((await canvas(D, LOCAL)).canvas.items["itm_local_b"]).toMatchObject({ x: 8 });
    await until(
      () => canvas(H2, TWO),
      (snap) => snap.canvas.items["itm_two_b"] !== undefined,
      "the write to reach H2 while H1 is down",
    );

    // And nothing was applied locally for the refused one. A daemon that fell
    // back to writing locally would be a second writer of one log.
    expect((await canvas(D, ONE)).canvas.items["itm_one"]).toMatchObject({ x: 2, y: 2 });
  }, 30_000);

  /**
   * **(b) A link never dials a canvas that is not its own.**
   *
   * `HomeHandshakes` counts rather than remembers precisely so that the
   * negative question can be asked — its own doc says *"the interesting
   * question is negative"* — and this is the assertion that catches a `sweep()`
   * which quietly kept the old "every canvas in the local store" line. That
   * line would have H1's link dial `prj_two`, and in the clone-and-twin case
   * (one id at both homes) the wrong home would answer with a SNAPSHOT and
   * `adoptRemoteSnapshot` would overwrite the local copy. The narrowing is a
   * data-loss fix; this is its refusal test.
   */
  it("never dials a canvas that belongs to the other home", async () => {
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await op(D, TWO, item("itm_two", 3));
    // Let the suite settle: the sweep runs every 50ms here, so a bare
    // assertion would pass against the old behaviour purely by being fast.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const h1 = D.daemon.homes.link(H1.base)!;
    const h2 = D.daemon.homes.link(H2.base)!;
    expect(h1.handshakes(TWO)).toEqual({ resumed: 0, snapshots: 0, last: null });
    expect(h1.handshakes(LOCAL)).toEqual({ resumed: 0, snapshots: 0, last: null });
    expect(h2.handshakes(ONE)).toEqual({ resumed: 0, snapshots: 0, last: null });
    expect(h2.handshakes(LOCAL)).toEqual({ resumed: 0, snapshots: 0, last: null });
    // …while each link has of course dialled its own, or none of the above
    // would mean anything.
    expect(h1.handshakes(ONE).resumed + h1.handshakes(ONE).snapshots).toBeGreaterThan(0);
    expect(h2.handshakes(TWO).resumed + h2.handshakes(TWO).snapshots).toBeGreaterThan(0);
  }, 30_000);

  /**
   * **(c), the server's half.** A home offering a canvas this machine has
   * recorded as somebody else's is REFUSED rather than adopted — and nothing
   * moves.
   *
   * This is the twin case arriving through the only door it can arrive
   * through: an admitted listing. Two homes holding one canvas id is phase
   * 13's problem (adoption, re-homing) and it cannot be settled by whichever
   * poll ran first; silently taking either one overwrites somebody's work with
   * nothing anywhere saying so. The CLI-level half — a marker that disagrees
   * with the record, refused by name — is the same rule read from the other
   * end.
   */
  it("refuses a canvas the other home offers under an id this machine has already placed", async () => {
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await until(() => canvas(H1, ONE), (snap) => snap.lastSeq === 2, "H1 to settle");

    // H2 grows a canvas with H1's id and different contents — the twin, made
    // the way twins are actually made (two machines, one id, no coordination).
    const created = await post(H2, "/api/ops", {
      canvasId: null,
      actor: { id: "usr_h2", name: "Widget Home" },
      op: { type: "project.create", canvasId: ONE, title: "Not The Acme Board" },
    });
    expect(created.status).toBe(200);
    // …and D's badge at H2 is admitted to it, so H2's narrow listing will
    // offer it. (Redeeming a pass is how a machine is let in; here H2 hands D
    // one for exactly this canvas.)
    const minted = await post(H2, `/api/projects/${ONE}/passes`, {});
    expect(minted.status).toBe(200);
    const { token } = (await minted.json()) as { token: string };
    // Redeemed at H2 directly with D's own home badge, because `homeScoped` on
    // a daemon with no birth default and two links has no honest answer — the
    // seam this phase names rather than closes.
    const dBadgeAtH2 = await readBadge(dDir, H2.base);
    expect(dBadgeAtH2).not.toBeNull();
    await fetch(`${H2.base}/api/passes/redeem`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dBadgeAtH2!.badgeId}.${dBadgeAtH2!.secret}`,
      },
      body: JSON.stringify({ token }),
    });

    // Forty sweeps.
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Nothing moved. The row still names H1, H2's link never dialled it, and
    // the canvas on this disk is still the one it always was — title, items and
    // all. An adoption would have swapped every one of those.
    expect(D.daemon.homes.homeOf(ONE)).toBe(H1.base);
    expect(D.daemon.homes.link(H2.base)!.handshakes(ONE)).toEqual({
      resumed: 0,
      snapshots: 0,
      last: null,
    });
    const here = await canvas(D, ONE);
    expect(here.project.title).toBe("Acme Sprint Board");
    expect(here.canvas.items["itm_one"]).toMatchObject({ x: 2, y: 2 });
    // And writes still go to H1, which is the half that would be silently
    // wrong if the row had been rewritten.
    await op(D, ONE, item("itm_one_b", 5));
    await until(
      () => canvas(H1, ONE),
      (snap) => snap.canvas.items["itm_one_b"] !== undefined,
      "the write to keep going to H1",
    );
    expect((await canvas(H2, ONE)).canvas.items["itm_one_b"]).toBeUndefined();
  }, 40_000);

  /**
   * **The wrong answer this phase nearly shipped.**
   *
   * A badge is a fact about a DESK, and a desk belongs to a home. `isocan
   * badges` asks "what surfaces of mine exist there" without ever saying
   * where, and while a daemon had one home that question answered itself.
   * With two and no birth default it has no answer — and the code's own
   * instinct was to fall through to the LOCAL desk, which hands back this
   * laptop's own ledger: short, plausible, completely wrong, and silent.
   *
   * That is this codebase's oldest standing lesson (its default answer to a
   * wrong address is a cheerful one) landing on a credential, which is the
   * worst place for it. So the request is refused, both homes are named, and
   * the person chooses. A pass escaped this seam by carrying its own address;
   * a badge route could grow the same field the day a scene wants it.
   */
  it("refuses a home-scoped question it cannot place, instead of answering from the local desk", async () => {
    await birthAll();
    // No birth default and two links: `homeScoped` has nothing to break the
    // tie with, and the local desk is emphatically not the answer.
    expect(D.daemon.homes.homeScopedAmbiguity()).toEqual([H1.base, H2.base].sort());

    const listed = await fetch(`${D.base}${BADGES_ROUTE}`, { headers: D.badge.headers });
    expect(listed.status).toBe(409);
    const body = (await listed.json()) as { error: string; code: string };
    expect(body.code).toBe("ambiguous-home");
    // Both named, so the sentence is actionable rather than merely a refusal.
    expect(body.error).toContain(H1.base);
    expect(body.error).toContain(H2.base);

    // And the refusal is the AMBIGUITY, not the route: give the machine a
    // birth default and the same question is answered again. Without this the
    // test would pass against a daemon that had simply broken `isocan badges`.
    await D.daemon.close();
    const decided = await node(
      await startDaemon({ port: 0, home: dDir, birthHome: H1.base, homePollMs: 50 }),
      dDir,
      dion,
    );
    D = decided;
    const ok = await fetch(`${decided.base}${BADGES_ROUTE}`, { headers: decided.badge.headers });
    expect(ok.status).toBe(200);
  }, 30_000);
});

/**
 * Three properties that make the model durable rather than incidental. Each
 * one is a thing that would work by accident in a single run and stop working
 * the moment somebody kept the state in the wrong place.
 */
/**
 * **Dion's rig, and the two bugs phase 10.5's walk found in phase 10.3.**
 *
 * The machine that predates all of this: canvases born local, markers naming no
 * home, no `homes.json`, no configured home. Phase 10.3's whole promise to it
 * is that it keeps working with nothing done — and that the day its owner
 * points it at a home, **nothing already there moves**, which is what `isocan
 * home` prints in those words.
 *
 * Both halves of that were false, and neither was caught by a test that
 * exercised only fresh machines.
 */
describe("a machine that predates all of this", () => {
  /** The pre-10.3 shape: canvases in the store, no rows, no configured home. */
  async function dionsRig(dir: string, birthHome: string | null): Promise<Node> {
    const daemon = await startDaemon({ port: 0, home: dir, birthHome, homePollMs: 50 });
    return node(daemon, dir, dion);
  }

  it("disarms the migration by writing the record even when it is empty", async () => {
    // First boot on new code with nothing configured. The migration has
    // nothing to freeze — and must still leave the file behind, or it stays
    // armed for the first `isocan home` that ever runs here.
    const rig = await dionsRig(dDir, null);
    await rig.daemon.close();
    // Nothing to freeze and nothing held — and the file exists anyway, which
    // is the entire guard: the next boot finds a record and leaves it alone.
    expect(JSON.parse(await fs.readFile(p.homesFile(dDir), "utf8"))).toEqual({});
  }, 30_000);

  it("does not move a locally-born canvas when a birth default is set later", async () => {
    /**
     * **The bug, in the order that produces it.** Boot with nothing
     * configured; make a canvas; stop. Then set a birth default and boot
     * again — which is exactly what `isocan home <address>` does, because it
     * writes `config.json` and restarts. The migration used to `return` before
     * writing anything on the first boot, so the second one found no record,
     * saw a configured home, and froze the canvas at a home it had never been
     * to. Measured on a real rig: 404 on its page, `canvas not found` on a
     * write.
     */
    // A store that genuinely predates `homes.json`. Creating the canvas with
    // today's code WRITES a row — birth always does — and that row is itself
    // enough to disarm the migration, which is why a test that skipped this
    // line passed against the bug it was written to catch.
    const zeroth = await dionsRig(dDir, null);
    await post(zeroth, "/api/ops", { canvasId: null, actor: dion, op: { type: "project.create", canvasId: "prj_dion", title: "Acme Sprint Board" } });
    await zeroth.daemon.close();
    await fs.rm(p.homesFile(dDir), { force: true });

    // Step one: the first boot on 10.3 code, nothing configured. This is the
    // boot that has to leave the record behind.
    const first = await dionsRig(dDir, null);
    await first.daemon.close();

    // Step two: `isocan home <address>` — config written, daemon restarted.
    const second = await dionsRig(dDir, H1.base);
    try {
      // Still this daemon's. The birth default says where the NEXT canvas
      // goes and nothing else.
      expect(second.daemon.homes.homeOf("prj_dion")).toBeNull();
      // And the write still lands here rather than being forwarded to a home
      // that has never heard of this canvas.
      await op(second, "prj_dion", item("itm_dion", 5));
      expect((await canvas(second, "prj_dion")).canvas.items["itm_dion"]).toMatchObject({ x: 5 });
      expect((await get<{ id: string }[]>(H1, "/api/projects")).some((r) => r.id === "prj_dion")).toBe(false);
    } finally {
      await second.daemon.close();
    }
  }, 30_000);

  it("does not move them when `isocan home` is the FIRST command run on new code", async () => {
    /**
     * **The path that defeats "write the empty file on the boot before": there
     * is no boot before.**
     *
     * `pointDaemonAtHome` writes `config.json` and THEN restarts, so a machine
     * whose owner upgrades and immediately points it at a home has its very
     * first 10.3 boot already looking at a configured home. Freezing on that
     * key alone hands his locally-born canvases to a home they have never been
     * to. The evidence that separates a real phase 6→7.5 replica from a
     * machine that was merely TOLD an address is a **badge at that address**,
     * and this rig has never knocked on anybody's door.
     */
    const zeroth = await dionsRig(dDir, null);
    await post(zeroth, "/api/ops", { canvasId: null, actor: dion, op: { type: "project.create", canvasId: "prj_dion", title: "Acme Sprint Board" } });
    await zeroth.daemon.close();
    await fs.rm(p.homesFile(dDir), { force: true });

    // No intervening boot: straight from a pre-10.3 store to a configured home.
    const pointed = await dionsRig(dDir, H1.base);
    try {
      expect(pointed.daemon.homes.homeOf("prj_dion")).toBeNull();
      await op(pointed, "prj_dion", item("itm_dion", 9));
      expect((await canvas(pointed, "prj_dion")).canvas.items["itm_dion"]).toMatchObject({ x: 9 });
    } finally {
      await pointed.daemon.close();
    }
  }, 30_000);

  it("DOES freeze a machine that really was a replica — it holds that home's badge", async () => {
    /**
     * The other side of the same discriminator, and the reason it cannot
     * simply be deleted. A phase 6→7.5 replica's canvases genuinely live at
     * its home, their markers say nothing (markers only learned addresses
     * later), and reading "absent" as local would fork every one of them.
     * What makes it a replica rather than a machine holding an address is that
     * the home recognised it: a badge in `identity.json`'s `auth` block.
     */
    const zeroth = await dionsRig(dDir, null);
    await post(zeroth, "/api/ops", { canvasId: null, actor: dion, op: { type: "project.create", canvasId: "prj_old", title: "Acme Sprint Board" } });
    await zeroth.daemon.close();
    await fs.rm(p.homesFile(dDir), { force: true });
    // What a replica has and a merely-configured machine does not.
    await writeBadge(dDir, H1.base, { badgeId: "bdg_old", secret: "s3cret", at: H1.base });

    const upgraded = await dionsRig(dDir, H1.base);
    try {
      expect(upgraded.daemon.homes.homeOf("prj_old")).toBe(H1.base);
    } finally {
      await upgraded.daemon.close();
    }
  }, 30_000);

  it("reports the canvases it holds, not the rows it has written down", async () => {
    /**
     * The third place the same disagreement surfaced, and the one Dion's door
     * actually depends on: `GET /api/homes` read only the rows, so a machine
     * that predates `homes.json` listed **nothing** under `isocan home` and
     * `isocan status` called it a replica of somewhere else — while it was
     * serving those canvases' pages perfectly well. Measured on a real rig
     * before the fix: three canvases held, an empty table, and the role line
     * saying "replica".
     */
    const zeroth = await dionsRig(dDir, null);
    await post(zeroth, "/api/ops", { canvasId: null, actor: dion, op: { type: "project.create", canvasId: "prj_dion", title: "Acme Sprint Board" } });
    await zeroth.daemon.close();
    await fs.rm(p.homesFile(dDir), { force: true });

    const pointed = await dionsRig(dDir, H1.base);
    try {
      const answer = await get<{ birth: string | null; canvases: Record<string, string | null> }>(
        pointed,
        HOMES_ROUTE,
      );
      expect(answer.birth).toBe(H1.base);
      expect(answer.canvases).toEqual({ prj_dion: null });
    } finally {
      await pointed.daemon.close();
    }
  }, 30_000);

  it("counts a canvas with NO row as its own when deciding whether to serve pages", async () => {
    /**
     * The serving half, and the confusing one to meet: routing can be right
     * while `/p/<id>` 404s. `pureReplica` counted only EXPLICIT null rows, so a
     * daemon whose held canvas had no row at all — absent, which
     * `homes.json`'s own doc defines as "this daemon is its home" — judged
     * itself a pure replica and signposted its own page away.
     *
     * Isolating that needs a record that EXISTS (so the migration leaves it
     * alone) but says nothing about this canvas. Deleting the file instead
     * would be the old-replica signal, and the migration would correctly
     * freeze — a different case, tested above.
     */
    const first = await dionsRig(dDir, null);
    await post(first, "/api/ops", { canvasId: null, actor: dion, op: { type: "project.create", canvasId: "prj_dion", title: "Acme Sprint Board" } });
    await first.daemon.close();
    // A record that knows about somebody else's canvas and not this one.
    await fs.writeFile(p.homesFile(dDir), JSON.stringify({ prj_someone_else: H1.base }));

    const second = await dionsRig(dDir, H1.base);
    try {
      expect(second.daemon.homes.homeOf("prj_dion")).toBeNull();
      const page = await fetch(`${second.base}/p/prj_dion`, { headers: { Accept: "text/html" } });
      // Never the signpost: that header is this daemon disowning a canvas it
      // is the home of.
      expect(page.headers.get("x-isocan-home")).toBeNull();
      // And the front page is still this machine's, not a redirect to the
      // birth default, because it has a canvas of its own to show.
      const front = await fetch(`${second.base}/`, { headers: { Accept: "text/html" } });
      expect(front.headers.get("x-isocan-home")).toBeNull();
    } finally {
      await second.daemon.close();
    }
  }, 30_000);
});

describe("what makes many homes durable rather than incidental", () => {
  it("keeps presence on the right side of the line", async () => {
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await op(D, TWO, item("itm_two", 3));
    await until(() => canvas(H1, ONE), (snap) => snap.lastSeq === 2, "H1 to settle");

    // A face at H1, on prj_one.
    const session = (await (
      await post(H1, `/api/projects/${ONE}/sessions`, {
        actor: { id: "usr_h1", name: "Acme Home" },
        label: "at the keyboard",
      })
    ).json()) as { sessionId: string };

    // It reaches D's roster for prj_one — `origin()` is `home:<url>`, so many
    // links are many mirror keys by construction, and this is the assertion
    // that says so rather than assuming it.
    await until(
      () => roster(D, ONE),
      (list) => list.some((s) => s.sessionId === session.sessionId),
      "H1's face on prj_one at D",
    );
    // …and never crosses to the other home's canvas.
    expect((await roster(D, TWO)).map((s) => s.sessionId)).not.toContain(session.sessionId);
    expect((await roster(D, LOCAL)).map((s) => s.sessionId)).not.toContain(session.sessionId);
  }, 30_000);

  it("holds two badges in one identity.json, one per home, with different ids", async () => {
    await birthAll();
    const atH1 = await readBadge(dDir, H1.base);
    const atH2 = await readBadge(dDir, H2.base);
    expect(atH1, "a badge at H1").not.toBeNull();
    expect(atH2, "a badge at H2").not.toBeNull();
    // Different credentials, because a badge is ONE home's recognition of this
    // machine. One badge presented at two doors would be a machine claiming a
    // desk had vouched for it when it had not.
    expect(atH1!.badgeId).not.toBe(atH2!.badgeId);
    // Both under their own key in the one file — the arrangement `badge-store`
    // has always described and that this phase is the first to need plural.
    const identity = JSON.parse(await fs.readFile(p.identityFile(dDir), "utf8")) as {
      auth: Record<string, unknown>;
    };
    expect(Object.keys(identity.auth)).toEqual(expect.arrayContaining([H1.base, H2.base]));
  }, 30_000);

  it("still routes every canvas correctly after a restart — the record is on disk, not in memory", async () => {
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await op(D, TWO, item("itm_two", 3));
    await until(() => canvas(H2, TWO), (snap) => snap.lastSeq === 2, "H2 to settle");

    await D.daemon.close();
    D = await bootD();

    expect(D.daemon.homes.assignments()).toEqual({
      [LOCAL]: null,
      [ONE]: H1.base,
      [TWO]: H2.base,
    });
    // And it is not merely remembered — it is acted on. Three writes, three
    // destinations, after a process that knew none of this when it started.
    await op(D, ONE, item("itm_one_c", 11));
    await op(D, TWO, item("itm_two_c", 12));
    await op(D, LOCAL, item("itm_local_c", 13));
    await until(
      () => canvas(H1, ONE),
      (snap) => snap.canvas.items["itm_one_c"] !== undefined,
      "prj_one's write at H1 after the restart",
    );
    await until(
      () => canvas(H2, TWO),
      (snap) => snap.canvas.items["itm_two_c"] !== undefined,
      "prj_two's write at H2 after the restart",
    );
    expect((await canvas(H1, ONE)).canvas.items["itm_two_c"]).toBeUndefined();
    expect((await canvas(H2, TWO)).canvas.items["itm_one_c"]).toBeUndefined();
    expect((await H1.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(LOCAL);
    expect((await H2.daemon.engine.listCanvases()).map((x) => x.id)).not.toContain(LOCAL);
  }, 40_000);

  it("drops a canvas's row when the canvas is deleted, so a re-created id inherits nothing", async () => {
    /**
     * A row that outlived its canvas is a dead routing waiting for an id to be
     * re-used — and ids are re-used, because a marker committed to git names
     * one and `materializeBinding` adopts it deliberately. The birth after that
     * would forward to whichever home used to hold a canvas of that name,
     * silently, and the person would be told their canvas was made.
     */
    await birthAll();
    await op(D, ONE, item("itm_one", 2));
    await until(() => canvas(H1, ONE), (snap) => snap.lastSeq === 2, "H1 to settle");

    await op(D, ONE, { type: "project.delete" });
    // Polled on the FILE rather than on the registry's own map: the map is
    // updated inside the serialized write and the file a moment later, so
    // reading memory here would assert nothing about what a restart sees —
    // which is the entire reason the row is on disk.
    const onDisk = await until(
      async () =>
        JSON.parse(await fs.readFile(p.homesFile(dDir), "utf8")) as Record<string, unknown>,
      (rows) => !(ONE in rows),
      "the row to be dropped from homes.json",
    );
    expect(onDisk).toEqual({ [LOCAL]: null, [TWO]: H2.base });
    expect(D.daemon.homes.assignments()).toEqual({ [LOCAL]: null, [TWO]: H2.base });
    // And a canvas re-created under the same id, naming nothing, is born HERE
    // rather than at the home the dead row pointed at.
    await op(D, null, { type: "project.create", canvasId: ONE, title: "Acme, Again" });
    expect(D.daemon.homes.homeOf(ONE)).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await canvas(D, ONE)).project.title).toBe("Acme, Again");
  }, 30_000);

  it("lists only the canvases it is the home of when the caller asks `reach=here`", async () => {
    /**
     * The server half of closing a real hole (§6). `CanvasListPage` links to a
     * canvas with a react-router `<Link>` — a client-side navigation that never
     * touches the server — so the per-canvas page guard is simply bypassed for
     * anything in that list, and this origin would render a replica of a canvas
     * that lives at another home: two doors, two cookies, two service workers,
     * two browser replicas, the local one stale by construction.
     *
     * The route learns the question rather than the guard learning to sniff:
     * **the caller states which reach it means**, which is this route's own
     * standing rule.
     */
    await birthAll();
    const here = await get<Canvas[]>(D, "/api/projects?reach=here");
    expect(here.map((canvas) => canvas.id)).toEqual([LOCAL]);
    // …and the default answer is untouched, because a person browsing their own
    // machine still gets the whole picture.
    const all = await get<Canvas[]>(D, "/api/projects");
    expect(all.map((canvas) => canvas.id).sort()).toEqual([LOCAL, ONE, TWO].sort());
  }, 30_000);

  it("answers `GET /api/homes` with the per-canvas picture the whole-daemon field cannot", async () => {
    await birthAll();
    const homes = await get<HomesResponse>(D, HOMES_ROUTE);
    expect(homes.birth).toBeNull();
    expect(homes.canvases).toEqual({ [LOCAL]: null, [ONE]: H1.base, [TWO]: H2.base });
    expect(homes.links.map((link) => link.url).sort()).toEqual([H1.base, H2.base].sort());
    // The health route keeps its `home` key, redefined as the birth default —
    // which here is nothing, and that is the honest answer for a machine whose
    // homes are a property of its canvases.
    const health = await get<{ home?: string }>(D, "/healthz");
    expect(health.home).toBeUndefined();
  }, 30_000);
});
