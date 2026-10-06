import net from "node:net";
import { beforeAll, describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCliBundle,
  CLI_BUNDLE,
  RELEASE_DEPENDENCIES,
  RELEASE_DROPS,
  nodeEntrySource,
  releaseManifest,
// @ts-expect-error — a plain .mjs module with no types.
} from "../scripts/release.mjs";

/**
 * **The release CLI is a bundle, and this is what has to stay true of it**
 * (`docs/projects/first-minute/phases.md`, phases 1 to 3).
 *
 * The debt is #332: an agent in a hosted sandbox waits 2 to 4 seconds for
 * `isocan --version`, because `bin/isocan.js` registers tsx and then imports
 * 297 of our own `.ts` files through it, plus every module's guide off the
 * disk, before the version string is printed. A laptop hides that — 0.3 s
 * there — and no test that runs on a laptop can measure the sandbox's clock.
 * So the two guards here are counts, not seconds:
 *
 * 1. **it starts without the sources.** Run from a tree holding the release
 *    manifest, `packages/cli/dist` and the built app — no `.ts` anywhere, no
 *    tsx, no `node_modules` — the CLI answers `--version`, `--help`,
 *    `--agent-help` and a module verb, and its daemon serves the page.
 * 2. **an install resolves nothing**, and the tree carries nothing it never
 *    runs.
 * 3. **the budgets**: how many modules one command loads, and how many bytes
 *    of JavaScript it reads. 456 modules and 5.8 MB when this started.
 *
 * They need the bundle built, which is esbuild over the whole CLI closure and
 * the reason this file spawns as much as it does.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const bundle = path.join(repo, CLI_BUNDLE);

/** Poll until it answers, or give up — a daemon takes a moment to bind. */
/**
 * A port nobody holds, from the OS. `34000 + pid % 1000` was a guess, and a
 * guess that lands on somebody's listener that accepts and never answers made
 * an unbounded `fetch` wait out the whole 120 s (release on 95c83125, 6 Oct).
 */
async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as net.AddressInfo;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Every request in here gets a deadline: a silent listener is a failure, not a hang. */
const ask = (url: string) => fetch(url, { signal: AbortSignal.timeout(5_000) });

async function until<T>(ask: () => Promise<T | null>, tries = 60): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const got = await ask();
    if (got) return got;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

