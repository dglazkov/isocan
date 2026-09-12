import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import type { AnatomyProject } from "../src/core.ts";
import { sampleProject } from "./fixture.ts";

const repo = fileURLToPath(new URL("../../../../", import.meta.url));
let home: string;
let daemon: Daemon;
let port: string;
const children = new Set<ChildProcess>();
beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-anatomy-cli-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({
      id: "usr_test",
      name: "Test writer",
      createdAt: new Date().toISOString(),
    }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});
afterAll(async () => {
  for (const child of children) child.kill();
  await daemon?.close();
  if (home) await fs.rm(home, { recursive: true, force: true, maxRetries: 5 });
});

async function run(...args: string[]): Promise<string> {
  const env = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: port };
  for (const key of harnessVars) delete env[key as keyof typeof env];
  const child = spawn(
    process.execPath,
    [path.join(repo, "packages/cli/bin/isocan.js"), ...args],
    { cwd: home, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  children.add(child);
  let stdout = "",
    stderr = "";
  child.stdout.setEncoding("utf8").on("data", (s: string) => {
    stdout += s;
  });
  child.stderr.setEncoding("utf8").on("data", (s: string) => {
    stderr += s;
  });
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      children.delete(child);
      code === 0
        ? resolve()
        : reject(new Error(`${args.join(" ")}: ${stderr}`));
    });
  });
  return stdout;
}
async function json<T>(...args: string[]): Promise<T> {
  return JSON.parse(await run(...args, "--json")) as T;
}

