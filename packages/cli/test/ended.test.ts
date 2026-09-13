import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  badgeRoute,
  DOOR_ROUTE,
  formatBadgeToken,
  type DoorResponse,
  type KillBadgeResponse,
} from "@isocan/core";
import { harnessVars, HOME_CLAIM_KEY } from "@isocan/api";
import { startDaemon, type Daemon } from "@isocan/server";

/**
 * **`isocan wait` exits when its badge is ended** — operator phase 4's
 * owner's-path half, walked with the real binary against a real daemon.
 *
 * `packages/server/test/ended.test.ts` proves the route: a parked
 * `/api/oplog/watch` is woken and refused with `not-admitted` / `ended`. This
 * file proves the VERB reads it — that a park on a laptop whose badge was
 * ended from a phone prints the tombstone's sentence and exits 4, rather than
 * hearing silence until its timeout — because a refusal the CLI does not
 * branch on is one it retries or throws as *HTTP 403*, and the phase's
 * acceptance is *the wait exits*.
 *
 * The phone is a second badge of the same person, claiming the machine's
 * home identity under the same session key the CLI claims it under
 * (`HOME_CLAIM_KEY`), which is the shipped lost-badge-recovery shape and what
 * makes the kill authorised by `mySurfaces` rather than by a fixture.
 *
 * Fixtures are synthetic: Acme, Priya.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));

describe("a park whose badge was ended from another surface", () => {
  let home: string;
  let work: string;
  let daemon: Daemon;
  let base: string;

  beforeEach(async () => {
    home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ended-cli-home-"));
    work = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-ended-cli-work-"));
    daemon = await startDaemon({ port: 0, home: work, birthHome: null });
    const address = daemon.app.server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  afterEach(async () => {
    await daemon?.close();
    daemon = undefined as unknown as Daemon;
    for (const dir of [home, work]) {
      await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  /** The real binary, as a PERSON at a terminal: no harness variables. */
  const start = (args: string[]): ChildProcess => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ISOCAN_HOME: home,
      ISOCAN_PORT: new URL(base).port,
    };
    for (const v of harnessVars) delete env[v];
    return spawn(process.execPath, [cliBin, ...args], { cwd: work, env, stdio: ["ignore", "pipe", "pipe"] });
  };

  const finished = (child: ChildProcess) => {
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (c) => (stdout += c));
    child.stderr!.on("data", (c) => (stderr += c));
    return new Promise<{ code: number; stdout: string; stderr: string }>((resolve) =>
      child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })),
    );
  };

  const cli = (args: string[]) => finished(start(args));

  /** The phone: a badge of its own, speaking as the machine's person. */
  async function phoneOf(actor: { id: string; name: string }): Promise<Record<string, string>> {
    const res = await fetch(`${base}${DOOR_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ carrier: "bearer" }),
    });
    const door = (await res.json()) as DoorResponse;
    const headers = { Authorization: `Bearer ${formatBadgeToken(door.badgeId, door.secret!)}` };
    const claimed = await fetch(`${base}/api/ops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        canvasId: null,
        op: { type: "actor.claim", sessionKey: HOME_CLAIM_KEY, as: actor.id, name: actor.name },
      }),
    });
    if (!claimed.ok) throw new Error(`the phone could not be Priya: ${await claimed.text()}`);
    return headers;
  }

  const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("prints the sentence and exits 4 — and the next command re-badges quietly, because the holder ended it", async () => {
    expect((await cli(["identity", "--home", "--name", "Priya"])).code).toBe(0);
    const made = await cli(["canvas", "create", "Acme board"]);
    expect(made.code, made.stderr).toBe(0);

    const identity = JSON.parse(await fs.readFile(path.join(home, "identity.json"), "utf8")) as {
      id: string;
      name: string;
      auth: Record<string, { badgeId: string }>;
    };
    const laptopBadge = Object.values(identity.auth)[0]!.badgeId;
    const phone = await phoneOf({ id: identity.id, name: identity.name });

    const parked = start(["wait", "--timeout", "30"]);
    const done = finished(parked);
    // Let the verb start, seed, claim its cursor and park.
    await settle(3_000);

    const res = await fetch(`${base}${badgeRoute(laptopBadge)}`, { method: "DELETE", headers: phone });
    expect(res.status).toBe(200);
    const answer = (await res.json()) as KillBadgeResponse;
    // The wait WAS parked, and the kill reached it: counted at the moment of
    // acting, which is what makes the exit below a fact and not a timeout.
    expect(answer.reached?.waits).toBe(1);

    const out = await done;
    expect(out.code).toBe(4);
    expect(out.stderr).toMatch(/wait: ended — This surface was ended on \d+ \w+ \d{4} from another of its holder's surfaces\./);
    expect(out.stderr).toMatch(/This park is over/);

    // An end by the HOLDER keeps today's quiet re-badge (design, "End a
    // badge"): the next command knocks, re-claims the same person under the
    // same key, and nobody is told anything.
    const after = await cli(["canvas", "list", "--all"]);
    expect(after.code, after.stderr).toBe(0);
    expect(after.stdout).toMatch(/Acme board/);
  }, 60_000);
});
