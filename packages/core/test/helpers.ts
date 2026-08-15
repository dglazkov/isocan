import type {
  Actor,
  NewVersion,
  OpEnvelope,
  Operation,
  ProjectState,
} from "../src/index.ts";
import { applyOperation } from "../src/index.ts";

export const alice: Actor = { id: "usr_alice", name: "Alice" };
export const bob: Actor = { id: "usr_bob", name: "Bob" };

let opCounter = 0;

export function envelope(op: Operation, actor: Actor = alice): OpEnvelope {
  opCounter += 1;
  return {
    id: `op_${opCounter}`,
    projectId: op.type === "project.create" ? null : "prj_test",
    actor,
    ts: new Date(Date.UTC(2026, 0, 1) + opCounter * 1000).toISOString(),
    op,
  };
}

export function apply(
  state: ProjectState | null,
  op: Operation,
  actor: Actor = alice,
): ProjectState | null {
  return applyOperation(state, envelope(op, actor));
}

export function nv(id: string): NewVersion {
  return {
    id,
    blobHash: `hash_${id}`,
    mimeType: "text/markdown",
    filename: `${id}.md`,
    size: 10,
  };
}

/**
 * A representative state: a project, two live items (one with two versions),
 * an anchored thread with two comments, a freestanding thread, and one item
 * already in the trash.
 */
export function seedState(): ProjectState {
  let s = apply(null, {
    type: "project.create",
    projectId: "prj_test",
    title: "Test project",
    description: "seed",
    properties: { env: "dev" },
  });
  s = apply(s, {
    type: "item.add",
    itemId: "itm_1",
    version: nv("ver_1"),
    width: 200,
    height: 150,
    placement: { x: 100, y: 100 },
    title: "One",
    properties: { kind: "note" },
  });
  s = apply(s, {
    type: "item.add",
    itemId: "itm_2",
    version: nv("ver_2"),
    width: 300,
    height: 200,
    placement: { x: 500, y: 120 },
  });
  s = apply(s, { type: "item.addVersion", itemId: "itm_1", version: nv("ver_1b") }, bob);
  s = apply(s, {
    type: "thread.create",
    threadId: "thr_1",
    x: 150,
    y: 150,
    anchorItemId: "itm_1",
    comment: { id: "cmt_1", body: "First!" },
  });
  s = apply(s, { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_2", body: "Reply" } }, bob);
  s = apply(s, {
    type: "thread.create",
    threadId: "thr_2",
    x: -50,
    y: 300,
    anchorItemId: null,
    comment: { id: "cmt_3", body: "Freestanding" },
  });
  s = apply(s, {
    type: "item.add",
    itemId: "itm_trashed",
    version: nv("ver_t"),
    width: 100,
    height: 100,
    placement: { x: 0, y: 0 },
  });
  s = apply(s, { type: "item.delete", itemId: "itm_trashed" });
  return s!;
}

/**
 * Undo restores content, not audit stamps (the undoer really did perform a
 * mutation), so round-trip comparisons strip updatedAt/updatedBy and the
 * trash's deletedAt/deletedBy.
 */
export function normalize(value: unknown): unknown {
  const AUDIT_KEYS = new Set(["updatedAt", "updatedBy", "deletedAt", "deletedBy"]);
  return JSON.parse(
    JSON.stringify(value, (key, v) => (AUDIT_KEYS.has(key) ? undefined : v)),
  );
}
