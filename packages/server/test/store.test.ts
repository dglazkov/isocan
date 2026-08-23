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
      await fs.rm(home, { recursive: true, force: true });
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
    await fs.rm(home, { recursive: true, force: true });
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
    await store.softDeleteProject("prj_1");
    const parked = await fs.readdir(p.deletedProjectsDir(home));
    expect(parked).toHaveLength(1);
    expect(parked[0]!.startsWith("prj_1-")).toBe(true);
    // The directory is gone, so the id is available again. The cloud backing
    // says the opposite — its ops are still there and a freed seq is exactly
    // what it must never produce — and that is the one place the two backings
    // differ in what they ALLOW. Canvas ids are minted, never chosen, so
    // nothing reaches it; it is pinned on both sides so nobody discovers it.
    expect(await store.projectExists("prj_1")).toBe(false);
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
