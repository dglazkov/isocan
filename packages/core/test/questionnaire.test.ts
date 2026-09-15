import { describe, expect, it } from "vitest";
import type { DesignQuestionSet, DesignResponse } from "../src/design-partner.ts";
import { legacyQuestionSet, parseLegacyQuestionnaire, questionnaireStates, validateQuestionnaireComment } from "../src/questionnaire.ts";
import { openAsks } from "../src/roster.ts";
import { dispatchReason } from "../src/inbox.ts";
import { invertOperation } from "../src/invert.ts";
import { alice, apply, bob, seedState } from "./helpers.ts";

const source = { threadId: "thr_1", commentId: "cmt_design", payloadId: "qset_acme", revision: 1 };
const questions: DesignQuestionSet = { schemaVersion: 1, kind: "questions", requestId: "req_acme", epoch: 1, id: source.payloadId, revision: 1, brief: { home: "https://example.test", canvasId: "prj_test", itemId: "itm_brief", versionId: "ver_brief", blobHash: "a".repeat(64) }, respondentActorId: alice.id, headline: "Choose the inventory flow", inferredAnswers: [], supersedes: null, questions: [{ id: "workflow", title: "Where should review happen?", consequence: "Changes the review step", renderer: "choice-list", options: [{ id: "batch", title: "Review a batch", consequence: "Fewer taps" }, { id: "each", title: "Review each item", consequence: "Earlier corrections" }], multiple: false, skippable: true, delegatable: true }] };
const response: DesignResponse = { schemaVersion: 1, kind: "response", id: "answer_acme", requestId: questions.requestId, epoch: 1, question: source, respondentActorId: alice.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["batch"] } }], supersedesResponseId: null };
function seeded() {
  const state = apply(seedState(), { type: "item.add", itemId: "itm_brief", title: "Acme brief", width: 200, height: 200, placement: { x: 0, y: 0 }, version: { id: "ver_brief", blobHash: "a".repeat(64), mimeType: "application/json", filename: "brief.json", size: 42 } })!;
  return apply(state, { type: "questionnaire.ask", threadId: source.threadId, commentId: source.commentId, questions, retainedReferences: [{ artifact: questions.brief, version: state.canvas.items.itm_brief!.versions[0]! }] }, bob)!;
}
const answerOp = { type: "questionnaire.answer" as const, threadId: source.threadId, commentId: "cmt_answer", response, retainedReferences: [] };
const legacy = { headline: "Design direction", questions: [{ id: "direction", title: "Choose a direction", renderer: "visual-cards", options: [{ id: "a", title: "Quiet", colors: ["#fff"] }, { id: "b", title: "Bold", colors: ["#123456"] }] }] };

