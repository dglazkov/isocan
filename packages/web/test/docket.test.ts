import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { DaemonClient, harnessVars } from "@isocan/api";
import { reactOp, type Item, type LogEntry } from "@isocan/core";

/**
 * **Answering a docket question, on both surfaces, is the same ops** (#206 D7).
 *
 * The web answers a finding by clicking the ✅ or ❌ chip under its card —
 * `Reactions.tsx` sends core's `reactOp`. `isocan docket answer` is the same
 * act from a terminal, built from the same `reactOp` (core's `docketAnswer`).
 * This holds the two to it against a real daemon: the ops the chip WOULD send
 * over the canvas as it is equal the ops the CLI binary logged. The docket
 * script then cannot tell who answered from where, which is the point.
 *
 * Synthetic throughout: an Acme finding.
 */

const cliBin = fileURLToPath(new URL("../../cli/bin/isocan.js", import.meta.url));
const acme = { id: "usr_acme", name: "Acme" };
let home: string;
let daemon: Daemon;
let port: string;
let client: DaemonClient;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-docket-"));
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

/** A finding card the way `scripts/docket.mjs` asks one: an item with docket=<slug>. */
async function finding(canvas: string, slug: string, title: string): Promise<string> {
  const file = path.join(home, `${slug}.html`);
  await fs.writeFile(file, `<!doctype html><p>${title}</p>`);
  return JSON.parse((await ok("--canvas", canvas, "--json", "add", file, "--title", title, "--prop", `docket=${slug}`)).stdout).itemId;
}

async function itemOf(canvas: string, itemId: string): Promise<Item> {
  return (await client.snapshot(canvas)).canvas.items[itemId]!;
}

async function log(canvas: string): Promise<LogEntry[]> {
  return client.getLog(canvas, 0);
}

describe("docket answer — the chip and the CLI send the same ops", () => {
  it("accepts with the op a click on ✅ sends, and switching is the two clicks a person would make", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme docket")).stdout).canvasId;
    const id = await finding(canvas, "q-acme-chunk-640000", "Acme entry chunk");

    // Accept: one chip click.
    const click = reactOp(await itemOf(canvas, id), "✅", acme.id);
    const before = (await log(canvas)).length;
    const run = await ok("--canvas", canvas, "docket", "answer", "q-acme-chunk-640000", "accepted");
    const sent = (await log(canvas)).slice(before);
    expect(sent.map((e) => e.envelope.op)).toEqual([click]);
    expect(click).toEqual({ type: "item.react", itemId: id, emoji: "✅", on: true });
    expect(run.stdout).toContain("✅ accepted");

    // Saying it again sends nothing: the op says what should be true.
    const again = (await log(canvas)).length;
    expect((await ok("--canvas", canvas, "docket", "answer", id, "accepted")).stdout).toContain("already said accepted");
    expect((await log(canvas)).length).toBe(again);

    // Switch: the chip clicks are ✅ (off) then ❌ (on), each over the item as it is.
    const now = await itemOf(canvas, id);
    const off = reactOp(now, "✅", acme.id);
    const on = reactOp({ ...now, reactions: {} }, "❌", acme.id);
    const at = (await log(canvas)).length;
    await ok("--canvas", canvas, "docket", "answer", id, "rejected");
    const switched = (await log(canvas)).slice(at);
    expect(switched.map((e) => e.envelope.op)).toEqual([off, on]);
    // One answer, one undo.
    expect(new Set(switched.map((e) => e.group)).size).toBe(1);
    expect(switched[0]!.group).toBeTruthy();
    expect((await itemOf(canvas, id)).reactions).toEqual({ "❌": [acme.id] });
  });

  it("lists what the marks say, answers with a reason, and refuses what is not on the docket", async () => {
    const canvas = JSON.parse((await ok("--json", "canvas", "create", "Acme docket list")).stdout).canvasId;
    const id = await finding(canvas, "q-acme-css-47", "Acme copied CSS");
    const plain = path.join(home, "plain.html");
    await fs.writeFile(plain, "<!doctype html><p>Acme</p>");
    const other = JSON.parse((await ok("--canvas", canvas, "--json", "add", plain, "--title", "Acme screen")).stdout).itemId;

    const open = JSON.parse((await ok("--canvas", canvas, "--json", "docket")).stdout);
    expect(open).toEqual([
      expect.objectContaining({ slug: "q-acme-css-47", itemId: id, verdict: null, takenBy: [] }),
    ]);

    const answered = JSON.parse(
      (await ok("--canvas", canvas, "--json", "docket", "answer", id, "rejected", "--because", "measured on the wrong build")).stdout,
    );
    expect(answered).toMatchObject({ itemId: id, verdict: "rejected", ops: 1 });
    const snapshot = await client.snapshot(canvas);
    const thread = snapshot.canvas.threads[answered.threadId]!;
    expect(thread.anchorItemId).toBe(id);
    expect(thread.comments[0]!.body).toBe("❌ rejected: measured on the wrong build");
    // The reason rides in the answer's group, so one undo takes both back.
    const tail = (await log(canvas)).slice(-2);
    expect(tail[0]!.group).toBe(tail[1]!.group);

    expect((await ok("--canvas", canvas, "docket")).stdout).toContain("❌ rejected by Acme");

    const refused = await isocan("--canvas", canvas, "docket", "answer", other, "accepted");
    expect(refused.code).toBe(1);
    expect(refused.stderr).toContain("is not on the docket");
    const bad = await isocan("--canvas", canvas, "docket", "answer", id, "maybe");
    expect(bad.code).toBe(1);
    expect(bad.stderr).toContain("accepted or rejected");
  });
});
