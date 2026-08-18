import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";

/**
 * The identity files already in the wild (#59). Deleting the directory slot
 * (#56) and moving claims into the daemon (#57) strands state on real
 * machines: `.isocan/identity.json` files in checkouts, and the session
 * bindings in `~/.isocan/agents.json`. Actor ids must survive — they are
 * what the canvases remember.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let work: string;
let daemon: Daemon | null;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-migration-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-migration-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = null;
});

afterEach(async () => {
  await daemon?.close();
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

async function boot(): Promise<void> {
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
}

function isocan(session: Record<string, string>, ...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  Object.assign(env, session);
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

describe("a stranded directory identity", () => {
  const kenny = { id: "usr_ceay", name: "Kenny" };

  beforeEach(async () => {
    await fs.mkdir(path.join(work, ".isocan"), { recursive: true });
    await fs.writeFile(
      path.join(work, ".isocan", "identity.json"),
      JSON.stringify({ ...kenny, createdAt: "2026-08-17T01:24:34.346Z" }),
    );
    await boot();
  });

  it("is retired with a notice, once, and never speaks for anyone", async () => {
    const first = await isocan({}, "whoami");
    expect(first.stderr).toContain("no longer speaks");
    expect(first.stderr).toContain(kenny.id); // names the actor it recorded
    expect(first.stderr).toContain(`--as ${kenny.id}`); // and the way back
    expect(first.stdout).toContain("Nico"); // the command resolved the human, not Kenny

    // Renamed aside, not deleted: the record of the actor id survives.
    await expect(fs.access(path.join(work, ".isocan", "identity.json"))).rejects.toThrow();
    const kept = JSON.parse(
      await fs.readFile(path.join(work, ".isocan", "identity.json.retired"), "utf8"),
    );
    expect(kept.id).toBe(kenny.id);

    const second = await isocan({}, "whoami");
    expect(second.stderr).not.toContain("no longer speaks"); // said once
  });

  it("the actor it recorded can be resumed deliberately, history intact", async () => {
    await isocan({}, "whoami"); // retire it
    const back = await isocan(claude("s-1"), "identity", "--as", kenny.id, "--name", "Kenny");
    expect(back.code).toBe(0);
    expect(back.stdout).toContain(`Kenny (${kenny.id})`);
    expect((await isocan(claude("s-1"), "whoami")).stdout).toContain("Kenny");
  });
});

describe("the CLI-era session registry", () => {
  it("folds into the daemon's registry on startup, ids preserved, file moved aside", async () => {
    const boundAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await fs.writeFile(
      path.join(home, "agents.json"),
      JSON.stringify({
        sessions: {
          "claude-code:s-1": { id: "usr_kenny", name: "Kenny", harness: "claude-code", boundAt },
          "codex:t-1": { id: "usr_isaac", name: "Isaac", harness: "codex", boundAt },
        },
      }),
    );
    await boot();

    // The agent never re-claims: it presents its key and is told who it is.
    expect((await isocan(claude("s-1"), "whoami")).stdout).toContain("Kenny (usr_kenny)");
    expect((await isocan({ CODEX_THREAD_ID: "t-1" }, "whoami")).stdout).toContain(
      "Isaac (usr_isaac)",
    );

    // Ran once: the legacy file is a record now, not a store.
    await expect(fs.access(path.join(home, "agents.json"))).rejects.toThrow();
    await fs.access(path.join(home, "agents.json.migrated"));

    // And the imported rows are ordinary log entries: a lost snapshot
    // recovers them like any claim.
    await daemon!.close();
    await fs.rm(path.join(home, "actors.json"));
    daemon = await startDaemon({ port, home });
    expect((await isocan(claude("s-1"), "whoami")).stdout).toContain("Kenny (usr_kenny)");
  });

  it("never overwrites what the new registry already knows", async () => {
    await boot();
    const claimed = await isocan(claude("s-1"), "identity", "--name", "Sonia", "--session");
    const sonia = /\((usr_[^)]+)\)/.exec(claimed.stdout)![1]!;

    await daemon!.close();
    await fs.writeFile(
      path.join(home, "agents.json"),
      JSON.stringify({
        sessions: {
          "claude-code:s-1": { id: "usr_stale", name: "Kenny", boundAt: new Date().toISOString() },
        },
      }),
    );
    daemon = await startDaemon({ port, home });

    expect((await isocan(claude("s-1"), "whoami")).stdout).toContain(`Sonia (${sonia})`);
  });
});
