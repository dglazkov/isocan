import { describe, expect, it } from "vitest";
import { applyOperation } from "../src/reducer.ts";
import { invertOperation } from "../src/invert.ts";
import {
  DESIGN_PARTNER_DECISION_PROPERTY, designPartnerPolicy, parseDesignBrief,
  parseDesignDecision, parseDesignPartnerRecord, parseDesignQuestionSet,
  parseDesignReceipt, parseDesignReference, parseDesignResponse,
  type DesignArtifactRef, type DesignBrief, type DesignDecision,
  type DesignQuestionSet, type DesignReceipt, type DesignResponse,
} from "../src/design-partner.ts";
import {
  planDesignAnswer, planDesignDecision, validateDesignResponseAssociation,
  type DesignQuestionContext,
} from "../src/design-partner-plan.ts";
import { alice, apply, bob, envelope, normalize, seedState } from "./helpers.ts";

const home = "https://example.test";
const ref = (itemId = "itm_brief", versionId = "ver_brief", character = "a"): DesignArtifactRef => ({ home, canvasId: "prj_test", itemId, versionId, blobHash: character.repeat(64) });
const brief = (): DesignBrief => ({ schemaVersion: 1, kind: "brief", requestId: "req_inventory", epoch: 1, requestingActorId: alice.id,
  source: { entrance: "canvas-chat", threadId: "thr_1", commentId: "cmt_1" },
  progress: "active", intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null,
  audience: null, primaryTask: "Receive stock", constraints: ["Works on a phone"],
  facts: [{ id: "fact_mobile", name: "Device", value: "Phone", origin: "supplied", sources: [] }],
  context: { canvasId: "prj_test", revision: 1, rootIds: [], expandedIds: [], includeExcluded: false, ambient: true, entries: [], counts: { included: 0, excluded: 0, unavailable: 0 } },
  references: [], outstandingDecisionIds: ["workflow"], outputIds: [],
});
const questions = (): DesignQuestionSet => ({ schemaVersion: 1, kind: "questions", requestId: "req_inventory", epoch: 1, id: "qset_inventory", revision: 1, brief: ref(), respondentActorId: alice.id, headline: "Shape the receiving workflow", inferredAnswers: [], supersedes: null,
  questions: [{ id: "workflow", title: "How should receiving work?", consequence: "Changes the review step.", renderer: "choice-list", options: [{ id: "scan", title: "Scan continuously", consequence: "Review the batch before saving." }, { id: "confirm", title: "Confirm each item", consequence: "More taps, immediate confirmation." }], multiple: false, skippable: true, delegatable: true, recommendedOptionId: "scan" }],
});
const source = { threadId: "thr_1", commentId: "cmt_1", payloadId: "qset_inventory", revision: 1 };
const context = (): DesignQuestionContext => ({ request: { brief: brief(), ref: ref() }, questions: questions(), source, sourceStatus: "current" });
const response = (): DesignResponse => ({ schemaVersion: 1, kind: "response", id: "answer_inventory", requestId: "req_inventory", epoch: 1, question: { ...source }, respondentActorId: alice.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["scan"] } }], supersedesResponseId: null });
const actor = { actorId: alice.id, kind: "human" as const };
const answerInput = () => ({ response: response(), context: context(), actor, commentId: "cmt_answer", opId: "op_answer" });

