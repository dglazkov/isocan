import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CANVAS_GROUPS_FEATURE, CLIENT_FEATURES_HEADER, formatBadgeToken } from "@isocan/core";
import { agentSecretFile, agentSessionOf, legacyAgentKey, machineAgentKey } from "../src/agent-key.ts";
import { upsertRcAgent } from "../src/rc.ts";
import { mintTestBadge } from "./badge.ts";
import {
  answeringFor,
  badge,
  base,
  collect,
  dimitri,
  home,
  isocan,
  nico,
  post,
  rcRows,
  snapshotAgents,
  spawnCli,
  until,
  useRcHome,
} from "./rc-fixture.ts";

/**
 * **Agent keys nobody else derives** (docs/projects/room/design.md, the claim
 * rule; room phase 3.5). An agent's actor used to be claimed under
 * `agent:<name>`, which any badge could present, with the actor's id, to
 * become a second holder: the desk resumes an actor for whoever presents the
 * key it was claimed under. Now the key is derived from a secret this machine
 * keeps and the name, existing claims move to it at `isocan rc`'s start and
 * at an enrolment, and the desk's own one-row-per-actor-per-badge rule retires
 * the old row in the same write.
 */

useRcHome();

afterEach(() => {
  vi.useRealTimers();
});

/** The badge `isocan` presents from this machine, sent to the door first if
 * it has not been. */
async function machineToken(machine: string = home): Promise<string> {
  const stored = async () => {
    const identity = JSON.parse(await fs.readFile(path.join(machine, "identity.json"), "utf8")) as {
      auth?: Record<string, { badgeId: string; secret: string }>;
    };
    return Object.values(identity.auth ?? {})[0];
  };
  if (!(await stored())) await collect(spawnCli(["who"], { ISOCAN_HOME: machine }));
  const mine = await stored();
  if (!mine) throw new Error(`the home at ${machine} holds no badge`);
  return formatBadgeToken(mine.badgeId, mine.secret);
}

async function claim(token: string, op: Record<string, unknown>): Promise<{ status: number; code?: string; reason?: string; actor?: { id: string; name: string } }> {
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE,
    },
    body: JSON.stringify({ canvasId: null, op: { type: "actor.claim", ...op } }),
  });
  const body = (await res.json()) as { code?: string; reason?: string; envelope?: { actor: { id: string; name: string } } };
  return {
    status: res.status,
    ...(body.code ? { code: body.code } : {}),
    ...(body.reason ? { reason: body.reason } : {}),
    ...(body.envelope ? { actor: body.envelope.actor } : {}),
  };
}

/**
 * **An agent enrolled by the rc before this phase**: minted on this machine's
 * badge under `agent:<name>`, enrolled on the canvas by this machine's person,
 * with its rc row — exactly what `mintAndEnrol` wrote then.
 */
async function enrolLegacy(name: string): Promise<{ id: string; name: string }> {
  const token = await machineToken();
  const minted = await claim(token, { sessionKey: legacyAgentKey(name), name });
  expect(minted.status).toBe(200);
  const agent = minted.actor!;
  const res = await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      [CLIENT_FEATURES_HEADER]: CANVAS_GROUPS_FEATURE,
    },
    body: JSON.stringify({ canvasId: "prj_1", actor: nico, op: { type: "agent.enroll", agent } }),
  });
  expect(res.status, await res.clone().text()).toBe(200);
  await upsertRcAgent(home, { canvasId: "prj_1", actorId: agent.id, name, harness: "claude-code", cwd: home, sessionId: null });
  return agent;
}

/** The desk's own-badge freshness window (a claim under another key in the
 * last minute is presumed to be a session still starting) is on the daemon's
 * clock, which runs in this process: step past it rather than wait. */
function aMinuteLater(): void {
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(Date.now() + 61_000);
}

/** A comment by Dimitri at the test badge, on a thread of its own. */
async function mention(threadId: string, body: string): Promise<void> {
  await post("/api/ops", {
    canvasId: "prj_1",
    actor: dimitri,
    op: { type: "thread.create", threadId, x: 0, y: 0, anchorItemId: null, comment: { id: `cmt_${threadId}`, body } },
  });
}

async function commentsOn(threadId: string): Promise<number> {
  const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
  const snapshot = (await res.json()) as { canvas: { threads: Record<string, { comments: unknown[] }> } };
  return snapshot.canvas.threads[threadId]?.comments.length ?? 0;
}

const notHeldLine = (name: string) =>
  `${name} is not held by this machine — a pass minted for ${name} hands it over, or re-add it here`;

