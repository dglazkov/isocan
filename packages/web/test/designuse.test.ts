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
import { chooseDesignSystem } from "../src/lib/designuse.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";

/**
 * **Choosing which DESIGN.md governs, on both surfaces, is one op.**
 *
 * `isocan design set <file>` was the only way to choose a design system; the
 * web had none. Its item menu now offers "Use as the design system" on a
 * DESIGN.md, and `isocan design use <item>` is the same act from a terminal.
 * Both go through core's `designUse`, and this holds them to it against a real
 * daemon: the op the web's menu action WOULD send (its sender swapped for a
 * recorder) equals the op the CLI binary logged — and, when the scope already
 * has a system, the op `design set` logs for the same bytes. Also the notes:
 * `design set` says what it governs, as a move already did.
 *
 * Synthetic throughout: Acme's DESIGN.md files.
 */

const cliBin = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-design-use-"));
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

/** A DESIGN.md with these words, in its own directory so its name is DESIGN.md. */
async function designFile(dir: string, words: string): Promise<string> {
  const folder = path.join(home, dir);
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, "DESIGN.md");
  await fs.writeFile(file, `---\nname: ${words}\ncolors:\n  primary: "#1a4d8f"\n---\n\n# ${words}\n`);
  return file;
}

async function add(canvas: string, file: string, ...flags: string[]): Promise<string> {
  return JSON.parse((await ok("--canvas", canvas, "--json", "add", file, ...flags)).stdout).itemId;
}

/** The op the web's menu entry would send, over the canvas as it is now. */
async function webOp(canvas: string, itemId: string, on: boolean): Promise<Operation> {
  useCanvasStore.setState({ canvas: (await client.snapshot(canvas)).canvas });
  const sent: Operation[] = [];
  const use = await chooseDesignSystem(canvas, acme, itemId, on, async (op) => void sent.push(op));
  expect(use, "the web action refused").not.toBeNull();
  expect(sent).toHaveLength(1);
  return sent[0]!;
}

/** The last op the daemon logged — what the CLI just sent. */
async function lastOp(canvas: string): Promise<Operation> {
  const log = await client.getLog(canvas, 0);
  return log.at(-1)!.envelope.op as Operation;
}

/** Two ops that differ only in a freshly minted version id are one act. */
function sameAct(op: Operation): unknown {
  return op.type === "item.addVersion" ? { ...op, version: { ...op.version, id: "ver_" } } : op;
}

describe("design use — the web's menu and the CLI send one op", () => {
  it("makes a DESIGN.md the canvas's system in place when there is none", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme use")).stdout).canvasId;
    const doc = await add(canvas, await designFile("first", "Acme Harbour"));
    const web = await webOp(canvas, doc, true);
    expect(web).toEqual({ type: "item.update", itemId: doc, patch: { properties: { role: "design-system" } } });
    const run = await ok("--canvas", canvas, "design", "use", doc);
    expect(await lastOp(canvas)).toEqual(web);
    expect(run.stderr).toContain("note: “DESIGN.md” is a design system: it governs the whole canvas.");

    // The reverse, from both surfaces.
    const off = await webOp(canvas, doc, false);
    expect(off).toEqual({ type: "item.update", itemId: doc, patch: { removeProperties: ["role"] } });
    const released = await ok("--canvas", canvas, "design", "use", doc, "--off");
    expect(await lastOp(canvas)).toEqual(off);
    expect(released.stderr).toContain("no longer governs the whole canvas");
    expect(released.stderr).toContain("Nothing governs the canvas now");
  });

  it("writes a new version of the scope's system when it has one — what `design set` sends for the same bytes", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme versions")).stdout).canvasId;
    const set = await ok("--canvas", canvas, "design", "set", await designFile("system", "Acme Standard"));
    expect(set.stderr).toContain("note: “DESIGN.md” is a design system: it governs the whole canvas.");
    const system = (await client.snapshot(canvas)).canvas;
    const systemId = Object.values(system.items).find((i) => i.properties.role === "design-system")!.id;

    const candidate = await designFile("candidate", "Acme Night");
    const doc = await add(canvas, candidate, "--at", "900,0");
    const web = await webOp(canvas, doc, true);
    expect(web.type).toBe("item.addVersion");
    expect(web).toMatchObject({ itemId: systemId });

    await ok("--canvas", canvas, "design", "use", doc);
    expect(sameAct(await lastOp(canvas))).toEqual(sameAct(web));
    // The same bytes through `design set` are the same act again.
    await ok("--canvas", canvas, "undo");
    await ok("--canvas", canvas, "design", "set", candidate);
    expect(sameAct(await lastOp(canvas))).toEqual(sameAct(web));
  });

  it("governs the group the DESIGN.md sits in, and says so", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme lanes")).stdout).canvasId;
    const group = JSON.parse((await ok("--canvas", canvas, "--json", "canvas", "group", "new", "Acme Admin")).stdout);
    const groupId = group.itemId ?? group.id ?? group.group?.id;
    const doc = await add(canvas, await designFile("lane", "Acme Admin"), "--in", groupId);
    const web = await webOp(canvas, doc, true);
    const run = await ok("--canvas", canvas, "design", "use", doc);
    expect(await lastOp(canvas)).toEqual(web);
    expect(run.stderr).toContain("it governs only the group “Acme Admin”. Nothing governs the rest of the canvas.");
    // `design set --in` over it versions that one, and says whose it is.
    const set = await ok("--canvas", canvas, "design", "set", await designFile("lane2", "Acme Admin 2"), "--in", groupId);
    expect(set.stderr).toContain("governs only the group “Acme Admin”");
  });

  it("refuses what cannot govern, from the CLI as from the menu", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme refusals")).stdout).canvasId;
    const page = path.join(home, "page.html");
    await fs.writeFile(page, "<!doctype html><title>Acme</title><p>Acme</p>");
    const screen = await add(canvas, page);
    const run = await isocan("--canvas", canvas, "design", "use", screen);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("is not markdown");
  });
});