function designState() {
  let state = seedState();
  for (const [itemId, versionId, character, mimeType] of [
    ["itm_brief", "ver_brief", "a", "application/json"],
    ["itm_target", "ver_target", "b", "text/html"],
    ["itm_scan", "ver_scan", "c", "text/html"],
    ["itm_confirm", "ver_confirm", "d", "text/html"],
  ]) {
    state = apply(state, { type: "item.add", itemId: itemId!, version: { id: versionId!, blobHash: character!.repeat(64), mimeType: mimeType!, filename: `${itemId}.html`, size: 100 }, width: 300, height: 200, placement: { x: 0, y: 0 }, title: itemId! })!;
  }
  return state;
}
const decision = (): DesignDecision => ({ schemaVersion: 1, kind: "decision", id: "dec_inventory", requestId: "req_inventory", epoch: 1, brief: ref(), questionId: "workflow", uncertainty: "structure",
  alternatives: [{ id: "scan", hypothesis: "Batch review lowers repeated input.", fidelity: "wireframe", artifact: ref("itm_scan", "ver_scan", "c") }, { id: "confirm", hypothesis: "Immediate review reduces individual mistakes.", fidelity: "wireframe", artifact: ref("itm_confirm", "ver_confirm", "d") }],
  chosenAlternativeId: "scan", recommendedAlternativeId: "scan", recommendation: "Batch review fits repeat scanning.", tradeoff: "Review errors before committing the batch.", reason: "Warehouse staff receive complete deliveries.", decidingActorId: alice.id, attribution: "human-choice", delegationResponseId: null, adoption: { targetItemId: "itm_target", expectedVersionId: "ver_target", versionId: "ver_adopted" }, supersedesDecisionId: null,
});
const decisionInput = () => ({ decision: decision(), request: { brief: { ...brief(), targetItemId: "itm_target" } as DesignBrief, ref: ref() }, actor, canvas: designState().canvas, home, opId: "op_decision" });
const receipt = (): DesignReceipt => ({ schemaVersion: 1, kind: "receipt", requestId: "req_inventory", epoch: 1, id: "receipt_inventory", brief: ref(), output: { kind: "canvas", artifact: ref("itm_target", "ver_adopted", "c") }, context: [ref()], fidelity: "designed", status: "ready", checks: [{ id: "check_receive", kind: "browser-task", tool: "synthetic-browser", toolVersion: "1", result: "passed", coverage: "Receive and correct stock in this synthetic task.", state: "saved", viewport: { width: 390, height: 844 }, evidence: [ref("itm_evidence", "ver_evidence", "e")] }], unresolved: [] });

