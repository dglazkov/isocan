import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";

/**
 * **Tools, over the wire** (`docs/projects/extensions/design.md`, stage 1).
 *
 * The manifest rules are core's and tested there. What needs a daemon is the
 * claim the design actually makes about the CLI: a tool is an ORDINARY ITEM,
 * so it needs no new operation, no new route and no new store — and the two
 * ceremonies it does have (read before add, name the unavailable) work against
 * a real home rather than a fixture.
 */

const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const nico = { id: "usr_nico", name: "Nico" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-tools-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...nico, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

function isocan(...args: string[]): Promise<Run> {
  const env = { ...process.env };
  for (const name of harnessVars) delete env[name];
  const child: ChildProcess = spawn(process.execPath, [cliBin, ...args], {
    env: { ...env, ISOCAN_HOME: home, ISOCAN_PORT: new URL(base).port },
    cwd: home,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout!.setEncoding("utf8");
  child.stdout!.on("data", (c) => (stdout += c));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (c) => (stderr += c));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

const tidy = { kind: "tool", label: "Tidy", icon: "broom", does: "/format" };

async function manifest(body: unknown, name = "tidy.json"): Promise<string> {
  const file = path.join(home, name);
  await fs.writeFile(file, JSON.stringify(body));
  return file;
}

describe("a tool on the rail", () => {
  it("reads before it adds, and adds an ordinary item", async () => {
    const made = await isocan("canvas", "create", "Board");
    expect(made.code, made.stderr).toBe(0);
    const file = await manifest(tidy);

    // The ceremony: printed, and NOTHING added, until --yes. Same gate
    // `command add --from` has — what it may do gets answered before it lands.
    const shown = await json("tool", "add", file);
    expect(shown.added).toBe(false);
    expect(shown.can.join("\n"), "the capability list is derived and shown").toContain("posts a comment as you");
    expect(await json("tool", "list"), "nothing was added").toEqual([]);

    const added = await json("tool", "add", file, "--yes");
    expect(added.added).toBe(true);
    expect(added.label).toBe("Tidy");

    // An ORDINARY ITEM: `ls` sees it with no knowledge of tools at all, which
    // is the design's claim that this needed no new op, route or store.
    const items = await json("ls");
    const found = items.find((i: any) => i.id === added.itemId);
    expect(found, "a tool is not visible as an item").toBeTruthy();
    expect(found.properties.role).toBe("tool");

    const listed = await json("tool", "list");
    expect(listed).toHaveLength(1);
    expect(listed[0].does).toBe("/format");
    expect(listed[0].can.join("\n")).toContain("undoable per actor");
  }, 60_000);

  it("refuses a manifest before any bytes are uploaded", async () => {
    await isocan("canvas", "create", "Board");
    // A command nobody wrote — the rule itself: a tool may only ask for what a
    // person could ask for, and no person here can ask for /deploy.
    const bad = await isocan("tool", "add", await manifest({ ...tidy, does: "/deploy" }, "bad.json"), "--yes");
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain("/deploy");
    expect(await json("tool", "list"), "a refused tool left something behind").toEqual([]);
  }, 60_000);

  it("takes one off the rail with the verb that removes any item", async () => {
    // Nothing tool-shaped about removal, on purpose: it is an item, so `rm`
    // is the verb and the trash gives it back.
    await isocan("canvas", "create", "Board");
    const added = await json("tool", "add", await manifest(tidy), "--yes");
    const gone = await isocan("rm", added.itemId);
    expect(gone.code, gone.stderr).toBe(0);
    expect(await json("tool", "list")).toEqual([]);
  }, 60_000);
});
