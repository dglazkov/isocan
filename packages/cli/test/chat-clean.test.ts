import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs, readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CommentThread, LogEntry } from "@isocan/core";
import { SYSTEM_ACTOR } from "@isocan/core";
import { cleanupOps, cleanupSelection } from "@isocan/core/chatclean";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { harnessVars } from "@isocan/api";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **`isocan comment clean` and `comment rm <thread> <comment>`, over the
 * wire** (24 Sep 2026). One walk on one daemon: a Chat with the owner, a
 * guest and the system voice failing into it; `--dry-run` writes nothing;
 * `--system` takes exactly the notices as ONE group whose ops are the ones
 * core's `cleanupOps` plans — the same function the web's Clean up menu calls
 * — and one `isocan undo` puts every one back where it stood.
 *
 * Who may is the home's question and is walked in the server's
 * `chat-clean.test.ts`; this is the verb. Fixtures are synthetic: Acme.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const nico = { id: "usr_nico", name: "Nico" };
const guest = { id: "usr_acme_guest", name: "Guest" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

interface Run { code: number; stdout: string; stderr: string }

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function ok(...args: string[]): Promise<string> {
  const run = await isocan(...args);
  expect(run.code, `${args.join(" ")}: ${run.stderr}`).toBe(0);
  return run.stdout;
}

let canvasId = "";
const chat = async (): Promise<CommentThread> =>
  (JSON.parse(await ok("comment", "ls", "--json")) as CommentThread[]).find((t) => t.main)!;
const oplog = async (): Promise<LogEntry[]> =>
  (await (await fetch(`${base}/api/projects/${canvasId}/oplog?since=0`, { headers: badge.headers })).json()) as LogEntry[];

async function post(actor: { id: string; name: string }, threadId: string, id: string, body: string): Promise<void> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({ canvasId, actor, op: { type: "thread.reply", threadId, comment: { id, body } } }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
}

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-chatclean-cli-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  await ok("canvas", "create", "Acme Launch");
  await ok("notify", "Kick-off");
  canvasId = (JSON.parse(await ok("canvas", "ls", "--json")) as { id: string }[])[0]!.id;
  badge = await mintTestBadge(base);
  await badge.speakAs(guest);
  const threadId = (await chat()).id;
  await post(SYSTEM_ACTOR, threadId, "cmt_sys1", "Scout couldn't answer — trajectory not found");
  await post(guest, threadId, "cmt_guest", "Here");
  await post(SYSTEM_ACTOR, threadId, "cmt_sys2", "Scout couldn't answer — again");
  await ok("notify", "Thanks");
}, 120_000);

afterAll(async () => {
  await daemon?.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("isocan comment clean", () => {
  it("refuses without exactly one filter", async () => {
    const run = await isocan("comment", "clean");
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("exactly one of --system");
  });

  it("--dry-run counts and writes nothing", async () => {
    const before = (await oplog()).length;
    const out = JSON.parse(await ok("comment", "clean", "--system", "--dry-run", "--json"));
    expect(out).toMatchObject({ dryRun: true, removed: ["cmt_sys1", "cmt_sys2"], threadDeleted: false });
    expect((await oplog()).length).toBe(before);
    expect(await ok("comment", "clean", "--system", "--dry-run")).toContain("would remove 2 system notices from the Chat");
    expect((await oplog()).length).toBe(before);
  });

  it("--system takes the notices as one group — core's plan, the web's ops — and one undo restores them in place", async () => {
    const thread = await chat();
    const order = thread.comments.map((c) => c.id);
    const planned = cleanupOps(thread, cleanupSelection(thread, { kind: "system" }, nico.id, true).map((c) => c.id));
    const before = (await oplog()).length;

    expect(await ok("comment", "clean", "--system")).toContain("removed 2 system notices from the Chat");
    const written = (await oplog()).slice(before);
    expect(written.map((e) => e.envelope.op)).toEqual(planned);
    const groups = new Set(written.map((e) => e.group));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();
    expect((await chat()).comments.map((c) => c.id)).toEqual(order.filter((id) => !id.startsWith("cmt_sys")));

    await ok("undo");
    expect((await chat()).comments.map((c) => c.id)).toEqual(order);
  });

  it("--from names a person by the name they go by; the owner may take theirs", async () => {
    expect(await ok("comment", "clean", "--from", "Guest")).toContain("removed 1 message from Guest");
    expect((await chat()).comments.some((c) => c.id === "cmt_guest")).toBe(false);
    await ok("undo");
  });

  it("comment rm <thread> <comment> removes one message, and ls shows the ids to name", async () => {
    const thread = await chat();
    expect(await ok("comment", "ls")).toContain("cmt_sys1");
    expect(await ok("comment", "rm", thread.id, "cmt_sys1")).toContain("removed cmt_sys1");
    expect((await chat()).comments.map((c) => c.id)).not.toContain("cmt_sys1");
    await ok("undo");
    expect((await chat()).comments.map((c) => c.id)).toEqual(thread.comments.map((c) => c.id));
  });

  it("--all is the thread going, and undo brings the Chat back whole", async () => {
    const thread = await chat();
    expect(await ok("comment", "clean", "--all")).toContain(`removed ${thread.comments.length} messages from the Chat`);
    expect(JSON.parse(await ok("comment", "ls", "--json"))).toEqual([]);
    await ok("undo");
    expect((await chat()).comments.map((c) => c.id)).toEqual(thread.comments.map((c) => c.id));
  });
});

describe("the web sends what the CLI sends", () => {
  it("both surfaces plan with core's cleanupSelection and cleanupOps", () => {
    const web = readFileSync(path.join(repo, "packages/web/src/components/ChatTidy.tsx"), "utf8");
    const cli = readFileSync(path.join(repo, "packages/cli/src/main.ts"), "utf8");
    for (const source of [web, cli]) {
      expect(source).toContain('from "@isocan/core/chatclean"');
      expect(source).toMatch(/cleanupSelection\(/);
      expect(source).toMatch(/cleanupOps\(/);
    }
  });
});
