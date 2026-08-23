import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Project } from "@isocan/core";
import { startDaemon, stopDaemons, type Daemon } from "@isocan/server";
import { harnessVars } from "../src/harness.ts";
import { mintTestBadge } from "./badge.ts";

/**
 * The two landmines mechanism 5 laid, and the one act that defuses both.
 *
 * The home identity in `~/.isocan/identity.json` is a local file that nothing
 * ever claimed — it was ASSERTED in the request body and believed. So the
 * moment the membership check went live it would have been refused with
 * `not-your-actor`, for every solo human on every machine, at once. And a
 * badge replaced at the door holds no claims at all, so the first act after
 * ANY recovery would have been refused the same way.
 *
 * Neither is grandfathered. "An asserted actor is accepted if we have no
 * better idea" is a hole that never closes, and it would have meant the check
 * existed and never fired for the most common caller on earth. Instead the
 * human's actor becomes a real claim on the machine's badge, minted the first
 * time that machine speaks for them — and the badge that is handed a new
 * badge claims again before it replays.
 *
 * What both tests are really asserting is that a person notices NOTHING.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };
let home: string;
let work: string;
let daemon: Daemon;
let base: string;
let port: number;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-claiming-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-claiming-work-"));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await daemon.close();
  await stopDaemons(port, home).catch(() => {});
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(work, { recursive: true, force: true });
});

/** The CLI as the person runs it: no TTY, no harness session — which is what
 * makes it resolve the HOME identity rather than a session one. */
function isocan(...args: string[]) {
  const env: NodeJS.ProcessEnv = { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) };
  for (const v of harnessVars) delete env[v];
  const child = spawn(process.execPath, [cliBin, ...args], {
    cwd: work,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/**
 * A home as an upgrade leaves it: a person named in a local file, a canvas
 * that remembers them, and NOT ONE CLAIM anywhere on the desk that says this
 * machine may speak for them. This is the state every existing installation
 * is in on the morning phase 3 lands.
 */
async function upgradedHome(): Promise<void> {
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...nico, createdAt: new Date().toISOString() }),
  );
  const setup = await mintTestBadge(base);
  await setup.speakAs(nico);
  await fetch(`${base}/api/ops`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...setup.headers },
    body: JSON.stringify({
      projectId: null,
      actor: nico,
      op: { type: "project.create", projectId: "prj_1", title: "The Old Canvas" },
    }),
  });
  // Now take the claim away, under a stopped daemon so the log tail does not
  // put it back. THIS is what a pre-badge home looks like: a canvas that
  // remembers who made it, and a desk that vouches for nobody.
  await daemon.close();
  const file = path.join(home, "desk", "badges.json");
  const snapshot = JSON.parse(await fs.readFile(file, "utf8")) as {
    badges: Record<string, { claims: unknown[] }>;
  };
  for (const badge of Object.values(snapshot.badges)) badge.claims = [];
  await fs.writeFile(file, JSON.stringify(snapshot));
  daemon = await startDaemon({ port, home });
}

const desk = async () =>
  JSON.parse(await fs.readFile(path.join(home, "desk", "badges.json"), "utf8")) as {
    badges: Record<string, { claims: { actorId: string; sessionKey?: string }[] }>;
  };

const identityFile = async () =>
  JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8")) as {
    id: string;
    name: string;
    auth?: Record<string, { badgeId: string; secret: string }>;
  };

const projects = (headers: Record<string, string>): Promise<Project[]> =>
  fetch(`${base}/api/projects`, { headers }).then((r) => r.json() as Promise<Project[]>);

/** Every claim on the desk, flattened — a machine has one badge, so this
 * reads exactly as the claims table did. */
const claimsOnDesk = async (): Promise<{ actorId: string; sessionKey?: string }[]> =>
  Object.values((await desk()).badges).flatMap((b) => b.claims);

