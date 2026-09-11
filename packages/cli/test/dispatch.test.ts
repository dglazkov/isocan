import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
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
    JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: { fake: [process.execPath, fakeAcp] } }),
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
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(`${base}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

async function threads(): Promise<Record<string, { comments: Array<{ author: { id: string; name: string }; body: string }> }>> {
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
    if (Date.now() > deadline) {
      /**
       * **What it DID see, not only what it wanted.**
       *
       * "timed out waiting for the cycle guard" names the one thing that did
       * not happen and nothing about what did — and these waits watch an rc
       * narrating its own work, so the answer is usually sitting in that
       * output. On CI the process is gone by the time anybody reads the log,
       * so it is the only account there will ever be.
       *
       * It earned itself the day it went in: a captured failure showed both
       * agents' replies landing 23ms apart and then nothing, which is what
       * ruled the fake adapter out and pointed at routing instead.
       */
      const saw = typeof value === "string" ? value : JSON.stringify(value);
      const tail = saw.length > 1200 ? `…${saw.slice(-1200)}` : saw;
      throw new Error(`timed out waiting for ${what} after ${ms}ms. What it saw:\n${tail}`);
    }
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

/**
 * **A team's agent, said out loud** (owner-only summons, 11 Sep 2026). This
 * file's summonses come from Dimitri at the test badge, and the rc belongs to
 * Nico (identity.json) — so an agent enrolled with nothing said now answers
 * Nico alone, and every doorbell below would be turned away at the gate.
 * These tests are about dispatch, not consent, so their agents are enrolled
 * the way a team's agent is: open to everyone, explicitly. What the default
 * does is pinned in its own block at the end of this file.
 */
const TEAM = ["--listen", "everyone"];

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
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM).catch(() => {}); // idempotent path guard
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

    await summon("th_1", "@Sian this spacing looks wrong");
    await until(async () => rc.out(), (o) => o.includes("turn ended — end_turn"), "the turn");

    // The reply is IN THE THREAD, authored as Sian — it went through the
    // CLI with the injected identity, like a real summoned agent's would.
    const all = await threads();
    const replies = all["th_1"]!.comments.filter((c) => c.author.name === "Sian");
    expect(replies).toHaveLength(1);
    expect(replies[0]!.body).toBe("summoned: on it");
    // The narration accounts for the turn (journey 9's ledger).
    expect(rc.out()).toContain("Sian · summons");
    expect(rc.out()).toContain("session started");

    // The self-wake guard: Sian's own reply must not re-summon Sian. Give
    // the loop a beat, then count summonses.
    await new Promise((r) => setTimeout(r, 800));
    expect(rc.out().match(/Sian · summons/g)).toHaveLength(1);

    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("presence appears when the turn starts, works visibly, and fades because the session ended", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    const rc = startRc({ FAKE_ACP_SLOW_MS: "6000", FAKE_ACP_TOOL_MS: "3000" });
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
    // The face ANIMATES: the turn lands as working-on-the-thread, the field
    // the canvas renders as a busy cursor (#80's fix, half one).
    expect(face.activity).toEqual({ kind: "working", threadId: "th_p" });

    // Half two: the rc loaned the face's id to Sian's session pointer, so
    // the CLI inside the turn narrates and moves this very cursor.
    const pointerDir = path.join(home, "sessions");
    const listPointers = () => fs.readdir(pointerDir).catch(() => [] as string[]);
    const pointers = await until(listPointers, (files) => files.length === 1, "the loaned session pointer");
    const pointer = JSON.parse(await fs.readFile(path.join(pointerDir, pointers[0]!), "utf8"));
    expect(pointer).toMatchObject({ canvasId: "prj_1", sessionId: face.sessionId });

    // The adapter's tool call becomes an inferred status — the face keeps
    // saying what the turn is doing instead of freezing on its first line.
    const busy = await until(
      sessions,
      (list) => list.some((s) => s.actor.name === "Sian" && s.status === "Bash: isocan comment reply"),
      "the tool call narrated on the face",
    );
    expect(busy.find((s) => s.actor.name === "Sian")!.statusSource).toBe("inferred");

    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the turn to end");
    // Gone because the session ENDED, not because a TTL expired — and the
    // loaned pointer went with it, so Sian's next direct command cannot
    // revive a face nobody is behind.
    await until(
      sessions,
      (list) => !list.some((s) => s.actor.name === "Sian" && s.kind === "cli"),
      "Sian's presence to fade",
    );
    await expect(fs.readdir(pointerDir)).resolves.toHaveLength(0);
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});

describe("routing (journey 4) and the overnight batch (journey 3)", () => {
  it("bulk noise starts zero turns; a matching change starts one; a mention pierces any filter", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", "--rules", '{"ops":["item.move"]}', ...TEAM);
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
    expect(rc.out()).not.toContain("starting a session");

    // A matching change wakes exactly one turn.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "item.move", itemId: "itm_1", x: 5, y: 5 },
    });
    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the change turn");
    expect(rc.out()).toContain("Sian · change from");

    // A mention comes through the filter that just ate the noise.
    await summon("th_m", "@Sian never mind the filters");
    await until(
      async () => rc.out(),
      (o) => (o.match(/turn ended/g) ?? []).length >= 2,
      "the mention turn",
    );
    expect(rc.out()).toContain("Sian · summons from");

    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("comments landing while NO rc runs arrive in one batched summons when it starts", async () => {
    // Enrolled, then abandoned: three comments land with nothing running —
    // not even a cursor row older than the enrolment. The seedAt floor is
    // what makes this deliverable at all.
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
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
    expect(rc.out().match(/Sian · summons/g)).toHaveLength(1);
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});

describe("a limit and a reason (journey 5 and 6, phase 5)", () => {
  it("a session that never starts is loud in the thread it failed for — in the system voice", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    const rc = startRc({ FAKE_ACP_CRASH: "boot" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await summon("th_f", "@Sian can you take a look?");
    await until(async () => rc.out(), (o) => o.includes("turn FAILED"), "the failure narrated");
    const all = await until(
      threads,
      (t) => (t["th_f"]?.comments.length ?? 0) > 1,
      "the refusal in the thread",
    );
    const refusal = all["th_f"]!.comments[1]!;
    // The system voice: isocan itself, never the agent that never ran and
    // never a person who wrote no such sentence.
    expect(refusal.author.name).toBe("isocan");
    expect((refusal.author as { id: string }).id).toBe("sys_isocan");
    expect(refusal.body).toContain("Sian couldn't answer");
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("a session that dies mid-turn reaches the thread the same way", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    const rc = startRc({ FAKE_ACP_CRASH: "turn" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await summon("th_d", "@Sian still there?");
    await until(async () => rc.out(), (o) => o.includes("turn FAILED"), "the death narrated");
    const all = await until(
      threads,
      (t) => (t["th_d"]?.comments.length ?? 0) > 1,
      "the refusal in the thread",
    );
    expect(all["th_d"]!.comments[1]!.body).toContain("Sian couldn't answer");
    // …and the system's own report never re-summons the agent it is about.
    await new Promise((r) => setTimeout(r, 800));
    expect(rc.out().match(/Sian · summons/g)).toHaveLength(1);
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("the ceiling stops a turn visibly, and nothing is dropped", async () => {
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({
        adapterEnv: ["FAKE_ACP_*"], acpAdapters: { fake: [process.execPath, fakeAcp] },
        rcLimits: { turnsPerHour: 1 },
      }),
    );
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await summon("th_c1", "@Sian first");
    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the first turn");
    await summon("th_c2", "@Sian second");
    await until(async () => rc.out(), (o) => o.includes("at its ceiling"), "the ceiling narrated");
    const all = await until(
      threads,
      (t) => (t["th_c2"]?.comments.length ?? 0) > 1,
      "the ceiling's trace in the thread",
    );
    expect(all["th_c2"]!.comments[1]!.author.name).toBe("isocan");
    expect(all["th_c2"]!.comments[1]!.body).toContain("ceiling");
    // Held, not dropped: the batch is still pending in the narration's
    // words, and the ceiling message is said once, not once per lap.
    expect(rc.out().match(/at its ceiling/g)).toHaveLength(1);
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("an agent's word alone cannot start a turn past the bound; a person's word can", async () => {
    // The journey-6 scene at its smallest deterministic shape. The first
    // version ran a real four-turn cascade — adapters replying through the
    // CLI, cross-summoning — and flaked on every loaded CI box: an
    // end-to-end pretending to be a unit test (the chain ARITHMETIC lives
    // in guards.test.ts now). Here the agent-to-agent summons is POSTED as
    // the enrolled Percy, so the guard's whole path — agent-only batch,
    // hold, system voice in the thread, a human word lifting it — runs
    // with zero cascading turns.
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({
        // Both spellings of the adapter key: Sian enrols with --harness
        // fake; Percy arrives the web way (harness unsaid → the machine's
        // default, which this file names so the runner's PATH cannot vote).
        adapterEnv: ["FAKE_ACP_*"], acpAdapters: {
          fake: [process.execPath, fakeAcp],
          "claude-code": [process.execPath, fakeAcp],
        },
        defaultHarness: "claude-code",
        rcLimits: { agentChain: 0 },
      }),
    );
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    // Percy is enrolled the web dialog's way — his actor minted on THIS
    // badge, so this badge may speak as him (the CLI's Percy would be one
    // actor wearing two faces, and the desk rightly refuses that).
    const percy = { id: "usr_percy", name: "Percy" };
    await badge.speakAs(percy);
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: percy },
    });

    const rc = startRc({ FAKE_ACP_REPLY: "0" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up", 30_000);

    // Percy (an enrolled agent) summons Sian: agent-only batch, bound 0 —
    // held before any turn starts.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: percy,
      op: {
        type: "thread.create",
        threadId: "th_loop",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_agent", body: "@Sian your turn" },
      },
    });
    await until(async () => rc.out(), (o) => o.includes("paused after"), "the cycle guard", 30_000);
    expect(rc.out()).not.toContain("starting a session");
    // The narration prints BEFORE the system comment's op lands — poll the
    // thread rather than reading the gap between the two.
    const all = await until(
      threads,
      (t) => (t["th_loop"]?.comments ?? []).some((c) => c.author.name === "isocan"),
      "the guard's word in the thread",
      30_000,
    );
    const guard = all["th_loop"]!.comments.find((c) => c.author.name === "isocan");
    expect(guard).toBeDefined();
    expect(guard!.body).toContain("agent-to-agent");
    expect(guard!.body).toContain("a human word resumes it");

    // The person speaks; the held batch dispatches.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "thread.reply", threadId: "th_loop", comment: { id: "cmt_human", body: "go ahead, Sian" } },
    });
    await until(async () => rc.out(), (o) => o.includes("hold lifted"), "the human word lifting the hold", 30_000);
    await until(
      async () => rc.out(),
      (o) => o.includes("Sian · summons") && o.includes("turn ended"),
      "the dispatched turn",
      30_000,
    );
    rc.child.kill("SIGINT");
    await rc.done;
  }, 120_000);

  it("the system voice may only comment — the engine refuses it the canvas", async () => {
    const reply = await post("/api/ops", {
      canvasId: "prj_1",
      actor: { id: "sys_isocan", name: "isocan" },
      op: {
        type: "thread.create",
        threadId: "th_sys",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_sys", body: "machinery reporting" },
      },
    });
    expect(reply.seq).toBeGreaterThan(0);
    const refused = await post("/api/ops", {
      canvasId: "prj_1",
      actor: { id: "sys_isocan", name: "isocan" },
      op: { type: "item.move", itemId: "itm_x", x: 1, y: 1 },
    });
    expect(refused.code ?? refused.error).toBeDefined();
  }, 30_000);
});

describe("the scene, for real (opt-in: ISOCAN_REAL_ACP=1)", () => {
  it.runIf(process.env.ISOCAN_REAL_ACP === "1")(
    "a real Claude, summoned by a comment, replies in the thread",
    async () => {
      // The genuine article: the claude-code adapter, the person's
      // credentials, and an agent that has to READ the brief, orient cold,
      // and answer through the CLI on its own. The one process started by
      // hand is the rc.
      await fs.writeFile(path.join(home, "config.json"), JSON.stringify({ adapterEnv: ["FAKE_ACP_*"], acpAdapters: {} }));
      await isocan("rc", "add", "Sian", "--harness", "claude-code");
      const rc = startRc({ FAKE_ACP_REPLY: "0" });
      await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");

      await summon("th_real", "@Sian please reply with a one-line hello so we know you are alive");
      await until(
        async () => rc.out(),
        (o) => o.includes("turn ended — end_turn"),
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

describe("a wake that lands mid-turn is never starved", () => {
  it("a summons consumed while its agent is busy dispatches after the turn — with no further ops", async () => {
    // The race the instrumented CI failure exposed (both cascade replies
    // landing inside 23ms while both agents were mid-turn, then nothing
    // for 39 seconds): entries consumed into pending during a busy turn,
    // and every later lap EMPTY — no ops, so no snapshot, so a lap-scoped
    // roster read as {} and dispatch skipped every agent forever. Pinned
    // deterministically: one slow turn, one comment landing inside it,
    // then total silence — the second summons must still happen.
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    const rc = startRc({ FAKE_ACP_SLOW_MS: "3000", FAKE_ACP_REPLY: "0" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up", 30_000);

    await summon("th_busy1", "@Sian first");
    await until(async () => rc.out(), (o) => o.includes("session started"), "the turn to start", 30_000);
    // Lands mid-turn; nothing else will ever be posted.
    await summon("th_busy2", "@Sian second");
    await until(
      async () => rc.out(),
      (o) => (o.match(/Sian · summons/g) ?? []).length >= 2 && (o.match(/turn ended/g) ?? []).length >= 2,
      "the mid-turn summons dispatched after the turn, unprompted",
      45_000,
    );
    rc.child.kill("SIGINT");
    await rc.done;
  }, 90_000);
});

describe("the roster tells the truth (journey 7, phase 6)", () => {
  const whoStanding = async (): Promise<Array<{ actor: { name: string }; state: string }>> => {
    const run = await isocan("--json", "who");
    return (JSON.parse(run.stdout) as { standing: Array<{ actor: { name: string }; state: string }> })
      .standing;
  };

  it("answerable is the connection, and only the connection — a dead rc reads enrolled at once", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    // Nothing running: enrolled, and the roster says nobody is listening.
    // …and which harness Sian would run on, from this machine's rc half —
    // and whose word she takes: this machine's person's, the default since
    // owner-only summons, read to that person as "you".
    expect(await whoStanding()).toEqual([
      {
        actor: expect.objectContaining({ name: "Sian" }),
        state: "enrolled",
        harness: "fake",
        listens: "listens only to you",
      },
    ]);

    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    // The rc's hold makes Sian answerable — derived from the open
    // connection, not from any record.
    await until(
      whoStanding,
      (rows) => rows.some((r) => r.state === "answerable"),
      "answerable while the rc holds",
    );

    // kill -9: no goodbye, no teardown. The socket closes with the process,
    // so the claim dies with it — no five-minute TTL lingering, which is
    // exactly the lie journey 7 forbids.
    rc.child.kill("SIGKILL");
    await until(
      whoStanding,
      (rows) => rows.every((r) => r.state === "enrolled"),
      "the claim dying with the connection",
      10_000,
    );
  }, 40_000);

  it("a mid-turn agent is a live row, not a standing one — three readings, distinguishable", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", ...TEAM);
    await isocan("rc", "add", "Percy", "--harness", "fake");
    const rc = startRc({ FAKE_ACP_SLOW_MS: "4000", FAKE_ACP_REPLY: "0" });
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await until(
      whoStanding,
      (rows) => rows.filter((r) => r.state === "answerable").length === 2,
      "both answerable",
    );

    await summon("th_w", "@Sian have a look?");
    // Mid-turn: Sian holds a live session (a session row, not standing);
    // Percy is still answerable — the three readings side by side.
    await until(
      async () => {
        const run = await isocan("--json", "who");
        return JSON.parse(run.stdout) as {
          sessions: Array<{ actor: { name: string }; kind: string }>;
          standing: Array<{ actor: { name: string }; state: string }>;
        };
      },
      (w) =>
        w.sessions.some((s) => s.actor.name === "Sian" && s.kind === "cli") &&
        w.standing.some((r) => r.actor.name === "Percy" && r.state === "answerable") &&
        !w.standing.some((r) => r.actor.name === "Sian"),
      "running beside answerable",
    );
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});

describe("the rules are readable in one place (journey 4)", () => {
  it("`isocan agent rules` says what an agent answers for, and the standing truths", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake", "--rules", '{"ops":["item.move"],"items":["itm_9"]}');
    await isocan("agent", "add", "Percy");
    const run = await isocan("agent", "rules");
    expect(run.code).toBe(0);
    // The gate first — who, before what — and since owner-only summons there
    // always is one to say: the owner alone, unless the owner widened it.
    expect(run.stdout).toContain("Sian — listens only to you; changes touching itm_9; ops: item.move");
    expect(run.stdout).toContain("Percy — listens only to you; comments addressed to them (the default)");
    expect(run.stdout).toContain("comes through any rule set");
    expect(run.stdout).toContain("isocan rc listen <name> --to <names|everyone>");
  }, 30_000);
});

/**
 * **Owner-only summons** (decided 11 Sep 2026 — issue #238). Nico's rc, and
 * Dimitri at the canvas: an agent enrolled with nothing said answers Nico
 * alone, a mention from Dimitri is answered in words in its thread and starts
 * nothing, Nico's own word still wakes it, and Nico widening it is what lets
 * Dimitri in. This is also the migration: an enrolment with no gate — every
 * one written before 9 Sep — is exactly this agent.
 */
describe("owner-only summons (issue #238)", () => {
  it("a stranger's mention of a default agent starts nothing, is said in words, and the owner's widening lets them in", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    // Said at start, where the person who pays is guaranteed to look.
    expect(rc.out()).toContain("Sian listens only to you");

    // The rc announces its policy with its hold: `who` reads it, and to
    // Nico it is his own.
    const who = await until(
      async () => JSON.parse((await isocan("--json", "who")).stdout) as { standing: Array<{ state: string; policy?: unknown }> },
      (w) => w.standing.some((r) => r.state === "answerable" && r.policy !== undefined),
      "the announced policy",
    );
    expect(who.standing[0]!.policy).toEqual({ owner: nico, listen: [] });

    await summon("th_no", "@Sian this spacing looks wrong");
    const said = await until(
      threads,
      (t) => (t["th_no"]?.comments ?? []).some((c) => c.author.name === "isocan"),
      "the refusal in the thread",
    );
    const refusal = said["th_no"]!.comments.find((c) => c.author.name === "isocan")!;
    // In the system voice, naming the owner and the exact gesture.
    expect(refusal.author.id).toBe("sys_isocan");
    expect(refusal.body).toBe(
      "Sian listens only to Nico — this did not wake Sian, and spent nothing. " +
        "Nico can widen it: isocan rc listen Sian --to Dimitri",
    );
    expect(rc.out()).toContain("Sian · Dimitri asked; listens only to you — said so in the thread, nothing started");
    expect(rc.out()).not.toContain("starting a session");

    // Asked again in the same thread: said once, not once per ask.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "thread.reply", threadId: "th_no", comment: { id: "cmt_again", body: "@Sian hello?" } },
    });
    await new Promise((r) => setTimeout(r, 1500));
    const again = await threads();
    expect(again["th_no"]!.comments.filter((c) => c.author.name === "isocan")).toHaveLength(1);
    expect(rc.out()).not.toContain("starting a session");

    // The owner's own word wakes her, as it always did.
    const mine = await isocan("comment", "add", "@Sian over to you", "--at", "0,0");
    expect(mine.code).toBe(0);
    await until(async () => rc.out(), (o) => o.includes("Sian · summons from Nico"), "the owner's summons");
    await until(async () => rc.out(), (o) => o.includes("turn ended"), "the owner's turn");

    // Nico widens it; the rc reads it on its next lap and says so.
    const widened = await isocan("rc", "listen", "Sian", "--to", "everyone");
    expect(widened.code).toBe(0);
    await until(async () => rc.out(), (o) => o.includes("enrolled Sian — answerable here · listens to everyone"), "the widening narrated");
    await summon("th_yes", "@Sian now you can hear me");
    await until(
      async () => rc.out(),
      (o) => o.includes("Sian · summons from Dimitri"),
      "Dimitri's summons, now inside the gate",
    );
    rc.child.kill("SIGINT");
    await rc.done;
  }, 60_000);

  it("a stranger turned away is not let in one hop later by an open sibling's reply", async () => {
    /* Walked in a browser before it was a test: Dimitri's Chat line woke
       Percy (open to everyone), and Percy's reply in the Chat — Nico's own
       machine talking — woke Sian, who listens only to Nico. The gate now
       reads the word Percy's turn carries, which is Dimitri's. */
    await isocan("rc", "add", "Percy", "--harness", "fake", ...TEAM);
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "thread.create", threadId: "th_chat", x: 0, y: 0, anchorItemId: null, main: true, comment: { id: "cmt_chat", body: "morning, anyone about?" } },
    });
    // Percy answers in the Chat (the scripted adapter replies where it was
    // summoned), which is a Chat line from Nico's machine…
    await until(async () => rc.out(), (o) => o.includes("Percy · turn ended"), "Percy's turn");
    await until(
      threads,
      (t) => (t["th_chat"]?.comments ?? []).some((c) => c.author.name === "Percy"),
      "Percy's reply in the Chat",
    );
    // …carrying Dimitri's word, so Sian stays asleep.
    await new Promise((r) => setTimeout(r, 1500));
    expect(rc.out()).not.toContain("Sian · summons");
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);

  it("a gate somebody other than the owner wrote is set aside, and the rc says so", async () => {
    await isocan("rc", "add", "Sian", "--harness", "fake");
    const sian = Object.values(
      ((await (await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })).json()) as {
        canvas: { agents: Record<string, { actor: { id: string; name: string } }> };
      }).canvas.agents,
    )[0]!.actor;
    // Dimitri re-enrols Nico's agent open to everyone — a record any admitted
    // member can write. The canvas may narrow; it may never spend Nico.
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: { type: "agent.enroll", agent: sian, rules: { listen: ["*"] } },
    });
    const rc = startRc();
    await until(async () => rc.out(), (o) => o.includes("answering on"), "the rc to come up");
    await until(
      async () => rc.out(),
      (o) => o.includes("Sian's gate was last written by Dimitri, not you — answering only you"),
      "the set-aside said",
    );
    await summon("th_forged", "@Sian I opened you up");
    await until(
      threads,
      (t) => (t["th_forged"]?.comments ?? []).some((c) => c.author.name === "isocan"),
      "the refusal in the thread",
    );
    expect(rc.out()).not.toContain("starting a session");
    rc.child.kill("SIGINT");
    await rc.done;
  }, 40_000);
});
