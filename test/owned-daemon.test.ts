import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

/**
 * **A daemon a script starts goes when the script goes, however it goes.**
 *
 * `scripts/journeys.mjs` and `scripts/frames.mjs` spawned `isocan serve`,
 * which is a launcher: it starts a detached `serve --foreground` and exits,
 * so their `proc.kill()` reached nothing. Every run left its daemons behind,
 * and by 14 Oct 2026 one Mac held about 290 of them, roughly 8 GB. Not one of
 * 2,300 tests could see it, because no test asked what was still running
 * after a run. `scripts/lib/daemon.mjs` now owns the daemon, and this asks.
 *
 * The daemon here is a stand-in that prints the real one's ready line and
 * starts a child of its own. It can also ignore SIGTERM, so an owner's death
 * is proven to take even a daemon that will not stop when asked. What is
 * real is the helper, a separate owner process, and the operating system
 * saying whether each pid still exists.
 */
const lib = fileURLToPath(new URL("../scripts/lib/daemon.mjs", import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), "isocan-owned-daemon-"));
/** Every pid a walk reported, so a failing run does not leave its own behind. */
const seen: number[] = [];
afterAll(() => {
  for (const pid of seen) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone, which is the passing case.
    }
  }
  rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const fake = path.join(dir, "fake-daemon.mjs");
writeFileSync(fake, [
  'import { spawn } from "node:child_process";',
  'if (process.env.FAKE_STUBBORN) process.on("SIGTERM", () => {});',
  'const kid = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });',
  "console.log(JSON.stringify({ grandchild: kid.pid, guard: process.env.ISOCAN_DAEMON_GUARD_PID ?? null }));",
  "console.log(`isocan daemon listening on http://127.0.0.1:${process.env.ISOCAN_PORT}`);",
  "setInterval(() => {}, 1000);",
].join("\n"));

const owner = path.join(dir, "owner.mjs");
writeFileSync(owner, [
  `const { startDaemon } = await import(${JSON.stringify(lib)});`,
  `const d = await startDaemon({ cli: ${JSON.stringify(fake)}, home: ${JSON.stringify(dir)} });`,
  'const said = JSON.parse(d.output().split("\\n").find((line) => line.startsWith("{")));',
  "console.log(JSON.stringify({ owner: process.pid, daemon: d.proc.pid, ...said }));",
  "const how = process.argv[2];",
  'if (how === "stop") { await d.stop(); console.log("stopped"); }',
  'else if (how === "throw") setTimeout(() => { throw new Error("deliberate: an owner that crashes"); }, 20);',
  "else setInterval(() => {}, 1000);",
].join("\n"));

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function gone(pids: number[], ms = 4000): Promise<number[]> {
  const deadline = Date.now() + ms;
  for (;;) {
    const left = pids.filter(alive);
    if (left.length === 0 || Date.now() > deadline) return left;
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** Start an owner, end it the way `how` says, and report who is left. */
async function walk(how: string, signal: NodeJS.Signals | null, env: Record<string, string> = {}) {
  const child = spawn(process.execPath, [owner, how], { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  let err = "";
  child.stderr.on("data", (c) => (err += c));
  const facts = await new Promise<{ owner: number; daemon: number; grandchild: number; guard: string | null }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the owner never reported its daemon:\n${out}\n${err}`)), 10_000);
    let heard = false;
    child.stdout.on("data", (c) => {
      out += c;
      const line = out.split("\n").find((l) => l.startsWith("{"));
      if (line && !heard) {
        heard = true;
        clearTimeout(timer);
        const facts = JSON.parse(line);
        seen.push(facts.daemon, facts.grandchild);
        resolve(facts);
      }
    });
  });
  const exited = new Promise<number | null>((r) => child.once("exit", (code, sig) => r(code ?? (sig ? 128 + ({ SIGINT: 2, SIGTERM: 15, SIGHUP: 1, SIGKILL: 9 } as Record<string, number>)[sig]! : null))));
  if (signal) child.kill(signal);
  const status = await exited;
  return { facts, status, left: await gone([facts.daemon, facts.grandchild]), out };
}

describe("lib/daemon.mjs: a daemon is owned", () => {
  it("is stopped by stop(), with what it started", async () => {
    const { status, left, out } = await walk("stop", null);
    expect(out).toContain("stopped");
    expect(status).toBe(0);
    expect(left).toEqual([]);
  });

  it("is taken down when its owner crashes", async () => {
    const { status, left } = await walk("throw", null);
    expect(status).toBe(1);
    expect(left).toEqual([]);
  });

  // A daemon that ignores SIGTERM still goes: an owner that is dying cannot
  // wait for a polite stop, so its hook kills outright.
  it.each([
    ["SIGINT", 130],
    ["SIGTERM", 143],
    ["SIGHUP", 129],
  ] as const)("is taken down when its owner gets %s, even ignoring SIGTERM itself", async (signal, code) => {
    const { status, left } = await walk("wait", signal, { FAKE_STUBBORN: "1" });
    expect(status).toBe(code);
    expect(left).toEqual([]);
  });

  // The one ending no hook can see is the owner killed outright. The real
  // daemon watches ISOCAN_DAEMON_GUARD_PID for it (`guardedBy` in
  // packages/server/src/daemon.ts); what this helper owes is to hand it over.
  it("tells the daemon which pid to die with", async () => {
    const { facts } = await walk("stop", null);
    expect(facts.guard).toBe(String(facts.owner));
  });
});
