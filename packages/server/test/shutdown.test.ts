import { afterEach, beforeEach, expect, describe, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Canvas } from "@isocan/core";
import { startDaemon, type Daemon } from "../src/daemon.ts";
import { FileStore } from "../src/file-store.ts";
import * as p from "../src/paths.ts";
import { mintTestBadge } from "./badge.ts";

/**
 * **`close()` means closed** — the one promise this file is about.
 *
 * A daemon's `close()` is a shutdown GUARANTEE, not tidiness: in a container
 * a write that outlives it is a write racing process exit, and under test it
 * is the teardown of whichever test happened to be standing there failing
 * with `ENOTEMPTY … rmdir …/projects/<id>` — a message that names a file
 * nobody in that test wrote, in a file that was not the one at fault.
 *
 * That has now been the same defect three times (`daemon.ts`'s `close` tells
 * the whole story): the sockets, the desk writes `engine.settled()` exists to
 * catch, and the metadata repair. Each was found as one incident and fixed as
 * one incident. So the guard here is deliberately written against the SHAPE
 * rather than against the backfill — it asks whether ANYTHING under the home
 * changes after `close()` has resolved, so the next background writer somebody
 * `void`s is caught by the test that already exists rather than by a teardown
 * three files away.
 */

let home: string;
let daemon: Daemon | null;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-shutdown-"));
  daemon = null;
});

afterEach(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function boot(): Promise<string> {
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}

/** Every file under `home`, with its bytes — the whole of what a shutdown
 * must leave alone. Paths are relative so two readings compare directly, and
 * the CONTENTS are read rather than the names alone because the write this
 * catches replaces a file that is already there (`writeFileAtomic` renames
 * its `.tmp-*` over the top, so a listing taken a moment later can be
 * identical while `project.json` has changed underneath it). */
async function tree(dir: string, rel = ""): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const key = path.join(rel, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of await tree(full, key)) out.set(k, v);
    } else {
      out.set(key, await fs.readFile(full, "utf8").catch(() => "<unreadable>"));
    }
  }
  return out;
}

/**
 * A home that has canvases with logs and NO activity stamp — which is the
 * one arrangement that gives the boot-time repair work to do, and therefore
 * the only one in which a daemon has a background writer running at the
 * moment somebody closes it.
 *
 * Eight of them, and that number is doing a job: the repair reads a log per
 * canvas, so a home with one canvas finishes it inside the boot and the race
 * closes by luck rather than by the fix. Eight is comfortably more than a
 * `close()` issued immediately after boot can get through, which is what
 * makes this test fail every time rather than most times.
 *
 * The stamp is stripped EXPLICITLY rather than relying on `project.create`
 * leaving it unset. A fixture that derives its precondition from the code
 * under test moves when that code moves (lessons #11), and the day
 * `project.create` starts stamping `lastOp` this test would go quietly
 * vacuous instead of red.
 */
async function homeOfUnstampedCanvases(count: number): Promise<string[]> {
  const base = await boot();
  const badge = await mintTestBadge(base);
  await badge.speakAs({ id: "usr_dion", name: "Dion" });
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `prj_${i}`;
    ids.push(id);
    const made = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({
        canvasId: null,
        actor: { id: "usr_dion", name: "Dion" },
        op: { type: "project.create", canvasId: id, title: `Canvas ${i}` },
      }),
    });
    expect(made.status).toBe(200);
  }
  await daemon!.close();
  daemon = null;

  for (const id of ids) {
    const file = p.canvasMetaFile(home, id);
    const meta = JSON.parse(await fs.readFile(file, "utf8")) as Canvas;
    delete (meta as { lastOp?: string }).lastOp;
    await fs.writeFile(file, JSON.stringify(meta, null, 2));
  }
  return ids;
}

