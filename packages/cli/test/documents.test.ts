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
 * **Documents from the terminal, and the module's other doors**: `docs ls`
 * and `docs outline` read what the inspector and the page read; the module's
 * slash commands lie under the daemon's list; `open --page docs` hands out
 * the page's address; and `module add` takes a git spec.
 */
describe("the documents module", () => {
  it("lists documents with their shape and prints an outline, leaving captions and screens out", async () => {
    const made = await json("canvas", "create", "Reading");
    const C: string = made.canvasId;
    await fs.writeFile(path.join(home, "plan.md"), "# Plan\n\nWe ship on Friday.\n\n## Why\n\nBecause.\n\n## How\n\n```\n# not a heading\n```\n");
    await fs.writeFile(path.join(home, "screen.html"), "<h1>Hi</h1>");
    const plan = await json("add", path.join(home, "plan.md"), "--canvas", C);
    await json("add", path.join(home, "screen.html"), "--canvas", C);
    await json("text", "a", "caption", "--canvas", C);
    const rows = await json("docs", "ls", "--canvas", C);
    expect(rows.map((r: { id: string; headings: number; words: number }) => [r.id, r.headings, r.words])).toEqual([[plan.itemId, 3, 8]]);
    const outline = await isocan("docs", "outline", plan.itemId, "--canvas", C);
    expect(outline.code, outline.stderr).toBe(0);
    expect(outline.stdout).toBe("Plan\n  Why\n  How\n");
    const refused = await isocan("docs", "outline", "screen.html", "--canvas", C);
    expect(refused.code).not.toBe(0);
    expect(refused.stderr).toContain("is not a document");
  });

  it("lays its slash commands under the daemon's list", async () => {
    const commands = await json("command", "list");
    expect(commands.find((c: { name: string }) => c.name === "outline")).toMatchObject({ source: "module" });
    expect(commands.find((c: { name: string }) => c.name === "summarize")).toMatchObject({ source: "module" });
    const shown = await isocan("command", "show", "summarize");
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("Never edit the document");
  });

});

describe("module add from a git spec", () => {
  it("clones a repository holding a built module and installs it like a directory", async () => {
    const repo = path.join(home, "hello-module.git");
    const work = path.join(home, "hello-module");
    await fs.mkdir(path.join(work, "build", "dist"), { recursive: true });
    await fs.writeFile(path.join(work, "build", "manifest.json"), JSON.stringify({ name: "@acme/hello", version: "0.3.0", engines: ">=0.1.0", cli: "dist/cli.mjs" }));
    await fs.writeFile(path.join(work, "build", "dist", "cli.mjs"), 'export default { register(host) { host.program.command("hello").action(() => console.log("hi from git")); } };\n');
    const git = (args: string[], cwd: string) => spawn("git", args, { cwd, stdio: "ignore" });
    const runGit = (args: string[], cwd: string) => new Promise<void>((resolve, reject) => git(args, cwd).on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git ${args.join(" ")} → ${code}`)))));
    await runGit(["init", "-q", "-b", "main"], work);
    await runGit(["-c", "user.email=t@t", "-c", "user.name=t", "add", "."], work);
    await runGit(["-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "built"], work);
    await runGit(["clone", "-q", "--bare", work, repo], home);
    const shown = await isocan("module", "add", `file://${repo}#main`);
    expect(shown.code, shown.stderr).toBe(0);
    expect(shown.stdout).toContain("@acme/hello 0.3.0");
    const installed = await json("module", "add", `file://${repo}#main`, "--yes");
    expect(installed.installed).toBe(true);
    const hello = await isocan("hello");
    expect(hello.code, hello.stderr).toBe(0);
    expect(hello.stdout.trim()).toBe("hi from git");
  });
});
