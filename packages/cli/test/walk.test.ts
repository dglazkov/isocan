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
 * **`isocan walk`, over the real CLI wire** (proactive-agent phase 9). The
 * measuring is core's and unit-tested there (`packages/core/test/walk.test.ts`);
 * this holds the terminal's halves on a synthetic Acme canvas: three phone
 * screens in a group, Checkout with a faint "Edit" and a small "Help" in the
 * bottom-left corner. The lanes print measured, with the simulation notice,
 * and write nothing; asked with nothing to answer, the walk waits. With Kit
 * parked as the lead, the ask reaches Kit; Kit's answer is refused until it
 * is grounded, then lands as two pins worn as the walkers, a record, and one
 * fix proposal citing the walk — and Checkout itself is unchanged.
 */
const maya = { id: "usr_wk_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-walk-"));
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

const PAGES: Record<string, string> = {
  "Pick a loaf": `<!doctype html><title>Pick a loaf</title><style>body{margin:0;color:#1d1b18;font:16px system-ui}.go{position:fixed;left:16px;right:16px;bottom:16px;height:56px;background:#8a3a20;color:#fff}</style><body><h1>Pick a loaf</h1><a href="#rye">Rye</a><button class="go">Continue</button></body>`,
  "Choose a day": `<!doctype html><title>Choose a day</title><style>body{margin:0;color:#222;font:16px system-ui}.go{position:fixed;left:16px;right:16px;bottom:16px;height:56px;background:#8a3a20;color:#fff}</style><body><h1>Choose a day</h1><label for="d">Pickup day</label><select id="d"><option>Saturday</option></select><button class="go">Continue</button></body>`,
  Checkout: `<!doctype html><title>Checkout</title><style>body{margin:0;color:#222;font:16px system-ui}.edit{color:#aaaaaa;background:#fff;border:0}.help{position:fixed;left:8px;bottom:8px;width:28px;height:28px}.pay{position:fixed;left:16px;right:16px;bottom:56px;height:56px;background:#8a3a20;color:#fff}</style><body><h1>Checkout</h1><p>Sourdough, Saturday 9:00 <button class="edit">Edit</button></p><button class="pay">Pay £4.20</button><a class="help" href="#help" aria-label="Help">?</a></body>`,
};

