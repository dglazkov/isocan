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
   * **The `types` conditions move to the compiled declarations** (iso-api
   * phase 4; every export since room phase 0). On main `"."` points at
   * `packages/api/src/index.ts` — right in a
   * checkout, where the workspace links let an editor follow `@isocan/core`.
   * An install has no workspace links, and tsserver refuses `.ts` sources
   * inside node_modules (TS5097) and cannot resolve the sibling packages
   * (TS2307) — measured 31 Aug, the turn design.md predicted. So the release
   * carries `types/` (emitTypes below) and ships the manifest aimed at it.
   */
  /**
   * **And the `browser` conditions move to the bundles** (room phase 4). On
   * main `./rc`'s `browser` names the source entry, which a bundler in the
   * checkout resolves through the workspace links. An install has no links,
   * and its `default` is `rc.mjs`, which registers tsx: a browser-platform
   * bundler that reaches it reads `node:module` and fails. So the release
   * carries the ESM bundle buildBrowserBundles writes, and the condition names
   * it. Spreading `entry` first keeps the keys in main's order, and order is
   * what a resolver reads: `types`, then `browser`, then `default`.
   */
  const exportsMap = rest.exports
    ? Object.fromEntries(
        Object.entries(rest.exports).map(([key, entry]) =>
          entry && typeof entry === "object"
            ? [
                key,
                {
                  ...entry,
                  ...(typeof entry.types === "string" ? { types: releasedTypesPath(entry.types) } : {}),
                  ...(typeof entry.browser === "string" ? { browser: releasedBrowserPath(entry.browser) } : {}),
                },
              ]
            : [key, entry],
        ),
      )
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
 * **Where an export's `types` condition points on the release branch.** Every
 * export key with a `types` entry is rewritten, not only `"."` (room phase 0
 * added `"./rc"`): `./packages/<ws>/src/<file>.ts` becomes
 * `./types/<ws>/src/<file>.d.ts`, the path emitTypes writes it to, because
 * `rootDir` is `./packages`. A `types` entry of any other shape is a manifest
 * this script does not know how to ship, and says so.
 */
export function releasedTypesPath(source) {
  const m = /^\.\/packages\/(.+)\.tsx?$/.exec(source);
  if (!m) throw new Error(`cannot map the types condition ${source} into types/ — expected ./packages/<ws>/src/<file>.ts`);
  return `./types/${m[1]}.d.ts`;
}

/**
 * **The browser bundles the release builds**, keyed by the source entry main's
 * `browser` condition names, valued by where the bundle lands in the release
 * tree. One today: `isocan/rc`, for a host with `fetch` and no Node (room
 * journey 3). Under `packages/rc/dist`, beside `packages/web/dist`, and like
 * it gitignored on main and force-added onto the release commit; `.npmignore`
 * does not drop `dist`, so an install carries it.
 */
export const RELEASE_BROWSER_BUNDLES = {
  "./packages/rc/src/index.ts": "./packages/rc/dist/index.mjs",
};

/** Where an export's `browser` condition points on the release branch. A
 * source entry with no bundle built for it is a manifest this script does not
 * know how to ship, and says so. */
export function releasedBrowserPath(source) {
  const bundle = RELEASE_BROWSER_BUNDLES[source];
  if (!bundle) throw new Error(`no browser bundle is built for ${source} — add it to RELEASE_BROWSER_BUNDLES`);
  return bundle;
}

/**
 * **Build every browser bundle** into `out` (the repo root by default, so the
 * paths in RELEASE_BROWSER_BUNDLES land where the manifest names them).
 *
 * esbuild, browser platform, ESM, everything inlined: `@isocan/core` and the
 * npm packages it reaches, because an installed tree has no workspace links
 * and a host's bundler must not need any. No `external`, so a `node:` import
 * anywhere in the closure fails this build rather than shipping. Not minified,
 * no sourcemap, and `absWorkingDir` is the repo, so the path comments esbuild
 * writes are repo-relative and a release commit's bundle changes only when
 * its sources do. Returns the files written.
 */
export async function buildBrowserBundles(out = root) {
  const { build } = await import("esbuild");
  const written = [];
  for (const [source, bundle] of Object.entries(RELEASE_BROWSER_BUNDLES)) {
    const outfile = path.join(out, bundle);
    await fs.rm(outfile, { force: true });
    await build({
      absWorkingDir: root,
      entryPoints: [path.join(root, source)],
      outfile,
      bundle: true,
      platform: "browser",
      format: "esm",
      minify: false,
      sourcemap: false,
      legalComments: "inline",
      logLevel: "warning",
    });
    written.push(outfile);
  }
  return written;
}

/**
 * The workspaces whose declarations the release compiles: api's public types
 * reach into core and server, and `isocan/rc`'s into core. A workspace named
 * by an export's `types` condition must be here, or its `.d.ts` never exists;
 * `test/packaging.test.ts` holds the two together.
 */
