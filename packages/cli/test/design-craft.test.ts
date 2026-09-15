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
const session = "designer";
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

it("exports the shared optional packet, checks edits without overwriting and reconciles only through the existing system path", async () => {
  const f = fixture = await designReviewFixture();
  const packet = json(await cli("design", "craft", f.requestId, "--stage", "finish"));
  expect(packet).toEqual(await f.agentCanvas.designCraft(f.requestId, "finish"));
  const folder = path.join(f.work, "craft-output");
  expect(json(await cli("design", "craft", f.requestId, "--stage", "finish", "--out", folder)).packet).toEqual(packet);
  expect((await cli("design", "craft", f.requestId, "--stage", "finish", "--out", folder)).code).toBe(1);
  expect(json(await cli("design", "craft", f.requestId, "--check", folder)).status).toBe("current");
  const original = await fs.readFile(path.join(folder, "DESIGN.md"), "utf8"), manifest = await fs.readFile(path.join(folder, "CRAFT.manifest.json"), "utf8");
  const authored = original + "\nUse clear saved-state confirmation after receiving.\n";
  await fs.writeFile(path.join(folder, "DESIGN.md"), authored);
  const edited = json(await cli("design", "craft", f.requestId, "--check", folder));
  expect(edited.status).toBe("current"); expect(edited.files.find((file: any) => file.path === "DESIGN.md").status).toBe("modified");
  const seq = (await f.client.snapshot(f.canvasId)).lastSeq;
  const saved = json(await cli("design", "reconcile", folder)); expect(saved.status).toBe("accepted");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(seq + 1);
  expect((await f.client.getLog(f.canvasId, seq)).find(one => one.envelope.id === saved.opId)?.envelope.op.type).toBe("item.edit");
  await f.client.undo(f.canvasId, f.agent.actor);
  expect((await f.client.snapshot(f.canvasId)).canvas.items[f.system.id]!.currentVersionId).toBe(f.system.currentVersionId);
  expect(await fs.readFile(path.join(folder, "CRAFT.manifest.json"), "utf8")).toBe(manifest);
  const newer = path.join(f.work, "craft-newer"); json(await cli("design", "craft", f.requestId, "--stage", "critique", "--out", newer));
  const draft = original + "\nAn authored draft to preserve.\n"; await fs.writeFile(path.join(newer, "DESIGN.md"), draft);
  await f.otherCanvas.edit(f.system.id, { content: original + "\nConcurrent source correction.\n" });
  const refused = await cli("design", "reconcile", newer); expect(refused.code).toBe(1); expect(JSON.parse(refused.stdout).status).toBe("refused");
  expect(await fs.readFile(path.join(newer, "DESIGN.md"), "utf8")).toBe(draft);
  expect(JSON.parse((await cli("design", "craft", f.requestId, "--check", newer)).stdout).status).toBe("stale");
});
