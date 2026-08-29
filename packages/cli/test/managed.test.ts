import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { paths } from "@isocan/server";
import { reservePort } from "../../../test/ports.ts";
import {
  adoptGlobal,
  currentSha,
  flipTo,
  installBuild,
  listBuilds,
  liveBuildShas,
  pruneBuilds,
  shaOfRoot,
  smokeTest,
} from "../src/managed.ts";
import { whichInstall } from "../src/upgrade.ts";

/**
 * **Auto-upgrade phase 3: the managed install root.**
 *
 * Everything here runs against a scratch `ISOCAN_HOME`, which is the reason
 * `builds/` lives under it rather than beside the global install: an upgrade
 * that could only be tested by upgrading the machine running the test is an
 * upgrade nobody tests.
 *
 * **The builds are fixtures, not real installs, and that is deliberate.** A
 * real `npm i github:…#release` is a minute of network per case and can only
 * ever fetch ONE build — the tip — so the cases that matter most (two builds,
 * a build that lies about its sha, a build that will not start) are
 * unreachable through it. What a fixture has to be faithful about is the shape
 * `npm --prefix` leaves behind and the one question the smoke test asks: a
 * package called `isocan` under `node_modules`, with a stamped manifest and a
 * bin that serves `/healthz`. It is faithful about both.
 */

let home: string;
const started: ChildProcess[] = [];

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-managed-"));
});

afterEach(async () => {
  for (const child of started.splice(0)) {
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }
  await fs.rm(home, { recursive: true, force: true });
});

/**
 * A build tree in the shape `npm install --prefix` produces: `<dir>/
 * node_modules/isocan`, a manifest carrying the stamp `release.mjs` writes,
 * and a bin at the path every copy of isocan has it at.
 *
 * `claims` is how a build lies: the manifest says one commit and the running
 * process reports another. That pair is the whole reason the smoke test starts
 * the candidate instead of reading its manifest twice.
 */
async function makeBuild(
  dir: string,
  sha: string,
  options: { claims?: string; broken?: boolean } = {},
): Promise<string> {
  const root = paths.buildRoot(dir);
  const bin = path.join(root, "packages", "cli", "bin");
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "isocan",
        version: "0.1.0",
        type: "module",
        bin: { isocan: "packages/cli/bin/isocan.js" },
        isocan: { commit: sha, builtAt: "2026-08-20T09:00:00.000Z" },
      },
      null,
      2,
    ),
  );
  const reports = options.claims ?? sha;
  await fs.writeFile(
    path.join(bin, "isocan.js"),
    `#!/usr/bin/env node
import { promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = ${JSON.stringify(reports)};
const root = fileURLToPath(new URL("../../../", import.meta.url));
if (process.argv.includes("--version")) {
  console.log("0.1.0 (" + COMMIT + ")");
  process.exit(0);
}
if (!process.argv.includes("serve")) {
  console.log(COMMIT);
  process.exit(0);
}
${options.broken ? 'process.stderr.write("Error: cannot find module @isocan/server\\n");\nprocess.exit(1);' : ""}
const home = process.env.ISOCAN_HOME;
const startedAt = new Date().toISOString();
const server = http.createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  if (pathname === "/healthz" || pathname === "/api/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      pid: process.pid,
      startedAt,
      version: "0.1.0",
      root: path.resolve(root),
      codeAt: startedAt,
      commit: COMMIT,
      builtAt: "2026-08-20T09:00:00.000Z",
    }));
    return;
  }
  res.writeHead(404).end("{}");
});
server.listen(Number(process.env.ISOCAN_PORT ?? 0), "127.0.0.1", async () => {
  await fs.mkdir(home, { recursive: true });
  await fs.writeFile(
    path.join(home, "daemon.json"),
    JSON.stringify({ pid: process.pid, port: server.address().port, startedAt }),
  );
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => process.exit(0));
`,
  );
  return root;
}

