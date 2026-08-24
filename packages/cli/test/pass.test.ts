import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canvasUrl, INSTALL_SPEC } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { markerFile } from "../src/binding.ts";
import { harnessVars } from "../src/harness.ts";

/**
 * **Scene 5, from the terminal end.**
 *
 * Jordan is standing on a canvas in a tab the home admitted, and she wants her
 * own machine in here too. Her tab mints a pass; the pass rides out in a
 * `#fragment` on a copied command; the machine that pastes it comes away
 * **answering to that home, admitted to that canvas, and being her**. The
 * journey says the dialog is not the only surface that can start that — *"any
 * admitted session can mint the same pass from the CLI — how Priya would
 * enroll her own second machine"* — so the CLI has to be able to play both
 * halves, and this file plays them against two real daemons.
 *
 * Two real daemons and the real binary, not an in-process assertion, because
 * what is under test is what three badges say to each other across a wire: the
 * minting badge at the home, the daemon's badge that redeems, and the CLI's
 * badge on the new machine that has to end up able to write as the person the
 * pass named. `second-device.test.ts` is the idiom, and this is its sibling —
 * that one proves a machine arriving under the LINK grant, this one proves a
 * machine arriving under a pass, which is the case that still works when the
 * link is off.
 *
 * The fixtures are synthetic: an Acme canvas, a Priya, a temp directory.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };

let homeDir: string;
let homeWork: string;
let awayDir: string;
let awayWork: string;
let fakeBrowser: string;
let homeDaemon: Daemon;
let homePort: number;
let awayPort: number;

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address() as net.AddressInfo;
      probe.close(() => resolve(address.port));
    });
  });
}

/**
 * A stand-in for `open`/`xdg-open` on the PATH, recording what the CLI handed
 * the browser.
 *
 * This is not a convenience to stop a window popping up mid-suite (though it
 * does that too). It is the only way to assert the property the conductor
 * decided: `isocan open` gives the BROWSER a pass and gives the TERMINAL a
 * clean address. Reading stdout alone would prove half of it and leave the
 * other half — that the browser really did get escalated — assumed.
 */
async function browserRecorder(dir: string): Promise<string> {
  const log = path.join(dir, "opened.txt");
  for (const name of ["open", "xdg-open"]) {
    const file = path.join(dir, name);
    await fs.writeFile(file, `#!/bin/sh\nprintf '%s\\n' "$1" >> ${JSON.stringify(log)}\n`);
    await fs.chmod(file, 0o755);
  }
  return log;
}

beforeEach(async () => {
  homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-pass-home-"));
  homeWork = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-pass-home-work-"));
  awayDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-pass-away-"));
  awayWork = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-pass-away-work-"));
  fakeBrowser = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-pass-browser-"));
  // The human whose second machine this scene is about. Written rather than
  // claimed through the CLI so that the test is about the pass and not about
  // the first-run prompt.
  await fs.writeFile(
    path.join(homeDir, "identity.json"),
    JSON.stringify({ ...priya, createdAt: new Date().toISOString() }),
  );
  homeDaemon = await startDaemon({ port: 0, home: homeDir, birthHome: null });
  const address = homeDaemon.app.server.address();
  homePort = typeof address === "object" && address ? address.port : 0;
  awayPort = await freePort();
});

