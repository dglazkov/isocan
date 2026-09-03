import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { markerFile } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge } from "./badge.ts";

/**
 * **`isocan group` and `isocan share group:<name>`** (roles phase 5) — the
 * verb half of the canvas list's Groups panel and the Share dialog's group
 * picker. Run on a REPLICA, as `space.test.ts` is, because a group is desk
 * state at the home and the verbs have to change the home's rows; the door
 * at the home is the witness.
 *
 * The home has borrowed an attester in configuration only, so a member's
 * proof is written on the desk.
 *
 * Fixtures are synthetic: Priya, Jordan, Sam, Acme.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };

let upstreamDir: string;
let laptopDir: string;
let work: string;
let homeDaemon: Daemon;
let laptop: Daemon;
let homeBase: string;

function baseOf(daemon: Daemon): string {
  const address = daemon.app.server.address();
  return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
}
const portOf = (daemon: Daemon) => Number(new URL(baseOf(daemon)).port);

beforeEach(async () => {
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-home-"));
  laptopDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-laptop-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-group-work-"));
  homeDaemon = await startDaemon({
    port: 0,
    home: upstreamDir,
    birthHome: null,
    auth: { project: "acme-test", apiKey: "test-key" },
  });
  homeBase = baseOf(homeDaemon);
  await fs.writeFile(
    path.join(laptopDir, "identity.json"),
    JSON.stringify({ ...priya, createdAt: new Date().toISOString() }),
  );
  laptop = await startDaemon({ port: 0, home: laptopDir, birthHome: homeBase, homePollMs: 50 });
});

afterEach(async () => {
  await laptop.close();
  await homeDaemon.close();
  await Promise.allSettled(
    [upstreamDir, laptopDir, work].map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function cli(...args: string[]): Promise<Run> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ISOCAN_HOME: laptopDir,
    ISOCAN_PORT: String(portOf(laptop)),
  };
  for (const v of harnessVars) delete env[v];
  env.CLAUDE_CODE_SESSION_ID = "s-priya";
  const child = spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (c) => (stdout += c));
  child.stderr.on("data", (c) => (stderr += c));
  return new Promise((resolve) =>
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
  );
}

/** Born through the replica, so born at the home. */
async function bornCanvas(): Promise<string> {
  const born = await cli("identity", "--session");
  expect(born.code, born.stderr).toBe(0);
  const marker = JSON.parse(await fs.readFile(markerFile(work), "utf8")) as { projectId: string };
  return marker.projectId;
}

async function anotherCanvas(title: string): Promise<string> {
  const made = await cli("canvas", "create", title);
  expect(made.code, made.stderr).toBe(0);
  return made.stdout.match(/created canvas (\S+)/)![1]!;
}

/** A badge at the home that has proved this address. */
async function holderOf(email: string) {
  const badge = await mintTestBadge(homeBase);
  await homeDaemon.desk.attest(badge.badgeId, {
    attribute: `email:${email}`,
    verifiedVia: "magic-link",
    at: new Date().toISOString(),
  });
  return badge;
}
const enter = async (badge: { headers: Record<string, string> }, canvasId: string) =>
  (await fetch(`${homeBase}/api/projects/${canvasId}/canvas`, { headers: badge.headers })).status;

