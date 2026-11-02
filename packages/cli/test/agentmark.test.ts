import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Daemon } from "@isocan/server";
import { startDaemon } from "@isocan/server/daemon";
import { cliEnv, runCli, type Run } from "./cli.ts";

/**
 * **`isocan agent mark` — an owner dresses their agent from the terminal**
 * (agent pointers, 30 Sep 2026).
 *
 * The same `actor.setMark` the web's "Set pointer…" sends, with the agent's
 * id in it, and the home deciding who may. Over the real binary: the machine
 * that enrolled an agent marks it; somebody else's machine is refused, in a
 * sentence that says whose it is to choose.
 */

const nico = { id: "usr_nico_acme", name: "Nico" };
const bo = { id: "usr_bo_acme", name: "Bo" };

let homes: string[] = [];
let daemon: Daemon;
let port: string;

async function homeFor(person: { id: string; name: string }): Promise<string> {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-agentmark-"));
  await fs.writeFile(
    path.join(home, "identity.json"),
    JSON.stringify({ ...person, createdAt: new Date().toISOString() }),
  );
  homes.push(home);
  return home;
}

beforeEach(async () => {
  homes = [];
  const home = await homeFor(nico);
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  port = String(typeof address === "object" && address ? address.port : 0);
});

afterEach(async () => {
  await daemon.close();
  for (const home of homes) await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function isocanAt(home: string, ...args: string[]): Promise<Run> {
  return runCli(args, { cwd: home, env: cliEnv({ ISOCAN_HOME: home, ISOCAN_PORT: port }) });
}

describe("isocan agent mark", () => {
  it("lets the machine that enrolled an agent choose its pointer, and clears it with none", async () => {
    const home = homes[0]!;
    expect((await isocanAt(home, "canvas", "create", "Acme Pointers")).code).toBe(0);
    const added = await isocanAt(home, "agent", "add", "Rover", "--json");
    expect(added.code, added.stderr).toBe(0);
    const rover = JSON.parse(added.stdout).enrolled as { id: string };

    const marked = await isocanAt(home, "agent", "mark", "Rover", "🐕");
    expect(marked.code, marked.stderr).toBe(0);
    expect(marked.stdout).toContain("Rover now wears 🐕");
    expect((await daemon.engine.actorMarks())[rover.id]).toBe("🐕");

    const cleared = await isocanAt(home, "agent", "mark", "rover", "none");
    expect(cleared.code, cleared.stderr).toBe(0);
    expect((await daemon.engine.actorMarks())[rover.id]).toBeUndefined();
  });

  it("refuses somebody else's agent, and says whose it is to choose", async () => {
    const home = homes[0]!;
    await isocanAt(home, "canvas", "create", "Acme Pointers");
    const added = await isocanAt(home, "agent", "add", "Rover", "--json");
    const rover = JSON.parse(added.stdout).enrolled as { id: string };

    const theirs = await homeFor(bo);
    const refused = await isocanAt(theirs, "agent", "mark", rover.id, "🐱", "--canvas", "Acme Pointers");
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain("Rover is not yours to mark");
    expect((await daemon.engine.actorMarks())[rover.id]).toBeUndefined();
  });

  it("wants one emoji, the rule the face already has", async () => {
    const home = homes[0]!;
    await isocanAt(home, "canvas", "create", "Acme Pointers");
    await isocanAt(home, "agent", "add", "Rover");
    const bad = await isocanAt(home, "agent", "mark", "Rover", "dog");
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("not an emoji");
  });
});
