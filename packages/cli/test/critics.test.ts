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
 * **Critics in the room and the desk check, over the real CLI wire**
 * (proactive-agent phase 8). The folds are unit-tested beside them
 * (`packages/modules/critique/test/room.test.ts`, `packages/api/test/desk-check.test.ts`);
 * this holds the terminal's halves on a synthetic Acme canvas. Maya adds two
 * starter lenses, The Reductionist and The Brand Voice; with nothing to wear
 * them her ask writes nothing. With Kit parked as the lead, the ask reaches
 * Kit; Kit's notes are refused when a lens is switched off or quieter than
 * its volume, and land as comments only — Home's versions and the canvas's
 * items do not move. The read is a split, posted once; *build both* reaches
 * Kit as two proposals to make. `share` prints the desk check above the
 * address, asks Kit to wear the lens set to *before I share* once per
 * version, and never blocks; `present` prints it first too.
 */
const maya = { id: "usr_cr_maya", name: "Maya" };

let home: string;
let daemon: Daemon;
let port: string;
let base: string;

beforeAll(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-critics-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...maya, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
  base = `http://127.0.0.1:${port}`;
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

describe("critics in the room", () => {
  let canvas: string;
  let screen: string;
  const kit = { ISOCAN_SESSION_ID: "critics-kit" };
  let headers: Record<string, string>;
  const park = () => parkedWait({ base, headers, canvas, actorId: "usr_cr_kit", cli: { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port, ...kit }) } });
  const snapshot = async (): Promise<any> => ((await (await fetch(`${base}/api/projects/${canvas}/canvas`, { headers })).json()) as any).canvas;

  beforeAll(async () => {
    canvas = (await json(["canvas", "create", "Acme Bakery"])).canvasId;
    const file = path.join(home, "home.html");
    await fs.writeFile(file, `<!doctype html><title>Home</title><main><div class="banner" style="background:#b5452a;color:#fff">Two loaves for one, today</div><h1>Fresh bread</h1><button>Order for pickup</button></main>`);
    screen = (await json(["--canvas", canvas, "add", file, "--title", "Home", "--size", "390x800", "--at", "0,0"])).itemId;
    expect((await isocan(["identity", "--as", "usr_cr_kit", "--name", "Kit"], kit)).code).toBe(0);
    const badge = await mintTestBadge(base);
    headers = badge.headers;
    const host = { id: "usr_cr_host", name: "Host" };
    await badge.speakAs(host);
    const res = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...badge.headers },
      body: JSON.stringify({ canvasId: canvas, actor: host, op: { type: "agent.enroll", agent: { id: "usr_cr_kit", name: "Kit" } } }),
    });
    expect(res.status, await res.clone().text()).toBeLessThan(300);
  });

  it("starter lenses go on switched on; a lens may carry no word of the work it is after; with nothing to wear them, an ask writes nothing", async () => {
    expect(await json(["--canvas", canvas, "critic", "add", "reductionist"])).toMatchObject({ agentName: "The Reductionist", on: true });
    expect(await json(["--canvas", canvas, "critic", "add", "brand-voice"])).toMatchObject({ agentName: "The Brand Voice", on: true });
    const named = await isocan(["--canvas", canvas, "critic", "new", "The Swiss Eye", "--lens", "Grids first.", "--refs", "Swiss railway signage"]);
    expect(named.code).not.toBe(0);
    expect(named.stderr).toMatch(/carries "swiss" from "Swiss railway signage" — a critic is named for its principle, never its person/);
    const ls = await json(["--canvas", canvas, "critic", "ls"]);
    expect(ls.critics.map((c: any) => [c.agentName, c.room.on, c.room.loud, c.room.when])).toEqual([["The Reductionist", true, "studio", "asked"], ["The Brand Voice", true, "studio", "asked"]]);
    expect(ls.lenses.map((l: any) => l.id)).toEqual(["reductionist", "brand-voice", "newcomer", "craftsperson"]);
    const printed = await isocan(["--canvas", canvas, "critic", "ls"]);
    expect(printed.stdout).toContain("on · studio crit · only when asked · Cut until it breaks, then add one thing back.");

    const threads = Object.keys((await snapshot()).threads).length;
    const asked = await isocan(["--canvas", canvas, "critique", "Home"]);
    expect(asked.code).not.toBe(0);
    expect(asked.stderr).toMatch(/nothing can wear the critics here: .*Nothing was asked\./);
    expect(Object.keys((await snapshot()).threads).length).toBe(threads);
  });

  it("the ask reaches the lead; its lens notes are refused off or too quiet, and are comments only; the read is a split, posted once", async () => {
    expect((await isocan(["--canvas", canvas, "session", "start", "--label", "Kit"], kit)).code).toBe(0);
    const parked = await park();
    const told = await json(["--canvas", canvas, "critique", "Home"]);
    expect(told.lead.name).toBe("Kit");
    expect(told.critics.map((c: any) => c.name)).toEqual(["the-reductionist", "the-brand-voice"]);
    const woke = await parked.run;
    expect(woke.stdout).toMatch(/Crit, please \(itm_[\w-]+@ver_[\w-]+\): “Home” as The Reductionist \(studio crit\) and The Brand Voice \(studio crit\)\./);

    const before = await snapshot();
    const versions = before.items[screen].versions.length;
    const items = Object.keys(before.items).length;

    expect((await isocan(["--canvas", canvas, "critic", "set", "brand-voice", "--loud", "blockers"])).code).toBe(0);
    const quiet = await isocan(["--canvas", canvas, "critique", "note", "Home", "--as", "brand-voice", "--at", "0.52,0.06", "--kind", "working", "The banner's red is the only thing that says Acme. Leave it."], kit);
    expect(quiet.stderr).toMatch(/The Brand Voice is set to blockers only — a working note is quieter than it speaks/);
    expect((await isocan(["--canvas", canvas, "critic", "set", "brand-voice", "--loud", "studio", "--off"])).code).toBe(0);
    const off = await isocan(["--canvas", canvas, "critique", "note", "Home", "--as", "brand-voice", "--at", "0.52,0.06", "--kind", "working", "Leave it."], kit);
    expect(off.stderr).toMatch(/The Brand Voice is switched off/);
    expect(await json(["--canvas", canvas, "critic", "set", "brand-voice", "--on"])).toMatchObject({ on: true, loud: "studio", when: "asked" });

    const cut = await json(["--canvas", canvas, "critique", "note", "Home", "--as", "reductionist", "--at", "0.5,0.05", "--kind", "risk", "The promotion banner competes with the order button. Cut it."], kit);
    const keep = await json(["--canvas", canvas, "critique", "note", "Home", "--as", "brand-voice", "--at", "0.52,0.06", "--kind", "working", "The banner's red is the only thing that says Acme. Leave it."], kit);
    expect(cut.persona).toBe("the-reductionist");
    const after = await snapshot();
    expect(after.items[screen].versions.length).toBe(versions);
    expect(Object.keys(after.items).length).toBe(items);
    expect(after.threads[cut.threadId].comments[0]).toMatchObject({ persona: "the-reductionist", author: { name: "Kit" } });

    const notes = await isocan(["--canvas", canvas, "critique", "notes", "Home"]);
    expect(notes.stdout).toContain("The Reductionist (worn by Kit) · risk");
    const read = await json(["--canvas", canvas, "critique", "read", "Home"]);
    expect(read.room).toBe(true);
    expect(read.read.split).toHaveLength(1);
    expect(read.read.split[0].ref).toBe(`${keep.threadId}+${cut.threadId}`);
    expect(read.read.agree).toEqual([]);
    expect(read.posted).toBe(false);
    const posted = await isocan(["--canvas", canvas, "critique", "read", "Home", "--post", "--say", "Reduction against recognition: the banner is both the noise and the brand."], kit);
    expect(posted.code, posted.stderr).toBe(0);
    expect(posted.stdout).toContain("**They split**");
    const again = await isocan(["--canvas", canvas, "critique", "read", "Home", "--post"], kit);
    expect(again.stderr).toMatch(/already in the Chat/);
    const shown = await isocan(["--canvas", canvas, "critique", "read", "Home"]);
    expect(shown.stdout).toContain("Kit: Reduction against recognition: the banner is both the noise and the brand.");

    // Build both: the lead, asked for two proposals — once.
    const parkedAgain = await park();
    const both = await json(["--canvas", canvas, "critique", "both", `${keep.threadId}+${cut.threadId}`]);
    expect(both.lead.name).toBe("Kit");
    const woken = await parkedAgain.run;
    expect(woken.stdout).toContain(`Build both, please (${keep.threadId}+${cut.threadId})`);
    expect(woken.stdout).toContain(`--cites critic:${cut.threadId}`);
    // Kit answers the wake (a turn that authors nothing is handed the same wake again).
    expect((await isocan(["--canvas", canvas, "notify", "Building both: two proposals beneath Home."], kit)).code).toBe(0);
    const twice = await isocan(["--canvas", canvas, "critique", "both", `${keep.threadId}+${cut.threadId}`]);
    expect(twice.stderr).toMatch(/build both was already asked for this split/);
  }, 120_000);

  it("share prints the desk check before the address, asks the lens set to before I share once per version, and never blocks; present prints it first", async () => {
    expect((await isocan(["--canvas", canvas, "critic", "set", "brand-voice", "--when", "share"])).code).toBe(0);
    // The canvas names a lead that is not here: the lens waits, and the share goes ahead.
    expect((await isocan(["--canvas", canvas, "canvas", "edit", "--prop", "proactive=Ravi"])).code).toBe(0);
    const waits = await isocan(["--canvas", canvas, "share"]);
    expect(waits.code, waits.stderr).toBe(0);
    const at = waits.stdout.indexOf("Desk check before you share:");
    expect(at).toBeGreaterThanOrEqual(0);
    expect(at).toBeLessThan(waits.stdout.search(/^address/m));
    expect(waits.stdout).toMatch(/it reports; it never blocks\./);
    expect(waits.stdout).toMatch(/· Critics before you share: The Brand Voice waits: "Ravi" is named to lead here \(proactive=Ravi\) but is not enrolled on this canvas/);
    expect(waits.stdout).toMatch(/✓ Wires behind the design system: none/);

    // Kit parked: the share asks it to wear The Brand Voice over Home, before they share — once.
    expect((await isocan(["--canvas", canvas, "canvas", "edit", "--prop", "proactive=Kit"])).code).toBe(0);
    const parked = await park();
    const check = await json(["--canvas", canvas, "share", "--check"]);
    expect(check.deskCheck.input.critics).toEqual([{ agentName: "The Brand Voice", asked: true }]);
    expect(check.address).toBeUndefined();
    const woke = await parked.run;
    expect(woke.stdout).toMatch(/Crit, please \(itm_[\w-]+@ver_[\w-]+\): “Home” as The Brand Voice \(studio crit\) — before they share\./);
    const chat = async () => Object.values((await snapshot()).threads).flatMap((t: any) => t.comments).filter((c: any) => c.body.includes("before they share")).length;
    expect(await chat()).toBe(1);
    const shared = await json(["--canvas", canvas, "share"]);
    expect(shared.address).toMatch(/^http/);
    expect(shared.deskCheck.summary).toMatch(/it never blocks/);
    expect(await chat()).toBe(1);

    const present = await isocan(["--canvas", canvas, "present", "Home"]);
    expect(present.code, present.stderr).toBe(0);
    expect(present.stdout.indexOf("Desk check before you share:")).toBeLessThan(present.stdout.indexOf("on the main thread:"));
  }, 120_000);
});
