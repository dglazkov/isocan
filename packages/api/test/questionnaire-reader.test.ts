import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import type { DesignQuestionSet, DesignResponse, PostOpResponse, QuestionnaireOperation } from "@isocan/core";
import { questionnaireQuestionMarkdown } from "@isocan/core/questionnaire";
import { answerDesignQuestions, askDesignQuestions, questionnaireSubmissionIds, questionnaireFailureStatus, readDesignQuestions, readDesignReference, type QuestionnairePort, type QuestionnaireReferencePort } from "@isocan/api/questionnaire";
import { alice, apply, seedState } from "../../core/test/helpers.ts";

const home = "https://acme.example";
const source = { threadId: "thr_acme", commentId: "cmt_ask", payloadId: "qset_acme", revision: 1 };
const questionSet = (): DesignQuestionSet => ({ schemaVersion: 1, kind: "questions", requestId: "req_acme", epoch: 1, id: source.payloadId, revision: 1, brief: { home, canvasId: "prj_test", itemId: "itm_brief", versionId: "ver_brief", blobHash: "a".repeat(64) }, respondentActorId: alice.id, headline: "Acme receiving", inferredAnswers: [], supersedes: null, questions: [{ id: "workflow", title: "How do staff receive stock?", consequence: "Determines the confirmation step.", renderer: "choice-list", options: [{ id: "scan", title: "Scan", consequence: "Review at the end." }, { id: "confirm", title: "Confirm", consequence: "Review every item." }], multiple: false, skippable: true, delegatable: true }] });
const answer = (): DesignResponse => ({ schemaVersion: 1, kind: "response", requestId: "req_acme", epoch: 1, id: "answer_acme", question: source, respondentActorId: alice.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["scan"] } }], supersedesResponseId: null });
const receipt = (op: QuestionnaireOperation, id: string): PostOpResponse => ({ seq: 7, envelope: { id, canvasId: "prj_test", actor: alice, ts: "2026-09-14T00:00:00.000Z", op } });

it("uses stable retry IDs and compares the full canonical accepted receipt", async () => {
  const ids = await questionnaireSubmissionIds("answer", "answer_acme");
  expect(await questionnaireSubmissionIds("answer", "answer_acme")).toEqual(ids);
  expect(await questionnaireSubmissionIds("ask", "answer_acme")).not.toEqual(ids);
  const send: QuestionnairePort["send"] = async (_id, op, options) => ({ status: "accepted", receipt: receipt(op, options.opId) });
  const request = { canvasId: "prj_test", threadId: source.threadId, response: answer(), ...ids };
  expect(await answerDesignQuestions({ send, actorId: alice.id }, request)).toMatchObject({ status: "accepted", payloadId: "answer_acme", seq: 7, ...ids });
});

it.each(["wrong-content", "missing-operation", "wrong-actor", "wrong-canvas", "lowered-reply"])("never calls a %s receipt an accepted answer", async mismatch => {
  const ids = await questionnaireSubmissionIds("answer", "answer_acme");
  const send: QuestionnairePort["send"] = async (_id, op, options) => {
    const accepted = receipt(structuredClone(op), options.opId);
    if (mismatch === "wrong-content" && accepted.envelope.op.type === "questionnaire.answer") accepted.envelope.op.response.resolutions = [{ questionId: "workflow", state: "skipped" }];
    if (mismatch === "missing-operation") accepted.envelope.id = "";
    if (mismatch === "wrong-actor") accepted.envelope.actor = { id: "usr_other", name: "Other" };
    if (mismatch === "wrong-canvas") accepted.envelope.canvasId = "prj_other";
    if (mismatch === "lowered-reply") accepted.envelope.op = { type: "thread.reply", threadId: source.threadId, comment: { id: ids.commentId, body: "Answer" } };
    return { status: "accepted", receipt: accepted };
  };
  expect(await answerDesignQuestions({ send }, { canvasId: "prj_test", threadId: source.threadId, response: answer(), ...ids })).toMatchObject({ status: "pending", reason: expect.stringContaining("no matching questionnaire receipt"), opId: null, submittedOpId: ids.opId, commentId: ids.commentId });
});

