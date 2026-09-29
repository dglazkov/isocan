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
import { promises as fs, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

/**
 * **The only dependencies the release branch declares**, each with the reason
 * it survived the bundling (phase 2 of `docs/projects/first-minute`).
 *
 * Everything else — fastify, the MCP SDK, zod, the remark stack, css-tree,
 * parse5, undici, ws, nanoid, commander, and tsx, which was only ever there
 * because the CLI shipped as source — is inside `packages/cli/dist`. A git
 * install used to resolve 19 declared dependencies into 227 packages; this
 * makes it two.
 *
 * A name here that main does not depend on fails the build rather than
 * shipping a manifest that asks for something nobody declares.
 */
export const RELEASE_DEPENDENCIES = {
  "@types/node": "not code: the types an editor needs to read what `connect()` returns, beside the declarations in types/",
};

/**
 * **The scripts an installed copy can still spawn**, keyed by the path the CLI
 * spawns (`packagePath("scripts/canvas-shot.mjs")` in packages/cli/src/main.ts),
 * valued by the name of the bundle `buildCliBundle` builds from that file.
 *
 * They are BUNDLED, like the CLI, and the path the CLI spawns is a one-line
 * stub importing the bundle (cleanup phase 4, DC-1, 27 Sep 2026). They used to
 * ship as their sources, beside `scripts/lib/browser.mjs` — but
 * `canvas-shot.mjs` imports `@isocan/*` and a `.ts` file through the
 * checkout's loader, and `browser.mjs` imports `ws`, none of which a release
 * tree has carried since 18 Sep. So `isocan canvas shot` and every PDF export
 * died with ERR_MODULE_NOT_FOUND on every install, the CLI's `existsSync`
 * guard never fired because the files WERE there, and Chrome, spawned before
 * `ws` was imported, was left running. Bundled, they carry what they import.
 * The other forty scripts import a package's `src` directly and would be
 * broken files on a branch that ships no sources, so they go.
 */
export const RELEASE_SCRIPTS = {
  "scripts/canvas-shot.mjs": "canvas-shot",
  "scripts/deck-export.mjs": "deck-export",
};

/** Where their bundles land, under CLI_BUNDLE_DIR — a directory of their own, because they are a build of their own (see buildCliBundle). */
const RELEASE_SCRIPTS_DIR = "scripts";

/**
 * **What the release tree drops**, as git pathspecs — one entry per `git rm
 * -r --cached` call, so an entry can carry its own exclusions.
 */
export const RELEASE_DROPS = [
  ["docs"],
  ["test"],
  [":(glob)packages/**/test/**"],
  // The web app's build inputs. `dist` is what a daemon serves; `public/` is
  // what vite copied into it, 1.4 MB of the same pictures twice.
  ["packages/web/public", "packages/web/src", "packages/web/index.html", "packages/web/vite.config.ts"],
  // This repository's own workings. The image is built from `green`, never
  // from here — `cloudbuild.yaml` says so itself — so the deploy files are as
  // inert on this branch as the personas and the eval corpus.
  [".claude", "AGENTS.md", "evals", "scratch", "infra", "Dockerfile", "cloudbuild.yaml", ".dockerignore"],
  // Configuration for tools an install does not have: the linter, the suite,
  // the TypeScript project files. `types/` is what an editor resolves, and it
  // stays.
  ["eslint.config.js", "vitest.config.ts", "tsconfig.base.json", "md.d.ts", ":(glob)packages/**/tsconfig.json"],
  // A lock for 227 packages this manifest no longer asks for. npm resolves a
  // git dependency against the consumer's tree, never the package's own lock,
  // so this was always inert — and now it would also be untrue.
  ["package-lock.json"],
  // The sources themselves, now that nothing resolves them. `.md` beside them
  // survives the glob, which is how the modules keep their guides.
  [":(glob)packages/**/src/**/*.ts", ":(glob)packages/**/src/**/*.tsx"],
  // The tsx launcher and the loader it registered: main's way in, and dead on
  // a branch whose `bin` is a bundle.
  ["packages/cli/bin"],
  // Every script, the two the CLI spawns included: what stands at their paths
  // on the release is a generated stub importing their bundle (RELEASE_SCRIPTS).
  ["scripts"],
  // The voice agent's launcher registers tsx and imports `../src/cli.ts`,
  // neither of which the release carries — a broken file nothing on an
  // install runs (the root `bin` is the CLI's alone). Found by the tree's
  // import check on its first run (cleanup phase 4, TR-4, 27 Sep 2026).
  ["packages/voice-agent/bin"],
];

/**
 * The survivors, at the ranges main declares. A name here that main does not
 * depend on fails the build rather than shipping a manifest asking for
 * something nobody declares — unless the caller passed no dependencies at
 * all, which is a stub manifest in a test and has nothing to be wrong about.
 */
export function releaseDependencies(declared) {
  if (!declared) return {};
  return Object.fromEntries(
    Object.entries(RELEASE_DEPENDENCIES).map(([name, why]) => {
      const range = declared[name];
      if (!range) throw new Error(`${name} is a release dependency (${why}) but main does not declare it`);
      return [name, range];
    }),
  );
}

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
  /**
   * **The release's `bin` is the bundle** (`docs/projects/first-minute`,
   * change 1). On main it is `packages/cli/bin/isocan.js`, which registers tsx
   * and imports 297 `.ts` files through it — 0.38 s on a laptop and seconds in
   * a hosted sandbox, on a command as small as `--version`. The release ships
   * `packages/cli/dist/isocan.mjs` instead, built by `buildCliBundle` and
   * committed here like the web app.
   *
   * Nothing else in the tree has to change place: `dist/` sits at the same
   * depth `bin/` did, which is what `rootOfBin()` counts, and `packageBin()`
   * in `@isocan/core/packageroot` reads THIS key rather than assuming either
   * layout, so a daemon spawned from an install starts the file that install
   * actually has.
   */
  /**
   * **And the release resolves nothing** (phase 2). Every npm dependency is
   * inlined into the bundles above, so declaring them would make an install
   * fetch 227 packages and 75 MB it never opens — 35 s in the sandbox of
   * #332, and the single largest thing between an agent and her first reply.
   *
   * `RELEASE_DEPENDENCIES` names the survivors and why each one survived, and
   * it is a list rather than a filter because "which of these is still real"
   * is a question somebody has to answer on purpose.
   */
  return {
    ...rest,
    ...(exportsMap ? { exports: exportsMap } : {}),
    bin: { isocan: CLI_BUNDLE },
    dependencies: releaseDependencies(pkg.dependencies),
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
 * **The release CLI is one bundled file** (`docs/projects/first-minute`,
 * change 1), and this is where it is built and where it lands.
 *
 * `packages/cli/dist/isocan.mjs`, and the directory depth is not an accident:
 * `rootOfBin()` in `packages/cli/src/onpath.ts` finds a copy's root by going
 * three up from its bin, and `dist/` sits exactly where `bin/` did.
 */
export const CLI_BUNDLE = "./packages/cli/dist/isocan.mjs";

/** The directory the bundle and its chunks live in; emptied before each build. */
export const CLI_BUNDLE_DIR = "./packages/cli/dist";

/**
 * **The other two entries the release has to build** (phase 2), and why they
 * are here rather than left alone.
 *
 * `index.mjs` and `rc.mjs` at the repo root are `import { connect } from
 * "isocan"` and `from "isocan/rc"`. On main each registers tsx and the
 * workspace loader and then imports `@isocan/api` from SOURCE — which worked
 * only because the release branch shipped the sources. Phase 2 drops them, so
 * those two entries would have become imports of files that are not there.
 *
 * They are built in the same esbuild invocation as the CLI so that all three
 * share one set of chunks: built separately they would each inline core and
 * the api again, three copies of the same megabytes. The root `index.mjs` and
 * `rc.mjs` the release commits are then one line each, re-exporting these.
 */
export const RELEASE_NODE_ENTRIES = {
  "index.mjs": { entry: "packages/api/src/index.ts", out: "api" },
  "rc.mjs": { entry: "packages/rc/src/index.ts", out: "rc" },
};

/**
 * **What a bundle must not swallow.** `@isocan/cloudstore` is reached by
 * `import("@isocan/cloudstore")` inside `daemon.ts` precisely so that its 156
 * packages and 43 MiB never touch a CLI install (`test/packaging.test.ts`
 * guards both directions). esbuild follows a static `import()` specifier, so
 * without this line the first bundle built here pulled in
 * @google-cloud/firestore and @google-cloud/storage — 1.7 MB of generated
 * protobuf in the largest single input — and quietly undid that.
 */
export const CLI_BUNDLE_EXTERNAL = ["@isocan/cloudstore"];

/**
 * **A `require` for the CommonJS half of the dependency tree** (phase 2).
 *
 * fastify, avvio, ajv and the remark stack are CJS. esbuild rewrites their
 * `require()` calls into its own shim, and that shim falls back to a real
 * `require` for anything it could not resolve at build time — `require("node:events")`
 * among them. In an ESM output there is no `require` to fall back to, so the
 * first fully-inlined bundle died on its first command with *Dynamic require
 * of "node:events" is not supported*. `createRequire` gives it one.
 *
 * It goes on every chunk, because any chunk may hold a CJS module, and a
 * const at module scope in each is harmless.
 */
const CJS_SHIM = [
  'import { createRequire as __isocanCreateRequire } from "node:module";',
  "const require = __isocanCreateRequire(import.meta.url);",
].join("\n");

/**
 * **Build the release CLI bundle** into `out` (the repo root by default).
 *
 * node platform, ESM, not minified: these files are read by people debugging
 * an install, and the win being chased is file opens, not bytes. npm
 * **Nothing is external but `@isocan/cloudstore`** (phase 2). The npm
 * dependencies are inlined, so the release manifest declares none of them and
 * an install has nothing to resolve: 227 packages became two. The cost is one
 * banner — see CJS_SHIM — because half the dependency tree is CommonJS and
 * esbuild's `require` shim needs a real `require` to fall back to.
 *
 * **Split, not one file, and the number says why.** Bundled into a single
 * output `isocan --version` loaded 538 modules — MORE than source mode's 437.
 * esbuild hoists an inlined module's external imports to the top of the file
 * it lands in, so every `await import("./design-system.ts")` in the CLI
 * dragged fastify, the MCP SDK, ajv and the remark stack into startup. The
 * laziness the source already has is worth keeping, so `splitting` keeps each
 * dynamic import its own chunk: 142 modules and 0.20 s against source mode's
 * 437 and 0.38 s. Phase 3 moves more behind `import()`; this makes that
 * effort count instead of cancelling it.
 *
 * `@isocan/*` resolves through `bin/workspace-loader.mjs`'s own map, called
 * here rather than copied: there is one answer to "where does `@isocan/core`
 * live", and a second copy of it would drift. A `.md` import is its text,
 * which is how the guides survive being folded into files nowhere near them.
 */
export async function buildCliBundle(out = root) {
  const { build } = await import("esbuild");
  const { resolve: resolveWorkspace } = await import(
    pathToFileURL(path.join(root, "packages/cli/bin/workspace-loader.mjs")).href
  );
  const outdir = path.join(out, CLI_BUNDLE_DIR);
  const outfile = path.join(out, CLI_BUNDLE);
  await fs.rm(outdir, { recursive: true, force: true });
  const common = {
    absWorkingDir: root,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    splitting: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: CLI_BUNDLE_EXTERNAL,
    banner: { js: CJS_SHIM },
    loader: { ".md": "text" },
    minify: false,
    sourcemap: false,
    legalComments: "inline",
    logLevel: "warning",
    metafile: true,
    plugins: [
      {
        name: "isocan-workspaces",
        setup(build) {
          build.onResolve({ filter: /^@isocan\// }, (args) => {
            if (CLI_BUNDLE_EXTERNAL.includes(args.path)) return { external: true };
            const { url } = resolveWorkspace(args.path, {}, (u) => ({ url: u }));
            return url.startsWith("file:") ? { path: fileURLToPath(url) } : null;
          });
          // A script's `import "../index.mjs"` is the checkout's way in: it
          // registers tsx and the workspace loader so the `@isocan/*` imports
          // after it resolve. The bundle resolved every one of them above, at
          // build time, and must not carry tsx to register — so here that
          // import is empty (DC-1).
          build.onResolve({ filter: /index\.mjs$/ }, (args) =>
            path.resolve(args.resolveDir, args.path) === path.join(root, "index.mjs")
              ? { path: "checkout-loader", namespace: "isocan-empty" }
              : null,
          );
          build.onLoad({ filter: /.*/, namespace: "isocan-empty" }, () => ({ contents: "", loader: "js" }));
        },
      },
    ],
  };
  const result = await build({
    ...common,
    // Named, so the entry is `isocan.mjs` and not `main.mjs` — the manifest's
    // `bin` points at it and a person reading `ps` should see the CLI's name.
    entryPoints: [
      { in: path.join(root, "packages/cli/src/main.ts"), out: "isocan" },
      ...Object.values(RELEASE_NODE_ENTRIES).map(({ entry, out: name }) => ({
        in: path.join(root, entry),
        out: name,
      })),
    ],
    outdir,
  });
  /**
   * **The scripts a CLI verb spawns, in a build of their own** (DC-1).
   *
   * Not beside the CLI's entries, though sharing its chunks would be smaller:
   * measured 27 Sep, two more entries in that build re-cut the CLI's chunks
   * along new boundaries and `isocan --version` went from 38 modules to 42,
   * past the budget `test/cli-bundle.test.ts` holds. A screenshot that is
   * taken now and then does not get to slow down every command.
   */
  await build({
    ...common,
    entryPoints: Object.entries(RELEASE_SCRIPTS).map(([file, name]) => ({ in: path.join(root, file), out: name })),
    outdir: path.join(outdir, RELEASE_SCRIPTS_DIR),
  });
  // The shebang goes on the CLI entry alone; esbuild's `banner` would put one
  // at the top of all forty chunks, where it means nothing.
  const entry = await fs.readFile(outfile, "utf8");
  await fs.writeFile(outfile, `#!/usr/bin/env node\n${entry}`);
  await fs.chmod(outfile, 0o755);
  return { outfile, outdir, metafile: result.metafile };
}

/**
 * **What the release's `index.mjs` and `rc.mjs` say**: one line each, pointing
 * at the bundle built beside the CLI. `export *` rather than main's named list
 * because there is no loader to register first and therefore nothing to defer
 * — the reason that list exists at all.
 */
export function nodeEntrySource(out) {
  return (
    "// GENERATED by scripts/release.mjs. main's entry of this name registers\n" +
    "// tsx and imports the sources, which the release branch no longer ships.\n" +
    `export * from "${CLI_BUNDLE_DIR}/${out}.mjs";\n`
  );
}

/**
 * **What a spawned script's path holds on the release** (DC-1): one line,
 * importing the bundle `buildCliBundle` built from it. The CLI spawns the same
 * `scripts/<name>.mjs` in a checkout and in an install; only what is there
 * differs.
 */
export function scriptEntrySource(file, out) {
  const target = path.posix.relative(path.posix.dirname(file), path.posix.join(path.posix.normalize(CLI_BUNDLE_DIR), RELEASE_SCRIPTS_DIR, `${out}.mjs`));
  return (
    `// GENERATED by scripts/release.mjs. main's ${path.posix.basename(file)} imports what a\n` +
    "// checkout has beside it; the release ships the bundle built from it.\n" +
    `import "${target}";\n`
  );
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

/**
 * **Build everything a release has that main does not**, into `out` — a
 * scratch directory, never the checkout (cleanup phase 4, TR-4, 27 Sep 2026).
 *
 * The web app, the API's declarations, the browser bundles and the CLI's. It
 * used to build them into the repository itself and delete them afterwards,
 * which is harmless once and a race the moment a test builds a release tree
 * while another test serves `packages/web/dist`: vite empties its outDir
 * first. Built aside, the checkout is never touched — which the header above
 * always claimed and this is what makes true.
 *
 * Returns the paths, relative to `out`, that the release tree carries from it.
 */
export async function buildReleaseArtifacts(out) {
  const web = path.join(out, "packages/web/dist");
  // The one thing the release branch has that main doesn't. The workspace's
  // own `vite build`, aimed aside; `--emptyOutDir` because vite refuses to
  // empty a directory outside its project without being told to.
  const build = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build", "-w", "@isocan/web", "--", "--outDir", web, "--emptyOutDir"],
    { cwd: root, stdio: "inherit" },
  );
  if (build.status !== 0) throw new Error("the web app's build failed");
  await fs.access(path.join(web, "index.html")).catch(() => {
    throw new Error(`no web app at ${web} — nothing to release`);
  });

  // The other build only a release has: the API's declarations, compiled so
  // an editor on an installed copy can answer what `connect()` returns.
  await emitTypes(path.join(out, "types"));

  // And the third: the browser bundles a host with no Node resolves through
  // the manifest's `browser` conditions (room phase 4).
  const bundles = (await buildBrowserBundles(out)).map((file) => path.relative(out, file));

  // The fourth, and the one an agent waits on: the CLI itself, bundled, so an
  // installed copy starts without tsx and without 297 source files.
  await buildCliBundle(out);

  return ["packages/web/dist", "types", path.normalize(CLI_BUNDLE_DIR), ...bundles];
}

/**
 * **The release tree, as a git tree object**: `base` (a commit or a tree),
 * plus the `artifacts` built into `out`, minus RELEASE_DROPS and `.github`,
 * plus the generated entries and the release manifest. Nothing is committed
 * and no ref moves; `main()` does that with the hash this returns, and the
 * guard in `test/release-tree.test.ts` extracts it and reads what it ships.
 */
export async function assembleReleaseTree({ base, out, artifacts, sourceCommit = "", builtAt = "" }) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-release-index-"));
  try {
    // A temporary index: the base tree, plus the built artifacts (gitignored,
    // hence -f, and added from `out` as a work tree of its own), plus a
    // package.json that only exists on this branch.
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, "index") };
    git("read-tree", base, { env });
    const gitDir = git("rev-parse", "--absolute-git-dir");
    for (const artifact of artifacts) {
      git(`--git-dir=${gitDir}`, `--work-tree=${out}`, "add", "-f", "--", artifact, { env, cwd: out });
    }
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

    /**
     * **And everything else an install never runs** (phase 2).
     *
     * `docs/` alone is 15 MB of the 40 the branch carried, and `npm i -g`
     * writes every byte of it to a sandbox's cold disk. The sources go for a
     * stronger reason than size: after the bundling above nothing resolves
     * them, so a `.ts` file on the release branch is a second copy of the CLI
     * that can silently disagree with the one that runs.
     *
     * What stays is what something reaches for: `packages/web/dist` (the app
     * a daemon serves), `packages/rc/dist` and `packages/cli/dist` (the
     * bundles), `types/` (what an editor resolves), the modules' `assets/`
     * and `agent-guide.md`, `.agents/skills` (which `isocan setup` copies out),
     * `plugins/jetski` (which `isocan setup --jetski` links out), `WHATSNEW.md`,
     * and the scripts a CLI verb can spawn.
     */
    for (const spec of RELEASE_DROPS) {
      git("rm", "-r", "--cached", "--ignore-unmatch", "-q", ...spec, { env });
    }
    const generatedEntries = [
      ...Object.entries(RELEASE_NODE_ENTRIES).map(([file, { out: name }]) => [file, nodeEntrySource(name)]),
      ...Object.entries(RELEASE_SCRIPTS).map(([file, name]) => [file, scriptEntrySource(file, name)]),
    ];
    for (const [i, [file, source]] of generatedEntries.entries()) {
      const generated = path.join(tmp, `entry-${i}.mjs`);
      await fs.writeFile(generated, source);
      const hash = git("hash-object", "-w", "--path", file, generated, { env });
      git("update-index", "--add", "--cacheinfo", `100644,${hash},${file}`, { env });
    }

    // From the base, not from disk: a release is of a commit, so nothing an
    // install left lying in the working tree can end up in the manifest.
    const pkg = JSON.parse(git("show", `${base}:package.json`));
    const manifest = path.join(tmp, "package.json");
    await fs.writeFile(manifest, JSON.stringify(releaseManifest(pkg, sourceCommit, builtAt), null, 2) + "\n");
    const blob = git("hash-object", "-w", "--path", "package.json", manifest, { env });
    git("update-index", "--add", "--cacheinfo", `100644,${blob},package.json`, { env });
    return git("write-tree", { env });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/**
 * **The working tree as a git tree object** — tracked files as they are on
 * disk, plus untracked ones `.gitignore` does not hide — so a test can
 * assemble the release of the change in front of it rather than of the last
 * commit. Written with a throwaway index; nothing is committed.
 */
export async function worktreeTree() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-worktree-index-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: path.join(tmp, "index") };
    git("read-tree", "HEAD", { env });
    git("add", "-A", { env });
    return git("write-tree", { env });
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/** Write a tree (or commit) into `dir` as files, the way an install lays it out. */
export async function extractTree(tree, dir) {
  const tar = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "isocan-release-tar-")), "tree.tar");
  try {
    git("archive", "--format=tar", "-o", tar, tree);
    await fs.mkdir(dir, { recursive: true });
    const done = spawnSync("tar", ["-xf", tar, "-C", dir], { encoding: "utf8" });
    if (done.status !== 0) throw new Error(`tar -xf failed: ${(done.stderr || "").trim()}`);
  } finally {
    await fs.rm(path.dirname(tar), { recursive: true, force: true });
  }
  return dir;
}

