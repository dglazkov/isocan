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
 * **`isocan explain`, over the real CLI wire** (proactive-agent phase 4).
 * The story is core's and unit-tested there (`packages/core/test/
 * explain.test.ts`); this holds the terminal's halves on a synthetic Acme
 * canvas: the story at each depth, reading writes nothing, a critique asked
 * with nobody to answer is refused with why, with Kit parked the ask reaches
 * Kit, Kit's critique and its proposal citing `explain:` land and are read
 * back, and Copy as rationale is a note beside the item.
 */
const maya = { id: "usr_ex_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-explain-"));
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

async function page(name: string, words: string): Promise<string> {
  const file = path.join(home, `${name}.html`);
  await fs.writeFile(file, `<!doctype html><title>${name}</title><h1>${words}</h1>`);
  return file;
}

describe("isocan explain", () => {
  let canvas: string;
  let checkout: string;
  let b: string;
  let kit: Record<string, string>;

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    checkout = (await json(["--canvas", canvas, "add", await page("checkout", "Checkout v1"), "--title", "Checkout", "--size", "390x640"])).itemId;
    for (const k of [2, 3]) expect((await isocan(["--canvas", canvas, "edit", checkout, await page(`checkout-${k}`, `Checkout v${k}`)])).code).toBe(0);
    const takes: Record<string, string> = {};
    for (const [name, words] of [["Checkout A", "A: one long page"], ["Checkout B", "B: shorter form, pickup slot first"]] as const) {
      takes[name] = (await json(["--canvas", canvas, "add", await page(name.replace(/\s/g, "-"), name), "--title", name, "--prop", `parent=${checkout}`])).itemId;
      expect((await isocan(["--canvas", canvas, "comment", "add", `${words} #${takes[name]}`, "--item", takes[name]!])).code).toBe(0);
    }
    b = takes["Checkout B"]!;
    expect((await isocan(["--canvas", canvas, "choose", b])).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "comment", "add", "make it more obvious where the total is", "--item", checkout])).code).toBe(0);
  });

  it("prints the story: the moves with their reasons, the road not taken, speak design", async () => {
    const run = await isocan(["--canvas", canvas, "explain", checkout]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Explain “Checkout” \(itm_[\w-]+\)/);
    expect(run.stdout).toContain("v1–v3 · Maya drafted it over 3 versions — no reason recorded");
    expect(run.stdout).toContain("v4 · Maya chose “Checkout B” over 1 other take — “B: shorter form, pickup slot first");
    expect(run.stdout).toContain("“Checkout A”, a variation by Maya, in the trash — A: one long page");
    expect(run.stdout).toContain("“make it more obvious” → visual hierarchy");
    const story = await json(["--canvas", canvas, "explain", checkout]);
    expect(story.story.moves.map((m: { kind: string }) => m.kind)).toEqual(["made", "chose"]);
    expect(story.sections.map((s: { key: string }) => s.key)).toEqual(["how", "roads", "moved", "speak"]);
  });

  it("writes nothing to read it", async () => {
    const before = JSON.stringify([await json(["--canvas", canvas, "ls"]), await json(["--canvas", canvas, "comment", "ls"])]);
    expect((await isocan(["--canvas", canvas, "explain", checkout])).code).toBe(0);
    expect(JSON.stringify([await json(["--canvas", canvas, "ls"]), await json(["--canvas", canvas, "comment", "ls"])])).toBe(before);
  });

  it("refuses a critique when nothing can answer, and says why", async () => {
    const run = await isocan(["--canvas", canvas, "explain", checkout, "--ask"]);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toMatch(/nothing can critique here: no agent stands on this canvas — enrol one/);
  });

  it("asks the lead; the lead's critique and its proposal citing explain: are read back", async () => {
    kit = { ISOCAN_SESSION_ID: "explain-kit" };
    expect((await isocan(["identity", "--as", "usr_ex_kit", "--name", "Kit"], kit)).code).toBe(0);
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_ex_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_ex_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    // Parked means the daemon shows it waiting, and its output is gathered
    // from the start: a woken park can exit before the command that woke it.
    const parked = await parkedWait({ base, headers: badge.headers, canvas, actorId: "usr_ex_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });
    const asked = await json(["--canvas", canvas, "explain", checkout, "--ask"]);
    expect(asked.lead.name).toBe("Kit");
    const woke = await parked.run;
    expect(woke.stdout).toContain("Critique, please: “Checkout”");
    expect((await json(["--canvas", canvas, "explain", checkout])).story.asked).toBe(true);

    const half = await isocan(["--canvas", canvas, "explain", checkout, "--critique", "--working", "The pickup slot leads."], kit);
    expect(half.code).not.toBe(0);
    expect(half.stderr).toMatch(/--risk, --try are missing/);

    const answered = await json([
      "--canvas", canvas, "explain", checkout, "--critique",
      "--working", "The pickup slot leads.",
      "--risk", "The total sits below the fold on small phones.",
      "--try", "Proximity: pin the total beside the button.",
      "--speak", "make it pop => raise its contrast",
      "--propose", await page("try", "Total beside the button"),
    ], kit);
    expect(answered.proposal).toMatch(/^itm_/);
    const shown = await json(["--canvas", canvas, "show", answered.proposal]);
    expect(JSON.parse(shown.properties.proposalCites)).toEqual([{ kind: "explain", ref: answered.commentId }]);
    expect(shown.properties.proposalWhy).toBe("Proximity: pin the total beside the button.");

    const story = (await json(["--canvas", canvas, "explain", checkout])).story;
    expect(story.asked).toBe(false);
    expect(story.critique).toMatchObject({ by: { name: "Kit" }, working: "The pickup slot leads.", proposal: { itemId: answered.proposal } });
    expect(story.speak[0]).toMatchObject({ said: "make it pop", designer: "raise its contrast", from: "lead" });
    const printed = await isocan(["--canvas", canvas, "explain", checkout]);
    expect(printed.stdout).toContain("Kit's critique\n  - Working: The pickup slot leads.");
  });

  it("Copy as rationale: a note beside the item, nothing else", async () => {
    const made = await json(["--canvas", canvas, "explain", checkout, "--rationale"]);
    expect(made.text.split("\n")[0]).toBe("# Why “Checkout” looks like this");
    const note = await json(["--canvas", canvas, "show", made.itemId]);
    const item = await json(["--canvas", canvas, "show", checkout]);
    expect(note.title).toBe("Why “Checkout” looks like this");
    expect(note.properties.parent).toBeUndefined();
    expect(note.x).toBeGreaterThanOrEqual(item.x + item.width);
  });
});