async function startRc(): Promise<{ out: () => string; stop: () => Promise<void> }> {
  const rc = spawnCli(["rc"]);
  let out = "";
  rc.stdout!.setEncoding("utf8");
  rc.stdout!.on("data", (chunk) => (out += chunk));
  rc.stderr!.setEncoding("utf8");
  rc.stderr!.on("data", (chunk) => (out += chunk));
  const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
  await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
  return {
    out: () => out,
    stop: async () => {
      rc.kill("SIGINT");
      await done;
    },
  };
}

describe("the machine secret", () => {
  it("is created 0600 on first need, derives the same key every time, and another home derives another", async () => {
    const other = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agent-key-"));
    try {
      const key = await machineAgentKey(home, "Percy");
      expect(key).toMatch(/^agent:[A-Za-z0-9_-]{32}$/);
      expect(key).not.toContain("Percy");
      expect(await machineAgentKey(home, "Percy")).toBe(key);
      expect(await machineAgentKey(home, "Shaun")).not.toBe(key);
      if (process.platform !== "win32") {
        expect((await fs.stat(agentSecretFile(home))).mode & 0o777).toBe(0o600);
      }
      expect(await machineAgentKey(other, "Percy")).not.toBe(key);
      expect(agentSessionOf(key)).toBe(key.slice("agent:".length));
    } finally {
      await fs.rm(other, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});

describe("moving agents to machine keys", () => {
  it("a second badge presenting agent:<name> is allowed before the move and refused after; the machine still speaks as the agent", async () => {
    const percy = await enrolLegacy("Percy");
    const sian = await enrolLegacy("Sian");
    const stranger = await mintTestBadge(base);

    // Before: the hole. A badge that has only seen the name on the canvas
    // presents `agent:Sian` with Sian's id and becomes her second holder.
    expect(await claim(stranger.token, { sessionKey: "agent:Sian", as: sian.id })).toMatchObject({ status: 200 });

    aMinuteLater();
    const rc = await startRc();
    await until(async () => rc.out(), (o) => o.includes("moved to this machine's own key"), "the move line");
    // One line for what moved. Sian does not move: another badge holds her
    // under the old key, which is the hole's damage and not this machine's
    // to undo. She is not held by this machine, said once by the room.
    expect(rc.out()).toContain("rc: 1 agent moved to this machine's own key (Percy) — the name alone no longer claims it");
    await until(async () => rc.out(), (o) => o.includes(notHeldLine("Sian")), "Sian said not held");
    expect(rc.out()).not.toContain("Sian is still on the key");
    await until(() => answeringFor(), (ids) => ids.includes(percy.id), "the rc to hold Percy");
    expect(await answeringFor()).not.toContain(sian.id);
    await rc.stop();

    // After: the old key is retired, so the same presentation for Percy is
    // refused as a name somebody else holds.
    const after = await claim(stranger.token, { sessionKey: "agent:Percy", as: percy.id });
    expect(after).toMatchObject({ status: 400, code: "name-taken", reason: "held-elsewhere" });
    // …and a key another machine derives is refused the same way.
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agent-key-"));
    try {
      const theirs = await machineAgentKey(elsewhere, "Percy");
      expect(await claim(stranger.token, { sessionKey: theirs, as: percy.id })).toMatchObject({ status: 400, code: "name-taken" });
    } finally {
      await fs.rm(elsewhere, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
    // Falsified by Sian, who did not move: the old presentation still works
    // for her, from any badge.
    const third = await mintTestBadge(base);
    expect(await claim(third.token, { sessionKey: "agent:Sian", as: sian.id })).toMatchObject({ status: 200 });

    // This machine still speaks as Percy, under the key a turn's environment
    // carries — and no longer under the one the name spells.
    const key = await machineAgentKey(home, "Percy");
    const inside = await collect(spawnCli(["--json", "whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: agentSessionOf(key) }));
    expect(JSON.parse(inside.stdout).id).toBe(percy.id);
    const spelled = await collect(spawnCli(["--json", "whoami"], { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: "Percy" }));
    expect(spelled.stdout).not.toContain(percy.id);

    // Idempotent and quiet: the next start moves nothing and says nothing
    // about Percy's key.
    const again = await startRc();
    await until(() => answeringFor(), (ids) => ids.includes(percy.id), "the rc to hold Percy again");
    expect(again.out()).not.toContain("moved to this machine's own");
    await again.stop();
  }, 60_000);

  it("a dual-held agent is not held here: said once, and a summons for it fails no turn and posts nothing (the claim rule, dual-held)", async () => {
    const percy = await enrolLegacy("Percy");
    const sian = await enrolLegacy("Sian");
    for (const name of ["Percy", "Sian"]) expect((await isocan("rc", "listen", name, "--to", "everyone")).code).toBe(0);
    const stranger = await mintTestBadge(base);
    expect(await claim(stranger.token, { sessionKey: "agent:Sian", as: sian.id })).toMatchObject({ status: 200 });

    aMinuteLater();
    const rc = await startRc();
    await until(async () => rc.out(), (o) => o.includes(notHeldLine("Sian")), "Sian said not held");
    await until(() => answeringFor(), (ids) => ids.includes(percy.id), "the rc to hold Percy");

    // Sian first, then Percy: Percy's turn ending is the witness that the
    // room read past Sian's summons.
    await mention("th_sian", "@Sian the empty state reads wrong");
    await mention("th_percy", "@Percy and the heading above it");
    await until(async () => rc.out(), (o) => o.includes("Percy · turn ended"), "Percy's turn");
    expect(rc.out().split("\n").filter((l) => l.includes(notHeldLine("Sian")))).toHaveLength(1);
    expect(rc.out()).not.toContain("Sian ·");
    expect(rc.out()).not.toContain("turn FAILED");
    expect(await commentsOn("th_sian")).toBe(1);
    expect(await answeringFor()).not.toContain(sian.id);
    await rc.stop();
  }, 60_000);

  it("a refusal that passes is not dual-held: inside the minute, the move is said as still on the old key and the agent stays this machine's", async () => {
    const percy = await enrolLegacy("Percy");
    expect((await isocan("rc", "listen", "Percy", "--to", "everyone")).code).toBe(0);
    // The desk's reason for the minute after this badge's own claim.
    const early = await claim(await machineToken(), { sessionKey: await machineAgentKey(home, "Percy"), as: percy.id });
    expect(early).toMatchObject({ status: 400, code: "name-taken", reason: "claimed-just-now" });

    const rc = await startRc();
    await until(async () => rc.out(), (o) => o.includes("Percy is still on the key its name derives"), "the transient line");
    await until(() => answeringFor(), (ids) => ids.includes(percy.id), "the rc to hold Percy");
    await mention("th_percy", "@Percy now?");
    await until(async () => rc.out(), (o) => o.includes("Percy · turn FAILED") || o.includes("Percy · turn ended"), "Percy's summons");
    // Still inside the minute, the summons claim is refused as transient: the
    // turn is held for a retry, and Percy is never said to be not held.
    expect(rc.out()).toMatch(/Percy · turn FAILED — .*claimed by another session just now.*\(retrying in 60s\)/);
    expect(rc.out()).not.toContain(notHeldLine("Percy"));
    expect(await answeringFor()).toContain(percy.id);
    await rc.stop();
  }, 60_000);

  it("re-adding a name this machine enrolled before the move hands back the same actor, under the machine key", async () => {
    const percy = await enrolLegacy("Percy");
    aMinuteLater();
    await isocan("rc", "remove", "Percy");
    const added = await isocan("--json", "rc", "add", "Percy");
    expect(added.code, added.stderr).toBe(0);
    expect(JSON.parse(added.stdout).enrolled.id).toBe(percy.id);
    expect(added.stderr).toContain("1 agent moved to this machine's own key (Percy)");
    // And from the machine key on, re-adding is the same actor with nothing to move.
    await isocan("rc", "remove", "Percy");
    const again = await isocan("--json", "rc", "add", "Percy");
    expect(JSON.parse(again.stdout).enrolled.id).toBe(percy.id);
    expect(again.stderr).not.toContain("moved to this machine's own");
    expect(Object.keys(await snapshotAgents())).toEqual([percy.id]);
    expect((await rcRows()).map((r) => r.actorId)).toEqual([percy.id]);
  }, 40_000);

  it("a machine that lost its badge still takes up its own agents; another machine's badge does not", async () => {
    const added = await isocan("--json", "rc", "add", "Percy");
    expect(added.code, added.stderr).toBe(0);
    const percy = JSON.parse(added.stdout).enrolled as { id: string; name: string };
    const oldToken = await machineToken();

    // The badge is lost: the credential goes, the claims stay on the desk.
    const identityFile = path.join(home, "identity.json");
    const identity = JSON.parse(await fs.readFile(identityFile, "utf8")) as Record<string, unknown>;
    delete identity.auth;
    await fs.writeFile(identityFile, JSON.stringify(identity));
    const newToken = await machineToken();
    expect(newToken).not.toBe(oldToken);

    const rc = await startRc();
    await until(() => answeringFor(), (ids) => ids.includes(percy.id), "the re-badged rc to hold Percy");
    expect(rc.out()).not.toContain("is not held by this machine");
    await rc.stop();

    // A second machine with a badge of its own, presenting either key it
    // could come up with, is refused.
    const second = await mintTestBadge(base);
    expect(await claim(second.token, { sessionKey: "agent:Percy", as: percy.id })).toMatchObject({ status: 400, code: "name-taken" });
    const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agent-key-"));
    try {
      expect(await claim(second.token, { sessionKey: await machineAgentKey(elsewhere, "Percy"), as: percy.id })).toMatchObject({ status: 400, code: "name-taken" });
    } finally {
      await fs.rm(elsewhere, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 60_000);
});