/**
 * **Every import in a shipped tree that nothing in that tree can satisfy**
 * (cleanup phase 4, TR-4, 27 Sep 2026).
 *
 * The release used to be checked by its drop LIST — "docs is dropped, test is
 * dropped" — and never by what the list left behind. So on 18 Sep the
 * sources went and three files that imported them stayed, and every install
 * carried an `isocan canvas shot` that died with ERR_MODULE_NOT_FOUND for
 * nine days. This reads the tree instead: every `.js`/`.mjs` file in `dir`,
 * every static import and every `import()` of a literal, resolved the way an
 * install would resolve it.
 *
 * - relative paths must name a file in the tree (ESM names its extension);
 * - `/…` paths, in the web app, name a file under the app's root;
 * - `node:` and the other builtins, and URLs (`data:`, `https:`), resolve;
 * - the package's own name resolves through its `exports`;
 * - a bare name resolves if the manifest declares it (npm installs it) or it
 *   is CLI_BUNDLE_EXTERNAL — imported by the hosted daemon alone, from an
 *   image that installs it; everything else is unresolvable.
 *
 * `esbuild` does the reading, with every import marked external, so each file
 * is parsed once and nothing is followed or bundled. `require()` is left out
 * on purpose: the bundles' CommonJS half carries optional requires inside
 * `try` (ws's `bufferutil`), which are not imports and would be noise.
 * An `import()` of a computed string cannot be read, and is not.
 *
 * Returns `[{ file, specifier }]`, paths relative to `dir`; empty is the pass.
 */
