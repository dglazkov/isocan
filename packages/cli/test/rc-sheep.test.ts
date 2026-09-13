import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { collect, dimitri, home, post, rcRows, spawnCli, TEAM, until, useRcHome } from "./rc-fixture.ts";
import {
  env,
  kennel,
  run,
  sheepCalls,
  sheepPass,
  sheepState,
  stateFile,
  useSheepHome,
} from "./sheep-fixture.ts";

/**
 * **The sheep harness** (sheep-harness phase 1). `sheep` is found on the
 * PATH and its home by the kennel walk, never by a config block: a fake
 * `sheep` on the PATH answers from a state file and records every call, and
 * a `.sheep/` beside the test's home names the sheep home. The rc's side of
 * journeys 1, 2, 3 and 5, as far as a fake can carry them.
 *
 * Phase 2's endings are `rc-sheep-withdrawal.test.ts` — the same describe
 * name, a second file, so the runner can overlap the two halves.
 */

useRcHome();
useSheepHome();

describe("the sheep harness (sheep-harness phase 1)", () => {

  it("enrol, birth, resume: one sheep, its home on the row, the pass in no argument", async () => {
    expect((await run("rc", "add", "Percy", "--harness", "sheep")).code).toBe(0);

    const first = await run("rc", "turn", "Percy", "the", "empty", "state");
    expect(first.code, first.stderr).toBe(0);
    expect(first.stderr).toContain("birthing a sheep for Percy at the local sheep home in");
    expect(first.stderr).toContain("making pasture isocan-percy");
    expect(first.stderr).toContain("minting a pass for Percy — single-use, fifteen minutes, the sheep's own secret");
    expect(first.stderr).toContain("sheep s_1 minted — no turn spent; its first container runs setup before this summons");
    expect(first.stderr).toContain("session s_1 started");
    // The tool beat: from the entries `sheep attach --json` streams, and the
    // reply from the assistant's entry; nothing reads the transcript.
    expect(first.stderr).toContain('Percy · tool bash isocan comment reply th_1 "on it"');
    expect(first.stdout).toContain("on it");

    const row = (await rcRows()).find((r) => r.name === "Percy")!;
    expect(row.sessionId).toBe("s_1");
    expect(row.sheep).toEqual({ kennel: path.join(await fs.realpath(home), ".sheep"), home: "local" });

    // Journey 3: the pass is the sheep's own secret — at the address a
    // container reaches — and in no argument the rc ever passed.
    const pass = (await sheepPass())!;
    expect(pass).toContain("host.docker.internal");
    expect(pass).toContain("prj_1");
    const calls = await sheepCalls();
    expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
    expect(calls.some((c) => c.argv[0] === "log")).toBe(false);
    expect(calls.find((c) => c.argv[0] === "attach")!.argv.slice(0, 3)).toEqual(["attach", "--wait", "--json"]);
    // Every call ran where the kennel is, so sheep's own walk finds it.
    expect(new Set(calls.map((c) => c.cwd))).toEqual(new Set([await fs.realpath(home)]));

    // Journey 2: the same sheep, resumed; no second birth, no second pass.
    const second = await run("rc", "turn", "Percy", "and", "the", "heading");
    expect(second.code, second.stderr).toBe(0);
    expect(second.stderr).toContain("session s_1 resumed");
    expect(second.stderr).not.toContain("minting a pass");
    const after = await sheepCalls();
    expect(after.filter((c) => c.argv[0] === "new")).toHaveLength(1);
    expect(after.some((c) => c.argv[1] === "secret")).toBe(false);
    // The tree is put again for the resumed sheep, so it runs the current
    // setup script and brief in its next container.
    const puts = after.filter((c) => c.argv[0] === "pasture" && c.argv[1] === "put").map((c) => c.argv[3]);
    expect(puts.filter((f) => f === "setup.sh")).toHaveLength(2);
    expect((await sheepState()).pastures["isocan-percy"].tree["setup.sh"]).toContain("/home/sheep");
    const summons = after.filter((c) => c.argv[0] === "attach").map((c) => c.argv.at(-1));
    expect(summons).toEqual(["the empty state", "and the heading"]);
    expect((await rcRows()).find((r) => r.name === "Percy")!.cellPass).toEqual(row.cellPass);

    // A kennel re-pointed since the birth is refused, naming both homes.
    await kennel({ home: "https://station.example", token: "t" });
    const moved = await run("rc", "turn", "Percy", "again");
    expect(moved.code).not.toBe(0);
    expect(moved.stderr).toContain("Percy's sheep live at the local sheep home in");
    expect(moved.stderr).toContain("now names https://station.example");
  }, 40_000);

  it("a sheep the row forgot is resumed from the pasture's herd, not born twice", async () => {
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        sessions: [{ id: "s_9", name: "Percy", pasture: "isocan-percy", createdAt: 0, state: "idle", task: null, setup: null }],
        pastures: { "isocan-percy": { tree: {}, secrets: {} } },
        entries: {},
        next: 10,
      }),
    );
    await run("rc", "add", "Percy", "--harness", "sheep");
    const turn = await run("rc", "turn", "Percy", "hello");
    expect(turn.code, turn.stderr).toBe(0);
    expect(turn.stderr).toContain("sheep s_9 is already in pasture isocan-percy — resuming it rather than birthing a second");
    expect(turn.stderr).toContain("session s_9 resumed");
    // Minted and never asked, so nothing has run in it yet, and that is said.
    expect(turn.stderr).toContain("sheep s_9 has never run setup, so its first container runs it before this summons");
    expect(turn.stderr).not.toContain("minting a pass");
    const calls = await sheepCalls();
    expect(calls.some((c) => c.argv[0] === "new")).toBe(false);
    expect(calls.some((c) => c.argv[1] === "secret")).toBe(false);
    const row = (await rcRows()).find((r) => r.name === "Percy")!;
    expect(row.sessionId).toBe("s_9");
    expect(row.cellPass).toBeUndefined();
  }, 30_000);

  it("a parked rc says where the sheep will live, and answers a summons from a cell", async () => {
    await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
    const rc = spawnCli(["rc"], env);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("Percy's sheep will live at the local sheep home in"), "the rc to say where");
    await post("/api/ops", {
      canvasId: "prj_1",
      actor: dimitri,
      op: {
        type: "thread.create",
        threadId: "th_1",
        x: 0,
        y: 0,
        anchorItemId: null,
        comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
      },
    });
    await until(async () => out, (o) => o.includes("Percy · turn ended"), "the turn from the cell");
    expect(out).toContain("Percy · making pasture isocan-percy");
    expect(out).toContain("Percy · session started at the local sheep home in");
    // The summons a sheep receives is the text a local adapter would.
    const attach = (await sheepCalls()).find((c) => c.argv[0] === "attach")!;
    expect(attach.argv.at(-1)).toContain("This is a summons");
    expect(attach.argv.at(-1)).toContain("@Percy the empty state reads wrong");
    rc.kill("SIGINT");
    await done;
    expect((await rcRows()).find((r) => r.name === "Percy")!.sheep?.home).toBe("local");
  }, 40_000);

  it("journey 5: a machine with no sheep enrols, and its rc says so and answers for everyone else", async () => {
    const bare = { PATH: path.join(home, "no-such-bin"), FAKE_SHEEP_STATE: stateFile };
    expect((await collect(spawnCli(["rc", "add", "Percy", "--harness", "sheep"], bare))).code).toBe(0);
    const rc = spawnCli(["rc"], bare);
    let out = "";
    rc.stdout!.setEncoding("utf8");
    rc.stdout!.on("data", (chunk) => (out += chunk));
    const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
    await until(async () => out, (o) => o.includes("answering for everyone else"), "the rc to say so");
    expect(out).toContain("Percy names sheep, and this machine has no `sheep` on its PATH — npm install -g github:dglazkov/sheep#release");
    rc.kill("SIGINT");
    await done;
  }, 30_000);

  it("journey 5: a station asked to reach a canvas on this machine is refused at the summons, naming both", async () => {
    await kennel({ home: "https://station.example", token: "t" });
    expect((await run("rc", "add", "Percy", "--harness", "sheep")).code).toBe(0);
    const turn = await run("rc", "turn", "Percy", "hello");
    expect(turn.code).not.toBe(0);
    expect(turn.stderr).toContain("Percy's sheep live at https://station.example, a station, which cannot reach \"P\"");
    expect(turn.stderr).toContain("127.0.0.1");
    expect(turn.stderr).toContain("move the canvas to a home with an address, or make the sheep home a local one");
    expect((await sheepCalls()).length).toBe(0);
  }, 30_000);

  /**
   * **The birth without a turn** (sheep-harness phase 2.5). The first
   * summons for an agent with no sheep mints one idle — `sheep new --detach`
   * with no prompt, the pass on stdin as the sheep's own `ISOCAN_PASS` — and
   * sends the summons straight to it. No model turn is spent on the birth,
   * nothing is put in the pasture's secrets, and the summons is the only
   * prompt the sheep ever gets. A `sheep` or a home from before per-sheep
   * secrets mints the sheep and drops the secret without a word, so the rc
   * reads the new sheep's `secrets` in `sheep ls --json` and, when the name
   * is missing, gives the pass to the pasture instead and says so.
   */
  describe("the birth without a turn (sheep-harness phase 2.5)", () => {
    const summon = () =>
      post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy the empty state reads wrong" },
        },
      });

    it("a parked rc's summons mints the sheep with --detach --secret and no prompt, and is its one attach", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const rc = spawnCli(["rc"], env);
      let out = "";
      rc.stdout!.setEncoding("utf8");
      rc.stdout!.on("data", (chunk) => (out += chunk));
      const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
      await until(async () => out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await summon();
      await until(async () => out, (o) => o.includes("Percy · turn ended"), "the turn from the cell");
      expect(out).toContain("Percy · sheep s_1 minted — no turn spent; its first container runs setup before this summons");
      expect(out).not.toContain("has never run setup");

      const calls = await sheepCalls();
      const pass = (await sheepPass())!;
      expect(pass).toContain("prj_1");
      // The mint: exactly these words, no `--` and so no prompt, the pass
      // the one line of its stdin and in no argument anywhere.
      const births = calls.filter((c) => c.argv[0] === "new");
      expect(births.map((c) => c.argv)).toEqual([
        ["new", "--detach", "--name", "Percy", "--pasture", "isocan-percy", "--secret", "ISOCAN_PASS"],
      ]);
      expect(births[0]!.stdin).toBe(`${pass}\n`);
      expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
      // Nothing in the pasture's secrets; the name is on the sheep.
      expect(calls.some((c) => c.argv[1] === "secret")).toBe(false);
      const state = await sheepState();
      expect(state.pastures["isocan-percy"].secrets).toEqual({});
      expect(state.sessions.map((s: { id: string; secrets?: string[] }) => [s.id, s.secrets])).toEqual([["s_1", ["ISOCAN_PASS"]]]);
      // One prompt ever reached the sheep, and it is the summons: the only
      // call carrying `--` is the one attach, and the transcript opens with it.
      const prompted = calls.filter((c) => c.argv.includes("--"));
      expect(prompted.map((c) => c.argv[0])).toEqual(["attach"]);
      expect(prompted[0]!.argv.at(-1)).toContain("@Percy the empty state reads wrong");
      const transcript = state.entries.s_1 as Array<{ message: { role: string; content: unknown } }>;
      expect(transcript[0]!.message).toEqual({ role: "user", content: prompted[0]!.argv.at(-1) });
      // The brief is where the home puts it in every model call.
      expect(Object.keys(state.pastures["isocan-percy"].tree).sort()).toEqual(
        expect.arrayContaining(["BRIEF.md", "setup.sh"]),
      );
      expect(state.pastures["isocan-percy"].tree["BRIEF.md"]).toContain("You are Percy");
      const row = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(row.sessionId).toBe("s_1");
      expect(row.cellPass).toMatchObject({ canvasId: "prj_1", passId: expect.stringMatching(/^pss_/) });
      rc.kill("SIGINT");
      await done;
    }, 40_000);

    it("a `sheep` or home that drops a sheep's own secret: the pass goes to the pasture, said once, and the one sheep is used", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, noSheepSecrets: true }));
      await run("rc", "add", "Percy", "--harness", "sheep");
      const turn = await run("rc", "turn", "Percy", "the", "empty", "state");
      expect(turn.code, turn.stderr).toBe(0);
      expect(turn.stderr).toContain(
        "cannot keep a secret for one sheep (this `sheep` or its home predates it), so the pass is pasture " +
          "isocan-percy's ISOCAN_PASS secret instead, and stays there once spent",
      );
      expect(turn.stderr).toContain("sheep s_1 minted — no turn spent");

      const calls = await sheepCalls();
      // Asked for with --secret, found missing in the listing, and given to
      // the pasture — after the mint and before the one attach.
      const verbs = calls.map((c) => (c.argv[0] === "pasture" ? `pasture ${c.argv[1]}` : c.argv[0]));
      const at = (verb: string) => verbs.indexOf(verb);
      expect(verbs.filter((v) => v === "new")).toHaveLength(1);
      expect(calls.find((c) => c.argv[0] === "new")!.argv).toContain("--secret");
      expect(at("new")).toBeLessThan(at("pasture secret"));
      expect(verbs.slice(at("new") + 1, at("pasture secret"))).toEqual(["ls"]);
      expect(at("pasture secret")).toBeLessThan(at("attach"));
      const state = await sheepState();
      const pass = state.pastures["isocan-percy"].secrets.ISOCAN_PASS as string;
      expect(pass).toContain("prj_1");
      expect(calls.every((c) => !c.argv.join(" ").includes(pass))).toBe(true);
      // One sheep, no opening prompt, nothing ended.
      expect(state.sessions.map((s: { id: string }) => s.id)).toEqual(["s_1"]);
      expect(calls.some((c) => c.argv[0] === "rm")).toBe(false);
      expect(calls.filter((c) => c.argv.includes("--")).map((c) => c.argv[0])).toEqual(["attach"]);
      expect((await rcRows()).find((r) => r.name === "Percy")!.cellPass).toMatchObject({ canvasId: "prj_1" });
    }, 40_000);
  });

  it("`isocan harness` finds sheep by the scan, with the home its kennel names", async () => {
    const scan = JSON.parse((await run("--json", "harness")).stdout) as { harnesses: Array<{ name: string } & Record<string, unknown>> };
    expect(scan.harnesses.find((h) => h.name === "sheep")).toMatchObject({ installed: true, runnable: true, home: expect.stringContaining("the local sheep home in") });
    await kennel({ home: "https://station.example", token: "t" });
    const table = await run("harness");
    expect(table.stdout).toContain("HOME");
    expect(table.stdout).toContain(`https://station.example (kennel ${path.join(await fs.realpath(home), ".sheep")})`);
    const bare = await collect(spawnCli(["--json", "harness"], { PATH: path.join(home, "no-such-bin") }));
    expect(JSON.parse(bare.stdout).harnesses.find((h: { name: string }) => h.name === "sheep")).toMatchObject({ installed: false, runnable: false });
  }, 30_000);
});
