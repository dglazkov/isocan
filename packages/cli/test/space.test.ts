import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Grant, Space } from "@isocan/core";
import { spaceGrantsRoute, SPACES_ROUTE } from "@isocan/core";
import { startDaemon, type Daemon } from "@isocan/server";
import { markerFile } from "@isocan/server";
import { harnessVars } from "@isocan/api";
import { mintTestBadge } from "./badge.ts";

/**
 * **`isocan space` and `isocan share --space`** (roles phase 4) — the verb
 * half of the canvas list's headings and the space's Share. Run on a
 * REPLICA, because a space is desk state at the home and the verbs have to
 * change the home's rows: a `space add` that wrote a row into the laptop's
 * ledger would print success and admit nobody anywhere. The door at the home
 * is the witness, as in `share.test.ts`.
 *
 * The home has borrowed an attester in configuration only, so an address
 * can be invited on the space and its proof written on the desk.
 *
 * Fixtures are synthetic: Priya, Jordan, Acme.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const priya = { id: "usr_priya", name: "Priya" };
const jordan = { id: "usr_jordan", name: "Jordan" };

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
  upstreamDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-space-home-"));
  laptopDir = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-space-laptop-"));
  work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-space-work-"));
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

/** A second canvas, made through the replica by its verb. */
async function anotherCanvas(title: string): Promise<string> {
  const made = await cli("canvas", "create", title);
  expect(made.code, made.stderr).toBe(0);
  return made.stdout.match(/created canvas (\S+)/)![1]!;
}

