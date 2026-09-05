import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import {
  ANTIGRAVITY,
  adapterFor,
  antigravityDir,
  antigravityInstalled,
  defaultLine,
  ensureAntigravityServer,
  noDefaultLine,
  scanHarnesses,
  setDefaultHarness,
} from "../src/harnesses.ts";

/**
 * **What an unnamed harness means on a machine** (decided 2026-09-04): the
 * scan, pure over a PATH it is handed and a config file it reads. What
 * these pin: one runnable harness is the default without a word; two are
 * not, and say so; a persisted choice wins while it can run and is named
 * when it cannot; a declared adapter is believed as is; and a null harness
 * handed to `adapterFor` resolves through the same answer.
 */

let home: string;
let bin: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-harnesses-"));
  bin = path.join(home, "bin");
  await fs.mkdir(bin);
});

afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});

/** A PATH holding exactly these executables and nothing else. */
async function pathWith(...names: string[]): Promise<NodeJS.ProcessEnv> {
  for (const name of names) await fs.writeFile(path.join(bin, name), "#!/bin/sh\n", { mode: 0o755 });
  return { PATH: bin };
}

const config = (value: unknown) => fs.writeFile(path.join(home, "config.json"), JSON.stringify(value));

describe("the harness scan", () => {
  it("one runnable harness is the default without being asked", async () => {
    const scan = await scanHarnesses(home, await pathWith("pi"));
    expect(scan.default?.name).toBe("pi");
    expect(scan.source).toBe("only");
    const byName = Object.fromEntries(scan.rows.map((r) => [r.name, r]));
    expect(byName["pi"]).toMatchObject({ installed: true, adapter: "builtin", runnable: true, default: true });
    expect(byName["claude-code"]).toMatchObject({ installed: false, adapter: "builtin", runnable: false });
    expect(byName["codex"]).toMatchObject({ installed: false, adapter: "builtin", runnable: false });
    // Antigravity's server is not in this home, so not runnable — whatever
    // the PATH says (the dedicated test below).
    expect(byName["antigravity"]).toMatchObject({ runnable: false });
    expect(defaultLine(scan)).toContain("pi is the only harness here");
    expect((await adapterFor(home, null, { PATH: bin }))?.harness).toBe("pi");
  });

  it("two runnable harnesses are no default, and the line names the flag", async () => {
    const scan = await scanHarnesses(home, await pathWith("pi", "claude"));
    expect(scan.default).toBeNull();
    expect(scan.source).toBeNull();
    expect(noDefaultLine(scan)).toContain("2 harnesses here (claude-code, pi); an agent added without naming one can't run");
    expect(noDefaultLine(scan)).toContain("isocan rc --default-harness <name>");
    expect(await adapterFor(home, null, { PATH: bin })).toBeNull();
    // A named harness still resolves on its own.
    expect((await adapterFor(home, "pi", { PATH: bin }))?.command).toBe("npx");
  });

  it("none runnable says what to install", async () => {
    const scan = await scanHarnesses(home, await pathWith());
    expect(scan.default).toBeNull();
    expect(noDefaultLine(scan)).toContain("no harness found on this machine");
    expect(noDefaultLine(scan)).toContain("acpAdapters");
  });

  it("the persisted choice wins while it can run, and is named when it cannot", async () => {
    await setDefaultHarness(home, "claude-code");
    const both = await scanHarnesses(home, await pathWith("pi", "claude"));
    expect(both.default?.name).toBe("claude-code");
    expect(both.source).toBe("config");
    expect(defaultLine(both)).toContain("config.json's defaultHarness");
    // Claude Code uninstalled since: the choice is set aside out loud, and
    // the one harness left is the default the way it would be on a fresh
    // machine.
    await fs.rm(path.join(bin, "claude"));
    const piOnly = await scanHarnesses(home, await pathWith("pi"));
    expect(piOnly.default?.name).toBe("pi");
    expect(piOnly.ignored).toBe("claude-code");
    // …and with nothing left, the line leads with what was set aside.
    await fs.rm(path.join(bin, "pi"));
    const none = await scanHarnesses(home, { PATH: bin });
    expect(none.ignored).toBe("claude-code");
    expect(noDefaultLine(none)).toMatch(/^config.json's defaultHarness "claude-code" is not runnable here; no harness found/);
  });

  it("a declared adapter is runnable as declared, whatever the PATH says", async () => {
    await config({ acpAdapters: { "claude-code": ["node", "/somewhere/fake.mjs"], mine: "my-bridge --stdio" } });
    const scan = await scanHarnesses(home, await pathWith());
    const byName = Object.fromEntries(scan.rows.map((r) => [r.name, r]));
    expect(byName["claude-code"]).toMatchObject({ installed: false, adapter: "config", runnable: true });
    expect(byName["mine"]).toMatchObject({ installed: null, adapter: "config", runnable: true });
    expect(scan.default).toBeNull();
    expect(await adapterFor(home, "mine")).toEqual({ harness: "mine", command: "my-bridge", args: ["--stdio"] });
  });

  it("setDefaultHarness keeps the rest of config.json", async () => {
    await config({ home: "https://isocan.io", harnessVars: { mine: "MINE_ID" } });
    await setDefaultHarness(home, "pi");
    expect(JSON.parse(await fs.readFile(path.join(home, "config.json"), "utf8"))).toEqual({
      home: "https://isocan.io",
      harnessVars: { mine: "MINE_ID" },
      defaultHarness: "pi",
    });
    // A harness known only by its session variable is listed, unrunnable.
    const scan = await scanHarnesses(home, await pathWith("pi"));
    expect(scan.rows.find((r) => r.name === "mine")).toMatchObject({ adapter: null, runnable: false });
  });

  it("antigravity is builtin, and installed means the server is in the home — not agy on the PATH", async () => {
    const serverCmd = ANTIGRAVITY.archives[`${process.platform}-${process.arch}`]?.cmd;
    if (!serverCmd) return; // Google ships no server for this platform
    const before = await scanHarnesses(home, await pathWith("pi", "agy"));
    expect(before.rows.find((r) => r.name === "antigravity")).toMatchObject({
      installed: false,
      adapter: "builtin",
      runnable: false,
    });
    expect(before.default?.name).toBe("pi");
    // The spec still resolves by name — the download happens at spawn.
    const spec = await adapterFor(home, "antigravity", { PATH: bin });
    expect(spec?.command).toBe(path.join(antigravityDir(home), serverCmd));
    expect(typeof spec?.ensure).toBe("function");
    // Once the server is in the home it is installed, and a second runnable
    // harness means no default.
    await fs.mkdir(antigravityDir(home), { recursive: true });
    await fs.writeFile(path.join(antigravityDir(home), serverCmd), "#!/bin/sh\n", { mode: 0o755 });
    const after = await scanHarnesses(home, await pathWith("pi"));
    expect(after.rows.find((r) => r.name === "antigravity")).toMatchObject({ installed: true, runnable: true });
    expect(after.default).toBeNull();
  });

  it("the server is fetched once, unpacked into the home, and never fetched again", async () => {
    const serverCmd = ANTIGRAVITY.archives[`${process.platform}-${process.arch}`]?.cmd;
    if (!serverCmd) return;
    // A zip the shape Google's is: the executable at the top level.
    const src = path.join(home, "zip-src");
    await fs.mkdir(src);
    await fs.writeFile(path.join(src, serverCmd), "#!/bin/sh\necho fake\n", { mode: 0o755 });
    execFileSync("zip", ["-j", "-q", path.join(home, "server.zip"), path.join(src, serverCmd)]);
    const archive = await fs.readFile(path.join(home, "server.zip"));
    let fetches = 0;
    const server = http.createServer((_req, res) => {
      fetches++;
      res.writeHead(200, { "Content-Type": "application/zip" });
      res.end(archive);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}/server.zip`;
    try {
      const said: string[] = [];
      expect(await antigravityInstalled(home)).toBe(false);
      await ensureAntigravityServer(home, (line) => said.push(line), { url });
      expect(await antigravityInstalled(home)).toBe(true);
      expect(said[0]).toContain("fetching Google's Antigravity ACP server");
      expect(said.at(-1)).toContain("ready");
      // No zip left behind, and the second call is a no-op.
      await expect(fs.access(path.join(antigravityDir(home), "server.zip"))).rejects.toThrow();
      await ensureAntigravityServer(home, () => {}, { url });
      expect(fetches).toBe(1);
    } finally {
      server.close();
    }
  });
});
