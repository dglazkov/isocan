import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { harnessVars, questionnaireSubmissionIds } from "@isocan/api";
import type { DesignQuestionSet, DesignResponse } from "@isocan/core/design-partner";
import { legacyQuestionSet, parseLegacyQuestionnaire } from "@isocan/core/questionnaire";
import { questionnaireFixture } from "../packages/api/test/questionnaire-fixture.ts";

const cliBin = fileURLToPath(new URL("../packages/cli/bin/isocan.js", import.meta.url));
let fixture: Awaited<ReturnType<typeof questionnaireFixture>> | undefined;
const children = new Set<ChildProcess>();
afterEach(async () => {
  await Promise.all([...children].map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    const timer = setTimeout(() => child.kill("SIGKILL"), 1000);
    timer.unref();
    child.once("close", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  })));
  await fixture?.close(); fixture = undefined;
});

async function cli(who: "person" | "agent" | "other", ...args: string[]) {
  const f = fixture!;
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const variable of harnessVars) delete env[variable];
  for (const variable of Object.keys(env)) if (variable.startsWith("ISOCAN_")) delete env[variable];
  env.ISOCAN_HOME = f.home;
  env.ISOCAN_PORT = String(f.port);
  env.ISOCAN_CANVAS = f.canvasId;
  env.ISOCAN_HARNESS = who === "person" ? "cli" : "acme";
  env.ISOCAN_SESSION_ID = who === "person" ? "acme-person" : who === "agent" ? "designer" : "helper";
  const child = spawn(process.execPath, [cliBin, "--canvas", f.canvasId, "--json", ...args], { cwd: f.work, env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let stdout = "", stderr = "", timedOut = false;
  const timer = setTimeout(() => { timedOut = true; stderr += "\nSynthetic CLI invocation exceeded 15 seconds."; child.kill("SIGKILL"); }, 15_000);
  timer.unref();
  child.stdout.on("data", (data) => { stdout += data; });
  child.stderr.on("data", (data) => { stderr += data; });
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    child.once("error", error => { clearTimeout(timer); children.delete(child); reject(error); });
    child.once("close", code => { clearTimeout(timer); children.delete(child); resolve({ code: timedOut ? 1 : code ?? 1, stdout, stderr }); });
  });
}
async function saved(name: string, value: unknown): Promise<string> {
  const file = path.join(fixture!.work, name);
  await fs.writeFile(file, JSON.stringify(value));
  return file;
}
function json(result: { code: number; stdout: string; stderr: string }): any {
  expect(result.code, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout);
}

