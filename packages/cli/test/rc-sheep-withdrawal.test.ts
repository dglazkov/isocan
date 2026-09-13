import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { mintTestBadge, type TestBadge } from "./badge.ts";
import {
  badge,
  base,
  daemon,
  dimitri,
  home,
  post,
  rcRows,
  spawnCli,
  TEAM,
  until,
  useRcHome,
} from "./rc-fixture.ts";
import { env, run, sheepCalls, sheepPass, sheepState, stateFile, useSheepHome } from "./sheep-fixture.ts";

/**
 * **Withdrawal ends the sheep** — the second half of `rc-sheep.test.ts`,
 * under the same describe name so nothing that cites these cases has to
 * learn a new one. Its own file because these ten cases are 38 s of the 90 s
 * the one rc file used to spend, all of it serial: `sheep-fixture.ts` is
 * what the two halves share.
 */

useRcHome();
useSheepHome();

describe("the sheep harness (sheep-harness phase 1)", () => {
  /**
   * **Withdrawal ends the sheep** (sheep-harness phase 2, journey 4). Every
   * path that withdraws an agent ends its sheep at the sheep home and the
   * badge its cell redeemed at the isocan home, and says each; the pasture
   * stays. The cell is played by a badge redeeming the pass the rc gave the
   * sheep as its own secret, the way the cell's `isocan setup --direct`
   * would, so there is a real badge to end.
   */
  describe("withdrawal ends the sheep (sheep-harness phase 2)", () => {
    const redeemCellPass = async (): Promise<TestBadge> => {
      const address = (await sheepPass("s_1"))!;
      const cell = await mintTestBadge(base);
      const res = await fetch(`${base}/api/passes/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...cell.headers },
        body: JSON.stringify({ token: address.slice(address.indexOf("#") + 1) }),
      });
      if (!res.ok) throw new Error(`the cell could not redeem its pass: ${await res.text()}`);
      return cell;
    };
    const commentsOn = async (threadId: string): Promise<unknown[]> => {
      const res = await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers });
      const snapshot = (await res.json()) as { canvas: { threads: Record<string, { comments: unknown[] }> } };
      return snapshot.canvas.threads[threadId]?.comments ?? [];
    };
    const parked = () => {
      const rc = spawnCli(["rc"], env);
      const seen = { out: "" };
      rc.stdout!.setEncoding("utf8");
      rc.stdout!.on("data", (chunk) => (seen.out += chunk));
      const done = new Promise<void>((resolve) => rc.on("close", () => resolve()));
      return { rc, seen, done };
    };
    /**
     * **The last line a withdrawal writes — and so the only safe sentinel
     * for one** (12 Sep 2026).
     *
     * `withdrawSheep` narrates in two parts. `endSheep` ends the sheep and
     * signs off with *"pasture … stays — it is yours"*; only THEN does
     * `endCellBadge` ask the home which badge redeemed the cell's pass —
     * another HTTP round trip, and another line. Waiting for the pasture
     * line and asserting on the badge line in the next statement is a race,
     * and it is the race that made this file the suite's one source of
     * random red: five releases on 11 Sep 2026, including two docs-only
     * PRs, every one of them with output that stopped dead at *"pasture
     * isocan-percy stays — it is yours"* and no badge line under it. The
     * assertion was right; the wait was one line short.
     *
     * No sheep in this describe ever redeems its pass — the one that does
     * (journey 4) withdraws through a verb, where the whole sequence is on
     * the completed process's stdout — so the badge half always ends in
     * this sentence. Wait for it, and everything the withdrawal said is
     * already in `seen.out`.
     *
     * Only the web-withdraw case below actually asserts on the badge line;
     * the other three stop at the pasture line and were never at risk. They
     * use this sentinel anyway, because one sequence deserves one sentinel:
     * an assertion added under any of them must not have to rediscover that
     * the withdrawal is two halves.
     */
    const withdrawalDone = (name: string) => (out: string) =>
      new RegExp(`${name} · pass pss_\\S+ was never redeemed, so ${name}'s cell holds no badge`).test(out);
    const theWithdrawal = "the withdrawal to finish — the sheep ended AND the cell's badge accounted for";

    it("journey 4: `rc remove` ends the sheep and the cell's badge, keeps the pasture; re-enrolment births anew", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      const birth = await run("rc", "turn", "Percy", "hello");
      expect(birth.code, birth.stderr).toBe(0);
      const born = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(born.cellPass).toMatchObject({ canvasId: "prj_1", passId: expect.stringMatching(/^pss_/) });
      // Until sheep#2, the brief says a cold turn is slow and a dead
      // container is to be reported, not slept on.
      const brief = (await sheepState()).pastures["isocan-percy"].tree["BRIEF.md"] as string;
      expect(brief).toContain("can take a couple of minutes");
      expect(brief).toContain("do not sleep and retry");

      // The cell redeems its pass; the rc's machine names the badge as the cell's.
      const firstPass = await sheepPass("s_1");
      const cell = await redeemCellPass();
      const listed = await run("badges");
      expect(listed.stdout).toMatch(new RegExp(`${cell.badgeId}\\s+cell \\(Percy's sheep\\)`));
      const json = JSON.parse((await run("--json", "badges")).stdout) as { badges: Array<{ badgeId: string; cell?: unknown }> };
      expect(json.badges.find((b) => b.badgeId === cell.badgeId)?.cell).toEqual({ agent: "Percy", sheep: "s_1" });

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("dismissed Percy");
      expect(removed.stdout).toContain("Percy · ending sheep s_1 at the local sheep home in");
      expect(removed.stdout).toContain("Percy · sheep s_1 ended — its container and workspace are gone");
      expect(removed.stdout).toContain("Percy · pasture isocan-percy stays — it is yours");
      expect(removed.stdout).toContain(`Percy · ended badge ${cell.badgeId} — Percy's cell can no longer speak as Percy`);

      // Ended once, beside the row's kennel; the pasture kept; the row gone;
      // the badge a badge nobody holds.
      const rms = (await sheepCalls()).filter((c) => c.argv[0] === "rm");
      expect(rms.map((c) => [c.argv, c.cwd, (c as { exit?: number }).exit])).toEqual([
        [["rm", "--json", "s_1"], await fs.realpath(home), 0],
      ]);
      const after = await sheepState();
      expect(after.sessions).toEqual([]);
      expect(Object.keys(after.pastures)).toEqual(["isocan-percy"]);
      // The pass ended with the sheep; the kept pasture holds no secret.
      expect(after.sheepSecrets.s_1).toBeUndefined();
      expect(after.pastures["isocan-percy"].secrets).toEqual({});
      expect((await rcRows()).some((r) => r.name === "Percy")).toBe(false);
      expect(await daemon.desk.badge(cell.badgeId)).toBeNull();
      expect((await run("badges")).stdout).not.toContain(cell.badgeId);

      // A week later: a new sheep in the same pasture, a new pass, and the
      // rc says the sheep does not remember the first.
      await run("rc", "add", "Percy", "--harness", "sheep");
      const again = await run("rc", "turn", "Percy", "hello again");
      expect(again.code, again.stderr).toBe(0);
      expect(again.stderr).toContain("pasture isocan-percy already exists; the sheep born into it is new and does not remember an earlier one");
      expect(again.stderr).toContain("sheep s_2 minted — no turn spent");
      const reborn = (await rcRows()).find((r) => r.name === "Percy")!;
      expect(reborn.sessionId).toBe("s_2");
      expect(reborn.cellPass!.passId).not.toBe(born.cellPass!.passId);
      const births = (await sheepCalls()).filter((c) => c.argv[0] === "new");
      expect(births.map((c) => c.argv[c.argv.indexOf("--pasture") + 1])).toEqual(["isocan-percy", "isocan-percy"]);
      expect(births.every((c) => c.argv.includes("--secret"))).toBe(true);
      expect(await sheepPass("s_2")).toContain("prj_1");
      expect(await sheepPass("s_2")).not.toBe(firstPass);
      expect((await sheepCalls()).some((c) => c.argv[1] === "secret")).toBe(false);
    }, 60_000);

    it("mid-turn at a parked rc: the turn is aborted and reads as a withdrawal — no failure, no system voice, no retry", async () => {
      // A turn that takes a minute, so the withdrawal lands under it.
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, attachMs: 60_000 }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
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
      await until(async () => (await sheepState().catch(() => null))?.sessions?.[0]?.state, (s) => s === "busy", "the turn to be running in the cell");

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      await until(async () => seen.out, (o) => o.includes("Percy · turn stopped — Percy was withdrawn"), "the turn to read as a withdrawal");
      // Whichever of the verb and the rc reached the home first ended it,
      // and said the turn was aborted; the other found it already gone. If
      // that was the rc, its line arrives on its own schedule and not
      // necessarily under the sentinel above — so this waits rather than
      // reading once, for the same reason as its sibling below.
      await until(
        async () => `${removed.stdout}${seen.out}`,
        (o) => o.includes("the running turn was aborted first"),
        "the aborted turn, reported by whichever of the verb and the rc reached the home first",
      );
      const rms = (await sheepCalls()).filter((c) => c.argv[0] === "rm");
      expect(rms.filter((c) => (c as { exit?: number }).exit === 0)).toHaveLength(1);
      expect((await sheepState()).sessions).toEqual([]);

      // A lap later: nothing failed, nothing was said in the thread in the
      // system voice, and nothing was sent to the cell again.
      await new Promise((r) => setTimeout(r, 3_000));
      expect(seen.out).not.toContain("turn FAILED");
      expect(seen.out).not.toContain("turn ended");
      expect(await commentsOn("th_1")).toHaveLength(1);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "attach")).toHaveLength(1);
      expect(seen.out.match(/Percy · summons/g)).toHaveLength(1);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("mid-turn at a station too old to end a sheep: aborted, and still read as a withdrawal though the turn exits cleanly", async () => {
      // As walked on sheep-2 on 11 Sep 2026: `sheep rm` is refused, the rc
      // falls back to `sheep abort`, and the attach it stopped exits 0 —
      // which read as "turn ended — end_turn" until the dispatch the
      // withdraw branch dropped was consulted too.
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, attachMs: 60_000, oldHome: true }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
      await post("/api/ops", {
        canvasId: "prj_1",
        actor: dimitri,
        op: {
          type: "thread.create",
          threadId: "th_1",
          x: 0,
          y: 0,
          anchorItemId: null,
          comment: { id: "cmt_1", body: "@Percy count slowly" },
        },
      });
      await until(async () => (await sheepState().catch(() => null))?.sessions?.[0]?.state, (s) => s === "busy", "the turn to be running in the cell");

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      // The verb's own half, which is its alone: `sheep rm` is refused here
      // whoever asks, and `sheep ls` still lists the sheep.
      expect(removed.stdout).toContain("this home cannot end a sheep (sheep rm: not found)");
      /**
       * **The abort belongs to whichever path reached the home first**, and
       * that is not decided here — `withdrawSheep` says so in as many words,
       * and the case above already reads its line across both outputs. This
       * one asserted on the verb alone, and failed once in twelve runs under
       * load on 12 Sep 2026 with the verb's output complete and correct: the
       * parked rc had aborted the turn, so the verb's `sheep abort` found
       * nothing running and rightly said nothing. Across both, with a
       * deadline, because the loser writes its line when it gets there.
       */
      await until(
        async () => `${removed.stdout}${seen.out}`,
        (o) => o.includes("its running turn was aborted"),
        "the aborted turn, reported by whichever of the verb and the rc reached the home first",
      );
      await until(async () => seen.out, (o) => o.includes("Percy · turn stopped — Percy was withdrawn"), "the turn to read as a withdrawal");
      await new Promise((r) => setTimeout(r, 3_000));
      expect(seen.out).not.toContain("Percy · turn ended");
      expect(seen.out).not.toContain("turn FAILED");
      expect(await commentsOn("th_1")).toHaveLength(1);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "attach")).toHaveLength(1);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("the web's withdraw, seen by a parked rc, ends the sheep — reading the row before reaping it", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep live at"), "the rc to come up");
      // Past its start: only the loop narrates an adoption, so after this
      // line the withdraw op below is one the rc reads as it lands.
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.enroll", agent: { id: "usr_sian", name: "Sian" } } });
      await until(async () => seen.out, (o) => o.includes("Sian · where and how supplied"), "the rc to be parked");
      // The tray's Dismiss: the withdraw op over HTTP, no verb on this machine.
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, withdrawalDone("Percy"), theWithdrawal);
      expect(seen.out).toContain("Dimitri dismissed Percy — no longer answering here");
      expect(seen.out).toContain("Percy · ending sheep s_1");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      // Never redeemed here, so there is no badge — and that is said.
      expect(seen.out).toMatch(/Percy · pass pss_\S+ was never redeemed, so Percy's cell holds no badge/);
      expect((await sheepCalls()).filter((c) => c.argv[0] === "rm")).toHaveLength(1);
      expect((await rcRows()).map((r) => r.name)).toEqual(["Sian"]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("a withdrawal landing while the rc starts is ended too", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      // As early as the rc says anything about Percy, which on a loaded
      // machine is between its opening roster and its start tip, where
      // neither the reconcile nor the withdraw branch used to see it. Which
      // side of the tip it lands on is timing; the source-shape test below
      // pins the reap that covers the window, and this one that either way
      // the sheep is ended once.
      await until(async () => seen.out, (o) => o.includes("Percy's sheep live at"), "the rc to say where");
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, withdrawalDone("Percy"), theWithdrawal);
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepCalls()).filter((c) => c.argv[0] === "rm")).toHaveLength(1);
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("a withdrawal made while no rc ran is ended at the next rc's start", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      expect((await sheepState()).sessions).toHaveLength(1);

      const { rc, seen, done } = parked();
      // The same sentinel as its siblings rather than the start line: this
      // reap happens to run before "answering on" today, so both work — but
      // only one of them keeps working if that order ever moves, and one
      // sentinel for one sequence is what the comment above is for.
      await until(async () => seen.out, withdrawalDone("Percy"), theWithdrawal);
      expect(seen.out).toContain("Percy was withdrawn while no rc ran here — ending what it left");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepState()).sessions).toEqual([]);
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("withdrawn while its sheep is being born: the summons ends the sheep it birthed, and runs no turn", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, newMs: 3_000 }));
      await run("rc", "add", "Percy", "--harness", "sheep", ...TEAM);
      const { actorId } = (await rcRows()).find((r) => r.name === "Percy")!;
      const { rc, seen, done } = parked();
      await until(async () => seen.out, (o) => o.includes("Percy's sheep will live at"), "the rc to come up");
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
      // `sheep new` has the pass and is under way: the row does not name a
      // sheep yet, so whoever reaps it has none to end.
      await until(async () => (await sheepState().catch(() => null))?.minting, (m) => m === true, "the birth to be under way");
      await post("/api/ops", { canvasId: "prj_1", actor: dimitri, op: { type: "agent.withdraw", actorId } });
      await until(async () => seen.out, withdrawalDone("Percy"), theWithdrawal);
      expect(seen.out).toContain("Percy · withdrawn before its turn — no turn runs");
      expect(seen.out).toContain("Percy · sheep s_1 ended");
      expect((await sheepState()).sessions).toEqual([]);
      expect((await sheepCalls()).some((c) => c.argv[0] === "attach")).toBe(false);
      expect(seen.out).not.toContain("turn FAILED");
      expect(await rcRows()).toEqual([]);
      rc.kill("SIGINT");
      await done;
    }, 60_000);

    it("one sheep behind two canvases stays until its last row is withdrawn, and the pass goes with it", async () => {
      await post("/api/ops", {
        canvasId: null,
        actor: dimitri,
        op: { type: "project.create", canvasId: "prj_2", title: "Q" },
      });
      await run("--canvas", "prj_1", "rc", "add", "Percy", "--harness", "sheep");
      await run("--canvas", "prj_2", "rc", "add", "Percy", "--harness", "sheep");
      expect((await run("--canvas", "prj_1", "rc", "turn", "Percy", "hello")).code).toBe(0);
      // The second canvas resumes the one sheep from the pasture's herd.
      expect((await run("--canvas", "prj_2", "rc", "turn", "Percy", "hello")).stderr).toContain("session s_1 resumed");
      const cell = await redeemCellPass();

      const first = await run("--canvas", "prj_1", "rc", "remove", "Percy");
      expect(first.stdout).toContain('Percy · sheep s_1 stays — Percy still answers from it on "Q"');
      expect((await sheepCalls()).some((c) => c.argv[0] === "rm")).toBe(false);
      const survivor = (await rcRows()).find((r) => r.canvasId === "prj_2")!;
      expect(survivor.cellPass?.canvasId).toBe("prj_1");

      const last = await run("--canvas", "prj_2", "rc", "remove", "Percy");
      expect(last.stdout).toContain("Percy · sheep s_1 ended");
      expect(last.stdout).toContain(`Percy · ended badge ${cell.badgeId}`);
      expect(await daemon.desk.badge(cell.badgeId)).toBeNull();
    }, 60_000);

    it("a home too old to end a sheep: the turn is aborted, and the rc says what remains", async () => {
      await fs.writeFile(stateFile, JSON.stringify({ sessions: [], pastures: {}, entries: {}, next: 1, oldHome: true }));
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      // Mid-turn, as far as the home is concerned.
      const state = await sheepState();
      state.sessions[0].state = "busy";
      await fs.writeFile(stateFile, JSON.stringify(state));

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("Percy · its running turn was aborted");
      expect(removed.stdout).toContain(
        "Percy · sheep s_1 is still at the local sheep home in " +
          `${await fs.realpath(home)}: this home cannot end a sheep (sheep rm: not found); \`sheep ls\` lists it`,
      );
      expect(removed.stdout).toContain("Percy · pasture isocan-percy stays — it is yours");
      const verbs = (await sheepCalls()).map((c) => c.argv[0]);
      expect(verbs.slice(verbs.indexOf("rm"))).toEqual(["rm", "ls", "abort", ...verbs.slice(verbs.indexOf("abort") + 1)]);
      expect((await sheepState()).sessions.map((s: { id: string; state: string }) => [s.id, s.state])).toEqual([["s_1", "idle"]]);
      expect(await rcRows()).toEqual([]);
    }, 40_000);

    it("a sheep already gone from its home is said as already ended, not as a failure", async () => {
      await run("rc", "add", "Percy", "--harness", "sheep");
      expect((await run("rc", "turn", "Percy", "hello")).code).toBe(0);
      // Another withdrawal got there first.
      const state = await sheepState();
      state.sessions = [];
      await fs.writeFile(stateFile, JSON.stringify(state));

      const removed = await run("rc", "remove", "Percy");
      expect(removed.code, removed.stderr).toBe(0);
      expect(removed.stdout).toContain("Percy · sheep s_1 was already ended — the local sheep home in");
      expect(removed.stdout).not.toContain("still at");
      expect((await sheepCalls()).some((c) => c.argv[0] === "abort")).toBe(false);
    }, 40_000);
  });
});
