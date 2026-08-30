import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Bytes fall behind the ops that name them, and nothing used to notice.**
 *
 * A blob is not an Operation, so it does not replicate: `putBlob` pushes it to
 * the home by hand alongside the local copy. Anything that stops that push —
 * the routing table not yet read, a home down for the one second it mattered,
 * a process killed mid-upload — leaves the `item.addVersion` replicated and
 * the bytes behind it absent, permanently and in silence. A teammate opens the
 * canvas and sees the item, its title and its version number, with
 * "blob not found" where the screen should be.
 *
 * Reported exactly that way. Neither machine could answer the only question
 * that mattered — *are the bytes at the home?* — because a local read is
 * served from the local copy. So it was fixed by a hand re-upload and
 * confirmed by somebody else's reload, which is a guess that happened to work.
 * On the real canvas, `isocan blobs` then found twenty blobs still missing
 * AFTER that repair was believed to be done.
 */

const CANVAS = "prj_slides";
const bytes = (s: string) => Buffer.from(s, "utf8");

let homeDir: string;
let repDir: string;
let home: Daemon;
let replica: Daemon;
let repBadge: TestBadge;
let homeBadge: TestBadge;

const baseOf = (d: Daemon) => {
  const a = d.app.server.address();
  return `http://127.0.0.1:${typeof a === "object" && a ? a.port : 0}`;
};

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-home-"));
  repDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-rc-rep-"));
  home = await startDaemon({ port: 0, home: homeDir });
  homeBadge = await mintTestBadge(baseOf(home));
  await homeBadge.speakAs({ id: "usr_home", name: "Home" });
  replica = await startDaemon({
    port: 0,
    home: repDir,
    birthHome: baseOf(home),
    homePollMs: 50,
  });
  repBadge = await mintTestBadge(baseOf(replica));
  await repBadge.speakAs({ id: "usr_dion", name: "Dion" });
  // Born THROUGH the replica, which is the real shape: a canvas made on a
  // laptop whose home is elsewhere. Creating it at the home instead would
  // leave the replica's badge unadmitted, and it would never see the canvas
  // at all — a different bug from the one under test.
  const made = await fetch(`${baseOf(replica)}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...repBadge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: { id: "usr_dion", name: "Dion" },
      op: { type: "project.create", canvasId: CANVAS, title: "Slides" },
    }),
  });
  expect(made.status, "the canvas has to exist to have blobs").toBe(200);
});

afterEach(async () => {
  await replica?.close();
  await home?.close();
  await Promise.allSettled(
    [homeDir, repDir].map((d) => fs.rm(d, { recursive: true, force: true })),
  );
});

/** The replica has the canvas when its link has caught up. */
async function untilReplicated(): Promise<void> {
  for (let tries = 0; tries < 100; tries++) {
    const res = await fetch(`${baseOf(replica)}/api/projects/${CANVAS}/canvas`, {
      headers: repBadge.headers,
    });
    if (res.ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("the canvas never reached the replica");
}

const reconcile = async (push: boolean) => {
  const res = await fetch(`${baseOf(replica)}/api/projects/${CANVAS}/blobs/reconcile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...repBadge.headers },
    body: JSON.stringify({ push }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    home: string | null;
    checked: number;
    missing: string[];
    pushed: string[];
    unknown: string[];
  };
};

describe("do the bytes agree with the ops", () => {
  it("finds a blob the home never received, and sends it", async () => {
    await untilReplicated();
    // Divergence made the way it happens for real: bytes in the replica's own
    // store with no push to the home. `putBlob` on the ENGINE would push;
    // going to the store directly is what a skipped push leaves behind.
    const { blobHash } = await replica.store.putBlob(CANVAS, bytes("<h1>slide 1</h1>"), {
      mimeType: "text/html",
      filename: "01-title.html",
    });

    const before = await reconcile(false);
    expect(before.home).toBe(baseOf(home));
    expect(before.missing, "the home never got these bytes").toContain(blobHash);
    expect(before.pushed, "a read must not write").toEqual([]);

    const repair = await reconcile(true);
    expect(repair.pushed).toContain(blobHash);

    // The home can now serve them, which is the whole point: this is what a
    // teammate's reload actually asks for.
    const at = await fetch(`${baseOf(home)}/api/projects/${CANVAS}/blobs/${blobHash}`, {
      headers: homeBadge.headers,
    });
    expect(at.status).toBe(200);
    expect(await at.text()).toBe("<h1>slide 1</h1>");

    const after = await reconcile(false);
    expect(after.missing, "and it stays fixed").toEqual([]);
  });

  it("says nothing is wrong when the bytes did travel", async () => {
    await untilReplicated();
    // The ordinary path: the engine pushes to the home and keeps a copy, so
    // there is nothing to repair and the report must not invent work.
    await replica.engine.putBlob(CANVAS, bytes("<h1>fine</h1>"), {
      mimeType: "text/html",
      filename: "ok.html",
    });
    const report = await reconcile(false);
    expect(report.checked).toBeGreaterThan(0);
    expect(report.missing).toEqual([]);
    expect(report.unknown).toEqual([]);
  });

  it("reports nothing to reconcile for a canvas that lives here", async () => {
    // At its own home there is no second copy to disagree with, and saying
    // "0 missing" would imply a check that never happened.
    const res = await fetch(`${baseOf(home)}/api/projects/${CANVAS}/blobs/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...homeBadge.headers },
      body: JSON.stringify({ push: false }),
    });
    const report = (await res.json()) as { home: string | null; checked: number };
    expect(report.home).toBe(null);
    expect(report.checked).toBe(0);
  });

  it("never pushes a blob it could not ask about", async () => {
    await untilReplicated();
    // "I could not reach the home" is not "the home does not have it", and
    // only one of those means upload. Conflating them means a home that had a
    // bad minute gets every blob on the canvas thrown at it the moment it
    // answers again — and, worse, a report that says bytes are missing when
    // nobody has established any such thing.
    await replica.store.putBlob(CANVAS, bytes("<h1>unknowable</h1>"), {
      mimeType: "text/html",
      filename: "x.html",
    });
    await home.close(); // the home is gone; nothing can be established
    const report = await reconcile(true);
    expect(report.unknown.length, "an unreachable home yields unknowns").toBeGreaterThan(0);
    expect(report.missing, "unreachable is not missing").toEqual([]);
    expect(report.pushed, "and unreachable is never pushed").toEqual([]);
  });
});