describe("shared questionnaire projection", () => {
  it("keeps unanswered questions and agent standing open across unrelated replies, then derives explicit outcomes", () => {
    let state = seeded();
    state = apply(state, { type: "thread.reply", threadId: source.threadId, comment: { id: "cmt_noise", body: "I am checking the layout." } }, alice)!;
    expect(questionnaireStates(state.canvas)[0]?.status).toBe("open");
    expect(openAsks(state.canvas)).toEqual([expect.objectContaining({ commentId: source.commentId, askerId: bob.id })]);
    state = apply(state, answerOp)!;
    expect(questionnaireStates(state.canvas)[0]).toMatchObject({ status: "answered", outstandingQuestionIds: [], responses: [{ author: alice, response }] });
    expect(openAsks(state.canvas)).toEqual([]);
  });

  it("undoes one answer and restores its original metadata and author on redo", () => {
    const before = seeded();
    const answered = apply(before, answerOp)!;
    const undo = invertOperation(before, answerOp);
    expect(undo).toEqual({ type: "comment.remove", threadId: source.threadId, commentId: "cmt_answer" });
    const redo = invertOperation(answered, undo!);
    const undone = apply(answered, undo!)!;
    expect(questionnaireStates(undone.canvas)[0]?.status).toBe("open");
    const restored = apply(undone, redo!, bob)!;
    expect(restored.canvas.threads.thr_1!.comments.at(-1)).toEqual(answered.canvas.threads.thr_1!.comments.at(-1));
  });

  it("reports changed source or brief as stale without erasing accepted responses; undo restores source freshness", () => {
    const answered = apply(seeded(), answerOp)!;
    const edit = { type: "comment.update" as const, threadId: source.threadId, commentId: source.commentId, body: "Changed the question" };
    const changed = apply(answered, edit, bob)!;
    expect(questionnaireStates(changed.canvas)[0]).toMatchObject({ status: "stale", responses: [{ response }] });
    const restored = apply(changed, invertOperation(answered, edit)!, bob)!;
    expect(questionnaireStates(restored.canvas)[0]?.status).toBe("answered");
    const canceled = apply(answered, { type: "item.addVersion", itemId: "itm_brief", version: { id: "ver_canceled", blobHash: "b".repeat(64), mimeType: "application/json", filename: "brief.json", size: 43 } })!;
    expect(questionnaireStates(canceled.canvas)[0]).toMatchObject({ status: "stale", responses: [{ response }] });
  });

  it("uses canonical joins for filtering without rewriting intended respondent or author", () => {
    const state = seeded();
    const rows = questionnaireStates(state.canvas, { respondentActorId: "usr_joined", joined: { [alice.id]: "usr_joined" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.questions.respondentActorId).toBe(alice.id);
    expect(rows[0]?.author).toEqual(bob);
  });

  it("does not associate a same-comment-ID answer in a different thread", () => {
    const state = apply(seeded(), answerOp)!;
    state.canvas.threads.thr_2!.comments.push({ ...state.canvas.threads.thr_1!.comments.at(-1)!, id: "cmt_other" });
    expect(questionnaireStates(state.canvas)[0]?.responses).toHaveLength(1);
  });

  it("dispatches a typed human answer through the ordinary main-thread reason", () => {
    const state = apply(apply(seeded(), { type: "thread.setMain", threadId: source.threadId })!, answerOp)!;
    expect(dispatchReason(answerOp, alice.id, { actorId: bob.id, names: [], rules: null }, state.canvas)).toBe("main-thread");
  });

  it("refuses raw comment metadata smuggling in the shared reducer, including valid-looking payloads", () => {
    const state = seeded();
    expect(() => apply(state, { type: "thread.reply", threadId: source.threadId, comment: { id: "cmt_forged", body: "Fake", design: questions } } as never)).toThrow(/writer-owned/);
    expect(() => apply(state, { type: "comment.update", threadId: source.threadId, commentId: source.commentId, body: "Fake", design: questions } as never, bob)).toThrow(/writer-owned/);
  });

  it("refuses incomplete or mismatched retained references on canonical replay", () => {
    const comment = seeded().canvas.threads.thr_1!.comments.at(-1)!;
    for (const invalid of [[], [{ ...comment.designReferences![0]!, artifact: { ...questions.brief, blobHash: "b".repeat(64) } }], [{ ...comment.designReferences![0]!, inventedRule: true }]]) {
      expect(() => validateQuestionnaireComment({ ...comment, designReferences: invalid }, "prj_test")).toThrow();
    }
  });
});

describe("legacy questionnaire read and explicit adoption", () => {
  it("keeps valid cards readable and converts swatches honestly to ordinary choices", () => {
    const parsed = parseLegacyQuestionnaire(`/ask ${JSON.stringify(legacy)}`)!;
    expect(parsed).toEqual(legacy);
    const adopted = legacyQuestionSet(parsed, questions);
    expect(adopted.questions[0]).toMatchObject({ renderer: "choice-list", options: [{ id: "a" }, { id: "b" }] });
    expect(adopted.respondentActorId).toBe(alice.id);
  });
  it.each(["/ask {", "/ask null", "/ask []", `/ask ${JSON.stringify({ ...legacy, silentlyApprove: true })}`, `/ask ${JSON.stringify({ questions: [{ ...legacy.questions[0], options: [{ id: "a", title: "Only one" }] }] })}`, `/ask ${JSON.stringify({ questions: [{ ...legacy.questions[0], options: [legacy.questions[0]!.options[0], legacy.questions[0]!.options[0]] }] })}`])("leaves malformed legacy data as readable text: %s", (body) => expect(parseLegacyQuestionnaire(body)).toBeNull());
  it("does not treat later prose as an answer to structured legacy questions", () => {
    let state = apply(seedState(), { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_legacy", body: `/ask ${JSON.stringify(legacy)}` } }, bob)!;
    state = apply(state, { type: "thread.reply", threadId: "thr_1", comment: { id: "cmt_progress", body: "Checking the design" } })!;
    expect(openAsks(state.canvas)[0]?.commentId).toBe("cmt_legacy");
  });
});