it("preserves failed submission IDs and distinguishes refusal from transport uncertainty", async () => {
  const ids = await questionnaireSubmissionIds("ask", "qset_acme"), request = { canvasId: "prj_test", threadId: source.threadId, questions: questionSet(), ...ids };
  const refused = await askDesignQuestions({ send: async () => ({ status: "refused", reason: "Respondent is not eligible" }) }, request);
  expect(refused).toMatchObject({ status: "refused", reason: "Respondent is not eligible", opId: null, submittedOpId: ids.opId, commentId: ids.commentId });
  expect(await askDesignQuestions({ send: async () => { throw new Error("Connection lost after send"); } }, request)).toMatchObject({ status: "pending", reason: "Connection lost after send", opId: null, submittedOpId: ids.opId, commentId: ids.commentId });
  const send = vi.fn();
  await expect(askDesignQuestions({ send }, { ...request, questions: { ...questionSet(), questions: [{}] } as never })).rejects.toThrow();
  expect(send).not.toHaveBeenCalled();
});

it("can recover a lost acknowledgement only from the exact writer-stamped answer", async () => {
  const ids = await questionnaireSubmissionIds("answer", "answer_acme");
  let state = seedState();
  state = apply(state, { type: "thread.create", threadId: source.threadId, x: 0, y: 0, anchorItemId: null, comment: { id: ids.commentId, body: "Acme answer" } })!;
  const comment = state.canvas.threads[source.threadId]!.comments[0]!;
  comment.design = answer(); comment.designReferences = [];
  const request = { canvasId: "prj_test", threadId: source.threadId, response: answer(), ...ids };
  const io: QuestionnairePort = { actorId: alice.id, send: async () => ({ status: "pending", reason: "Lost acknowledgement" }), snapshot: async () => state };
  expect(await answerDesignQuestions(io, { ...request, opId: "op_changed_retry" })).toMatchObject({ status: "accepted", confirmedBy: "snapshot", opId: null, submittedOpId: "op_changed_retry", commentId: ids.commentId });
  comment.author = { id: "usr_other", name: "Other" };
  expect(await answerDesignQuestions(io, request)).toMatchObject({ status: "pending", opId: null, submittedOpId: ids.opId, commentId: ids.commentId });
  comment.author = alice;
  (comment.design as DesignResponse).resolutions = [{ questionId: "workflow", state: "skipped" }];
  expect(await answerDesignQuestions(io, request)).toMatchObject({ status: "pending", opId: null, submittedOpId: ids.opId, commentId: ids.commentId });
});

it("reports the original canonical receipt ID on a retry with another submitted operation ID", async () => {
  const ids = await questionnaireSubmissionIds("answer", "answer_acme");
  const result = await answerDesignQuestions({ actorId: alice.id, send: async (_canvasId, op) => ({ status: "accepted", receipt: receipt(op, "op_original") }) }, { canvasId: "prj_test", threadId: source.threadId, response: answer(), ...ids });
  expect(result).toMatchObject({ status: "accepted", confirmedBy: "receipt", opId: "op_original", submittedOpId: ids.opId });
});

it("uses authoritative joins to recognize original authored receipts and snapshots without rewriting authorship", async () => {
  const ids = await questionnaireSubmissionIds("answer", "answer_acme"), currentActor = "usr_canonical";
  const original = answer(), request = { canvasId: "prj_test", threadId: source.threadId, response: original, ...ids };
  let state = seedState();
  state = apply(state, { type: "thread.create", threadId: source.threadId, x: 0, y: 0, anchorItemId: null, comment: { id: ids.commentId, body: "Acme answer" } })!;
  const comment = state.canvas.threads[source.threadId]!.comments[0]!;
  comment.design = original; comment.designReferences = [];
  const acceptedPort: QuestionnairePort = { actorId: currentActor, snapshot: async () => ({ canvas: state.canvas, joined: { [alice.id]: currentActor } }), send: async (_id, op) => ({ status: "accepted", receipt: receipt(op, "op_original") }) };
  expect(await answerDesignQuestions(acceptedPort, request)).toMatchObject({ status: "accepted", opId: "op_original", submittedOpId: ids.opId });
  expect(await answerDesignQuestions({ ...acceptedPort, send: async () => ({ status: "pending", reason: "lost" }) }, request)).toMatchObject({ status: "accepted", opId: null, confirmedBy: "snapshot" });
  expect(comment.author).toEqual(alice);
  expect(comment.design.respondentActorId).toBe(alice.id);
  expect(await answerDesignQuestions({ ...acceptedPort, snapshot: async () => { throw new Error("Join map unavailable"); } }, request)).toMatchObject({ status: "pending", opId: null });
});