describe("isocan group", () => {
  it("makes a group at the home, lists it with its members, and puts addresses in and out", async () => {
    const made = await cli("group", "new", "Design team");
    expect(made.code, made.stderr).toBe(0);
    expect(made.stdout).toMatch(/made the group Design team \(ppl_/);
    const groupId = made.stdout.match(/\((ppl_\S+)\)/)![1]!;
    const atHome = (await homeDaemon.desk.group(groupId))!;
    expect(atHome.name).toBe("Design team");
    expect((await homeDaemon.desk.claimants(atHome.createdBy)).length).toBeGreaterThan(0);

    // Normalized on the way in, and listed with who is in it.
    const added = await cli("group", "add", "Design team", "Jordan@Acme.Test", "sam@acme.test");
    expect(added.code, added.stderr).toBe(0);
    expect(added.stdout).toContain("email:jordan@acme.test is in Design team (1)");
    expect(added.stdout).toContain("email:sam@acme.test is in Design team (2)");
    expect((await homeDaemon.desk.group(groupId))!.members).toEqual(["email:jordan@acme.test", "email:sam@acme.test"]);
    const listed = await cli("group", "list");
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout).toContain(groupId);
    expect(listed.stdout).toMatch(/Design team\s+2\s+jordan@acme\.test, sam@acme\.test/);
    // Again is nothing, and out is out.
    const again = await cli("group", "add", "Design team", "sam@acme.test");
    expect(again.stdout).toContain("was already in Design team");
    const removed = await cli("group", "remove", "Design team", "sam@acme.test");
    expect(removed.code, removed.stderr).toBe(0);
    expect(removed.stdout).toContain("email:sam@acme.test is out of Design team (1)");
    expect((await cli("group", "remove", "Design team", "sam@acme.test")).stdout).toContain("was not in Design team");
    // A name that is not one of yours is refused, with the way to make it.
    const missing = await cli("group", "add", "Marketing", "sam@acme.test");
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("no group called Marketing");
    // And the JSON shape is the owner's: members and size.
    const json = JSON.parse((await cli("group", "list", "--json")).stdout) as { id: string; size: number; members: string[] }[];
    expect(json[0]).toMatchObject({ id: groupId, size: 1, members: ["email:jordan@acme.test"] });
  }, 90_000);

  it("share group:<name> writes a row naming the group by id, the table says `group <name> (<size>)`, and remove reaches the canvas", async () => {
    const a = await bornCanvas();
    expect((await cli("share", "--link", "off")).code).toBe(0);
    expect((await cli("group", "new", "Design team")).code).toBe(0);
    expect((await cli("group", "add", "Design team", "jordan@acme.test", "sam@acme.test")).code).toBe(0);

    const shared = await cli("share", "group:Design team", "--as", "edit");
    expect(shared.code, shared.stderr).toBe(0);
    expect(shared.stdout).toMatch(/granted group:ppl_\S+ on .* as Editor \(gnt_\S+\) — its members get in by proving an address in the group/);
    const jordanBadge = await holderOf("jordan@acme.test");
    expect(await enter(jordanBadge, a)).toBe(200);
    const nico = await holderOf("nico@acme.test");
    expect(await enter(nico, a)).toBe(403);

    const table = await cli("share");
    expect(table.code, table.stderr).toBe(0);
    expect(table.stdout).toMatch(/group Design team \(2\)\s+Editor/);
    expect(table.stdout).not.toContain("group:ppl_");

    // Out of the group: one write, and the verb says what it reached.
    const removed = await cli("group", "remove", "Design team", "jordan@acme.test");
    expect(removed.code, removed.stderr).toBe(0);
    expect(removed.stdout).toContain("email:jordan@acme.test is out of Design team (1) — reached 1 canvas; 1 expelled");
    expect(await enter(jordanBadge, a)).toBe(403);
    // Back in, and inside again at the door.
    expect((await cli("group", "add", "Design team", "jordan@acme.test")).stdout).toContain("reached 1 canvas");
    expect(await enter(jordanBadge, a)).toBe(200);

    // A group cannot be kept out; it is un-invited.
    const barred = await cli("share", "--bar", "group:Design team");
    expect(barred.code).toBe(1);
    expect(barred.stderr).toContain("cannot be kept out");
    const revoked = await cli("share", "--revoke", "group:Design team");
    expect(revoked.code, revoked.stderr).toBe(0);
    expect(revoked.stdout).toMatch(/revoked group:ppl_\S+ on/);
    expect(await enter(jordanBadge, a)).toBe(403);
  }, 120_000);

  it("share --space <space> group:<name> reaches every canvas in the space, and delete stops the rows admitting", async () => {
    const a = await bornCanvas();
    const b = await anotherCanvas("Acme Roadmap");
    expect((await cli("space", "new", "Design")).code).toBe(0);
    expect((await cli("space", "add", "Design", a, b)).code).toBe(0);
    expect((await cli("share", "--space", "Design", "--link", "off")).code).toBe(0);
    expect((await cli("group", "new", "Design team")).code).toBe(0);
    expect((await cli("group", "add", "Design team", "jordan@acme.test")).code).toBe(0);

    const shared = await cli("share", "--space", "Design", "group:Design team");
    expect(shared.code, shared.stderr).toBe(0);
    expect(shared.stdout).toMatch(/granted group:ppl_\S+ on the space Design as Editor \(gnt_\S+\) — reached 2 canvases/);
    const jordanBadge = await holderOf("jordan@acme.test");
    expect(await enter(jordanBadge, a)).toBe(200);
    expect(await enter(jordanBadge, b)).toBe(200);
    // The space's table and the canvas's both print the group by name.
    expect((await cli("share", "--space", "Design")).stdout).toMatch(/group Design team \(1\)\s+Editor/);
    expect((await cli("share", "--canvas", a)).stdout).toMatch(/group Design team \(1\)\s+Editor\s+\S+\s+bdg_\S+\s+space Design/);

    const gone = await cli("group", "delete", "Design team");
    expect(gone.code, gone.stderr).toBe(0);
    expect(gone.stdout).toContain("deleted the group Design team");
    expect(gone.stdout).toContain("reached 2 canvases; 2 expelled");
    expect(await enter(jordanBadge, a)).toBe(403);
    expect(await enter(jordanBadge, b)).toBe(403);
    expect((await cli("group", "list")).stdout).toContain("no groups yet");
    // The row is still on the space, and now prints as its subject: the
    // home will not show a deleted group.
    expect((await cli("share", "--space", "Design")).stdout).toMatch(/group:ppl_\S+\s+Editor/);
  }, 120_000);
});