describe("design-partner record schemas", () => {
  it("round-trips the five record kinds without turning shape validation into proof", () => {
    for (const value of [brief(), questions(), response(), decision(), receipt()]) expect(parseDesignPartnerRecord(value)).toEqual(value);
  });
  it.each([{}, { questions: [{}] }, { ...questions(), questions: [{}] }, { ...questions(), questions: [] }, { ...questions(), schemaVersion: 2 }])("rejects malformed questionnaire payload %j", (value) => {
    expect(() => parseDesignQuestionSet(value)).toThrow();
  });
  it("rejects unknown semantics at the top level and inside options", () => {
    expect(() => parseDesignQuestionSet({ ...questions(), autoApprove: true })).toThrow("Unknown field");
    const value = questions();
    const q = value.questions[0]!;
    expect(() => parseDesignQuestionSet({ ...value, questions: [{ ...q, options: [{ ...q.options[0], execute: "run arbitrary instructions" }, q.options[1]] }] })).toThrow("Unknown field");
    expect(() => parseDesignResponse({ ...response(), authority: "human" })).toThrow("Unknown field");
  });
  it("requires unique stable IDs and bounds explicit interviews independently of the initial three-question policy", () => {
    const value = questions(), q = value.questions[0]!;
    expect(() => parseDesignQuestionSet({ ...value, questions: [q, q] })).toThrow("Repeated identity");
    expect(parseDesignQuestionSet({ ...value, questions: [1, 2, 3, 4].map((i) => ({ ...q, id: `q_${i}` })) }).questions).toHaveLength(4);
    expect(() => parseDesignQuestionSet({ ...value, questions: Array.from({ length: 33 }, (_, i) => ({ ...q, id: `q_${i}` })) })).toThrow("bounded array");
    expect(() => parseDesignQuestionSet({ ...value, questions: [{ ...q, options: [q.options[0], q.options[0]] }] })).toThrow("Repeated identity");
  });
  it("requires real previews instead of palette swatches for visual choices", () => {
    const value = questions(), q = value.questions[0]!;
    const visual = { ...q, renderer: "visual-cards" };
    expect(() => parseDesignQuestionSet({ ...value, questions: [visual] })).toThrow("actual version previews");
    expect(parseDesignQuestionSet({ ...value, questions: [{ ...visual, options: q.options.map((o) => ({ ...o, preview: ref() })) }] }).questions[0]!.renderer).toBe("visual-cards");
  });
  it("does not accept filenames, claimed fetches without bytes, unsafe URLs or fake hashes", () => {
    for (const value of [
      { id: "reference", state: "fetched", filename: "sketch.png" },
      { id: "reference", state: "fetched", url: "https://example.test/sketch" },
      { id: "reference", state: "supplied", url: "javascript:alert(1)" },
      { id: "reference", state: "fetched", artifact: { ...ref(), blobHash: "sketch.png" } },
      { id: "reference", state: "inaccessible", url: "https://example.test/sketch" },
    ]) expect(() => parseDesignReference(value)).toThrow();
    expect(parseDesignReference({ id: "reference", state: "inaccessible", url: "https://example.test/sketch", reason: "Access refused." }).state).toBe("inaccessible");
  });
  it("keeps missing facts, assumed facts and unavailable reference states explicit", () => {
    const value = brief();
    value.facts.push({ id: "assumed_audience", name: "Audience", value: "Warehouse staff", origin: "assumed", sources: [] });
    const parsed = parseDesignBrief(value);
    expect(parsed.audience).toBeNull();
    expect(parsed.facts[1]!.origin).toBe("assumed");
    expect(() => parseDesignBrief({ ...value, context: { ...value.context, counts: { included: 1, excluded: 0, unavailable: 0 } } })).toThrow("context counts");
  });
  it("does not equate skipped/delegated with answered", () => {
    expect(() => parseDesignResponse({ ...response(), resolutions: [{ questionId: "workflow", state: "skipped", value: { kind: "text", text: "Approved" } }] })).toThrow("not an answer");
    expect(() => parseDesignResponse({ ...response(), resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: [] } }] })).toThrow("at least one");
  });
  it("cannot mark an unavailable browser or a critical defect ready", () => {
    const value = receipt(), check = value.checks[0]!;
    expect(() => parseDesignReceipt({ ...value, checks: [{ ...check, result: "unavailable", evidence: [], viewport: null }] })).toThrow("Ready cannot");
    expect(() => parseDesignReceipt({ ...value, checks: [{ ...check, evidence: [] }] })).toThrow("retrievable evidence");
    expect(() => parseDesignReceipt({ ...value, unresolved: [{ severity: "critical", description: "Save does not work." }] })).toThrow("Ready cannot");
    expect(parseDesignReceipt({ ...value, status: "draft", checks: [{ ...check, result: "unavailable", evidence: [], viewport: null }] }).status).toBe("draft");
  });
  it("requires build identity for connected applications", () => {
    expect(() => parseDesignReceipt({ ...receipt(), output: { kind: "repository", repository: "synthetic-app", revision: "abc", runtimeUrl: "http://localhost:3000" } })).toThrow();
  });
  it("defaults rollout off and reports unsupported values", () => {
    expect(designPartnerPolicy({})).toBe("off");
    expect(designPartnerPolicy({ "design.workflow": "off" })).toBe("off");
    expect(designPartnerPolicy({ "design.workflow": "adaptive-v1" })).toBe("adaptive-v1");
    expect(designPartnerPolicy({ "design.workflow": "magic" })).toBe("unsupported");
  });
});