it("classifies explicit writer refusal separately from an unconfirmed server or network failure", () => {
  for (const status of [400, 401, 403, 404, 409, 410, 413, 415, 422, 426]) expect(questionnaireFailureStatus({ status })).toBe("refused");
  for (const error of [{ status: 408 }, { status: 500 }, { status: 503 }, { status: 504 }, new Error("network"), null]) expect(questionnaireFailureStatus(error)).toBe("pending");
});

function attachedReference() {
  const bytes = Buffer.from("Acme sketch: receiving and stock lookup are separate.\n");
  const hash = createHash("sha256").update(bytes).digest("hex");
  let state = seedState();
  state = apply(state, { type: "item.add", itemId: "itm_sketch", version: { id: "ver_sketch", blobHash: hash, mimeType: "text/plain", filename: "Acme-sketch.txt", size: bytes.length }, width: 200, height: 100, placement: { x: 0, y: 0 }, title: "Acme sketch" })!;
  state = apply(state, { type: "thread.create", threadId: source.threadId, x: 0, y: 0, anchorItemId: null, comment: { id: "cmt_answer", body: "References" } })!;
  const comment = state.canvas.threads[source.threadId]!.comments[0]!;
  const artifact = { home, canvasId: "prj_test", itemId: "itm_sketch", versionId: "ver_sketch", blobHash: hash };
  comment.design = { ...answer(), resolutions: [{ questionId: "sketch", state: "answered", value: { kind: "references", references: [{ id: "ref_sketch", state: "fetched", artifact }] } }] };
  comment.designReferences = [{ artifact, version: state.canvas.items.itm_sketch!.versions[0]! }];
  // The live item is gone. The saved version is the authority, never a current item lookup.
  delete state.canvas.items.itm_sketch;
  const io: QuestionnaireReferencePort = { snapshot: async () => state, home: async () => home, blobBytes: async () => bytes };
  return { io, state, bytes, artifact, comment, request: { threadId: source.threadId, commentId: "cmt_answer", referenceId: "ref_sketch" } };
}

it("opens retained immutable bytes after item removal and rejects bytes from a different version", async () => {
  const { io, bytes, artifact, request } = attachedReference();
  const result = await readDesignReference(io, "prj_test", request);
  expect(result.artifact).toEqual(artifact);
  expect(Buffer.from(result.bytes)).toEqual(bytes);
  await expect(readDesignReference({ ...io, blobBytes: async () => Buffer.from("Other revision") }, "prj_test", request)).rejects.toThrow("do not match");
  await expect(readDesignReference({ ...io, home: async () => "https://other.example" }, "prj_test", request)).rejects.toThrow("another home or canvas");
});

it("refuses ambiguous reference IDs and supplied URLs instead of fetching or choosing another question's reference", async () => {
  const { io, comment, request } = attachedReference();
  const response = comment.design as DesignResponse;
  response.resolutions.push({ ...structuredClone(response.resolutions[0]!), questionId: "second-sketch" });
  await expect(readDesignReference(io, "prj_test", request)).rejects.toThrow("more than one question");
  response.resolutions = [{ questionId: "url", state: "answered", value: { kind: "references", references: [{ id: "ref_sketch", state: "supplied", url: "https://acme.invalid/reference" }] } }];
  const download = vi.fn(io.blobBytes);
  await expect(readDesignReference({ ...io, blobBytes: download }, "prj_test", request)).rejects.toThrow("supplied");
  expect(download).not.toHaveBeenCalled();
});

it("uses the shared resolver so ordinary progress replies cannot become typed answers", async () => {
  let state = seedState();
  const questions = questionSet();
  state = apply(state, { type: "item.add", itemId: "itm_brief", version: { id: "ver_brief", blobHash: questions.brief.blobHash, mimeType: "application/json", filename: "brief.json", size: 100 }, width: 200, height: 100, placement: { x: 0, y: 0 }, title: "Acme brief" })!;
  state = apply(state, { type: "thread.create", threadId: source.threadId, x: 0, y: 0, anchorItemId: null, comment: { id: source.commentId, body: questionnaireQuestionMarkdown(questions) } })!;
  state.canvas.threads[source.threadId]!.comments[0]!.design = questions;
  state = apply(state, { type: "thread.reply", threadId: source.threadId, comment: { id: "cmt_progress", body: "Still working" } })!;
  const result = await readDesignQuestions({ snapshot: async () => state }, "prj_test", { respondentActorId: alice.id });
  expect(result).toMatchObject([{ status: "open", outstandingQuestionIds: ["workflow"], responses: [] }]);
});