describe("a daemon that says it is closed has stopped writing", () => {
  it("leaves the home byte-for-byte alone after close() resolves", async () => {
    const ids = await homeOfUnstampedCanvases(8);
    // The precondition, asserted rather than assumed: with a stamp already on
    // every canvas the repair does nothing, and a test that cannot make the
    // daemon write is a test whose answer cannot be no (lessons #14).
    for (const id of ids) {
      const meta = JSON.parse(await fs.readFile(p.canvasMetaFile(home, id), "utf8")) as Canvas;
      expect(meta.lastOp, `${id} must start without a stamp for this test to mean anything`)
        .toBeUndefined();
    }

    await boot();
    await daemon!.close();
    daemon = null;

    const atClose = await tree(home);
    // Long enough for a repair that was still walking to reach several more
    // canvases — it managed one in the 3ms between `close()` resolving and the
    // teardown that first caught this.
    await new Promise((r) => setTimeout(r, 500));
    const later = await tree(home);

    const changed = [...later]
      .filter(([file, bytes]) => atClose.get(file) !== bytes)
      .map(([file]) => file);
    expect(changed, "files written after close() resolved").toEqual([]);
    // Named separately because it is the symptom the teardown actually hit: a
    // half-finished atomic write, sitting in a directory somebody is removing.
    expect([...later.keys()].filter((f) => path.basename(f).startsWith(".tmp-"))).toEqual([]);
  });

  it("closes without waiting out the whole home — the repair is cut short, not drained", async () => {
    // The other half of the fix, and the reason `close()` cannot simply await
    // the repair: a home of any size must still shut down promptly. Cutting
    // the walk short at a canvas boundary is what buys that, and the visible
    // consequence is that some canvases are still unstamped afterwards.
    //
    // Asserted as "not all of them", never as a count or a duration: how far
    // the walk gets is a race by design, and a test that pinned it would fail
    // on a fast machine for being fast. What it must never be is ALL of them,
    // which is what draining would give.
    const ids = await homeOfUnstampedCanvases(40);
    await boot();
    await daemon!.close();
    daemon = null;

    const stamped = await Promise.all(
      ids.map(async (id) => {
        const meta = JSON.parse(await fs.readFile(p.canvasMetaFile(home, id), "utf8")) as Canvas;
        return meta.lastOp !== undefined;
      }),
    );
    expect(stamped.filter(Boolean).length).toBeLessThan(ids.length);
  });

  it("waits for the repair write already in flight, rather than for luck", async () => {
    /**
     * The half the filesystem test above cannot see, and the reason it cannot:
     * reading the tree is itself asynchronous, so a straggler that lands in the
     * microseconds after `close()` resolves is already on disk by the time the
     * first snapshot is taken. Dropping the `await` and keeping only the flag
     * passes that test every time — `close()` does enough other work
     * afterwards (`app.close()`, `engine.settled()`, `desk.close()`) that one
     * more canvas usually finishes inside it. **Usually** is the whole
     * problem: it makes a shutdown guarantee into an accident of how much
     * teardown happens to stand between the flag and the return.
     *
     * So this asks the question directly — did any repair write finish after
     * `close()` resolved — and makes the race DETERMINISTIC instead of
     * probable by giving each write a delay far longer than the rest of
     * teardown. A test that only fails when the timing goes the wrong way is
     * an anecdote (lessons #4).
     */
    const WRITE_MS = 400;
    await homeOfUnstampedCanvases(8);

    const finished: number[] = [];
    const realSave = FileStore.prototype.saveCanvas;
    const spy = vi
      .spyOn(FileStore.prototype, "saveCanvas")
      .mockImplementation(async function (this: FileStore, canvas) {
        await new Promise((r) => setTimeout(r, WRITE_MS));
        await realSave.call(this, canvas);
        finished.push(performance.now());
      });

    try {
      await boot();
      // Long enough to be INSIDE the first repair write when the close lands —
      // otherwise there is no write in flight and the test asserts nothing.
      await new Promise((r) => setTimeout(r, WRITE_MS / 4));
      await daemon!.close();
      daemon = null;
      const closedAt = performance.now();

      // Give a straggler every chance to appear before believing there is none.
      await new Promise((r) => setTimeout(r, WRITE_MS * 3));
      // The answer must be able to be no: with nothing written at all this
      // would pass while proving nothing (lessons #14).
      expect(finished.length, "the repair must actually write for this to mean anything")
        .toBeGreaterThan(0);
      expect(
        finished.filter((at) => at > closedAt).length,
        "repair writes that finished after close() resolved",
      ).toBe(0);
    } finally {
      spy.mockRestore();
    }
  });
});