describe("design answer association and materialization", () => {
  it.each(["agent", "unknown"] as const)("does not mistake a %s actor for a human respondent", (kind) => {
    expect(() => validateDesignResponseAssociation(response(), context(), { actorId: alice.id, kind })).toThrow("intended human");
  });
  it("refuses spoofed respondents and another participant's answer", () => {
    expect(() => validateDesignResponseAssociation(response(), context(), { actorId: bob.id, kind: "human" })).toThrow("intended human");
    expect(() => validateDesignResponseAssociation({ ...response(), respondentActorId: bob.id }, context(), actor)).toThrow("intended human");
  });
  it("checks the request, epoch, brief version, source comment and question revision", () => {
    for (const changed of [
      { ...response(), requestId: "req_other" }, { ...response(), epoch: 2 },
      { ...response(), question: { ...source, commentId: "cmt_other" } },
      { ...response(), question: { ...source, revision: 2 } },
    ]) expect(() => validateDesignResponseAssociation(changed, context(), actor)).toThrow();
    const stale = context(); stale.request.ref.versionId = "ver_new";
    expect(() => validateDesignResponseAssociation(response(), stale, actor)).toThrow("different brief");
  });
  it("refuses canceled requests and removed or superseded questions", () => {
    const canceled = context(); canceled.request.brief.progress = "cancelled";
    expect(() => validateDesignResponseAssociation(response(), canceled, actor)).toThrow("no longer active");
    for (const sourceStatus of ["removed", "superseded"] as const) expect(() => validateDesignResponseAssociation(response(), { ...context(), sourceStatus }, actor)).toThrow("removed or superseded");
  });
  it("checks current option identity, multiple-choice semantics and skip policy", () => {
    for (const optionIds of [["removed"], ["scan", "confirm"]]) expect(() => validateDesignResponseAssociation({ ...response(), resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds } }] }, context(), actor)).toThrow();
    const required = context(); required.questions.questions[0]!.skippable = false;
    expect(() => validateDesignResponseAssociation({ ...response(), resolutions: [{ questionId: "workflow", state: "skipped" }] }, required, actor)).toThrow("cannot be skipped");
  });
  it("requires successful upload identities before accepting attachment answers", () => {
    const upload = context(); upload.questions.questions = [{ id: "workflow", title: "Attach a sketch", consequence: "Use the receiving flow.", renderer: "upload", options: [], multiple: false, skippable: true, delegatable: false }];
    const withReferences = (references: unknown[]) => ({ ...response(), resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "references", references } }] });
    expect(() => validateDesignResponseAssociation(withReferences([{ id: "sketch", state: "supplied", url: "https://example.test/sketch" }]), upload, actor)).toThrow("retrievable uploaded");
    expect(validateDesignResponseAssociation(withReferences([{ id: "sketch", state: "fetched", artifact: ref() }]), upload, actor).resolutions).toHaveLength(1);
  });
  it("accepts explicit freeform, dismissal and delegation without inventing approval", () => {
    for (const resolution of [{ questionId: "workflow", state: "answered", value: { kind: "text", text: "Use a review queue." } }, { questionId: "workflow", state: "dismissed" }, { questionId: "workflow", state: "delegated", agentActorId: "agent_acme" }]) {
      expect(validateDesignResponseAssociation({ ...response(), resolutions: [resolution] }, context(), actor).resolutions[0]).toEqual(resolution);
    }
  });
  it("materializes one undoable ordinary reply while clearly withholding the unwired typed wire act", () => {
    const plan = planDesignAnswer(answerInput());
    if (plan.kind !== "answer-materialization") throw new Error("expected new answer");
    expect(plan.design).toEqual(response());
    expect(plan.guard).toMatchObject({ requestId: "req_inventory", epoch: 1, question: source });
    expect(plan.reply.comment.body).toContain("Scan continuously");
    const state = seedState(), inverse = invertOperation(state, plan.reply)!;
    const materialized = applyOperation(state, envelope(plan.reply))!;
    expect(materialized.canvas.threads.thr_1!.comments.at(-1)!.author.id).toBe(alice.id);
    expect(materialized.canvas.threads.thr_1!.comments.at(-1)).not.toHaveProperty("design");
    expect(normalize(applyOperation(materialized, envelope(inverse)))).toEqual(normalize(state));
    // Phase 1 must wire typed retention and refusal on old daemons. This test proves only the inner effect.
  });
  it("reuses identical responses, rejects changed retries and requires explicit supersession", () => {
    const input = answerInput();
    expect(planDesignAnswer({ ...input, previousResponses: [response()] })).toEqual({ kind: "already-recorded", responseId: "answer_inventory" });
    const changed = response(); changed.resolutions = [{ questionId: "workflow", state: "dismissed" }];
    expect(() => planDesignAnswer({ ...input, response: changed, previousResponses: [response()] })).toThrow("reused with different");
    changed.id = "answer_new";
    expect(() => planDesignAnswer({ ...input, response: changed, previousResponses: [response()] })).toThrow("supersede it explicitly");
    changed.supersedesResponseId = "answer_inventory";
    expect(planDesignAnswer({ ...input, response: changed, previousResponses: [response()] }).kind).toBe("answer-materialization");
    changed.supersedesResponseId = "other_answer";
    expect(() => planDesignAnswer({ ...input, response: changed, previousResponses: [response()] })).toThrow("does not belong");
  });
  it("recognizes an accepted retry after cancellation without applying new work", () => {
    const input = answerInput(); input.context.request.brief.progress = "cancelled"; input.context.request.brief.epoch = 2;
    expect(planDesignAnswer({ ...input, previousResponses: [response()] }).kind).toBe("already-recorded");
    expect(() => planDesignAnswer({ ...input, response: { ...response(), id: "new_answer" } })).toThrow("no longer active");
    input.context.request.brief.requestId = "req_other";
    expect(() => planDesignAnswer({ ...input, previousResponses: [response()] })).toThrow("another request");
  });
  it("does not lose another question's answer when one response is replaced", () => {
    const input = answerInput(), earlier = response();
    input.context.questions.questions.push({ ...questions().questions[0]!, id: "audience" });
    earlier.resolutions.push({ questionId: "audience", state: "answered", value: { kind: "text", text: "Warehouse staff" } });
    const replacement = { ...response(), id: "answer_revised", supersedesResponseId: earlier.id };
    expect(() => planDesignAnswer({ ...input, response: replacement, previousResponses: [earlier] })).toThrow("every previously answered");
    replacement.resolutions.push(earlier.resolutions[1]!);
    expect(planDesignAnswer({ ...input, response: replacement, previousResponses: [earlier] }).kind).toBe("answer-materialization");
  });
});

