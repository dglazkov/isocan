import { afterEach, beforeEach, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **The real CLI half of memory phase 6** (`docs/projects/memory/pin-from-source.md`).
 *
 * The actual binary against an actual daemon: an agent copies a piece out of
 * an inherited source, the copy is pinned and says where it came from, the
 * source is unchanged, one undo takes the whole thing back, and the refusals
 * refuse. Every name here is synthetic (AGENTS.md).
 */

const cli = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
let scratch: string;
let clientHome: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  scratch = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-context-pin-"));
  clientHome = path.join(scratch, "client"); await fs.mkdir(clientHome);
  await fs.writeFile(path.join(clientHome, "identity.json"), JSON.stringify({ id: "usr_theo", name: "Theo", createdAt: "2026-09-18T00:00:00Z" }));
  daemon = await startDaemon({ home: path.join(scratch, "daemon"), port: 0, birthHome: null, contentPort: "off" });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});
afterEach(async () => { if (daemon) await daemon.close(); if (scratch) await fs.rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = { ...process.env };
  for (const key of harnessVars) delete env[key];
  delete env.ISOCAN_CANVAS;
  const child = spawn(process.execPath, [cli, ...args], { cwd: scratch, env: { ...env, ISOCAN_HOME: clientHome, ISOCAN_DIRECT: base }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
  return new Promise((resolve, reject) => { child.on("error", reject); child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr })); });
}
async function json(args: string[]): Promise<any> {
  const result = await run([...args, "--json"]); expect(result.code, result.stderr).toBe(0); return JSON.parse(result.stdout);
}

it("real CLI copies an inherited piece into a local pin with provenance, undoes it, and refuses what it must", async () => {
  const design = (await json(["canvas", "create", "Acme Design System"])).canvasId;
  const project = (await json(["canvas", "create", "Acme Onboarding"])).canvasId;

  const checklistFile = path.join(scratch, "checklist.md");
  await fs.writeFile(checklistFile, "# Review checklist\n\n- read the brief\n");
  const checklist = await json(["add", checklistFile, "--title", "Review checklist", "--canvas", design]);
  expect((await run(["context", "pin", checklist.itemId, "--canvas", design])).code).toBe(0);
  const designFile = path.join(scratch, "DESIGN.md");
  await fs.writeFile(designFile, "# Acme system\n\n- spacing: 8px\n");
  expect((await run(["design", "set", designFile, "--canvas", design])).code).toBe(0);

  // Not inherited yet: `--from` resolves only among visible inheritance links.
  const unlinked = await run(["context", "pin", "Review checklist", "--from", design, "--canvas", project]);
  expect(unlinked.code).not.toBe(0);
  expect(unlinked.stderr).toMatch(/no visible inherited source/);

  await json(["canvas", "place", design, "--inherit", "--canvas", project]);

  // Something the source does not offer: its item list is not the picker.
  const missing = await run(["context", "pin", "Acme sprint plan", "--from", design, "--canvas", project]);
  expect(missing.code).not.toBe(0);
  expect(missing.stderr).toMatch(/Review checklist/);

  const copied = await json(["context", "pin", "Review checklist", "--from", design, "--canvas", project]);
  expect(copied).toMatchObject({ count: 1, title: "Review checklist" });
  expect(copied.source).toMatchObject({ canvasId: design, canvasTitle: "Acme Design System", itemId: checklist.itemId });
  expect(Object.keys(copied.source).sort()).toEqual(["canvasId", "canvasTitle", "home", "itemId", "itemTitle", "versionId"]);

  // This project has a design of its own; copying the source's must not
  // replace it, and the copy must arrive without the governing role.
  const localDesignFile = path.join(scratch, "LOCAL.md");
  await fs.writeFile(localDesignFile, "# Acme Onboarding system\n\n- spacing: 4px\n");
  expect((await run(["design", "set", localDesignFile, "--canvas", project])).code).toBe(0);

  const words = await run(["context", "pin", "DESIGN.md", "--from", design, "--canvas", project]);
  expect(words.code, words.stderr).toBe(0);
  expect(words.stdout).toMatch(/copy of the current version/);
  expect(words.stdout).toMatch(/isocan undo/);

  // A copied design note is a reference here, not the governing design.
  const local = await json(["design", "show", "--canvas", project]);
  expect(JSON.stringify(local)).toContain("spacing: 4px");
  expect(JSON.stringify(local.governing.selection.candidates)).not.toContain("spacing: 8px");
  expect(local.inherited).not.toBe(true);
  expect(local.governing.selection.level).not.toBe("inherited");
  const items = await json(["ls", "--canvas", project]);
  const copiedDesign = items.find((one: any) => one.title === "DESIGN.md" && one.properties.contextSource);
  expect(copiedDesign.properties.role).toBeUndefined();
  expect(copiedDesign.properties.context).toBe("pinned");
  // Exactly one item still governs here, and it is this canvas's own.
  expect(items.filter((one: any) => one.properties.role === "design-system")).toHaveLength(1);

  const layers = await json(["context", "--canvas", project]);
  const piece = layers[0].pieces.find((one: { name: string }) => one.name === "Copied from a source");
  expect(piece.copied.map((one: { title: string }) => one.title).sort()).toEqual(["DESIGN.md", "Review checklist"]);
  expect(piece.copied[0].source.canvasId).toBe(design);
  const printed = await run(["context", "--canvas", project]);
  expect(printed.stdout).toMatch(/copied from “Review checklist” on Acme Design System/);

  // The source is unchanged: the copy took nothing from it.
  const sourceItems = await json(["ls", "--canvas", design]);
  expect(sourceItems.filter((one: { title: string }) => one.title === "Review checklist")).toHaveLength(1);

  // One undo removes the whole copy and its pin.
  expect((await run(["undo", "--canvas", project])).code).toBe(0);
  const after = await json(["context", "--canvas", project]);
  expect(after[0].pieces.find((one: { name: string }) => one.name === "Copied from a source").copied.map((one: { title: string }) => one.title)).toEqual(["Review checklist"]);

  // Unlink the source afterwards: the remaining copy and its bytes stay.
  const card = (await json(["ls", "--canvas", project])).find((one: { title: string }) => one.title === "Acme Design System");
  const unlinked2 = await run(["context", "uninherit", card.id, "--canvas", project]);
  expect(unlinked2.code, unlinked2.stderr).toBe(0);
  const kept = await json(["context", "--canvas", project]);
  expect(kept[0].pieces.find((one: { name: string }) => one.name === "Copied from a source").copied[0].title).toBe("Review checklist");
  const stillThere = await run(["context", "pin", "Review checklist", "--from", design, "--canvas", project]);
  expect(stillThere.code).not.toBe(0);
  expect(stillThere.stderr).toMatch(/no visible inherited source/);
}, 120_000);
