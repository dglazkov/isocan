import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";
import { harnessVars, designSystemPort, reconcileDesignProjection } from "@isocan/api";
import { designSystemProperties } from "@isocan/core";
import { auditDesign } from "../../api/test/design-audit-fixture.ts";
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

it("uses the native governing document for exports, checks and conditional working-file reconciliation", async () => {
  const f = fixture = await questionnaireFixture();
  const item = await f.agentCanvas.add({ title: "Acme system", content: auditDesign("Acme native"), mime: "text/markdown", filename: "DESIGN.md", properties: designSystemProperties() });
  const show = json(await cli("design", "show"));
  expect(show).toMatchObject({ itemId: item.id, body: auditDesign("Acme native"), governing: { artifact: { itemId: item.id }, selection: { level: "canvas" } } });
  expect((await cli("design", "show", "--css")).stdout).toContain("--space-md: 16px");
  expect(json(await cli("design", "show", "--tokens"))).toHaveProperty("spacing");
  expect(json(await cli("design", "check", "--provenance"))).toMatchObject({ governing: { artifact: show.governing.artifact } });
  expect(Array.isArray(json(await cli("design", "check")))).toBe(true);
  const folder = path.join(f.work, "projection");
  const projected = json(await cli("design", "project", folder));
  expect(projected.projection.source).toEqual(show.governing.artifact);
  expect((await cli("design", "project", folder)).code).toBe(1);
  await fs.writeFile(path.join(folder, "DESIGN.md"), auditDesign("Acme native revision"));
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  expect(json(await cli("design", "reconcile", folder))).toMatchObject({ status: "accepted", consistency: { status: "current" } });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before + 1);
  expect(json(await cli("design", "direction"))).toMatchObject({ direction: { status: "absent" }, author: f.agent.actor });
  const stale = await fs.readFile(path.join(folder, "DESIGN.projection.json"), "utf8");
  await f.agentCanvas.edit(item.id, { content: auditDesign("Acme concurrent") });
  await fs.writeFile(path.join(folder, "DESIGN.md"), auditDesign("Acme retained draft"));
  const refusal = await cli("design", "reconcile", folder);
  expect(refusal.code).toBe(1); expect(JSON.parse(refusal.stdout).status).toBe("refused");
  expect(await fs.readFile(path.join(folder, "DESIGN.md"), "utf8")).toBe(auditDesign("Acme retained draft"));
  expect(await fs.readFile(path.join(folder, "DESIGN.projection.json"), "utf8")).toBe(stale);
  expect(json(await cli("design", "project", folder, "--refresh")).projection.source.versionId).not.toBe(JSON.parse(stale).source.versionId);
  expect(await fs.readFile(path.join(folder, "DESIGN.md"), "utf8")).toBe(auditDesign("Acme retained draft"));
  const recipes = json(await cli("design", "recipes"));
  expect(recipes.map((one: { id: string }) => one.id)).toEqual(["receiving", "field-guide", "campaign"]);
  const recipe = json(await cli("design", "recipe", "receiving"));
  const output = path.join(f.work, "recipe");
  expect(json(await cli("design", "recipe", "receiving", "--out", output)).id).toBe("receiving");
  expect(await fs.readFile(path.join(output, recipe.htmlFilename), "utf8")).toBe(recipe.html);
  expect(await fs.readFile(path.join(output, "DESIGN.md"), "utf8")).toBe(recipe.design);
}, 60_000);

it("uses the proposed scope's actual screens for creation while the canvas summary counts uncovered screens", async () => {
  const f = fixture = await questionnaireFixture();
  const governed = (await f.agentCanvas.groups.new("Acme governed lane")).itemId!;
  const crowded = (await f.agentCanvas.groups.new("Acme crowded lane")).itemId!;
  const empty = (await f.agentCanvas.groups.new("Acme new lane")).itemId!;
  await f.agentCanvas.add({ title: "Acme lane system", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties(), in: governed });
  for (let index = 0; index < 6; index++) await f.agentCanvas.add({ title: `Acme crowded ${index}`, content: "<main>Existing imported screen</main>", mime: "text/html", in: crowded });
  const file = path.join(f.work, "screen.html"); await fs.writeFile(file, "<main>A new synthetic task</main>");
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  const refused = await cli("add", file, "--in", crowded);
  expect(refused.code).toBe(1); expect(refused.stderr).toContain("this target scope has 6 screens");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
  expect((await cli("add", file, "--in", empty)).code).toBe(0);
  expect((await cli("add", file, "--in", governed)).code).toBe(0);
  const summary = json(await cli("design", "direction"));
  expect(summary.standing).toMatchObject({ standing: "overdue", screenCount: 8 });
  expect(summary.standing.uncoveredIds).toHaveLength(7);
  const scoped = json(await cli("design", "direction", "--in", empty));
  expect(scoped.standing).toMatchObject({ standing: "fine", screenCount: 1, scopeId: empty });
  expect((await cli("design", "show", "--in", "missing_acme_lane")).code).toBe(1);
}, 60_000);

it("leaves malformed working content editable without preparing a pending intent, while preserving an uncertain intent", async () => {
  const f = fixture = await questionnaireFixture();
  await f.agentCanvas.add({ title: "Acme editable system", content: auditDesign(), mime: "text/markdown", properties: designSystemProperties() });
  const folder = path.join(f.work, "validation"), file = path.join(folder, "DESIGN.md"), journal = path.join(folder, "DESIGN.intent.json");
  json(await cli("design", "project", folder));
  const before = (await f.client.snapshot(f.canvasId)).lastSeq;
  const invalid = "---\ncolors: [unsupported\n---\n## Usage\nAcme invalid draft.\n";
  await fs.writeFile(file, invalid);
  const refused = await cli("design", "reconcile", folder);
  expect(refused.code).toBe(1); expect(refused.stderr).toContain("replacement design cannot be read");
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(before);
  await expect(fs.access(journal)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await fs.readFile(file, "utf8")).toBe(invalid);
  await fs.writeFile(file, auditDesign("Acme corrected draft"));
  expect(json(await cli("design", "reconcile", folder))).toMatchObject({ status: "accepted", consistency: { status: "current" } });
  // A lost acknowledgement remains uncertain: a later edit cannot replace it.
  const pending = { projection: JSON.parse(await fs.readFile(path.join(folder, "DESIGN.projection.json"), "utf8")), text: auditDesign("Acme uncertain draft"), opId: "op_acme_uncertain", versionId: "ver_acme_uncertain" };
  const frozen = JSON.stringify(pending), io = designSystemPort(f.agent);
  await fs.writeFile(journal, frozen);
  expect(await reconcileDesignProjection({ ...io, edit: async (...args) => { await io.edit(...args); throw new TypeError("Synthetic lost acknowledgement"); } }, pending)).toMatchObject({ status: "pending" });
  const changed = await cli("design", "reconcile", folder);
  expect(changed.code).toBe(1); expect(changed.stderr).toContain("changed after preparation");
  expect(await fs.readFile(journal, "utf8")).toBe(frozen);
  const afterUncertain = (await f.client.snapshot(f.canvasId)).lastSeq;
  await fs.writeFile(file, pending.text);
  expect(json(await cli("design", "reconcile", folder))).toMatchObject({ status: "accepted", opId: pending.opId });
  expect((await f.client.snapshot(f.canvasId)).lastSeq).toBe(afterUncertain);
}, 60_000);
