import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PresenceSession, Canvas } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge, type TestBadge } from "./badge.ts";

/**
 * Two parties share a machine: the person who owns it, and the agents working
 * in its sessions. The person's name lives in the isocan home; an agent names
 * itself against the session id its harness exports. Neither can overwrite
 * the other, and a rename reaches the live face either way.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
/** Whoever set the fixture canvas up — not anybody the CLI speaks as. */
const seeder = { id: "usr_seed", name: "Seed" };

let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;
/** The CLI badges itself; a test poking the daemon directly needs its own. */
let badge: TestBadge;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-identity-work-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
  badge = await mintTestBadge(base);
  // A badge speaks only for actors it claims (mechanism 5). The seeded
  // canvas is deliberately NOT the human's: `usr_nico` is the identity the
  // CLI under test claims for itself, and one actor may be claimed by one
  // session at a time, so a fixture holding it would be a second claimant.
  await badge.speakAs(seeder);

  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...badge.headers },
    body: JSON.stringify({
      canvasId: null,
      actor: seeder,
      op: { type: "project.create", canvasId: "prj_1", title: "P" },
    }),
  });
});

afterEach(async () => {
  await daemon.close();
  // The CLI restarts a daemon it finds stale, and that replacement is
  // detached: closing the handle we started is not enough to leave the
  // machine as we found it.
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

/**
 * The CLI as some party runs it: no TTY, inside the working directory. The
 * suite itself runs under some harness or other, so every session variable is
 * cleared before the caller's are set — a bare `isocan({})` is a process no
 * harness launched, which is how the human's scripts run.
 */
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
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

const claude = (id: string) => ({ CLAUDE_CODE_SESSION_ID: id });

const homeIdentity = () =>
  fs
    .readFile(path.join(home, "identity.json"), "utf8")
    .then((raw) => JSON.parse(raw) as { id: string; name: string });

function roster(): Promise<PresenceSession[]> {
  return fetch(`${base}/api/projects/prj_1/sessions`, { headers: badge.headers }).then(
    (res) => res.json() as Promise<PresenceSession[]>,
  );
}

const canvases = (): Promise<Canvas[]> =>
  fetch(`${base}/api/projects`, { headers: badge.headers }).then((r) => r.json() as Promise<Canvas[]>);

describe("two parties, two identity slots", () => {
  it("an automated caller with no session is refused a name, not handed a slot", async () => {
    // The original bug, twice over: the machine slot made the last agent to
    // introduce itself the user; the directory slot handed its name to
    // whoever walked in next. A process nobody launched gets an error, not
    // somewhere quieter to write.
    const named = await isocan({}, "identity", "--name", "Kenny");
    expect(named.code).not.toBe(0);
    expect(named.stderr).toContain("no harness session");
    expect((await homeIdentity()).name).toBe("Nico"); // the person, untouched
    await expect(fs.access(path.join(work, ".isocan"))).rejects.toThrow(); // and no file invented
  });

  it("ops with a session are the agent's; without one they are the person's", async () => {
    await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    await isocan(claude("s-1"), "canvas", "create", "Agent Canvas");
    await isocan({}, "canvas", "create", "Human Canvas");

    const by = Object.fromEntries((await canvases()).map((p) => [p.title, p.createdBy.name]));
    expect(by["Agent Canvas"]).toBe("Isaac");
    expect(by["Human Canvas"]).toBe("Nico");
  });

  it("--new makes you a different person instead of renaming this one", async () => {
    const before = await homeIdentity();
    await isocan({}, "identity", "--name", "Dimitri", "--home", "--new");
    const after = await homeIdentity();
    expect(after.name).toBe("Dimitri");
    expect(after.id).not.toBe(before.id); // the agent's history stays the agent's
  });
});

describe("a rename reaches the live face", () => {
  it("immediately, keeping the same actor id", async () => {
    await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    await isocan(claude("s-1"), "session", "start", "--canvas", "prj_1");
    const [live] = await roster();
    const isaac = live!.actor;
    expect(isaac.name).toBe("Isaac");

    const renamed = await isocan(
      claude("s-1"),
      "identity",
      "--name",
      "Isaac the Second",
      "--session",
    );
    expect(renamed.code).toBe(0);

    const after = await roster();
    expect(after).toHaveLength(1); // renamed, not replaced
    expect(after[0]!.actor).toEqual({ id: isaac.id, name: "Isaac the Second" });
  });

  it("renaming without a session (or a daemon) still just works", async () => {
    const renamed = await isocan({}, "identity", "--name", "Solo", "--home");
    expect(renamed.code).toBe(0);
    expect(renamed.stdout).toContain("Solo");
    expect(await roster()).toEqual([]);
  });
});

describe("the auth block", () => {
  /**
   * `identity.json` holds two things that are not the same thing: the human's
   * name, and the MACHINE's badge. Both writers read-merge, because a write
   * that rebuilt the file from its own half would silently delete the other —
   * and a deleted badge is a client that has to go back to the door on its
   * next command, quietly re-badging a machine every time somebody renames
   * themselves.
   */
  const read = async () =>
    JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8")) as {
      id?: string;
      name?: string;
      auth?: Record<string, { badgeId: string; secret: string }>;
    };

  it("survives a rename, and the rename survives the badge", async () => {
    // Any command that reaches the daemon goes through the door and keeps
    // what it is handed. (`whoami` for a bare shell answers offline from the
    // home file, so it never asks — which is itself the right behaviour.)
    await isocan({}, "canvas", "list");
    const before = await read();
    const slot = `http://127.0.0.1:${port}`;
    expect(before.auth?.[slot]?.badgeId).toMatch(/^bdg_/);
    expect(before.name).toBe("Nico");

    await isocan({}, "identity", "--name", "Nico G", "--home");
    const after = await read();
    expect(after.name).toBe("Nico G");
    expect(after.id).toBe(before.id); // the id is the stable key, as ever
    expect(after.auth?.[slot]).toEqual(before.auth?.[slot]); // the badge stayed

    // And the next command presents that same badge rather than minting one.
    await isocan({}, "whoami");
    expect((await read()).auth?.[slot]).toEqual(before.auth?.[slot]);
  });
});

describe("a machine that lost its badge", () => {
  /**
   * The claims are still on the desk; the badge holding them is not — a
   * cleared `auth` block, a wiped home, a client that re-badged itself. The
   * old refusal said "no identity configured", which is true of the badge and
   * false of the home, and sent the reader to `--name`: a brand new actor, and
   * everything they had done left behind under the old one.
   */
  /** An agent-only machine: nobody has named the human, so there is no home
   * identity to fall back to — which is the arrangement the desk creates on a
   * machine an agent set up for itself. */
  const loseTheBadge = async () => {
    await fs.rm(path.join(home, "identity.json")); // the name AND the badge
    await isocan(claude("s-1"), "canvas", "list"); // heals itself onto a NEW badge
  };

  it("says what actually happened, and names the actor to come back as", async () => {
    const named = await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    const isaac = /\((usr_[^)]+)\)/.exec(named.stdout)![1]!;
    await loseTheBadge();

    const lost = await isocan(claude("s-1"), "whoami");
    expect(lost.code).not.toBe(0);
    expect(lost.stderr).toContain("no identity here");
    expect(lost.stderr).toMatch(/badge \(bdg_/); // the badge it does hold
    expect(lost.stderr).toContain(`Isaac (${isaac})`); // the actor it does not
    expect(lost.stderr).toContain(`--as ${isaac}`); // typed exactly as printed
    expect(lost.stderr).toContain("somebody new"); // and why --name is the wrong door

    // And the way out works on the spot, with the same id and the same history.
    const back = await isocan(claude("s-1"), "identity", "--session", "--as", isaac);
    expect(back.code).toBe(0);
    expect(back.stdout).toContain(`Isaac (${isaac})`);
    expect((await isocan(claude("s-1"), "whoami")).stdout).toContain(`Isaac (${isaac})`);
  });

  it("`--join` folds an actor this machine speaks for into the one it is (multi-identity phase 5)", async () => {
    // The machine's badge speaks for Nico (the person) and for Isaac (an
    // agent session on it): the shape the join needs, and one badge — so
    // this is the CLI's half of journey 6, with the two personas a laptop
    // holds after it proved its address.
    const named = await isocan(claude("s-1"), "identity", "--name", "Isaac", "--session");
    const isaac = /\((usr_[^)]+)\)/.exec(named.stdout)![1]!;
    const said = await isocan(claude("s-1"), "comment", "add", "as Isaac", "--at", "0,0", "--canvas", "prj_1");
    expect(said.code).toBe(0);

    const joined = await isocan({}, "identity", "--join", isaac);
    expect(joined.code).toBe(0);
    expect(joined.stdout).toContain(`${isaac} is now Nico`);

    // One person, on every reader: the registry answers Nico for Isaac's id,
    // and `who --all` lists one row under Nico's id for what Isaac wrote.
    const names = (await (
      await fetch(`${base}/api/names`, { headers: badge.headers })
    ).json()) as Record<string, string>;
    expect(names[isaac]).toBe("Nico");
    const who = await isocan({}, "--json", "who", "--all", "--canvas", "prj_1");
    const rows = JSON.parse(who.stdout) as { name: string; id: string }[];
    // The name the canvas remembers still gets its row; the id under it is
    // the person's.
    expect(rows.filter((r) => r.id !== seeder.id)).toEqual([
      { name: "Isaac", id: nico.id, live: false },
    ]);

    // The log keeps the id the comment was written with.
    const snapshot = (await (
      await fetch(`${base}/api/projects/prj_1/canvas`, { headers: badge.headers })
    ).json()) as { canvas: { threads: Record<string, { createdBy: { id: string } }> } };
    expect(Object.values(snapshot.canvas.threads).map((t) => t.createdBy.id)).toEqual([isaac]);
  });

  it("still says 'no identity configured' when the home really is blank", async () => {
    // A different situation, and it keeps its own message: nobody has ever
    // named themselves here, so there is nothing to come back as.
    await fs.rm(path.join(home, "identity.json"));
    const fresh = await isocan(claude("s-nobody"), "whoami");
    expect(fresh.code).not.toBe(0);
    expect(fresh.stderr).toContain("no identity configured");
    expect(fresh.stderr).not.toContain("--as");
  });
});
