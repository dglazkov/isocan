import { afterEach, expect, it } from "vitest";
import { CanvasHandle, answerDesignQuestions, questionnairePort, questionnaireSubmissionIds } from "@isocan/api";
import type { DesignResponse } from "@isocan/core";
import { questionnaireFixture } from "./questionnaire-fixture.ts";

let fixture: Awaited<ReturnType<typeof questionnaireFixture>> | undefined;
afterEach(async () => { await fixture?.close(); fixture = undefined; });

it("publishes through the API, enforces the named respondent, retries once and undoes one answer", async () => {
  const f = fixture = await questionnaireFixture();
  const ids = await questionnaireSubmissionIds("ask", f.questions.id);
  const published = await f.agentCanvas.designAsk({ ...ids, threadId: f.original.threadId, questions: f.questions });
  expect(published.status).toBe("accepted");
  const actors = await f.agentCanvas.designRespondents();
  expect(actors.actors).toEqual(expect.arrayContaining([{ id: f.person.actor.id, name: f.person.actor.name, kind: "human" }, { id: f.agent.actor.id, name: f.agent.actor.name, kind: "agent" }]));
  await f.otherCanvas.reply(f.original.threadId, "Checking the data shape.");
  const [state] = await f.personCanvas.designQuestions();
  expect(state).toMatchObject({ status: "open", outstandingQuestionIds: ["workflow"], responses: [] });
  const response: DesignResponse = { schemaVersion: 1, kind: "response", requestId: f.brief.requestId, epoch: 1, id: "answer_acme_workflow", question: state!.source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "options", optionIds: ["batch"] } }], supersedesResponseId: null };
  const submission = { ...await questionnaireSubmissionIds("answer", response.id), threadId: f.original.threadId, response };
  expect((await f.otherCanvas.designAnswer(submission)).status).toBe("refused");
  const before = await f.client.snapshot(f.canvasId);
  const accepted = await f.personCanvas.designAnswer(submission);
  expect(accepted.status).toBe("accepted");
  expect(await f.personCanvas.designAnswer(submission)).toEqual(accepted);
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before.lastSeq + 1);
  expect((await f.agentCanvas.designQuestions())[0]).toMatchObject({ status: "answered", responses: [{ commentId: submission.commentId, response: { id: response.id } }] });
  const changed: DesignResponse = { ...response, resolutions: [{ questionId: "workflow", state: "skipped" }] };
  expect((await f.personCanvas.designAnswer({ ...submission, response: changed })).status).toBe("refused");
  await f.client.undo(f.canvasId, f.person.actor);
  expect((await f.agentCanvas.designQuestions())[0]).toMatchObject({ status: "open", responses: [] });
  await f.client.redo(f.canvasId, f.person.actor);
  expect((await f.agentCanvas.designQuestions())[0]).toMatchObject({ status: "answered", responses: [{ response: { id: response.id }, author: f.person.actor }] });
});

