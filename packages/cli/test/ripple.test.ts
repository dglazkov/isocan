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
 * **`isocan ripple`, over the real CLI wire** (proactive-agent phase 6). The
 * deterministic half is core's and unit-tested there (`packages/core/test/
 * ripple.test.ts`); this holds the terminal's halves on a synthetic Acme
 * canvas: a run of Maya's edits on Menu read against the other screens, with
 * the read-back waiting while nothing can answer; the pulse; with Kit parked
 * the ask reaches Kit, whose read-back and preview land and are read back —
 * and every screen stays byte for byte what it was until somebody keeps one;
 * the one-off altitude silences the source in one undo.
 */
const maya = { id: "usr_rp_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ripple-"));
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

async function page(name: string, accent: string | null, words: string): Promise<string> {
  const file = path.join(home, `${name}.html`);
  const style = accent ? `<style>:root{--accent:${accent}}h1{color:var(--accent)}</style>` : "";
  await fs.writeFile(file, `<!doctype html><title>${name}</title>${style}<h1>${words}</h1>`);
  return file;
}

describe("isocan ripple", () => {
  let canvas: string;
  const screens: Record<string, string> = {};
  const kit = { ISOCAN_SESSION_ID: "ripple-kit" };
  /** Every screen's versions — what nothing but a Keep may change. */
  const screenState = async () => JSON.stringify(await Promise.all(Object.values(screens).map(async (id) => (await json(["--canvas", canvas, "show", id])).versions)));

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    for (const [i, [title, accent, words]] of ([["Menu", "#b5452a", "Sourdough"], ["Checkout", "#b5452a", "Pickup Saturday"], ["Basket", "#8a3a20", "Your basket"], ["Profile", "#b5452a", "Settings"], ["About", null, "A neighbourhood bakery"]] as const).entries()) {
      screens[title] = (await json(["--canvas", canvas, "add", await page(title, accent, words), "--title", title, "--size", "390x640", "--at", `${i * 470},0`])).itemId;
    }
    // Maya's run on Menu: three edits, the last one a new accent.
    for (const [k, accent] of (["#b5452a", "#b5452a", "#8a3a20"] as const).entries()) {
      expect((await isocan(["--canvas", canvas, "edit", screens.Menu!, await page(`menu-${k}`, accent, `Sourdough ${"Rye ".repeat(k + 1)}`)])).code).toBe(0);
    }
  });

  it("reads the run against every other screen; the read-back waits while nothing can answer, and nothing is written", async () => {
    const before = await screenState();
    const run = await isocan(["--canvas", canvas, "ripple", "Menu"]);
    expect(run.code, run.stderr).toBe(0);
    expect(run.stdout).toMatch(/^Ripple from “Menu” \(itm_[\w-]+@v1\.\.v4\) · Maya's run, 3 edits · settle/);
    expect(run.stdout).toContain("What changed\n  --accent #b5452a → #8a3a20");
    expect(run.stdout).toContain("Would change\n  “Checkout” — --accent #b5452a → #8a3a20\n  “Profile” — --accent #b5452a → #8a3a20");
    expect(run.stdout).toContain("Already in sync\n  “Basket” — --accent #b5452a → #8a3a20");
    expect(run.stdout).toContain("1 other screen uses none of it.");
    expect(run.stdout).toMatch(/The read-back waits: no agent stands on this canvas/);
    expect(run.stdout).toContain("Screen by screen (the default)");
    const pulse = await isocan(["--canvas", canvas, "ripple"]);
    expect(pulse.code, pulse.stderr).toBe(0);
    // Never over a run of edits: until the run settles (or somebody asks), the pulse shows nothing behind.
    expect(pulse.stdout).toMatch(/Pulse: ● ● ● ● ●  5 current · 0 behind · 0 in conflict/);
    expect(pulse.stdout).toMatch(/Maya's run on “Menu” is still settling — quiet until .*, or `isocan ripple itm_[\w-]+ --ask`/);
    const asked = await isocan(["--canvas", canvas, "ripple", "Menu", "--ask"]);
    expect(asked.code).not.toBe(0);
    expect(asked.stderr).toMatch(/nothing can read it back here: .* The ripple stands without one/);
    expect(await screenState()).toBe(before);
  });

  it("with Kit parked: the ask reaches Kit; its read-back and preview land, and no screen changes until Keep", async () => {
    expect((await isocan(["identity", "--as", "usr_rp_kit", "--name", "Kit"], kit)).code).toBe(0);
    const base = `http://127.0.0.1:${port}`;
    const badge = await mintTestBadge(base);
    const host = { id: "usr_rp_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_rp_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    const parked = await parkedWait({ base, headers: badge.headers, canvas, actorId: "usr_rp_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });

    const before = await screenState();
    const asked = await json(["--canvas", canvas, "ripple", "Menu", "--ask"]);
    expect(asked.lead.name).toBe("Kit");
    const woke = await parked.run;
    expect(woke.stdout).toMatch(/Ripple, please \(itm_[\w-]+@v1\.\.v4\)/);
    // Asked is settled: the pulse now shows Checkout and Profile behind.
    const pulse = await isocan(["--canvas", canvas, "ripple"]);
    expect(pulse.stdout).toMatch(/Pulse: ● ◐ ● ◐ ●  3 current · 2 behind · 0 in conflict/);
    expect(pulse.stdout).toContain("◐ Checkout — behind “Menu”: --accent #b5452a → #8a3a20");
    const again = await isocan(["--canvas", canvas, "ripple", "Menu", "--ask"]);
    expect(again.stderr).toMatch(/Kit was already asked about this run/);

    // Kit's answer: a basket in sync is not previewed; Checkout is.
    const wrong = await isocan(["--canvas", canvas, "ripple", "Menu", "--preview", `Basket=${await page("basket-p", "#8a3a20", "Your basket")}`, "--why", "One accent."], kit);
    expect(wrong.code).not.toBe(0);
    expect(wrong.stderr).toMatch(/“Basket” is already in sync: preview only a screen that would change/);
    const stranger = await isocan(["--canvas", canvas, "ripple", "Menu", "--read-back", "--decision", "a warmer accent", "--exception", "About | it has no accent"], kit);
    expect(stranger.stderr).toMatch(/“About” is not one of the screens this ripple reaches/);
    const four = await isocan(["--canvas", canvas, "ripple", "Menu", "--read-back", "--decision", "a", "--decision", "b", "--decision", "c", "--decision", "d"], kit);
    expect(four.stderr).toMatch(/three decisions at most/);
    const answered = await json(["--canvas", canvas, "ripple", "Menu", "--read-back",
      "--decision", "a warmer, quieter accent",
      "--good", "you kept one accent for every action",
      "--exception", "Profile | a settings list, not a decision screen",
      "--sketch", "With one accent, the brand mark could carry the colour alone.",
      "--preview", `Checkout=${await page("checkout-p", "#8a3a20", "Pickup Saturday")}`], kit);
    expect(answered.commentId).toMatch(/^cmt_/);
    expect(answered.previews).toHaveLength(1);
    const preview = await json(["--canvas", canvas, "show", answered.previews[0].itemId]);
    expect(preview.properties).toMatchObject({ parent: screens.Checkout, proposal: "sure", proposalWhy: "a warmer, quieter accent" });
    expect(JSON.parse(preview.properties.proposalCites)).toEqual([{ kind: "version", ref: `${screens.Menu}@v4` }]);
    const argued = await isocan(["--canvas", canvas, "ripple", "Menu", "--preview", `Profile=${await page("profile-p", "#8a3a20", "Settings")}`], kit);
    expect(argued.stderr).toMatch(/“Profile” disagrees \(a settings list, not a decision screen\) — argue it, do not preview it/);
    const twice = await isocan(["--canvas", canvas, "ripple", "Menu", "--read-back", "--decision", "a warmer accent", "--good", "You kept one accent for every action."], kit);
    expect(twice.stderr).toMatch(/already named on this canvas/);

    const shown = await isocan(["--canvas", canvas, "ripple", "Menu"]);
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("What you decided\n  a warmer, quieter accent\n  Caught doing it right: you kept one accent for every action");
    expect(shown.stdout).toMatch(/“Checkout” — --accent #b5452a → #8a3a20 · previewed \(preview itm_[\w-]+\)/);
    expect(shown.stdout).toContain("Disagrees, your call\n  “Profile” — a settings list, not a decision screen");
    expect(shown.stdout).toContain("One idea this makes possible — a sketch, set apart\n  With one accent, the brand mark could carry the colour alone.");
    expect((await isocan(["--canvas", canvas, "ripple"])).stdout).toMatch(/Pulse: ● ◐ ● ✕ ●  3 current · 1 behind · 1 in conflict/);
    // Previews only: every screen is what it was.
    expect(await screenState()).toBe(before);

    // Keep is the person's: the preview becomes Checkout's next version, and Checkout is current.
    expect((await isocan(["--canvas", canvas, "choose", answered.previews[0].itemId])).code).toBe(0);
    expect((await isocan(["--canvas", canvas, "ripple"])).stdout).toMatch(/Pulse: ● ● ● ✕ ●  4 current · 0 behind · 1 in conflict/);
  }, 90_000);

  it("the one-off altitude marks the source ripple=off and silences it, in one undo; screens writes nothing", async () => {
    const screensSaid = await isocan(["--canvas", canvas, "ripple", "Menu", "--altitude", "screens"]);
    expect(screensSaid.stdout).toMatch(/^screen by screen: keep each preview you want/);
    const off = await isocan(["--canvas", canvas, "ripple", "Menu", "--altitude", "one-off"]);
    expect(off.code, off.stderr).toBe(0);
    expect(off.stdout).toContain("“Menu” is a one-off: it stops rippling — one undo takes it back");
    expect((await json(["--canvas", canvas, "show", screens.Menu!])).properties.ripple).toBe("off");
    expect((await isocan(["--canvas", canvas, "ripple", "Menu"])).stdout).toContain("“Menu” is marked a one-off, so its changes stay where they are.");
    expect((await isocan(["--canvas", canvas, "undo"])).code).toBe(0);
    expect((await json(["--canvas", canvas, "show", screens.Menu!])).properties.ripple).toBeUndefined();
    const bad = await isocan(["--canvas", canvas, "ripple", "Menu", "--altitude", "everywhere"]);
    expect(bad.stderr).toMatch(/--altitude is system, screens or one-off/);
  });
});
