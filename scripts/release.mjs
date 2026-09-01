#!/usr/bin/env node
/**
 * Publish the `release` branch: this tree, plus the built web app, minus the
 * manifest keys that make npm's git installer choke.
 *
 * Why a branch at all. `npm i -g github:dglazkov/isocan` never worked, and the
 * error blamed something else (#47). npm's git fetcher decides a package
 * "needs preparation" when its manifest has any of `workspaces`, `prepare`,
 * `build`, `preinstall`, `install`, `postinstall` or `prepack`
 * (pacote/lib/git.js) — and then runs a nested `npm install` inside its
 * staging clone. That nested install inherits `npm_config_global` from the
 * outer `npm i -g`, so it installs globally instead of installing the clone's
 * deps: `lib/node_modules/isocan` ends up EMPTY, with a dangling `isocan` on
 * your PATH. A five-line package whose only script is `prepare` reproduces it.
 * We cannot fix npm from here, and we cannot keep those keys and be
 * installable — so the branch you install from carries none of them, and
 * carries the built app instead of a script that builds it.
 *
 * `main` stays sources-only. Everything that hands out an install spec points
 * at `#release` (INSTALL_SPEC in packages/cli/src/main.ts).
 *
 * CI runs this on every commit pushed to main
 * (.github/workflows/release.yml), which is how the branch stays current.
 * By hand, when you want a release before CI gets there:
 *
 *   npm run release              # build, commit onto release, push
 *   npm run release -- --no-push # ...stopping before the push
 *   npm run release -- --force   # skip the clean-tree / pushed-HEAD guards
 *
 * The commit is made with plumbing rather than a checkout: a temporary index
 * assembled from HEAD, so your working tree is never touched. It gets two
 * parents — the previous release tip and the main commit it was built from —
 * which keeps the branch fast-forwardable (no force pushes) and makes "which
 * commit is this build?" answerable by `git log`.
 */
import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

/** The keys pacote reads as "this package must be built before it can be used". */
export const PREPARATION_KEYS = [
  "workspaces",
  "scripts.prepare",
  "scripts.build",
  "scripts.preinstall",
  "scripts.install",
  "scripts.postinstall",
  "scripts.prepack",
];

/**
 * The manifest the release branch ships. Scripts go entirely: an installed
 * copy runs none of them, and half of them speak of workspaces this manifest
 * no longer declares. Dependencies stay — a git install resolves the root
 * package's deps, and that is how the CLI gets commander, fastify and tsx.
 */
export function releaseManifest(pkg, sourceCommit = "", builtAt = "") {
  const { workspaces, scripts, ...rest } = pkg;
  const built = sourceCommit ? ` from ${sourceCommit}` : "";
  /**
   * **The `types` condition moves to the compiled declarations** (iso-api
   * phase 4). On main it points at `packages/api/src/index.ts` — right in a
   * checkout, where the workspace links let an editor follow `@isocan/core`.
   * An install has no workspace links, and tsserver refuses `.ts` sources
   * inside node_modules (TS5097) and cannot resolve the sibling packages
   * (TS2307) — measured 31 Aug, the turn design.md predicted. So the release
   * carries `types/` (emitTypes below) and ships the manifest aimed at it.
   */
  const exportsMap = rest.exports?.["."]?.types
    ? { ...rest.exports, ".": { ...rest.exports["."], types: "./types/api/src/index.d.ts" } }
    : rest.exports;
  return {
    ...rest,
    ...(exportsMap ? { exports: exportsMap } : {}),
    /**
     * **What an installed copy knows about itself.** The tree npm hands out has
     * no `.git`, so without this a daemon on somebody's laptop cannot say which
     * build it is — and `version` cannot help, because every build says
     * `0.1.0`. `buildStamp()` reads exactly this key.
     *
     * Namespaced rather than spread as top-level fields: npm owns that
     * namespace, and a `commit` key of its own would one day silently win.
     */
    ...(sourceCommit || builtAt
      ? { isocan: { ...(sourceCommit ? { commit: sourceCommit } : {}), ...(builtAt ? { builtAt } : {}) } }
      : {}),
    "//": `GENERATED BRANCH — \`npm run release\` builds it${built} on main; develop there, not here. No \`workspaces\` and no scripts, deliberately: npm's git installer treats either as "needs preparation", and then installs this package into an empty directory (#47). The built web app is committed here for the same reason — there is no install-time build to make it.`,
  };
}