describe("isocan walk", () => {
  let canvas: string;
  const ids: Record<string, string> = {};
  const kit = { ISOCAN_SESSION_ID: "walk-kit" };

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    expect((await isocan(["--canvas", canvas, "canvas", "group", "new", "Order a loaf"])).code).toBe(0);
    let x = 0;
    for (const [title, html] of Object.entries(PAGES)) {
      const file = path.join(home, `${title.replace(/\W+/g, "-")}.html`);
      await fs.writeFile(file, html);
      ids[title] = (await json(["--canvas", canvas, "add", file, "--title", title, "--size", "390x844", "--in", "Order a loaf", "--at", `${x},0`])).itemId;
      x += 470;
    }
    expect((await isocan(["identity", "--as", "usr_wk_kit", "--name", "Kit"], kit)).code).toBe(0);
  });

  it("measures the lanes over a group, says they are simulations, and writes nothing; with a task and nothing to answer, the walk waits", async () => {
    const run = await isocan(["--canvas", canvas, "walk", "Order a loaf"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Walk · 3 screens, a group's screens in reading order: Pick a loaf → Choose a day → Checkout\nThese are simulations, not people/);
    expect(run.stdout).toContain("One-handed on a phone — holding the phone in one hand, on the move;");
    expect(run.stdout).toContain("  3. Checkout\n     3.1 “Help” is 28×28 px in the stretch zone, bottom left — a thumb needs 44×44 there");
    expect(run.stdout).toMatch(/Low vision — [^\n]*\n {2}1\. Pick a loaf — nothing measured in the way/);
    expect(run.stdout).toMatch(/3\.1 “Edit” is #aaaaaa on #ffffff, 2\.32:1 — text this size needs 4\.5:1; through low vision it is about 1\.\d+:1\. The fix, at the 7:1 they read at: #[0-9a-f]{6}/);
    expect(run.stdout).toContain("Measured only — nobody was asked.");
    const lanes = await json(["--canvas", canvas, "walk", ids.Checkout!, "--as", "screen-reader,first-time"]);
    expect(lanes.via).toBe("screen");
    expect(lanes.walkers.map((w: { id: string }) => w.id)).toEqual(["screen-reader", "first-time"]);
    expect(lanes.lanes[1].screens[0].notes).toEqual(["judged by the lead: this walker meets meaning, which the code cannot measure"]);
    expect(lanes.notice).toMatch(/do not replace testing with the people they stand for/);
    expect(lanes.parameters.lowVision.blurPx).toBe(1.2);

    const waits = await isocan(["--canvas", canvas, "walk", "Order a loaf", "--task", "order a loaf for Saturday"]);
    expect(waits.code, waits.stderr).toBe(0);
    expect(waits.stdout).toMatch(/^Walk “order a loaf for Saturday” · 3 screens/);
    expect(waits.stdout).toMatch(/The walk waits: [^\n]+\. Nothing was asked; the lanes above are measured, and nobody has walked them\./);
    const bad = await isocan(["--canvas", canvas, "walk", "Order a loaf", "--as", "grandma: old and slow with phones"]);
    expect(bad.stderr).toMatch(/a walker is a situation and a constraint, not who someone is/);
    const shown = await isocan(["--canvas", canvas, "walk"]);
    expect(shown.stdout).toContain("No walk has been asked here yet");
    // A walk is not part of the desk check; the check offers it as its last line.
    const desk = await isocan(["--canvas", canvas, "share", "--check"]);
    expect(desk.code, desk.stderr).toBe(0);
    expect(desk.stdout).toContain("· Not part of this check: a walk — `isocan walk <flow> --task \"…\"` — walks it as someone else (simulations, never a gate).");
  });

  it("with Kit parked, the ask reaches Kit; the answer is refused until grounded, then lands as pins, a record and one fix — Checkout unchanged", async () => {
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_wk_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_wk_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    const parked = await parkedWait({ base, headers: badge.headers, canvas, actorId: "usr_wk_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });

    const asked = await isocan(["--canvas", canvas, "walk", "Order a loaf", "--task", "order a loaf for Saturday", "--as", "one-handed", "--as", "low-vision"]);
    expect(asked.code, asked.stderr).toBe(0);
    expect(asked.stdout).toMatch(/Asked Kit to walk it \((cmt_[\w-]+)\)/);
    const walkId = /Asked Kit to walk it \((cmt_[\w-]+)\)/.exec(asked.stdout)![1]!;
    const woke = await parked.run;
    expect(woke.stdout).toContain("Walk it as someone else, please (");
    expect(woke.stdout).toContain("These are simulations, not people");

    const checkoutBefore = await json(["--canvas", canvas, "show", ids.Checkout!]);
    const fix = path.join(home, "fix.html");
    await fs.writeFile(fix, PAGES.Checkout!.replace("#aaaaaa", "#595959").replace("width:28px;height:28px", "width:48px;height:48px"));
    const ends = ["--outcome", "one-handed | stumbled | Reached Pay, not Help.", "--outcome", "low-vision | stumbled | Could not find Edit."];
    const pins = ["--stumble", "one-handed | Checkout | 3.1 | Could not reach Help in the corner.", "--stumble", "low-vision | Checkout | 3.1 | Could not see Edit beside the time."];
    const notMeasured = await isocan(["--canvas", canvas, "walk", "--stumble", "one-handed | Pick a loaf | 1.1 | Missed.", ...ends], kit);
    expect(notMeasured.stderr).toMatch(/one-handed has no measured 1\.1 on that screen \(nothing was measured there\) — cite one, or say judged/);
    const noShared = await isocan(["--canvas", canvas, "walk", ...pins, ...ends], kit);
    expect(noShared.stderr).toMatch(/all stumbled on one screen .* name the shared problem with --shared/);
    const answered = await json(["--canvas", canvas, "walk", walkId, ...pins, ...ends, "--shared", "Checkout | The secondary actions are faint and out of the thumb's reach.", "--fix", fix, "--why", "Contrast and target size: Edit darkens to 7:1 and Help grows to 48 px."], kit);
    expect(answered.pins).toHaveLength(2);
    expect(answered.shared).toEqual([{ itemId: ids.Checkout, walkers: ["one-handed", "low-vision"] }]);
    const again = await isocan(["--canvas", canvas, "walk", walkId, ...pins, ...ends], kit);
    expect(again.stderr).toMatch(/already answered/);

    const read = await json(["--canvas", canvas, "walk"]);
    expect(read.walk).toBe(walkId);
    expect(read.shared).toMatchObject({ itemId: ids.Checkout, walkers: ["one-handed", "low-vision"] });
    expect(read.lanes.map((l: { outcome: { outcome: string } }) => l.outcome.outcome)).toEqual(["stumbled", "stumbled"]);
    expect(read.lanes[0].screens[2].stumbles[0]).toMatchObject({ walker: "one-handed", finding: "3.1", what: "Could not reach Help in the corner." });
    const text = await isocan(["--canvas", canvas, "walk", walkId]);
    expect(text.stdout).toContain("✗ stumbled (measured 3.1): Could not see Edit beside the time.");
    expect(text.stdout).toMatch(/Shared: “Checkout” — The secondary actions are faint and out of the thumb's reach\. · one fix: itm_[\w-]+, a proposal beneath it/);
    expect(text.stdout).toContain("[stumbled: Could not find Edit.]");

    // Nothing written but the pins, the record and the one proposal: Checkout is as it was.
    const after = await json(["--canvas", canvas, "show", ids.Checkout!]);
    expect(after.currentVersionId).toBe(checkoutBefore.currentVersionId);
    const proposals = (await json(["--canvas", canvas, "ls"])).filter((i: { properties?: Record<string, string> }) => i.properties?.proposal);
    expect(proposals).toHaveLength(1);
    expect(JSON.parse(proposals[0].properties.proposalCites)).toEqual([{ kind: "walk", ref: walkId }]);
  }, 90_000);
});
