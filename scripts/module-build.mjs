#!/usr/bin/env node
/**
 * **Build a module for runtime loading** (`docs/projects/modules/design.md`,
 * phase 3).
 *
 *   node --import tsx scripts/module-build.mjs <name> [--out <dir>]
 *
 * Turns `packages/modules/<name>/` into the directory `isocan module add`
 * installs: `manifest.json`, `agent-guide.md`, `dist/web.js` (+ chunks),
 * `dist/cli.mjs`. The manifest is written FROM the package and its core
 * record — the name, version and engines from `package.json`, the kinds and
 * property keys from `src/core.ts`'s default export — so the declaration a
 * person reads before `--yes` and the code that runs come from one place.
 *
 * **Platform imports become host reads.** A module served out of
 * `~/.isocan/modules` cannot import `react` or `@isocan/core` by name;
 * nothing there resolves them, and bundling a second React would break
 * hooks. So each such import is rewritten to a read of `globalThis.isocan`
 * — the object the shell (`lib/runtimeModules.ts`) and the CLI
 * (`runtime-modules.ts`) set before importing anything. Everything else the
 * module needs (its library, its own files) is bundled in; the web half is
 * code-split so a lazy boundary in the source stays lazy on the wire.
 *
 * `tsx` is needed only to import the core record for the manifest; esbuild
 * does the bundling.
 */
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import esbuild from "esbuild";

const repo = fileURLToPath(new URL("..", import.meta.url));
const argv = process.argv.slice(2);
const name = argv.find((a) => !a.startsWith("--"));
const outFlag = argv.indexOf("--out");
if (!name) {
  console.error("usage: node --import tsx scripts/module-build.mjs <name> [--out <dir>]");
  process.exit(2);
}
const src = path.join(repo, "packages/modules", name);
if (!existsSync(path.join(src, "package.json"))) {
  console.error(`no module at ${src}`);
  process.exit(2);
}
const out = path.resolve(outFlag >= 0 ? argv[outFlag + 1] : path.join(repo, "packages/modules", name, "build"));

/** The four platform imports a module may make, and the host key each reads. */
const HOST = {
  react: "React",
  "react/jsx-runtime": "jsxRuntime",
  "react-dom": "ReactDOM",
  "@isocan/core": "core",
};
const hostPlugin = {
  name: "isocan-host",
  setup(build) {
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react-dom|@isocan\/core)$/ }, (args) => ({
      path: args.path,
      namespace: "isocan-host",
    }));
    build.onLoad({ filter: /.*/, namespace: "isocan-host" }, (args) => ({
      contents: `module.exports = globalThis.isocan.${HOST[args.path]};`,
      loader: "js",
    }));
    // A module's CLI half may import `@isocan/cli/modulehost` for TYPES only;
    // should a value import slip in, say so rather than bundle the CLI.
    build.onResolve({ filter: /^@isocan\/(cli|api|server)(\/|$)/ }, (args) => ({
      errors: [{ text: `${args.path} is not available to a runtime module — import types only, and reach the platform through the host` }],
    }));
  },
};

const pkg = JSON.parse(await fs.readFile(path.join(src, "package.json"), "utf8"));
const core = await import(pathToFileURL(path.join(src, "src/core.ts")).href);
const record = core.default;
if (!record || typeof record.name !== "string") {
  console.error(`${name}/src/core.ts has no default export carrying the module's core record`);
  process.exit(2);
}

await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, "dist"), { recursive: true });

const hasWeb = existsSync(path.join(src, "src/web.tsx"));
const hasCli = existsSync(path.join(src, "src/cli.ts"));
const hasGuide = existsSync(path.join(src, "agent-guide.md"));

if (hasWeb) {
  await esbuild.build({
    entryPoints: { web: path.join(src, "src/web.tsx") },
    bundle: true,
    format: "esm",
    splitting: true,
    platform: "browser",
    target: "es2022",
    jsx: "automatic",
    outdir: path.join(out, "dist"),
    chunkNames: "chunks/[name]-[hash]",
    plugins: [hostPlugin],
    logLevel: "warning",
    minify: true,
  });
}
if (hasCli) {
  await esbuild.build({
    entryPoints: { cli: path.join(src, "src/cli.ts") },
    // `.mjs`, because a home directory has no package.json saying "module" and
    // Node would read a `.js` there as CommonJS — the whole half would refuse.
    outExtension: { ".js": ".mjs" },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outdir: path.join(out, "dist"),
    plugins: [hostPlugin],
    logLevel: "warning",
  });
}
if (hasGuide) await fs.copyFile(path.join(src, "agent-guide.md"), path.join(out, "agent-guide.md"));

const manifest = {
  name: pkg.name,
  version: pkg.version,
  ...(pkg.description ? { description: pkg.description } : {}),
  engines: pkg.isocan?.engines ?? ">=0.1.0",
  ...(record.kinds ? { kinds: record.kinds } : {}),
  ...(record.propertyKeys ? { propertyKeys: record.propertyKeys } : {}),
  ...(hasWeb ? { web: "dist/web.js" } : {}),
  ...(hasCli ? { cli: "dist/cli.mjs" } : {}),
  ...(hasGuide ? { guide: "agent-guide.md" } : {}),
};
await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const files = (await fs.readdir(path.join(out, "dist"), { recursive: true })).filter((f) => !f.endsWith(path.sep) && f.includes("."));
console.log(`built ${manifest.name} ${manifest.version} → ${out}`);
console.log(`  ${files.length} file${files.length === 1 ? "" : "s"} in dist/${hasGuide ? ", agent-guide.md" : ""}, manifest.json`);
console.log(`  isocan module add ${path.relative(process.cwd(), out) || "."}`);