describe("the shape of a managed install", () => {
  it("classifies a tree under builds/ as managed, not as a local node_modules", async () => {
    const dir = paths.buildDir(home, "aaaaaaa");
    await makeBuild(dir, "aaaaaaa");
    expect((await whichInstall(paths.buildRoot(dir), home)).kind).toBe("managed");
    // The same tree seen from another home is somebody else's business.
    expect((await whichInstall(paths.buildRoot(dir), path.join(home, "elsewhere"))).kind).toBe(
      "local",
    );
  });

  /**
   * The bug this guards ran twice, in two files, before it was named: a path
   * node handed us is already realpath'd, and a path a person or a config
   * handed us is not. On macOS every temporary directory is a symlink, so the
   * two spellings differ constantly — and the wrong answer here is not a
   * cosmetic one. It classified a global install as `local`, whose upgrade
   * path is `npm i -g`, and overwrote the very install it had been asked to
   * adopt.
   */
  it("sees through symlinks on both sides — /tmp and /private/tmp are one place", async () => {
    const dir = paths.buildDir(home, "aaaaaaa");
    await makeBuild(dir, "aaaaaaa");
    // On macOS these two spellings differ ($TMPDIR is under a symlinked
    // /var); on Linux they are the same string and the test simply passes
    // twice over. Asserting they differ would be asserting a property of the
    // operating system, which is not what is under test.
    const realHome = await fs.realpath(home);
    expect(shaOfRoot(home, paths.buildRoot(paths.buildDir(realHome, "aaaaaaa")))).toBe("aaaaaaa");
    expect((await whichInstall(paths.buildRoot(paths.buildDir(realHome, "aaaaaaa")), home)).kind).toBe(
      "managed",
    );
  });

  it("names the build a path belongs to, and only inside builds/", () => {
    expect(shaOfRoot(home, paths.buildRoot(paths.buildDir(home, "aaaaaaa")))).toBe("aaaaaaa");
    expect(shaOfRoot(home, "/usr/local/lib/node_modules/isocan")).toBeNull();
  });

  it("flips current with a rename, and reads back what was chosen", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb");
    await flipTo(home, "aaaaaaa");
    expect(await currentSha(home)).toBe("aaaaaaa");
    // Over an existing link, which is the case that matters: an upgrade is a
    // flip, not a first install.
    await flipTo(home, "bbbbbbb");
    expect(await currentSha(home)).toBe("bbbbbbb");
    // And it resolves: `isocan` on PATH points THROUGH this.
    const manifest = JSON.parse(
      await fs.readFile(
        path.join(paths.currentLink(home), "node_modules", "isocan", "package.json"),
        "utf8",
      ),
    ) as { isocan: { commit: string } };
    expect(manifest.isocan.commit).toBe("bbbbbbb");
  });

  it("has no current build before anything has been installed", async () => {
    expect(await currentSha(home)).toBeNull();
    expect(await listBuilds(home)).toEqual([]);
  });
});