/**
 * **Compile the API's declarations into `types/`** — the release-time half of
 * `import { connect } from "isocan"` having types (iso-api phase 4).
 *
 * The sources stay the reference an editor JUMPS to; what it RESOLVES is this
 * tree, because a consumer's TypeScript cannot read the shipped `.ts` files:
 * it refuses `.ts`-extension imports inside node_modules without a flag no
 * consumer should need, and `@isocan/core` / `@isocan/server` are bare
 * specifiers with no node_modules to answer them in an installed tree.
 *
 * So: one `tsc` declaration-only emit of core, server and api (api's public
 * types reach into both), then a rewrite of every emitted specifier into a
 * form an installed tree can resolve — `./x.ts` becomes `./x.js` (TypeScript
 * maps that back to `x.d.ts`), and the two bare package names become relative
 * paths within `types/` itself. The result is self-contained: no workspace,
 * no loader, no node_modules but the consumer's own.
 *
 * `types/` is deliberately NOT in `.gitignore`: npm's pack honors gitignore
 * for anything a `files` field does not claim, so ignoring it here would
 * strip it from every install — the tree would carry it and npm would not.
 * `main()` removes it after the release commit instead.
 */
export async function emitTypes() {
  const out = path.join(root, "types");
  await fs.rm(out, { recursive: true, force: true });
  const tsconfig = path.join(root, "tsconfig.release-types.json");
  await fs.writeFile(
    tsconfig,
    JSON.stringify(
      {
        extends: "./tsconfig.base.json",
        compilerOptions: {
          noEmit: false,
          emitDeclarationOnly: true,
          declaration: true,
          outDir: "./types",
          rootDir: "./packages",
          types: ["node"],
        },
        include: ["packages/core/src", "packages/server/src", "packages/api/src"],
      },
      null,
      2,
    ) + "\n",
  );
  try {
    const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
    const done = spawnSync(tsc, ["-p", tsconfig], { cwd: root, stdio: "inherit" });
    if (done.status !== 0) throw new Error("tsc --emitDeclarationOnly failed — no types, no release");
  } finally {
    await fs.rm(tsconfig, { force: true });
  }
  await rewriteSpecifiers(out, out);
  const entry = path.join(out, "api", "src", "index.d.ts");
  await fs.access(entry).catch(() => {
    throw new Error(`no declarations at ${entry} — nothing for the manifest's types condition to name`);
  });
  return out;
}

/** The specifier rewrite emitTypes describes, over every `.d.ts` under `dir`. */
async function rewriteSpecifiers(dir, out) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await rewriteSpecifiers(full, out);
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;
    const relative = (pkg) => {
      const target = path.relative(path.dirname(full), path.join(out, pkg, "src", "index.js"));
      const posix = target.split(path.sep).join("/");
      return posix.startsWith(".") ? posix : `./${posix}`;
    };
    const text = await fs.readFile(full, "utf8");
    const rewritten = text
      .replace(/"(\.[^"]*)\.ts"/g, '"$1.js"')
      .replace(/"@isocan\/core"/g, `"${relative("core")}"`)
      .replace(/"@isocan\/server"/g, `"${relative("server")}"`);
    if (rewritten !== text) await fs.writeFile(full, rewritten);
  }
}

