import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, collect, runCli, spawnCli, type Run } from "./cli.ts";
import { mintTestBadge } from "./badge.ts";

/**
 * **`isocan goodnight`, over the real CLI wire** (proactive-agent phase 2).
 * The rules are core's and unit-tested there (`packages/core/test/
 * goodnight.test.ts`); this holds the terminal's two halves together on a
 * synthetic Acme canvas: with nothing to answer, the person's goodnight
 * writes a note that promises nothing and says why; with Kit parked, it
 * reaches Kit, the note is refused until Maya says that's the plan, the
 * promised frames hang beneath their items, an untick takes a frame, an
 * original Maya did not name is never edited, and the brief waits on every
 * promise.
 */
const maya = { id: "usr_gn_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-goodnight-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...maya, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});

afterAll(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Maya, unless `as` names a session the CLI speaks for instead. */
function isocan(args: string[], as?: Record<string, string>): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...as }) });
}

async function json(args: string[], as?: Record<string, string>): Promise<any> {
  const run = await isocan([...args, "--json"], as);
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

type Screens = Record<"Basket" | "Checkout" | "Order history", string>;

async function screens(canvas: string): Promise<Screens> {
  const ids = {} as Screens;
  for (const title of ["Basket", "Checkout", "Order history"] as const) {
    const file = path.join(home, `${title.replace(/\s/g, "-").toLowerCase()}.html`);
    await fs.writeFile(file, `<!doctype html><title>${title}</title><h1>${title}</h1>`);
    ids[title] = (await json(["--canvas", canvas, "add", file, "--size", "390x640", "--title", title])).itemId;
  }
  return ids;
}

describe("/goodnight, the command an agent is woken by", () => {
  it("is a built-in whose body says to wait for that's the plan", async () => {
    const run = await isocan(["command", "show", "goodnight"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toContain("isocan goodnight read --json");
    expect(run.stdout).toContain("only when they say \"That's the plan\"");
  });
});

describe("isocan goodnight, with nothing to answer", () => {
  it("still writes the note — it says why and promises nothing", async () => {
    const canvas = (await json(["canvas", "create", "Acme Bakery quiet"])).canvasId;
    await screens(canvas);
    const run = await isocan(["--canvas", canvas, "goodnight", "start", "long day"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/Nothing can answer overnight: no agent stands on this canvas/);
    const note = await json(["--canvas", canvas, "goodnight", "show"]);
    expect(note.lines).toEqual([]);
    expect(note.nothing).toMatch(/Nothing is promised\./);
    const shown = await isocan(["--canvas", canvas, "goodnight", "show"]);
    expect(shown.stdout).toMatch(/## Tonight I will\nNothing can answer overnight/);
    // No promised frame anywhere.
    const items = await json(["--canvas", canvas, "ls"]);
    const all = (Array.isArray(items) ? items : items.items) as { id: string }[];
    for (const one of all) expect((await json(["--canvas", canvas, "show", one.id])).properties.proposal).toBeUndefined();
  });
});

describe("isocan goodnight, with Kit parked", () => {
  let canvas: string;
  let ids: Screens;
  let kit: Record<string, string>;

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    ids = await screens(canvas);
    // Kit is a session of its own, then enrolled the web dialog's way — an
    // `agent.enroll` posted by a member — so the CLI may speak as Kit.
    kit = { ISOCAN_SESSION_ID: "goodnight-kit" };
    const who = await isocan(["identity", "--as", "usr_gn_kit", "--name", "Kit"], kit);
    expect(who.code, who.stderr).toBe(0);
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_gn_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_gn_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
  });

  it("enrolled but nothing answering: says so, and promises nothing", async () => {
    const run = await isocan(["--canvas", canvas, "goodnight"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/nothing is answering for Kit here/);
    // The honest note is Maya's own record; trash it so the night below starts clean.
    const note = await json(["--canvas", canvas, "goodnight", "show"]);
    expect(note.lines).toEqual([]);
    expect((await isocan(["--canvas", canvas, "rm", note.itemId])).code).toBe(0);
  });

  it("reaches Kit, waits for that's the plan, and holds every promise rule", async () => {
    // Kit appears and parks — the stub agent's lap — so something can answer.
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    const parked = spawnCli(["--canvas", canvas, "wait", "--json", "--timeout", "30"], { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) });
    await new Promise((r) => setTimeout(r, 1500));
    const asked = await json(["--canvas", canvas, "goodnight", "start", "the basket bugs me"]);
    expect(asked.answerable, JSON.stringify(asked)).toBe(true);
    expect(asked.lead.name).toBe("Kit");
    const woke = await collect(parked);
    expect(woke.stdout).toContain("/goodnight @Kit the basket bugs me");

    // Kit reads the night, and may not write the note yet.
    const read = await json(["--canvas", canvas, "goodnight", "read"], kit);
    expect(read).toMatchObject({ person: { name: "Maya" }, youLead: true, answerable: true, room: 5, conversation: { planned: false } });
    const early = await isocan(["--canvas", canvas, "goodnight", "note", "--promise", "Basket | three takes"], kit);
    expect(early.code).not.toBe(0);
    expect(early.stderr).toMatch(/has not said "That's the plan" yet/);

    // Maya steers, naming Checkout for a rework, and ends it.
    await json(["--canvas", canvas, "comment", "reply", asked.threadId, "rework the checkout screen too"]);
    expect((await isocan(["--canvas", canvas, "goodnight", "plan"])).code).toBe(0);

    // An original she did not name is never edited.
    const unnamed = await isocan(["--canvas", canvas, "goodnight", "note", "--edit", "Order history | regroup by week"], kit);
    expect(unnamed.code).not.toBe(0);
    expect(unnamed.stderr).toMatch(/Maya did not name “Order history”/);

    const note = await json(["--canvas", canvas, "goodnight", "note",
      "--promise", "Basket | three takes on the empty basket, one a sketch | three takes",
      "--promise", "Order history | check the red against contrast",
      "--edit", "Checkout | pickup first | one new version",
      // Ready now, so a later visit is newer than ready-by (the morning review's rule).
      "--ready", new Date().toISOString(),
    ], kit);
    const [basket, contrast, rework] = note.lines;
    expect(basket).toMatchObject({ on: ids.Basket, edit: false, ticked: true, budget: "three takes" });
    expect(rework).toMatchObject({ on: ids.Checkout, edit: true });
    expect(rework.frame).toBeUndefined();
    const frame = await json(["--canvas", canvas, "show", basket.frame]);
    expect(frame.properties).toMatchObject({ proposal: "promised", parent: ids.Basket });
    const source = await json(["--canvas", canvas, "show", ids.Basket]);
    expect(frame.y).toBeGreaterThan(source.y + source.height);

    // Maya unticks the contrast check: its frame goes, the line stays an offer.
    expect((await isocan(["--canvas", canvas, "goodnight", "untick", "2"])).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "show", contrast.frame as string])).code).not.toBe(0);
    const shown = await isocan(["--canvas", canvas, "goodnight", "show"]);
    expect(shown.stdout).toContain("- [ ] check the red against contrast");

    // The night: the frame filled as a hunch; the brief waits for the rework.
    const take = path.join(home, "basket-take.html");
    await fs.writeFile(take, "<!doctype html><h1>Your basket is empty</h1><p>Today's loaf: sourdough</p>");
    expect((await isocan(["--canvas", canvas, "goodnight", "fill", basket.frame, take, "--hunch", "--why", "Empty states teach: show the first step."], kit)).code).toBe(0);
    expect((await json(["--canvas", canvas, "show", basket.frame])).properties).toMatchObject({ proposal: "hunch", proposalWhy: "Empty states teach: show the first step." });
    const notYet = await isocan(["--canvas", canvas, "goodnight", "done", "all done"], kit);
    expect(notYet.code).not.toBe(0);
    expect(notYet.stderr).toMatch(/line 3 .* is still promised/);
    // Basket itself was not named for editing: refused.
    const over = await isocan(["--canvas", canvas, "goodnight", "fill", ids.Basket, take], kit);
    expect(over.code).not.toBe(0);
    expect(over.stderr).toMatch(/the night never edits anything else/);
    const before = (await json(["--canvas", canvas, "show", ids.Checkout])).versions.length;
    expect((await isocan(["--canvas", canvas, "goodnight", "fill", ids.Checkout, take], kit)).code).toBe(0);
    expect((await json(["--canvas", canvas, "show", ids.Checkout])).versions.length).toBe(before + 1);

    const brief = await json(["--canvas", canvas, "goodnight", "done", "One hunch on the basket; Checkout reworked, pickup first.", "--left", "Ravi's note about delivery | a business decision, not a design one"], kit);
    expect(brief.noteId).toBe(note.noteId);
    const threads = await json(["--canvas", canvas, "comment", "ls"]);
    const main = (Array.isArray(threads) ? threads : threads.threads).find((x: any) => x.main);
    const last = main.comments.at(-1);
    expect(last).toMatchObject({ record: true, goodnight: { step: "brief", note: note.noteId } });

    // The morning (phase 3): Maya's review, the same brief the web leads with.
    const review = await json(["--canvas", canvas, "goodnight", "review"]);
    expect(review).toMatchObject({ due: true, headline: null, brief: { body: "One hunch on the basket; Checkout reworked, pickup first." } });
    expect(review.proposals.map((p: any) => [p.itemId, p.state])).toEqual([[basket.frame, "hunch"]]);
    expect(review.left).toEqual([
      { what: "Ravi's note about delivery", why: "a business decision, not a design one" },
      { what: "check the red against contrast", why: "you unticked it, so it was an offer, not a promise" },
    ]);
    expect(review.edited).toMatchObject([{ itemId: ids.Checkout, title: "Checkout" }]);
    const printed = await isocan(["--canvas", canvas, "goodnight", "review"]);
    expect(printed.stdout).toMatch(/^Kit's brief for Maya\nOne hunch on the basket/);
    expect(printed.stdout).toMatch(/Left alone:\n {2}- Ravi's note about delivery — a business decision/);
    // A visit after ready-by: no review is due any more.
    expect((await isocan(["--canvas", canvas, "seen", "--mark"])).code).toBe(0);
    expect(await json(["--canvas", canvas, "goodnight", "review"])).toMatchObject({ due: false, notDue: "you have been back since its ready-by" });
  }, 120_000);
});
