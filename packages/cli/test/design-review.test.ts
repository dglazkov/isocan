import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { harnessVars } from "@isocan/api";
import { designReviewFixture } from "../../api/test/design-review-fixture.ts";

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
let fixture: Awaited<ReturnType<typeof designReviewFixture>> | undefined;
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

async function runCli(format: "json" | "text", ...args: string[]) {
  const f = fixture!;
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const variable of harnessVars) delete env[variable];
  for (const variable of Object.keys(env)) if (variable.startsWith("ISOCAN_")) delete env[variable];
  Object.assign(env, { ISOCAN_HOME: f.home, ISOCAN_PORT: String(f.port), ISOCAN_CANVAS: f.canvasId, ISOCAN_HARNESS: "acme", ISOCAN_SESSION_ID: session });
  const child = spawn(process.execPath, [cliBin, "--canvas", f.canvasId, ...format === "json" ? ["--json"] : [], ...args], { cwd: f.work, env, stdio: ["ignore", "pipe", "pipe"] });
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
const cli = (...args: string[]) => runCli("json", ...args);
function json(result: Awaited<ReturnType<typeof cli>>) { expect(result.stderr).toBe(""); expect(result.code).toBe(0); return JSON.parse(result.stdout); }
async function saved(name: string, value: unknown) { const file = path.join(fixture!.work, name); await fs.writeFile(file, JSON.stringify(value)); return file; }

it("continues a shared native review through a second actor, reserved repair, honest draft completion and actual receipt", async () => {
  const f = fixture = await designReviewFixture();
  const start = await saved("review-start.json", f.start);
  expect(json(await cli("design", "review", f.requestId, "--start", start))).toMatchObject({ status: "accepted" });
  let row = json(await cli("design", "review", f.requestId, "--run", f.start.runId)).runs[0];
  expect(row).toMatchObject({ remainingRepairs: 2, nextAction: "record" });
  const workflow = json(await cli("design", "workflow", f.requestId));
  expect(workflow.requests[0].nextAction).toBe("verify"); expect(workflow.reviews.runs[0].nextAction).toBe("record");
  const workflowText = await runCli("text", "design", "workflow", f.requestId);
  expect(workflowText.code).toBe(0); expect(workflowText.stderr).toBe("");
  expect(workflowText.stdout).toContain("next: verify"); expect(workflowText.stdout).toContain(`Review ${row.run.id}: current; next record;`); expect(workflowText.stdout).not.toContain("next: build");
  session = "helper";
  const record = { outcome: "reviewed", note: "Native browser unavailable; no inspection claimed.", observations: [], findings: [] };
  expect(json(await cli("design", "review", f.requestId, "--run", row.run.id, "--record", await saved("initial-observations.json", { base: row.ref, record })))).toMatchObject({ status: "accepted" });
  row = json(await cli("design", "review", f.requestId, "--run", row.run.id)).runs[0];
  expect(row.passes[0].recordedBy.id).toBe(f.other.actor.id);
  expect(row.readings.task).toBe("unavailable");
  const repairing = json(await cli("design", "workflow", f.requestId));
  expect(repairing.requests[0].nextAction).toBe("verify"); expect(repairing.reviews.runs[0].nextAction).toBe("repair");
  session = "designer";
  expect(json(await cli("design", "review", f.requestId, "--run", row.run.id, "--begin-repair", "repair_one", "--session", "native-designer"))).toMatchObject({ status: "accepted" });
  const html = path.join(f.work, "repair.html"); await fs.writeFile(html, '<main style="padding:16px;color:#112233"><button>Save corrected receipt</button></main>');
  const repair = json(await cli("design", "repair", f.output.id, html, "--request", f.requestId, "--review", row.run.id));
  expect(repair.status).toBe("accepted");
  expect((await f.client.getLog(f.canvasId, 0)).find(one => one.envelope.id === repair.opId)?.envelope.op.type).toBe("design.repair");
  row = json(await cli("design", "review", f.requestId, "--run", row.run.id)).runs[0];
  expect(json(await cli("design", "review", f.requestId, "--run", row.run.id, "--record", await saved("recheck.json", { base: row.ref, record })))).toMatchObject({ status: "accepted" });
  const finished = json(await cli("design", "review", f.requestId, "--run", row.run.id, "--finish"));
  expect(finished.result.status).toBe("accepted");
  const receipt = (await f.agentCanvas.designReceipt({ requestId: f.requestId })).receipts[0]!;
  expect(receipt).toMatchObject({ status: "current", receipt: { status: "draft" } });
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("design", "review", f.requestId, "--run", row.run.id, "--finish")).result.status).toBe("accepted");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq);
});

it("captures original audit metadata and refuses an intervening metadata edit without a new version", async () => {
  const f = fixture = await designReviewFixture();
  const audit = json(await cli("design", "audit", "--item", f.output.id));
  expect(audit.items[0].repairBasis.repair.target.description).toBe(f.output.description);
  await f.client.sendOp(f.canvasId, f.agent.actor, { type: "item.update", itemId: f.output.id, patch: { description: "Acme teammate changed scope note" } });
  const source = path.join(f.work, "repair.html"); await fs.writeFile(source, "<p>Authored correction</p>");
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  const result = await cli("design", "repair", f.output.id, source, "--from-audit", await saved("audit.json", audit));
  expect(result.code).toBe(1); expect(JSON.parse(result.stdout).status).toBe("refused");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq);
  expect((await cli("design", "repair", f.output.id, source, "--retry")).code).toBe(1);
});
