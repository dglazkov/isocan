import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * The repo is the package: `npx github:dglazkov/isocan#release` and
 * `npm i -g github:dglazkov/isocan#release` install this tree directly, no
 * registry involved (#42). Everything that makes that work was learned the
 * hard way — this file remembers it.
 */

const repo = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (rel: string) =>
  JSON.parse(await fs.readFile(path.join(repo, rel), "utf8"));

describe("installable straight from git", () => {
  it("the root package is the CLI's bin, and declares only what its own files import", async () => {
    const pkg = await readJson("package.json");
    expect(pkg.bin?.isocan).toBe("packages/cli/bin/isocan.js");
    /**
     * **Not a copy of the CLI's dependencies any more** (cleanup phase 4,
     * DC-2, 27 Sep 2026). That copy existed because a git install of `main`
     * resolves the root package's dependencies only — and git installs of
     * `main` stopped: npm installs an empty directory from it (#47), and the
     * release branch's bundled CLI declares none of them. Kept, the copy was
     * nine packages nothing at the root imports, each one a second place a
     * range could drift.
     *
     * So a root dependency is here because a root file imports it, because
     * the release manifest declares it, or because it is named below with why.
     */
    // @ts-expect-error — a plain .mjs module with no types.
    const { RELEASE_DEPENDENCIES } = await import("../scripts/release.mjs");
    const kept: Record<string, string> = {
      "@types/css-tree":
        "dropping it makes it dev-only in the lockfile, and the Dockerfile's `npm prune --omit=dev` would take it out of the home image",
    };
    const { withoutComments } = await import("./source.ts");
    // The root's own files: everything outside the workspaces, their builds,
    // node_modules, and the dot-directories (worktrees live under `.claude`).
    const rootFiles: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (full !== path.join(repo, "packages")) await walk(full);
        } else if (/\.(m?js|cjs|tsx?)$/.test(entry.name)) rootFiles.push(full);
      }
    };
    await walk(repo);
    const code = (await Promise.all(rootFiles.map((file) => fs.readFile(file, "utf8"))))
      .map(withoutComments)
      .join("\n");
    const imported = (name: string) =>
      new RegExp(`(?:from|import\\(|require\\()\\s*["'\`]${name.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(?:["'\`/])`).test(code);
    const unexplained = Object.keys(pkg.dependencies).filter(
      (name) => !imported(name) && !(name in RELEASE_DEPENDENCIES) && !(name in kept),
    );
    expect(unexplained, "declared at the root, imported by nothing at the root").toEqual([]);
    // And a name kept on purpose is still a root dependency — a stale
    // exception is a rule nobody can read.
    for (const name of Object.keys(kept)) expect(pkg.dependencies).toHaveProperty(name);
  });

  it("every workspace declares its runtime imports and carries no unused dependencies", async () => {
    const { withoutComments } = await import("./source.ts");
    const moduleDir = path.join(repo, "packages/modules");
    const moduleNames = new Set(
      await Promise.all(
        (await fs.readdir(moduleDir)).map(async (d) => {
          const p = path.join(moduleDir, d, "package.json");
          return (await fs.stat(p).then(() => true, () => false))
            ? (await readJson(`packages/modules/${d}/package.json`)).name
            : null;
        }),
      ).then((names) => names.filter((n): n is string => Boolean(n))),
    );

    const workspaceDirs = [
      ...(await fs.readdir(path.join(repo, "packages")))
        .filter((d) => d !== "modules")
        .map((d) => `packages/${d}`),
      ...(await fs.readdir(moduleDir)).map((d) => `packages/modules/${d}`),
    ];

    const pkgNameOf = (spec: string) =>
      spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!;

    const walkFiles = async (dir: string): Promise<string[]> => {
      const found: string[] = [];
      if (!(await fs.stat(dir).then((s) => s.isDirectory(), () => false))) return found;
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...(await walkFiles(full)));
        else if (/\.(m?js|cjs|tsx?)$/.test(entry.name)) found.push(full);
      }
      return found;
    };

    const missing: string[] = [];
    const unused: string[] = [];

    for (const relDir of workspaceDirs) {
      const manifestPath = path.join(repo, relDir, "package.json");
      if (!(await fs.stat(manifestPath).then(() => true, () => false))) continue;
      const pkg = await readJson(`${relDir}/package.json`);
      const runtimeDeclared = new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ]);

      const runtimeFiles = [
        ...(await walkFiles(path.join(repo, relDir, "src"))),
        ...(await walkFiles(path.join(repo, relDir, "bin"))),
      ];
      const allFiles = await walkFiles(path.join(repo, relDir));

      const runtimeImports = new Set<string>();
      for (const file of runtimeFiles) {
        const text = withoutComments(await fs.readFile(file, "utf8"));
        if (file.endsWith(".tsx") && /<\/[A-Za-z>]|<[A-Za-z][^>\n]*\/>/.test(text)) runtimeImports.add("react");
        for (const m of text.matchAll(
          /^\s*(?:import|export)\s+(?!type\b)(?:[^"'\n;]*?\s+from\s+)?["']([^"'./][^"']*)["']|\bimport\(\s*["']([^"'./][^"']*)["']\s*\)/gm,
        )) {
          const spec = m[1] ?? m[2];
          if (!spec || spec.startsWith("node:")) continue;
          runtimeImports.add(pkgNameOf(spec));
        }
      }

      for (const imp of runtimeImports) {
        if (imp === pkg.name) continue;
        // @isocan/server reaches @isocan/cloudstore by dynamic import only on Cloud Run (tested below).
        if (pkg.name === "@isocan/server" && imp === "@isocan/cloudstore") continue;
        // Build-time modules are coupled exclusively by the two module lists (test/modules.test.ts).
        if ((pkg.name === "@isocan/web" || pkg.name === "@isocan/cli") && moduleNames.has(imp)) continue;
        if (!runtimeDeclared.has(imp)) {
          missing.push(`${relDir}/package.json is missing runtime dependency "${imp}"`);
        }
      }

      const anyReferenced = new Set<string>(runtimeImports);
      for (const file of allFiles) {
        const text = withoutComments(await fs.readFile(file, "utf8"));
        if (file.endsWith(".tsx") && /<\/[A-Za-z>]|<[A-Za-z][^>\n]*\/>/.test(text)) anyReferenced.add("react");
        for (const m of text.matchAll(
          /^\s*(?:import|export)\s+(?:type\s+)?(?:[^"'\n;]*?\s+from\s+)?["']([^"'./][^"']*)["']|\bimport\(\s*["']([^"'./][^"']*)["']\s*\)/gm,
        )) {
          const spec = m[1] ?? m[2];
          if (!spec || spec.startsWith("node:")) continue;
          anyReferenced.add(pkgNameOf(spec));
        }
      }

      for (const dep of runtimeDeclared) {
        if (!anyReferenced.has(dep)) {
          unused.push(`${relDir}/package.json declares unused dependency "${dep}"`);
        }
      }
    }

    expect(missing, missing.join("\n")).toEqual([]);
    expect(unused, unused.join("\n")).toEqual([]);
  });

  it("keeps the cloud backing's 43 MiB out of the CLI install, in both directions", async () => {
    // The two-way guard, and the direction that matters is the SECOND one.
    // The root manifest once carried a copy of what the CLI needs at runtime
    // (DC-2 removed it), and @google-cloud/firestore and @google-cloud/storage
    // were the first dependencies that must NOT be — 156 packages and ~43 MiB
    // onto every `npm i -g github:dglazkov/isocan#release`, for a daemon that
    // runs FileStore and never loads a line of it. So they live in a fourth
    // workspace nobody installs, `daemon.ts` reaches it by dynamic import, and
    // both halves of that arrangement are asserted here rather than tolerated
    // as an exception.
    const pkg = await readJson("package.json");
    const cloudstore = await readJson("packages/cloudstore/package.json");
    const cloudDeps = Object.keys(cloudstore.dependencies ?? {}).filter((dep) =>
      dep.startsWith("@google-cloud/"),
    );
    expect(cloudDeps.sort()).toEqual(["@google-cloud/firestore", "@google-cloud/storage"]);

    for (const manifest of ["package.json", "packages/cli/package.json", "packages/server/package.json"]) {
      const declared = Object.keys({
        ...(await readJson(manifest)).dependencies,
        ...(await readJson(manifest)).devDependencies,
      });
      for (const dep of declared) {
        expect(dep.startsWith("@google-cloud/"), `${manifest} hoists ${dep}`).toBe(false);
      }
    }
    // And nothing an installed CLI can resolve names the cloud workspace: the
    // loader maps two packages by path, and this is not one of them.
    expect(Object.keys(pkg.dependencies)).not.toContain("@isocan/cloudstore");
    const loader = await fs.readFile(
      path.join(repo, "packages/cli/bin/workspace-loader.mjs"),
      "utf8",
    );
    expect(loader).not.toContain("@isocan/cloudstore");
  });

  it("never depends on its own workspaces — link deps break every reinstall", async () => {
    // `"@isocan/core": "file:packages/core"` reads as harmless and installs
    // fine ONCE. Reinstalling over it leaves npm rebuilding a link whose
    // target it just deleted: "Cannot destructure property 'package' of
    // 'node.target'". bin/workspace-loader.mjs resolves them by path instead.
    const pkg = await readJson("package.json");
    const declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(declared.filter((name) => name.startsWith("@isocan/"))).toEqual([]);

    const loader = await fs.readFile(
      path.join(repo, "packages/cli/bin/workspace-loader.mjs"),
      "utf8",
    );
    for (const name of ["@isocan/core", "@isocan/server"]) expect(loader).toContain(name);
  });

  it("hands out an install spec with the branch on it — the bare repo installs nothing", async () => {
    // `npm i -g github:dglazkov/isocan` (no branch) leaves an EMPTY directory
    // and a dangling `isocan` on the PATH: npm's git installer sees `prepare`
    // (or `workspaces`, or `build`) on main, runs a nested install inside its
    // staging clone, and that install inherits the outer `-g`. Every spec we
    // print, run, or document therefore ends in #release.
    //
    // Phase 8 moved the constant into `@isocan/core`: the command Scene 5
    // hands a person is `npx <spec> setup <address>#<pass>`, printed by the
    // CLI's `isocan pass` AND by the web app's "Bring your own agent…"
    // dialog, so the spec and the address are now one string with one builder
    // (`setupCommand`). The assertion moved with it — and grew a forcing
    // function, because a second copy in `packages/web/src` is exactly the
    // branchless spec this test exists to prevent and is the one place the
    // doc sweep below could never see.
    const address = await fs.readFile(path.join(repo, "packages/core/src/address.ts"), "utf8");
    expect(address).toContain('const INSTALL_SPEC = "github:dglazkov/isocan#release"');
    const strays: string[] = [];
    for (const file of await sourceFiles(path.join(repo, "packages"))) {
      if (file.endsWith(path.join("core", "src", "address.ts"))) continue; // the definition
      // SKILL.md verbatim, generated (scripts/rc-skill.mjs) and held equal to
      // it by packages/rc/test/skill.test.ts — and SKILL.md's specs are
      // swept for #release in the doc loop at the end of this test.
      if (file.endsWith(path.join("rc", "src", "skill.ts"))) continue;
      const text = await fs.readFile(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (line.includes("github:dglazkov/isocan")) {
          strays.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      strays,
      `import INSTALL_SPEC/setupCommand from @isocan/core instead:\n${strays.join("\n")}`,
    ).toEqual([]);

    /**
     * **Nobody builds a `node_modules` path out of a file's own location.**
     *
     * Two tests copied isocan to a temp directory and symlinked the repo's
     * dependencies in as `path.join(repo, "node_modules")`, where `repo` was
     * three levels up from the test file. Correct in a plain checkout, wrong
     * in a git WORKTREE — whose dependencies live in the main checkout — so
     * the copy started with no `tsx`, exited 1 before the first probe, and the
     * test reported "gave up after 3389ms waiting for the other copy to
     * answer". That reads as a slow machine, and the instinct it invites is to
     * raise the timeout, which would never have worked.
     *
     * `nodeModulesDir()` resolves it by asking Node where `tsx` really is.
     * This is the forcing function, because the wrong version is one obvious
     * line that will look right to whoever writes it next.
     */
    // **`sourceFiles` walks `src` only**, and this bug lives in `test` — so
    // sweeping with it passed while the bad line sat two directories away.
    // Caught by mutation-testing this guard, which is the only reason it is
    // not still a silent zero.
    const built: string[] = [];
    for (const file of await testFiles(path.join(repo, "packages"))) {
      const text = await fs.readFile(file, "utf8");
      for (const [i, line] of text.split("\n").entries()) {
        if (/(join|resolve)\([^)]*\brepo\b[^)]*["'`]node_modules/.test(line)) {
          built.push(`${path.relative(repo, file)}:${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(
      built,
      `use nodeModulesDir() — a worktree keeps its dependencies elsewhere:\n${built.join("\n")}`,
    ).toEqual([]);

    for (const doc of ["README.md", ".agents/skills/isocan-collab/SKILL.md"]) {
      const text = await fs.readFile(path.join(repo, doc), "utf8");
      const specs = text.match(/github:dglazkov\/isocan[^\s`.,)]*/g) ?? [];
      expect(specs.length, `${doc} should say how to install`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec, `${doc} names a branchless install spec`).toContain("#release");
      }
    }
  });

  it("the release branch's manifest keeps none of the keys npm would 'prepare'", async () => {
    // pacote/lib/git.js: `workspaces` or any of these scripts and npm decides
    // the package must be built before use — which is where the empty install
    // comes from. main needs `prepare` and `workspaces`; the branch we hand
    // out must have shed both, and that is scripts/release.mjs's one job.
    // @ts-expect-error — a plain .mjs module with no types.
    const { releaseManifest, PREPARATION_KEYS } = await import("../scripts/release.mjs");
    const pkg = await readJson("package.json");
    const released: Record<string, any> = releaseManifest(pkg, "abc1234");
    for (const key of PREPARATION_KEYS) {
      const [outer, inner] = key.split(".");
      const value = inner ? released[outer!]?.[inner] : released[outer!];
      expect(value, `${key} survived into the release manifest`).toBeUndefined();
    }
    // What an install DOES need: the bin it links, and the deps it resolves.
    //
    // The bin is NOT main's. main's is `packages/cli/bin/isocan.js`, which
    // registers tsx and imports 297 `.ts` files through it on every command —
    // seconds, in the hosted sandbox of #332. The release's is the bundle
    // `buildCliBundle` writes, and this asserts the two halves of that are
    // one: the manifest names the file the builder produces
    // (`docs/projects/first-minute/design.md`).
    // @ts-expect-error — a plain .mjs module with no types.
    const { CLI_BUNDLE, RELEASE_DEPENDENCIES } = await import("../scripts/release.mjs");
    expect(released.bin).toEqual({ isocan: CLI_BUNDLE });
    expect(pkg.bin.isocan).toBe("packages/cli/bin/isocan.js");

    // And the deps are NOT main's either, since phase 2: they are inlined
    // into that bundle, so a git install resolves nothing. What survives is
    // named one by one in `RELEASE_DEPENDENCIES` with the reason — the test
    // above ("the root package is the CLI") still holds main's manifest to
    // carrying everything a workspace needs at runtime, which is what the
    // bundler reads.
    expect(Object.keys(released.dependencies)).toEqual(Object.keys(RELEASE_DEPENDENCIES));
    for (const [name, range] of Object.entries(released.dependencies)) {
      expect(range, `${name} must be the range main declares`).toBe(pkg.dependencies[name]);
    }
    expect(released["//"]).toContain("abc1234");
  });

  it("the release manifest moves the types condition to the compiled declarations", async () => {
    // An install has no workspace links and tsserver refuses `.ts` sources in
    // node_modules (measured 31 Aug: TS5097 and TS2307 on every api file), so
    // the release ships `types/` (release.mjs's emitTypes) and its manifest
    // must aim the editor there. The default stays the loader-registering
    // entry: runtime still runs the sources.
    // @ts-expect-error — a plain .mjs module with no types.
    const { releaseManifest } = await import("../scripts/release.mjs");
    const pkg = await readJson("package.json");
    const shipped = releaseManifest(pkg).exports["."];
    expect(shipped).toEqual({
      types: "./types/api/src/index.d.ts",
      default: "./index.mjs",
    });
  });

  it("the release manifest aims every export's types at declarations the release emits", async () => {
    // Room phase 0 added `./rc` beside `.`. The script once rewrote `.` alone,
    // so a second export would have shipped a `types` path into `.ts` sources
    // an installed editor cannot read. Every `types` entry maps the same way,
    // and the workspace it names is one emitTypes compiles.
    // @ts-expect-error — a plain .mjs module with no types.
    const { releaseManifest, RELEASE_TYPE_ROOTS } = await import("../scripts/release.mjs");
    const pkg = await readJson("package.json");
    const shipped = releaseManifest(pkg).exports;
    expect(Object.entries(shipped["./rc"])).toEqual([
      ["types", "./types/rc/src/index.d.ts"],
      ["browser", "./packages/rc/dist/index.mjs"],
      ["default", "./rc.mjs"],
    ]);
    expect(RELEASE_TYPE_ROOTS).toContain("packages/rc/src");
    for (const [key, entry] of Object.entries(pkg.exports as Record<string, { types?: string }>)) {
      if (typeof entry !== "object" || !entry.types) continue;
      const workspace = /^\.\/(packages\/[^/]+\/src)\//.exec(entry.types)?.[1];
      expect(RELEASE_TYPE_ROOTS, `${key}'s types live in a workspace the release never compiles`).toContain(workspace);
      expect(shipped[key].types).toBe(entry.types.replace(/^\.\/packages\//, "./types/").replace(/\.ts$/, ".d.ts"));
    }
  });

  it("the emitted declarations include isocan/rc, self-contained", async () => {
    // The emit itself, into a scratch directory: about two seconds of tsc,
    // cheap enough that the manifest's claim is checked against real files.
    // @ts-expect-error — a plain .mjs module with no types.
    const { emitTypes, releaseManifest } = await import("../scripts/release.mjs");
    const out = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-types-"));
    try {
      await emitTypes(out);
      const shipped = releaseManifest(await readJson("package.json")).exports;
      for (const key of [".", "./rc"]) {
        const declared = path.join(out, shipped[key].types.replace(/^\.\/types\//, ""));
        await expect(fs.access(declared), `${key}: ${declared}`).resolves.toBeUndefined();
      }
      const helpers = await fs.readFile(path.join(out, "rc/src/helpers.d.ts"), "utf8");
      expect(helpers).not.toMatch(/"@isocan\//);
      expect(helpers).toContain('"../../core/src/index.js"');
      // The entry re-exports the route surface a host constructs by a
      // workspace subpath an install cannot resolve, so
      // the emit must have rewritten it into the tree, at a file that exists.
      const index = await fs.readFile(path.join(out, "rc/src/index.d.ts"), "utf8");
      expect(index).not.toMatch(/"@isocan\//);
      expect(index).toContain('"../../api/src/routes.js"');
      const routes = await fs.readFile(path.join(out, "api/src/routes.d.ts"), "utf8");
      expect(routes).toContain("export declare class DaemonRoutes");
      expect(routes).not.toMatch(/"@isocan\//);
      expect(routes).toContain('"../../core/src/design-request.js"');
      // All emitted declarations must be standalone, including lazy subpaths
      // whose export name differs from their source filename (design-audit).
      const declarations = await fs.readdir(out, { recursive: true });
      for (const file of declarations.filter(name => name.endsWith(".d.ts"))) {
        const full = path.join(out, file), text = await fs.readFile(full, "utf8");
        expect(text, file).not.toMatch(/"@isocan\//);
        for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*)"(\.[^"]+)"/g)) {
          const target = path.resolve(path.dirname(full), match[1]!.replace(/\.js$/, ".d.ts"));
          expect(path.relative(out, target).startsWith(".."), `${file}: ${match[1]} escapes the declarations`).toBe(false);
          await expect(fs.access(target), `${file}: ${match[1]} has no declaration`).resolves.toBeUndefined();
        }
      }
      // And both entries hand over core's address helpers, re-exported from core's own declarations inside the tree.
      const apiIndex = await fs.readFile(path.join(out, "api/src/index.d.ts"), "utf8");
      for (const declared of [index, apiIndex]) {
        expect(declared).toMatch(/export \{[^}]*canvasUrlWithPass[^}]*isLoopbackBase[^}]*parseCanvasAddress[^}]*\} from "\.\.\/\.\.\/core\/src\/index\.js"/);
      }
      expect(apiIndex).not.toMatch(/"@isocan\//);
      const address = await fs.readFile(path.join(out, "core/src/address.d.ts"), "utf8");
      expect(address).toContain("export declare function parseCanvasAddress(raw: string): CanvasAddress | null;");
    } finally {
      await fs.rm(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("an installed isocan/rc bundles for the browser: the release manifest and bundle, as a host installs them", async () => {
    // Room phase 4, journey 3 inside the suite. Measured against release at
    // e4af490: `esbuild --platform=browser` over an installed `isocan/rc`
    // resolved `rc.mjs`, which registers tsx, and failed on `node:module`,
    // `node:crypto` and `@isocan/rc`. The boundary test bundled the source
    // entry and never saw it. So this lays out what an install is, and only
    // that: the manifest releaseManifest writes, the bundle buildBrowserBundles
    // writes, and `rc.mjs` (so that a manifest without the `browser`
    // condition fails the way an install did, on `node:module`, rather than on
    // a missing file). No sources, no workspace links, no tsx to fall back on.
    // @ts-expect-error — a plain .mjs module with no types.
    const { releaseManifest, buildBrowserBundles } = await import("../scripts/release.mjs");
    const { build } = await import("esbuild");
    const rootPkg = await readJson("package.json");
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-host-"));
    try {
      const installed = path.join(tmp, "node_modules", "isocan");
      await fs.mkdir(installed, { recursive: true });
      const [bundle] = await buildBrowserBundles(installed);
      await fs.copyFile(path.join(repo, "rc.mjs"), path.join(installed, "rc.mjs"));
      await fs.writeFile(path.join(tmp, "entry.mjs"), 'import "isocan/rc";\n');
      // The host's one-line bundle, through whatever manifest is installed:
      // no `external`, so a `node:` import anywhere is a resolve error.
      const bundleThrough = async (manifest: Record<string, unknown>) => {
        await fs.writeFile(path.join(installed, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
        return build({
          absWorkingDir: tmp,
          entryPoints: ["entry.mjs"],
          bundle: true,
          platform: "browser",
          format: "esm",
          write: false,
          metafile: true,
          logLevel: "silent",
        }).then(
          (result) => ({ result, errors: "" }),
          (err: { errors?: { text: string; location?: { file: string } | null }[] }) => ({
            result: null,
            errors: (err.errors ?? []).map((e) => `${e.location?.file ?? ""}: ${e.text}`).join("\n") || String(err),
          }),
        );
      };

      const released = releaseManifest(rootPkg, "abc1234");
      const { result, errors } = await bundleThrough(released);
      expect(errors, "the installed isocan/rc must bundle for the browser platform").toBe("");
      expect(result!.outputFiles[0]!.text).not.toMatch(/node:/);
      // What the host's bundler read: the entry and the release's bundle,
      // nothing else, so no `node:` import could have been left external.
      expect(Object.keys(result!.metafile.inputs).sort()).toEqual(
        ["entry.mjs", "node_modules/isocan/packages/rc/dist/index.mjs"].sort(),
      );
      expect(path.join(installed, released.exports["./rc"].browser)).toBe(bundle);

      // Falsified by the manifest an install had before this phase: the
      // bundler takes `default`, reads `rc.mjs`, and stops on `node:module`.
      const { browser: _browser, ...withoutBrowser } = released.exports["./rc"];
      const before = await bundleThrough({ ...released, exports: { ...released.exports, "./rc": withoutBrowser } });
      expect(before.result).toBeNull();
      expect(before.errors).toContain('Could not resolve "node:module"');

      // The bundle is a real module too: node-free ESM runs in Node, and its
      // exports are the package's runtime surface, name for name.
      const surface = await import(pathToFileURL(bundle!).href);
      const source = await import("../packages/rc/src/index.ts");
      expect(Object.keys(surface).sort()).toEqual(Object.keys(source).sort());
      expect(typeof surface.runRoom).toBe("function");
      // And the client a host constructs, inlined
      // into the same node-free bundle rather than left to a Node entry.
      expect(typeof surface.DaemonRoutes).toBe("function");
      // And core's address helpers, in the same bundle.
      expect(surface.parseCanvasAddress("https://acme.example/p/prj_acme#pas_acme.s3cret")).toEqual({
        origin: "https://acme.example",
        canvasId: "prj_acme",
        pass: "pas_acme.s3cret",
      });
      expect(surface.isLoopbackBase("http://127.0.0.1:4441")).toBe(true);
      expect(surface.COLLAB_SKILL).toBe(source.COLLAB_SKILL);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it("releases from CI on every commit, with the history a push needs", async () => {
    // Nobody remembers to release by hand, and an unreleased commit is one
    // nobody can install. Two things the workflow cannot get wrong: full
    // history (the release commit names two parents by sha, and a shallow
    // clone cannot push what it does not have), and one concurrency group
    // (the branch is pushed, never forced — two runs racing would leave the
    // second non-fast-forward).
    const workflow = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    expect(workflow).toMatch(/branches:\s*\[main\]/);
    expect(workflow).toMatch(/fetch-depth:\s*0/);
    expect(workflow).toMatch(/group:\s*release/);
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
    expect(workflow).toContain("npm run release");
  });

  it("ships the built web app, which .gitignore would otherwise drop", async () => {
    // Two ways the app reaches a daemon, and .npmignore is load-bearing for
    // both: `prepare` builds packages/web/dist in a checkout, `npm run
    // release` commits it onto the release branch — and either way dist is
    // gitignored, so without an .npmignore to override those rules pack-time
    // would drop it and the daemon would serve an empty page.
    const pkg = await readJson("package.json");
    expect(pkg.scripts.prepare).toContain("prepare.mjs");
    const npmignore = await fs.readFile(path.join(repo, ".npmignore"), "utf8");
    expect(npmignore).not.toMatch(/^\s*dist\s*$/m);
    const gitignore = await fs.readFile(path.join(repo, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^dist$/m); // on main it stays an artifact
  });
});

/**
 * Every `.ts` under each workspace's `test` directory, for the guards whose
 * subject is what a TEST does rather than what ships. `sourceFiles` below
 * deliberately walks `src` only, and a guard that reached for it to check test
 * code swept an empty set and reported success — found by mutation-testing the
 * guard, which is the only reason it is not still a silent zero.
 */
async function testFiles(packages: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };
  for (const pkg of await fs.readdir(packages)) {
    const dir = path.join(packages, pkg, "test");
    if (await fs.stat(dir).then((st) => st.isDirectory(), () => false)) await walk(dir);
  }
  return found;
}

/** Every `.ts`/`.tsx` under the workspaces' `src` directories — the same walk
 * `core/test/address.test.ts` uses for its own forcing function, and for the
 * same reason: a rule that only holds where somebody remembered to look is not
 * a rule. */
async function sourceFiles(packages: string): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (/\.tsx?$/.test(entry.name)) found.push(full);
    }
  };
  for (const pkg of await fs.readdir(packages)) {
    const src = path.join(packages, pkg, "src");
    if (await fs.stat(src).then((s) => s.isDirectory(), () => false)) await walk(src);
  }
  return found;
}

/**
 * **What the release branch must NOT carry.**
 *
 * Adding `.github/workflows/grade.yml` rejected both of the release job's
 * pushes — the release branch AND `green` — with "refusing to allow a GitHub
 * App to create or update workflow … without `workflows` permission". No
 * `permissions:` key grants that scope, so the fix is not to ask for more: the
 * release tree does not carry `.github/`, and a tree with no workflow files in
 * it cannot be a workflow change.
 *
 * Which is right on its own terms besides. An install is a package, and nobody
 * installing isocan needs our CI — a fork of the release branch would inherit
 * a nightly grader and a changelog job aimed at somebody else's repository.
 *
 * **The `green` half of that story did not hold up.** The next run pushed the
 * same workflow change to `green` with identical permissions and was allowed,
 * so the rejection is conditional on something neither run made visible. The
 * cases below guard the two things that ARE established: the release tree's
 * contents, and a failure path that prints what git said instead of naming a
 * cause it never checked.
 */
describe("the release branch is a package, not a copy of the repo", () => {
  it("does not ship .github — the CI belongs to this repo, not to installs", async () => {
    const script = await fs.readFile(path.join(repo, "scripts/release.mjs"), "utf8");
    expect(script).toMatch(/git\("rm", "-r", "--cached", "--ignore-unmatch", "-q", "\.github"/);
  });

  it("the release job asks for no permission that cannot exist", async () => {
    // `workflows` is a PAT scope. Writing it here is a workflow that fails to
    // parse; asking for `actions: write` instead is a scope that looks like
    // the fix and is not, which is the more expensive mistake.
    const yml = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    const block = yml.slice(yml.indexOf("permissions:"), yml.indexOf("jobs:"));
    const asked = [...block.matchAll(/^\s{2}([a-z-]+):\s*(write|read)/gm)].map((m) => m[1]);
    expect(asked).toEqual(["contents"]);
  });

  it("green's failure prints what git said instead of guessing at ordering", async () => {
    // It guessed, once, and was confidently wrong: the push was rejected over
    // a workflow file and the step printed "an out-of-order or re-run build" —
    // as a WARNING, leaving the step green. The replacement deliberately does
    // NOT assert a cause of its own, because the next run contradicted the one
    // I would have written.
    const yml = await fs.readFile(path.join(repo, ".github/workflows/release.yml"), "utf8");
    expect(yml).toContain("git push origin ${GITHUB_SHA}:green");
    expect(yml).toMatch(/grep -q "workflow" \/tmp\/green\.err/);
  });
});