it("walks both producer/consumer directions with exact uploads, safe retries, eligibility, rejection and undo", async () => {
  const f = fixture = await questionnaireFixture();
  const actors = json(await cli("agent", "design", "questions", "--respondents"));
  expect(actors.actors).toContainEqual({ id: f.person.actor.id, name: f.person.actor.name, kind: "human" });

  const questionFile = await saved("questions.json", f.questions);
  const asked = json(await cli("agent", "design", "ask", questionFile, "--thread", f.original.threadId));
  expect(asked).toMatchObject({ status: "accepted", payloadId: f.questions.id });
  const beforeRetry = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("agent", "design", "ask", questionFile, "--thread", f.original.threadId))).toEqual(asked);
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(beforeRetry);
  await f.otherCanvas.reply(f.original.threadId, "Acme progress: checking stock fields.");
  const state = (await f.personCanvas.designQuestions())[0]!;
  expect(state).toMatchObject({ status: "open", source: { commentId: asked.commentId }, responses: [] });
  const refused = await cli("other", "design", "answer", f.questions.id, "--id", "answer_wrong_actor", "--question", "workflow", "--option", "batch");
  expect(refused.code).toBe(1);
  expect(JSON.parse(refused.stdout).status).toBe("refused");
  const response: DesignResponse = { schemaVersion: 1, kind: "response", requestId: f.brief.requestId, epoch: 1, id: "answer_acme_api", question: state.source, respondentActorId: f.person.actor.id, resolutions: [{ questionId: "workflow", state: "answered", value: { kind: "text", text: "Review a batch before saving." } }], supersedesResponseId: null };
  const answered = await f.personCanvas.designAnswer({ ...await questionnaireSubmissionIds("answer", response.id), threadId: f.original.threadId, response });
  expect(answered.status).toBe("accepted");
  const read = json(await cli("agent", "design", "questions", f.questions.id));
  expect(read).toMatchObject([{ status: "answered", responses: [{ commentId: answered.commentId, response: { id: response.id, resolutions: response.resolutions } }] }]);

  const sketchQuestions: DesignQuestionSet = { ...f.questions, id: "qset_acme_references", questions: [{ id: "sketch", title: "Share the receiving sketch", consequence: "Shows the intended structure.", renderer: "upload", options: [], multiple: false, skippable: true, delegatable: false }, { id: "reference-url", title: "Share a reference URL", consequence: "Adds an attributed reference.", renderer: "url-collection", options: [], multiple: false, skippable: true, delegatable: false }] };
  const apiAsked = await f.agentCanvas.designAsk({ ...await questionnaireSubmissionIds("ask", sketchQuestions.id), threadId: f.original.threadId, questions: sketchQuestions });
  expect(apiAsked.status).toBe("accepted");
  const sketch = Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"180\"><text x=\"10\" y=\"30\">Acme receiving | Stock lookup</text></svg>\n");
  const upload = await f.personCanvas.add({ title: "Acme receiving sketch", content: sketch, mime: "image/svg+xml" });
  const version = upload.versions.find(one => one.id === upload.currentVersionId)!;
  const uploadedRef = { id: "ref_acme_sketch", state: "fetched", artifact: { home: f.base, canvasId: f.canvasId, itemId: upload.id, versionId: version.id, blobHash: version.blobHash } };
  const refFile = await saved("references.json", [uploadedRef]);
  const cliAnswered = json(await cli("person", "design", "answer", sketchQuestions.id, "--id", "answer_acme_upload", "--question", "sketch", "--references", refFile));
  expect(cliAnswered).toMatchObject({ status: "accepted", payloadId: "answer_acme_upload" });
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("person", "design", "answer", sketchQuestions.id, "--id", "answer_acme_upload", "--question", "sketch", "--references", refFile))).toEqual(cliAnswered);
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq);
  expect((await f.agentCanvas.designQuestions()).find(one => one.questions.id === sketchQuestions.id)).toMatchObject({ status: "open", outstandingQuestionIds: ["reference-url"], responses: [{ response: { id: "answer_acme_upload" } }] });
  await f.personCanvas.edit(upload.id, { content: "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>Acme later sketch</text></svg>" });
  const output = path.join(f.work, "opened.svg");
  const opened = json(await cli("agent", "design", "reference", f.original.threadId, cliAnswered.commentId, uploadedRef.id, "--out", output));
  expect(opened.artifact.versionId).toBe(version.id);
  expect(await fs.readFile(output)).toEqual(sketch);
  expect((await cli("agent", "design", "reference", f.original.threadId, cliAnswered.commentId, uploadedRef.id, "--out", output)).code).toBe(1);

  const supplied = await saved("url.json", [{ id: "ref_acme_url", state: "inaccessible", url: "https://acme.invalid/reference", reason: "Synthetic unavailable URL; no content was inspected." }]);
  const urlAnswered = json(await cli("person", "design", "answer", sketchQuestions.id, "--id", "answer_acme_url", "--question", "reference-url", "--references", supplied));
  expect(urlAnswered.status).toBe("accepted");
  expect((await f.agentCanvas.designQuestions()).find(one => one.questions.id === sketchQuestions.id)?.status).toBe("answered");
  expect((await cli("agent", "design", "reference", f.original.threadId, urlAnswered.commentId, "ref_acme_url")).stderr).toContain("inaccessible");
  expect((await cli("person", "undo")).code).toBe(0);
  expect((await f.agentCanvas.designQuestions()).find(one => one.questions.id === sketchQuestions.id)).toMatchObject({ status: "open", outstandingQuestionIds: ["reference-url"] });
  expect((await cli("person", "redo")).code).toBe(0);
  expect((await f.agentCanvas.designQuestions()).find(one => one.questions.id === sketchQuestions.id)?.status).toBe("answered");
  const malformed = await saved("malformed.json", { ...f.questions, id: "qset_bad", questions: [{}] });
  expect((await cli("agent", "design", "ask", malformed, "--thread", f.original.threadId)).code).toBe(1);
}, 120_000);

it("adopts a legacy questionnaire only with explicit original source and respondent, preserving the old comment", async () => {
  const f = fixture = await questionnaireFixture();
  const legacyBody = `/ask ${JSON.stringify({ headline: "Acme reference", questions: [{ id: "legacy", title: "What should the screen prioritize?", renderer: "freeform", skippable: true }] })}`;
  const legacy = await f.agentCanvas.reply(f.original.threadId, legacyBody);
  await f.otherCanvas.reply(f.original.threadId, "Acme helper is checking the schema.");
  expect(await f.personCanvas.designQuestions()).toEqual([]);
  const payload = parseLegacyQuestionnaire(legacyBody)!;
  const questions = legacyQuestionSet(payload, { requestId: f.brief.requestId, epoch: 1, brief: f.questions.brief, respondentActorId: f.person.actor.id, id: "qset_legacy_adopted", revision: 1 });
  const file = await saved("adopt.json", { threadId: f.original.threadId, questions, legacySource: { threadId: f.original.threadId, commentId: legacy.commentId, body: legacyBody } });
  const adopted = json(await cli("agent", "design", "ask", file));
  expect(adopted.status).toBe("accepted");
  const answer = json(await cli("person", "design", "answer", questions.id, "--id", "answer_legacy", "--question", "legacy", "--skip"));
  expect(answer.status).toBe("accepted");
  const snapshot = await f.client.snapshot(f.canvasId);
  expect(snapshot.canvas.threads[f.original.threadId]!.comments.find(one => one.id === legacy.commentId)?.body).toBe(legacyBody);
  expect((await f.agentCanvas.designQuestions())[0]).toMatchObject({ status: "answered", resolutions: [{ questionId: "legacy", state: "skipped" }] });
}, 60_000);
