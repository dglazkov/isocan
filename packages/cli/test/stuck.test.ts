import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";
import { mintTestBadge } from "./badge.ts";
import { parkedWait } from "./parked.ts";

/**
 * **`isocan stuck`, over the real CLI wire** (proactive-agent phase 7). The
 * detection is core's and unit-tested there (`packages/core/test/stuck.test.ts`);
 * this holds the terminal's halves on a synthetic Acme canvas: Maya asks for
 * a new header in the Chat, Kit answers each ask with a version, and Maya sets
 * each aside. Two misses are not stuck; the third, with a fourth ask, is — and
 * while nothing can answer, the reading says the question waits. Kit's
 * question is refused until it has four pairs and never says Maya is stuck;
 * once posted, it reads back with its guesses and writes no version. With Kit
 * parked, Maya's answer reaches Kit, and the count starts again.
 */
const maya = { id: "usr_st_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-stuck-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...maya, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocan(args: string[], as?: Record<string, string>): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...as }) });
}

async function json(args: string[], as?: Record<string, string>): Promise<any> {
  const run = await isocan([...args, "--json"], as);
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

let n = 0;
async function page(words: string): Promise<string> {
  const file = path.join(home, `header-${++n}.html`);
  await fs.writeFile(file, `<!doctype html><title>Header</title><header><img alt="Loaves on a counter"><h1>${words}</h1></header>`);
  return file;
}

const TILES = [
  "--tile", "density | Roomy, one idea per row | Dense, more at a glance | now",
  "--tile", "brand | Quiet, the photo speaks | Loud, the bakery's red | instead",
  "--tile", "layout | Photo on top | Photo beside the words | now",
  "--tile", "tone | Plain | Warm, a little playful | instead",
];

describe("isocan stuck", () => {
  let canvas: string;
  let header: string;
  let original: string;
  const kit = { ISOCAN_SESSION_ID: "stuck-kit" };
  const versions = async () => (await json(["--canvas", canvas, "show", header])).versions.length;

  /** One try: Maya asks in the Chat, Kit makes a take, Maya steps back to the original. */
  async function missedTry(ask: string): Promise<void> {
    expect((await isocan(["--canvas", canvas, "notify", ask, "--item", header])).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "edit", header, await page(`Fresh bread, take ${n}`)], kit)).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "version", "promote", header, original])).code).toBe(0);
  }

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    header = (await json(["--canvas", canvas, "add", await page("Fresh bread"), "--title", "Header", "--size", "390x200", "--at", "0,0"])).itemId;
    await json(["--canvas", canvas, "add", await page("Menu"), "--title", "Menu", "--size", "390x640", "--at", "470,0"]);
    original = (await json(["--canvas", canvas, "show", header])).currentVersionId;
    expect((await isocan(["identity", "--as", "usr_st_kit", "--name", "Kit"], kit)).code).toBe(0);
  });

  it("two misses are not stuck; three, and the fourth ask, are — and with nothing to answer the question waits", async () => {
    await missedTry("A new header for the menu, warmer, keep the photo");
    await missedTry("Again, but warmer");
    expect((await isocan(["--canvas", canvas, "notify", "again", "--item", header])).code).toBe(0);
    const two = await isocan(["--canvas", canvas, "stuck", "Header"]);
    expect(two.code, two.stderr).toBe(0);
    expect(two.stdout).toContain("Nobody is stuck on “Header”");
    expect((await isocan(["--canvas", canvas, "edit", header, await page("Fresh bread, take three")], kit)).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "version", "promote", header, original])).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "notify", "no", "--item", header])).code).toBe(0);

    const run = await isocan(["--canvas", canvas, "stuck", "Header"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Stuck on “Header” \(itm_[\w-]+ · cmt_[\w-]+\) · Maya's asks, 3 tries\n/);
    expect(run.stdout).toContain("Kit has been guessing at “Header”\n  Three tries in 1 minute, and none of them landed: three set aside.");
    expect(run.stdout).toContain("The asks got shorter: “A new header for the menu warmer keep the photo” → “Again but warmer” → “again” → “no”.");
    expect(run.stdout).toMatch(/The question\n {2}The question waits: no agent stands on this canvas/);
    // With no item: the same reading.
    expect((await isocan(["--canvas", canvas, "stuck"])).stdout).toMatch(/^Stuck on “Header”/);
    expect((await isocan(["--canvas", canvas, "stuck", "Menu"])).stdout).toContain("Nobody is stuck on “Menu”");
    const answer = await isocan(["--canvas", canvas, "stuck", "Header", "--extremes"]);
    expect(answer.code).not.toBe(0);
    expect(answer.stderr).toMatch(/nothing can take the answer here: .* The question waits\./);
  });

  it("the lead's question is refused until it has four pairs and owns the miss; posted, it reads back with its guesses and makes no version", async () => {
    const before = await versions();
    const three = await isocan(["--canvas", canvas, "stuck", "Header", "--question", "--observe", "You kept the photo every time.", ...TILES.slice(0, 6)], kit);
    expect(three.code).not.toBe(0);
    expect(three.stderr).toMatch(/the question has four pairs — Tone of voice is missing/);
    const blame = await isocan(["--canvas", canvas, "stuck", "Header", "--question", "--observe", "You're stuck on the header.", ...TILES], kit);
    expect(blame.stderr).toMatch(/never say the person is stuck/);
    const menu = await isocan(["--canvas", canvas, "stuck", "Menu", "--question", "--observe", "You kept the photo.", ...TILES], kit);
    expect(menu.stderr).toMatch(/nobody is stuck on “Menu”/);
    const asked = await json(["--canvas", canvas, "stuck", "Header", "--question", "--observe", "You kept the photo every time.", "--observe", "You set aside every warmer colour.", ...TILES], kit);
    expect(asked.commentId).toMatch(/^cmt_/);
    const again = await isocan(["--canvas", canvas, "stuck", "Header", "--question", "--observe", "You kept the photo every time.", ...TILES], kit);
    expect(again.stderr).toMatch(/already in the Chat/);

    const shown = await isocan(["--canvas", canvas, "stuck", "Header"]);
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("I've been guessing at “Header”");
    expect(shown.stdout).toContain("What I noticed — say if I'm wrong\n  You kept the photo every time.\n  You set aside every warmer colour.");
    expect(shown.stdout).toContain("Now, or instead?\n  Density — now: Roomy, one idea per row · instead: Dense, more at a glance  ← my guess: now");
    expect(shown.stdout).toContain("Brand expression — now: Quiet, the photo speaks · instead: Loud, the bakery's red  ← my guess: instead");
    expect(shown.stdout).toContain("Or\n  Show me extremes\n  Name a product that gets it right");
    const read = await json(["--canvas", canvas, "stuck", "Header"]);
    expect(read.question.tiles.map((t: { guess: string }) => t.guess)).toEqual(["now", "instead", "now", "instead"]);
    // A question, not a take.
    expect(await versions()).toBe(before);
  });

  it("with Kit parked, Maya's answer reaches Kit, and the count starts again", async () => {
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_st_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_st_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    const parked = await parkedWait({ base, headers: badge.headers, canvas, actorId: "usr_st_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });

    const bad = await isocan(["--canvas", canvas, "stuck", "Header", "--answer", "colour=instead"]);
    expect(bad.stderr).toMatch(/an answer is <axis>=now\|instead/);
    const told = await json(["--canvas", canvas, "stuck", "Header", "--answer", "density=instead", "--answer", "tone=now"]);
    expect(told.lead.name).toBe("Kit");
    const woke = await parked.run;
    expect(woke.stdout).toMatch(/Stuck answer \(itm_[\w-]+ · cmt_[\w-]+\): Density: instead \(Dense, more at a glance\); Tone of voice: now \(Plain\)\. Make one take from these\./);
    expect((await isocan(["--canvas", canvas, "stuck", "Header"])).stdout).toContain("Nobody is stuck on “Header”");
  }, 90_000);
});