/** A badge at the home that has never been anywhere. */
async function strangerCanRead(canvasId: string): Promise<number> {
  const badge = await mintTestBadge(homeBase);
  const res = await fetch(`${homeBase}/api/projects/${canvasId}/canvas`, { headers: badge.headers });
  return res.status;
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

describe("isocan space", () => {
  it("makes a space at the home, lists it, and puts canvases in and out of it", async () => {
    const a = await bornCanvas();
    const b = await anotherCanvas("Acme Roadmap");

    const made = await cli("space", "new", "Design");
    expect(made.code, made.stderr).toBe(0);
    expect(made.stdout).toMatch(/made the space Design \(spc_/);
    // At the HOME, owned by the actor the laptop's session speaks as.
    const spaceId = made.stdout.match(/\((spc_\S+)\)/)![1]!;
    const atHome = (await homeDaemon.desk.space(spaceId))!;
    expect(atHome.name).toBe("Design");
    expect((await homeDaemon.desk.claimants(atHome.createdBy)).length).toBeGreaterThan(0);

    const listed = await cli("space", "list");
    expect(listed.code, listed.stderr).toBe(0);
    expect(listed.stdout).toContain(spaceId);
    // The owner column names the actor the laptop's session speaks as.
    expect(listed.stdout).toMatch(/Design\s+0\s+\S+/);

    // By id and by title, in one command.
    const added = await cli("space", "add", "Design", a, "Acme Roadmap");
    expect(added.code, added.stderr).toBe(0);
    expect(added.stdout).toContain(`(${a}) is in Design`);
    expect(added.stdout).toContain(`(${b}) is in Design`);
    expect((await homeDaemon.desk.space(spaceId))!.canvasIds.sort()).toEqual([a, b].sort());

    // The canvas list groups by space now, No space last.
    const grouped = await cli("canvas", "list", "--all");
    expect(grouped.code, grouped.stderr).toBe(0);
    expect(grouped.stdout).toMatch(/Design \(spc_\S+\) — 2 canvases/);
    expect(grouped.stdout.indexOf("Design (")).toBeLessThan(grouped.stdout.indexOf("No space"));
    expect(grouped.stdout).toMatch(/No space — 0 canvases/);

    const removed = await cli("space", "remove", "Design", b);
    expect(removed.code, removed.stderr).toBe(0);
    expect(removed.stdout).toContain(`(${b}) is out of Design`);
    expect((await homeDaemon.desk.space(spaceId))!.canvasIds).toEqual([a]);

    // A canvas is in at most one space: the home's refusal, verbatim.
    expect((await cli("space", "new", "Research")).code).toBe(0);
    const twice = await cli("space", "add", "Research", a);
    expect(twice.code).toBe(1);
    expect(twice.stderr).toContain("at most one space");

    // And the name is refused when it is not one this badge sees.
    const missing = await cli("space", "add", "Marketing", a);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("no space called Marketing");
  }, 90_000);

  it("share --space --link off reaches every canvas at the home, and one canvas can open wider again", async () => {
    const a = await bornCanvas();
    const b = await anotherCanvas("Acme Roadmap");
    expect((await cli("space", "new", "Design")).code).toBe(0);
    expect((await cli("space", "add", "Design", a, b)).code).toBe(0);
    expect(await strangerCanRead(a)).toBe(200);

    const off = await cli("share", "--space", "Design", "--link", "off");
    expect(off.code, off.stderr).toBe(0);
    expect(off.stdout).toContain("link off on every canvas in Design — reached 2 canvases");
    expect(await strangerCanRead(a)).toBe(403);
    expect(await strangerCanRead(b)).toBe(403);

    // Journey 5: one canvas's own link back on, at view, and the other
    // stays closed.
    const one = await cli("share", "--link", "view", "--canvas", a);
    expect(one.code, one.stderr).toBe(0);
    expect(await strangerCanRead(a)).toBe(200);
    expect(await strangerCanRead(b)).toBe(403);

    // `isocan share` on the canvas says which space it is in.
    const shown = await cli("share", "--canvas", a);
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toMatch(/space\s+Design \(spc_/);
  }, 90_000);

  it("share --space invites on the space, sweeps every canvas, and the canvas's own table marks the row as from the space", async () => {
    const a = await bornCanvas();
    const b = await anotherCanvas("Acme Roadmap");
    expect((await cli("space", "new", "Design")).code).toBe(0);
    expect((await cli("space", "add", "Design", a, b)).code).toBe(0);
    expect((await cli("share", "--space", "Design", "--link", "off")).code).toBe(0);

    const invited = await cli("share", "--space", "Design", "jordan@acme.test", "--as", "edit");
    expect(invited.code, invited.stderr).toBe(0);
    expect(invited.stdout).toMatch(/granted email:jordan@acme\.test on the space Design as Editor \(gnt_\S+\) — reached 2 canvases/);
    const jordanBadge = await holderOf("jordan@acme.test");
    expect(await enter(jordanBadge, a)).toBe(200);
    expect(await enter(jordanBadge, b)).toBe(200);

    // The space's table, and the canvas's table with the row marked.
    const spaceTable = await cli("share", "--space", "Design");
    expect(spaceTable.stdout).toMatch(/email:jordan@acme\.test\s+Editor/);
    expect(spaceTable.stdout).toMatch(/canvases\s+2 canvases/);
    const canvasTable = await cli("share", "--canvas", a);
    expect(canvasTable.stdout).toMatch(/email:jordan@acme\.test\s+Editor\s+\S+\s+bdg_\S+\s+space Design/);
    // A canvas row below what the space gives is written, and says so.
    expect((await cli("share", "jordan@acme.test", "--as", "read", "--canvas", a)).code).toBe(0);
    const below = await cli("share", "--canvas", a);
    expect(below.stdout).toContain("Canvas Viewer (below the space's Editor)");
    // --json carries the space and its rows beside the canvas's.
    const json = JSON.parse((await cli("share", "--json", "--canvas", a)).stdout) as {
      space?: Space;
      spaceGrants?: Grant[];
    };
    expect(json.space?.name).toBe("Design");
    expect(json.spaceGrants?.map((g) => g.subject)).toEqual(["email:jordan@acme.test"]);

    // Revoked on the space: out of both, and the count says two.
    const revoked = await cli("share", "--space", "Design", "--revoke", "jordan@acme.test");
    expect(revoked.code, revoked.stderr).toBe(0);
    expect(revoked.stdout).toContain("revoked email:jordan@acme.test on the space Design — reached 2 canvases");
    expect(await enter(jordanBadge, a)).toBe(200); // the canvas's own read row still admits
    expect(await enter(jordanBadge, b)).toBe(403);
    // And revoking the canvas's own row names the space when it would still
    // admit them.
    expect((await cli("share", "--space", "Design", "jordan@acme.test")).code).toBe(0);
    const stillIn = await cli("share", "--revoke", "jordan@acme.test", "--canvas", a);
    expect(stillIn.code, stillIn.stderr).toBe(0);
    expect(stillIn.stdout).toContain("they can still enter by the space this canvas is in");
  }, 120_000);

  it("refuses an ambiguous name by printing the ids, and takes the id instead", async () => {
    const a = await bornCanvas();
    const mine = await cli("space", "new", "Design");
    expect(mine.code, mine.stderr).toBe(0);
    const mineId = mine.stdout.match(/\((spc_\S+)\)/)![1]!;
    // Jordan makes a Design too, at the home, and shares it with Priya's
    // address — which the laptop's badge at the home has proved.
    const jordanBadge = await mintTestBadge(homeBase);
    await jordanBadge.speakAs(jordan);
    const theirs = await fetch(`${homeBase}${SPACES_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jordanBadge.headers },
      body: JSON.stringify({ name: "Design" }),
    });
    expect(theirs.status, await theirs.clone().text()).toBe(200);
    const { space: jordansSpace } = (await theirs.json()) as { space: Space };
    const shared = await fetch(`${homeBase}${spaceGrantsRoute(jordansSpace.id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...jordanBadge.headers },
      body: JSON.stringify({ subject: "email:priya@acme.test", capability: "own" }),
    });
    expect(shared.status, await shared.clone().text()).toBe(200);
    const laptopActor = (await homeDaemon.desk.space(mineId))!.createdBy;
    const laptopAtHome = (await homeDaemon.desk.claimants(laptopActor))[0]!.badgeId;
    await homeDaemon.desk.attest(laptopAtHome, {
      attribute: "email:priya@acme.test",
      verifiedVia: "magic-link",
      at: new Date().toISOString(),
    });

    const listed = await cli("space", "list");
    expect(listed.stdout.match(/Design/g)).toHaveLength(2);
    const ambiguous = await cli("space", "add", "Design", a);
    expect(ambiguous.code).toBe(1);
    expect(ambiguous.stderr).toContain("2 spaces are called Design");
    expect(ambiguous.stderr).toContain(jordansSpace.id);
    // By id, it goes through — and into Jordan's space, which Priya owns
    // through a row (journey 7's space half).
    const byId = await cli("space", "add", jordansSpace.id, a);
    expect(byId.code, byId.stderr).toBe(0);
    expect((await homeDaemon.desk.space(jordansSpace.id))!.canvasIds).toEqual([a]);
  }, 90_000);

  it("delete keeps every canvas, and the space stops being listed", async () => {
    const a = await bornCanvas();
    expect((await cli("space", "new", "Design")).code).toBe(0);
    expect((await cli("space", "add", "Design", a)).code).toBe(0);
    const gone = await cli("space", "delete", "Design");
    expect(gone.code, gone.stderr).toBe(0);
    expect(gone.stdout).toContain("deleted the space Design");
    expect(gone.stdout).toContain("1 canvas kept");
    expect((await cli("space", "list")).stdout).toContain("no spaces yet");
    expect(await strangerCanRead(a)).toBe(200);
  }, 90_000);
});
