import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startDaemon, type Daemon } from "@isocan/server";
import { harnessVars } from "@isocan/api";


const cliBin = fileURLToPath(new URL("../bin/isocan.js", import.meta.url));
const kit = { id: "usr_kit", name: "Kit" };

let home: string;
let daemon: Daemon;
let base: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-deck-"));
  await fs.writeFile(path.join(home, "identity.json"), JSON.stringify({ ...kit, createdAt: new Date().toISOString() }));
  daemon = await startDaemon({ port: 0, home });
  const address = daemon.app.server.address();
  base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterEach(async () => {
  await daemon.close();
  await fs.rm(home, { recursive: true, force: true });
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
  child.stdout!.on("data", (chunk) => (stdout += chunk));
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => (stderr += chunk));
  return new Promise((resolve) => child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr })));
}

async function json(...args: string[]): Promise<any> {
  const run = await isocan(...args, "--json");
  expect(run.code, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

/**
 * **Modules added and removed outside core, from the terminal**
 * (`docs/projects/modules/design.md`, phase 3). `module add` prints and
 * installs nothing until `--yes`; once installed, a module's verbs hang on
 * the program and its guide section prints with `--agent-help`; a refused
 * module is a row with a reason; `rm` takes the verbs away.
 */
async function builtModule(name: string, manifest: Record<string, unknown>, cli: string | null): Promise<string> {
  const dir = path.join(home, `built-${name}`);
  await fs.mkdir(path.join(dir, "dist"), { recursive: true });
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest));
  if (cli) await fs.writeFile(path.join(dir, "dist/cli.mjs"), cli);
  await fs.writeFile(path.join(dir, "agent-guide.md"), "## Hello\n\n`isocan hello` says hi — a module's verb.\n");
  return dir;
}

const HELLO_CLI = `export default {
  register(host) {
    host.program.command("hello").description("say hi").action(() => {
      const kinds = globalThis.isocan.core.moduleKinds().map((k) => k.id);
      console.log("hi from a module; kinds here: " + kinds.join(","));
    });
  },
};
`;

describe("isocan module", () => {
  it("prints what a module declares and installs nothing until --yes; then its verb and guide are there; then rm takes them away", async () => {
    const dir = await builtModule(
      "hello",
      { name: "@acme/hello", version: "1.2.0", engines: ">=0.1.0", kinds: [{ id: "greeting", mimes: ["text/x-greeting"], extensions: ["greet"], label: "Greetings", noun: "greeting" }], cli: "dist/cli.mjs", guide: "agent-guide.md" },
      HELLO_CLI,
    );
    const shown = await isocan("module", "add", dir);
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("@acme/hello 1.2.0");
    expect(shown.stdout).toContain("kind greeting: text/x-greeting (.greet) — Greetings");
    expect(shown.stderr).toContain("--yes");
    expect((await isocan("hello")).code).not.toBe(0);

    const installed = await json("module", "add", dir, "--yes");
    expect(installed.installed).toBe(true);
    const hello = await isocan("hello");
    expect(hello.code, hello.stderr).toBe(0);
    expect(hello.stdout).toContain("hi from a module; kinds here:");
    expect(hello.stdout).toContain("greeting");
    const guide = await isocan("--agent-help");
    expect(guide.stdout).toContain("## Hello");
    const rows = await json("module", "ls");
    expect(rows).toContainEqual({ name: "@acme/hello", version: "1.2.0", refused: null });
    expect(rows.some((r: { version: string }) => r.version === "built in")).toBe(true);

    const removed = await json("module", "rm", "hello");
    expect(removed).toEqual({ removed: "hello" });
    expect((await isocan("hello")).code).not.toBe(0);
    expect((await isocan("--agent-help")).stdout).not.toContain("## Hello");
  });

  it("refuses a module built for another isocan, at add and in the list", async () => {
    const dir = await builtModule("future", { name: "@acme/future", version: "9.0.0", engines: ">=9.0.0", cli: "dist/cli.mjs" }, HELLO_CLI);
    const refused = await isocan("module", "add", dir, "--yes");
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain("needs isocan >=9.0.0, and this is 0.1.0");
    // Dropped in by hand — the check at load is the one that protects a home
    // whose isocan moved after the module was installed.
    await fs.cp(dir, path.join(home, "modules", "future"), { recursive: true });
    const rows = await json("module", "ls");
    expect(rows).toContainEqual({ name: "@acme/future", version: "9.0.0", refused: "needs isocan >=9.0.0, and this is 0.1.0" });
    expect((await isocan("hello")).code).not.toBe(0);
  });

  it("refuses a directory that is not a built module, by name", async () => {
    const run = await isocan("module", "add", home);
    expect(run.code).not.toBe(0);
    expect(run.stderr).toContain("no manifest.json");
  });
});
