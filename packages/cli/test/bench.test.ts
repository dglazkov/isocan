import { describe, expect, it } from "vitest";
import { BENCH_REACH, type BenchRow } from "@isocan/core";
import {
  answeringFor,
  badge,
  base,
  dimitri,
  isocan,
  post,
  rcRows,
  snapshotAgents,
  spawnCli,
  TEAM,
  until,
  useRcHome,
} from "./rc-fixture.ts";

/**
 * **The bench reads** (`docs/projects/bench/phases.md`, phase 0 — journey 1).
 *
 * The phase's proof, walked with the real binary: from a clean home, enrol two
 * agents the ordinary way, bench each, and bench a third this machine has no
 * running row for. `isocan bench --json` then answers `ready`, `elsewhere` and
 * `unreachable` — three states, reached from three different facts, because a
 * reachability that collapses to a boolean cannot say the one thing journey 1
 * is about: that a summons into silence is not an agent that is thinking.
 *
 * And the third rule, in both directions: **a bench row confers nothing.**
 * Adding one enrols nobody; removing one withdraws nobody.
 */

useRcHome();

/** A parked `isocan rc` on one canvas — what makes an agent answerable, and
 * the only thing that can. `--canvas` because this file has two canvases and
 * the directory's binding can only name one. */
async function parkOn(canvasId: string): Promise<{ stop: () => Promise<void> }> {
  const rc = spawnCli(["--canvas", canvasId, "rc"]);
  let out = "";
  rc.stdout!.setEncoding("utf8");
  rc.stdout!.on("data", (chunk) => (out += chunk));
  rc.stderr!.setEncoding("utf8");
  rc.stderr!.on("data", (chunk) => (out += chunk));
  const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
  await until(async () => out, (o) => o.includes("answering on"), "the rc to come up");
  return {
    stop: async () => {
      rc.kill("SIGINT");
      await done;
    },
  };
}

async function agentsOn(canvasId: string): Promise<string[]> {
  const res = await fetch(`${base}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
  const snapshot = (await res.json()) as {
    canvas: { agents?: Record<string, { actor: { name: string } }> };
  };
  return Object.values(snapshot.canvas.agents ?? {}).map((a) => a.actor.name).sort();
}

async function bench(): Promise<BenchRow[]> {
  const read = await isocan("--json", "bench");
  expect(read.code, read.stderr).toBe(0);
  return (JSON.parse(read.stdout) as { bench: BenchRow[] }).bench;
}

describe("isocan bench", () => {
  it("answers ready, elsewhere and unreachable from three different facts, and rm takes nothing away", async () => {
    await post("/api/ops", {
      canvasId: null,
      actor: dimitri,
      op: { type: "project.create", canvasId: "prj_2", title: "Acme two" },
    });

    // A clean home has no bench and does not invent one by being asked.
    expect(await bench()).toEqual([]);

    // Two agents, enrolled from this machine the ordinary way: the home half
    // lands in canvas state, the running half in ~/.isocan/rc-agents.json.
    expect((await isocan("--canvas", "prj_1", "rc", "add", "Percy", ...TEAM)).code).toBe(0);
    expect((await isocan("--canvas", "prj_2", "rc", "add", "Sian", ...TEAM)).code).toBe(0);
    expect((await rcRows()).map((row) => row.name).sort()).toEqual(["Percy", "Sian"]);
    const percy = Object.values(await snapshotAgents()).find((a) => a.actor.name === "Percy")!.actor;

    // Benching takes the agent from what the machine already knows: no actor
    // is minted, no rc handshake happens, and nothing is enrolled anywhere.
    for (const name of ["Percy", "Sian"]) {
      const added = await isocan("bench", "add", name);
      expect(added.code, added.stderr).toBe(0);
      expect(added.stdout).toContain("grants nothing");
    }
    expect(await agentsOn("prj_1")).toEqual(["Percy"]);
    expect(await agentsOn("prj_2")).toEqual(["Sian"]);

    // An agent this machine has never run cannot be guessed at — but it can be
    // named, because a bench row is a record and a record may name an agent
    // that lives somewhere else entirely.
    const guessed = await isocan("bench", "add", "Wooly");
    expect(guessed.code).not.toBe(0);
    expect(guessed.stderr).toContain("--actor");
    expect((await isocan("bench", "add", "Wooly", "--actor", "usr_wooly", "--harness", "sheep")).code).toBe(0);

    // Nothing is parked yet, so nothing is ready — and the two agents that
    // stand somewhere are told apart from the one that does not.
    expect((await bench()).map((row) => [row.name, row.reach])).toEqual([
      ["Percy", "elsewhere"],
      ["Sian", "elsewhere"],
      ["Wooly", "unreachable"],
    ]);

    const rc = await parkOn("prj_1");
    try {
      await until(() => answeringFor("prj_1"), (ids) => ids.includes(percy.id), "the rc to hold Percy");
      const rows = await bench();
      expect(rows.map((row) => [row.name, row.reach])).toEqual([
        ["Percy", "ready"],
        ["Sian", "elsewhere"],
        ["Wooly", "unreachable"],
      ]);
      // All three values are reachable, and no code path collapses them into
      // two: the set of answers on one bench is the whole vocabulary.
      expect([...new Set(rows.map((row) => row.reach))].sort()).toEqual([...BENCH_REACH].sort());
      // The record half is the item's, and it says only what it was told.
      expect(rows[0]).toMatchObject({ actorId: percy.id, harness: "claude-code" });
      expect(rows.find((row) => row.name === "Wooly")).toMatchObject({
        harness: "sheep",
        runsAt: null,
        standing: [],
      });
      // A person's table says the same three things in words.
      const printed = await isocan("bench");
      expect(printed.stdout).toContain("ready");
      expect(printed.stdout).toContain("its machine is not here");
      expect(printed.stdout).toContain("nothing here can run it");
      expect(printed.stdout).toContain("standing on 1 canvas");
    } finally {
      await rc.stop();
    }

    // Off the bench, and NOTHING else moves: Sian still stands on prj_2, and
    // this machine still holds her running row. "A bench row confers nothing"
    // has to cut both ways or the bench is a second registry.
    const removed = await isocan("bench", "rm", "Sian");
    expect(removed.code, removed.stderr).toBe(0);
    expect((await bench()).map((row) => row.name)).toEqual(["Percy", "Wooly"]);
    expect(await agentsOn("prj_2")).toEqual(["Sian"]);
    expect((await rcRows()).map((row) => row.name).sort()).toEqual(["Percy", "Sian"]);
    // And an agent nobody benched is not on the bench to remove.
    expect((await isocan("bench", "rm", "Sian")).code).not.toBe(0);
  }, 120_000);
});