describe("the smoke test", () => {
  it("passes a build that starts and says which commit it is", async () => {
    const root = await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    const result = await smokeTest(root, "aaaaaaa", { timeoutMs: 15_000 });
    expect(result).toMatchObject({ ok: true, commit: "aaaaaaa" });
  });

  it("fails a build that will not start, and says what it said", async () => {
    const root = await makeBuild(paths.buildDir(home, "bbbbbbb"), "bbbbbbb", { broken: true });
    const result = await smokeTest(root, "bbbbbbb", { timeoutMs: 15_000, attempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.why).toContain("@isocan/server");
  });

  /**
   * The case `--version` cannot catch and the whole reason this starts a
   * daemon: a tree whose manifest says one thing and whose process says
   * another is a tree that was assembled wrong, and it boots perfectly.
   */
  it("fails a build that runs but is not the build it was fetched as", async () => {
    const root = await makeBuild(paths.buildDir(home, "ccccccc"), "ccccccc", {
      claims: "ddddddd",
    });
    const result = await smokeTest(root, "ccccccc", { timeoutMs: 15_000, attempts: 1 });
    expect(result.ok).toBe(false);
    expect(result.why).toContain("ddddddd");
    expect(result.commit).toBe("ddddddd");
  });

  it("leaves no daemon behind", async () => {
    const root = await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    const result = await smokeTest(root, "aaaaaaa", { timeoutMs: 15_000 });
    expect(result.ok).toBe(true);
    // The scratch home it ran against is gone, so nothing it wrote survives —
    // and with it the pidfile that would have pointed anybody at it.
    const strays = (await fs.readdir(os.tmpdir())).filter((entry) =>
      entry.startsWith("isocan-smoke-"),
    );
    expect(strays).toEqual([]);
  });
});

describe("fetching a build", () => {
  /** `installBuild`'s runner is handed the prefix; a fixture written into it is
   * exactly what npm would have left there. */
  const installing = (sha: string, claims?: string) => async (_c: string, args: string[]) => {
    const prefix = args[args.indexOf("--prefix") + 1]!;
    await makeBuild(prefix, claims ?? sha);
    return { status: 0, stdout: "", stderr: "" };
  };

  it("promotes a fetched tree to builds/<sha> once it can be named", async () => {
    const result = await installBuild({
      home,
      spec: "github:dglazkov/isocan#release",
      want: "aaaaaaa",
      run: installing("aaaaaaa"),
    });
    expect(result.ok).toBe(true);
    expect(result.build?.sha).toBe("aaaaaaa");
    expect((await listBuilds(home)).map((b) => b.sha)).toEqual(["aaaaaaa"]);
    // And staging is gone — a half-written tree must never be readable as one.
    expect(await fs.readdir(paths.buildsDir(home))).toEqual(["aaaaaaa"]);
  });

  /**
   * The constraint the design calls core: npm can fetch exactly one build, and
   * when CI lags the tip is not the build the home runs. Installing it anyway
   * would defeat using the home as the oracle.
   */
  it("refuses a release tip that is not the build the home runs, and installs nothing", async () => {
    const result = await installBuild({
      home,
      spec: "github:dglazkov/isocan#release",
      want: "bbbbbbb",
      run: installing("aaaaaaa"),
    });
    expect(result.ok).toBe(false);
    expect(result.why).toContain("aaaaaaa");
    expect(result.why).toContain("bbbbbbb");
    expect(await listBuilds(home)).toEqual([]);
  });

  it("takes the tip when nobody named a sha — a machine with no home", async () => {
    const result = await installBuild({
      home,
      spec: "github:dglazkov/isocan#release",
      want: null,
      run: installing("eeeeeee"),
    });
    expect(result.ok).toBe(true);
    expect(result.build?.sha).toBe("eeeeeee");
  });

  it("reports a failed fetch and leaves no staging directory", async () => {
    const result = await installBuild({
      home,
      spec: "github:dglazkov/isocan#release",
      want: null,
      run: () => ({ status: 1, stdout: "", stderr: "npm ERR! 404" }),
    });
    expect(result.ok).toBe(false);
    expect(result.why).toContain("404");
    expect(await listBuilds(home)).toEqual([]);
    await expect(fs.stat(paths.stagingBuildDir(home))).rejects.toThrow();
  });
});

describe("keeping three builds, and never one in use", () => {
  const ages = ["1111111", "2222222", "3333333", "4444444", "5555555"];

  async function fiveBuilds(): Promise<void> {
    for (const [index, sha] of ages.entries()) {
      const dir = paths.buildDir(home, sha);
      await makeBuild(dir, sha);
      // Oldest first, so the sort under test has something to sort.
      const when = new Date(Date.UTC(2026, 7, 20 + index));
      await fs.utimes(dir, when, when);
    }
  }

  it("keeps the newest three and the one current points at", async () => {
    await fiveBuilds();
    await flipTo(home, "1111111"); // the OLDEST is in use
    const removed = await pruneBuilds(home);
    expect(removed.sort()).toEqual(["2222222"]);
    expect((await listBuilds(home)).map((b) => b.sha).sort()).toEqual([
      "1111111",
      "3333333",
      "4444444",
      "5555555",
    ]);
  });

  it("never deletes a tree a live daemon is running out of, however old", async () => {
    await fiveBuilds();
    await flipTo(home, "5555555");
    const removed = await pruneBuilds(home, { protect: ["1111111"] });
    expect(removed).not.toContain("1111111");
    expect(removed).toEqual(["2222222"]);
  });

  /**
   * The proof's cleanup case, measured rather than reasoned: a daemon left
   * running is found through the pidfile and the health route — the same two
   * witnesses `stopDaemons` insists on — and its tree is protected by name.
   */
  it("finds a running daemon's build through the pidfile and the health route", async () => {
    const root = await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    const port = await reservePort();
    const child = spawn(process.execPath, [path.join(root, "packages/cli/bin/isocan.js"), "serve"], {
      env: { ...process.env, ISOCAN_HOME: home, ISOCAN_PORT: String(port) },
      stdio: "ignore",
    });
    started.push(child);
    for (let tries = 0; tries < 100; tries += 1) {
      if ((await liveBuildShas(home)).has("aaaaaaa")) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect([...(await liveBuildShas(home))]).toEqual(["aaaaaaa"]);
    child.kill("SIGKILL");
    await new Promise((resolve) => child.once("exit", resolve));
    // Dead, so no longer protected — a pid that outlived its process must not
    // pin a tree forever.
    expect([...(await liveBuildShas(home))]).toEqual([]);
  });

  it("reports nothing to remove when there is nothing to remove", async () => {
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");
    expect(await pruneBuilds(home)).toEqual([]);
  });
});

describe("adopting an existing install", () => {
  /** A global install as npm leaves one: a package tree, and a bin symlink in
   * a directory on PATH. */
  async function fakeGlobal(): Promise<{ bin: string; tree: string }> {
    const prefix = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-global-"));
    const tree = path.join(prefix, "lib", "node_modules", "isocan");
    await fs.mkdir(path.join(tree, "packages", "cli", "bin"), { recursive: true });
    await fs.writeFile(path.join(tree, "package.json"), '{"name":"isocan"}');
    await fs.writeFile(path.join(tree, "packages", "cli", "bin", "isocan.js"), "// the old copy\n");
    await fs.mkdir(path.join(prefix, "bin"), { recursive: true });
    const bin = path.join(prefix, "bin", "isocan");
    await fs.symlink(path.join(tree, "packages", "cli", "bin", "isocan.js"), bin);
    return { bin, tree };
  }

  it("repoints PATH through current, and leaves the global copy where npm put it", async () => {
    const { bin, tree } = await fakeGlobal();
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");

    const adoption = await adoptGlobal(home, bin);
    expect(adoption).toMatchObject({ managed: true, moved: true });
    expect(await fs.readlink(bin)).toBe(
      path.join(paths.currentLink(home), "node_modules/isocan/packages/cli/bin/isocan.js"),
    );
    // The link resolves all the way through `current` into the build — which is
    // what makes `rootOfBin` name the build root, and `stalenessOf` able to
    // compare two builds by their directories.
    expect(await fs.realpath(bin)).toBe(
      await fs.realpath(
        path.join(paths.buildDir(home, "aaaaaaa"), "node_modules/isocan/packages/cli/bin/isocan.js"),
      ),
    );
    // Untouched, and still uninstallable by npm.
    expect(await fs.readFile(path.join(tree, "packages/cli/bin/isocan.js"), "utf8")).toBe(
      "// the old copy\n",
    );
  });

  it("is idempotent — a second upgrade does not report moving what is already there", async () => {
    const { bin } = await fakeGlobal();
    await makeBuild(paths.buildDir(home, "aaaaaaa"), "aaaaaaa");
    await flipTo(home, "aaaaaaa");
    await adoptGlobal(home, bin);
    const again = await adoptGlobal(home, bin);
    expect(again).toMatchObject({ managed: true, moved: false });
  });

  /** The conductor's machine. `npm link` puts a checkout on PATH, and this
   * machinery never modifies a working copy — the rule the whole project turns
   * on. */
  it("refuses a checkout on PATH and says whose it is", async () => {
    const prefix = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-linked-"));
    const checkout = path.join(prefix, "code", "isocan");
    await fs.mkdir(path.join(checkout, ".git"), { recursive: true });
    await fs.mkdir(path.join(checkout, "packages", "cli", "bin"), { recursive: true });
    const real = path.join(checkout, "packages", "cli", "bin", "isocan.js");
    await fs.writeFile(real, "// linked\n");
    await fs.mkdir(path.join(prefix, "bin"), { recursive: true });
    const bin = path.join(prefix, "bin", "isocan");
    await fs.symlink(real, bin);

    const adoption = await adoptGlobal(home, bin);
    expect(adoption.managed).toBe(false);
    expect(adoption.why).toContain("checkout");
    expect(await fs.readlink(bin)).toBe(real);
  });

  it("says so rather than throwing when isocan is on no PATH at all", async () => {
    const adoption = await adoptGlobal(home, null);
    expect(adoption).toMatchObject({ managed: false, moved: false });
    expect(adoption.why).toContain("not on your PATH");
  });
});
