import { createHash } from "node:crypto";
import { applyOperation, invertOperation, resolveCanvasGroupRequest, resolveContextOperation, contextManifest, ambientContextManifest, contextContentPage, canvasGroupMigrationPreview, resolveCanvasGroupMigration } from "@isocan/core";
import type { Actor, CanvasSnapshotResponse, CanvasState, GroupAction, OpEnvelope, Operation, PostOpResponse } from "@isocan/core";
import { CanvasGroups } from "../src/canvas-groups.ts";

/** In-memory transport only: state, resolution and undo use the actual shared production reducer. */
export function groupFixture(enabled = true, canvasId = "prj_acme") {
  const actor = { id: "usr_acme", name: "Acme" };
  const ts = "2026-09-12T15:00:00.000Z";
  let count = 0;
  let state = applyOperation(null, { id: "op_birth", canvasId, actor, ts, op: { type: "project.create", canvasId, title: "Acme Board", groupMode: enabled ? "groups" : "legacy" } })!;
  const writes: Array<{ envelope: OpEnvelope; inverse: Operation | null }> = [];
  const blobs = new Map<string, Buffer>();
  let beforeWrite: (() => void) | undefined;
  const apply = (op: Operation): void => { state = applyOperation(state, { id: `op_local${++count}`, canvasId: state.project.id, actor, ts, op })!; };
  const commit = async (request: Operation, who: Actor, opId?: string): Promise<PostOpResponse> => {
    beforeWrite?.(); beforeWrite = undefined;
    const id = opId ?? `op_write${++count}`;
    const op = request.type === "group.change" && request.action.kind === "migrate"
      ? resolveCanvasGroupMigration(state, writes.length, request.action, { actor: who, ts, opId: id })
      : resolveCanvasGroupRequest(state, resolveContextOperation(state, writes.length, request), { actor: who, ts, opId: id });
    const envelope: OpEnvelope = { id, canvasId: state.project.id, actor: who, ts, op };
    const inverse = invertOperation(state, op);
    state = applyOperation(state, envelope)!;
    writes.push({ envelope, inverse });
    return { seq: writes.length, envelope };
  };
  const client = {
    base: "https://acme.invalid",
    snapshot: async (): Promise<CanvasSnapshotResponse> => ({ ...state, lastSeq: writes.length, colors: {}, names: {} }),
    groupMigrationPreview: async () => canvasGroupMigrationPreview(state, writes.length),
    listCanvases: async () => [state.project],
    listSessions: async () => [],
    contextManifest: async (_canvasId: string, request?: import("@isocan/core").ContextRequest) => request ? contextManifest(state, writes.length, request) : ambientContextManifest(state, writes.length),
    commentContext: async (_canvasId: string, threadId: string, commentId: string) => {
      const saved = state.canvas.threads[threadId]?.comments.find((comment) => comment.id === commentId)?.context;
      if (!saved) throw new Error("no saved context");
      return structuredClone(saved);
    },
    contextContentPage: async (_canvasId: string, options: import("../src/canvas-context.ts").ContextPageOptions) => {
      const saved = options.threadId ? await client.commentContext(_canvasId, options.threadId, options.commentId!) : await client.contextManifest(_canvasId, { rootIds: [...(options.rootIds ?? [])], ...(options.includeExcluded !== undefined ? { includeExcluded: options.includeExcluded } : {}), ...(options.expectedRevision !== undefined ? { expectedRevision: options.expectedRevision } : {}) });
      return contextContentPage(saved, { ...(options.offset !== undefined ? { offset: options.offset } : {}), ...(options.limit !== undefined ? { limit: options.limit } : {}), ...(options.face ? { face: options.face } : {}) });
    },
    sendOp: async (_canvasId: string | null, who: Actor, op: Operation) => commit(op, who),
    downloadBlob: async (_canvasId: string, hash: string) => blobs.get(hash) ?? Buffer.from("Acme content"),
    uploadBlob: async (_canvasId: string, bytes: Buffer, _mime: string, _filename: string) => {
      const blobHash = createHash("sha256").update(bytes).digest("hex");
      blobs.set(blobHash, bytes);
      return { blobHash, size: bytes.length, mimeType: _mime };
    },
    changeGroup: async (_canvasId: string, who: Actor, action: Exclude<GroupAction, { kind: "apply" }>, opId?: string): Promise<PostOpResponse> => {
      return commit({ type: "group.change", action }, who, opId);
    },
  };
  return {
    actor, client, blobs, writes,
    api: new CanvasGroups(client, state.project.id, actor),
    get state(): CanvasState { return state; },
    setBeforeWrite(callback: () => void) { beforeWrite = callback; },
    apply,
    card(id: string, title = id, x = 100, y = 200) {
      apply({ type: "item.add", itemId: id, title, width: 400, height: 400, placement: { x, y, chosen: true }, version: { id: `ver_${id}`, blobHash: `hash_${id}`, mimeType: "text/markdown", filename: `${id}.md`, size: 20 } });
    },
    undo() { const inverse = writes.at(-1)?.inverse; if (!inverse) throw new Error("nothing to undo"); apply(inverse); },
  };
}