afterEach(async () => {
  // The away machine's daemon is spawned DETACHED by the CLI, so closing a
  // handle is not enough: a daemon outliving the worker is how a run ends with
  // "Channel closed" instead of a summary.
  await stopDaemons(awayPort, awayDir).catch(() => {});
  await homeDaemon.close();
  await stopDaemons(homePort, homeDir).catch(() => {});
  await Promise.allSettled(
    [homeDir, homeWork, awayDir, awayWork, fakeBrowser].map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(
  cwd: string,
  isocanHome: string,
  port: number,
  extra: Record<string, string>,
  ...args: string[]
): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: isocanHome,
    ISOCAN_PORT: String(port),
    // The verb refuses to compete with this, and a developer's shell often has
    // it set — see `pointDaemonAtHome`.
    PATH: `${fakeBrowser}${path.delimiter}${process.env.PATH ?? ""}`,
  };
  delete env.ISOCAN_HOME_URL;
  for (const v of harnessVars) delete env[v];
  Object.assign(env, extra);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const atHome = (...args: string[]) => cli(homeWork, homeDir, homePort, {}, ...args);
const away = (...args: string[]) => cli(awayWork, awayDir, awayPort, {}, ...args);

/** The canvas Priya is standing on when she reaches for her second machine. */
async function acmeCanvas(): Promise<string> {
  const made = await atHome("project", "create", "Acme Sprint Board", "--json");
  expect(made.code, made.stderr).toBe(0);
  return (JSON.parse(made.stdout) as { projectId: string }).projectId;
}

describe("isocan pass — minting the escalation credential from a terminal", () => {
  it("prints the whole command to paste, with the pass in the fragment", async () => {
    const projectId = await acmeCanvas();
    const minted = await atHome("pass", "--json");
    expect(minted.code, minted.stderr).toBe(0);
    const out = JSON.parse(minted.stdout) as {
      command: string;
      address: string;
      canvas: string;
      expiresAt: string;
      actor: { id: string; name: string };
    };

    // The whole command, never a bare token: a line beginning `npx` is a line
    // you paste into a terminal, and a person handed a token has to be TOLD
    // what to do with it.
    const home = `http://127.0.0.1:${homePort}`;
    expect(out.command.startsWith(`npx ${INSTALL_SPEC} setup `)).toBe(true);
    expect(out.command).toContain(out.address);
    expect(out.canvas).toBe(canvasUrl(home, projectId));
    // The credential is in the FRAGMENT — never sent to a server, never in an
    // access log — and the clean address is the same address `isocan share`
    // prints, built by the same core function.
    const [bare, token] = out.address.split("#");
    expect(bare).toBe(out.canvas);
    expect(token).toMatch(/^pss_[^.]+\.[\w-]+$/);

    // A pass minted from a terminal endows the actor this CLI speaks as.
    expect(out.actor).toEqual(priya);
    // Fifteen minutes: long enough to copy, switch windows and paste; short
    // enough that a line left in a shell history is uninteresting.
    const ttl = Date.parse(out.expiresAt) - Date.now();
    expect(ttl).toBeGreaterThan(13 * 60_000);
    expect(ttl).toBeLessThanOrEqual(15 * 60_000 + 5_000);
  }, 60_000);

  it("--admit-only mints the shape that hands over no identity", async () => {
    await acmeCanvas();
    const minted = await atHome("pass", "--admit-only", "--json");
    expect(minted.code, minted.stderr).toBe(0);
    const out = JSON.parse(minted.stdout) as Record<string, unknown>;
    // Not a stub: Scene 6's cloud agent claims her OWN actor, never Inna's.
    expect(out).not.toHaveProperty("actor");
    expect(String(out.address)).toContain("#pss_");
  }, 60_000);

  it("says out loud, in plain output, that the line is a credential", async () => {
    await acmeCanvas();
    const minted = await atHome("pass");
    expect(minted.code, minted.stderr).toBe(0);
    expect(minted.stdout).toContain("credential");
    expect(minted.stdout).toMatch(/not post it on a thread/i);
    // And it points at the thing you hand a PERSON instead.
    expect(minted.stdout).toContain("isocan share");
  }, 60_000);
});

describe("isocan setup <address>#<pass> — one command, three steps collapsed", () => {
  it("points at the home, redeems, writes the marker, and becomes her", async () => {
    const projectId = await acmeCanvas();
    const minted = await atHome("pass", "--json");
    expect(minted.code, minted.stderr).toBe(0);
    const { address } = JSON.parse(minted.stdout) as { address: string };

    // The one line out of the dialog, pasted in an empty directory on a
    // machine that has never heard of any of this.
    const done = await away("setup", "--no-install", "--no-open", "--json", address);
    expect(done.code, done.stderr).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;

    // 1. It answers to that home now — `isocan home`'s machinery, not a
    //    second way to write config.json.
    const home = `http://127.0.0.1:${homePort}`;
    expect(report.home).toBe(home);
    expect(JSON.parse(await fs.readFile(path.join(awayDir, "config.json"), "utf8"))).toMatchObject({
      home,
    });
    expect(report.app).toContain(`replica of ${home}`);

    // 2. It knows whose machine it is — and the redeem response is the ONLY
    //    place that was ever announced, so this is the assertion that the
    //    answer was not thrown away.
    expect(report.identity).toContain("Priya");
    expect(JSON.parse(await fs.readFile(path.join(awayDir, "identity.json"), "utf8"))).toMatchObject(
      priya,
    );

    // 3. The marker carries the canvas id AND the home's address, from the
    //    first minute — the committed file a clone arrives holding.
    const marker = JSON.parse(await fs.readFile(markerFile(awayWork), "utf8")) as {
      projectId: string;
      home: string;
      title?: string;
    };
    expect(marker.projectId).toBe(projectId);
    expect(marker.home).toBe(home);

    // 4. The canvas really replicated. Verified rather than assumed: this is a
    //    background sweep, and a setup that printed an address for a canvas
    //    that never arrived would be a cheerful wrong address.
    expect(report.replicated).toContain("Acme Sprint Board");
    expect(report.canvas).toBe(canvasUrl(home, projectId));

    // And the CLI on the new machine can now write to the canvas AS PRIYA —
    // the whole point of the handoff. This is the step that was refused with
    // `not-your-actor` before a pass existed: two badges, one actor.
    const wrote = await away("comment", "add", "on it from the laptop", "--at", "10,10");
    expect(wrote.code, wrote.stderr).toBe(0);
    const snapshot = await homeDaemon.engine.getSnapshot(projectId);
    const authors = Object.values(snapshot.canvas.threads).flatMap((thread) =>
      thread.comments.map((comment) => comment.author.name),
    );
    expect(authors).toContain("Priya");
  }, 120_000);

  it("a pass is single-use: the same command on a third machine is refused, and says why", async () => {
    const projectId = await acmeCanvas();
    const minted = await atHome("pass", "--json");
    const { address } = JSON.parse(minted.stdout) as { address: string };
    const first = await away("setup", "--no-install", "--no-open", "--json", address);
    expect(first.code, first.stderr).toBe(0);

    const again = await away("setup", "--no-install", "--no-open", "--json", address);
    expect(again.code).not.toBe(0);
    // "Already used" is a different sentence from "no such pass", and the
    // honest reading is "that machine is already enrolled".
    expect(again.stderr).toMatch(/already redeemed|single-use/i);
  }, 120_000);

  it("takes an address with NO pass — arriving thin, from a terminal", async () => {
    /**
     * The question the brief left open, answered by measurement rather than by
     * argument: does the pass-less form work?
     *
     * It does, and it falls out of the design rather than out of a branch. The
     * canvas's standing LINK grant admits whoever presents the address, so the
     * away daemon's brand-new badge is offered the canvas by `GET
     * /api/projects` and the sweep replicates it — which is exactly what
     * `second-device.test.ts` proves for a machine holding a copied marker.
     * What the person does NOT get is an identity: nothing vouched for them,
     * so they name themselves here like any first arrival. That is
     * arrival-thin-from-a-terminal, and it is worth having.
     *
     * It is also the form that STOPS working when the link is switched off,
     * which is the whole reason a pass exists.
     */
    const projectId = await acmeCanvas();
    const home = `http://127.0.0.1:${homePort}`;
    const done = await away(
      "setup",
      "--no-install",
      "--no-open",
      "--json",
      `${home}/p/${projectId}`,
    );
    expect(done.code, done.stderr).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;
    expect(report.home).toBe(home);
    expect(report.replicated).toContain("Acme Sprint Board");
    expect(report.canvas).toBe(canvasUrl(home, projectId));
    const marker = JSON.parse(await fs.readFile(markerFile(awayWork), "utf8")) as {
      projectId: string;
      home: string;
    };
    expect(marker).toMatchObject({ projectId, home });

    // Nobody was handed over, so nobody was adopted. (The file exists — it is
    // also where the machine's BADGE lives — but it names no person.)
    expect(report).not.toHaveProperty("identity");
    const identity = JSON.parse(await fs.readFile(path.join(awayDir, "identity.json"), "utf8"));
    expect(identity.name).toBeUndefined();
  }, 120_000);

  it("joins a canvas without moving the birth default a machine already has", async () => {
    /**
     * **The test that used to say the opposite.**
     *
     * It was *"refuses to repoint a machine that already answers to a
     * different home"*, and it was right for as long as joining a canvas meant
     * repointing a whole machine: every directory bound to the old home would
     * have started refusing every command. Phase 10.3 removed the thing it
     * guarded — the home is a property of the canvas now — so the refusal went
     * with it, and what stands in its place is the capability that made it
     * unnecessary.
     *
     * The machine's birth default here is an address that answers nothing, and
     * it STAYS that way: joining a canvas at a real home is an ordinary act
     * that moves nothing else. (The trailing slash is deliberate — it is the
     * one un-normalized spelling this repo's own fixtures have ever held, and
     * it belongs in the fixture that has always carried it.)
     */
    const projectId = await acmeCanvas();
    await fs.writeFile(
      path.join(awayDir, "config.json"),
      JSON.stringify({ home: "http://127.0.0.1:9/" }),
    );

    const home = `http://127.0.0.1:${homePort}`;
    const done = await away("setup", "--no-install", "--no-open", "--json", `${home}/p/${projectId}`);
    expect(done.code, done.stderr).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;

    // Nothing moved: the config file it found is the config file it left, so
    // every other directory on this machine keeps working exactly as it did.
    expect(JSON.parse(await fs.readFile(path.join(awayDir, "config.json"), "utf8"))).toEqual({
      home: "http://127.0.0.1:9/",
    });
    // And it SAYS so, naming both — where new canvases still go, and where
    // this one lives.
    expect(report.birth).toContain("127.0.0.1:9");
    expect(report.birth).toContain(home);

    // The canvas arrived all the same, from the home the pasted address named.
    // That is the whole phase in one assertion: two homes, one daemon.
    expect(report.replicated).toContain("Acme Sprint Board");
    expect(report.canvas).toBe(canvasUrl(home, projectId));
    const marker = JSON.parse(await fs.readFile(markerFile(awayWork), "utf8")) as {
      projectId: string;
      home: string;
    };
    expect(marker).toMatchObject({ projectId, home });
  }, 120_000);

  it("redeems a pass at the home the address named, not at the birth default", async () => {
    /**
     * **Scene 5's one command, on a machine that is already somebody's.**
     *
     * A pass token is opaque — nothing on the receiving machine can read which
     * desk holds its row — so a replica with more than one home had to guess,
     * and `HomeLinks.homeScoped` guesses the birth default. On a machine whose
     * birth default is somewhere else that home has never heard of the pass,
     * and the person is told their credential is invalid: a cheerful wrong
     * answer about the one thing that must never get one.
     *
     * The fix is that **a pass is never handed over alone.** It arrives as
     * `address#pass`, one pasted string, so whoever holds the token holds the
     * address too — and `RedeemPassRequest.home` carries it, so the daemon
     * presents the credential at the desk that minted it. This is the one
     * home-scoped act with an honest local answer; badges and attestations
     * have none and stay behind that seam.
     *
     * The birth default here answers nothing and must STAY that way: enrolling
     * at a home is not a gesture that repoints a machine.
     */
    const projectId = await acmeCanvas();
    const minted = await atHome("pass", "--json");
    const { address } = JSON.parse(minted.stdout) as { address: string };
    await fs.writeFile(
      path.join(awayDir, "config.json"),
      JSON.stringify({ home: "http://127.0.0.1:9" }),
    );

    const done = await away("setup", "--no-install", "--no-open", "--json", address);
    expect(done.code, done.stderr).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;

    // The pass was spent at the home that minted it: the identity it carried
    // is on this machine, which only the minting desk could have handed over.
    const identity = JSON.parse(
      await fs.readFile(path.join(awayDir, "identity.json"), "utf8"),
    ) as { name?: string };
    expect(identity.name).toBeTruthy();
    expect(report.canvas).toBe(canvasUrl(`http://127.0.0.1:${homePort}`, projectId));

    // And the birth default never moved — the machine is enrolled at a second
    // home without a single directory bound to the first one changing.
    expect(JSON.parse(await fs.readFile(path.join(awayDir, "config.json"), "utf8"))).toEqual({
      home: "http://127.0.0.1:9",
    });
  }, 120_000);

  it("still takes a directory — the argument that has meant one since #42", async () => {
    const sub = path.join(awayWork, "somewhere");
    await fs.mkdir(sub);
    const done = await away("setup", "--no-install", "--no-open", "--json", sub);
    expect(done.code, done.stderr).toBe(0);
    const report = JSON.parse(done.stdout) as Record<string, string>;
    // The skill landed in the directory that was named, not in the cwd.
    expect(report.skill).toContain(".agents");
    await expect(fs.stat(path.join(sub, ".agents/skills/isocan-collab/SKILL.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(awayWork, ".agents"))).rejects.toThrow();
    // No home was set, nothing was redeemed: a directory argument is the old
    // gesture, unchanged.
    expect(report).not.toHaveProperty("home");
    expect(report).not.toHaveProperty("identity");
  }, 60_000);

  it("refuses a near-miss address instead of looking for a directory by that name", async () => {
    // Phase 7's finding at its most personal: the caller is somebody who just
    // pasted a line into a terminal. "no such directory: isocan.io/7f3a" would
    // be a cheerful answer to the wrong question.
    const done = await away("setup", "--no-install", "--no-open", "example.com/7f3a");
    expect(done.code).not.toBe(0);
    expect(done.stderr).toContain("not a canvas address");
    expect(done.stderr).toContain("isocan share");
  }, 60_000);
});

describe("minting from a replica", () => {
  it("mints at the HOME — the row lives where the door is", async () => {
    /**
     * Verified rather than trusted, because the failure would be invisible and
     * total: a replica that minted its own passes would hand out admissions to
     * a canvas whose door it does not answer, and single-use would be single
     * only across the desk holding the row. The badge a redeemer presents is
     * judged at the home, so the pass has to exist there.
     *
     * This is also the beat `isocan open` depends on for every thick machine
     * that is not the home — which is all of them.
     */
    const projectId = await acmeCanvas();
    const enrol = JSON.parse((await atHome("pass", "--json")).stdout) as { address: string };
    const joined = await away("setup", "--no-install", "--no-open", "--json", enrol.address);
    expect(joined.code, joined.stderr).toBe(0);

    // Now Priya's laptop — a replica — mints one of its own.
    const minted = await away("pass", "--json");
    expect(minted.code, minted.stderr).toBe(0);
    const out = JSON.parse(minted.stdout) as { address: string; actor: { id: string } };

    // The address is the HOME's, never `127.0.0.1` — a replica serves no pages
    // and people always enter through the one origin.
    expect(out.address.startsWith(canvasUrl(`http://127.0.0.1:${homePort}`, projectId))).toBe(true);
    expect(out.actor.id).toBe(priya.id);

    // And the row is on the HOME's desk, under the home's own badge for that
    // machine — not on the laptop's.
    const passId = out.address.split("#")[1]!.split(".")[0]!;
    const atTheHome = await homeDaemon.desk.pass(passId);
    expect(atTheHome?.canvasId).toBe(projectId);
    expect(atTheHome?.actorId).toBe(priya.id);
  }, 120_000);
});

describe("isocan open — the browser arrives as her, the terminal gets a clean line", () => {
  it("spawns the browser with a pass and prints the address without one", async () => {
    const projectId = await acmeCanvas();
    const log = await browserRecorder(fakeBrowser);

    const opened = await atHome("open");
    expect(opened.code, opened.stderr).toBe(0);

    // The printed line is what an agent copies onto a thread. A bearer
    // credential that rides into a chat log because a verb printed it is not a
    // mistake anybody gets to make twice.
    const clean = canvasUrl(`http://127.0.0.1:${homePort}`, projectId);
    expect(opened.stdout.trim()).toBe(clean);
    expect(opened.stdout).not.toContain("#");

    // …and the browser it spawned got the escalated one, so the tab arrives
    // admitted (even with the link grant off) and holding her claim.
    const handed = (await until(() => fs.readFile(log, "utf8").catch(() => ""), (t) => t.length > 0))
      .trim();
    expect(handed.startsWith(`${clean}#`)).toBe(true);
    expect(handed.slice(clean.length + 1)).toMatch(/^pss_[^.]+\.[\w-]+$/);
  }, 60_000);
});

async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error("timed out waiting for the browser to be spawned");
    await new Promise((r) => setTimeout(r, 25));
  }
}
