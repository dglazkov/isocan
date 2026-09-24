import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient, harnessVars } from "@isocan/api";
import type { Operation } from "@isocan/core";
import { chooseVariation } from "../src/lib/choose.ts";
import { itemMenu } from "../src/lib/menuentries.tsx";
import { useCanvasStore } from "../src/stores/canvasStore.ts";
import type { MenuAction, MenuEntry } from "../src/components/ContextMenu.tsx";

/**
 * **Converging an exploration, on both surfaces, is one list of ops.**
 *
 * `isocan choose <item>` was the only way to say "this one won" — nothing in
 * the web imported `convergePlan`, and atlas/convergence.md said so: "no web
 * door". The item menu now offers "Choose this variation" on an item whose
 * source is still here, and it goes through core's `convergePlan` and
 * `convergeOps`, as the verb does. This holds them to it against a real
 * daemon: the ops the menu action WOULD send (its sender swapped for a
 * recorder) equal the ops the CLI binary logged, both under one group — and
 * one undo of the CLI's takes the whole decision back.
 *
 * Synthetic throughout: Acme's checkout screens.
 */

const cliBin = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-choose-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...acme, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  client = new DaemonClient(`http://127.0.0.1:${port}`, home);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8").on("data", (c) => (stdout += c));
  child.stderr!.setEncoding("utf8").on("data", (c) => (stderr += c));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function ok(...args: string[]): Promise<{ stdout: string; stderr: string }> {
  const run = await isocan(...args);
  expect(run.code, run.stderr).toBe(0);
  return run;
}

async function screen(canvas: string, name: string, ...flags: string[]): Promise<string> {
  const file = path.join(home, `${name}.html`);
  await fs.writeFile(file, `<!doctype html><title>${name}</title><p>Acme ${name}</p>`);
  return JSON.parse((await ok("--canvas", canvas, "--json", "add", file, "--title", name, ...flags)).stdout).itemId;
}

const labels = (entries: MenuEntry[]) =>
  entries.filter((e): e is MenuAction => !("separator" in e)).map((a) => a.label);

describe("choose — the item menu and the CLI send one list of ops", () => {
  it("folds the winner onto its source, trashes the exploration, and undoes as one", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme choose")).stdout).canvasId;
    const source = await screen(canvas, "Acme checkout");
    const bold = await screen(canvas, "Acme bold", "--prop", `parent=${source}`, "--at", "0,400");
    const quiet = await screen(canvas, "Acme quiet", "--prop", `parent=${source}`, "--at", "500,400");

    // The menu offers it on a variation, and not on the thing it came from.
    useCanvasStore.setState({ canvas: (await client.snapshot(canvas)).canvas });
    const ctx = { canvasId: canvas, actor: acme, world: { x: 0, y: 0 }, navigate: () => {} };
    const items = useCanvasStore.getState().canvas!.items;
    expect(labels(itemMenu([items[bold]!], ctx))).toContain("Choose this variation");
    expect(labels(itemMenu([items[source]!], ctx))).not.toContain("Choose this variation");

    // What the menu entry would send, recorded rather than sent.
    const sent: Array<{ op: Operation; group: string }> = [];
    const ops = await chooseVariation(canvas, acme, bold, async (op, group) => void sent.push({ op, group }));
    expect(ops, "the web action refused").not.toBeNull();
    expect(new Set(sent.map((s) => s.group)).size, "one group, so one ⌘Z").toBe(1);
    expect(sent[0]!.op).toMatchObject({ type: "item.addVersion", itemId: source });
    expect(sent.slice(1).map((s) => s.op)).toEqual(
      expect.arrayContaining([bold, quiet].map((itemId) => ({ type: "item.delete", itemId }))),
    );
    expect(sent).toHaveLength(3);

    // The CLI, over the same canvas: the same ops, in the same order, one group.
    const before = (await client.getLog(canvas, 0)).length;
    await ok("--canvas", canvas, "choose", bold);
    const logged = (await client.getLog(canvas, 0)).slice(before);
    expect(logged.map((e) => e.envelope.op)).toEqual(sent.map((s) => s.op));
    expect(new Set(logged.map((e) => e.group)).size).toBe(1);
    expect(logged[0]!.group).toBeTruthy();

    const after = (await client.snapshot(canvas)).canvas;
    expect(after.items[source]!.versions).toHaveLength(2);
    expect(after.items[bold]).toBeUndefined();
    expect(after.items[quiet]).toBeUndefined();

    // One undo takes the whole decision back.
    await ok("--canvas", canvas, "undo");
    const undone = (await client.snapshot(canvas)).canvas;
    expect(undone.items[source]!.versions).toHaveLength(1);
    expect(undone.items[bold]).toBeDefined();
    expect(undone.items[quiet]).toBeDefined();
  });

  it("refuses what has nowhere to fold into, from the menu as from the CLI", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme refusals")).stdout).canvasId;
    const lone = await screen(canvas, "Acme lone");
    useCanvasStore.setState({ canvas: (await client.snapshot(canvas)).canvas });
    const sent: Operation[] = [];
    expect(await chooseVariation(canvas, acme, lone, async (op) => void sent.push(op))).toBeNull();
    expect(sent).toEqual([]);
    const run = await isocan("--canvas", canvas, "choose", lone);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("was not made from anything");
  });
});