export const RELEASE_TYPE_ROOTS = ["packages/core/src", "packages/server/src", "packages/api/src", "packages/rc/src"];

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
 * So: one `tsc` declaration-only emit of RELEASE_TYPE_ROOTS, then a rewrite
 * of every emitted specifier into a form an installed tree can resolve —
 * `./x.ts` becomes `./x.js` (TypeScript maps that back to `x.d.ts`), and the
 * bare `@isocan/*` names and declared workspace subpaths become relative
 * paths within `types/` itself. The result is self-contained: no workspace,
 * no loader, no node_modules but the consumer's own.
 *
 * `types/` is deliberately NOT in `.gitignore`: npm's pack honors gitignore
 * for anything a `files` field does not claim, so ignoring it here would
 * strip it from every install — the tree would carry it and npm would not.
 * `main()` removes it after the release commit instead.
 */
export async function emitTypes(out = path.join(root, "types")) {
  await fs.rm(out, { recursive: true, force: true });
  // Beside the base config, so `extends` and `@types` resolve as they do for
  // every workspace; uniquely named, so a test's emit into a scratch `out`
  // never collides with a release's.
  const tsconfig = path.join(root, `tsconfig.release-types.${process.pid}.${Date.now()}.json`);
  await fs.writeFile(
    tsconfig,
    JSON.stringify(
      {
        extends: "./tsconfig.base.json",
        compilerOptions: {
          noEmit: false,
          emitDeclarationOnly: true,
          declaration: true,
          outDir: out,
          rootDir: "./packages",
          types: ["node"],
        },
        include: RELEASE_TYPE_ROOTS,
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
  await rewriteSpecifiers(out, await declarationTargets(out));
  const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  const shipped = releaseManifest(pkg).exports ?? {};
  for (const entry of Object.values(shipped)) {
    if (!entry || typeof entry !== "object" || typeof entry.types !== "string") continue;
    const declared = path.join(out, entry.types.replace(/^\.\/types\//, ""));
    await fs.access(declared).catch(() => {
      throw new Error(`no declarations at ${declared} — nothing for the manifest's types condition to name`);
    });
  }
  return out;
}

/** Manifest exports are the one map from workspace specifiers to emitted declarations. */
async function declarationTargets(out) {
  const targets = new Map();
  for (const sourceRoot of RELEASE_TYPE_ROOTS) {
    const workspace = path.dirname(sourceRoot);
    const manifest = JSON.parse(await fs.readFile(path.join(root, workspace, "package.json"), "utf8"));
    for (const [key, value] of Object.entries(manifest.exports ?? {})) {
      const source = typeof value === "string" ? value : value?.types;
      if (!/^\.\/src\/(?:[\w-]+\/)*[\w-]+\.tsx?$/.test(source ?? "") || key !== "." && !/^\.\/(?:[\w-]+\/)*[\w-]+$/.test(key)) throw new Error(`unsupported declaration export ${manifest.name}${key === "." ? "" : key.slice(1)} — expected a concrete ./src/*.ts target`);
      const specifier = `${manifest.name}${key === "." ? "" : key.slice(1)}`;
      const target = path.join(out, path.relative("packages", workspace), source.replace(/\.tsx?$/, ".d.ts"));
      await fs.access(target).catch(() => { throw new Error(`no emitted declaration for ${specifier}: ${target}`); });
      targets.set(specifier, target);
    }
  }
  return targets;
}

/** Rewrite every emitted declaration; an unmapped workspace import cannot ship unresolved. */
async function rewriteSpecifiers(dir, targets) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await rewriteSpecifiers(full, targets);
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;
    const relative = (declared) => {
      const target = path.relative(path.dirname(full), declared.replace(/\.d\.ts$/, ".js"));
      const posix = target.split(path.sep).join("/");
      return posix.startsWith(".") ? posix : `./${posix}`;
    };
    const text = await fs.readFile(full, "utf8");
    const rewritten = text
      .replace(/"(\.[^"]*)\.tsx?"/g, '"$1.js"')
      .replace(/"(@isocan\/[^"]+)"/g, (_quoted, specifier) => {
        const target = targets.get(specifier);
        if (!target) throw new Error(`unresolved workspace declaration ${specifier} in ${full}`);
        return `"${relative(target)}"`;
      });
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

  // And the third: the browser bundles a host with no Node resolves through
  // the manifest's `browser` conditions (room phase 4).
  const bundles = (await buildBrowserBundles()).map((file) => path.relative(root, file));

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-release-"));
  try {
    // A temporary index: HEAD's tree, plus dist (gitignored, hence -f), plus
    // the compiled types, plus a package.json that only exists on this branch.
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, "index") };
    git("read-tree", head, { env });
    git("add", "-f", "packages/web/dist", { env });
    git("add", "-f", "types", { env });
    for (const bundle of bundles) git("add", "-f", bundle, { env });
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
    // The bundles are gitignored, so they would be no noise; they go anyway,
    // because nothing on main resolves them and a stale one could mislead.
    for (const bundle of Object.values(RELEASE_BROWSER_BUNDLES)) {
      await fs.rm(path.join(root, bundle), { force: true });
      await fs.rmdir(path.dirname(path.join(root, bundle))).catch(() => {});
    }
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
