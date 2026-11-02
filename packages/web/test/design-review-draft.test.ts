import { expect, it, vi } from "vitest";
import type { PreparedDesignReviewWrite } from "@isocan/api/design-review";
import { designReviewHandoffKey, keepDesignReviewHandoff, readDesignReviewHandoffDraft, type DesignReviewHandoffDraft } from "../src/lib/design-review-draft.ts";

const prepared: PreparedDesignReviewWrite = {
  schemaVersion: 1, canvasId: "prj_review", actorId: "usr_person", opId: "op_request_review", originGroupMode: "groups", text: null,
  operation: { type: "thread.create", threadId: "thread_review", anchorItemId: "item_brief", x: 80, y: 100, comment: { id: "comment_review", body: "/ask @Acme Please verify the saved receiving review.", mentions: ["usr_verifier"] } },
  handoff: { runId: "run_review", offer: { home: "https://acme.invalid", canvasId: "prj_review", itemId: "item_offer", versionId: "ver_offer", blobHash: "a".repeat(64) } },
};
const draft: DesignReviewHandoffDraft = { schemaVersion: 1, canvasId: "prj_review", actorId: "usr_person", requestId: "request_review", prepared, state: "pending", result: null };
const read = (value: unknown, actor = "usr_person") => readDesignReviewHandoffDraft(JSON.stringify(value), "prj_review", actor, "request_review");

it("recovers an external-task handoff's original thread creation without another destination or actor", async () => {
  const recovered = await read(draft);
  expect(recovered.prepared).toEqual(prepared);
  await expect(read(draft, "usr_other")).rejects.toThrow("owner");
  expect(designReviewHandoffKey("prj_review", "usr_person", "request_review")).not.toBe(designReviewHandoffKey("prj_review", "usr_other", "request_review"));
});

it("keeps accepted identity separate from unavailable follow-up evidence after refresh", async () => {
  const saved: DesignReviewHandoffDraft = { ...draft, state: "accepted", result: { status: "accepted", submittedOpId: prepared.opId, opId: prepared.opId, consistency: { status: "unavailable", reasons: ["The writer accepted the request; later history could not be read."] } } };
  expect((await read(saved)).result).toEqual(saved.result);
  await expect(read({ ...saved, result: { ...saved.result, submittedOpId: "op_unrelated" } })).rejects.toThrow("malformed");
  await expect(read({ ...saved, result: { ...saved.result, consistency: { status: "unavailable", reasons: [null] } } })).rejects.toThrow("consistency");
});

it("malformed nested handoff metadata cannot be used and persistence failure remains a send blocker", async () => {
  await expect(read({ ...draft, prepared: { ...prepared, handoff: { runId: "run_review", offer: null } } })).rejects.toThrow();
  await expect(read({ ...draft, prepared: { ...prepared, operation: { type: "thread.create" } } })).rejects.toThrow();
  const storage = { setItem: vi.fn(() => { throw new Error("storage full"); }) };
  expect(() => keepDesignReviewHandoff(storage, designReviewHandoffKey(draft.canvasId, draft.actorId, draft.requestId), draft)).toThrow("storage full");
});
