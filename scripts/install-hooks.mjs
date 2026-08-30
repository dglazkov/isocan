#!/usr/bin/env node
/**
 * **Put the repo's hooks where git will find them — as symlinks, one at a time.**
 *
 *   node scripts/install-hooks.mjs          # install
 *   node scripts/install-hooks.mjs --status # what is installed, and to what
 *   node scripts/install-hooks.mjs --remove # take them back out
 *
 * **A symlink per hook, not `core.hooksPath`.** Pointing `core.hooksPath` at a
 * directory takes over EVERY hook at once, including ones this repo does not
 * ship and somebody else's tooling installed. One symlink per hook we actually
 * have is the smaller promise, and `--remove` can keep it exactly.
 *
 * **It refuses to overwrite a hook it did not write.** A real `post-commit`
 * somebody wrote by hand is theirs; this says so and stops rather than moving
 * it aside helpfully.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(repo, "scripts", "hooks");
const dir = execFileSync("git", ["rev-parse", "--git-path", "hooks"], { cwd: repo, encoding: "utf8" }).trim();
const dest = path.resolve(repo, dir);
const argv = process.argv.slice(2);

const hooks = existsSync(src) ? readdirSync(src).filter((f) => !f.startsWith(".")) : [];
if (hooks.length === 0) {
  console.log("no hooks in scripts/hooks — nothing to install");
  process.exit(0);
}

/** Ours iff it is a symlink pointing into `scripts/hooks`. */
const ours = (p) => {
  try {
    return lstatSync(p).isSymbolicLink() && path.resolve(path.dirname(p), readlinkSync(p)).startsWith(src);
  } catch {
    return false;
  }
};

if (argv.includes("--status")) {
  for (const hook of hooks) {
    const at = path.join(dest, hook);
    console.log(
      `${hook.padEnd(14)} ${!existsSync(at) && !ours(at) ? "not installed" : ours(at) ? "installed" : "occupied by something else"}`,
    );
  }
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const hook of hooks) {
  const at = path.join(dest, hook);
  if (argv.includes("--remove")) {
    if (ours(at)) {
      unlinkSync(at);
      console.log(`removed  ${path.relative(repo, at)}`);
    } else {
      console.log(`left     ${path.relative(repo, at)} — not ours to remove`);
    }
    continue;
  }
  if (ours(at)) {
    console.log(`already  ${path.relative(repo, at)}`);
    continue;
  }
  if (existsSync(at) || lstatSync(at, { throwIfNoEntry: false })) {
    console.error(
      `refusing ${path.relative(repo, at)} — a hook is already there and this did not write it.\n` +
        "         Move it aside yourself if you want ours; a hook is somebody's build.",
    );
    process.exitCode = 1;
    continue;
  }
  symlinkSync(path.relative(dest, path.join(src, hook)), at);
  console.log(`linked   ${path.relative(repo, at)} → scripts/hooks/${hook}`);
}
