import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import {
  REGISTRY_IDS,
  adapterFor,
  binaryDir,
  binaryInstalled,
  defaultLine,
  ensureBinary,
  noDefaultLine,
  platformKey,
  registryEntry,
  registryIndexFile,
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

  it("builtins resolve through the registry index cached in the home, and the pin serves a machine that never reached it", async () => {
    // No cache: the pin — the registry's entry as of the day it was written.
    const pinned = await adapterFor(home, "claude-code", { PATH: bin });
    expect(pinned?.args[1]).toMatch(/^@agentclientprotocol\/claude-agent-acp@/);
    expect((await adapterFor(home, "codex", { PATH: bin }))?.env).toEqual({
      INITIAL_AGENT_MODE: "agent-full-access",
      NO_BROWSER: "1",
    });
    // A cached index wins over the pin, and isocan's own env survives it.
    await fs.mkdir(path.dirname(registryIndexFile(home)), { recursive: true });
    await fs.writeFile(
      registryIndexFile(home),
      JSON.stringify({
        fetchedAt: new Date().toISOString(),
        agents: [
          { id: "claude-acp", version: "9.9.9", distribution: { npx: { package: "@x/claude@9.9.9", args: ["--acp"] } } },
          { id: "codex-acp", version: "9.9.9", distribution: { npx: { package: "@x/codex@9.9.9" } } },
        ],
      }),
    );
    expect((await adapterFor(home, "claude-code", { PATH: bin }))?.args).toEqual(["-y", "@x/claude@9.9.9", "--acp"]);
    expect((await adapterFor(home, "codex", { PATH: bin }))?.env?.INITIAL_AGENT_MODE).toBe("agent-full-access");
    // An id the cache lacks still comes from the pin.
    expect((await adapterFor(home, "pi", { PATH: bin }))?.args[1]).toMatch(/^pi-acp@/);
    expect(platformKey("darwin", "arm64")).toBe("darwin-aarch64");
    expect(platformKey("linux", "x64")).toBe("linux-x86_64");
    expect(platformKey("win32", "arm64")).toBe("windows-aarch64");
  });

  it("antigravity is builtin, and installed means the bridge is in the home — not agy on the PATH", async () => {
    const entry = await registryEntry(home, REGISTRY_IDS["antigravity"]!);
    const binary = entry?.distribution.binary?.[platformKey()];
    if (!binary) return; // Google ships no server for this platform
    const cmd = binary.cmd.replace(/^\.\//, "");
    const before = await scanHarnesses(home, await pathWith("pi", "agy"));
    expect(before.rows.find((r) => r.name === "antigravity")).toMatchObject({
      installed: false,
      adapter: "builtin",
      runnable: false,
    });
    expect(before.default?.name).toBe("pi");
    // The spec still resolves by name — the fetch happens at spawn.
    const spec = await adapterFor(home, "antigravity", { PATH: bin });
    expect(spec?.command).toBe(path.join(binaryDir(home, entry!.id, entry!.version), cmd));
    expect(typeof spec?.ensure).toBe("function");
    // Once the bridge is in the home it is installed, and a second runnable
    // harness means no default.
    await fs.mkdir(binaryDir(home, entry!.id, entry!.version), { recursive: true });
    await fs.writeFile(path.join(binaryDir(home, entry!.id, entry!.version), cmd), "#!/bin/sh\n", { mode: 0o755 });
    const after = await scanHarnesses(home, await pathWith("pi"));
    expect(after.rows.find((r) => r.name === "antigravity")).toMatchObject({ installed: true, runnable: true });
    expect(after.default).toBeNull();
  });

  it("`ensure` refreshes a stale index from the registry, follows the entry it finds, and fetches a binary once", async () => {
    // A registry of our own: pi moved on, and antigravity's archive is a
    // local zip the shape Google's is (the executable at the top level).
    const src = path.join(home, "zip-src");
    await fs.mkdir(src);
    await fs.writeFile(path.join(src, "agy_acp_server.par"), "#!/bin/sh\necho fake\n", { mode: 0o755 });
    execFileSync("zip", ["-j", "-q", path.join(home, "server.zip"), path.join(src, "agy_acp_server.par")]);
    const archive = await fs.readFile(path.join(home, "server.zip"));
    let indexFetches = 0;
    let zipFetches = 0;
    const server = http.createServer((req, res) => {
      if (req.url === "/server.zip") {
        zipFetches++;
        res.writeHead(200, { "Content-Type": "application/zip" });
        return res.end(archive);
      }
      indexFetches++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          version: "1.0.0",
          agents: [
            { id: "pi-acp", version: "1.2.3", distribution: { npx: { package: "pi-acp@1.2.3" } } },
            {
              id: "antigravity-acp",
              version: "2.0.0",
              distribution: {
                binary: { [platformKey()]: { archive: `http://127.0.0.1:${port}/server.zip`, cmd: "./agy_acp_server.par" } },
              },
            },
          ],
        }),
      );
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    process.env.ISOCAN_ACP_REGISTRY = `http://127.0.0.1:${port}/registry.json`;
    try {
      const said: string[] = [];
      const pi = await adapterFor(home, "pi", { PATH: bin });
      expect(pi?.args[1]).not.toBe("pi-acp@1.2.3"); // the pin, before any spawn
      expect(await pi!.ensure!((line) => said.push(line))).toEqual({ command: "npx", args: ["-y", "pi-acp@1.2.3"] });
      expect(indexFetches).toBe(1);
      expect(JSON.parse(await fs.readFile(registryIndexFile(home), "utf8")).agents).toHaveLength(2);

      const agy = await adapterFor(home, "antigravity", { PATH: bin });
      expect(agy?.command).toContain(path.join("antigravity-acp", "2.0.0")); // read from the cache now
      await agy!.ensure!((line) => said.push(line));
      expect(await binaryInstalled(home, "antigravity-acp", "./agy_acp_server.par")).toBe(true);
      expect(said.some((l) => l.includes("fetching antigravity-acp 2.0.0"))).toBe(true);
      expect(said.at(-1)).toContain("antigravity-acp 2.0.0 ready");
      expect(zipFetches).toBe(1);
      // No zip left behind; a fresh index and a present binary mean a
      // second ensure touches the network not at all.
      await expect(fs.access(path.join(binaryDir(home, "antigravity-acp", "2.0.0"), "archive.zip"))).rejects.toThrow();
      await agy!.ensure!(() => {});
      expect(indexFetches).toBe(1);
      expect(zipFetches).toBe(1);

      // A registry that cannot be read is narrated, and the cache serves.
      process.env.ISOCAN_ACP_REGISTRY = "http://127.0.0.1:9/registry.json";
      await fs.writeFile(
        registryIndexFile(home),
        JSON.stringify({ fetchedAt: new Date(Date.now() - 7_200_000).toISOString(), agents: [{ id: "pi-acp", version: "1.2.3", distribution: { npx: { package: "pi-acp@1.2.3" } } }] }),
      );
      const stale: string[] = [];
      const again = await adapterFor(home, "pi", { PATH: bin });
      const served = await again!.ensure!((line) => stale.push(line));
      expect(stale[0]).toMatch(/the ACP registry could not be read .* using the cached index/);
      expect(served).toEqual({ command: "npx", args: ["-y", "pi-acp@1.2.3"] });
    } finally {
      delete process.env.ISOCAN_ACP_REGISTRY;
      server.close();
    }
  });

  it("ensureBinary is a no-op when the bridge is present", async () => {
    const dir = binaryDir(home, "x-acp", "1.0.0");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "x"), "#!/bin/sh\n", { mode: 0o755 });
    const said: string[] = [];
    await ensureBinary(home, "x-acp", "1.0.0", { archive: "http://127.0.0.1:9/none.zip", cmd: "./x" }, (l) => said.push(l));
    expect(said).toEqual([]);
  });
});
