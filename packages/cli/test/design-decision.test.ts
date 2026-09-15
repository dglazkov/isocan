import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { harnessVars } from "@isocan/api";
import { designDecisionFixture } from "../../api/test/design-decision-fixture.ts";

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
let fixture: Awaited<ReturnType<typeof designDecisionFixture>> | undefined;
const children = new Set<ChildProcess>();
let session = "designer";
afterEach(async () => {
  await Promise.all([...children].map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    const timer = setTimeout(() => child.kill("SIGKILL"), 1000);
    timer.unref();
    child.once("close", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  })));
  await fixture?.close(); fixture = undefined; session = "designer";
});

async function cli(...args: string[]) {
  const f = fixture!;
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const variable of harnessVars) delete env[variable];
  for (const variable of Object.keys(env)) if (variable.startsWith("ISOCAN_")) delete env[variable];
  Object.assign(env, { ISOCAN_HOME: f.home, ISOCAN_PORT: String(f.port), ISOCAN_CANVAS: f.canvasId, ISOCAN_HARNESS: "acme", ISOCAN_SESSION_ID: session });
  const child = spawn(process.execPath, [cliBin, "--canvas", f.canvasId, "--json", ...args], { cwd: f.work, env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
  timer.unref();
  return await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => { clearTimeout(timer); children.delete(child); resolve({ code, stdout, stderr }); });
  });
}
function json(result: Awaited<ReturnType<typeof cli>>) { expect(result.stderr).toBe(""); expect(result.code).toBe(0); return JSON.parse(result.stdout); }
async function saved(name: string, value: unknown) { const file = path.join(fixture!.work, name); await fs.writeFile(file, JSON.stringify(value)); return file; }

it("publishes from a canvas-chat designer, adopts delegated choice and reads exact history after comparison undo and pruning", async () => {
  const f = fixture = await designDecisionFixture({ existing: true });
  const file = await saved("comparison.json", { threadId: f.publication.threadId, commentId: f.publication.commentId, opId: f.publication.opId, comparison: f.comparison });
  expect(json(await cli("design", "compare", "--publish", file))).toMatchObject({ status: "accepted" });
  const view = json(await cli("design", "compare", f.comparison.requestId)).comparisons[0];
  expect(view.author).toEqual(f.agent.actor);
  expect(view.comparison).toMatchObject({ uncertainty: "structure", fidelity: "wireframe", alternatives: [{ id: "continuous" }, { id: "each" }] });
  const response = { schemaVersion: 1 as const, kind: "comparison-response" as const, id: "response_acme_delegate", requestId: f.comparison.requestId, epoch: 1, comparison: view.source, authority: { kind: "human" as const }, outcome: { kind: "delegate" as const, agentActorId: f.other.actor.id }, supersedesResponseId: null };
  expect(await f.personCanvas.designRespond({ threadId: view.source.threadId, commentId: "cmt_acme_delegate", opId: "op_acme_delegate", response })).toMatchObject({ status: "accepted" });
  session = "unnamed-reader";
  expect(json(await cli("design", "compare", f.comparison.requestId)).comparisons[0].allowedActions).toEqual({ respond: false, authorities: [] });
  session = "helper";
  const delegated = json(await cli("design", "compare", f.comparison.requestId)).comparisons[0];
  expect(delegated.allowedActions.authorities).toEqual(["canvas-delegation"]);
  expect((await f.otherCanvas.designWorkflow()).requests[0]!.nextAction).toBe("decide");
  const intent = f.decide(delegated, { kind: "canvas-delegation", responseId: response.id, rationale: "Continuous scanning keeps the requested review step without repeated confirmation." });
  const decisionFile = await saved("decision.json", { threadId: intent.threadId, commentId: intent.commentId, opId: intent.opId, decision: intent.decision });
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("design", "decide", decisionFile))).toMatchObject({ status: "accepted" });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq + 1);
  // The publisher and delegated decision author are distinct: Undo removes only the publication.
  await f.client.undo(f.canvasId, f.agent.actor);
  for (const option of f.alternatives) {
    await f.agentCanvas.edit(option.id, { content: "<main>Later option revision</main>" });
    await f.agentCanvas.pruneVersions(option.id, 1);
  }
  await f.client.uploadBlob(f.canvasId, Buffer.from("Unreferenced synthetic bytes"), "text/plain", "orphan.txt");
  const gc = await f.client.gc(f.canvasId, { keepOps: 0, graceMs: 0 });
  expect(gc.sweptBlobs).toBeGreaterThan(0);
  const historical = json(await cli("design", "compare", "--thread", view.source.threadId, "--comment", view.source.commentId));
  expect(historical.comparisons).toEqual([]);
  expect(historical.decisions).toHaveLength(1);
  const output = path.join(f.work, "historical.html");
  expect(json(await cli("design", "compare", "--thread", view.source.threadId, "--comment", view.source.commentId, "--option", "each", "--out", output))).toMatchObject({ artifact: f.comparison.alternatives[1]!.artifact });
  expect(await fs.readFile(output, "utf8")).toContain("Confirm line");
  const beforeRetry = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("design", "decide", decisionFile, "--retry"))).toMatchObject({ status: "accepted", opId: intent.opId });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(beforeRetry);
  const followup = json(await cli("design", "workflow", "--output", f.target!.id)).requests[0];
  expect(followup.effectiveDecisions[0].decision.input.authority).toEqual(intent.decision.authority);
}, 60_000);

it("publishes polished native alternatives and preserves native response/choice reports without a second interview", async () => {
  const f = fixture = await designDecisionFixture({ external: true });
  const comparison = { ...f.comparison, uncertainty: "visual", fidelity: "designed", scenario: "Two compositions for the same three receiving lines." };
  const compare = await saved("native-comparison.json", { threadId: f.publication.threadId, comparison });
  expect(json(await cli("design", "compare", "--publish", compare))).toMatchObject({ status: "accepted" });
  const view = json(await cli("design", "compare", f.comparison.requestId)).comparisons[0];
  const response = { schemaVersion: 1, kind: "comparison-response", id: "response_acme_native", requestId: f.comparison.requestId, epoch: 1, comparison: view.source, authority: { kind: "external-report", externalRequestId: "native_acme_receiving", statement: "The native user delegated this composition choice." }, outcome: { kind: "delegate", agentActorId: f.agent.actor.id }, supersedesResponseId: null };
  const responseFile = await saved("native-response.json", { threadId: view.source.threadId, response });
  expect(json(await cli("design", "respond", responseFile))).toMatchObject({ status: "accepted" });
  const intent = f.decide(view, { kind: "external-report", externalRequestId: "native_acme_receiving", reportedOutcome: "delegation", statement: "The native user delegated the composition choice.", reportedReason: null, rationale: "Use the continuous receipt composition for its larger review summary." });
  const file = await saved("native-decision.json", { threadId: intent.threadId, commentId: intent.commentId, opId: intent.opId, decision: intent.decision });
  expect(json(await cli("design", "decide", file))).toMatchObject({ status: "accepted" });
  const workflow = json(await cli("design", "workflow")).requests[0];
  expect(workflow.questions).toEqual([]);
  expect(workflow.effectiveDecisions[0]).toMatchObject({ author: f.agent.actor, decision: { input: { authority: { kind: "external-report", reportedOutcome: "delegation", reportedReason: null } } } });
}, 60_000);