describe("an upgraded machine claims its person", () => {
  it("meets no refusal, and does not become somebody new", async () => {
    // Note where the claim lands: on the FIRST command that names him, which
    // is before this machine's badge has been let into anything. So the name
    // is judged against an empty scope and simply stands — which is exactly
    // what "a solo human must not meet a refusal" has to mean in practice.
    await upgradedHome();

    const made = await isocan("project", "create", "Nico's New Canvas");
    expect(made.stderr).not.toContain("not-your-actor");
    expect(made.stderr).not.toContain("does not speak for");
    expect(made.code).toBe(0);

    // The same person, with the same id the file has always carried: an
    // upgrade that minted a stranger would leave every canvas he ever
    // touched behind.
    const reader = await mintTestBadge(base);
    const canvas = (await projects(reader.headers)).find((p) => p.title === "Nico's New Canvas")!;
    expect(canvas.createdBy).toEqual(nico);
    expect((await identityFile()).id).toBe(nico.id);

    // And the assertion has become a claim — on the machine's own badge,
    // under the home slot's key, which is what makes the next command free.
    const claims = await claimsOnDesk();
    expect(claims).toContainEqual(
      expect.objectContaining({ actorId: nico.id, sessionKey: "home:person" }),
    );
  });

  it("pays for it once — the second command does not go round again", async () => {
    await upgradedHome();
    await isocan("project", "create", "First");
    const claimsAfterFirst = (await claimsOnDesk()).filter((c) => c.actorId === nico.id).length;

    const again = await isocan("project", "create", "Second");
    expect(again.code).toBe(0);
    // One claim, not one per command: the badge already speaks for him, so
    // the home never asks again.
    expect((await claimsOnDesk()).filter((c) => c.actorId === nico.id)).toHaveLength(
      claimsAfterFirst,
    );
  });

  it("carries a rename to the desk, so the registry stops answering with the old name", async () => {
    await upgradedHome();
    await isocan("project", "create", "First");

    const renamed = await isocan("identity", "--name", "Nico G", "--home");
    expect(renamed.code).toBe(0);
    expect(renamed.stderr).not.toContain("warning");

    // The id is the stable key; the NAME is what the registry answers with,
    // and a rename that never reached it would put "Nico" back on top of
    // everything "Nico G" writes from here on.
    const reader = await mintTestBadge(base);
    const names = (await (
      await fetch(`${base}/api/names`, { headers: reader.headers })
    ).json()) as Record<string, string>;
    expect(names[nico.id]).toBe("Nico G");
    expect((await identityFile()).id).toBe(nico.id);
  });

  it("is not refused because a second Nico is already here", async () => {
    // The case that would have bitten hardest, and quietly: the person used
    // the web app under their own name, which minted a DIFFERENT actor with
    // the same name (a browser persona is not the home identity). Both
    // Nicos have coexisted happily all along, and phase 3 must not turn one
    // of them into a machine that cannot write.
    //
    // It does not, and the reason is structural rather than kind: `as` only
    // asks whether a name is free when it is CHANGING one, and the canvases
    // this machine can see already answer to Nico with his own id. Nobody is
    // renamed on entry — mechanism 10 says late collisions are survivable by
    // construction, because the vocabulary already mints deliberate
    // duplicates and every client renders them distinguishably.
    await upgradedHome();
    const browser = await mintTestBadge(base);
    await browser.speakAs({ id: "usr_web_nico", name: "Nico" }, "web:tab-1");
    // And this machine has been in that room, so the collision is in scope.
    expect((await isocan("ls", "--project", "prj_1")).code).toBe(0);

    const made = await isocan("project", "create", "Nico's New Canvas");
    expect(made.stderr).not.toContain("taken here");
    expect(made.code).toBe(0);

    const reader = await mintTestBadge(base);
    const canvas = (await projects(reader.headers)).find((p) => p.title === "Nico's New Canvas")!;
    expect(canvas.createdBy).toEqual(nico);
  });

});

describe("a badge replaced under a running command", () => {
  it("re-claims before it replays, so the first act after recovery lands", async () => {
    await upgradedHome();
    await isocan("project", "create", "Before");
    const before = await identityFile();
    const slot = `http://127.0.0.1:${port}`;

    // The badge this machine holds is destroyed — the CLI's equivalent of
    // deleting a live browser's cookie. Its claims stay on the desk, on a
    // badge nobody holds any more.
    const dead = before.auth![slot]!.badgeId;
    await fs.writeFile(
      path.join(home, "identity.json"),
      JSON.stringify({ ...before, auth: { [slot]: { ...before.auth![slot]!, secret: "x".repeat(43) } } }),
    );

    const after = await isocan("project", "create", "After");
    expect(after.stderr).not.toContain("not-your-actor");
    expect(after.code).toBe(0);

    // A new badge, and it speaks for Nico — the claim was re-made BEFORE the
    // refused request was replayed. Without that, this is a 401 followed by
    // a `not-your-actor` on the first action after any recovery.
    const now = await identityFile();
    expect(now.auth![slot]!.badgeId).not.toBe(dead);
    const claims = (await desk()).badges[now.auth![slot]!.badgeId]!.claims;
    expect(claims).toContainEqual(
      expect.objectContaining({ actorId: nico.id, sessionKey: "home:person" }),
    );

    // And the work landed as Nico, not as somebody new.
    const reader = await mintTestBadge(base);
    const canvas = (await projects(reader.headers)).find((p) => p.title === "After")!;
    expect(canvas.createdBy).toEqual(nico);
  });
});
