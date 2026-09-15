import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { harnessVars } from "@isocan/api";
import { isOpId } from "@isocan/core";
import type { DesignBriefFields } from "@isocan/core/design-request";
import { questionnaireFixture } from "../../api/test/questionnaire-fixture.ts";

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
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

async function cli(...args: string[]) {
  const f = fixture!;
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const variable of harnessVars) delete env[variable];
  for (const variable of Object.keys(env)) if (variable.startsWith("ISOCAN_")) delete env[variable];
  Object.assign(env, { ISOCAN_HOME: f.home, ISOCAN_PORT: String(f.port), ISOCAN_CANVAS: f.canvasId, ISOCAN_HARNESS: "acme", ISOCAN_SESSION_ID: "designer" });
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

it("walks the installed native request lifecycle and opens exact historical references without replacing their bytes", async () => {
  const f = fixture = await questionnaireFixture();
  const originalBytes = "Acme receiving reference version one.\n";
  const reference = await f.agentCanvas.add({ title: "Acme reference", content: originalBytes, mime: "text/plain" });
  const referenceVersion = reference.versions.find(one => one.id === reference.currentVersionId)!;
  const artifact = { home: f.base, canvasId: f.canvasId, itemId: reference.id, versionId: referenceVersion.id, blobHash: referenceVersion.blobHash };
  const fields: DesignBriefFields = { intent: "create", fidelity: "designed", delivery: "html-node", targetItemId: null, groupId: null, audience: "Receiving staff", primaryTask: "Receive stock", constraints: ["Works on a phone"], facts: [], references: [{ id: "ref_acme", state: "fetched", artifact }], outstandingDecisionIds: [], outputIds: [] };
  const requestId = "req_acme_native", itemId = "itm_acme_native", versionId = "ver_acme_native_request_with_a_long_shared_prefix_A";
  const start = await saved("start.json", { requestId, itemId, versionId, source: { entrance: "external-agent", externalRequestId: "acme-native-request" }, fields });
  expect(json(await cli("design", "workflow"))).toMatchObject({ policy: "off", requests: [] });
  const refused = await cli("design", "start", start, "--automatic");
  expect(refused.code).toBe(1); expect(JSON.parse(refused.stdout).status).toBe("refused");
  const accepted = json(await cli("design", "start", start));
  expect(accepted.status).toBe("accepted");
  expect(isOpId(accepted.opId)).toBe(true);
  const different = await saved("different.json", { requestId, itemId, versionId: versionId.replace(/A$/, "B"), source: { entrance: "external-agent", externalRequestId: "acme-native-request" }, fields });
  const conflict = await cli("design", "start", different);
  expect(conflict.code).toBe(1);
  expect(JSON.parse(conflict.stdout).submittedOpId).not.toBe(accepted.submittedOpId);
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("design", "start", start))).toEqual(accepted);
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq);
  let state = json(await cli("design", "brief", requestId)).requests[0];
  expect(state).toMatchObject({ nextAction: "build", brief: { requestingActorId: f.agent.actor.id, continuation: { factProvenance: expect.arrayContaining([{ field: "audience", actorId: f.agent.actor.id, kind: "reported" }]) } } });
  await f.agentCanvas.edit(reference.id, { content: "Acme receiving reference version two." });
  state = (await f.personCanvas.designBrief({ requestId })).requests[0]!;
  expect(state.status).toBe("current");
  const outputFile = path.join(f.work, "opened.txt"), referenceFile = await saved("reference.json", artifact);
  expect(json(await cli("design", "brief", requestId, "--reference", referenceFile, "--out", outputFile))).toMatchObject({ artifact, bytesWritten: Buffer.byteLength(originalBytes) });
  expect(await fs.readFile(outputFile, "utf8")).toBe(originalBytes);
  expect((await cli("design", "brief", requestId, "--reference", referenceFile, "--out", outputFile)).code).toBe(1);
  const update = await saved("update.json", { brief: state.ref, epoch: 1, versionId: "ver_acme_corrected", patch: { audience: "Receiving and dispatch staff" } });
  expect(json(await cli("design", "brief", requestId, "--update", update, "--op-id", "op_explicit_native_update"))).toMatchObject({ status: "accepted", opId: "op_explicit_native_update" });
  state = (await f.personCanvas.designBrief({ requestId })).requests[0]!;
  const cancel = await saved("cancel.json", { brief: state.ref, epoch: 1, versionId: "ver_acme_cancelled", reason: "Pause this synthetic request." });
  expect(json(await cli("design", "brief", requestId, "--cancel", cancel)).status).toBe("accepted");
  state = (await f.personCanvas.designBrief({ requestId })).requests[0]!;
  expect(state).toMatchObject({ status: "cancelled", nextAction: "resume" });
  const resume = await saved("resume.json", { brief: state.ref, epoch: 1, versionId: "ver_acme_resumed", reason: "Continue the same task through native CLI." });
  expect(json(await cli("design", "brief", requestId, "--resume", resume)).status).toBe("accepted");
  state = (await f.personCanvas.designBrief({ requestId })).requests[0]!;
  expect(state.brief).toMatchObject({ epoch: 2, audience: "Receiving and dispatch staff" });
  const output = await f.agentCanvas.add({ title: "Acme receiving draft", content: "<main>Acme receiving draft</main>", mime: "text/html" });
  const outputVersion = output.versions.find(one => one.id === output.currentVersionId)!;
  const complete = await saved("complete.json", { brief: state.ref, epoch: 2, versionId: "ver_acme_completed", patch: { outputIds: [output.id] } });
  expect(json(await cli("design", "brief", requestId, "--complete", complete)).status).toBe("accepted");
  state = (await f.personCanvas.designBrief({ requestId })).requests[0]!;
  expect(state.nextAction).toBe("verify");
  const receipt = await saved("receipt.json", { itemId: "itm_acme_draft_receipt", versionId: "ver_acme_draft_receipt", receipt: { schemaVersion: 1, kind: "receipt", id: "receipt_acme_draft", requestId, epoch: 2, brief: state.ref, output: { kind: "canvas", artifact: { home: f.base, canvasId: f.canvasId, itemId: output.id, versionId: outputVersion.id, blobHash: outputVersion.blobHash } }, context: [], governing: { atItemId: output.id, artifact: null, explicitNone: false }, fidelity: "designed", status: "draft", checks: [], unresolved: [{ severity: "critical", description: "No browser inspection was performed in this CLI fixture." }] } });
  expect(json(await cli("design", "receipt", requestId, "--publish", receipt)).status).toBe("accepted");
  expect(json(await cli("design", "receipt", "--output", output.id))).toMatchObject({ receipts: [{ status: "current", receipt: { status: "draft", checks: [] } }] });
  expect((await f.personCanvas.designBrief({ requestId })).requests[0]!.nextAction).toBe("verify");
}, 60_000);
