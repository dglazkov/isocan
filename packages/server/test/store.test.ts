import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { collect, seed, storeConformance } from "../../../test/conformance/store-conformance.ts";
import { FileStore } from "../src/file-store.ts";
import * as p from "../src/paths.ts";

/**
 * The file backing, against the shared `Store` conformance suite plus the
 * things only a disk can be asked.
 *
 * Everything general moved into `test/conformance/store-conformance.ts` and
 * runs against both backings from there, which is what the phase's Proof line
 * asks for. What stays here is what is genuinely about FILES: that the
 * snapshot keeps pace (which the cloud backing is explicitly allowed not to
 * do), that a soft delete really is a directory moved aside, and that the
 * bytes land at the path the layout comment promises.
 */

storeConformance("FileStore", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-store-"));
  let store = new FileStore(home);
  await store.init();
  return {
    store,
    reopen: async () => {
      await store.close();
      store = new FileStore(home);
      await store.init();
      return store;
    },
    done: async () => {
      await store.close();
      await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
});

describe("FileStore — what only a disk can be asked", () => {
  let home: string;
  let store: FileStore;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-store-"));
    store = new FileStore(home);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("the snapshot keeps pace with the log — a file boot replays nothing", async () => {
    // The conformance suite asserts CONVERGENCE rather than an empty
    // `recoveredSeqs`, because a backing may debounce its snapshot and the
    // cloud one does. This backing does not, and that is worth pinning: on a
    // disk, `writeFileAtomic` per op is cheap and recovery stays exceptional.
    await seed(store);
    const loaded = await store.load("prj_1");
    expect(loaded!.recoveredSeqs).toEqual([]);
  });

  it("stores blob bytes at the path the layout promises", async () => {
    await seed(store);
    const data = Buffer.from("# hello\n");
    const { blobHash } = await store.putBlob("prj_1", data, {
      mimeType: "text/markdown",
      filename: "a.md",
    });
    const onDisk = path.join(p.blobsDir(home, "prj_1"), `${blobHash}.md`);
    expect(await fs.readFile(onDisk, "utf8")).toBe("# hello\n");
    // …and the stream the seam hands out is reading that same file.
    expect(await collect(await store.openBlob("prj_1", blobHash))).toEqual(data);
  });

  it("soft-deletes by moving the directory aside, which frees the id again", async () => {
    await seed(store);
    await store.softDeleteCanvas("prj_1");
    const parked = await fs.readdir(p.deletedCanvasesDir(home));
    expect(parked).toHaveLength(1);
    expect(parked[0]!.startsWith("prj_1-")).toBe(true);
    // The directory is gone, so the id is available again. The cloud backing
    // says the opposite — its ops are still there and a freed seq is exactly
    // what it must never produce — and that is the one place the two backings
    // differ in what they ALLOW. Canvas ids are minted, never chosen, so
    // nothing reaches it; it is pinned on both sides so nobody discovers it.
    expect(await store.canvasExists("prj_1")).toBe(false);
  });

  it("purges to a directory holding only the tombstone and the two marks — never deleted-projects/", async () => {
    /**
     * The file backing's prefix delete (operator phase 3). An owner's delete
     * moves the directory aside, recoverable by hand; a purge is the act whose
     * point is that nothing under the id is recoverable from this home. So
     * what is left is `project.json` (the tombstone that keeps the id taken),
     * `takendown.json` (the flag) and `purged.json` (the mark) — and NOT a
     * copy parked under `deleted-projects/`.
     */
    await seed(store);
    await store.putBlob("prj_1", Buffer.from("evidence"), { mimeType: "text/plain", filename: "e.txt" });
    await store.setTakenDown("prj_1", "2026-09-12T10:00:00.000Z");
    const report = await store.purgeCanvas("prj_1");
    // canvas.json, trash.json, oplog.jsonl, blobs.json, and one blob file.
    expect(report.objects).toBe(5);
    expect(report.files).toBe(1);
    expect(report.ops).toBe(3);
    expect(report.keeps, "a disk keeps nothing behind it").toEqual([]);
    expect((await fs.readdir(p.canvasDir(home, "prj_1"))).sort()).toEqual([
      "project.json",
      "purged.json",
      "takendown.json",
    ]);
    expect(await fs.readdir(p.deletedCanvasesDir(home))).toEqual([]);
    expect(await store.canvasExists("prj_1")).toBe(true);
    expect(await store.tipSeq("prj_1"), "the tip of an erased log is zero, not null: the id is taken").toBe(0);
  });

  it("compaction rewrites the live log and appends to the archive file", async () => {
    await seed(store);
    const loaded = await store.load("prj_1");
    const retained = loaded!.entries.filter((entry) => entry.seq === 3);
    const dropped = loaded!.entries.filter((entry) => entry.seq !== 3);
    await store.compactOplog("prj_1", retained, dropped);

    const live = await fs.readFile(p.oplogFile(home, "prj_1"), "utf8");
    expect(live.trim().split("\n")).toHaveLength(1);
    const archive = await fs.readFile(p.oplogArchiveFile(home, "prj_1"), "utf8");
    expect(archive.trim().split("\n")).toHaveLength(2);
  });

  it("has no upload ticket to give, at any size — the split is the cloud's", async () => {
    await seed(store);
    const request = {
      blobHash: "f".repeat(64),
      mimeType: "video/mp4",
      filename: "clip.mp4",
      size: 400 * 1024 * 1024,
    };
    expect(await store.beginUpload("prj_1", request)).toBeNull();
    await expect(store.registerBlob("prj_1", request)).rejects.toThrow(/nothing to register/);
  });
});
