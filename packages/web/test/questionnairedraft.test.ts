import { describe, expect, it } from "vitest";
import type { DesignQuestion, DesignQuestionSet, DesignQuestionSource } from "@isocan/core";
import { emptyQuestionDraft, questionDraftResolution, questionnaireDraftKey, readQuestionnaireDraft, reconcileQuestionnaireDraft, transferQuestionnaireDraft, unavailableChoiceMessage } from "../src/lib/questionnairedraft.ts";
const source: DesignQuestionSource = { threadId: "t", commentId: "c", payloadId: "p", revision: 1 };
const ref = { home: "http://localhost:3000", canvasId: "canvas", itemId: "brief", versionId: "v", blobHash: "a".repeat(64) };
const question = (id: string, renderer: DesignQuestion["renderer"] = "freeform"): DesignQuestion => ({ id, title: id, consequence: "Changes the primary task", renderer, options: renderer === "choice-list" ? [{ id: "a", title: "A", consequence: "Scan continuously" }, { id: "b", title: "B", consequence: "Confirm each item" }] : [], multiple: false, skippable: true, delegatable: true });
const payload = (questions = [question("one"), question("two")]): DesignQuestionSet => ({ schemaVersion: 1, kind: "questions", requestId: "r", epoch: 1, id: "p", revision: 1, brief: ref, respondentActorId: "human", headline: "Task decisions", inferredAnswers: [], questions, supersedes: null });
const load = (value: unknown) => readQuestionnaireDraft({ getItem: () => JSON.stringify(value) }, "key");

