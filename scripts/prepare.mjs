#!/usr/bin/env node
/**
 * Build the web bundle when a checkout is installed.
 *
 * `packages/web/dist` is a build artifact, so it is not committed — which
 * would leave a fresh clone's daemon serving an empty page, and the suite
 * (the bundle budget, the release CLI's own test) with nothing to read. So
 * `npm install` / `npm ci` in a checkout builds it once, here.
 *
 * **What this no longer does** (cleanup phase 4, DC-5, 27 Sep 2026). It was
 * written for `npm i -g github:dglazkov/isocan` — a git install from `main` —
 * which resolves only the root package's dependencies, so it ran a nested
 * `npm install --workspaces` first to put vite and React on disk, with a
 * sentinel to keep that nested install from re-entering. Installs from `main`
 * stopped happening: npm installs an empty directory from it (#47), every
 * install spec names `#release`, and the release branch has no `prepare`. In
 * a checkout `npm install` has already installed every workspace by the time
 * this runs, so the nested one was the same install twice. It went.
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
console.error("isocan: building the web app (once, so the daemon has something to serve)…");
spawnSync(npm, ["run", "build"], { cwd: root, stdio: "inherit" });

if (!existsSync(built)) {
  console.error("isocan: web app not built — the CLI works; `npm run build` when you want the canvas.");
}