describe("Anatomy through the real CLI and daemon", () => {
  it("imports, edits, comments, checkpoints, restores and undoes the native graph", async () => {
    const { canvasId } = await json<{ canvasId: string }>(
      "canvas",
      "create",
      "Synthetic exploration",
    );
    const inCanvas = (...args: string[]) => run(...args, "--canvas", canvasId);
    const sample = sampleProject();
    const input = path.join(home, "sample.json");
    await fs.writeFile(input, JSON.stringify(sample));
    const { itemId } = await json<{ itemId: string }>(
      "anatomy",
      "import",
      input,
      "--canvas",
      canvasId,
    );
    const show = () =>
      json<AnatomyProject>("anatomy", "show", itemId, "--canvas", canvasId);
    expect(await show()).toEqual(sample);
    const neighborhood = await json<{
      focus: { id: string };
      nodes: Array<{ id: string }>;
      ancestors: Array<{ id: string }>;
    }>("anatomy", "show", itemId, "--node", "state", "--canvas", canvasId);
    expect(neighborhood.focus.id).toBe("state");
    expect(neighborhood.nodes.map((n) => n.id)).toEqual(["workflow", "state"]);
    expect(neighborhood.ancestors.map((n) => n.id)).toEqual([
      "goal",
      "workflow",
    ]);
    const record = await json<{ properties: Record<string, string> }>(
      "canvas",
      "show",
      canvasId,
    );
    expect(record.properties["anatomy.analysis"]).toBe(itemId);
    await inCanvas("anatomy", "repository", "/example/acme-current");
    await expect(inCanvas("anatomy", "analyze")).rejects.toThrow("Repository mismatch");
    await inCanvas("anatomy", "analyze", "--new");
    const chat = await inCanvas("comment", "list", "--json");
    expect(chat).toContain("/anatomy /example/acme-current");
    await inCanvas("anatomy", "attach", itemId);
    const rows = await json<Array<{ id: string; concepts: number }>>(
      "anatomy",
      "ls",
      "--canvas",
      canvasId,
    );
    expect(rows).toEqual([
      { id: itemId, title: sample.projectName, concepts: 4 },
    ]);
    await inCanvas("anatomy", "checkpoint", itemId, "--save", "Before review");
    const checkpoint = (await show()).checkpoints[0]!;
    const edit = path.join(home, "concept.json");
    const draft = await json<{ node: AnatomyProject["nodes"][number]; base: unknown }>("anatomy", "draft", itemId, "workflow", "--canvas", canvasId);
    await fs.writeFile(
      edit,
      JSON.stringify({
        ...draft,
        node: { ...draft.node, status: "settled", summary: "Recovery is explicit" },
      }),
    );
    const nativeId = (await inCanvas("anatomy", "node", itemId, edit)).trim();
    await expect(inCanvas("anatomy", "node", itemId, edit)).rejects.toThrow("changed while editing");
    expect((await show()).nodes[1]!.status).toBe("settled");
    await inCanvas("undo");
    expect((await show()).nodes[1]!.status).toBe(sample.nodes[1]!.status);
    await inCanvas("redo");
    expect((await show()).nodes[1]!).toMatchObject({ status: "settled", summary: "Recovery is explicit" });
    await inCanvas(
      "comment",
      "add",
      "--item",
      nativeId,
      "Review the recovery copy.",
    );
    const output = path.join(home, "export.json");
    await inCanvas("anatomy", "export", itemId, output);
    const exported = JSON.parse(
      await fs.readFile(output, "utf8"),
    ) as AnatomyProject;
    expect(exported.nodes[1]!.marginalia.at(-1)?.text).toBe(
      "Review the recovery copy.",
    );
    await inCanvas("anatomy", "checkpoint", itemId, "--restore", checkpoint.id);
    expect((await show()).nodes[1]!.status).toBe("conflict");
    await inCanvas("undo");
    expect((await show()).nodes[1]!.summary).toBe("Recovery is explicit");
    const coverage = await json<
      Array<{ assessments: { engineering: unknown } }>
    >("anatomy", "coverage", itemId, "--canvas", canvasId);
    expect(coverage[2]!.assessments.engineering).toBeNull();
  }, 120_000);
  it("reports diagnostic recovery and request outcomes through real CLI receipts", async () => {
    const { canvasId } = await json<{ canvasId: string }>("canvas", "create", "Synthetic recovery");
    const inCanvas = (...args: string[]) => run(...args, "--canvas", canvasId);
    const receipt = <T>(...args: string[]) => json<T>(...args, "--canvas", canvasId);
    const input = path.join(home, "recovery.json");
    await fs.writeFile(input, JSON.stringify(sampleProject()));
    const { itemId } = await receipt<{ itemId: string }>("anatomy", "import", input);
    const report = await receipt<{ valid: boolean; items: Record<string, string> }>("anatomy", "validate", itemId);
    expect(report.valid).toBe(true);
    const versions = await receipt<Array<{ id: string }>>("versions", report.items.workflow!);
    const bad = path.join(home, "broken.json");
    await fs.writeFile(bad, "{broken");
    await inCanvas("edit", report.items.workflow!, bad);
    const partial = await receipt<{ nodes: unknown[]; diagnostics: unknown[] }>("anatomy", "show", itemId);
    expect(partial.nodes).toHaveLength(3);
    expect(partial.diagnostics.length).toBeGreaterThan(0);
    await expect(inCanvas("anatomy", "export", itemId, path.join(home, "partial.json"))).rejects.toThrow();
    await inCanvas("anatomy", "recover", itemId, report.items.workflow!, versions[0]!.id);
    expect((await receipt<{ valid: boolean }>("anatomy", "validate", itemId)).valid).toBe(true);
    const request = await receipt<{ requestId: string; status: string; dispatched: boolean }>("anatomy", "analyze");
    expect(request).toMatchObject({ status: "requested", dispatched: true });
    await inCanvas("undo");
    expect(await receipt<unknown[]>("anatomy", "runs")).toEqual([]);
    expect(await inCanvas("comment", "list", "--json")).not.toContain(request.requestId);
    await inCanvas("redo");
    expect((await receipt<{ dispatched: boolean }>("anatomy", "run", request.requestId)).dispatched).toBe(true);
    expect((await receipt<{ requestId: string }>("anatomy", "analyze")).requestId).toBe(request.requestId);
    await inCanvas("anatomy", "run", request.requestId, "--start");
    await inCanvas("anatomy", "run", request.requestId, "--fail", "Repository not accessible to this worker");
    const retry = await receipt<{ requestId: string; retryOf: string }>("anatomy", "run", request.requestId, "--retry");
    expect(retry.retryOf).toBe(request.requestId);
    await inCanvas("anatomy", "run", retry.requestId, "--cancel-request");
    expect((await receipt<{ status: string; cancelRequested: boolean }>("anatomy", "run", retry.requestId))).toMatchObject({ status: "requested", cancelRequested: true });
    await inCanvas("anatomy", "run", retry.requestId, "--cancelled");
    const next = await receipt<{ requestId: string }>("anatomy", "run", retry.requestId, "--retry");
    await inCanvas("anatomy", "run", next.requestId, "--start");
    const done = await receipt<{ status: string; revision: string; resultId: string }>("anatomy", "run", next.requestId, "--complete", itemId, "--revision", "abc123", "--message", "Synthetic source review");
    expect(done).toMatchObject({ status: "completed", revision: "abc123", resultId: itemId });
    expect(await receipt<unknown[]>("anatomy", "runs")).toHaveLength(3);
  }, 120_000);

});
