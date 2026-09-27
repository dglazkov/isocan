import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * **A browser that cannot start leaves no Chrome behind** (cleanup phase 4,
 * DC-1, 27 Sep 2026).
 *
 * `scripts/lib/browser.mjs` spawned Chrome and only THEN imported `ws`. On the
 * release tree there was no `ws`, so every `isocan canvas shot` and PDF export
 * started a headless Chrome, failed, and exited with that Chrome still
 * running — one orphan per attempt, on every install. And of the ways a start
 * can fail after the spawn, only the DevTools wait cleaned up; a socket that
 * would not open threw straight past a browser nothing held any more.
 *
 * The Chrome here is a fake: a Node script at `CHROME_PATH` that writes its
 * pid and then idles until killed, so "left running" is a process that can be
 * asked about, not a wall-clock guess, and no real browser is needed.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const scratch = mkdtempSync(path.join(os.tmpdir(), "isocan-browser-start-"));
const saved = { CHROME_PATH: process.env.CHROME_PATH, CHROME_BIN: process.env.CHROME_BIN };
const started: number[] = [];

afterEach(() => {
  for (const pid of started.splice(0)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone — which is the outcome the cases assert.
    }
  }
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

/** A Chrome stand-in: records its pid, optionally writes a DevTools endpoint, idles. */
function fakeChrome(name: string, port?: number): { pidfile: string } {
  const pidfile = path.join(scratch, `${name}.pid`);
  const file = path.join(scratch, name);
  writeFileSync(
    file,
    `#!${process.execPath}\n` +
      `const fs = require("node:fs");\n` +
      `fs.writeFileSync(${JSON.stringify(pidfile)}, String(process.pid));\n` +
      (port === undefined
        ? ""
        : `const dir = process.argv.find((a) => a.startsWith("--user-data-dir=")).slice("--user-data-dir=".length);\n` +
          `fs.writeFileSync(dir + "/DevToolsActivePort", "${port}\\n/devtools/browser/acme\\n");\n`) +
      `setInterval(() => {}, 1000);\n`,
  );
  chmodSync(file, 0o755);
  process.env.CHROME_PATH = file;
  delete process.env.CHROME_BIN;
  return { pidfile };
}

/** A port nothing listens on: bound by the kernel's choice, then released. */
async function closedPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/** Whether the fake ever started and is still running, allowing the kill a moment to be reaped. */
async function leftRunning(pidfile: string): Promise<boolean> {
  // The fake writes its pid as its first act; give a spawned one time to.
  for (let i = 0; i < 40 && !existsSync(pidfile); i++) await new Promise((r) => setTimeout(r, 25));
  if (!existsSync(pidfile)) return false;
  const pid = Number(readFileSync(pidfile, "utf8"));
  started.push(pid);
  for (let i = 0; i < 40; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return false;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return true;
}

describe("browser() when it cannot start", () => {
  it("never starts Chrome when `ws` cannot be imported — the release tree's case", async () => {
    // browser.mjs where the release tree had it: no `ws` anywhere above it.
    const tree = path.join(scratch, "tree");
    mkdirSync(path.join(tree, "scripts/lib"), { recursive: true });
    const copy = path.join(tree, "scripts/lib/browser.mjs");
    copyFileSync(path.join(repo, "scripts/lib/browser.mjs"), copy);
    const { pidfile } = fakeChrome("chrome-no-ws");

    // In a plain Node, not through vitest: vitest resolves a dynamic import
    // from the project root, where `ws` is, and the condition would vanish.
    const done = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `const { browser } = await import(${JSON.stringify(pathToFileURL(copy).href)}); await browser();`],
      { encoding: "utf8", cwd: tree, timeout: 20_000 },
    );
    expect(done.status, done.stderr).not.toBe(0);
    expect(done.stderr).toMatch(/Cannot find (package|module) '.*ws/);
    expect(await leftRunning(pidfile), "a Chrome was started and left running").toBe(false);
  });

  it("takes Chrome with it when the DevTools socket will not open", async () => {
    const { pidfile } = fakeChrome("chrome-closed-port", await closedPort());

    const { browser } = await import(pathToFileURL(path.join(repo, "scripts/lib/browser.mjs")).href);
    await expect(browser()).rejects.toThrow(/ECONNREFUSED/);
    expect(await leftRunning(pidfile), "a Chrome was started and left running").toBe(false);
  });
});

/**
 * **And a script that has one does not exit past its `finally`.**
 *
 * `process.exit()` ends the process without running `finally` blocks, and the
 * `finally` is where these scripts close Chrome. `canvas-shot --into` exited
 * that way when its `isocan edit` failed, and `deck-export` when a deck had
 * no slides — each an orphaned Chrome per attempt. Found by the install walk
 * of cleanup phase 4 (DC-1, 27 Sep 2026): the first `--into` left one behind.
 * The scripts are the ones a CLI verb spawns, read from the release's own
 * list, so a third one is held to this the day it is added there.
 */
describe("the scripts a CLI verb spawns", () => {
  it("never call process.exit inside a try whose finally closes the browser", async () => {
    const ts = (await import("typescript")).default;
    // @ts-expect-error — a plain .mjs module with no types.
    const { RELEASE_SCRIPTS } = await import("../scripts/release.mjs");
    const found: string[] = [];
    for (const script of Object.keys(RELEASE_SCRIPTS)) {
      const text = readFileSync(path.join(repo, script), "utf8");
      const file = ts.createSourceFile(script, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
      const visit = (node: import("typescript").Node, inGuardedTry: boolean): void => {
        if (ts.isTryStatement(node)) {
          const closes = node.finallyBlock !== undefined && /\.close\(\)/.test(node.finallyBlock.getText(file));
          visit(node.tryBlock, inGuardedTry || closes);
          if (node.catchClause) visit(node.catchClause, inGuardedTry);
          if (node.finallyBlock) visit(node.finallyBlock, inGuardedTry);
          return;
        }
        if (inGuardedTry && ts.isCallExpression(node) && node.expression.getText(file) === "process.exit") {
          found.push(`${script}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`);
        }
        ts.forEachChild(node, (child) => visit(child, inGuardedTry));
      };
      visit(file, false);
    }
    expect(found, "exits past the finally that closes Chrome — set process.exitCode instead").toEqual([]);
  });
});

process.on("exit", () => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
