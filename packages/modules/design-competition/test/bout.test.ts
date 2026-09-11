import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync, promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **A bout, played end to end over the wire** — the journey's Scenes 0–7 from
 * the terminal, against a real daemon: the arena laid, the fighters cast from
 * their pack's template, each building and handing in under the identity the
 * rc would give it, the bell, a ranked ballot from a person and from the
 * fighters, the Decider's call, the winner taken onto the screen it was
 * about, standings, a fighter brought by somebody else — and every refusal
 * the design promises, said. One person plays every human chair.
 */

const cliBin = fileURLToPath(new URL("../../../cli/bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-bout-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...priya, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

/** The CLI as a person — or, with `as`, as the agent the rc would summon. */
function isocan(args: string[], as?: { name: string; canvas: string }): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const agent = as ? { ISOCAN_HARNESS: "agent", ISOCAN_SESSION_ID: as.name, ISOCAN_CANVAS: as.canvas } : {};
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port, ...agent },
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

async function ok(args: string[], as?: { name: string; canvas: string }): Promise<Run> {
  const run = await isocan(args, as);
  expect(run.code, `${args.join(" ")}\n${run.stderr}`).toBe(0);
  return run;
}

async function json(args: string[], as?: { name: string; canvas: string }): Promise<any> {
  return JSON.parse((await ok([...args, "--json"], as)).stdout);
}

async function refused(args: string[], pattern: RegExp, as?: { name: string; canvas: string }): Promise<void> {
  const run = await isocan(args, as);
  expect(run.code, `${args.join(" ")} should have been refused`).not.toBe(0);
  expect(run.stderr).toMatch(pattern);
}

describe("a design competition, from the terminal", () => {
  it("plays from the line-up to standings, and says every refusal", async () => {
    const room = await json(["canvas", "create", "Acme Plants"]);
    const C = room.canvasId as string;
    const screen = path.join(home, "checkout.html");
    await fs.writeFile(screen, "<!doctype html><title>Checkout</title><h1>Checkout</h1>");
    await ok(["add", screen, "--title", "Checkout", "--canvas", C]);

    // Scene 0 — the line-up.
    const roster = await json(["competition", "fighters", "--canvas", C]);
    expect(roster.map((f: { id: string }) => f.id)).toEqual(["ive", "frog", "ideo", "kare", "rams", "victor", "duarte", "linear", "tufte"]);
    await refused(["competition", "new", "a checkout", "--fighters", "kare,rams", "--mode", "blind", "--canvas", C], /desks/);
    await refused(["competition", "new", "a checkout", "--fighters", "kare", "--canvas", C], /two to four/);

    // Scene 1 — the arena.
    const laid = await json(["competition", "new", "a checkout for a plant shop that doesn't feel like a form", "--fighters", "kare,rams,linear", "--attach", "Checkout", "--canvas", C]);
    const bout = laid.bout as string;
    expect(laid.lanes).toHaveLength(3);
    const tokens = (await ok(["design", "--css", "--in", "Road Signs", "--canvas", C])).stdout;
    expect(tokens).toMatch(/--/);
    // Three lanes, three systems — and the canvas's own is still nobody's.
    await refused(["design", "--css", "--canvas", C], /no design system/);

    // Scene 2 — the fighters walk in, each from its pack's template.
    const cast = await json(["competition", "start", "--canvas", C]);
    expect(Object.keys(cast.fighters)).toEqual(["kare", "rams", "linear"]);
    const dir = path.join(home, "templates", "design-competition.fighter", C, "road-signs");
    expect(await fs.readFile(path.join(dir, "AGENTS.md"), "utf8")).toMatch(/You are Road Signs[\s\S]*not the person/);
    expect(existsSync(path.join(dir, "DESIGN.md"))).toBe(true);
    const status = await json(["competition", "status", "--canvas", C]);
    expect(status.phase).toBe("building");

    // Each fighter builds in its own lane and hands in, as itself.
    const entries: Record<string, string> = {};
    for (const [lane, name] of [["Road Signs", "kare"], ["Less but Better", "rams"], ["Fast Is a Feature", "linear"]] as const) {
      const me = { name: lane, canvas: C };
      const file = path.join(home, `${name}.html`);
      await fs.writeFile(file, `<!doctype html><title>${lane}</title><button>Send it home</button>`);
      const added = await json(["add", file, "--in", lane, "--title", `${lane} checkout`], me);
      entries[name] = added.itemId ?? added.items?.[0]?.itemId;
      expect(entries[name], JSON.stringify(added)).toBeTruthy();
      await ok(["competition", "handin", entries[name]!], me);
    }
    // A person cannot hand in a fighter's work for it.
    await refused(["competition", "handin", entries.kare!, "--canvas", C], /hands in its own work/);

    // Scene 3/4 — the bell, and the vote.
    await ok(["competition", "bell", "--vote", "1m", "--canvas", C]);
    await ok(["competition", "vote", entries.kare!, "--rank", "1", "--canvas", C]);
    await ok(["competition", "vote", entries.linear!, "--rank", "2", "--canvas", C]);
    await ok(["competition", "vote", entries.rams!, "--rank", "3", "--canvas", C]);
    // Placing a medal MOVES it: 🥇 to Linear, off Kare.
    await ok(["competition", "vote", entries.linear!, "--rank", "1", "--canvas", C]);
    await ok(["competition", "vote", entries.kare!, "--rank", "2", "--canvas", C]);
    await ok(["competition", "dot", entries.kare!, "--at", "0.4,0.7", "--canvas", C]);
    await ok(["competition", "miss", entries.rams!, "--canvas", C]);
    // A fighter ranks the others, never itself.
    await refused(["competition", "vote", entries.kare!, "--rank", "1"], /never ranks its own/, { name: "Road Signs", canvas: C });
    await ok(["competition", "vote", entries.rams!, "--rank", "1"], { name: "Road Signs", canvas: C });
    // Only the Decider decides — and never an agent.
    await refused(["competition", "decide", entries.rams!], /Decider|never decides/, { name: "Road Signs", canvas: C });

    const result = await json(["competition", "result", "--canvas", C]);
    const score = (id: string) => result.entries.find((e: { itemId: string }) => e.itemId === id);
    expect(score(entries.linear!).people).toBe(3);
    expect(score(entries.kare!).people).toBe(2);
    expect(score(entries.rams!).people).toBe(1);
    expect(score(entries.rams!).agents).toBe(2);
    expect(score(entries.kare!).dots).toBe(1);
    expect(result.decided).toBeNull();

    // Scene 5 — the Decider's call, and the winner taken onto #Checkout.
    await ok(["competition", "decide", entries.kare!, "--canvas", C]);
    expect((await json(["competition", "result", "--canvas", C])).decided).toBe(entries.kare);
    await ok(["competition", "take", "--canvas", C]);
    // #Checkout's next version IS the winning entry's bytes — a copy, so the
    // entry is still in its lane, the arena still the record.
    const versions = await json(["versions", "Checkout", "--canvas", C]);
    expect(versions).toHaveLength(2);
    expect(versions[1].filename).toBe("kare.html");

    // Scene 7 — standings, derived; and the fighters leave.
    const rows = await json(["competition", "standings", "--canvas", C]);
    expect(rows.find((r: { packId: string }) => r.packId === "kare").wins).toBe(1);
    const gone = await json(["competition", "withdraw", "--canvas", C]);
    expect(gone.withdrawn).toHaveLength(3);

    // Scene 6 — bring your own fighter: a data-only module that runs nothing.
    const design = path.join(home, "JUN.md");
    await fs.writeFile(design, "---\nversion: alpha\nname: Jun's house style\ncolors:\n  primary: \"#111111\"\n---\n\n## Overview\n\nQuiet.\n");
    await ok(["competition", "fighter", "new", "Quiet Confidence", "--design", design, "--credit", "after Jun", "--name", "Jun", "--self", "--ref", "Pricing|https://example.com/pricing|one decision per screen", "--out", home]);
    const add = await ok(["module", "add", path.join(home, "fighter-quiet-confidence"), "--yes", "--proposed"]);
    expect(add.stderr).toMatch(/installed/);
    const more = await json(["competition", "fighters", "--canvas", C]);
    expect(more.map((f: { id: string }) => f.id)).toContain("quiet-confidence");
    expect(more.find((f: { id: string }) => f.id === "quiet-confidence").from).toBe("fighter-quiet-confidence");
  }, 120_000);
});