export async function unresolvedImports(dir) {
  const { build } = await import("esbuild");
  const { isBuiltin } = await import("node:module");
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "package.json"), "utf8"));
  const files = [];
  const walk = async (at) => {
    for (const entry of await fs.readdir(at, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.m?js$/.test(entry.name)) files.push(full);
    }
  };
  await walk(dir);
  if (files.length === 0) return [];

  const seen = [];
  await build({
    entryPoints: files,
    bundle: true,
    write: false,
    outdir: path.join(dir, ".unresolved-imports"),
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
    plugins: [
      {
        name: "record-imports",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") return undefined;
            if (args.kind === "import-statement" || args.kind === "dynamic-import") {
              seen.push({ importer: args.importer, specifier: args.path });
            }
            return { path: args.path, external: true };
          });
        },
      },
    ],
  });

  const isFile = (file) => {
    try {
      return statSync(file).isFile();
    } catch {
      return false;
    }
  };
  const web = path.join(dir, "packages/web/dist");
  const jetskiPlugin = path.join(dir, "plugins/jetski");
  const selfReference = (subpath) => {
    const entry = manifest.exports?.[subpath];
    const target = typeof entry === "string" ? entry : (entry?.import ?? entry?.default);
    return typeof target === "string" && isFile(path.join(dir, target));
  };
  const resolves = ({ importer, specifier }) => {
    const bare = specifier.split(/[?#]/)[0];
    if (isBuiltin(bare)) return true;
    if (/^[a-z][a-z0-9+.-]*:/i.test(bare)) return !bare.startsWith("node:") && !bare.startsWith("file:");
    if (bare.startsWith("./") || bare.startsWith("../")) return isFile(path.resolve(path.dirname(importer), bare));
    if (bare.startsWith("/")) return importer.startsWith(web + path.sep) && isFile(path.join(web, bare));
    const parts = bare.split("/");
    const name = bare.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    const subpath = [".", ...parts.slice(bare.startsWith("@") ? 2 : 1)].join("/");
    if (name === manifest.name) return selfReference(subpath);
    if (CLI_BUNDLE_EXTERNAL.includes(name)) return true;
    // The Jetski sidecar runs inside the Jetski host, which puts `sidecar_sdk`
    // on NODE_PATH when spawning the pane; standalone (`ISOCAN_JETSKI_PORT`)
    // that branch does not run.
    if (name === "sidecar_sdk" && importer.startsWith(jetskiPlugin + path.sep)) return true;
    return Boolean(manifest.dependencies?.[name]);
  };
  const unresolved = new Map();
  for (const found of seen) {
    if (resolves(found)) continue;
    const file = path.relative(dir, found.importer).split(path.sep).join("/");
    unresolved.set(`${file}\0${found.specifier}`, { file, specifier: found.specifier });
  }
  return [...unresolved.values()].sort((a, b) => a.file.localeCompare(b.file) || a.specifier.localeCompare(b.specifier));
}

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

  const out = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-release-"));
  try {
    const artifacts = await buildReleaseArtifacts(out);
    const tree = await assembleReleaseTree({
      base: head,
      out,
      artifacts,
      sourceCommit: head.slice(0, 7),
      builtAt: git("log", "-1", "--pretty=%cI", head),
    });

    // **Read what is about to ship before shipping it** (TR-4). A file that
    // imports something the tree does not carry is a broken command on every
    // install, and the release is the last place that can still refuse it.
    const shipped = await extractTree(tree, path.join(out, "tree"));
    const unresolved = await unresolvedImports(shipped);
    if (unresolved.length > 0) {
      throw new Error(
        `the release tree imports what it does not carry — nothing was committed:\n` +
          unresolved.map(({ file, specifier }) => `  ${file} → ${specifier}`).join("\n"),
      );
    }

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
    // Everything built lives in `out`; the checkout was never written to.
    await fs.rm(out, { recursive: true, force: true });
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