it("retains two explicit versions of one upload and rejects a stale question without adding an answer", async () => {
  const f = fixture = await questionnaireFixture();
  f.questions.questions = [{ id: "sketch", title: "Show the receiving layout", consequence: "Informs structure.", renderer: "upload", options: [], multiple: false, skippable: true, delegatable: false }];
  const ask = { ...await questionnaireSubmissionIds("ask", f.questions.id), threadId: f.original.threadId, questions: f.questions };
  expect((await f.agentCanvas.designAsk(ask)).status).toBe("accepted");
  const bytes1 = "Acme sketch one: receiving beside lookup.\n", bytes2 = "Acme sketch two: receiving before lookup.\n";
  const uploaded = await f.personCanvas.add({ title: "Acme sketch", content: bytes1, mime: "text/plain" });
  const first = uploaded.versions[0]!;
  const edited = await f.personCanvas.edit(uploaded.id, { content: bytes2 });
  const second = edited.versions.find(v => v.id === edited.currentVersionId)!;
  const source = (await f.personCanvas.designQuestions())[0]!.source;
  const response: DesignResponse = { schemaVersion: 1, kind: "response", requestId: f.brief.requestId, epoch: 1, id: "answer_acme_sketch", question: source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "sketch", state: "answered", value: { kind: "references", references: [first, second].map((version, i) => ({ id: `ref_acme_${i}`, state: "fetched", artifact: { home: f.base, canvasId: f.canvasId, itemId: uploaded.id, versionId: version.id, blobHash: version.blobHash } })) } }], supersedesResponseId: null };
  const ids = await questionnaireSubmissionIds("answer", response.id);
  expect((await f.personCanvas.designAnswer({ ...ids, threadId: source.threadId, response })).status).toBe("accepted");
  for (const [index, expected] of [bytes1, bytes2].entries()) {
    const read = await f.agentCanvas.designReference({ threadId: source.threadId, commentId: ids.commentId, referenceId: `ref_acme_${index}` });
    expect(Buffer.from(read.bytes).toString("utf8")).toBe(expected);
    expect(read.artifact.versionId).toBe(index ? second.id : first.id);
  }
  await f.agentCanvas.edit(f.briefItem.id, { content: JSON.stringify({ ...f.brief, epoch: 2 }) });
  expect((await f.personCanvas.designQuestions())[0]?.status).toBe("stale");
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  const stale = { ...response, id: "answer_stale", supersedesResponseId: response.id };
  expect((await f.personCanvas.designAnswer({ ...await questionnaireSubmissionIds("answer", stale.id), threadId: source.threadId, response: stale })).status).toBe("refused");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
});

it("recovers a real lost acknowledgement and keeps canonical operation and author identities after a human join", async () => {
  const f = fixture = await questionnaireFixture();
  const ask = await f.agentCanvas.designAsk({ ...await questionnaireSubmissionIds("ask", f.questions.id), threadId: f.original.threadId, questions: f.questions });
  expect(ask.status).toBe("accepted");
  const state = (await f.personCanvas.designQuestions())[0]!;
  const response: DesignResponse = { schemaVersion: 1, kind: "response", requestId: f.brief.requestId, epoch: 1, id: "answer_lost_ack", question: state.source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "dismissed" }], supersedesResponseId: null };
  const ids = await questionnaireSubmissionIds("answer", response.id), request = { canvasId: f.canvasId, threadId: f.original.threadId, response, ...ids };
  const io = questionnairePort(f.person);
  const saved = await answerDesignQuestions({ ...io, send: async (...args) => {
    const result = await io.send(...args);
    expect(result.status).toBe("accepted");
    return { status: "pending", reason: "Synthetic connection lost after the writer accepted." };
  } }, request);
  expect(saved).toMatchObject({ status: "accepted", opId: null, submittedOpId: ids.opId, confirmedBy: "snapshot" });
  await f.client.claimActor({ type: "actor.claim", sessionKey: "cli:acme-canonical", name: "Acme Canonical Person" });
  const actor = (await f.client.actorBindings(["cli:acme-canonical"]))[0]!.actor;
  await f.client.sendOp(null, actor, { type: "actor.join", from: f.person.actor.id, into: actor.id });
  const joined = new CanvasHandle({ ...f.person, actor }, f.personCanvas.record);
  expect(await joined.designQuestions({ respondentActorId: actor.id })).toMatchObject([{ status: "answered", questions: { respondentActorId: f.person.actor.id } }]);
  const retried = await joined.designAnswer({ ...ids, opId: "op_changed_retry_identity", threadId: f.original.threadId, response });
  expect(retried).toMatchObject({ status: "accepted", opId: ids.opId, submittedOpId: "op_changed_retry_identity", confirmedBy: "receipt" });
  const stored = (await joined.designQuestions())[0]!.responses[0]!;
  expect(stored.author.id).toBe(f.person.actor.id);
  expect(stored.response.respondentActorId).toBe(f.person.actor.id);
  await f.agentCanvas.edit(f.briefItem.id, { content: JSON.stringify({ ...f.brief, progress: "cancelled" }) });
  expect(await joined.designAnswer({ ...ids, threadId: f.original.threadId, response })).toMatchObject({ status: "accepted", opId: ids.opId, submittedOpId: ids.opId });
});
