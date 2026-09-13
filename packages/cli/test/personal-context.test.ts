import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

const cli = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
let scratch: string;
let clientHome: string;
let daemon: Daemon;
let base: string;
const marker = "PRIVATE_SYNTHETIC_PHONE_PREFERENCE_390";
beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-personal-cli-"));
  clientHome = path.join(scratch, "client"); await fs.mkdir(clientHome);
  await fs.writeFile(path.join(clientHome, "identity.json"), JSON.stringify({ id: "usr_maya", name: "Maya", createdAt: "2026-09-13T00:00:00Z" }));
  daemon = await startDaemon({ home: path.join(scratch, "daemon"), port: 0, birthHome: null, contentPort: "off" });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { if (daemon) await daemon.close(); if (scratch) await fs.rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
function run(args: string[], session?: string): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = { ...process.env };
  for (const key of harnessVars) delete env[key];
  delete env.ISOCAN_CANVAS;
  const child = spawn(process.execPath, [cli, ...args], { cwd: scratch, env: { ...env, ISOCAN_HOME: clientHome, ISOCAN_DIRECT: base, ...(session ? { ISOCAN_HARNESS: "synthetic", ISOCAN_SESSION_ID: session } : {}) }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => { child.on("error", reject); child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr })); });
}
async function json(args: string[], session?: string): Promise<any> {
  const result = await run([...args, "--json"], session); expect(result.code, result.stderr).toBe(0); return JSON.parse(result.stdout);
}
it("real CLI births privately without a working canvas, selects each caller on a multi-claim badge, revokes, and unlinks with undo", async () => {
  expect((await json(["context", "personal", "status"])).source).toBeNull();
  const first = await json(["context", "personal"]);
  expect(first.created).toBe(true); expect(first.source.state).toBe("live");
  const source = first.source.canvasId;
  expect((await json(["context", "personal"])).source.canvasId).toBe(source);
  await expect(fs.access(path.join(scratch, ".isocan", "project.json"))).rejects.toThrow();
  const shared = (await json(["canvas", "create", "Acme destination"])).canvasId;
  const file = path.join(scratch, "preference.md"); await fs.writeFile(file, marker);
  const pin = await json(["add", file, "--title", "Phone preference", "--canvas", source]);
  expect((await run(["context", "pin", pin.itemId, "--canvas", source])).code).toBe(0);
  const link = await json(["context", "personal", "link", "--canvas", shared, "--request-id", "gesture_link"]);
  expect((await json(["context", "personal", "link", "--canvas", shared, "--request-id", "gesture_link"])).link.itemId).toBe(link.link.itemId);
  const read = ["context", "personal", "read", link.link.itemId, "--canvas", shared];
  expect(JSON.stringify(await json(read))).toContain(marker);
  expect((await json([...read, "--limit", "1"])).pieces.length).toBeLessThanOrEqual(1);
  await run(["identity", "--name", "Rowan", "--session"], "rowan");
  const rowan = await json(["whoami"], "rowan");
  expect((await run(read, "rowan")).code).not.toBe(0);
  expect((await run(["context", "personal"], "rowan")).code).not.toBe(0);
  await json(["context", "personal", "allow", rowan.id, "--source", source]);
  expect(JSON.stringify(await json(read, "rowan"))).toContain(marker);
  await run(["identity", "--name", "Ravi", "--session"], "ravi");
  expect((await run(read, "ravi")).code).not.toBe(0);
  await json(["context", "personal", "revoke", rowan.id, "--source", source]);
  expect((await run(read, "rowan")).code).not.toBe(0);
  await json(["context", "personal", "unlink", link.link.itemId, "--canvas", shared]);
  expect((await run(read)).code).not.toBe(0);
  expect((await run(["undo", "--canvas", shared])).code).toBe(0);
  expect(JSON.stringify(await json(read))).toContain(marker);
  expect(JSON.stringify(await json(["ls", "--canvas", shared]))).not.toContain(marker);
  const capture = await run(["canvas", "shot", source, "--into", shared, "--out", path.join(scratch, "forbidden.png")]);
  expect(capture.code).not.toBe(0); expect(capture.stderr).toMatch(/personal|private/i);
  await expect(fs.access(path.join(scratch, "forbidden.png"))).rejects.toThrow();
  const blocked = await run(["canvas", "place", `${base}/p/${source}`, "--inherit", "--canvas", shared]);
  expect(blocked.code).not.toBe(0); expect(blocked.stderr).toMatch(/personal|private/i);
}, 90_000);
