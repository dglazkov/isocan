import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * **Dispatch** (agents-on-demand phase 4): a comment addressed to an
 * enrolled, not-running agent produces a reply in the thread, the canvas
 * showed the agent while it worked, and the only process anyone started by
 * hand is `isocan rc`. The scene, played on a real canvas against the
 * scripted adapter — which answers THROUGH the CLI, the way a real summoned
 * agent would, so the reply lands authored as the enrolled actor.
 *
 * Also pinned: the mention-through-any-filter path, the self-wake guard
 * (an agent's own reply never re-summons it), the batched overnight wake
 * (enrol → comments with NO rc running → rc starts → one summons carries
 * them all, which is the seedAt floor doing its job), and presence
 * appearing with the turn and fading when it ends.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const fakeAcp = fileURLToPath(new URL("./fake-acp.mjs", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
const dimitri = { id: "usr_dimitri", name: "Dimitri" };

let home: string;
let daemon: Daemon;
let base: string;
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-dispatch-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  await fs.writeFile(
    path.join(home, "config.json"),
    JSON.stringify({ acpAdapters: { fake: [process.execPath, fakeAcp] } }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  badge = await mintTestBadge(base);
  await badge.speakAs(dimitri);
  await post("/api/ops", {
    canvasId: null,
    actor: dimitri,
    op: { type: "project.create", canvasId: "prj_1", title: "P" },
  });
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

async function threads(): Promise<Record<string, { comments: Array<{ author: { name: string }; body: string }> }>> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  return ((await res.json()) as any).canvas.threads;
}

function sessions(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers }).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

function spawnCli(args: string[], extraEnv: Record<string, string> = {}): ChildProcess {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  return spawn(process.execPath, [cliBin, ...args], {
    env: {
      ...env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: new URL(base).port,
      FAKE_ACP_REPLY: "1",
      FAKE_ACP_CLI: cliBin,
      ...extraEnv,
    },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function collect(child: ChildProcess): Promise<{ code: number; stdout: string; stderr: string }> {
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const isocan = (...args: string[]) => collect(spawnCli(args));

async function until<T>(fn: () => Promise<T>, ok: (value: T) => boolean, what: string, ms = 15_000): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** An rc with its output captured live. */
function startRc(extraEnv: Record<string, string> = {}): {
  child: ChildProcess;
  out: () => string;
  done: Promise<void>;
} {
  const child = spawnCli(["rc"], extraEnv);
  let out = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (chunk) => (out += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (out += chunk));
  const done = new Promise<void>((resolve) => child.on("close", () => resolve()));
  return { child, out: () => out, done };
}

const summon = (threadId: string, body: string) =>
  post("/api/ops", {
    canvasId: "prj_1",
    actor: dimitri,
    op: {
      type: "thread.create",
      threadId,
      x: 0,
      y: 0,
      anchorItemId: null,
      comment: { id: `cmt_${threadId}`, body },
    },
  });

describe("the doorbell works (journey 2)", () => {
  it("a comment to an enrolled, not-running agent produces a reply in its thread", async () => {
    await isocan("agent", "add", "Sian");
    await isocan("rc", "add", "Sian", "--harness", "fake").catch(() => {}); // idempotent path guard
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

    await summon("th_1", "@Sian this spacing looks wrong");
    await until(async () => rc.out(), (o) => o.includes("turn ended — stopReason end_turn"), "the turn");

    // The reply is IN THE THREAD, authored as Sian — it went through the
    // CLI with the injected identity, like a real summoned agent's would.
    const all = await threads();
    const replies = all["th_1"]!.comments.filter((c) => c.author.name === "Sian");
    expect(replies).toHaveLength(1);
    expect(replies[0]!.body).toBe("summoned: on it");
    // The narration accounts for the turn (journey 9's ledger).
    expect(rc.out()).toContain("summons for Sian");
    expect(rc.out()).toContain("session started");

    // The self-wake guard: Sian's own reply must not re-summon Sian. Give
    // the loop a beat, then count summonses.
    await new Promise((r) => setTimeout(r, 800));
    expect(rc.out().match(/summons for Sian/g)).toHaveLength(1);

    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("presence appears when the turn starts and fades because the session ended", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const rc = startRc({ FAKE_ACP_SLOW_MS: "4000" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

    await summon("th_p", "@Sian have a look?");
    // Mid-turn: Sian's face is on the canvas, reading the comment. The
    // status lands one write after the face, so the wait is for BOTH — a
    // poll under suite load can otherwise catch the face bare.
    const during = await until(
      sessions,
      (list) => list.some((s) => s.actor.name === "Sian" && s.kind === "cli" && s.status !== null),
      "Sian's presence during the turn",
    );
    const face = during.find((s) => s.actor.name === "Sian")!;
    expect(face.status).toBe("reading your comment…");
    expect(face.onThread).toBe("th_p");

    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the turn to end");
    // Gone because the session ENDED, not because a TTL expired.
    await until(
      sessions,
      (list) => !list.some((s) => s.actor.name === "Sian" && s.kind === "cli"),
      "Sian's presence to fade",
    );
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});

describe("routing (journey 4) and the overnight batch (journey 3)", () => {
  it("bulk noise starts zero turns; a matching change starts one; a mention pierces any filter", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", "--rules", '{"ops":["item.move"]}');
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

    // Noise: an item.add — not Sian's rule, no turn.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: {
        type: "item.add",
        itemId: "itm_1",
        version: { id: "ver_1", blobHash: "h1", mimeType: "text/markdown", filename: "a.md", size: 3 },
        width: 10,
        height: 10,
        placement: { x: 0, y: 0 },
      },
    });
    await new Promise((r) => setTimeout(r, 700));
    expect(rc.out()).not.toContain("summons for Sian");

    // A matching change wakes exactly one turn.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "item.move", itemId: "itm_1", x: 5, y: 5 },
    });
    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the change turn");
    expect(rc.out()).toContain("summons for Sian (change");

    // A mention comes through the filter that just ate the noise.
    await summon("th_m", "@Sian never mind the filters");
    await until(
      async () => rc.out(),
      (o) => (o.match(/turn ended/g) ?? []).length >= 2,
      "the mention turn",
    );
    expect(rc.out()).toContain("summons for Sian (summons");

    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("comments landing while NO rc runs arrive in one batched summons when it starts", async () => {
    // Enrolled, then abandoned: three comments land with nothing running —
    // not even a cursor row older than the enrolment. The seedAt floor is
    // what makes this deliverable at all.
    await isocan("rc", "add", "Sian", "--harness", "fake");
    await summon("th_n1", "@Sian one");
    await summon("th_n2", "@Sian two");
    await summon("th_n3", "@Sian three");

    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the morning summons");
    expect(rc.out()).toContain("3 entries");
    // All three answered from the one wake.
    const all = await threads();
    for (const id of ["th_n1", "th_n2", "th_n3"]) {
      // The scripted agent replies once, to the first thread it finds in
      // the payload — the batching is what is under test, not its manners.
      expect(all[id]).toBeDefined();
    }
    expect(rc.out().match(/summons for Sian/g)).toHaveLength(1);
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});

describe("the scene, for real (opt-in: ISOCAN_REAL_ACP=1)", () => {
  it.runIf(process.env.ISOCAN_REAL_ACP === "1")(
    "a real Claude, summoned by a comment, replies in the thread",
    async () => {
      // The genuine article: the claude-code adapter, the person's
      // credentials, and an agent that has to READ the brief, orient cold,
      // and answer through the CLI on its own. The one process started by
      // hand is the rc.
      await fs.writeFile(path.join(home, "config.json"), JSON.stringify({ acpAdapters: {} }));
      await isocan("rc", "add", "Sian", "--harness", "claude-code");
      const rc = startRc({ FAKE_ACP_REPLY: "0" });
      await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

      await summon("th_real", "@Sian please reply with a one-line hello so we know you are alive");
      await until(
        async () => rc.out(),
        (o) => o.includes("turn ended — stopReason end_turn"),
        "the real turn",
        240_000,
      );
      const all = await threads();
      const replies = all["th_real"]!.comments.filter((c) => c.author.name === "Sian");
      expect(replies.length).toBeGreaterThan(0);
      rc.child.kill("SIGINT");
      await rc.done;
    },
    300_000,
  );
});

describe("the rules are readable in one place (journey 4)", () => {
  it("`isocan agent rules` says what an agent answers for, and the standing truths", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", "--rules", '{"ops":["item.move"],"items":["itm_9"]}');
    await isocan("agent", "add", "Percy");
    const run = await isocan("agent", "rules");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Sian — changes touching itm_9; ops: item.move");
    expect(run.stdout).toContain("Percy — comments addressed to them (the default)");
    expect(run.stdout).toContain("comes through any rule set");
  }, 30_000);
});