describe("questionnaire draft recovery", () => {
  it("keeps each question's text, URLs and upload state across serialization", () => {
    const p = payload([question("first", "url-collection"), question("second", "url-collection"), question("notes")]);
    const draft = reconcileQuestionnaireDraft(null, p, source);
    draft.questions.first!.references = [{ id: "r1", url: "https://example.invalid/first", state: "supplied" }];
    draft.questions.second!.urlInput = "https://example.invalid/second";
    draft.questions.notes!.text = "Keep the receiving task separate.";
    draft.currentQuestionId = "notes";
    const reopened = reconcileQuestionnaireDraft(load(draft), p, source);
    expect(reopened).toEqual(draft);
    expect(questionDraftResolution(p.questions[1]!, reopened.questions.second!)).toBeNull();
    expect(questionDraftResolution(p.questions[0]!, reopened.questions.first!)).toMatchObject({ value: { references: [{ id: "r1" }] } });
  });
  it("isolates actor, canvas and exact immutable source", () => {
    const p = payload();
    const key = questionnaireDraftKey("canvas", "human", p, source);
    expect(questionnaireDraftKey("canvas", "other", p, source)).not.toBe(key);
    expect(questionnaireDraftKey("other", "human", p, source)).not.toBe(key);
    expect(questionnaireDraftKey("canvas", "human", p, { ...source, revision: 2 })).not.toBe(key);
    const old = reconcileQuestionnaireDraft(null, p, source); old.questions.one!.text = "Do not silently copy.";
    expect(reconcileQuestionnaireDraft(old, p, { ...source, commentId: "new" }).questions.one!.text).toBe("");
  });
  it.each([null, [], { state: "uploading" }, { id: "filename-only" }])("rejects corrupt nested uploads: %j", (upload) => {
    const draft = reconcileQuestionnaireDraft(null, payload(), source);
    (draft.questions.one!.uploads as unknown[]) = [upload];
    expect(load(draft)).toBeNull();
  });
  it("rejects malformed references, sources and submissions before rendering", () => {
    const draft = reconcileQuestionnaireDraft(null, payload(), source);
    expect(load({ ...draft, source: { threadId: "t" } })).toBeNull();
    expect(load({ ...draft, submission: { opId: "op", commentId: "c", response: { kind: "response" } } })).toBeNull();
    draft.questions.one!.references = [{ id: "bad", state: "fetched" }];
    expect(load(draft)).toBeNull();
  });
  it("offers explicit transfer and flags changed or removed choices without silently replacing them", () => {
    const original = payload([question("choice", "choice-list"), question("retained"), question("removed")]);
    const draft = reconcileQuestionnaireDraft(null, original, source);
    draft.questions.choice!.optionIds = ["b"]; draft.questions.retained!.text = "A compatible answer.";
    const revised = payload([question("choice", "choice-list"), question("retained")]);
    revised.questions[0]!.options[1] = { id: "c", title: "C", consequence: "A changed structure" };
    const newSource = { ...source, commentId: "reissued", payloadId: "reissued", revision: 2 };
    const copied = transferQuestionnaireDraft(draft, revised, newSource);
    expect(copied.questions.choice!.optionIds).toEqual(["b"]);
    expect(copied.questions.choice!.needsReview).toBe(true);
    expect(unavailableChoiceMessage(revised.questions[0]!, copied.questions.choice!)).toContain("Earlier choices are no longer offered: B.");
    expect(questionDraftResolution(revised.questions[0]!, copied.questions.choice!)).toBeNull();
    expect(copied.questions.retained!.text).toBe("A compatible answer.");
    expect(copied.questions.removed).toBeUndefined();
    expect(copied.submission).toBeNull();
  });
  it.each(["not json", '{"id":"other","options":[]}', '{"id":"choice","options":[null]}'])("uses a plain fallback for unavailable or invalid prior option labels: %s", (previousFingerprint) => {
    const q = question("choice", "choice-list");
    const draft = { ...emptyQuestionDraft(q), optionIds: ["removed_internal_id"], previousFingerprint };
    expect(unavailableChoiceMessage(q, draft)).toBe("An earlier choice is no longer available. Choose a current option or write your own answer.");
  });
  it("restores interrupted uploads as retryable and keeps actual byte identity", () => {
    const p = payload([question("sketch", "upload")]);
    const draft = reconcileQuestionnaireDraft(null, p, source);
    draft.questions.sketch!.uploads = [{ id: "reference", fileKey: "saved-bytes", name: "sketch.svg", mimeType: "image/svg+xml", size: 10, itemId: "item", versionId: "v", opId: "op", destination: { originGroupMode: "groups", containerId: "area" }, state: "uploading", blobHash: "b".repeat(64) }];
    const recovered = reconcileQuestionnaireDraft(load(draft), p, source);
    expect(recovered.questions.sketch!.uploads[0]).toMatchObject({ state: "failed", fileKey: "saved-bytes", opId: "op", blobHash: "b".repeat(64) });
    expect(questionDraftResolution(p.questions[0]!, recovered.questions.sketch!)).toBeNull();
  });
  it("rejects a ready upload whose retained reference names different bytes or versions", () => {
    const p = payload([question("sketch", "upload")]);
    const draft = reconcileQuestionnaireDraft(null, p, source);
    draft.questions.sketch!.uploads = [{ id: "reference", fileKey: "saved-bytes", name: "sketch.svg", mimeType: "image/svg+xml", size: 10, itemId: "item", versionId: "v", opId: "op", destination: { originGroupMode: "groups" }, state: "ready", blobHash: "b".repeat(64), reference: { id: "reference", state: "fetched", artifact: { ...ref, itemId: "item", versionId: "other", blobHash: "b".repeat(64) } } }];
    expect(load(draft)).toBeNull();
    draft.questions.sketch!.uploads[0]!.reference!.artifact!.versionId = "v";
    expect(load(draft)).not.toBeNull();
  });
  it("requires explicit skip, dismiss and agent delegation outcomes", () => {
    const q = question("task"); const draft = emptyQuestionDraft(q);
    expect(questionDraftResolution(q, draft)).toBeNull();
    expect(questionDraftResolution(q, { ...draft, resolution: "skipped" })).toEqual({ questionId: "task", state: "skipped" });
    expect(questionDraftResolution({ ...q, skippable: false }, { ...draft, resolution: "skipped" })).toBeNull();
    expect(questionDraftResolution(q, { ...draft, resolution: "delegated" })).toBeNull();
    expect(questionDraftResolution(q, { ...draft, resolution: "delegated", agentActorId: "designer" })).toEqual({ questionId: "task", state: "delegated", agentActorId: "designer" });
  });
});
