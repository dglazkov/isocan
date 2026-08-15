import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LogEntry, OpEnvelope, Operation, ProjectState } from "@isocan/core";
import { applyOperation, invertOperation } from "@isocan/core";
import { Store } from "../src/store.ts";
import * as p from "../src/paths.ts";

const actor = { id: "usr_test", name: "Tester" };
let opCounter = 0;

function envelope(op: Operation): OpEnvelope {
  opCounter += 1;
  return {
    id: `op_${opCounter}`,
    projectId: op.type === "project.create" ? null : "prj_1",
    actor,
    ts: new Date(Date.UTC(2026, 0, 1) + opCounter * 1000).toISOString(),
    op,
  };
}

let home: string;
let store: Store;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-store-"));
  store = new Store(home);
  await store.init();
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

/** Apply + persist an op the way the engine will: log first, then snapshot. */
async function commit(
  state: ProjectState | null,
  op: Operation,
  seq: number,
): Promise<ProjectState> {
  const env = envelope(op);
  const inverse = state === null && op.type === "project.create" ? null : invertOperation(state, op);
  const next = applyOperation(state, env)!;
  const entry: LogEntry = { seq, envelope: env, inverse };
  if (op.type === "project.create") await store.createProjectDir("prj_1");
  await store.appendLog("prj_1", entry);
  await store.saveSnapshot("prj_1", next, seq);
  return next;
}

async function seedOnDisk(): Promise<ProjectState> {
  let s = await commit(null, { type: "project.create", projectId: "prj_1", title: "P" }, 1);
  s = await commit(
    s,
    {
      type: "item.add",
      itemId: "itm_1",
      version: { id: "ver_1", blobHash: "h1", mimeType: "text/markdown", filename: "a.md", size: 5 },
      width: 100,
      height: 100,
      placement: { x: 10, y: 20 },
    },
    2,
  );
  s = await commit(s, { type: "item.move", itemId: "itm_1", x: 99, y: 88 }, 3);
  return s;
}

describe("Store", () => {
  it("persists and reloads a project exactly", async () => {
    const state = await seedOnDisk();
    const loaded = await store.load("prj_1");
    expect(loaded).not.toBeNull();
    expect(loaded!.state).toEqual(state);
    expect(loaded!.lastSeq).toBe(3);
    expect(loaded!.entries).toHaveLength(3);
    expect(loaded!.recoveredSeqs).toEqual([]);
  });

  it("lists projects", async () => {
    await seedOnDisk();
    const projects = await store.listProjects();
    expect(projects.map((pr) => pr.id)).toEqual(["prj_1"]);
  });

  it("recovers from a crash by replaying the oplog tail", async () => {
    const state = await seedOnDisk();
    // Simulate a crash after the oplog appends but before the snapshot
    // writes: roll the snapshot back to its true seq-1 state (empty canvas,
    // project just created) and replay 2..3 → exact state.
    const empty = { lastSeq: 1, items: {}, threads: {} };
    await fs.writeFile(p.canvasFile(home, "prj_1"), JSON.stringify(empty));
    const recovered = await store.load("prj_1");
    expect(recovered!.recoveredSeqs).toEqual([2, 3]);
    expect(recovered!.state).toEqual(state);
    // …and the snapshot was healed on disk.
    const healed = await store.load("prj_1");
    expect(healed!.recoveredSeqs).toEqual([]);
    expect(healed!.state).toEqual(state);
  });

  it("stores blobs content-addressed with dedup", async () => {
    await seedOnDisk();
    const data = Buffer.from("# hello\n");
    const a = await store.putBlob("prj_1", data, { mimeType: "text/markdown", filename: "a.md" });
    const b = await store.putBlob("prj_1", data, { mimeType: "text/markdown", filename: "copy.md" });
    expect(a.blobHash).toBe(b.blobHash);
    expect(a.size).toBe(data.length);

    const blob = await store.getBlob("prj_1", a.blobHash);
    expect(blob).not.toBeNull();
    expect(blob!.path.endsWith(`${a.blobHash}.md`)).toBe(true);
    expect(await fs.readFile(blob!.path, "utf8")).toBe("# hello\n");
    expect(blob!.meta.filename).toBe("a.md"); // first upload wins the metadata

    expect(await store.getBlob("prj_1", "deadbeef")).toBeNull();
  });

  it("soft-deletes projects by moving the directory aside", async () => {
    await seedOnDisk();
    await store.softDeleteProject("prj_1");
    expect(await store.load("prj_1")).toBeNull();
    expect(await store.listProjects()).toEqual([]);
    const parked = await fs.readdir(p.deletedProjectsDir(home));
    expect(parked).toHaveLength(1);
    expect(parked[0]!.startsWith("prj_1-")).toBe(true);
  });

  it("returns null for unknown projects", async () => {
    expect(await store.load("prj_nope")).toBeNull();
  });
});