/** What one command loads, by URL, through a hook on the module loader. */
function modulesLoadedBy(entry: string, args: string[]): string[] {
  const log = path.join(mkdtempSync(path.join(os.tmpdir(), "isocan-modules-")), "log");
  const done = spawnSync(
    process.execPath,
    ["--import", path.join(repo, "test/lib/count-modules.mjs"), entry, ...args],
    { encoding: "utf8", env: { ...process.env, ISOCAN_MODULE_LOG: log } },
  );
  expect(done.status, done.stderr).toBe(0);
  const seen = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  rmSync(path.dirname(log), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  return [...new Set(seen)];
}

describe("the release CLI is a bundle", () => {
  beforeAll(async () => {
    await buildCliBundle();
  }, 120_000);

  it("starts from a tree with no sources in it and no tsx to resolve", async () => {
    // The shape an install has: the release manifest, the CLI bundle, and the
    // web app a daemon serves. Nothing else — no sources, no `bin/isocan.js`,
    // no `node_modules`.
    // Real path: on macOS `os.tmpdir()` is a symlink into `/private`, and the
    // daemon reports the root it resolved.
    const tree = realpathSync(mkdtempSync(path.join(os.tmpdir(), "isocan-installed-")));
    try {
      const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
      writeFileSync(
        path.join(tree, "package.json"),
        JSON.stringify(releaseManifest(pkg, "deadbee", "2026-09-18T00:00:00Z"), null, 2),
      );
      mkdirSync(path.join(tree, "packages/cli"), { recursive: true });
      cpSync(path.join(repo, "packages/cli/dist"), path.join(tree, "packages/cli/dist"), {
        recursive: true,
      });
      cpSync(path.join(repo, "packages/web/dist"), path.join(tree, "packages/web/dist"), {
        recursive: true,
      });
      // And NO `node_modules`: the dependencies are inside the bundle, so an
      // install resolves nothing (phase 2).

      const installed = path.join(tree, JSON.parse(readFileSync(path.join(tree, "package.json"), "utf8")).bin.isocan);
      expect(existsSync(installed), "the manifest's bin is not where it says").toBe(true);

      const run = (...args: string[]) => {
        const done = spawnSync(process.execPath, [installed, ...args], { encoding: "utf8" });
        expect(done.status, `isocan ${args.join(" ")}\n${done.stderr}`).toBe(0);
        return done.stdout;
      };

      // The build stamp is read from the manifest of the tree it is IN, which
      // is how `packageRoot()` is proved: a copy that found the repo's root
      // instead would print the repo's commit.
      expect(run("--version")).toContain("deadbee");
      expect(run("--help")).toContain("Isomorphic canvas");

      // The guides are inlined, so `--agent-help` is whole without a single
      // `.md` file being in the tree — the base guide and every module's.
      const guide = run("--agent-help", "all");
      expect(guide.length).toBeGreaterThan(100_000);
      expect(guide).toContain("isocan wait");
      expect(guide).toContain("Mind maps");
      // And the cold start (#124) indexes the module topics it can print.
      expect(run("--agent-help")).toContain("- `mindmap` — ");

      // A module verb is registered and answers, which is the other half of
      // "the modules survived the bundling": `map` is the mind map's, `sticker`
      // the stickers'.
      expect(run("map", "--help")).toContain("Mind maps");
      expect(run("sticker", "--help")).toContain("stickers");

      // And the daemon: the half of the CLI that is fastify, the MCP layer and
      // the web app, none of which an install resolves any more. A port
      // nobody holds, a scratch home, and the two things a browser asks for.
      const home = mkdtempSync(path.join(os.tmpdir(), "isocan-installed-home-"));
      const port = await freePort();
      const daemon = spawn(process.execPath, [installed, "serve", "--foreground", "--force"], {
        env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
        stdio: ["ignore", "pipe", "pipe"],
      });
      try {
        const base = `http://127.0.0.1:${port}`;
        const health = await until(async () => {
          const reply = await ask(`${base}/healthz`).catch(() => null);
          return reply?.ok ? ((await reply.json()) as { root?: string }) : null;
        });
        expect(health?.root, "the daemon knows which copy it is").toBe(tree);
        const page = await ask(base).then((r) => r.text());
        expect(page, "an installed copy serves the app, not a not-built page").toContain("<div id=\"root\">");
      } finally {
        daemon.kill("SIGKILL");
        rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      }
    } finally {
      rmSync(tree, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 120_000);

  it("loads under 41 modules to print a version, and none of them through tsx", () => {
    const loaded = modulesLoadedBy(bundle, ["--version"]);
    const ours = loaded.filter((url) => url.endsWith(".ts"));
    const tsx = loaded.filter((url) => url.includes("/tsx/"));

    expect(tsx, "the bundle must not need a transpiler").toEqual([]);
    expect(ours, "the bundle must not reach back to the sources").toEqual([]);
    // 456 when this project started and 437 measured here the same day; 35
    // now, half of them node's own builtins. A chunk is only loaded when
    // something reaches it, so this counts what the command actually needed.
    // 40 since the entry became a stub that turns the compile cache on before
    // main's chunk is compiled: one more file, 60 ms less.
    expect(loaded.length, `${loaded.length} modules for --version`).toBeLessThan(41);
  }, 120_000);

  it("keeps a compile cache, so the next command skips compiling the chunks", () => {
    // 249 ms → 187 ms for `--version` on Node 24, measured 6 Oct 2026.
    const tmp = mkdtempSync(path.join(os.tmpdir(), "isocan-compile-cache-"));
    try {
      const { NODE_COMPILE_CACHE: _set, NODE_DISABLE_COMPILE_CACHE: _off, ...env } = process.env;
      const done = spawnSync(process.execPath, [bundle, "--version"], { encoding: "utf8", env: { ...env, TMPDIR: tmp } });
      expect(done.status, done.stderr).toBe(0);
      const cache = path.join(tmp, "node-compile-cache");
      expect(existsSync(cache) && readdirSync(cache, { recursive: true }).length > 0, "no compile cache written").toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 120_000);

  it("reads under 5 MB of JavaScript to print a version", () => {
    /**
     * **The budget that still moves** (`docs/projects/first-minute/design.md`,
     * change 6). Once the dependencies are inside the bundle the module count
     * stops being the interesting number — everything is chunks, and a chunk
     * is one file however much is in it. Bytes are what a sandbox pays for,
     * in reads and in parse time.
     *
     * 5.8 MB before phase 3, because `@isocan/server`'s index re-exported the
     * daemon and therefore fastify, and sixteen files import that index for
     * `paths`. 4.5 MB after. The ceiling is here so the next person to add a
     * static import to a barrel finds out on their own machine, where the
     * whole command is a tenth of a second and nothing else would tell them.
     */
    const startup = modulesLoadedBy(bundle, ["--version"])
      .filter((url) => url.startsWith("file:") && url.includes("/dist/"))
      .reduce((bytes, url) => bytes + statSync(fileURLToPath(url)).size, 0);
    const mb = startup / 1024 / 1024;
    expect(mb, `${mb.toFixed(1)} MB read to print a version`).toBeLessThan(5);
  }, 120_000);

  it("declares nothing an install has to resolve, and drops what an install never runs", () => {
    const pkg = JSON.parse(readFileSync(path.join(repo, "package.json"), "utf8"));
    const released = releaseManifest(pkg, "deadbee");

    // 19 declared dependencies became 227 installed packages and 35 s in the
    // sandbox of #332. Every one of them is inside the bundle now, so the
    // release asks for nothing that is code — and `@types/node` is not code.
    expect(Object.keys(released.dependencies)).toEqual(Object.keys(RELEASE_DEPENDENCIES));
    expect(Object.keys(released.dependencies).length).toBeLessThan(5);
    // What the bundle inlines is what the workspaces it folds in declare —
    // the root stopped carrying a copy of it (cleanup phase 4, DC-2).
    const inlined = new Set(
      ["cli", "server", "core", "api", "mcp", "rc"].flatMap((ws) =>
        Object.keys(JSON.parse(readFileSync(path.join(repo, "packages", ws, "package.json"), "utf8")).dependencies ?? {}),
      ).filter((name) => !name.startsWith("@isocan/")),
    );
    expect(inlined.size).toBeGreaterThan(15);
    for (const why of Object.values(RELEASE_DEPENDENCIES) as string[]) {
      expect(why.length, "a survivor with no stated reason is a survivor nobody chose").toBeGreaterThan(20);
    }

    // The tree. `docs/` alone was 15 MB of the 40 the branch carried, and the
    // sources go because after the bundling nothing resolves them — a `.ts`
    // file here would be a second copy of the CLI that can disagree with the
    // one that runs.
    const dropped = RELEASE_DROPS.flat();
    for (const spec of ["docs", "test", "packages/cli/bin", "package-lock.json"]) {
      expect(dropped, `${spec} still ships`).toContain(spec);
    }

    // And the two module entries, which registered tsx and imported the
    // sources that just left. Each becomes one line pointing at a bundle
    // built beside the CLI's.
    expect(nodeEntrySource("api")).toContain(`export * from "${path.posix.dirname(CLI_BUNDLE)}/api.mjs"`);
    expect(nodeEntrySource("api"), "nothing is registered at runtime any more").not.toContain("register(");
  });
});