const git = (...args) => {
  const opts = typeof args.at(-1) === "object" ? args.pop() : {};
  const done = spawnSync("git", args, { cwd: root, encoding: "utf8", ...opts });
  if (done.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(done.stderr || "").trim()}`);
  }
  return (done.stdout || "").trim();
};

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const push = !args.includes("--no-push");

  // A release names the commit it was built from, so that commit has to be
  // real: not your unsaved edits, and not a commit only this laptop has.
  if (!force) {
    const dirty = git("status", "--porcelain");
    if (dirty && !process.env.CI) {
      throw new Error(
        `working tree is dirty — commit or stash first (--force to override):\n${dirty}`,
      );
    }
    if (dirty) {
      // On a runner the tree IS the commit: the dirt is whatever `npm ci`
      // churned, and none of it can reach the release — everything below
      // comes from HEAD, except the built app, which is the point.
      console.error(`release: ignoring a dirty tree on CI:\n${dirty}`);
    }
    if (!git("branch", "-r", "--contains", "HEAD")) {
      throw new Error("HEAD is not on any remote — push it first (--force to override)");
    }
  }

  const head = git("rev-parse", "HEAD");
  const subject = git("log", "-1", "--pretty=%s");

  // The one thing the release branch has that main doesn't.
  const build = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) throw new Error("npm run build failed");
  const dist = path.join(root, "packages/web/dist/index.html");
  await fs.access(dist).catch(() => {
    throw new Error(`no web app at ${dist} — nothing to release`);
  });

  // The other build only a release has: the API's declarations, compiled so
  // an editor on an installed copy can answer what `connect()` returns.
  await emitTypes();

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-release-"));
  try {
    // A temporary index: HEAD's tree, plus dist (gitignored, hence -f), plus
    // the compiled types, plus a package.json that only exists on this branch.
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, "index") };
    git("read-tree", head, { env });
    git("add", "-f", "packages/web/dist", { env });
    git("add", "-f", "types", { env });
    /**
     * **`.github/` does not ship.**
     *
     * Two reasons, and the second is why this is here rather than a tidy-up.
     * Nobody installing isocan needs our CI, and a fork of the release branch
     * would inherit a nightly grader and a changelog job aimed at a repository
     * that is not theirs. And on 29 Aug this push was rejected outright —
     * "refusing to allow a GitHub App to create or update workflow ... without
     * `workflows` permission" — because the tree carried `.github/workflows/`
     * and the commit had changed it. No `permissions:` key grants that scope.
     * A tree with no workflow files in it cannot be a workflow change, which
     * is why this is a fix and not a hope.
     */
    git("rm", "-r", "--cached", "--ignore-unmatch", "-q", ".github", { env });

    // From HEAD, not from disk: a release is of a commit, so nothing an
    // install left lying in the working tree can end up in the manifest.
    const pkg = JSON.parse(git("show", `${head}:package.json`));
    const manifest = path.join(tmp, "package.json");
    await fs.writeFile(
      manifest,
      JSON.stringify(
        releaseManifest(pkg, head.slice(0, 7), git("log", "-1", "--pretty=%cI", head)),
        null,
        2,
      ) + "\n",
    );
    const blob = git("hash-object", "-w", "--path", "package.json", manifest, { env });
    git("update-index", "--add", "--cacheinfo", `100644,${blob},package.json`, { env });
    const tree = git("write-tree", { env });

    // First parent: where the branch was. Second: the commit this build is of.
    const previous =
      tryGit("rev-parse", "--verify", "--quiet", "refs/remotes/origin/release") ||
      tryGit("rev-parse", "--verify", "--quiet", "refs/heads/release");
    const parents = [...(previous ? ["-p", previous] : []), "-p", head];
    const message = `release ${head.slice(0, 7)}: ${subject}\n\nBuilt web app included; no prepare script, no workspaces (#47).\n`;
    const commit = git("commit-tree", tree, ...parents, "-m", message);
    git("update-ref", "refs/heads/release", commit, "-m", `release from ${head.slice(0, 7)}`);

    console.error(`release: ${commit.slice(0, 7)} built from ${head.slice(0, 7)} (${subject})`);
    if (push) {
      git("push", "origin", "release:release", { stdio: "inherit" });
      console.error("release: pushed — `npm i -g github:dglazkov/isocan#release`");
    } else {
      console.error("release: not pushed — `git push origin release:release` when ready");
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
    // The emitted declarations were for the release commit, not for main's
    // working tree — and they cannot be gitignored (see emitTypes), so they
    // are cleaned up rather than left as untracked noise.
    await fs.rm(path.join(root, "types"), { recursive: true, force: true });
  }
}

function tryGit(...args) {
  const done = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return done.status === 0 ? (done.stdout || "").trim() : "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`release: ${err.message}`);
    process.exit(1);
  });
}
