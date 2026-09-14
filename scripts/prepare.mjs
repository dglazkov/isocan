#!/usr/bin/env node
/**
 * Build the web bundle at install time.
 *
 * `packages/web/dist` is a build artifact, so it is neither committed nor
 * packed — which would leave anyone who installed isocan straight from git
 * (`npm i -g github:dglazkov/isocan`, or `npx github:dglazkov/isocan`) with a
 * daemon that serves an empty page. npm runs `prepare` for git installs
 * exactly for this: the source arrives, the artifact is made here.
 *
 * The workspaces are installed first because a git install only resolves the
 * root package's dependencies — vite and React live one level down. The
 * sentinel keeps that nested install from re-entering this script.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

function registerMergeDriver() {
  const git = (...args) => spawnSync("git", args, { cwd: root, stdio: "ignore" });
  if (git("rev-parse", "--git-dir").status !== 0) return; // a tarball, not a clone
  git("config", "merge.isocan-generated.name", "regenerate rather than merge (scripts/mergegen.mjs)");
  git("config", "merge.isocan-generated.driver", `node ${path.join(root, "scripts/mergegen.mjs")} %P %A`);
}
const built = path.join(root, "packages/web/dist/index.html");

if (process.env.ISOCAN_PREPARE === "1") process.exit(0); // nested install
/**
 * **The merge driver for generated docs, registered before anything else.**
 *
 * `.gitattributes` says `docs/ROADMAP.md merge=isocan-generated`; a driver by
 * that name has to exist in `.git/config`, which is per clone and cannot be
 * committed. Here rather than in `install-hooks.mjs` because hooks are opt-in
 * (`npm run hooks`) and this is not worth remembering: the four generated docs
 * were 300 of the 512 commits in a fortnight, and every one of them was a
 * conflict somebody resolved by hand in a file that is a pure function of
 * other files.
 *
 * Before the early return below, because a checkout that already has a built
 * web app still needs the driver. Failure is silent and harmless — without it
 * git falls back to the ordinary merge, which is exactly what these files had
 * before.
 */
registerMergeDriver();

if (existsSync(built)) process.exit(0); // already built — `npm run build` to refresh

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (...args) =>
  spawnSync(npm, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ISOCAN_PREPARE: "1" },
  });

console.error("isocan: building the web app (once, so the daemon has something to serve)…");
// --ignore-scripts: the build needs vite and React on disk, not anyone's
// install hooks — and fsevents' native rebuild fails inside npm's staging
// directory, which would otherwise take the whole build down with it.
run("install", "--workspaces", "--include-workspace-root", "--ignore-scripts", "--no-audit", "--no-fund");
run("run", "build");

if (!existsSync(built)) {
  console.error("isocan: web app not built — the CLI works; `npm run build` when you want the canvas.");
}