describe("one decision and adoption", () => {
  it("adopts content and decision in one real conditional edit and undoes both", () => {
    const state = designState(), input = decisionInput(), plan = planDesignDecision({ ...input, canvas: state.canvas });
    const inverse = invertOperation(state, plan.operation)!;
    const adopted = applyOperation(state, envelope(plan.operation))!;
    expect(adopted.canvas.items.itm_target!.currentVersionId).toBe("ver_adopted");
    expect(adopted.canvas.items.itm_target!.versions.at(-1)!.blobHash).toBe("c".repeat(64));
    expect(JSON.parse(adopted.canvas.items.itm_target!.properties[DESIGN_PARTNER_DECISION_PROPERTY]!)).toEqual(decision());
    for (const id of ["itm_brief", "itm_scan", "itm_confirm"]) expect(adopted.canvas.items[id]).toEqual(state.canvas.items[id]);
    expect(plan.guard.alternatives).toHaveLength(2);
    expect(normalize(applyOperation(adopted, envelope(inverse)))).toEqual(normalize(state));
  });
  it("keeps a greenfield winner as the target and versions its decision without deleting the comparison", () => {
    const input = decisionInput(); input.request.brief.targetItemId = null; input.decision.adoption = { targetItemId: "itm_scan", expectedVersionId: "ver_scan", versionId: "ver_selected" };
    const plan = planDesignDecision(input);
    expect(plan.operation).toMatchObject({ itemId: "itm_scan", type: "item.edit", version: { id: "ver_selected", blobHash: "c".repeat(64) } });
  });
  it("protects target version and metadata against intervening edits with the actual reducer", () => {
    const state = designState(), plan = planDesignDecision({ ...decisionInput(), canvas: state.canvas });
    const changed = apply(state, { type: "item.update", itemId: "itm_target", patch: { title: "Other actor changed it" } }, bob)!;
    expect(() => applyOperation(changed, envelope(plan.operation))).toThrow("changed while editing");
    expect(changed.canvas.items.itm_target!.currentVersionId).toBe("ver_target");
  });
  it("refuses missing/currently changed candidates, stale request epochs and incompatible targets", () => {
    const stale = decisionInput(); stale.canvas.items.itm_scan!.currentVersionId = "ver_other";
    expect(() => planDesignDecision(stale)).toThrow("alternative");
    const epoch = decisionInput(); epoch.request.brief.epoch = 2;
    expect(() => planDesignDecision(epoch)).toThrow("request has changed");
    const incompatible = decisionInput(); incompatible.request.brief.targetItemId = "itm_1"; incompatible.decision.adoption = { targetItemId: "itm_1", expectedVersionId: "ver_1b", versionId: "ver_new" };
    expect(() => planDesignDecision(incompatible)).toThrow("content type");
    const overwriteBrief = decisionInput(); overwriteBrief.decision.adoption = { targetItemId: "itm_brief", expectedVersionId: "ver_brief", versionId: "ver_new" };
    expect(() => planDesignDecision(overwriteBrief)).toThrow("replace its brief");
  });
  it("rejects unrelated target screens and decisions absent from the brief", () => {
    const unrelated = decisionInput(); unrelated.decision.adoption = { targetItemId: "itm_confirm", expectedVersionId: "ver_confirm", versionId: "ver_new" };
    expect(() => planDesignDecision(unrelated)).toThrow("brief's target");
    const greenfield = decisionInput(); greenfield.request.brief.targetItemId = null;
    expect(() => planDesignDecision(greenfield)).toThrow("selected candidate");
    expect(() => planDesignDecision({ ...decisionInput(), decision: { ...decision(), questionId: "unrelated_question" } })).toThrow("not outstanding");
  });
  it("does not manufacture a human preference from an unknown or agent actor", () => {
    for (const kind of ["agent", "unknown"] as const) expect(() => planDesignDecision({ ...decisionInput(), actor: { actorId: alice.id, kind } })).toThrow("known human");
    expect(() => planDesignDecision({ ...decisionInput(), actor: { actorId: bob.id, kind: "human" } })).toThrow("authenticated actor");
  });
  it("records a delegated agent choice only with the matching effective delegation", () => {
    const input = decisionInput(); input.decision.decidingActorId = "agent_acme"; input.decision.attribution = "delegated-agent"; input.decision.delegationResponseId = "answer_inventory";
    const agent = { actorId: "agent_acme", kind: "agent" as const };
    expect(() => planDesignDecision({ ...input, actor: agent })).toThrow("effective delegation");
    const delegation = response(); delegation.resolutions = [{ questionId: "workflow", state: "delegated", agentActorId: agent.actorId }];
    expect(planDesignDecision({ ...input, actor: agent, delegation }).operation.patch.properties![DESIGN_PARTNER_DECISION_PROPERTY]).toContain("delegated-agent");
    delegation.epoch = 2;
    expect(() => planDesignDecision({ ...input, actor: agent, delegation })).toThrow("effective delegation");
  });
  it("rejects unequal fidelity and inconsistent recommendation IDs", () => {
    const value = decision(); value.alternatives[1]!.fidelity = "designed";
    expect(() => parseDesignDecision(value)).toThrow("same fidelity");
    expect(() => parseDesignDecision({ ...decision(), recommendedAlternativeId: "invented" })).toThrow("unknown alternative");
  });
});
